import express from 'express';
import { Request, Response } from 'express';
import { CacheStorage } from '../models/cache';
import { IWalletStats, WalletStatsStorage } from '../models/walletStats';
import { RateLimiter } from './middleware';
import { walletStatsAuth } from './walletStatsAuth';
import { cacheKeyFor, parseParams, respondCached, setPrivateCache } from './walletStatsUtils';

const router = express.Router({ mergeParams: true });

export interface DateRange {
  $gte?: string;
  $lte?: string;
}

export interface SnapshotFilter {
  chain?: string;
  network?: string;
  date?: DateRange;
}

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;

export interface SnapshotQuery {
  filter?: SnapshotFilter;
  limit?: number;
  cacheKey?: string;
  error?: string;
}

/** Validates the snapshot query params and turns them into a mongo filter. */
export function parseSnapshotQuery(query: any): SnapshotQuery {
  const { error, values } = parseParams<{
    chain?: string;
    network?: string;
    from?: string;
    to?: string;
    limit: number;
  }>(query, {
    chain: { type: 'chain' },
    network: { type: 'identifier' },
    from: { type: 'date' },
    to: { type: 'date' },
    limit: { type: 'int', default: DEFAULT_LIMIT, max: MAX_LIMIT }
  });
  if (error) {
    return { error };
  }
  const { chain, network, from, to, limit } = values!;
  if (from && to && from > to) {
    return { error: 'Invalid date range, from is after to' };
  }

  const filter: SnapshotFilter = {};
  if (chain) {
    filter.chain = chain;
  }
  if (network) {
    filter.network = network;
  }
  if (from || to) {
    filter.date = {};
    if (from) {
      filter.date.$gte = from;
    }
    if (to) {
      filter.date.$lte = to;
    }
  }
  return { filter, limit, cacheKey: cacheKeyFor('snapshots', values!) };
}

export function transformSnapshot(snapshot: IWalletStats) {
  const { meta } = snapshot;
  return {
    chain: snapshot.chain,
    network: snapshot.network,
    date: snapshot.date,
    walletCntTotal: snapshot.walletCntTotal,
    walletCntWithBalance: snapshot.walletCntWithBalance,
    walletCntBitcore: snapshot.walletCntBitcore,
    walletCntImported: snapshot.walletCntImported,
    totalBalance: snapshot.totalBalance,
    totalBalanceImported: snapshot.totalBalanceImported,
    active: snapshot.active,
    dupWalletCnt: snapshot.dupWalletCnt,
    meta: {
      startedAt: meta.startedAt,
      completedAt: meta.completedAt,
      erroredWalletCnt: meta.erroredWalletCnt,
      source: meta.source,
      gaps: meta.gaps
    }
  };
}

export async function getSnapshots(req: Request, res: Response) {
  setPrivateCache(res);
  const { error, filter, limit, cacheKey } = parseSnapshotQuery(req.query);
  if (error) {
    return res.status(400).json({ error });
  }
  return respondCached(res, cacheKey!, CacheStorage.Times.Hour, async () => {
    const found = await WalletStatsStorage.collection
      .find(filter!)
      .sort({ chain: 1, network: 1, date: 1 })
      .limit(limit!)
      .toArray();
    return found.map(transformSnapshot);
  });
}

router.use(RateLimiter('WALLETSTATS', 5, 60, 600));
router.use(walletStatsAuth);
router.get('/', getSnapshots);

export const walletStatsRoute = {
  router,
  path: '/wallet-stats'
};
