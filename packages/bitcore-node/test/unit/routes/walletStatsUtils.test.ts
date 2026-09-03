import { expect } from 'chai';
import sinon from 'sinon';
import { CacheStorage } from '../../../src/models/cache';
import { cacheKeyFor, parseParams, respondCached, setPrivateCache } from '../../../src/routes/walletStatsUtils';

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

describe('WalletStats API utils', function() {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  describe('parseParams', () => {
    it('returns only the params that were supplied', () => {
      const { error, values } = parseParams({ chain: 'BTC' }, { chain: { type: 'identifier' }, network: { type: 'identifier' } });
      expect(error).to.equal(undefined);
      expect(values).to.deep.equal({ chain: 'BTC' });
    });

    it('ignores query params that are not in the spec', () => {
      const { values } = parseParams({ chain: 'BTC', bogus: 'x' }, { chain: { type: 'identifier' } });
      expect(values).to.deep.equal({ chain: 'BTC' });
    });

    it('errors on a missing required param', () => {
      const { error } = parseParams({}, { chain: { type: 'identifier', required: true } });
      expect(error).to.equal('Missing required param chain');
    });

    it('applies a default for an absent param', () => {
      const { values } = parseParams({}, { limit: { type: 'int', default: 1000 } });
      expect(values).to.deep.equal({ limit: 1000 });
    });

    it('rejects a non-string param so query operators cannot reach mongo', () => {
      expect(parseParams({ chain: { $ne: 'BTC' } }, { chain: { type: 'identifier' } }).error).to.exist;
      expect(parseParams({ chain: ['BTC', 'ETH'] }, { chain: { type: 'identifier' } }).error).to.exist;
    });

    it('validates identifiers', () => {
      expect(parseParams({ chain: 'BT C' }, { chain: { type: 'identifier' } }).error).to.exist;
      expect(parseParams({ chain: '' }, { chain: { type: 'identifier' } }).error).to.exist;
      expect(parseParams({ chain: 'x'.repeat(21) }, { chain: { type: 'identifier' } }).error).to.exist;
    });

    it('validates dates', () => {
      expect(parseParams({ d: '2026-08-03' }, { d: { type: 'date' } }).values).to.deep.equal({ d: '2026-08-03' });
      expect(parseParams({ d: '2026-8-3' }, { d: { type: 'date' } }).error).to.exist;
      expect(parseParams({ d: '2026-08-03T00:00:00Z' }, { d: { type: 'date' } }).error).to.exist;
    });

    it('rejects a date that is well formed but not a real day', () => {
      expect(parseParams({ d: '2026-13-45' }, { d: { type: 'date' } }).error).to.exist;
      expect(parseParams({ d: '2026-02-30' }, { d: { type: 'date' } }).error).to.exist;
      expect(parseParams({ d: '2026-00-10' }, { d: { type: 'date' } }).error).to.exist;
      expect(parseParams({ d: '2026-01-00' }, { d: { type: 'date' } }).error).to.exist;
    });

    it('accepts a leap day in UTC regardless of the local timezone', () => {
      expect(parseParams({ d: '2024-02-29' }, { d: { type: 'date' } }).values).to.deep.equal({ d: '2024-02-29' });
      expect(parseParams({ d: '2026-02-29' }, { d: { type: 'date' } }).error).to.exist;
    });

    it('uppercases a chain so callers can send btc or BTC', () => {
      expect(parseParams({ chain: 'btc' }, { chain: { type: 'chain' } }).values).to.deep.equal({ chain: 'BTC' });
      expect(parseParams({ chain: 'BTC' }, { chain: { type: 'chain' } }).values).to.deep.equal({ chain: 'BTC' });
      expect(parseParams({ chain: 'b tc' }, { chain: { type: 'chain' } }).error).to.exist;
    });

    it('validates ints against their bounds', () => {
      expect(parseParams({ n: '50' }, { n: { type: 'int', max: 100 } }).values).to.deep.equal({ n: 50 });
      expect(parseParams({ n: '0' }, { n: { type: 'int', max: 100 } }).error).to.exist;
      expect(parseParams({ n: '-5' }, { n: { type: 'int', max: 100 } }).error).to.exist;
      expect(parseParams({ n: '1.5' }, { n: { type: 'int', max: 100 } }).error).to.exist;
      expect(parseParams({ n: '101' }, { n: { type: 'int', max: 100 } }).error).to.exist;
      expect(parseParams({ n: 'abc' }, { n: { type: 'int' } }).error).to.exist;
    });

    it('validates positive numbers', () => {
      expect(parseParams({ rate: '115000.5' }, { rate: { type: 'number' } }).values).to.deep.equal({ rate: 115000.5 });
      expect(parseParams({ rate: '0' }, { rate: { type: 'number' } }).error).to.exist;
      expect(parseParams({ rate: '-1' }, { rate: { type: 'number' } }).error).to.exist;
      expect(parseParams({ rate: 'NaN' }, { rate: { type: 'number' } }).error).to.exist;
      expect(parseParams({ rate: 'Infinity' }, { rate: { type: 'number' } }).error).to.exist;
    });

    it('parses a comma separated number list', () => {
      expect(parseParams({ t: '10000,50000' }, { t: { type: 'numberList' } }).values).to.deep.equal({
        t: [10000, 50000]
      });
      expect(parseParams({ t: '' }, { t: { type: 'numberList' } }).error).to.exist;
      expect(parseParams({ t: '10000,abc' }, { t: { type: 'numberList' } }).error).to.exist;
      expect(parseParams({ t: '10000,-1' }, { t: { type: 'numberList' } }).error).to.exist;
    });

    it('names the offending param in the error', () => {
      const { error } = parseParams({ network: 'main net' }, { network: { type: 'identifier' } });
      expect(error).to.include('network');
    });
  });

  describe('cacheKeyFor', () => {
    it('is stable regardless of key order', () => {
      const a = cacheKeyFor('snapshots', { chain: 'BTC', from: '2026-07-01' });
      const b = cacheKeyFor('snapshots', { from: '2026-07-01', chain: 'BTC' });
      expect(a).to.equal(b);
    });

    it('namespaces by endpoint', () => {
      expect(cacheKeyFor('snapshots', { chain: 'BTC' })).to.not.equal(cacheKeyFor('cohorts', { chain: 'BTC' }));
      expect(cacheKeyFor('snapshots', {})).to.include('walletstats');
    });

    it('distinguishes different values', () => {
      expect(cacheKeyFor('snapshots', { chain: 'BTC' })).to.not.equal(cacheKeyFor('snapshots', { chain: 'ETH' }));
      expect(cacheKeyFor('snapshots', { limit: 10 })).to.not.equal(cacheKeyFor('snapshots', { limit: 20 }));
    });
  });

  describe('setPrivateCache', () => {
    it('keeps the response out of shared caches', () => {
      const res = makeRes();
      setPrivateCache(res);
      expect(res.headers['Cache-Control']).to.equal('private, max-age=300');
    });
  });

  describe('respondCached', () => {
    it('serves the cached value and never calls the miss handler twice', async () => {
      sandbox.stub(CacheStorage, 'getGlobalOrRefresh').resolves([{ cached: true }]);
      const onMiss = sandbox.stub().resolves([]);
      const res = makeRes();
      await respondCached(res, 'k', CacheStorage.Times.Hour, onMiss);
      expect(res.body).to.deep.equal([{ cached: true }]);
      expect(onMiss.called).to.equal(false);
    });

    it('passes the key and ttl through to the cache', async () => {
      const cache = sandbox.stub(CacheStorage, 'getGlobalOrRefresh').callsFake(async (_k, onMiss) => onMiss());
      const res = makeRes();
      await respondCached(res, 'my-key', 1234, async () => ({ ok: true }));
      expect(cache.firstCall.args[0]).to.equal('my-key');
      expect(cache.firstCall.args[2]).to.equal(1234);
      expect(res.body).to.deep.equal({ ok: true });
    });

    it('500s as json when the miss handler throws', async () => {
      sandbox.stub(CacheStorage, 'getGlobalOrRefresh').callsFake(async (_k, onMiss) => onMiss());
      const res = makeRes();
      await respondCached(res, 'k', 1, async () => {
        throw new Error('db is gone');
      });
      expect(res.statusCode).to.equal(500);
      expect(res.body).to.deep.equal({ error: 'Error getting wallet stats' });
    });
  });
});
