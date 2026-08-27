import { expect } from 'chai';
import { ObjectID } from 'mongodb';
import sinon from 'sinon';
import { CacheStorage } from '../../../src/models/cache';
import { WalletStatsStorage } from '../../../src/models/walletStats';
import { getSnapshots, parseSnapshotQuery, transformSnapshot, walletStatsRoute } from '../../../src/routes/walletStats';
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

    beforeEach(() => {
      toArray = sandbox.stub().resolves([]);
      sort = sandbox.stub().returns({ toArray });
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
