import { ObjectID } from 'mongodb';
import { StorageService } from '../services/storage';
import { BaseModel } from './base';

export type ActivityWindow = 'd14' | 'd30' | 'd90' | 'm6' | 'm12';

export interface IWalletStatsWallet {
  _id?: ObjectID;
  wallet: ObjectID; // wallets._id
  chain: string;
  network: string;
  snapshotDate: string; // YYYY-MM-DD, matches walletstats.date
  createdDate: Date; // from wallet _id timestamp
  balance: string; // native units, BigInt-as-string
  nonce?: string; // EVM only
  lastActivityDate?: Date; // best-known most recent activity
  isDup: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class WalletStatsWalletModel extends BaseModel<IWalletStatsWallet> {
  constructor(storage?: StorageService) {
    super('walletstatswallets', storage);
  }

  allowedPaging = [];

  onConnect() {
    this.collection.createIndex(
      { chain: 1, network: 1, snapshotDate: 1, wallet: 1 },
      { unique: true, background: true }
    );
    this.collection.createIndex({ chain: 1, network: 1, wallet: 1, snapshotDate: -1 }, { background: true });
  }

  activityWindow(lastActivityDate: Date | null | undefined, asOf: Date): ActivityWindow | null {
    if (!lastActivityDate) {
      return null;
    }
    // A lastActivityDate after asOf (clock skew or a bad provider timestamp) would
    // yield a negative age; clamp to 0 so it counts as just-active rather than skipping.
    const ageDays = Math.max(0, (asOf.getTime() - lastActivityDate.getTime()) / DAY_MS);
    if (ageDays <= 14) return 'd14';
    if (ageDays <= 30) return 'd30';
    if (ageDays <= 90) return 'd90';
    if (ageDays <= 183) return 'm6';
    if (ageDays <= 365) return 'm12';
    return null;
  }
}

export const WalletStatsWalletStorage = new WalletStatsWalletModel();
