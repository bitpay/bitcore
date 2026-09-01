import { expect } from 'chai';
import { ObjectID } from 'mongodb';
import sinon from 'sinon';
import { CacheStorage } from '../../../src/models/cache';
import { WalletStatsStorage } from '../../../src/models/walletStats';
import { WalletStatsWalletStorage } from '../../../src/models/walletStatsWallet';
import {
  bucketBoundaries,
  buildCohortMatch,
  countIntoBuckets,
  getBuckets,
  getCohorts,
  getSnapshots,
  latestSnapshotDate,
  parseCohortQuery,
  parseSnapshotQuery,
  transformSnapshot,
  walletStatsRoute
} from '../../../src/routes/walletStats';
import { walletStatsAuth } from '../../../src/routes/walletStatsAuth';

function makeRes() {
  const res: any = {
    statusCode: null,
    body: null,
    headers: {},
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: any) {
      res.body = payload;
      return res;
    },
    send(payload: any) {
      res.body = payload;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    }
  };
  return res;
}

describe('WalletStats routes', function() {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  /** Stubs the facts collection: the first query answers the latest-date lookup, the second the facts. */
  function stubFactsCollection(latestDocs: any[] = [], factDocs: any[] = []) {
    const toArray = sandbox.stub();
    toArray.onFirstCall().resolves(latestDocs);
    toArray.onSecondCall().resolves(factDocs);
    const cursor: any = { toArray };
    cursor.sort = sandbox.stub().returns(cursor);
    cursor.limit = sandbox.stub().returns(cursor);
    cursor.project = sandbox.stub().returns(cursor);
    const collection: any = { find: sandbox.stub().returns(cursor) };
    sandbox.stub(WalletStatsWalletStorage, 'collection').get(() => collection);
    return { collection, cursor };
  }

  describe('parseSnapshotQuery', () => {
    it('builds an empty filter with no query params', () => {
      const { error, filter } = parseSnapshotQuery({});
      expect(error).to.equal(undefined);
      expect(filter).to.deep.equal({});
    });

    it('filters on chain and network', () => {
      const { filter } = parseSnapshotQuery({ chain: 'BTC', network: 'mainnet' });
      expect(filter).to.deep.equal({ chain: 'BTC', network: 'mainnet' });
    });

    it('builds an inclusive date range from both bounds', () => {
      const { filter } = parseSnapshotQuery({ from: '2026-07-01', to: '2026-08-01' });
      expect(filter).to.deep.equal({ date: { $gte: '2026-07-01', $lte: '2026-08-01' } });
    });

    it('accepts an open-ended range', () => {
      expect(parseSnapshotQuery({ from: '2026-07-01' }).filter).to.deep.equal({ date: { $gte: '2026-07-01' } });
      expect(parseSnapshotQuery({ to: '2026-07-01' }).filter).to.deep.equal({ date: { $lte: '2026-07-01' } });
    });

    it('rejects a malformed date', () => {
      expect(parseSnapshotQuery({ from: '2026-7-1' }).error).to.exist;
      expect(parseSnapshotQuery({ to: 'yesterday' }).error).to.exist;
      expect(parseSnapshotQuery({ from: '2026-07-01T00:00:00Z' }).error).to.exist;
    });

    it('rejects a range that ends before it starts', () => {
      expect(parseSnapshotQuery({ from: '2026-08-01', to: '2026-07-01' }).error).to.exist;
    });

    it('rejects non-string params so query operators cannot reach mongo', () => {
      expect(parseSnapshotQuery({ chain: { $ne: 'BTC' } }).error).to.exist;
      expect(parseSnapshotQuery({ from: ['2026-07-01', '2026-07-02'] }).error).to.exist;
    });

    it('rejects a chain or network that is not a plain identifier', () => {
      expect(parseSnapshotQuery({ chain: 'BT C' }).error).to.exist;
      expect(parseSnapshotQuery({ network: 'main/net' }).error).to.exist;
    });

    it('uppercases the chain, which is how the collector stores it', () => {
      expect(parseSnapshotQuery({ chain: 'btc' }).filter).to.deep.equal({ chain: 'BTC' });
    });

    it('rejects a date that is not a real day', () => {
      expect(parseSnapshotQuery({ from: '2026-13-45' }).error).to.exist;
    });

    it('defaults the limit and caps it', () => {
      expect(parseSnapshotQuery({}).limit).to.equal(1000);
      expect(parseSnapshotQuery({ limit: '25' }).limit).to.equal(25);
      expect(parseSnapshotQuery({ limit: '5000' }).limit).to.equal(5000);
      expect(parseSnapshotQuery({ limit: '5001' }).error).to.exist;
      expect(parseSnapshotQuery({ limit: '0' }).error).to.exist;
      expect(parseSnapshotQuery({ limit: '-1' }).error).to.exist;
      expect(parseSnapshotQuery({ limit: '10.5' }).error).to.exist;
    });

    it('keys the cache on the limit, so a capped page is not served as a full one', () => {
      expect(parseSnapshotQuery({ limit: '10' }).cacheKey).to.not.equal(parseSnapshotQuery({ limit: '20' }).cacheKey);
    });

    it('gives the same cache key regardless of param order', () => {
      const a = parseSnapshotQuery({ chain: 'BTC', from: '2026-07-01' }).cacheKey;
      const b = parseSnapshotQuery({ from: '2026-07-01', chain: 'BTC' }).cacheKey;
      expect(a).to.equal(b);
    });

    it('gives different cache keys for different filters', () => {
      const a = parseSnapshotQuery({ chain: 'BTC' }).cacheKey;
      const b = parseSnapshotQuery({ chain: 'ETH' }).cacheKey;
      expect(a).to.not.equal(b);
    });
  });

  describe('transformSnapshot', () => {
    const doc: any = {
      _id: new ObjectID(),
      chain: 'BTC',
      network: 'mainnet',
      date: '2026-08-03',
      walletCntTotal: '10',
      walletCntWithBalance: '4',
      walletCntBitcore: '6',
      walletCntImported: '4',
      totalBalance: '100',
      totalBalanceImported: '40',
      active: { d14: '1', d30: '2', d90: '3', m6: '4', m12: '5' },
      dupWalletCnt: '2',
      meta: {
        runId: 'abc123',
        startedAt: new Date('2026-08-03T02:00:00Z'),
        completedAt: new Date('2026-08-03T02:30:00Z'),
        erroredWalletCnt: 1,
        source: 'interval',
        gaps: ['2026-07-27']
      }
    };

    it('drops the mongo id and the internal run id', () => {
      const out: any = transformSnapshot(doc);
      expect(out._id).to.equal(undefined);
      expect(out.meta.runId).to.equal(undefined);
    });

    it('keeps the counts, balances and the meta consumers care about', () => {
      const out: any = transformSnapshot(doc);
      expect(out.chain).to.equal('BTC');
      expect(out.date).to.equal('2026-08-03');
      expect(out.walletCntTotal).to.equal('10');
      expect(out.totalBalance).to.equal('100');
      expect(out.active).to.deep.equal(doc.active);
      expect(out.dupWalletCnt).to.equal('2');
      expect(out.meta).to.deep.equal({
        startedAt: doc.meta.startedAt,
        completedAt: doc.meta.completedAt,
        erroredWalletCnt: 1,
        source: 'interval',
        gaps: ['2026-07-27']
      });
    });

    it('survives a snapshot that is still running', () => {
      const running = { ...doc, meta: { runId: 'x', startedAt: new Date(), erroredWalletCnt: 0, source: 'interval' } };
      const out: any = transformSnapshot(running as any);
      expect(out.meta.completedAt).to.equal(undefined);
      expect(out.meta.gaps).to.equal(undefined);
      expect(out.meta.erroredWalletCnt).to.equal(0);
    });
  });

  describe('GET /', () => {
    let toArray: sinon.SinonStub;
    let find: sinon.SinonStub;
    let sort: sinon.SinonStub;

    let limit: sinon.SinonStub;

    beforeEach(() => {
      toArray = sandbox.stub().resolves([]);
      limit = sandbox.stub().returns({ toArray });
      sort = sandbox.stub().returns({ limit });
      find = sandbox.stub().returns({ sort });
      sandbox.stub(WalletStatsStorage, 'collection').get(() => ({ find }));
      sandbox.stub(CacheStorage, 'getGlobalOrRefresh').callsFake(async (_key, onMiss) => onMiss());
    });

    it('400s on an invalid query without touching the database', async () => {
      const res = makeRes();
      await getSnapshots({ query: { from: 'nope' } } as any, res);
      expect(res.statusCode).to.equal(400);
      expect(res.body.error).to.exist;
      expect(find.called).to.equal(false);
    });

    it('marks even a rejected request private, so the global s-maxage never applies', async () => {
      const res = makeRes();
      await getSnapshots({ query: { from: 'nope' } } as any, res);
      expect(res.statusCode).to.equal(400);
      expect(res.headers['Cache-Control']).to.equal('private, max-age=300');
    });

    it('queries with the built filter, sorted by chain, network and date', async () => {
      const res = makeRes();
      await getSnapshots({ query: { chain: 'BTC' } } as any, res);
      expect(find.calledOnceWith({ chain: 'BTC' })).to.equal(true);
      expect(sort.calledOnceWith({ chain: 1, network: 1, date: 1 })).to.equal(true);
    });

    it('bounds the result set', async () => {
      const res = makeRes();
      await getSnapshots({ query: {} } as any, res);
      expect(limit.calledOnceWith(1000)).to.equal(true);

      limit.resetHistory();
      await getSnapshots({ query: { limit: '25' } } as any, res);
      expect(limit.calledOnceWith(25)).to.equal(true);
    });

    it('returns transformed snapshots', async () => {
      toArray.resolves([
        {
          _id: new ObjectID(),
          chain: 'BTC',
          network: 'mainnet',
          date: '2026-08-03',
          meta: { runId: 'secret', startedAt: new Date(), erroredWalletCnt: 0, source: 'interval' }
        }
      ]);
      const res = makeRes();
      await getSnapshots({ query: {} } as any, res);
      expect(res.body).to.have.lengthOf(1);
      expect(res.body[0]._id).to.equal(undefined);
      expect(res.body[0].meta.runId).to.equal(undefined);
      expect(res.body[0].date).to.equal('2026-08-03');
    });

    it('caches the response under the query cache key', async () => {
      const res = makeRes();
      await getSnapshots({ query: { chain: 'BTC' } } as any, res);
      const [key, , ttl] = (CacheStorage.getGlobalOrRefresh as sinon.SinonStub).firstCall.args;
      expect(key).to.include('walletstats');
      expect(key).to.include(parseSnapshotQuery({ chain: 'BTC' }).cacheKey!);
      expect(ttl).to.equal(CacheStorage.Times.Hour);
    });

    it('marks the response private so shared caches keep out', async () => {
      const res = makeRes();
      await getSnapshots({ query: {} } as any, res);
      expect(res.headers['Cache-Control']).to.equal('private, max-age=300');
    });

    it('500s when the query blows up', async () => {
      toArray.rejects(new Error('db is gone'));
      const res = makeRes();
      await getSnapshots({ query: {} } as any, res);
      expect(res.statusCode).to.equal(500);
    });
  });

  describe('parseCohortQuery', () => {
    it('requires chain and network', () => {
      expect(parseCohortQuery({ network: 'mainnet' }).error).to.include('chain');
      expect(parseCohortQuery({ chain: 'BTC' }).error).to.include('network');
    });

    it('accepts the optional date filters', () => {
      const { error, values } = parseCohortQuery({
        chain: 'btc',
        network: 'mainnet',
        date: '2026-08-03',
        createdFrom: '2026-01-01',
        createdTo: '2026-06-30',
        activeSince: '2026-07-01'
      });
      expect(error).to.equal(undefined);
      expect(values).to.deep.equal({
        chain: 'BTC',
        network: 'mainnet',
        date: '2026-08-03',
        createdFrom: '2026-01-01',
        createdTo: '2026-06-30',
        activeSince: '2026-07-01'
      });
    });

    it('rejects a bad date', () => {
      expect(parseCohortQuery({ chain: 'BTC', network: 'mainnet', activeSince: '2026-02-30' }).error).to.exist;
    });
  });

  describe('buildCohortMatch', () => {
    const base = { chain: 'BTC', network: 'mainnet', snapshotDate: '2026-08-03' };

    it('matches the snapshot and skips duplicates', () => {
      expect(buildCohortMatch(base)).to.deep.equal({
        chain: 'BTC',
        network: 'mainnet',
        snapshotDate: '2026-08-03',
        isDup: false
      });
    });

    it('bounds createdDate in UTC, with createdTo covering its whole day', () => {
      const match: any = buildCohortMatch({ ...base, createdFrom: '2026-01-01', createdTo: '2026-06-30' });
      expect(match.createdDate.$gte.toISOString()).to.equal('2026-01-01T00:00:00.000Z');
      expect(match.createdDate.$lt.toISOString()).to.equal('2026-07-01T00:00:00.000Z');
    });

    it('treats activeSince as from the start of that UTC day', () => {
      const match: any = buildCohortMatch({ ...base, activeSince: '2026-07-01' });
      expect(match.lastActivityDate.$gte.toISOString()).to.equal('2026-07-01T00:00:00.000Z');
    });

    it('leaves out the date clauses that were not asked for', () => {
      const match: any = buildCohortMatch({ ...base, createdFrom: '2026-01-01' });
      expect(match.createdDate.$lt).to.equal(undefined);
      expect(match.lastActivityDate).to.equal(undefined);
    });
  });

  describe('latestSnapshotDate', () => {
    it('returns the newest snapshot date for the chain and network', async () => {
      const { collection, cursor } = stubFactsCollection([{ snapshotDate: '2026-08-03' }]);
      const date = await latestSnapshotDate('BTC', 'mainnet');
      expect(date).to.equal('2026-08-03');
      expect(collection.find.calledOnceWith({ chain: 'BTC', network: 'mainnet' })).to.equal(true);
      expect(cursor.sort.calledOnceWith({ snapshotDate: -1 })).to.equal(true);
      expect(cursor.limit.calledOnceWith(1)).to.equal(true);
    });

    it('returns null when the chain has never been snapshotted', async () => {
      stubFactsCollection([]);
      expect(await latestSnapshotDate('BTC', 'mainnet')).to.equal(null);
    });
  });

  describe('GET /cohorts', () => {
    beforeEach(() => {
      sandbox.stub(CacheStorage, 'getGlobalOrRefresh').callsFake(async (_key, onMiss) => onMiss());
    });

    it('400s on a missing chain', async () => {
      const res = makeRes();
      await getCohorts({ query: { network: 'mainnet' } } as any, res);
      expect(res.statusCode).to.equal(400);
      expect(res.headers['Cache-Control']).to.equal('private, max-age=300');
    });

    it('404s when there is no snapshot for the chain and network', async () => {
      stubFactsCollection([]);
      const res = makeRes();
      await getCohorts({ query: { chain: 'BTC', network: 'mainnet' } } as any, res);
      expect(res.statusCode).to.equal(404);
    });

    it('counts wallets and sums balances at the latest snapshot', async () => {
      const { collection } = stubFactsCollection([{ snapshotDate: '2026-08-03' }], [
        { balance: '100' },
        { balance: '250' }
      ]);
      const res = makeRes();
      await getCohorts({ query: { chain: 'btc', network: 'mainnet' } } as any, res);
      expect(res.body).to.deep.equal({
        chain: 'BTC',
        network: 'mainnet',
        snapshotDate: '2026-08-03',
        walletCnt: 2,
        totalBalance: '350',
        filters: {}
      });
      expect(collection.find.secondCall.args[0]).to.deep.equal({
        chain: 'BTC',
        network: 'mainnet',
        snapshotDate: '2026-08-03',
        isDup: false
      });
    });

    it('sums balances beyond what a double can hold', async () => {
      const big = '9007199254740993'; // Number.MAX_SAFE_INTEGER + 2
      stubFactsCollection([{ snapshotDate: '2026-08-03' }], [{ balance: big }, { balance: big }]);
      const res = makeRes();
      await getCohorts({ query: { chain: 'BTC', network: 'mainnet' } } as any, res);
      expect(res.body.totalBalance).to.equal('18014398509481986');
    });

    it('treats a missing or empty balance as zero', async () => {
      stubFactsCollection([{ snapshotDate: '2026-08-03' }], [{ balance: '5' }, {}, { balance: '' }]);
      const res = makeRes();
      await getCohorts({ query: { chain: 'BTC', network: 'mainnet' } } as any, res);
      expect(res.body.walletCnt).to.equal(3);
      expect(res.body.totalBalance).to.equal('5');
    });

    it('uses the requested date instead of the latest, and echoes the filters', async () => {
      const { collection } = stubFactsCollection([], [{ balance: '1' }]);
      const res = makeRes();
      await getCohorts(
        {
          query: {
            chain: 'BTC',
            network: 'mainnet',
            date: '2026-07-27',
            createdFrom: '2026-01-01',
            activeSince: '2026-07-01'
          }
        } as any,
        res
      );
      expect(res.body.snapshotDate).to.equal('2026-07-27');
      expect(res.body.filters).to.deep.equal({ createdFrom: '2026-01-01', activeSince: '2026-07-01' });
      expect(collection.find.calledOnce).to.equal(true); // no lookup for the latest date
    });
  });

  describe('bucketBoundaries', () => {
    const BTC = 100000000;

    it('converts a usd threshold into base units at the given rate', () => {
      const [bucket] = bucketBoundaries([115000], 115000, BTC);
      expect(bucket.threshold).to.equal(115000);
      expect(bucket.minBaseUnits).to.equal(BigInt(BTC)); // one whole BTC
    });

    it('sorts descending so a wallet lands in its highest bucket', () => {
      const boundaries = bucketBoundaries([10000, 100000, 50000], 100000, BTC);
      expect(boundaries.map(b => b.threshold)).to.deep.equal([100000, 50000, 10000]);
    });

    it('stays exact at eighteen decimal places', () => {
      const ETH = 1000000000000000000;
      const [bucket] = bucketBoundaries([4000], 4000, ETH);
      expect(bucket.minBaseUnits).to.equal(BigInt('1000000000000000000'));
    });

    it('handles a fractional rate without floating point drift', () => {
      const [bucket] = bucketBoundaries([1], 0.5, BTC);
      expect(bucket.minBaseUnits).to.equal(BigInt(2 * BTC)); // 2 BTC at 50 cents each
    });
  });

  describe('countIntoBuckets', () => {
    const BTC = 100000000;
    const boundaries = bucketBoundaries([10000, 50000], 100000, BTC); // 0.5 BTC and 0.1 BTC

    it('counts a wallet exactly on a boundary as inside it', () => {
      expect(countIntoBuckets(['50000000'], boundaries)).to.deep.equal({ '50000': 1, '10000': 0 });
    });

    it('leaves out a wallet one base unit short', () => {
      expect(countIntoBuckets(['49999999'], boundaries)).to.deep.equal({ '50000': 0, '10000': 1 });
    });

    it('counts each wallet in its highest bucket only', () => {
      const counts = countIntoBuckets(['60000000', '20000000', '1000000'], boundaries);
      expect(counts).to.deep.equal({ '50000': 1, '10000': 1 });
    });

    it('ignores wallets below every threshold, and empty balances', () => {
      expect(countIntoBuckets(['1', '', undefined], boundaries)).to.deep.equal({ '50000': 0, '10000': 0 });
    });
  });

  describe('GET /buckets', () => {
    beforeEach(() => {
      sandbox.stub(CacheStorage, 'getGlobalOrRefresh').callsFake(async (_key, onMiss) => onMiss());
    });

    it('400s without thresholds or rate', async () => {
      const res = makeRes();
      await getBuckets({ query: { chain: 'BTC', network: 'mainnet', rate: '115000' } } as any, res);
      expect(res.statusCode).to.equal(400);
      expect(res.body.error).to.include('thresholds');

      const res2 = makeRes();
      await getBuckets({ query: { chain: 'BTC', network: 'mainnet', thresholds: '10000' } } as any, res2);
      expect(res2.statusCode).to.equal(400);
      expect(res2.body.error).to.include('rate');
    });

    it('400s on a non-positive rate', async () => {
      const res = makeRes();
      await getBuckets({ query: { chain: 'BTC', network: 'mainnet', thresholds: '10000', rate: '0' } } as any, res);
      expect(res.statusCode).to.equal(400);
    });

    it('400s for a chain whose units we do not know', async () => {
      const res = makeRes();
      await getBuckets({ query: { chain: 'NOPE', network: 'mainnet', thresholds: '1', rate: '1' } } as any, res);
      expect(res.statusCode).to.equal(400);
      expect(res.body.error).to.include('NOPE');
    });

    it('404s when there is no snapshot to bucket', async () => {
      stubFactsCollection([]);
      const res = makeRes();
      await getBuckets({ query: { chain: 'BTC', network: 'mainnet', thresholds: '1', rate: '1' } } as any, res);
      expect(res.statusCode).to.equal(404);
    });

    it('buckets the wallets at the latest snapshot', async () => {
      const { collection } = stubFactsCollection([{ snapshotDate: '2026-08-03' }], [
        { balance: '200000000' }, // 2 BTC, $200k
        { balance: '50000000' }, // 0.5 BTC, $50k
        { balance: '1000' } // dust
      ]);
      const res = makeRes();
      await getBuckets(
        { query: { chain: 'btc', network: 'mainnet', thresholds: '50000,100000', rate: '100000' } } as any,
        res
      );
      expect(res.body).to.deep.equal({
        chain: 'BTC',
        network: 'mainnet',
        snapshotDate: '2026-08-03',
        rate: 100000,
        buckets: { '100000': 1, '50000': 1 }
      });
      expect(collection.find.secondCall.args[0]).to.deep.equal({
        chain: 'BTC',
        network: 'mainnet',
        snapshotDate: '2026-08-03',
        isDup: false
      });
    });

    it('keys the cache on the rate, so a new rate is not served a stale count', async () => {
      stubFactsCollection([{ snapshotDate: '2026-08-03' }], []);
      const res = makeRes();
      const query = { chain: 'BTC', network: 'mainnet', thresholds: '10000', rate: '100000' };
      await getBuckets({ query } as any, res);
      const firstKey = (CacheStorage.getGlobalOrRefresh as sinon.SinonStub).firstCall.args[0];
      expect(firstKey).to.include('100000');
      expect(firstKey).to.include('buckets');
    });
  });

  describe('router', () => {
    it('mounts at the wallet-stats path', () => {
      expect(walletStatsRoute.path).to.equal('/wallet-stats');
    });

    it('rate limits before it authenticates', () => {
      const handles = (walletStatsRoute.router as any).stack.map(layer => layer.handle);
      const authIndex = handles.indexOf(walletStatsAuth);
      expect(authIndex).to.be.greaterThan(0);
      expect((walletStatsRoute.router as any).stack[authIndex + 1].route.path).to.equal('/');
    });
  });
});
