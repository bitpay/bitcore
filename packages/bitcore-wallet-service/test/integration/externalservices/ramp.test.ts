'use strict';

import * as chai from 'chai';
import crypto from 'crypto';
import 'chai/register-should';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';

const should = chai.should();
const { privateKey: privDer } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'der',
  },
});

// Separate secp256k1 keypair used to sign/verify webhook payloads (Ramp uses
// ECDSA + SHA-256 for webhooks, unlike the Ed25519 key used for widget URL signing above).
const { privateKey: rampWebhookPrivateKey, publicKey: rampWebhookPublicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'secp256k1',
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

/**
 * Deterministic JSON serialization equivalent to fast-json-stable-stringify,
 * mirroring the one used internally by ramp.ts to sign webhook bodies.
 */
function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(item => stableStringify(item === undefined ? null : item)).join(',')}]`;
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function signRampBody(body: any, privateKey: string): string {
  const message = Buffer.from(stableStringify(body), 'utf8');
  return crypto.sign('sha256', message, privateKey).toString('base64');
}

describe('Ramp integration', () => {
  let server;
  let wallet;
  let fakeRequest;
  let req;

  before(async () => {
    await helpers.before();
  });

  beforeEach(async () => {
    config.ramp = {
      sandbox: {
        apiKey: 'apiKey1',
        api: 'api1',
        widgetApi: 'widgetApi1',
        signingKey: privDer.toString('base64'),
      },
      production: {
        apiKey: 'apiKey2',
        api: 'api2',
        widgetApi: 'widgetApi2',
        signingKey: privDer.toString('base64'),
      },
      sandboxWeb: {
        apiKey: 'apiKey3',
        api: 'api3',
        widgetApi: 'widgetApi3',
        signingKey: privDer.toString('base64'),
      },
      productionWeb: {
        apiKey: 'apiKey4',
        api: 'api4',
        widgetApi: 'widgetApi4',
        signingKey: privDer.toString('base64'),
      }
    };

    fakeRequest = {
      get: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }); },
      post: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }); },
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

  describe('#rampGetQuote', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          cryptoAssetSymbol: 'BTC_BTC',
          fiatValue: 50,
          fiatCurrency: 'USD',
        }
      };
      server.externalServices.ramp.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.ramp.rampGetQuote(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.ramp.rampGetQuote(req);
      should.exist(data);
    });

    it('should return error if post returns error', async () => {
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.ramp.request = fakeRequest2;
      try {
        await server.externalServices.ramp.rampGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.fiatValue;
      try {
        await server.externalServices.ramp.rampGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Ramp\'s request missing arguments');
      }
    });

    it('should return error if ramp is commented in config', async () => {
      config.ramp = undefined;
      try {
        await server.externalServices.ramp.rampGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Ramp missing credentials');
      }
    });
  });

  describe('#rampGetSellQuote', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          cryptoAssetSymbol: 'BTC_BTC',
          cryptoAmount: '10000000',
          fiatCurrency: 'USD',
        }
      };
      server.externalServices.ramp.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.ramp.rampGetSellQuote(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.ramp.rampGetSellQuote(req);
      should.exist(data);
    });

    it('should return error if post returns error', async () => {
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.ramp.request = fakeRequest2;
      try {
        await server.externalServices.ramp.rampGetSellQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.cryptoAmount;
      try {
        await server.externalServices.ramp.rampGetSellQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Ramp\'s request missing arguments');
      }
    });

    it('should return error if ramp is commented in config', async () => {
      config.ramp = undefined;
      try {
        await server.externalServices.ramp.rampGetSellQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Ramp missing credentials');
      }
    });
  });

  describe('#rampGetSignedPaymentUrl', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'production',
          flow: 'buy',
          swapAsset: 'BTC_BTC',
          swapAmount: '1000000',
          enabledFlows: 'ONRAMP',
          defaultFlow: 'ONRAMP',
          userAddress: 'bitcoin:123123',
          selectedCountryCode: 'US',
          defaultAsset: 'BTC_BTC',
          finalUrl: 'bitpay://ramp',
        }
      };
      server.externalServices.ramp.request = fakeRequest;
    });

    // ONRAMP (buy) - legacy params sent by older app versions.
    // The service must translate them into Ramp's new unified search params:
    //   swapAsset    -> enabledCryptoAssets
    //   defaultAsset -> outAsset
    //   swapAmount   -> outAssetValue
    //   fiatCurrency -> inAsset
    //   fiatValue    -> inAssetValue
    it('should get the paymentUrl properly with legacy onramp params', () => {
      req.body = {
        env: 'production',
        flow: 'buy',
        swapAsset: 'BTC_BTC',
        swapAmount: '1000000',
        defaultAsset: 'BTC_BTC',
        fiatCurrency: 'USD',
        fiatValue: 50,
        enabledFlows: 'ONRAMP',
        defaultFlow: 'ONRAMP',
        userAddress: 'bitcoin:123123',
        selectedCountryCode: 'US',
        finalUrl: 'bitpay://ramp',
      };
      const data = server.externalServices.ramp.rampGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      const [base, qs] = data.urlWithSignature.split('?');

      base.should.equal('widgetApi2');

      const params = Object.fromEntries(new URLSearchParams(qs));
      params.hostApiKey.should.equal('apiKey2');
      params.selectedCountryCode.should.equal('US');
      params.finalUrl.should.equal('bitpay://ramp');
      params.userAddress.should.equal('bitcoin:123123');
      params.enabledFlows.should.equal('ONRAMP');
      params.defaultFlow.should.equal('ONRAMP');

      // legacy fields must be translated into the new unified params
      params.enabledCryptoAssets.should.equal('BTC_BTC');
      params.outAsset.should.equal('BTC_BTC');
      params.outAssetValue.should.equal('1000000');
      params.inAsset.should.equal('USD');
      params.inAssetValue.should.equal('50');

      // legacy fields must NOT be forwarded to Ramp
      should.not.exist(params.swapAsset);
      should.not.exist(params.swapAmount);
      should.not.exist(params.defaultAsset);
      should.not.exist(params.fiatCurrency);
      should.not.exist(params.fiatValue);

      // timestamp must exist and be numeric
      params.timestamp.should.match(/^\d+$/);

      // signature must exist and not be empty
      params.signature.should.be.a('string').and.not.equal('');
    });

    // ONRAMP (buy) - new unified params sent by newer app versions.
    // They must be forwarded as-is.
    it('should get the paymentUrl properly with new onramp params', () => {
      req.body = {
        env: 'production',
        flow: 'buy',
        enabledCryptoAssets: 'BTC_BTC',
        outAsset: 'BTC_BTC',
        outAssetValue: '1000000',
        inAsset: 'USD',
        inAssetValue: 50,
        enabledFlows: 'ONRAMP',
        defaultFlow: 'ONRAMP',
        userAddress: 'bitcoin:123123',
        selectedCountryCode: 'US',
        finalUrl: 'bitpay://ramp',
      };
      const data = server.externalServices.ramp.rampGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      const [base, qs] = data.urlWithSignature.split('?');

      base.should.equal('widgetApi2');

      const params = Object.fromEntries(new URLSearchParams(qs));
      params.hostApiKey.should.equal('apiKey2');
      params.selectedCountryCode.should.equal('US');
      params.finalUrl.should.equal('bitpay://ramp');
      params.userAddress.should.equal('bitcoin:123123');
      params.enabledFlows.should.equal('ONRAMP');
      params.defaultFlow.should.equal('ONRAMP');
      params.enabledCryptoAssets.should.equal('BTC_BTC');
      params.outAsset.should.equal('BTC_BTC');
      params.outAssetValue.should.equal('1000000');
      params.inAsset.should.equal('USD');
      params.inAssetValue.should.equal('50');

      // timestamp must exist and be numeric
      params.timestamp.should.match(/^\d+$/);

      // signature must exist and not be empty
      params.signature.should.be.a('string').and.not.equal('');
    });

    it('should get the paymentUrl properly if req is OK for web', () => {
      req.body = {
        env: 'production',
        context: 'web',
        swapAsset: 'BTC_BTC',
        userAddress: 'bitcoin:123123',
        selectedCountryCode: 'US',
        defaultAsset: 'BTC_BTC',
        finalUrl: 'bitpay://ramp',
      };
      const data = server.externalServices.ramp.rampGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      const [base, qs] = data.urlWithSignature.split('?');

      base.should.equal('widgetApi4');

      const params = Object.fromEntries(new URLSearchParams(qs));
      params.hostApiKey.should.equal('apiKey4');
      params.selectedCountryCode.should.equal('US');
      params.finalUrl.should.equal('bitpay://ramp');
      params.userAddress.should.equal('bitcoin:123123');
      params.enabledCryptoAssets.should.equal('BTC_BTC');
      params.outAsset.should.equal('BTC_BTC');

      // timestamp must exist and be numeric
      params.timestamp.should.match(/^\d+$/);

      // signature must exist and not be empty
      params.signature.should.be.a('string').and.not.equal('');
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.selectedCountryCode;
      try {
        server.externalServices.ramp.rampGetSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Ramp\'s request missing arguments');
      }
    });

    it('should return error if ramp is commented in config', () => {
      config.ramp = undefined;

      try {
        server.externalServices.ramp.rampGetSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Ramp missing credentials');
      }
    });

    // OFFRAMP (sell) - legacy params sent by older app versions.
    // The service must translate them into Ramp's new unified search params:
    //   offrampAsset -> enabledCryptoAssets
    //   defaultAsset -> inAsset
    //   swapAmount   -> inAssetValue
    //   fiatCurrency -> outAsset
    //   fiatValue    -> outAssetValue
    it('should get the sell paymentUrl properly with legacy offramp params', () => {
      req.body = {
        env: 'production',
        flow: 'sell',
        offrampAsset: 'BTC_BTC',
        swapAmount: '1000000',
        defaultAsset: 'BTC_BTC',
        fiatCurrency: 'USD',
        fiatValue: 50,
        enabledFlows: 'OFFRAMP',
        defaultFlow: 'OFFRAMP',
        selectedCountryCode: 'US',
        useSendCryptoCallback: true,
        hideExitButton: false,
      };
      const data = server.externalServices.ramp.rampGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      const [base, qs] = data.urlWithSignature.split('?');
      base.should.equal('widgetApi2');

      const params = Object.fromEntries(new URLSearchParams(qs));
      params.hostApiKey.should.equal('apiKey2');
      params.selectedCountryCode.should.equal('US');
      params.enabledFlows.should.equal('OFFRAMP');
      params.defaultFlow.should.equal('OFFRAMP');
      params.useSendCryptoCallback.should.equal('true');

      // legacy fields must be translated into the new unified params
      params.enabledCryptoAssets.should.equal('BTC_BTC');
      params.inAsset.should.equal('BTC_BTC');
      params.inAssetValue.should.equal('1000000');
      params.outAsset.should.equal('USD');
      params.outAssetValue.should.equal('50');

      // legacy fields must NOT be forwarded to Ramp
      should.not.exist(params.offrampAsset);
      should.not.exist(params.swapAmount);
      should.not.exist(params.defaultAsset);
      should.not.exist(params.fiatCurrency);
      should.not.exist(params.fiatValue);

      // timestamp must exist and be numeric
      params.timestamp.should.match(/^\d+$/);

      // signature must exist and not be empty
      params.signature.should.be.a('string').and.not.equal('');
    });

    // OFFRAMP (sell) - new unified params sent by newer app versions.
    it('should get the sell paymentUrl properly with new offramp params', () => {
      req.body = {
        env: 'production',
        flow: 'sell',
        enabledCryptoAssets: 'BTC_BTC',
        inAsset: 'BTC_BTC',
        inAssetValue: '1000000',
        outAsset: 'USD',
        outAssetValue: 50,
        enabledFlows: 'OFFRAMP',
        defaultFlow: 'OFFRAMP',
        selectedCountryCode: 'US',
        useSendCryptoCallback: true,
        hideExitButton: false,
      };
      const data = server.externalServices.ramp.rampGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      const [base, qs] = data.urlWithSignature.split('?');
      base.should.equal('widgetApi2');

      const params = Object.fromEntries(new URLSearchParams(qs));
      params.hostApiKey.should.equal('apiKey2');
      params.selectedCountryCode.should.equal('US');
      params.enabledFlows.should.equal('OFFRAMP');
      params.defaultFlow.should.equal('OFFRAMP');
      params.useSendCryptoCallback.should.equal('true');
      params.enabledCryptoAssets.should.equal('BTC_BTC');
      params.inAsset.should.equal('BTC_BTC');
      params.inAssetValue.should.equal('1000000');
      params.outAsset.should.equal('USD');
      params.outAssetValue.should.equal('50');

      // timestamp must exist and be numeric
      params.timestamp.should.match(/^\d+$/);

      // signature must exist and not be empty
      params.signature.should.be.a('string').and.not.equal('');
    });

    it('should get the sell paymentUrl properly if req is OK for web', () => {
      req.body = {
        env: 'production',
        flow: 'sell',
        context: 'web',
        offrampAsset: 'BTC_BTC',
        swapAmount: '1000000',
        defaultAsset: 'BTC_BTC',
        enabledFlows: 'OFFRAMP',
        defaultFlow: 'OFFRAMP',
        selectedCountryCode: 'US',
        useSendCryptoCallback: true,
        hideExitButton: false,
      };
      const data = server.externalServices.ramp.rampGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      const [base, qs] = data.urlWithSignature.split('?');
      base.should.equal('widgetApi4');

      const params = Object.fromEntries(new URLSearchParams(qs));
      params.hostApiKey.should.equal('apiKey4');
      params.selectedCountryCode.should.equal('US');
      params.enabledFlows.should.equal('OFFRAMP');
      params.defaultFlow.should.equal('OFFRAMP');
      params.useSendCryptoCallback.should.equal('true');
      params.enabledCryptoAssets.should.equal('BTC_BTC');
      params.inAsset.should.equal('BTC_BTC');
      params.inAssetValue.should.equal('1000000');

      // timestamp must exist and be numeric
      params.timestamp.should.match(/^\d+$/);

      // signature must exist and not be empty
      params.signature.should.be.a('string').and.not.equal('');
    });
  });

  describe('#rampGetAssets', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          currencyCode: 'USD',
        }
      };
      server.externalServices.ramp.request = fakeRequest;
    });

    it('should work properly if req is OK with currencyCode', async () => {
      const data = await server.externalServices.ramp.rampGetAssets(req);
      should.exist(data);
    });

    it('should work properly if req is OK with useIp', async () => {
      delete req.body.currencyCode;
      req.body.useIp = true;
      const data = await server.externalServices.ramp.rampGetAssets(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.ramp.request = fakeRequest2;
      try {
        await server.externalServices.ramp.rampGetAssets(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if Ramp is commented in config', async () => {
      config.ramp = undefined;
      try {
        await server.externalServices.ramp.rampGetAssets(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Ramp missing credentials');
      }
    });
  });

  describe('#rampGetSellTransactionDetails', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'production',
          id: 'id1',
          saleViewToken: 'saleViewToken1',
        }
      };
      server.externalServices.ramp.request = fakeRequest;
    });

    it('should work properly if req is OK with currencyCode', async () => {
      const data = await server.externalServices.ramp.rampGetSellTransactionDetails(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.ramp.request = fakeRequest2;
      try {
        await server.externalServices.ramp.rampGetSellTransactionDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if Ramp is commented in config', async () => {
      config.ramp = undefined;

      try {
        await server.externalServices.ramp.rampGetSellTransactionDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Ramp missing credentials');
      }
    });
  });

  describe('#rampHandleWebhook', () => {
    beforeEach(() => {
      config.ramp.production.webhookSigningKey = rampWebhookPublicKey;
      config.ramp.sandbox.webhookSigningKey = rampWebhookPublicKey;
    });

    it('should verify and parse a valid buy (purchase) webhook payload', () => {
      const body = {
        type: 'RELEASED',
        purchase: {
          id: 'purchase1',
          status: 'RELEASED',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:05:00.000Z',
          fiatValue: 100,
          fiatCurrency: 'USD',
          cryptoAmount: '2000000',
          asset: { symbol: 'BTC' },
          paymentMethodType: 'CARD',
          receiverAddress: 'bc1qxyz'
        }
      };
      const signature = signRampBody(body, rampWebhookPrivateKey);
      req = { headers: { 'x-body-signature': signature }, query: { userId: 'user1' }, body };
      const { event } = server.externalServices.ramp.rampHandleWebhook(req);
      event.partner.should.equal('ramp');
      event.externalId.should.equal('purchase1');
      event.status.should.equal('RELEASED');
      event.eventName.should.equal('RELEASED');
      event.updatedAt.should.equal('2024-01-01T00:05:00.000Z');
      event.deliveryVersion.should.equal('2024-01-01T00:05:00.000Z');
      event.fiatAmount.should.equal(100);
      event.fiatCurrency.should.equal('USD');
      event.cryptoAmount.should.equal(2000000);
      event.cryptoCurrency.should.equal('BTC');
      event.paymentMethod.should.equal('CARD');
      event.walletAddress.should.equal('bc1qxyz');
      event.userId.should.equal('user1');
      event.env.should.equal('production');
    });

    it('should verify and parse a valid sell (offramp) webhook payload', () => {
      const body = {
        type: 'RELEASED',
        mode: 'OFFRAMP',
        payload: {
          id: 'sale1',
          status: 'RELEASED',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:05:00.000Z',
          fiat: { amount: 100, currencySymbol: 'USD', payoutMethod: 'BANK_TRANSFER' },
          crypto: { amount: 0.002, assetInfo: { symbol: 'BTC' } },
          receiverAddress: 'bc1qxyz'
        }
      };
      const signature = signRampBody(body, rampWebhookPrivateKey);
      req = { headers: { 'x-body-signature': signature }, query: {}, body };
      const { event } = server.externalServices.ramp.rampHandleWebhook(req);
      event.externalId.should.equal('sale1');
      event.fiatAmount.should.equal(100);
      event.fiatCurrency.should.equal('USD');
      event.cryptoAmount.should.equal(0.002);
      event.cryptoCurrency.should.equal('BTC');
      event.paymentMethod.should.equal('BANK_TRANSFER');
      should.not.exist(event.userId);
    });

    it('should throw if the signature does not match', () => {
      const body = { type: 'RELEASED', purchase: { id: 'purchase1' } };
      const { privateKey: otherKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      const signature = signRampBody(body, otherKey);
      req = { headers: { 'x-body-signature': signature }, query: {}, body };
      try {
        server.externalServices.ramp.rampHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Ramp webhook signature verification failed');
      }
    });

    it('should throw if the X-Body-Signature header is missing', () => {
      req = { headers: {}, query: {}, body: { type: 'RELEASED', purchase: { id: 'purchase1' } } };
      try {
        server.externalServices.ramp.rampHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Ramp webhook missing X-Body-Signature header');
      }
    });

    it('should return error if ramp is commented in config', () => {
      config.ramp = undefined;
      req = { headers: {}, query: {}, body: {} };
      try {
        server.externalServices.ramp.rampHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Ramp missing credentials');
      }
    });
  });
});