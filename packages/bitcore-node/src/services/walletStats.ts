import { ObjectID } from 'mongodb';
import logger from '../logger';
import { BitcoinBlock, BitcoinBlockStorage } from '../models/block';
import { CoinModel, CoinStorage } from '../models/coin';
import { IWalletStats, WalletStatsModel, WalletStatsStorage } from '../models/walletStats';
import { IWalletStatsWallet, WalletStatsWalletModel, WalletStatsWalletStorage } from '../models/walletStatsWallet';
import { SpentHeightIndicators } from '../types/Coin';
import parseArgv from '../utils/parseArgv';
import '../utils/polyfills';
import { Config } from './config';

const args = parseArgv([], [
  { arg: 'CHAIN', type: 'string' },
  { arg: 'NETWORK', type: 'string' },
  { arg: 'EXIT', type: 'bool' }
]);

const ONE_MIN = 1000 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export class WalletStatsService {
  stopping = false;
  running = false;
  interval;
  walletStatsModel: WalletStatsModel;
  walletStatsWalletModel: WalletStatsWalletModel;
  coinModel: CoinModel;
  blockModel: BitcoinBlock;
  configService;

  constructor({
    walletStatsModel = WalletStatsStorage,
    walletStatsWalletModel = WalletStatsWalletStorage,
    coinModel = CoinStorage,
    blockModel = BitcoinBlockStorage,
    configService = Config
  } = {}) {
    this.walletStatsModel = walletStatsModel;
    this.walletStatsWalletModel = walletStatsWalletModel;
    this.coinModel = coinModel;
    this.blockModel = blockModel;
    this.configService = configService;
  }

  get serviceConfig() {
    return this.configService.for('walletStats') || {};
  }

  async start() {
    if (this.configService.isDisabled('walletStats')) {
      logger.info('Disabled Wallet Stats Service');
      return;
    }
    logger.info('Starting Wallet Stats Service');
    if (args.EXIT) {
      this.tick().then(() => {
        process.emit('SIGINT', 'SIGINT');
      });
    } else {
      this.interval = setInterval(this.tick.bind(this), ONE_MIN);
    }
  }

  async stop() {
    logger.info('Stopping Wallet Stats Service');
    this.stopping = true;
    clearInterval(this.interval);
  }

  // Sum each wallet's spendable balance in one pass over the coins collection.
  // Mirrors the "unspent, valid mint" predicate used by CoinModel.getWalletBalance
  // (spentHeight below the spent threshold, mintHeight above conflicting), unwinding
  // shared coins so a coin held by multiple wallets is counted for each.
  async collectUtxoBalances(params: { chain: string; network: string }): Promise<Map<string, bigint>> {
    const { chain, network } = params;
    const rows = await this.coinModel.collection
      .aggregate<{ _id: any; balance: number }>(
        [
          {
            $match: {
              chain,
              network,
              'wallets.0': { $exists: true },
              spentHeight: { $lt: SpentHeightIndicators.minimum },
              mintHeight: { $gt: SpentHeightIndicators.conflicting }
            }
          },
          { $unwind: '$wallets' },
          { $group: { _id: '$wallets', balance: { $sum: '$value' } } }
        ],
        { allowDiskUse: true }
      )
      .toArray();
    const balances = new Map<string, bigint>();
    for (const row of rows) {
      balances.set(row._id.toString(), BigInt(row.balance));
    }
    return balances;
  }

  // Best-known last-activity date per wallet since `since`. Coins carry block
  // HEIGHTS, not times, so this resolves in three steps: map `since` to a block
  // height, take each wallet's max mint-or-spend height, then resolve those
  // heights back to block times. Mempool/unconfirmed activity lives at negative
  // sentinel heights (SpentHeightIndicators) which have no block time; such
  // wallets are omitted rather than dated, so a wallet appears active only once
  // its activity has confirmed.
  async collectUtxoActivity(params: { chain: string; network: string; since: Date }): Promise<Map<string, Date>> {
    const { chain, network, since } = params;
    const activity = new Map<string, Date>();

    const [sinceBlock] = await this.blockModel.collection
      .find({ chain, network, timeNormalized: { $gte: since } })
      .project({ height: 1 })
      .sort({ timeNormalized: 1 })
      .limit(1)
      .toArray();
    if (!sinceBlock) {
      return activity; // no blocks since `since` => nothing counts as recent
    }
    const sinceHeight = sinceBlock.height;

    const rows = await this.coinModel.collection
      .aggregate<{ _id: any; maxHeight: number }>(
        [
          {
            $match: {
              chain,
              network,
              'wallets.0': { $exists: true },
              $or: [{ mintHeight: { $gte: sinceHeight } }, { spentHeight: { $gte: sinceHeight } }]
            }
          },
          { $unwind: '$wallets' },
          { $group: { _id: '$wallets', maxHeight: { $max: { $max: ['$mintHeight', '$spentHeight'] } } } }
        ],
        { allowDiskUse: true }
      )
      .toArray();

    const heights = [...new Set(rows.map(r => r.maxHeight))].filter(h => h >= SpentHeightIndicators.minimum);
    const heightToDate = new Map<number, Date>();
    if (heights.length) {
      const blocks = await this.blockModel.collection
        .find({ chain, network, height: { $in: heights } })
        .project({ height: 1, timeNormalized: 1 })
        .toArray();
      for (const block of blocks) {
        heightToDate.set(block.height, block.timeNormalized);
      }
    }

    for (const row of rows) {
      const date = heightToDate.get(row.maxHeight);
      if (date) {
        activity.set(row._id.toString(), date);
      }
    }
    return activity;
  }

  // Roll the collected per-wallet facts up into one snapshot document plus the
  // per-wallet fact rows to persist. Pure: all inputs are pre-collected, no I/O.
  // Duplicate wallets still get a fact (isDup: true) but are excluded from every
  // rollup counter so they don't inflate totals. The bitcore/imported split keys
  // off the wallet's creation time (from its ObjectID) versus the snapshot date.
  buildSnapshot(params: {
    chain: string;
    network: string;
    date: string;
    wallets: Array<{ _id: ObjectID }>;
    balances: Map<string, bigint>;
    activity: Map<string, Date>;
    dups: Set<string>;
  }): { snapshot: IWalletStats; walletFacts: IWalletStatsWallet[] } {
    const { chain, network, date, wallets, balances, activity, dups } = params;
    const asOf = new Date(`${date}T00:00:00Z`);
    const snapshot = this.walletStatsModel.newSnapshot({ chain, network, date });
    const walletFacts: IWalletStatsWallet[] = [];

    let walletCntTotal = 0n;
    let walletCntWithBalance = 0n;
    let walletCntBitcore = 0n;
    let walletCntImported = 0n;
    let totalBalance = 0n;
    let totalBalanceImported = 0n;
    let dupWalletCnt = 0n;
    const active = { d14: 0n, d30: 0n, d90: 0n, m6: 0n, m12: 0n };

    for (const wallet of wallets) {
      const id = wallet._id.toHexString();
      const balance = balances.get(id) ?? 0n;
      const lastActivityDate = activity.get(id);
      const createdDate = wallet._id.getTimestamp();
      const isDup = dups.has(id);

      walletFacts.push({
        wallet: wallet._id,
        chain,
        network,
        snapshotDate: date,
        createdDate,
        balance: balance.toString(),
        lastActivityDate,
        isDup
      });

      if (isDup) {
        dupWalletCnt += 1n;
        continue; // dups are excluded from every rollup counter
      }

      walletCntTotal += 1n;
      totalBalance += balance;
      if (balance > 0n) {
        walletCntWithBalance += 1n;
      }
      if (createdDate < asOf) {
        walletCntBitcore += 1n;
      } else {
        walletCntImported += 1n;
        totalBalanceImported += balance;
      }
      const window = this.walletStatsWalletModel.activityWindow(lastActivityDate, asOf);
      if (window) {
        active[window] += 1n;
      }
    }

    snapshot.walletCntTotal = walletCntTotal.toString();
    snapshot.walletCntWithBalance = walletCntWithBalance.toString();
    snapshot.walletCntBitcore = walletCntBitcore.toString();
    snapshot.walletCntImported = walletCntImported.toString();
    snapshot.totalBalance = totalBalance.toString();
    snapshot.totalBalanceImported = totalBalanceImported.toString();
    snapshot.dupWalletCnt = dupWalletCnt.toString();
    snapshot.active = {
      d14: active.d14.toString(),
      d30: active.d30.toString(),
      d90: active.d90.toString(),
      m6: active.m6.toString(),
      m12: active.m12.toString()
    };

    return { snapshot, walletFacts };
  }

  // Weekly snapshot is due once the configured day+hour has passed and the
  // current week's date exceeds the durable watermark (latest snapshot date in DB).
  snapshotDateIfDue(now: Date, watermarkDate: string | null): string | null {
    const targetDay = this.serviceConfig.snapshotDayUTC ?? 1;
    const targetHour = this.serviceConfig.snapshotHourUTC ?? 2;
    const current = this.currentSnapshotDate(now, targetDay, targetHour);
    if (!current) {
      return null;
    }
    if (watermarkDate && watermarkDate >= current) {
      return null;
    }
    return current;
  }

  // Most recent occurrence of the scheduled weekly day+hour, as YYYY-MM-DD
  private currentSnapshotDate(now: Date, targetDay: number, targetHour: number): string | null {
    const d = new Date(now.getTime());
    d.setUTCHours(0, 0, 0, 0);
    let daysBack = (d.getUTCDay() - targetDay + 7) % 7;
    if (daysBack === 0 && now.getUTCHours() < targetHour) {
      daysBack = 7;
    }
    d.setUTCDate(d.getUTCDate() - daysBack);
    return d.toISOString().split('T')[0];
  }

  missedSnapshotDates(now: Date, watermarkDate: string): string[] {
    const targetDay = this.serviceConfig.snapshotDayUTC ?? 1;
    const targetHour = this.serviceConfig.snapshotHourUTC ?? 2;
    const current = this.currentSnapshotDate(now, targetDay, targetHour);
    const missed: string[] = [];
    if (!current) {
      return missed;
    }
    let cursor = new Date(`${watermarkDate}T00:00:00Z`);
    for (;;) {
      cursor = new Date(cursor.getTime() + 7 * DAY_MS);
      const date = cursor.toISOString().split('T')[0];
      if (date > current) {
        break;
      }
      missed.push(date);
    }
    return missed;
  }

  async tick() {
    // filled in by later tasks: watermark lookup, per-chain collection run
  }
}

export const WalletStats = new WalletStatsService();
