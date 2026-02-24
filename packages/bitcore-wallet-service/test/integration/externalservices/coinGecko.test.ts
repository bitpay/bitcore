'use strict';

import * as chai from 'chai';
import sinon from 'sinon';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';
import logger from '../../../src/lib/logger';

const should = chai.should();

function toURL(url: string): URL {
  try {
    return new URL(url);
  } catch {
    // Fallback for any accidental relative URLs in tests.
    return new URL(url, 'https://example.com');
  }
}

function parseRequestedIdsFromMarketsUrl(url: string): string[] {
  const u = toURL(url);
  const ids = u.searchParams.get('ids');
  return ids ? ids.split(',').filter(Boolean) : [];
}

function matchCoinIdFromMarketChartUrl(url: string): string | undefined {
  const u = toURL(url);
  const parts = u.pathname.split('/').filter(Boolean);
  const coinsIdx = parts.indexOf('coins');
  if (coinsIdx === -1) return undefined;
  const id = parts[coinsIdx + 1];
  const next = parts[coinsIdx + 2];
  if (id && next === 'market_chart') return decodeURIComponent(id);
  return undefined;
}

function matchCoinIdFromInfoUrl(url: string): string | undefined {
  const u = toURL(url);
  const parts = u.pathname.split('/').filter(Boolean);
  const coinsIdx = parts.indexOf('coins');
  if (coinsIdx === -1) return undefined;

  const id = parts[coinsIdx + 1];
  if (!id) return undefined;

  // Exclude non-info endpoints.
  if (id === 'list' || id === 'markets') return undefined;

  const tail = parts.slice(coinsIdx + 2);
  if (tail.length === 0) return decodeURIComponent(id);

  return undefined;
}

function matchCoinContract(url: string): { platformId: string; address: string } | undefined {
  const u = toURL(url);
  const parts = u.pathname.split('/').filter(Boolean);
  const coinsIdx = parts.indexOf('coins');
  if (coinsIdx === -1) return undefined;

  const platformId = parts[coinsIdx + 1];
  const next = parts[coinsIdx + 2];
  const address = parts[coinsIdx + 3];

  if (platformId && next === 'contract' && address) {
    return { platformId: decodeURIComponent(platformId), address: decodeURIComponent(address) };
  }

  return undefined;
}

function matchTokenListPlatformId(url: string): string | undefined {
  const u = toURL(url);
  const parts = u.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('token_lists');
  if (idx === -1) return undefined;

  const platformId = parts[idx + 1];
  const file = parts[idx + 2];
  if (platformId && file === 'all.json') return decodeURIComponent(platformId);

  return undefined;
}

function matchSearchQuery(url: string): string | undefined {
  const u = toURL(url);
  if (!u.pathname.endsWith('/v3/search')) return undefined;
  return u.searchParams.get('query') || undefined;
}

function createCoinGeckoRequestStub(handlers: {
  onSearch?: (query: string) => unknown;
  onCoinList?: () => unknown;
  onMarkets?: (ids: string[]) => unknown;
  onMarketChart?: (id: string) => unknown;
  onCoinInfo?: (id: string) => unknown;
  onCoinContract?: (platformId: string, address: string) => unknown;
  onTokenList?: (platformId: string) => unknown;
}): { get: (url: string, opts: any, cb: (err?: any, data?: any) => void) => void } {
  return {
    get: (url, _opts, cb) => {
      try {
        const u = toURL(url);
        const pathname = u.pathname;

        if (pathname.endsWith('/v3/search')) {
          const q = matchSearchQuery(url) || '';
          return cb(null, { body: handlers.onSearch ? handlers.onSearch(q) : { coins: [] } });
        }

        if (pathname.endsWith('/v3/coins/list')) {
          return cb(null, { body: handlers.onCoinList ? handlers.onCoinList() : [] });
        }

        if (pathname.endsWith('/v3/coins/markets')) {
          const ids = parseRequestedIdsFromMarketsUrl(url);
          return cb(null, { body: handlers.onMarkets ? handlers.onMarkets(ids) : [] });
        }

        const contract = matchCoinContract(url);
        if (contract) {
          return cb(null, {
            body: handlers.onCoinContract ? handlers.onCoinContract(contract.platformId, contract.address) : {}
          });
        }

        const marketChartId = matchCoinIdFromMarketChartUrl(url);
        if (marketChartId) {
          return cb(null, { body: handlers.onMarketChart ? handlers.onMarketChart(marketChartId) : { prices: [] } });
        }

        const coinInfoId = matchCoinIdFromInfoUrl(url);
        if (coinInfoId) {
          return cb(null, { body: handlers.onCoinInfo ? handlers.onCoinInfo(coinInfoId) : {} });
        }

        const tokenListPlatformId = matchTokenListPlatformId(url);
        if (tokenListPlatformId) {
          return cb(null, { body: handlers.onTokenList ? handlers.onTokenList(tokenListPlatformId) : { tokens: [] } });
        }

        return cb(new Error('unexpected url'));
      } catch (e: any) {
        return cb(e);
      }
    }
  };
}

