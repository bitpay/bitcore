import { Utils } from '@bitpay-labs/crypto-wallet-core';
import axios from 'axios';
import { ObjectID } from 'mongodb';
import logger from '../logger';
import { BitcoinBlock, BitcoinBlockStorage } from '../models/block';
import { CoinModel, CoinStorage } from '../models/coin';
import { WalletModel, WalletStorage } from '../models/wallet';
import { WalletAddressModel, WalletAddressStorage } from '../models/walletAddress';
import { IWalletStats, WalletStatsModel, WalletStatsStorage } from '../models/walletStats';
import { IWalletStatsWallet, WalletStatsWalletModel, WalletStatsWalletStorage } from '../models/walletStatsWallet';
import { ChainStateProvider } from '../providers/chain-state';
import { ChainNetwork } from '../types/ChainNetwork';
import { SpentHeightIndicators } from '../types/Coin';
import { wait } from '../utils';
import parseArgv from '../utils/parseArgv';
import '../utils/polyfills';
import { Config } from './config';

type TokenActivityFn = (params: { chain: string; network: string; addresses: string[]; since: Date }) => Promise<Date | null>;

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
  walletAddressModel: WalletAddressModel;
  walletModel: WalletModel;
  cspProvider: typeof ChainStateProvider;
  configService;
  waitFn: (ms: number) => Promise<unknown>;
  nowFn: () => number;
  checkTokenActivity: TokenActivityFn;
  private scheduleWarned = false;
  private unsupportedWarned = new Set<string>();

  constructor({
    walletStatsModel = WalletStatsStorage,
    walletStatsWalletModel = WalletStatsWalletStorage,
    coinModel = CoinStorage,
    blockModel = BitcoinBlockStorage,
    walletAddressModel = WalletAddressStorage,
    walletModel = WalletStorage,
    cspProvider = ChainStateProvider,
    configService = Config,
    waitFn = wait,
    nowFn = Date.now,
    checkTokenActivity
  }: {
    walletStatsModel?: WalletStatsModel;
    walletStatsWalletModel?: WalletStatsWalletModel;
    coinModel?: CoinModel;
    blockModel?: BitcoinBlock;
    walletAddressModel?: WalletAddressModel;
    walletModel?: WalletModel;
    cspProvider?: typeof ChainStateProvider;
    configService?: typeof Config;
    waitFn?: (ms: number) => Promise<unknown>;
    nowFn?: () => number;
    checkTokenActivity?: TokenActivityFn;
  } = {}) {
    this.walletStatsModel = walletStatsModel;
    this.walletStatsWalletModel = walletStatsWalletModel;
    this.coinModel = coinModel;
    this.blockModel = blockModel;
    this.walletAddressModel = walletAddressModel;
    this.walletModel = walletModel;
    this.cspProvider = cspProvider;
    this.configService = configService;
    this.waitFn = waitFn;
    this.nowFn = nowFn;
    this.checkTokenActivity = checkTokenActivity || (params => this.defaultCheckTokenActivity(params));
  }

  // Validated weekly schedule. Out-of-range day/hour fall back to the defaults
  // (Monday 02:00 UTC) with a single warning rather than crashing a running node.
  private getSchedule(): { targetDay: number; targetHour: number } {
    let targetDay = this.serviceConfig.snapshotDayUTC ?? 1;
    let targetHour = this.serviceConfig.snapshotHourUTC ?? 2;
    const dayValid = Number.isInteger(targetDay) && targetDay >= 0 && targetDay <= 6;
    const hourValid = Number.isInteger(targetHour) && targetHour >= 0 && targetHour <= 23;
    if (!dayValid || !hourValid) {
      if (!this.scheduleWarned) {
        logger.warn(
          `Invalid walletStats schedule (snapshotDayUTC=${targetDay}, snapshotHourUTC=${targetHour}); using defaults`
        );
        this.scheduleWarned = true;
      }
      if (!dayValid) {
        targetDay = 1;
      }
      if (!hourValid) {
        targetHour = 2;
      }
    }
    return { targetDay, targetHour };
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
        // The planner won't reach for the partial wallets index unaided; hint it
        // explicitly as CoinModel.getBalanceAtTime does. Valid because our $match
        // carries the index's partialFilterExpression predicate ('wallets.0' exists).
        { allowDiskUse: true, hint: { wallets: 1, spentHeight: 1, value: 1, mintHeight: 1 } }
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

    // Confirmed activity always maxes out at >= sinceHeight; sentinel-only
    // (unconfirmed) wallets max out negative. Resolve heights via a single bounded
    // range scan of the block index rather than a giant height:{$in:[...]} doc,
    // and skip the scan entirely when nothing confirmed needs a date.
    const heightToDate = new Map<number, Date>();
    if (rows.some(row => row.maxHeight >= sinceHeight)) {
      const blocks = await this.blockModel.collection
        .find({ chain, network, height: { $gte: sinceHeight } })
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
    nonces?: Map<string, string>; // EVM only; UTXO callers omit it
  }): { snapshot: IWalletStats; walletFacts: IWalletStatsWallet[] } {
    const { chain, network, date, wallets, balances, activity, dups, nonces } = params;
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
        nonce: nonces?.get(id),
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

  // Retry a provider call through rate-limit (429) responses with exponential
  // backoff (100ms doubling up to 60s). Non-429 errors propagate immediately. A
  // total-elapsed cap (default 10min) bounds how long one stuck call can hold up
  // the tick — on expiry the last error is thrown so the caller counts it and
  // moves on. Stop is honored both before and after each sleep so shutdown waits
  // at most one backoff interval.
  async withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
    let delay = 100;
    const cap = 60 * 1000;
    const maxRetryMs = this.serviceConfig.maxRetryMs ?? 10 * 60 * 1000;
    const start = this.nowFn();
    for (;;) {
      try {
        return await fn();
      } catch (err: any) {
        const message = err?.message || '';
        const is429 = message.includes('Too Many Requests') || err?.status === 429 || err?.statusCode === 429;
        if (!is429 || this.stopping || this.nowFn() - start >= maxRetryMs) {
          throw err;
        }
        await this.waitFn(delay);
        if (this.stopping) {
          throw err;
        }
        delay = Math.min(delay * 2, cap);
      }
    }
  }

  // Derive one EVM wallet's snapshot facts from live provider reads. Balance is
  // summed across the wallet's addresses (hex-requested so large wei values keep
  // full precision) and nonce is the max across them. Activity can't be read
  // directly, so it's inferred: a balance or nonce change since the prior snapshot
  // means activity happened in the interval (dated to asOf); an unchanged wallet
  // carries its prior date forward; and a wallet with no usable date yet but that
  // looks active (or has never been snapshotted) falls back to a token-transfer
  // lookup over the last 12 months.
  async collectEvmWalletFact(params: {
    csp: { getBalanceForAddress: (p: any) => Promise<{ balance: any }>; getAccountNonce: (network: string, address: string) => Promise<number> };
    wallet: { _id: ObjectID; chain: string; network: string };
    addresses: string[];
    prior?: { balance: string; nonce?: string; lastActivityDate?: Date };
    asOf: Date;
    checkTokenActivity: (addresses: string[], since: Date) => Promise<Date | null>;
  }): Promise<{ balance: string; nonce: string; lastActivityDate?: Date }> {
    const { csp, wallet, addresses, prior, asOf, checkTokenActivity } = params;
    const { chain, network } = wallet;

    let balance = 0n;
    let nonce = 0n;
    for (const address of addresses) {
      const result = await this.withRateLimitRetry(() =>
        csp.getBalanceForAddress({ chain, network, address, args: { hex: 'true' } })
      );
      balance += BigInt(result.balance);
      const addressNonce = BigInt(await this.withRateLimitRetry(() => csp.getAccountNonce(network, address)));
      if (addressNonce > nonce) {
        nonce = addressNonce;
      }
    }
    const balanceStr = balance.toString();
    const nonceStr = nonce.toString();

    let lastActivityDate: Date | undefined;
    if (prior) {
      const changed = prior.balance !== balanceStr || (prior.nonce ?? '0') !== nonceStr;
      lastActivityDate = changed ? asOf : prior.lastActivityDate;
    }
    if (!lastActivityDate && (balance > 0n || nonce > 0n || !prior)) {
      const since = new Date(asOf.getTime());
      since.setUTCFullYear(since.getUTCFullYear() - 1);
      lastActivityDate = (await checkTokenActivity(addresses, since)) ?? undefined;
    }

    return { balance: balanceStr, nonce: nonceStr, lastActivityDate };
  }

  // Resolve which of the given wallets are duplicates, returning their id hexes.
  // Duplicate detection runs only ONCE per wallet: a wallet with any prior fact
  // keeps that fact's stored isDup verdict (true or false, both settled) and skips
  // the address scan. Only never-snapshotted wallets get the maintenance scripts'
  // first-address check — if a wallet's earliest address is shared by more than one
  // wallet, the whole cluster is flagged. This method performs NO writes; the verdict
  // is persisted later when buildSnapshot stamps isDup onto the per-wallet facts.
  async detectDups(params: {
    chain: string;
    network: string;
    wallets: Array<{ _id: ObjectID }>;
  }): Promise<Set<string>> {
    const { chain, network, wallets } = params;
    const dups = new Set<string>();
    const walletIds = wallets.map(w => w._id);

    // One round-trip for each wallet's settled verdict. A verdict never flips once
    // set (a wallet stays a duplicate), so $max over the boolean isDup across all of
    // a wallet's facts gives the same answer as picking the latest fact — without a
    // $sort stage, which at production scale becomes a blocking in-memory sort over
    // all historical facts and can trip the 100MB aggregation sort limit.
    const priorFacts = await this.walletStatsWalletModel.collection
      .aggregate<{ _id: ObjectID; isDup: boolean }>([
        { $match: { chain, network, wallet: { $in: walletIds } } },
        { $group: { _id: '$wallet', isDup: { $max: '$isDup' } } }
      ])
      .toArray();
    const settled = new Set<string>();
    for (const fact of priorFacts) {
      const id = fact._id.toHexString();
      settled.add(id);
      if (fact.isDup) {
        dups.add(id);
      }
    }

    for (const wallet of wallets) {
      if (settled.has(wallet._id.toHexString())) {
        continue;
      }
      const firstAddress = await this.walletAddressModel.collection.findOne(
        { chain, network, wallet: wallet._id, address: { $exists: true } },
        { sort: { _id: 1 } }
      );
      if (!firstAddress) {
        continue; // no address => cannot be a shared-first-address duplicate
      }
      const sharers = await this.walletAddressModel.collection
        .find({ chain, network, address: firstAddress.address, wallet: { $exists: true } })
        .toArray();
      const clusterWallets = new Set(sharers.map(s => s.wallet.toHexString()));
      if (clusterWallets.size > 1) {
        for (const id of clusterWallets) {
          dups.add(id); // flag the entire cluster, matching the maintenance scripts
        }
      }
    }
    return dups;
  }

  // Weekly snapshot is due once the configured day+hour has passed and the
  // current week's date exceeds the durable watermark (latest snapshot date in DB).
  snapshotDateIfDue(now: Date, watermarkDate: string | null): string | null {
    const { targetDay, targetHour } = this.getSchedule();
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

  // Scheduled snapshot dates in (watermark, current], most-recent last. Walking
  // BACK from `current` (itself an on-schedule date) in weekly steps keeps every
  // result on the schedule day even when the watermark is off-schedule; walking
  // forward from the watermark would drift by the watermark's day-of-week.
  missedSnapshotDates(now: Date, watermarkDate: string): string[] {
    const { targetDay, targetHour } = this.getSchedule();
    const current = this.currentSnapshotDate(now, targetDay, targetHour);
    const missed: string[] = [];
    if (!current) {
      return missed;
    }
    let cursor = new Date(`${current}T00:00:00Z`);
    for (;;) {
      const date = cursor.toISOString().split('T')[0];
      if (date <= watermarkDate) {
        break;
      }
      missed.unshift(date);
      cursor = new Date(cursor.getTime() - 7 * DAY_MS);
    }
    return missed;
  }

  // One scheduler pass: for each target chain/network, take this week's snapshot
  // if it's due. Re-entrant calls are dropped, per-chain failures are isolated so
  // one bad chain doesn't sink the rest, and the whole body is guarded so neither
  // the interval nor the --EXIT path ever surfaces an unhandled rejection.
  async tick() {
    if (this.running) {
      return; // a prior tick is still in flight
    }
    this.running = true;
    try {
      const now = new Date(this.nowFn());
      for (const chainNetwork of this.targetChainNetworks()) {
        if (this.stopping) {
          break;
        }
        try {
          await this.runChainNetwork({ ...chainNetwork, now });
        } catch (err: any) {
          logger.error(`Wallet Stats error for ${chainNetwork.chain}:${chainNetwork.network}: ${err.stack || err.message || err}`);
        }
      }
    } catch (err: any) {
      logger.error(`Wallet Stats tick error: ${err.stack || err.message || err}`);
    } finally {
      this.running = false;
    }
  }

  private targetChainNetworks(): ChainNetwork[] {
    const all = this.configService.chainNetworks();
    if (args.CHAIN) {
      return all.filter(cn => cn.chain === args.CHAIN && (!args.NETWORK || cn.network === args.NETWORK));
    }
    return all;
  }

  // Latest snapshot date for a chain/network — the durable watermark that gates
  // whether this week's snapshot is due.
  async latestSnapshotDate(params: { chain: string; network: string }): Promise<string | null> {
    const { chain, network } = params;
    const [latest] = await this.walletStatsModel.collection
      .find({ chain, network })
      .project({ date: 1 })
      .sort({ date: -1 })
      .limit(1)
      .toArray();
    return latest ? latest.date : null;
  }

  async runChainNetwork(params: { chain: string; network: string; now: Date }) {
    const { chain, network, now } = params;
    // Only UTXO and EVM chains have a collection path. Skip anything else (XRP, SOL)
    // BEFORE touching the DB so an unsupported chain never persists a junk zeroed
    // snapshot and silently advances its watermark. Warn once per chain, not per tick.
    if (!Utils.isUtxoChain(chain) && !Utils.isEvmChain(chain)) {
      if (!this.unsupportedWarned.has(chain)) {
        logger.warn(`Wallet Stats: skipping unsupported chain ${chain}:${network} (not UTXO or EVM)`);
        this.unsupportedWarned.add(chain);
      }
      return;
    }
    const watermark = await this.latestSnapshotDate({ chain, network });
    const date = this.snapshotDateIfDue(now, watermark);
    if (!date) {
      return; // this week's snapshot already exists (or the schedule time hasn't passed)
    }
    const asOf = new Date(`${date}T00:00:00Z`);
    const gaps = watermark ? this.missedSnapshotDates(now, watermark).filter(d => d !== date) : [];

    // toArray over all wallets for the chain is acceptable at current scale (prior
    // reviews accepted this); revisit with a cursor if wallet counts grow large.
    const wallets = (await this.walletModel.collection.find({ chain, network }).toArray()) as Array<{ _id: ObjectID }>;

    const collected = Utils.isUtxoChain(chain)
      ? await this.collectUtxo({ chain, network, date, asOf, wallets })
      : await this.collectEvm({ chain, network, date, asOf, wallets, watermark });

    if (!collected) {
      return; // a stop was requested mid-collection; skip the snapshot for this partial run
    }
    const { snapshot, walletFacts } = collected;
    snapshot.meta.gaps = gaps;
    snapshot.meta.completedAt = new Date(this.nowFn());
    await this.persist({ chain, network, snapshot, walletFacts });
  }

  private async collectUtxo(params: {
    chain: string;
    network: string;
    date: string;
    asOf: Date;
    wallets: Array<{ _id: ObjectID }>;
  }): Promise<{ snapshot: IWalletStats; walletFacts: IWalletStatsWallet[] }> {
    const { chain, network, date, asOf, wallets } = params;
    const since = new Date(asOf.getTime());
    since.setUTCFullYear(since.getUTCFullYear() - 1);
    const balances = await this.collectUtxoBalances({ chain, network });
    const activity = await this.collectUtxoActivity({ chain, network, since });
    const dups = await this.detectDups({ chain, network, wallets });
    return this.buildSnapshot({ chain, network, date, wallets, balances, activity, dups });
  }

  private async collectEvm(params: {
    chain: string;
    network: string;
    date: string;
    asOf: Date;
    wallets: Array<{ _id: ObjectID }>;
    watermark: string | null;
  }): Promise<{ snapshot: IWalletStats; walletFacts: IWalletStatsWallet[] } | null> {
    const { chain, network, date, asOf, wallets, watermark } = params;
    const csp: any = this.cspProvider.get({ chain, network });

    // Prior facts read by snapshotDate EQUALITY on the unique
    // {chain,network,snapshotDate,wallet} index — the last run's facts sit exactly
    // at the watermark date, so no latest-per-wallet sort (the 100MB trap) is needed.
    // Trade-off: a wallet that errored last run has no fact at the watermark, so its
    // native-activity carry-forward is lost and it re-derives from scratch this run.
    const priorByWallet = new Map<string, { balance: string; nonce?: string; lastActivityDate?: Date }>();
    if (watermark) {
      const priorFacts = await this.walletStatsWalletModel.collection
        .find({ chain, network, snapshotDate: watermark })
        .toArray();
      for (const fact of priorFacts) {
        priorByWallet.set(fact.wallet.toHexString(), {
          balance: fact.balance,
          nonce: fact.nonce,
          lastActivityDate: fact.lastActivityDate
        });
      }
    }
    const dups = await this.detectDups({ chain, network, wallets });

    const balances = new Map<string, bigint>();
    const activity = new Map<string, Date>();
    const nonces = new Map<string, string>();
    const collectedWallets: Array<{ _id: ObjectID }> = [];
    let erroredWalletCnt = 0;
    const sleepMs = this.serviceConfig.sleepMs ?? 50;
    const every = this.serviceConfig.every ?? 10;
    let processed = 0;

    for (const wallet of wallets) {
      if (this.stopping) {
        // Abort before writing anything for this chain; a later tick redoes it. Facts
        // and snapshot are both idempotent upserts, so even a crash between those two
        // write steps leaves only orphan facts that the next complete run overwrites.
        return null;
      }
      const id = wallet._id.toHexString();
      try {
        const addresses = (
          await this.walletAddressModel.collection.find({ chain, network, wallet: wallet._id }).project({ address: 1 }).toArray()
        ).map(a => a.address);
        const fact = await this.collectEvmWalletFact({
          csp,
          wallet: { _id: wallet._id, chain, network },
          addresses,
          prior: priorByWallet.get(id),
          asOf,
          checkTokenActivity: (addrs, since) => this.checkTokenActivity({ chain, network, addresses: addrs, since })
        });
        balances.set(id, BigInt(fact.balance));
        nonces.set(id, fact.nonce);
        if (fact.lastActivityDate) {
          activity.set(id, fact.lastActivityDate);
        }
        collectedWallets.push(wallet); // only successful wallets get a fact this run
      } catch (err: any) {
        erroredWalletCnt++;
        logger.error(`Wallet Stats: failed ${chain}:${network} wallet ${id}: ${err.message || err}`);
      }
      processed++;
      if (every > 0 && processed % every === 0) {
        await this.waitFn(sleepMs);
      }
    }

    const { snapshot, walletFacts } = this.buildSnapshot({ chain, network, date, wallets: collectedWallets, balances, activity, dups, nonces });
    snapshot.meta.erroredWalletCnt = erroredWalletCnt;
    return { snapshot, walletFacts };
  }

  async persist(params: { chain: string; network: string; snapshot: IWalletStats; walletFacts: IWalletStatsWallet[] }) {
    const { chain, network, snapshot, walletFacts } = params;
    if (walletFacts.length) {
      await this.walletStatsWalletModel.collection.bulkWrite(
        walletFacts.map(fact => ({
          updateOne: {
            filter: { chain, network, snapshotDate: fact.snapshotDate, wallet: fact.wallet },
            update: { $set: fact },
            upsert: true
          }
        })),
        { ordered: false }
      );
    }
    // Snapshot upserted last and keyed on its unique {chain,network,date}, so a
    // re-run overwrites cleanly rather than duplicating.
    await this.walletStatsModel.collection.updateOne(
      { chain, network, date: snapshot.date },
      { $set: snapshot },
      { upsert: true }
    );
  }

  // Default token-activity probe: a limit-1 ERC-20 transfers existence check per
  // address since `since`, hitting Moralis directly through axios on tracked
  // surfaces only (formatMoralisChainId from the adapters util; apiKey from config).
  // No apiKey configured => null without a request. Any failure degrades to null so
  // the tick is never broken, and the whole thing is swappable via the constructor.
  // TODO: migrate onto MoralisClient once the external client extraction lands.
  async defaultCheckTokenActivity(params: { chain: string; network: string; addresses: string[]; since: Date }): Promise<Date | null> {
    const { chain, network, addresses, since } = params;
    const apiKey = this.configService.get()?.externalProviders?.moralis?.apiKey;
    if (!apiKey) {
      return null;
    }
    try {
      const csp: any = this.cspProvider.get({ chain, network });
      const chainId = await csp.getChainId({ network });
      const { formatMoralisChainId } = await import('../providers/chain-state/external/adapters/moralis-utils');
      const moralisChain = formatMoralisChainId(chainId);
      for (const address of addresses) {
        const { data } = await axios.get<{ result?: Array<{ block_timestamp?: string }> }>(
          `https://deep-index.moralis.io/api/v2.2/${address}/erc20/transfers`,
          {
            params: { chain: moralisChain, from_date: since.toISOString(), order: 'DESC', limit: 1 },
            headers: { 'X-API-Key': apiKey },
            timeout: 30000
          }
        );
        const first = data?.result?.[0];
        if (first?.block_timestamp) {
          return new Date(first.block_timestamp);
        }
      }
    } catch (err: any) {
      logger.warn(`Wallet Stats: token activity probe failed for ${chain}:${network}: ${err.message || err}`);
    }
    return null;
  }
}

export const WalletStats = new WalletStatsService();
