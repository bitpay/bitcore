import express from 'express';
import { Request, Response } from 'express';
import logger from '../logger';
import { CacheStorage } from '../models/cache';
import { IWalletStats, WalletStatsStorage } from '../models/walletStats';
import { RateLimiter } from './middleware';
import { walletStatsAuth } from './walletStatsAuth';

const router = express.Router({ mergeParams: true });

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const IDENTIFIER = /^[A-Za-z0-9_-]{1,20}$/;
const BROWSER_CACHE_SECONDS = 300;

export interface SnapshotQuery {
  filter?: any;
  cacheKey?: string;
  error?: string;
}

/**
 * Validates the snapshot query params and turns them into a mongo filter.
 * Everything is checked for being a plain string first: express hands back
 * arrays and objects for repeated or bracketed params, and those would
 * otherwise reach mongo as query operators.
 */
export function parseSnapshotQuery(query: any): SnapshotQuery {
  const { chain, network, from, to } = query || {};
  const filter: any = {};

  for (const [name, value] of Object.entries({ chain, network })) {
    if (value === undefined) {
      continue;
    }
    if (typeof value !== 'string' || !IDENTIFIER.test(value)) {
      return { error: `Invalid ${name}` };
    }
    filter[name] = value;
  }

  for (const [name, value] of Object.entries({ from, to })) {
    if (value === undefined) {
      continue;
    }
    if (typeof value !== 'string' || !DATE.test(value)) {
      return { error: `Invalid ${name} date, expected YYYY-MM-DD` };
    }
    filter.date = filter.date || {};
    filter.date[name === 'from' ? '$gte' : '$lte'] = value;
  }
  if (filter.date?.$gte && filter.date?.$lte && filter.date.$gte > filter.date.$lte) {
    return { error: 'Invalid date range, from is after to' };
  }

  const cacheKey = [filter.chain || '', filter.network || '', filter.date?.$gte || '', filter.date?.$lte || ''].join(
    '|'
  );
  return { filter, cacheKey };
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
  const { error, filter, cacheKey } = parseSnapshotQuery(req.query);
  if (error) {
    return res.status(400).json({ error });
  }
  try {
    const snapshots = await CacheStorage.getGlobalOrRefresh(
      `walletstats-snapshots-${cacheKey}`,
      async () => {
        const found = await WalletStatsStorage.collection
          .find(filter)
          .sort({ chain: 1, network: 1, date: 1 })
          .toArray();
        return found.map(transformSnapshot);
      },
      CacheStorage.Times.Hour
    );
    // These responses are authenticated, so they must not land in a shared cache.
    res.setHeader('Cache-Control', `private, max-age=${BROWSER_CACHE_SECONDS}`);
    return res.json(snapshots);
  } catch (err: any) {
    logger.error('Error getting wallet stats snapshots: %o', err.stack || err.message || err);
    return res.status(500).send('Error getting wallet stats snapshots');
  }
}

router.use(RateLimiter('WALLETSTATS', 5, 60, 600));
router.use(walletStatsAuth);
router.get('/', getSnapshots);

export const walletStatsRoute = {
  router,
  path: '/wallet-stats'
};
