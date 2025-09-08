'use strict';

const chai = require('chai');
const should = chai.should();
const { WalletService } = require('../../ts_build/lib/server');
const TestData = require('../testdata');
const helpers = require('./helpers');

let config = require('../../ts_build/config.js').default;
let server, wallet, fakeRequest, req;

describe('CoinGecko integration', function() {
  this.timeout(5000);
  
  before((done) => {
    helpers.before((res) => {
      done();
    });
  });
  beforeEach((done) => {

    config.coinGecko = {
      api: 'xxxx',
    }

    fakeRequest = {
      get: (_url, _opts, _cb) => { return _cb(null,  { body: {tokens: [{
        chainId: 1,
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        logoURI: "xxxxxx"
      }]}}) },
    };

    helpers.beforeEach((res) => {
      helpers.createAndJoinWallet(1, 1, (s, w) => {
        wallet = w;
        const priv = TestData.copayers[0].privKey_1H_0;
        const sig = helpers.signMessage('hello world', priv);
  
        WalletService.getInstanceWithAuth({
          // test assumes wallet's copayer[0] is TestData's copayer[0]
          copayerId: wallet.copayers[0].id,
          message: 'hello world',
          signature: sig,
          clientVersion: 'bwc-2.0.0',
          walletId: '123',
        }, (err, s) => {
          should.not.exist(err);
          server = s;
          done();
        });
      });
    });
  });
  after((done) => {
    helpers.after(done);
  });

  describe('#coinGeckoGetTokenData', () => {
    beforeEach(() => {
      server.externalServices.coinGecko.request = fakeRequest;
    });
    
    it('should get coinGecko list of tokens data', () => {
      server.externalServices.coinGecko.coinGeckoGetTokens({}).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if coinGecko is commented in config', () => {
      config.coinGecko = undefined;
      server.externalServices.coinGecko.coinGeckoGetTokens({}).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('coinGecko missing credentials');
      });
    });
  });
});