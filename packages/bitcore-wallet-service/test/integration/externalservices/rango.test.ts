'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';

const should = chai.should();

/**
 * These assert on the URL the service builds rather than on the response,
 * because the things worth protecting here are all decisions about what we
 * send: that the API key stays server-side, that values are encoded, that a
 * client cannot redirect the referrer fee, and that the public metadata route
 * cannot be made to pull the full multi-megabyte payload.
 */
describe('Rango integration', () => {
  let server;
  let wallet;
  let fakeRequest;
  let req;
  /** URLs the service asked for, in order. */
  let requested: string[];

  const queryOf = (url: string) =>
    Object.fromEntries(new URL(url).searchParams.entries());

  before(async () => {
    await helpers.before();
  });

  beforeEach(async () => {
    config.suspendedChains = [];
    config.rango = {
      sandbox: {
        api: 'https://rango-sandbox.example',
        apiKey: 'rangoApiKey1',
        referrerAddress: '0xbitpaySandbox',
        referrerFee: '0.1'
      },
      production: {
        api: 'https://rango-production.example',
        apiKey: 'rangoApiKey2',
        referrerAddress: '0xbitpayProduction',
        referrerFee: '0.2'
      }
    };

    requested = [];
    fakeRequest = {
      get: (_url, _opts, _cb) => {
        requested.push(_url);
        return _cb(null, { body: { resultType: 'OK' } });
      },
      post: (_url, _opts, _cb) => {
        requested.push(_url);
        return _cb(null, { body: { ok: true } });
      }
    };

    await helpers.beforeEach();
    ({ wallet } = await helpers.createAndJoinWallet(1, 1));
    const priv = TestData.copayers[0].privKey_1H_0;
    const sig = helpers.signMessage('hello world', priv);

    (server = await util.promisify(WalletService.getInstanceWithAuth).call(WalletService, {
      copayerId: wallet.copayers[0].id,
      message: 'hello world',
      signature: sig,
      clientVersion: 'bwc-2.0.0',
      walletId: '123',
    }));

    server.externalServices.rango.request = fakeRequest;
  });

  after(async () => {
    await helpers.after();
  });

  describe('credentials', () => {
    beforeEach(() => {
      req = { headers: {}, body: { env: 'sandbox' } };
    });

    /**
     * Environment selection is tested through an authenticated route. The two
     * public metadata routes deliberately ignore `env` - see the
     * 'public metadata routes' block below.
     */
    const authedReq = (env: string) => ({
      headers: {},
      body: {
        env,
        from: 'BTC.BTC',
        to: 'ETH.ETH',
        amount: '100000'
      }
    });

    it('should use the key for the requested environment', async () => {
      await server.externalServices.rango.rangoGetSwapQuote(authedReq('sandbox'));
      queryOf(requested[0]).apiKey.should.equal('rangoApiKey1');
      requested[0].should.contain('rango-sandbox.example');
    });

    it('should use production credentials when asked', async () => {
      await server.externalServices.rango.rangoGetSwapQuote(authedReq('production'));
      queryOf(requested[0]).apiKey.should.equal('rangoApiKey2');
      requested[0].should.contain('rango-production.example');
    });

    it('should never return the api key to the caller', async () => {
      const data = await server.externalServices.rango.rangoGetSupportedChains(req);
      JSON.stringify(data).should.not.contain('rangoApiKey');
    });

    it('should error if Rango is commented out in config', async () => {
      config.rango = undefined;
      try {
        await server.externalServices.rango.rangoGetSupportedChains(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Rango missing credentials');
      }
    });

    it('should error cleanly if the requested environment is not configured', async () => {
      delete config.rango.sandbox;
      try {
        await server.externalServices.rango.rangoGetSupportedChains(req);
        should.fail('should have thrown');
      } catch (err) {
        // A ClientError rather than a TypeError reading .api of undefined.
        err.message.should.contain('not configured for the sandbox');
      }
    });
  });

  describe('#rangoGetCryptoCurrencies — public route hardening', () => {
    beforeEach(() => {
      req = { headers: {}, body: { env: 'sandbox' } };
    });

    it('should pin the chain list rather than take it from the request', async () => {
      req.body.blockchains = 'ETH';
      await server.externalServices.rango.rangoGetCryptoCurrencies(req);

      const qs = queryOf(requested[0]);
      // Unfiltered this response is ~13MB, and the route is unauthenticated.
      qs.blockchains.should.contain('BTC');
      qs.blockchains.should.contain('SOLANA');
      qs.blockchains.split(',').length.should.be.above(1);
    });

    it('should not let a caller turn off excludeNonPopulars', async () => {
      req.body.excludeNonPopulars = false;
      await server.externalServices.rango.rangoGetCryptoCurrencies(req);
      queryOf(requested[0]).excludeNonPopulars.should.equal('true');
    });

    it('should not forward arbitrary swapper filters', async () => {
      req.body.swappers = 'SomeSwapper';
      await server.externalServices.rango.rangoGetCryptoCurrencies(req);
      should.not.exist(queryOf(requested[0]).swappers);
    });
  });

  describe('public metadata routes', () => {
    beforeEach(() => {
      req = { headers: {}, body: {} };
    });

    it('should ignore a client asking for the production environment', async () => {
      // Unauthenticated callers must not be able to spend the production
      // key's quota - it is the one credential we cannot cheaply rotate.
      req.body.env = 'production';
      await server.externalServices.rango.rangoGetCryptoCurrencies(req);
      queryOf(requested[0]).apiKey.should.equal('rangoApiKey1');
      requested[0].should.contain('rango-sandbox.example');
    });

    it('should pin the environment on the chains route too', async () => {
      req.body.env = 'production';
      await server.externalServices.rango.rangoGetSupportedChains(req);
      queryOf(requested[0]).apiKey.should.equal('rangoApiKey1');
    });
  });

  describe('upstream timeout', () => {
    it('should bound every outbound request', async () => {
      // A Rango endpoint that accepts the connection but never answers would
      // otherwise hold the socket open indefinitely, and the app's pollers
      // only check their deadline between requests.
      let opts;
      server.externalServices.rango.request = {
        get: (_url, _opts, _cb) => {
          opts = _opts;
          return _cb(null, { body: { resultType: 'OK' } });
        }
      };
      req = { headers: {}, body: { env: 'sandbox' } };

      await server.externalServices.rango.rangoGetSupportedChains(req);
      should.exist(opts.timeout);
      opts.timeout.should.be.above(0);
    });
  });

  describe('referrer fee', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          from: 'BTC.BTC',
          to: 'ETH.ETH',
          amount: '100000',
          fromAddress: 'bc1qsender',
          toAddress: '0xrecipient'
        }
      };
    });

    it('should ignore a client-supplied referrer address', async () => {
      req.body.referrerAddress = '0xattacker';
      await server.externalServices.rango.rangoCreateSwapTx(req);

      const qs = queryOf(requested[0]);
      qs.referrerAddress.should.equal('0xbitpaySandbox');
      requested[0].should.not.contain('0xattacker');
    });

    it('should ignore a client-supplied referrer fee', async () => {
      req.body.referrerFee = '0';
      await server.externalServices.rango.rangoCreateSwapTx(req);
      queryOf(requested[0]).referrerFee.should.equal('0.1');
    });

    it('should send the same fee on quote and swap', async () => {
      await server.externalServices.rango.rangoGetSwapQuote(req);
      await server.externalServices.rango.rangoCreateSwapTx(req);

      const quoteFee = queryOf(requested[0]).referrerFee;
      const swapFee = queryOf(requested[1]).referrerFee;
      // If these diverge the user is quoted an output the swap will not pay.
      quoteFee.should.equal(swapFee);
    });

    it('should omit the fee entirely when no referrer address is configured', async () => {
      delete config.rango.sandbox.referrerAddress;
      await server.externalServices.rango.rangoCreateSwapTx(req);

      const qs = queryOf(requested[0]);
      should.not.exist(qs.referrerFee);
      should.not.exist(qs.referrerAddress);
    });

    it('should reject a configured fee above the 3 percent cap', async () => {
      config.rango.sandbox.referrerFee = '5';
      try {
        await server.externalServices.rango.rangoCreateSwapTx(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.contain('between 0 and 3');
      }
    });
  });

  describe('query encoding', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          from: 'BTC.BTC',
          to: 'ETH.ETH',
          amount: '100000',
          fromAddress: 'bc1qsender',
          toAddress: '0xrecipient'
        }
      };
    });

    it('should not let a # in an asset truncate the query', async () => {
      // Unencoded this becomes a fragment and everything after it, including
      // the apiKey, is dropped — Rango then answers 401.
      req.body.to = 'ETH.FOO#bar';
      await server.externalServices.rango.rangoGetSwapQuote(req);

      const qs = queryOf(requested[0]);
      qs.to.should.equal('ETH.FOO#bar');
      should.exist(qs.apiKey);
    });

    it('should not let an & in an asset inject a parameter', async () => {
      req.body.to = 'ETH.FOO&referrerAddress=0xattacker';
      await server.externalServices.rango.rangoCreateSwapTx(req);

      const qs = queryOf(requested[0]);
      qs.referrerAddress.should.equal('0xbitpaySandbox');
      qs.to.should.equal('ETH.FOO&referrerAddress=0xattacker');
    });

    it('should survive a non-ascii token symbol', async () => {
      // Rango already lists OPTIMISM.USD₮0 on a chain we support.
      req.body.to = 'OPTIMISM.USD₮0';
      await server.externalServices.rango.rangoGetSwapQuote(req);
      queryOf(requested[0]).to.should.equal('OPTIMISM.USD₮0');
    });

    it('should preserve the token separator in an asset id', async () => {
      req.body.to = 'ETH.USDC--0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
      await server.externalServices.rango.rangoGetSwapQuote(req);
      queryOf(requested[0]).to.should.equal(
        'ETH.USDC--0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
      );
    });
  });

  describe('required arguments', () => {
    beforeEach(() => {
      req = { headers: {}, body: { env: 'sandbox' } };
    });

    it('should reject a quote with no assets', async () => {
      try {
        await server.externalServices.rango.rangoGetSwapQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.contain('missing arguments');
      }
    });

    it('should reject a swap with no addresses', async () => {
      req.body = { env: 'sandbox', from: 'BTC.BTC', to: 'ETH.ETH', amount: '1' };
      try {
        await server.externalServices.rango.rangoCreateSwapTx(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.contain('missing arguments');
      }
    });

    it('should reject a status check with no requestId', async () => {
      req.body.txId = '0xabc';
      try {
        await server.externalServices.rango.rangoGetStatus(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.contain('missing arguments');
      }
    });
  });

  describe('error propagation', () => {
    it('should surface a transport error', async () => {
      server.externalServices.rango.request = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error')); }
      };
      req = { headers: {}, body: { env: 'sandbox' } };

      try {
        await server.externalServices.rango.rangoGetSupportedChains(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should pass a 200-with-error body through untouched', async () => {
      // Rango reports business failures as HTTP 200 with an error field, so
      // the service must not treat them as success or as transport errors —
      // the app decides via resultType.
      server.externalServices.rango.request = {
        get: (_url, _opts, _cb) =>
          _cb(null, { body: { resultType: 'NO_ROUTE', error: 'No route available' } })
      };
      req = { headers: {}, body: { env: 'sandbox' } };

      const data = await server.externalServices.rango.rangoGetSupportedChains(req);
      data.resultType.should.equal('NO_ROUTE');
      data.error.should.equal('No route available');
    });
  });
});
