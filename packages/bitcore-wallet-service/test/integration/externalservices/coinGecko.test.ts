'use strict';

import chai from 'chai';
import 'chai/register-should';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';

const should = chai.should();

describe('CoinGecko integration', function() {
  this.timeout(5000);
  let server;
  let wallet;
  let fakeRequest;
  let req;
  
  before(async () => {
    await helpers.before();
  });

  beforeEach(async () => {
    config.coinGecko = {
      api: 'xxxx',
    };

    fakeRequest = {
      get: (_url, _opts, _cb) => { return _cb(null, { body: { tokens: [{
        chainId: 1,
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logoURI: 'xxxxxx'
      }] } }); },
    };

    await helpers.beforeEach();
    ({ wallet } = await helpers.createAndJoinWallet(1, 1));
    const priv = TestData.copayers[0].privKey_1H_0;
    const sig = helpers.signMessage('hello world', priv);
  
    (server = await util.promisify(WalletService.getInstanceWithAuth).call(WalletService, {
      // test assumes wallet's copayer[0] is TestData's copayer[0]
      copayerId: wallet.copayers[0].id,
      message: 'hello world',
      signature: sig,
      clientVersion: 'bwc-2.0.0',
      walletId: '123',
    }));
  });

  after(async () => {
    await helpers.after();
  });

  describe('#coinGeckoGetTokenData', () => {
    beforeEach(() => {
      server.externalServices.coinGecko.request = fakeRequest;
    });
    
    it('should get coinGecko list of tokens data', async () => {
      const data = await server.externalServices.coinGecko.coinGeckoGetTokens({});
      should.exist(data);
    });

    it('should return error if coinGecko is commented in config', async () => {
      config.coinGecko = undefined;
      try {
        await server.externalServices.coinGecko.coinGeckoGetTokens({});
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('coinGecko missing credentials');
      }
    });
  });

  describe('#coinGeckoGetMarketStats', () => {
    beforeEach(() => {
      config.coinGecko = {
        api: 'https://pro-api.coingecko.com/api',
      };

      fakeRequest = {
        get: (url, _opts, cb) => {
          const defaultIds = [
            'bitcoin',
            'ethereum',
            'ripple',
            'solana',
            'dogecoin',
            'bitcoin-cash',
            'shiba-inu',
            'polygon-ecosystem-token',
            'apecoin',
            'litecoin',
            'wrapped-bitcoin',
            'weth'
          ];

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
            }
          };

          const aboutById: Record<string, string> = {
            bitcoin: 'About BTC',
            ethereum: 'About ETH'
          };

          if (url.includes('/v3/coins/markets')) {
            return cb(null, {
              body: [
                ...defaultIds.map(id =>
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
                )
              ]
            });
          }

          const mChart = url.match(/\/v3\/coins\/([^/]+)\/market_chart\?/);
          if (mChart?.[1]) {
            const id = decodeURIComponent(mChart[1]);
            if (id === 'bitcoin') return cb(null, { body: { prices: [[0, 90], [1, 110], [2, 95]] } });
            if (id === 'ethereum') return cb(null, { body: { prices: [[0, 9], [1, 12], [2, 8]] } });
            return cb(null, { body: { prices: [[0, 1], [1, 1], [2, 1]] } });
          }

          const mInfo = url.match(/\/v3\/coins\/([^?]+)\?/);
          if (mInfo?.[1]) {
            const id = decodeURIComponent(mInfo[1]);
            return cb(null, { body: { description: { en: aboutById[id] || `About ${id}` } } });
          }

          return cb(new Error('unexpected url'));
        }
      };

      server.externalServices.coinGecko.request = fakeRequest;
    });

    it('should get market stats for a single coin', async () => {
      const data = await server.externalServices.coinGecko.coinGeckoGetMarketStats({ params: { code: 'ARS' }, query: { coin: 'btc' } });
      should.exist(data);
      data.should.have.length(1);
      data[0].about.should.equal('About BTC');
      data[0].low52w.should.equal(90);
    });

    it('should return error if coinGecko is commented in config', async () => {
      config.coinGecko = undefined;
      try {
        await server.externalServices.coinGecko.coinGeckoGetMarketStats({ params: { code: 'USD' }, query: { coin: 'btc' } });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('coinGecko missing credentials');
      }
    });
  });

  describe('#coinGeckoGetFiatRates', () => {
    beforeEach(() => {
      config.coinGecko = {
        api: 'https://pro-api.coingecko.com/api',
      };

      fakeRequest = {
        get: (url, _opts, cb) => {
          const mChart = url.match(/\/v3\/coins\/([^/]+)\/market_chart\?/);
          if (mChart?.[1]) {
            const id = decodeURIComponent(mChart[1]);
            if (id === 'bitcoin') return cb(null, { body: { prices: [[1, 100], [2, 110]] } });
            if (id === 'bitcoin-cash') return cb(null, { body: { prices: [[1, 200], [2, 210]] } });
            return cb(null, { body: { prices: [[1, 1], [2, 1]] } });
          }
          return cb(new Error('unexpected url'));
        }
      };

      server.externalServices.coinGecko.request = fakeRequest;
    });

    it('should get fiat rates with default days', async () => {
      const data = await server.externalServices.coinGecko.coinGeckoGetFiatRates({
        params: { code: 'USD' },
        query: { coin: 'BTC' }
      });
      should.exist(data);
      data.should.deep.equal([
        { ts: 1, rate: 100 },
        { ts: 2, rate: 110 }
      ]);
    });

    it('should get fiat rates with explicit days', async () => {
      const data = await server.externalServices.coinGecko.coinGeckoGetFiatRates({
        params: { code: 'USD' },
        query: { coin: 'BTC', days: 365 }
      });
      should.exist(data);
      data.should.have.length(2);
      data[0].rate.should.equal(100);
    });

    it('should support BCH coin mapping', async () => {
      const data = await server.externalServices.coinGecko.coinGeckoGetFiatRates({
        params: { code: 'USD' },
        query: { coin: 'BCH' }
      });
      should.exist(data);
      data[0].rate.should.equal(200);
    });

    it('should return error on invalid days', async () => {
      try {
        await server.externalServices.coinGecko.coinGeckoGetFiatRates({
          params: { code: 'USD' },
          query: { coin: 'BTC', days: 0 }
        });
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Invalid days');
      }
    });

    it('should return rates for all supported coins if missing coin', async () => {
      const data: any = await server.externalServices.coinGecko.coinGeckoGetFiatRates({
        params: { code: 'USD' },
        query: {}
      });
      should.exist(data);

      data.should.have.property('btc');
      data.should.have.property('bch');
      data.should.have.property('eth');
      data.should.have.property('pol');
      data.should.have.property('wbtc');
      data.should.have.property('weth');

      data.btc.should.deep.equal([
        { ts: 1, rate: 100 },
        { ts: 2, rate: 110 }
      ]);
      data.bch.should.deep.equal([
        { ts: 1, rate: 200 },
        { ts: 2, rate: 210 }
      ]);
    });
  });
});
