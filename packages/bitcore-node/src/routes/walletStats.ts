import express from 'express';
import { Request, Response } from 'express';
import { CacheStorage } from '../models/cache';
import { IWalletStats, WalletStatsStorage } from '../models/walletStats';
import { WalletStatsWalletStorage } from '../models/walletStatsWallet';
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

export interface CohortParams {
  chain: string;
  network: string;
  date?: string;
  createdFrom?: string;
  createdTo?: string;
  activeSince?: string;
}

export function parseCohortQuery(query: any) {
  return parseParams<CohortParams>(query, {
    chain: { type: 'chain', required: true },
    network: { type: 'identifier', required: true },
    date: { type: 'date' },
    createdFrom: { type: 'date' },
    createdTo: { type: 'date' },
    activeSince: { type: 'date' }
  });
}

export interface CohortMatch {
  chain: string;
  network: string;
  snapshotDate: string;
  isDup: boolean;
  createdDate?: { $gte?: Date; $lt?: Date };
  lastActivityDate?: { $gte: Date };
}

export function buildCohortMatch(params: Omit<CohortParams, 'date'> & { snapshotDate: string }): CohortMatch {
  const { chain, network, snapshotDate, createdFrom, createdTo, activeSince } = params;
  const match: CohortMatch = { chain, network, snapshotDate, isDup: false };

  if (createdFrom || createdTo) {
    match.createdDate = {};
    if (createdFrom) {
      match.createdDate.$gte = startOfUtcDay(createdFrom);
    }
    if (createdTo) {
      // Inclusive of the whole createdTo day, so bound by the start of the next one.
      match.createdDate.$lt = startOfUtcDay(createdTo, 1);
    }
  }
  if (activeSince) {
    match.lastActivityDate = { $gte: startOfUtcDay(activeSince) };
  }
  return match;
}

function startOfUtcDay(date: string, addDays = 0) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + addDays));
}

/** Newest snapshot the facts collection holds for a chain and network, or null if it has none. */
export async function latestSnapshotDate(chain: string, network: string): Promise<string | null> {
  const [latest] = await WalletStatsWalletStorage.collection
    .find({ chain, network })
    .project({ snapshotDate: 1 })
    .sort({ snapshotDate: -1 })
    .limit(1)
    .toArray();
  return latest?.snapshotDate || null;
}

export async function getCohorts(req: Request, res: Response) {
  setPrivateCache(res);
  const { error, values } = parseCohortQuery(req.query);
  if (error) {
    return res.status(400).json({ error });
  }
  const { chain, network, date, createdFrom, createdTo, activeSince } = values!;

  const snapshotDate = date || (await latestSnapshotDate(chain, network));
  if (!snapshotDate) {
    return res.status(404).json({ error: `No wallet stats for ${chain} ${network}` });
  }

  return respondCached(res, cacheKeyFor('cohorts', { ...values!, date: snapshotDate }), CacheStorage.Times.Hour, async () => {
    const match = buildCohortMatch({ chain, network, snapshotDate, createdFrom, createdTo, activeSince });
    // Facts are one document per wallet per snapshot, so the matched set is bounded by
    // the wallet count and cheap enough to sum here. Summing in JS keeps the balances
    // as exact integers; $sum would have to go through $toDecimal to avoid rounding
    // them, and would then hand back a type that has to be stringified anyway.
    const facts = await WalletStatsWalletStorage.collection
      .find(match)
      .project({ balance: 1 })
      .toArray();

    let totalBalance = BigInt(0);
    for (const fact of facts) {
      totalBalance += fact.balance ? BigInt(fact.balance) : BigInt(0);
    }
    return {
      chain,
      network,
      snapshotDate,
      walletCnt: facts.length,
      totalBalance: totalBalance.toString(),
      filters: pickDefined({ createdFrom, createdTo, activeSince })
    };
  });
}

function pickDefined(values: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

router.use(RateLimiter('WALLETSTATS', 5, 60, 600));
router.use(walletStatsAuth);
router.get('/', getSnapshots);
router.get('/cohorts', getCohorts);

export const walletStatsRoute = {
  router,
  path: '/wallet-stats'
};
