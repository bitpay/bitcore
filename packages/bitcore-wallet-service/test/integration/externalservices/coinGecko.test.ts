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
});