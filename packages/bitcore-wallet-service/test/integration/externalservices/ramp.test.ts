'use strict';

import chai from 'chai';
import 'chai/register-should';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';

const should = chai.should();

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
      },
      production: {
        apiKey: 'apiKey2',
        api: 'api2',
        widgetApi: 'widgetApi2',
      },
      sandboxWeb: {
        apiKey: 'apiKey3',
        api: 'api3',
        widgetApi: 'widgetApi3',
      },
      productionWeb: {
        apiKey: 'apiKey4',
        api: 'api4',
        widgetApi: 'widgetApi4',
      }
    }

    fakeRequest = {
      get: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }) },
      post: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }) },
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
      }
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
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
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
      }
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
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
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
      }
      server.externalServices.ramp.request = fakeRequest;
    });

    it('should get the paymentUrl properly if req is OK', () => {
      const data = server.externalServices.ramp.rampGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      data.urlWithSignature.should.equal('widgetApi2?hostApiKey=apiKey2&selectedCountryCode=US&finalUrl=bitpay%3A%2F%2Framp&userAddress=bitcoin%3A123123&swapAsset=BTC_BTC&enabledFlows=ONRAMP&defaultFlow=ONRAMP&swapAmount=1000000&defaultAsset=BTC_BTC');
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
      }
      const data = server.externalServices.ramp.rampGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      data.urlWithSignature.should.equal('widgetApi4?hostApiKey=apiKey4&selectedCountryCode=US&finalUrl=bitpay%3A%2F%2Framp&userAddress=bitcoin%3A123123&swapAsset=BTC_BTC&defaultAsset=BTC_BTC');
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
      }
      const data = server.externalServices.ramp.rampGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      data.urlWithSignature.should.equal('widgetApi2?hostApiKey=apiKey2&selectedCountryCode=US&offrampAsset=BTC_BTC&enabledFlows=OFFRAMP&defaultFlow=OFFRAMP&swapAmount=1000000&defaultAsset=BTC_BTC&useSendCryptoCallback=true&variant=webview-mobile&useSendCryptoCallbackVersion=1');
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
      }
      const data = server.externalServices.ramp.rampGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      data.urlWithSignature.should.equal('widgetApi4?hostApiKey=apiKey4&selectedCountryCode=US&offrampAsset=BTC_BTC&enabledFlows=OFFRAMP&defaultFlow=OFFRAMP&swapAmount=1000000&defaultAsset=BTC_BTC&useSendCryptoCallback=true&variant=webview-mobile&useSendCryptoCallbackVersion=1');
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
      }
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
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
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
      }
      server.externalServices.ramp.request = fakeRequest;
    });

    it('should work properly if req is OK with currencyCode', async () => {
      const data = await server.externalServices.ramp.rampGetSellTransactionDetails(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
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