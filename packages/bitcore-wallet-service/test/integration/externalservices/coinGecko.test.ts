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

function createCoinGeckoRequestStub(handlers: {
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
        }
      };

      fakeRequest = createCoinGeckoRequestStub({
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
          return { prices: [[0, 1], [1, 1], [2, 1]] };
        },
        onCoinInfo: id => ({ description: { en: id === 'bitcoin' ? 'About BTC' : `About ${id}` } })
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

    it('should reject non-default coin symbols without tokenAddress', async () => {
      try {
        await getMarketStats({ coin: 'WBTC' });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Unsupported coin. For token symbols, pass `chain` and `tokenAddress`.');
      }
    });

    it('should require tokenAddress when chain is provided for market stats', async () => {
      try {
        await getMarketStats({ coin: ['btc'], chain: ['eth'] });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('chain is only supported for token lookups; provide tokenAddress or omit chain for native coins');
      }
    });

    it('should reject invalid chain values for default marketstats coins', async () => {
      try {
        await getMarketStats({ coin: 'BTC', chain: '!!!' });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Unsupported chain');
      }
    });


    it('should resolve a token unambiguously when tokenAddress is provided', async () => {
      const tokenAddress = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

      fakeRequest = createCoinGeckoRequestStub({
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

    it('should resolve market stats by chain + tokenAddress when coin is omitted', async () => {
      const tokenAddress = '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8';

      fakeRequest = createCoinGeckoRequestStub({
        onCoinContract: (platformId, address) => {
          platformId.should.equal('arbitrum-one');
          address.should.equal(tokenAddress);
          return {
            id: 'bridged-usdc-arbitrum',
            symbol: 'usdc',
            asset_platform_id: 'arbitrum-one'
          };
        },
        onMarkets: ids =>
          ids.map(id => ({
            id,
            symbol: 'usdc',
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

      const data = await getMarketStats({ chain: 'arb', tokenAddress });
      should.exist(data);
      data.should.have.length(1);
      data[0].name.should.equal('Arbitrum Bridged USDC (Arbitrum)');
    });

    it('should map pol alias to polygon-pos for token marketstats lookup', async () => {
      const tokenAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

      fakeRequest = createCoinGeckoRequestStub({
        onCoinContract: (platformId, address) => {
          platformId.should.equal('polygon-pos');
          address.should.equal(tokenAddress);
          return {
            id: 'usd-coin',
            symbol: 'usdc',
            asset_platform_id: 'polygon-pos'
          };
        },
        onMarkets: ids =>
          ids.map(id => ({
            id,
            symbol: 'usdc',
            name: 'USD Coin (PoS)',
            image: `${id}.png`,
            current_price: 1,
            total_volume: 1,
            circulating_supply: 1,
            market_cap: 1,
            last_updated: '2020-01-01T00:00:00.000Z'
          })),
        onMarketChart: _id => ({ prices: [[0, 1], [1, 1]] }),
        onCoinInfo: _id => ({ description: { en: 'About token' }, asset_platform_id: 'polygon-pos' })
      });
      cg().request = fakeRequest;

      const data = await getMarketStats({ chain: 'pol', tokenAddress });
      should.exist(data);
      data.should.have.length(1);
      data[0].name.should.equal('USD Coin (PoS)');
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
      const tokenAddress = '0x000000000000000000000000000000000000dead';

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

    it('should reject invalid EVM tokenAddress format before lookup', async () => {
      const getSpy = sandbox.spy();
      cg().request = { get: getSpy };

      try {
        await getMarketStats({ coin: 'USDC.e', chain: 'arb', tokenAddress: 'invalid-evm-address' });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Invalid tokenAddress');
        err.statusCode.should.equal(400);
      }

      getSpy.callCount.should.equal(0);
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

    it('should bypass DB cache for token marketstats requests', async () => {
      const checkCacheStub = sandbox
        .stub(cg().storage, 'checkAndUseGlobalCache')
        .callsFake((_key, _duration, cb) => cb(null, null, null));
      const storeCacheStub = sandbox.stub(cg().storage, 'storeGlobalCache').callsFake((_key, _values, cb) => cb(null));

      const tokenAddress = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

      fakeRequest = createCoinGeckoRequestStub({
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
        onCoinInfo: _id => ({ description: { en: 'About token' } })
      });
      cg().request = fakeRequest;

      const data = await getMarketStats({ coin: 'USDC.e', chain: 'arb', tokenAddress });

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
      const pricesById: Record<string, Array<[number, number]>> = {
        bitcoin: [[1, 100], [2, 110]],
        'bitcoin-cash': [[1, 200], [2, 210]]
      };

      fakeRequest = createCoinGeckoRequestStub({
        onMarketChart: id => ({ prices: pricesById[id] || [[1, 1], [2, 1]] }),
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

    it('should reject invalid chain values for default coins', async () => {
      try {
        await getFiatRates({ coin: 'BTC', chain: '!!!' });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Unsupported chain');
      }
    });

    it('should require tokenAddress when chain is provided for fiat rates', async () => {
      try {
        await getFiatRates({ coin: 'BTC', chain: 'eth' });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('chain is only supported for token lookups; provide tokenAddress or omit chain for native coins');
      }
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

    it('should reject non-default coin symbols without tokenAddress', async () => {
      try {
        await getFiatRates({ coin: 'WBTC' });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Unsupported coin. For token symbols, pass `chain` and `tokenAddress`.');
      }
    });

    it('should resolve fiat rates unambiguously when tokenAddress is provided', async () => {
      forceGlobalCacheMisses();
      const tokenAddress = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

      fakeRequest = createCoinGeckoRequestStub({
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

    it('should resolve fiat rates by chain + tokenAddress when coin is omitted', async () => {
      forceGlobalCacheMisses();
      const tokenAddress = '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8';

      fakeRequest = createCoinGeckoRequestStub({
        onCoinContract: (platformId, address) => {
          platformId.should.equal('arbitrum-one');
          address.should.equal(tokenAddress);
          return {
            id: 'bridged-usdc-arbitrum',
            symbol: 'usdc',
            asset_platform_id: 'arbitrum-one'
          };
        },
        onMarketChart: id =>
          id === 'bridged-usdc-arbitrum'
            ? { prices: [[1, 99], [2, 100]] }
            : { prices: [[1, 1], [2, 1]] }
      });
      cg().request = fakeRequest;

      const data = await getFiatRates({ chain: 'arb', tokenAddress });
      should.exist(data);
      data.should.deep.equal([
        { ts: 1, rate: 99 },
        { ts: 2, rate: 100 }
      ]);
    });

    it('should map pol alias to polygon-pos for token fiatrates lookup', async () => {
      forceGlobalCacheMisses();
      const tokenAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

      fakeRequest = createCoinGeckoRequestStub({
        onCoinContract: (platformId, address) => {
          platformId.should.equal('polygon-pos');
          address.should.equal(tokenAddress);
          return {
            id: 'usd-coin',
            symbol: 'usdc',
            asset_platform_id: 'polygon-pos'
          };
        },
        onMarketChart: id =>
          id === 'usd-coin'
            ? { prices: [[1, 11], [2, 12]] }
            : { prices: [[1, 1], [2, 1]] }
      });
      cg().request = fakeRequest;

      const data = await getFiatRates({ chain: 'pol', tokenAddress });
      should.exist(data);
      data.should.deep.equal([
        { ts: 1, rate: 11 },
        { ts: 2, rate: 12 }
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

    it('should reject invalid Solana tokenAddress format before lookup', async () => {
      const getSpy = sandbox.spy();
      cg().request = { get: getSpy };

      try {
        await getFiatRates({ chain: 'sol', tokenAddress: '0xdeadbeef' });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Invalid tokenAddress');
        err.statusCode.should.equal(400);
      }

      getSpy.callCount.should.equal(0);
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

    it('should bypass DB cache for token fiatrates requests', async () => {
      const checkCacheStub = sandbox
        .stub(cg().storage, 'checkAndUseGlobalCache')
        .callsFake((_key, _duration, cb) => cb(null, null, null));
      const storeCacheStub = sandbox.stub(cg().storage, 'storeGlobalCache').callsFake((_key, _values, cb) => cb(null));

      const tokenAddress = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

      fakeRequest = createCoinGeckoRequestStub({
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
