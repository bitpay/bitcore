'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import util from 'util';
import sinon from 'sinon';
import Moralis from 'moralis';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import config from '../../../src/config';
import helpers from '../helpers';

const should = chai.should();

describe('Moralis integration', () => {
  let server;
  let wallet;
  let fakeRequest;
  let lastGet;
  let lastPost;
  let req;

  before(async function() {
    await helpers.before();
  });

  beforeEach(async function() {
    config.moralis = {
      apiKey: 'moralisApiKey1',
      whitelist: []
    };

    lastGet = null;
    lastPost = null;
    fakeRequest = {
      get: (_url, _opts, _cb) => {
        lastGet = { url: _url, opts: _opts };
        return _cb(null, { statusCode: 200, body: { result: [] } });
      },
      post: (_url, _opts, _cb) => {
        lastPost = { url: _url, opts: _opts };
        return _cb(null, { statusCode: 200, body: [{ tokenAddress: 'addr1', usdPrice: 1 }] });
      },
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
      walletId: '123',
    });
    server.request = fakeRequest;
  });

  afterEach(() => {
    sinon.restore();
  });

  after(async function() {
    await helpers.after();
  });

  describe('#moralisGetWalletTokenBalances', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          address: '0xabc',
          chain: '0x1',
          toBlock: 100,
          tokenAddresses: ['0xtoken1'],
          excludeSpam: true,
        }
      };
    });

    it('should resolve response.raw and pass through the request params', async () => {
      const stub = sinon.stub(Moralis.EvmApi.token, 'getWalletTokenBalances')
        .resolves({ raw: [{ token_address: '0xtoken1', balance: '100' }] });

      const data = await server.moralisGetWalletTokenBalances(req);

      data.should.deep.equal([{ token_address: '0xtoken1', balance: '100' }]);
      stub.getCall(0).args[0].should.deep.equal({
        address: '0xabc',
        chain: '0x1',
        toBlock: 100,
        tokenAddresses: ['0xtoken1'],
        excludeSpam: true,
      });
    });

    it('should reject if the SDK call fails', async () => {
      sinon.stub(Moralis.EvmApi.token, 'getWalletTokenBalances').rejects(new Error('sdk error'));

      try {
        await server.moralisGetWalletTokenBalances(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('sdk error');
      }
    });
  });

  describe('#moralisGetTokenAllowance', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          ownerAddress: '0xowner',
        }
      };
    });

    it('should call the approvals endpoint with server-side credentials using ownerAddress', async () => {
      const data = await server.moralisGetTokenAllowance(req);
      should.exist(data);
      lastGet.url.should.equal('https://deep-index.moralis.io/api/v2.2/wallets/0xowner/approvals');
      lastGet.opts.headers['X-Api-Key'].should.equal('moralisApiKey1');
    });

    it('should fall back to address when ownerAddress is not provided', async () => {
      req.body = { address: '0xaddr' };
      await server.moralisGetTokenAllowance(req);
      lastGet.url.should.equal('https://deep-index.moralis.io/api/v2.2/wallets/0xaddr/approvals');
    });

    it('should reject if neither ownerAddress nor address is provided', async () => {
      req.body = {};
      try {
        await server.moralisGetTokenAllowance(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.contain('request missing arguments');
        should.not.exist(lastGet);
      }
    });

    it('should convert a numeric chain to hex in the query string', async () => {
      req.body.chain = 1;
      await server.moralisGetTokenAllowance(req);
      lastGet.url.should.contain('chain=0x1');
    });

    it('should apply the legacy spender/allowance workaround when spenderAddress and ownerAddress are given', async () => {
      req.body = {
        ownerAddress: '0xowner',
        address: '0xtoken',
        spenderAddress: '0xSPENDER',
      };
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => {
          return _cb(null, {
            statusCode: 200,
            body: {
              result: [
                {
                  spender: { address: '0xspender' },
                  token: { address: '0xtoken' },
                  value: '42',
                },
              ],
            },
          });
        },
      };
      server.request = fakeRequest2;

      const data = await server.moralisGetTokenAllowance(req);
      data.should.deep.equal({ allowance: '42' });
    });

    it('should default the allowance to 0 when no matching spender is found', async () => {
      req.body = {
        ownerAddress: '0xowner',
        address: '0xtoken',
        spenderAddress: '0xnotfound',
      };
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => {
          return _cb(null, { statusCode: 200, body: { result: [] } });
        },
      };
      server.request = fakeRequest2;

      const data = await server.moralisGetTokenAllowance(req);
      data.should.deep.equal({ allowance: '0' });
    });

    it('should return error if moralis is commented in config', async () => {
      config.moralis = undefined;
      try {
        await server.moralisGetTokenAllowance(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moralis missing credentials');
        should.not.exist(lastGet);
      }
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };
      server.request = fakeRequest2;

      try {
        await server.moralisGetTokenAllowance(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });
  });

  describe('#moralisGetNativeBalance', () => {
    it('should resolve response.raw and pass through the request params', async () => {
      req = { headers: {}, body: { address: '0xabc', chain: '0x1', toBlock: 100 } };
      const stub = sinon.stub(Moralis.EvmApi.balance, 'getNativeBalance')
        .resolves({ raw: { balance: '1000000000000000000' } });

      const data = await server.moralisGetNativeBalance(req);

      data.should.deep.equal({ balance: '1000000000000000000' });
      stub.getCall(0).args[0].should.deep.equal({ address: '0xabc', chain: '0x1', toBlock: 100 });
    });
  });

  describe('#moralisGetTokenPrice', () => {
    it('should resolve response.raw and pass through the request params', async () => {
      req = {
        headers: {},
        body: { address: '0xabc', chain: '0x1', include: 'percent_change', exchange: 'uniswapv2', toBlock: 100 }
      };
      const stub = sinon.stub(Moralis.EvmApi.token, 'getTokenPrice')
        .resolves({ raw: { usdPrice: 5 } });

      const data = await server.moralisGetTokenPrice(req);

      data.should.deep.equal({ usdPrice: 5 });
      stub.getCall(0).args[0].should.deep.equal({
        address: '0xabc',
        chain: '0x1',
        include: 'percent_change',
        exchange: 'uniswapv2',
        toBlock: 100,
      });
    });
  });

  describe('#moralisGetMultipleERC20TokenPrices', () => {
    it('should resolve response.raw and call the SDK with (params, body)', async () => {
      req = {
        headers: {},
        body: {
          chain: '0x1',
          include: 'percent_change',
          tokens: [{ tokenAddress: '0xaaa' }, { tokenAddress: '0xbbb' }],
        }
      };
      const stub = sinon.stub(Moralis.EvmApi.token, 'getMultipleTokenPrices')
        .resolves({ raw: [{ tokenAddress: '0xaaa', usdPrice: 1 }] });

      const data = await server.moralisGetMultipleERC20TokenPrices(req);

      data.should.deep.equal([{ tokenAddress: '0xaaa', usdPrice: 1 }]);
      stub.getCall(0).args[0].should.deep.equal({ chain: '0x1', include: 'percent_change' });
      stub.getCall(0).args[1].should.deep.equal({ tokens: req.body.tokens });
    });
  });

  describe('#moralisGetERC20TokenBalancesWithPricesByWallet', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: { address: '0xabc' }
      };
    });

    it('should call the tokens endpoint with server-side credentials', async () => {
      const data = await server.moralisGetERC20TokenBalancesWithPricesByWallet(req);
      should.exist(data);
      lastGet.url.should.equal('https://deep-index.moralis.io/api/v2.2/wallets/0xabc/tokens');
      lastGet.opts.headers['X-Api-Key'].should.equal('moralisApiKey1');
    });

    it('should include all optional query params when provided', async () => {
      req.body = {
        address: '0xabc',
        chain: '0x1',
        toBlock: 100,
        tokenAddresses: '0xtoken1',
        excludeSpam: true,
        cursor: 'abc',
        limit: 10,
        excludeNative: true,
      };
      await server.moralisGetERC20TokenBalancesWithPricesByWallet(req);

      lastGet.url.should.contain('chain=0x1');
      lastGet.url.should.contain('to_block=100');
      lastGet.url.should.contain('token_addresses=0xtoken1');
      lastGet.url.should.contain('exclude_spam=true');
      lastGet.url.should.contain('cursor=abc');
      lastGet.url.should.contain('limit=10');
      lastGet.url.should.contain('exclude_native=true');
    });

    it('should reject if address is missing', async () => {
      req.body = {};
      try {
        await server.moralisGetERC20TokenBalancesWithPricesByWallet(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.contain('request missing arguments');
        should.not.exist(lastGet);
      }
    });

    it('should return error if moralis is commented in config', async () => {
      config.moralis = undefined;
      try {
        await server.moralisGetERC20TokenBalancesWithPricesByWallet(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moralis missing credentials');
        should.not.exist(lastGet);
      }
    });
  });

  describe('#moralisGetTransactionVerbose', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: { transactionHash: '0xhash', chain: '0x89' }
      };
    });

    it('should resolve response.raw and pass through the request params', async () => {
      const stub = sinon.stub(Moralis.EvmApi.transaction, 'getTransactionVerbose')
        .resolves({ raw: { hash: '0xhash', logs: [] } });

      const data = await server.moralisGetTransactionVerbose(req);

      data.should.deep.equal({ hash: '0xhash', logs: [] });
      stub.getCall(0).args[0].should.deep.equal({ transactionHash: '0xhash', chain: '0x89' });
    });

    it('should reject if the SDK call fails', async () => {
      sinon.stub(Moralis.EvmApi.transaction, 'getTransactionVerbose').rejects(new Error('sdk error'));

      try {
        await server.moralisGetTransactionVerbose(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('sdk error');
      }
    });

    it('should resolve null when the SDK finds no matching transaction', async () => {
      sinon.stub(Moralis.EvmApi.transaction, 'getTransactionVerbose').resolves(null);

      const data = await server.moralisGetTransactionVerbose(req);
      should.equal(data, null);
    });
  });

  describe('#moralisGetSolWalletPortfolio', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: { address: 'solWalletAddress' }
      };
    });

    it('should resolve response.raw and default to mainnet', async () => {
      const stub = sinon.stub(Moralis.SolApi.account, 'getPortfolio')
        .resolves({ raw: { tokens: [] } });

      const data = await server.moralisGetSolWalletPortfolio(req);

      data.should.deep.equal({ tokens: [] });
      stub.getCall(0).args[0].should.deep.equal({ address: 'solWalletAddress', network: 'mainnet' });
    });

    it('should prefer network over chain when both are provided', async () => {
      const stub = sinon.stub(Moralis.SolApi.account, 'getPortfolio').resolves({ raw: {} });
      req.body.network = 'testnet';
      req.body.chain = 'devnet';

      await server.moralisGetSolWalletPortfolio(req);
      stub.getCall(0).args[0].network.should.equal('testnet');
    });

    it('should map hex-encoded and numeric chain ids to the matching network', async () => {
      const stub = sinon.stub(Moralis.SolApi.account, 'getPortfolio').resolves({ raw: {} });

      req.body.chain = '0x66';
      await server.moralisGetSolWalletPortfolio(req);
      stub.getCall(0).args[0].network.should.equal('testnet');

      req.body.chain = undefined;
      req.body.network = 101; // 0x65
      await server.moralisGetSolWalletPortfolio(req);
      stub.getCall(1).args[0].network.should.equal('devnet');
    });
  });

  describe('#moralisGetMultipleSolTokenPrices', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          addresses: ['So11111111111111111111111111111111111111112'],
        }
      };
    });

    it('should call the solana gateway prices endpoint with server-side credentials', async () => {
      const data = await server.moralisGetMultipleSolTokenPrices(req);
      should.exist(data);
      lastPost.url.should.equal('https://solana-gateway.moralis.io/token/mainnet/prices');
      lastPost.opts.headers['X-Api-Key'].should.equal('moralisApiKey1');
      lastPost.opts.body.addresses.should.deep.equal(req.body.addresses);
    });

    it('should only use the devnet network when explicitly requested, defaulting to mainnet otherwise', async () => {
      req.body.network = 'devnet';
      await server.moralisGetMultipleSolTokenPrices(req);
      lastPost.url.should.equal('https://solana-gateway.moralis.io/token/devnet/prices');

      req.body.network = 'whatever';
      await server.moralisGetMultipleSolTokenPrices(req);
      lastPost.url.should.equal('https://solana-gateway.moralis.io/token/mainnet/prices');
    });

    it('should reject when addresses is missing or not an array', async () => {
      delete req.body.addresses;
      try {
        await server.moralisGetMultipleSolTokenPrices(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.contain('request missing arguments');
      }

      req.body.addresses = 'notAnArray';
      try {
        await server.moralisGetMultipleSolTokenPrices(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.contain('request missing arguments');
      }

      should.not.exist(lastPost);
    });

    it('should return error if moralis is commented in config', async () => {
      config.moralis = undefined;
      try {
        await server.moralisGetMultipleSolTokenPrices(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moralis missing credentials');
        should.not.exist(lastPost);
      }
    });
  });
});
