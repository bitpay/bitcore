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

    it('should get the paymentUrl properly if req is OK', () => {
      const data = server.externalServices.ramp.rampGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      const [base, qs] = data.urlWithSignature.split('?');

      base.should.equal('widgetApi2');

      const params = Object.fromEntries(new URLSearchParams(qs));
      params.hostApiKey.should.equal('apiKey2');
      params.selectedCountryCode.should.equal('US');
      params.finalUrl.should.equal('bitpay://ramp');
      params.userAddress.should.equal('bitcoin:123123');
      params.swapAsset.should.equal('BTC_BTC');
      params.enabledFlows.should.equal('ONRAMP');
      params.defaultFlow.should.equal('ONRAMP');
      params.swapAmount.should.equal('1000000');
      params.defaultAsset.should.equal('BTC_BTC');

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
      params.swapAsset.should.equal('BTC_BTC');
      params.defaultAsset.should.equal('BTC_BTC');

      // timestamp must exist and be numeric
      params.timestamp.should.match(/^\d+$/);

      // signature must exist and not be empty
      params.signature.should.be.a('string').and.not.equal('');
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.defaultAsset;
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

    it('should get the sell paymentUrl properly if req is OK', () => {
      req.body = {
        env: 'production',
        flow: 'sell',
        offrampAsset: 'BTC_BTC',
        swapAmount: '1000000',
        enabledFlows: 'OFFRAMP',
        defaultFlow: 'OFFRAMP',
        selectedCountryCode: 'US',
        defaultAsset: 'BTC_BTC',
        variant: 'webview-mobile',
        useSendCryptoCallback: true,
        useSendCryptoCallbackVersion: 1,
        hideExitButton: false,
      };
      const data = server.externalServices.ramp.rampGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      const [base, qs] = data.urlWithSignature.split('?');
      base.should.equal('widgetApi2');

      const params = Object.fromEntries(new URLSearchParams(qs));
      params.hostApiKey.should.equal('apiKey2');
      params.selectedCountryCode.should.equal('US');
      params.offrampAsset.should.equal('BTC_BTC');
      params.enabledFlows.should.equal('OFFRAMP');
      params.defaultFlow.should.equal('OFFRAMP');
      params.swapAmount.should.equal('1000000');
      params.defaultAsset.should.equal('BTC_BTC');
      params.useSendCryptoCallback.should.equal('true');
      params.variant.should.equal('webview-mobile');
      params.useSendCryptoCallbackVersion.should.equal('1');

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
        enabledFlows: 'OFFRAMP',
        defaultFlow: 'OFFRAMP',
        selectedCountryCode: 'US',
        defaultAsset: 'BTC_BTC',
        variant: 'webview-mobile',
        useSendCryptoCallback: true,
        useSendCryptoCallbackVersion: 1,
        hideExitButton: false,
      };
      const data = server.externalServices.ramp.rampGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      const [base, qs] = data.urlWithSignature.split('?');
      base.should.equal('widgetApi4');

      const params = Object.fromEntries(new URLSearchParams(qs));
      params.hostApiKey.should.equal('apiKey4');
      params.selectedCountryCode.should.equal('US');
      params.offrampAsset.should.equal('BTC_BTC');
      params.enabledFlows.should.equal('OFFRAMP');
      params.defaultFlow.should.equal('OFFRAMP');
      params.swapAmount.should.equal('1000000');
      params.defaultAsset.should.equal('BTC_BTC');
      params.useSendCryptoCallback.should.equal('true');
      params.variant.should.equal('webview-mobile');
      params.useSendCryptoCallbackVersion.should.equal('1');

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
});