describe('CoinGecko integration', function() {
  this.timeout(5000);
  const sandbox = sinon.createSandbox();
  let server;
  let wallet;
  let fakeRequest;

  const cg = () => server.externalServices.coinGecko;
  const getMarketStats = (query: any, code = 'USD') => cg().coinGeckoGetMarketStats({ params: { code }, query });
  const getFiatRates = (query: any, code = 'USD') => cg().coinGeckoGetFiatRates({ params: { code }, query });
  const getTokens = (req: any = {}) => cg().coinGeckoGetTokens(req);

  function forceGlobalCacheMisses() {
    sandbox.stub(cg().storage, 'checkAndUseGlobalCache').callsFake((_key, _duration, cb) => cb(null, null, null));
    sandbox.stub(cg().storage, 'storeGlobalCache').callsFake((_key, _values, cb) => cb(null));
  }

  before(async () => {
    await helpers.before();
  });

  beforeEach(async () => {
    config.coinGecko = {
      api: 'https://pro-api.coingecko.com/api'
    };

    await helpers.beforeEach();
    ({ wallet } = await helpers.createAndJoinWallet(1, 1));
    const priv = TestData.copayers[0].privKey_1H_0;
    const sig = helpers.signMessage('hello world', priv);

    server = await util.promisify(WalletService.getInstanceWithAuth).call(WalletService, {
      // test assumes wallet's copayer[0] is TestData's copayer[0]
      copayerId: wallet.copayers[0].id,
      message: 'hello world',
      signature: sig,
      clientVersion: 'bwc-2.0.0',
      walletId: '123'
    });
  });

  after(async () => {
    await helpers.after();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#coinGeckoGetTokenData', () => {
    beforeEach(() => {
      fakeRequest = createCoinGeckoRequestStub({
        onTokenList: _platformId => ({
          tokens: [
            {
              chainId: 1,
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              symbol: 'USDC',
              name: 'USD Coin',
              decimals: 6,
              logoURI: 'xxxxxx'
            }
          ]
        })
      });
      cg().request = fakeRequest;
    });

    it('should get coinGecko list of tokens data', async () => {
      const data = await getTokens({});
      should.exist(data);
    });

    it('should map chain aliases to the correct token list platform', async () => {
      forceGlobalCacheMisses();

      let platformSeen: string | undefined;
      fakeRequest = createCoinGeckoRequestStub({
        onTokenList: platformId => {
          platformSeen = platformId;
          return {
            tokens: [
              {
                chainId: 137,
                address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
                symbol: 'USDC',
                name: 'USD Coin',
                decimals: 6,
                logoURI: 'xxxxxx'
              }
            ]
          };
        }
      });

      cg().request = fakeRequest;

      const data = await getTokens({ params: { chain: 'pol' } });
      should.exist(data);
      platformSeen.should.equal('polygon-pos');
    });

    it('should return error if coinGecko is commented in config', async () => {
      config.coinGecko = undefined;
      try {
        await getTokens({});
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('coinGecko missing credentials');
      }
    });
  });

  describe('#coinGeckoGetMarketStats', () => {
    beforeEach(() => {
      const marketById: Record<string, any> = {
        bitcoin: {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          image: 'btc.png',
          current_price: 100,
          total_volume: 200,
          circulating_supply: 300,
          market_cap: 400,
          last_updated: '2020-01-01T00:00:00.000Z'
        },
        ethereum: {
          id: 'ethereum',
          symbol: 'eth',
          name: 'Ethereum',
          image: 'eth.png',
          current_price: 10,
          total_volume: 20,
          circulating_supply: 30,
          market_cap: 40,
          last_updated: '2020-01-01T00:00:00.000Z'
        },
        'wrapped-bitcoin': {
          id: 'wrapped-bitcoin',
          symbol: 'wbtc',
          name: 'wrapped-bitcoin',
          image: 'wbtc.png',
          current_price: 1,
          total_volume: 1,
          circulating_supply: 1,
          market_cap: 1,
          market_cap_rank: 12,
          last_updated: '2020-01-01T00:00:00.000Z'
        },
        'usd-coin': {
          id: 'usd-coin',
          symbol: 'usdc',
          name: 'USD Coin',
          image: 'usdc.png',
          current_price: 1,
          total_volume: 11,
          circulating_supply: 1000,
          market_cap: 2000,
          market_cap_rank: 10,
          last_updated: '2020-01-01T00:00:00.000Z'
        },
        'bridged-usdc-polygon-pos-bridge': {
          id: 'bridged-usdc-polygon-pos-bridge',
          symbol: 'usdc',
          name: 'Bridged USDC (Polygon PoS Bridge)',
          image: 'usdc-pol.png',
          current_price: 1,
          total_volume: 9,
          circulating_supply: 900,
          market_cap: 900,
          market_cap_rank: 80,
          last_updated: '2020-01-01T00:00:00.000Z'
        },
        'dup-coin-1': {
          id: 'dup-coin-1',
          symbol: 'dup',
          name: 'Duplicate Small',
          image: 'dup-small.png',
          current_price: 3,
          total_volume: 33,
          circulating_supply: 300,
          market_cap: 3000,
          market_cap_rank: 500,
          last_updated: '2020-01-01T00:00:00.000Z'
        },
        'dup-coin-2': {
          id: 'dup-coin-2',
          symbol: 'dup',
          name: 'Duplicate Large',
          image: 'dup-large.png',
          current_price: 5,
          total_volume: 55,
          circulating_supply: 500,
          market_cap: 5000,
          market_cap_rank: 200,
          last_updated: '2020-01-01T00:00:00.000Z'
        }
      };

      const aboutById: Record<string, string> = {
        bitcoin: 'About BTC',
        ethereum: 'About ETH',
        'bridged-usdc-polygon-pos-bridge': 'About bridged USDC on Polygon'
      };

      const assetPlatformById: Record<string, string | null> = {
        bitcoin: null,
        ethereum: null,
        'wrapped-bitcoin': 'ethereum',
        'usd-coin': 'ethereum',
        'bridged-usdc-polygon-pos-bridge': 'polygon-pos',
        'dup-coin-1': 'ethereum',
        'dup-coin-2': 'ethereum'
      };

      // `usd-coin` is native to Ethereum but appears on other chains via bridging.
      const detailPlatformsById: Record<string, Record<string, any> | undefined> = {
        'usd-coin': { 'polygon-pos': {} }
      };

      const searchResultsByQuery: Record<string, any> = {
        wbtc: { coins: [{ id: 'wrapped-bitcoin', symbol: 'wbtc' }] },
        usdc: {
          coins: [
            { id: 'usd-coin', symbol: 'usdc' },
            { id: 'bridged-usdc-polygon-pos-bridge', symbol: 'usdc' }
          ]
        },
        dup: {
          // Ordering matters: first result is treated as the "winner".
          coins: [
            { id: 'dup-coin-2', symbol: 'dup' },
            { id: 'dup-coin-1', symbol: 'dup' }
          ]
        }
      };

      fakeRequest = createCoinGeckoRequestStub({
        onSearch: q => searchResultsByQuery[q.toLowerCase()] || { coins: [] },
        onMarkets: ids =>
          ids.map(id =>
            marketById[id]
              ? marketById[id]
              : {
                id,
                symbol: id.replace(/[^a-z]/g, '').slice(0, 4),
                name: id,
                image: `${id}.png`,
                current_price: 1,
                total_volume: 1,
                circulating_supply: 1,
                market_cap: 1,
                last_updated: '2020-01-01T00:00:00.000Z'
              }
          ),
        onMarketChart: id => {
          if (id === 'bitcoin') return { prices: [[0, 90], [1, 110], [2, 95]] };
          if (id === 'ethereum') return { prices: [[0, 9], [1, 12], [2, 8]] };
          return { prices: [[0, 1], [1, 1], [2, 1]] };
        },
        onCoinInfo: id => ({
          description: { en: aboutById[id] || `About ${id}` },
          asset_platform_id: Object.prototype.hasOwnProperty.call(assetPlatformById, id) ? assetPlatformById[id] : null,
          detail_platforms: detailPlatformsById[id]
        })
      });

      cg().request = fakeRequest;
    });

    it('should get market stats for a single coin', async () => {
      const data = await getMarketStats({ coin: 'btc' }, 'ARS');
      should.exist(data);
      data.should.have.length(1);
      data[0].about.should.equal('About BTC');
      data[0].low52w.should.equal(90);
    });

    it('should resolve non-default coin symbols via /search', async () => {
      const data = await getMarketStats({ coin: 'wbtc' });
      should.exist(data);
      data.should.have.length(1);
      data[0].name.should.equal('wrapped-bitcoin');
    });

    it('should resolve ambiguous symbol by market-cap ordering from /search', async () => {
      const data = await getMarketStats({ coin: 'dup' });
      should.exist(data);
      data.should.have.length(1);
      data[0].name.should.equal('Duplicate Large');
    });

    it('should prefer chain-specific match for market stats when chain is provided', async () => {
      const data = await getMarketStats({ coin: 'usdc', chain: 'pol' });
      should.exist(data);
      data.should.have.length(1);
      data[0].name.should.equal('Bridged USDC (Polygon PoS Bridge)');
      data[0].about.should.equal('About bridged USDC on Polygon');
    });

    it('should accept array query params for coin and chain', async () => {
      const data = await getMarketStats({ coin: ['usdc'], chain: ['pol'] });
      should.exist(data);
      data.should.have.length(1);
      data[0].name.should.equal('Bridged USDC (Polygon PoS Bridge)');
    });

    it('should resolve a token unambiguously when tokenAddress is provided', async () => {
      forceGlobalCacheMisses();
      const tokenAddress = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

      fakeRequest = createCoinGeckoRequestStub({
        onSearch: q => ({
          coins: [
            { id: 'stargate-bridged-usdc', symbol: q },
            { id: 'arbitrum-bridged-usdc-arbitrum', symbol: q }
          ]
        }),
        onCoinContract: (platformId, address) => {
          platformId.should.equal('arbitrum-one');
          address.should.equal(tokenAddress);
          return {
            id: 'arbitrum-bridged-usdc-arbitrum',
            symbol: 'usdc.e',
            asset_platform_id: 'arbitrum-one'
          };
        },
        onMarkets: ids =>
          ids.map(id => ({
            id,
            symbol: 'usdc.e',
            name: 'Arbitrum Bridged USDC (Arbitrum)',
            image: `${id}.png`,
            current_price: 1,
            total_volume: 1,
            circulating_supply: 1,
            market_cap: 1,
            last_updated: '2020-01-01T00:00:00.000Z'
          })),
        onMarketChart: _id => ({ prices: [[0, 1], [1, 1]] }),
        onCoinInfo: _id => ({ description: { en: 'About token' }, asset_platform_id: 'arbitrum-one' })
      });

      cg().request = fakeRequest;

      const data = await getMarketStats({ coin: 'USDC.e', chain: 'arb', tokenAddress });
      should.exist(data);
      data.should.have.length(1);
      data[0].name.should.equal('Arbitrum Bridged USDC (Arbitrum)');
    });

    it('should reject tokenAddress when returned token chain does not match chain', async () => {
      forceGlobalCacheMisses();
      const tokenAddress = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

      fakeRequest = createCoinGeckoRequestStub({
        onCoinContract: () => ({
          id: 'arbitrum-bridged-usdc-arbitrum',
          symbol: 'usdc.e',
          asset_platform_id: 'ethereum'
        })
      });
      cg().request = fakeRequest;

      try {
        await getMarketStats({ coin: 'USDC.e', chain: 'arb', tokenAddress });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('tokenAddress does not match chain');
      }
    });

    it('should map tokenAddress contract 404s to Unsupported tokenAddress', async () => {
      forceGlobalCacheMisses();
      const tokenAddress = '0xdeadbeef';

      fakeRequest = createCoinGeckoRequestStub({
        onCoinContract: () => ({
          status: { error_code: 404, error_message: 'not found' }
        })
      });
      cg().request = fakeRequest;

      try {
        await getMarketStats({ coin: 'USDC.e', chain: 'arb', tokenAddress });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Unsupported tokenAddress');
      }
    });

    it('should reject tokenAddress when returned token symbol does not match coin', async () => {
      forceGlobalCacheMisses();
      const tokenAddress = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

      fakeRequest = createCoinGeckoRequestStub({
        onCoinContract: () => ({
          id: 'arbitrum-bridged-usdc-arbitrum',
          symbol: 'usdc.e'
        })
      });
      cg().request = fakeRequest;

      try {
        await getMarketStats({ coin: 'WBTC', chain: 'arb', tokenAddress });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('tokenAddress does not match coin');
      }
    });

    it('should reject market stats when chain does not match coin', async () => {
      try {
        await getMarketStats({ coin: 'USDC', chain: 'base' });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('chain does not match coin');
      }
    });

    it('should use DB cache for default marketstats coin', async () => {
      const checkCacheStub = sandbox
        .stub(cg().storage, 'checkAndUseGlobalCache')
        .callsFake((_key, _duration, cb) => cb(null, null, null));
      const storeCacheStub = sandbox.stub(cg().storage, 'storeGlobalCache').callsFake((_key, _values, cb) => cb(null));

      const data = await getMarketStats({ coin: 'btc' });

      should.exist(data);
      checkCacheStub.callCount.should.equal(1);
      checkCacheStub.getCall(0).args[0].should.equal('cgMarketStats:usd:bitcoin');
      storeCacheStub.callCount.should.equal(1);
      storeCacheStub.getCall(0).args[0].should.equal('cgMarketStats:usd:bitcoin');
    });

    it('should bypass DB cache for non-default marketstats coin', async () => {
      const checkCacheStub = sandbox
        .stub(cg().storage, 'checkAndUseGlobalCache')
        .callsFake((_key, _duration, cb) => cb(null, null, null));
      const storeCacheStub = sandbox.stub(cg().storage, 'storeGlobalCache').callsFake((_key, _values, cb) => cb(null));

      const data = await getMarketStats({ coin: 'wbtc' });

      should.exist(data);

      const checkedKeys = checkCacheStub.getCalls().map(c => c.args[0] as string);
      const storedKeys = storeCacheStub.getCalls().map(c => c.args[0] as string);
      checkedKeys.some(k => typeof k === 'string' && k.startsWith('cgMarketStats:')).should.equal(false);
      storedKeys.some(k => typeof k === 'string' && k.startsWith('cgMarketStats:')).should.equal(false);
    });

    it('should return error if coinGecko is commented in config', async () => {
      config.coinGecko = undefined;
      try {
        await getMarketStats({ coin: 'btc' });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('coinGecko missing credentials');
      }
    });
  });

  describe('#coinGeckoGetFiatRates', () => {
    beforeEach(() => {
      const coinList = [
        { id: 'bitcoin', symbol: 'btc' },
        { id: 'bitcoin-cash', symbol: 'bch' },
        { id: 'wrapped-bitcoin', symbol: 'wbtc' },
        { id: 'usd-coin', symbol: 'usdc' },
        { id: 'usdc-fake', symbol: 'usdc' },
        { id: 'dup-coin-1', symbol: 'dup' },
        { id: 'dup-coin-2', symbol: 'dup' },
        { id: 'list-fallback', symbol: 'abc' }
      ];

      const pricesById: Record<string, Array<[number, number]>> = {
        bitcoin: [[1, 100], [2, 110]],
        'bitcoin-cash': [[1, 200], [2, 210]],
        'wrapped-bitcoin': [[1, 1], [2, 1]],
        'usd-coin': [[1, 1], [2, 1]],
        'usdc-fake': [[1, 42], [2, 43]],
        'dup-coin-1': [[1, 111], [2, 112]],
        'dup-coin-2': [[1, 222], [2, 223]],
        'list-fallback': [[1, 9], [2, 9]]
      };

      const assetPlatformById: Record<string, string | null> = {
        bitcoin: null,
        'bitcoin-cash': null,
        'wrapped-bitcoin': 'ethereum',
        'usd-coin': 'ethereum',
        'usdc-fake': 'polygon-pos',
        'dup-coin-1': 'ethereum',
        'dup-coin-2': 'ethereum',
        'list-fallback': 'ethereum'
      };

      const detailPlatformsById: Record<string, Record<string, any> | undefined> = {
        'usd-coin': { 'polygon-pos': {} }
      };

      const searchResultsByQuery: Record<string, any> = {
        wbtc: { coins: [{ id: 'wrapped-bitcoin', symbol: 'wbtc' }] },
        usdc: {
          coins: [
            { id: 'usd-coin', symbol: 'usdc' },
            { id: 'usdc-fake', symbol: 'usdc' }
          ]
        },
        dup: {
          coins: [
            { id: 'dup-coin-2', symbol: 'dup' },
            { id: 'dup-coin-1', symbol: 'dup' }
          ]
        },
        // Forces `/coins/list` fallback.
        abc: { coins: [] }
      };

      fakeRequest = createCoinGeckoRequestStub({
        onSearch: q => searchResultsByQuery[q.toLowerCase()] || { coins: [] },
        onCoinList: () => coinList,
        onMarketChart: id => ({ prices: pricesById[id] || [[1, 1], [2, 1]] }),
        onCoinInfo: id => ({
          asset_platform_id: Object.prototype.hasOwnProperty.call(assetPlatformById, id) ? assetPlatformById[id] : null,
          detail_platforms: detailPlatformsById[id]
        })
      });

      cg().request = fakeRequest;
    });

    it('should get fiat rates with default days', async () => {
      const data = await getFiatRates({ coin: 'BTC' });
      should.exist(data);
      data.should.deep.equal([
        { ts: 1, rate: 100 },
        { ts: 2, rate: 110 }
      ]);
    });

    it('should ignore invalid chain values for default coins', async () => {
      const data = await getFiatRates({ coin: 'BTC', chain: '!!!' });
      should.exist(data);
      data.should.deep.equal([
        { ts: 1, rate: 100 },
        { ts: 2, rate: 110 }
      ]);
    });

    it('should ignore invalid chain values for ambiguous symbols and resolve by search ordering', async () => {
      const data = await getFiatRates({ coin: 'USDC', chain: '!!!' });
      should.exist(data);
      data.should.deep.equal([
        { ts: 1, rate: 1 },
        { ts: 2, rate: 1 }
      ]);
    });

    it('should get fiat rates with explicit days', async () => {
      const data = await getFiatRates({ coin: 'BTC', days: 365 });
      should.exist(data);
      data.should.have.length(2);
      data[0].rate.should.equal(100);
    });

    it('should support BCH coin mapping', async () => {
      const data = await getFiatRates({ coin: 'BCH' });
      should.exist(data);
      data[0].rate.should.equal(200);
    });

    it('should resolve non-default coin symbols via /search', async () => {
      const data = await getFiatRates({ coin: 'WBTC' });
      should.exist(data);
      data.should.deep.equal([
        { ts: 1, rate: 1 },
        { ts: 2, rate: 1 }
      ]);
    });

    it('should fall back to /coins/list when /search yields no exact matches', async () => {
      const data = await getFiatRates({ coin: 'ABC' });
      should.exist(data);
      data.should.deep.equal([
        { ts: 1, rate: 9 },
        { ts: 2, rate: 9 }
      ]);
    });

    it('should prefer chain-specific match for ambiguous symbol in fiat rates', async () => {
      const data = await getFiatRates({ coin: 'USDC', chain: 'pol' });
      should.exist(data);
      data.should.deep.equal([
        { ts: 1, rate: 42 },
        { ts: 2, rate: 43 }
      ]);
    });

    it('should resolve fiat rates unambiguously when tokenAddress is provided', async () => {
      forceGlobalCacheMisses();
      const tokenAddress = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

      fakeRequest = createCoinGeckoRequestStub({
        onSearch: q => ({ coins: [{ id: 'stargate-bridged-usdc', symbol: q }] }),
        onCoinContract: (platformId, address) => {
          platformId.should.equal('arbitrum-one');
          address.should.equal(tokenAddress);
          return {
            id: 'arbitrum-bridged-usdc-arbitrum',
            symbol: 'usdc.e',
            asset_platform_id: 'arbitrum-one'
          };
        },
        onMarketChart: id =>
          id === 'arbitrum-bridged-usdc-arbitrum'
            ? { prices: [[1, 77], [2, 78]] }
            : { prices: [[1, 1], [2, 1]] }
      });
      cg().request = fakeRequest;

      const data = await getFiatRates({ coin: 'USDC.e', chain: 'arb', tokenAddress });
      should.exist(data);
      data.should.deep.equal([
        { ts: 1, rate: 77 },
        { ts: 2, rate: 78 }
      ]);
    });

    it('should require a valid chain when tokenAddress is provided', async () => {
      const tokenAddress = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';
      try {
        await getFiatRates({ coin: 'USDC.e', tokenAddress });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('tokenAddress requires valid chain');
      }
    });

    it('should rethrow non-404 tokenAddress lookup errors', async () => {
      forceGlobalCacheMisses();
      const tokenAddress = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

      fakeRequest = createCoinGeckoRequestStub({
        onCoinContract: () => ({
          status: { error_code: 429, error_message: 'rate limited' }
        })
      });
      cg().request = fakeRequest;

      try {
        await getFiatRates({ coin: 'USDC.e', chain: 'arb', tokenAddress });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('coinGecko rate limit');
      }
    });

    it('should reject fiat rates tokenAddress when returned token symbol does not match coin', async () => {
      forceGlobalCacheMisses();
      const tokenAddress = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

      fakeRequest = createCoinGeckoRequestStub({
        onCoinContract: () => ({
          id: 'arbitrum-bridged-usdc-arbitrum',
          symbol: 'usdc.e'
        })
      });
      cg().request = fakeRequest;

      try {
        await getFiatRates({ coin: 'WBTC', chain: 'arb', tokenAddress });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('tokenAddress does not match coin');
      }
    });

    for (const chainAlias of ['pol', 'matic']) {
      it(`should support chain alias '${chainAlias}' for Polygon`, async () => {
        const data = await getFiatRates({ coin: 'USDC', chain: chainAlias });
        should.exist(data);
        data.should.deep.equal([
          { ts: 1, rate: 42 },
          { ts: 2, rate: 43 }
        ]);
      });
    }

    it('should reject fiat rates when chain has no matches', async () => {
      try {
        await getFiatRates({ coin: 'USDC', chain: 'base' });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('chain does not match coin');
      }
    });

    it('should accept array query params for days', async () => {
      const data = await getFiatRates({ coin: 'BTC', days: ['365'] });
      should.exist(data);
      data.should.deep.equal([
        { ts: 1, rate: 100 },
        { ts: 2, rate: 110 }
      ]);
    });

    it('should treat whitespace coin as missing and return default rates', async () => {
      const data: any = await getFiatRates({ coin: '   ' });
      should.exist(data);
      Object.keys(data)
        .sort()
        .should.deep.equal(['bch', 'btc', 'doge', 'eth', 'ltc', 'pol', 'sol', 'xrp']);
    });

    it('should reject overly long coin symbols', async () => {
      try {
        await getFiatRates({ coin: 'x'.repeat(100) });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Unsupported coin');
      }
    });

    it('should reject overly long days values', async () => {
      try {
        await getFiatRates({ coin: 'BTC', days: 'x'.repeat(100) });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Invalid days');
      }
    });

    it('should resolve generic ambiguous symbol by /search ordering for fiat rates', async () => {
      const data = await getFiatRates({ coin: 'dup' });
      should.exist(data);
      data.should.deep.equal([
        { ts: 1, rate: 222 },
        { ts: 2, rate: 223 }
      ]);
    });

    it('should use DB cache for default fiatrates coin', async () => {
      const checkCacheStub = sandbox
        .stub(cg().storage, 'checkAndUseGlobalCache')
        .callsFake((_key, _duration, cb) => cb(null, null, null));
      const storeCacheStub = sandbox.stub(cg().storage, 'storeGlobalCache').callsFake((_key, _values, cb) => cb(null));

      const data = await getFiatRates({ coin: 'BTC' });

      should.exist(data);
      checkCacheStub.callCount.should.equal(1);
      checkCacheStub.getCall(0).args[0].should.equal('cgFiatRates:bitcoin:usd:100000');
      storeCacheStub.callCount.should.equal(1);
      storeCacheStub.getCall(0).args[0].should.equal('cgFiatRates:bitcoin:usd:100000');
    });

    it('should bypass DB cache for non-default fiatrates coin', async () => {
      const checkCacheStub = sandbox
        .stub(cg().storage, 'checkAndUseGlobalCache')
        .callsFake((_key, _duration, cb) => cb(null, null, null));
      const storeCacheStub = sandbox.stub(cg().storage, 'storeGlobalCache').callsFake((_key, _values, cb) => cb(null));

      const data = await getFiatRates({ coin: 'WBTC' });

      should.exist(data);

      const checkedKeys = checkCacheStub.getCalls().map(c => c.args[0] as string);
      const storedKeys = storeCacheStub.getCalls().map(c => c.args[0] as string);
      checkedKeys.some(k => typeof k === 'string' && k.startsWith('cgFiatRates:')).should.equal(false);
      storedKeys.some(k => typeof k === 'string' && k.startsWith('cgFiatRates:')).should.equal(false);
    });

    it('should return error on invalid days', async () => {
      try {
        await getFiatRates({ coin: 'BTC', days: 0 });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Invalid days');
      }
    });

    it('should return rates for default coins if missing coin', async () => {
      const data: any = await getFiatRates({});
      should.exist(data);
      Object.keys(data)
        .sort()
        .should.deep.equal(['bch', 'btc', 'doge', 'eth', 'ltc', 'pol', 'sol', 'xrp']);

      data.btc.should.deep.equal([
        { ts: 1, rate: 100 },
        { ts: 2, rate: 110 }
      ]);
      data.bch.should.deep.equal([
        { ts: 1, rate: 200 },
        { ts: 2, rate: 210 }
      ]);
    });

    it('should omit a failed default coin and log a warning', async () => {
      const warnSpy = sandbox.spy(logger, 'warn');

      // Force global-cache misses so every default coin fetches via HTTP.
      forceGlobalCacheMisses();

      // Make one default coin fail its market_chart request.
      const baseGet = fakeRequest.get;
      fakeRequest.get = (url, opts, cb) => {
        const mChart = url.match(/\/v3\/coins\/([^/]+)\/market_chart\?/);
        if (mChart?.[1]) {
          const id = decodeURIComponent(mChart[1]);
          if (id === 'bitcoin-cash') return cb(new Error('boom'));
        }
        return baseGet(url, opts, cb);
      };

      const data: any = await getFiatRates({});

      should.exist(data);
      Object.keys(data).should.not.include('bch');
      Object.keys(data).should.include('btc');

      const bchWarns = warnSpy
        .getCalls()
        .map(c => c.args)
        .filter(args => args?.[0]?.toString().includes('CoinGecko fiat rates fetch failed') && args?.[1]?.coin === 'bch');
      bchWarns.length.should.be.greaterThan(0);
    });
  });
});
