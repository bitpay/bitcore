import logger from '../logger';
import { WalletStatsModel, WalletStatsStorage } from '../models/walletStats';
import { WalletStatsWalletModel, WalletStatsWalletStorage } from '../models/walletStatsWallet';
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
  configService;

  constructor({
    walletStatsModel = WalletStatsStorage,
    walletStatsWalletModel = WalletStatsWalletStorage,
    configService = Config
  } = {}) {
    this.walletStatsModel = walletStatsModel;
    this.walletStatsWalletModel = walletStatsWalletModel;
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
