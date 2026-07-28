import { ObjectID } from 'mongodb';
import { StorageService } from '../services/storage';
import { BaseModel } from './base';

export interface IWalletStatsActive {
  d14: string;
  d30: string;
  d90: string;
  m6: string;
  m12: string;
}

export interface IWalletStats {
  _id?: ObjectID;
  chain: string;
  network: string;
  date: string; // YYYY-MM-DD UTC snapshot date
  walletCntTotal: string;
  walletCntWithBalance: string;
  walletCntBitcore: string;
  walletCntImported: string;
  totalBalance: string;
  totalBalanceImported: string;
  active: IWalletStatsActive;
  dupWalletCnt: string;
  meta: {
    runId: string;
    startedAt: Date;
    completedAt?: Date;
    erroredWalletCnt: number;
    source: 'interval' | 'backfill';
  };
}

export class WalletStatsModel extends BaseModel<IWalletStats> {
  constructor(storage?: StorageService) {
    super('walletstats', storage);
  }

  allowedPaging = [{ key: 'date' as const, type: 'string' as const }];

  onConnect() {
    this.collection.createIndex({ chain: 1, network: 1, date: 1 }, { unique: true, background: true });
  }

  newSnapshot(params: {
    chain: string;
    network: string;
    date: string;
    source?: 'interval' | 'backfill';
  }): IWalletStats {
    const { chain, network, date, source = 'interval' } = params;
    return {
      chain,
      network,
      date,
      walletCntTotal: '0',
      walletCntWithBalance: '0',
      walletCntBitcore: '0',
      walletCntImported: '0',
      totalBalance: '0',
      totalBalanceImported: '0',
      active: { d14: '0', d30: '0', d90: '0', m6: '0', m12: '0' },
      dupWalletCnt: '0',
      meta: {
        runId: new ObjectID().toHexString(),
        startedAt: new Date(),
        erroredWalletCnt: 0,
        source
      }
    };
  }
}

export const WalletStatsStorage = new WalletStatsModel();
