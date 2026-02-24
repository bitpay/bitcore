import 'source-map-support/register';
import sinon from 'sinon';
import { expect } from 'chai';
import supertest from 'supertest';
import { Web3 } from '@bitpay-labs/crypto-wallet-core';
import app from '../../../src/routes';
import { EthRoutes } from '../../../src/modules/ethereum/api/eth-routes';
import { ETH } from '../../../src/modules/ethereum/api/csp';
import * as aaveApi from '../../../src/providers/chain-state/evm/api/aave';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { resetDatabase } from '../../helpers';
import { Config } from '../../../src/services/config';

describe('EVM Routes', function () {
  const sandbox = sinon.createSandbox();
  app.use(EthRoutes);
  const request = supertest(app);

  before(async function() {
    this.timeout(15000);
    await intBeforeHelper();
    await resetDatabase();
  });

  after(async () => intAfterHelper());
  
  afterEach(() => {
    sandbox.restore();
  });

  describe('GET getAccountNonce', function() {
    it('should get account nonce', done => {
      request.get('/api/ETH/regtest/address/0x9bb6f7fdf81afbd8876d37f3e5e37df416bf8da1/txs/count')
        .expect(200)
        .end((err, res) => {
          if (err) return done(res.error || err);
          expect(res.body).to.have.property('nonce');
          expect(res.body.nonce).to.be.a('number');
          expect(isNaN(res.body.nonce)).to.be.false;
          done();
        });
    });
  });

  describe('POST estimateGas', function() {
    it('should get gas estimate', done => {
      request.post('/api/ETH/regtest/gas')
        .send({
          from: '0x9bb6f7fdf81afbd8876d37f3e5e37df416bf8da1',
          to: '0xb0d38874081344C810e502Ed487c9bc98637f6D8',
          value: '0x9184e72a000', // 0.01 ETH
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.be.a('number');
          expect(isNaN(res.body)).to.be.false;
          done();
        });
    });
  });

  describe('POST estimateL1Fee', function() {
    const rawTx = '0xf86c07840a21fe808252089439acd4a7e19b34bb8266e573bfb44872913a087c872bdc545d6b4b8880820a96a0ee09eaa08b5f2593a8dde87ef9a8e35aefaf147eead392e9071ea5dc8e80e379a008e44ba5c43adc58dc2e24dbf8f1e25273e8a84fd2bd17cb88417ac3d869877e';
    let l1Fee: number;

    beforeEach(() => {
      sandbox.spy(Config, 'chainConfig');
    });

    it('should get L1 gas estimate', done => {
      request.post('/api/BASE/testnet/l1/fee')
        .send({ rawTx })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.be.a('string');
          expect(isNaN(res.body)).to.be.false;
          expect((Config.chainConfig as any).called).to.be.true;
          expect((Config.chainConfig as any).returnValues[0].needsL1Fee).to.be.true;
          l1Fee = parseInt(res.body);
          done();
        });
    });

    it('should get safe L1 gas estimate', done => {
      request.post('/api/BASE/testnet/l1/fee?safe=true')
        .send({ rawTx })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.be.a('string');
          expect(isNaN(res.body)).to.be.false;
          expect(parseInt(res.body)).to.be.greaterThan(l1Fee);
          expect((Config.chainConfig as any).called).to.be.true;
          expect((Config.chainConfig as any).returnValues[0].needsL1Fee).to.be.true;
          done();
        });
    });

    it('should not need L1 gas estimate', done => {
      request.post('/api/ETH/regtest/l1/fee')
        .send({ rawTx })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.equal('0');
          expect((Config.chainConfig as any).called).to.be.true;
          expect((Config.chainConfig as any).returnValues[0].needsL1Fee).to.be.undefined;
          done();
        });
    });
  });

  describe('GET getTokenInfo', function() {
    it('should get token info', done => {
      request.get('/api/BASE/testnet/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('name', 'USDC');
          expect(res.body).to.have.property('symbol', 'USDC');
          expect(res.body).to.have.property('decimals', 6);
          done();
        });
    });
  });

  describe('GET getERC20TokenAllowance', function() {
    it('should get token allowance', done => {
      request.get('/api/BASE/testnet/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e/allowance/0x9bb6f7fdf81afbd8876d37f3e5e37df416bf8da1/for/0xb0d38874081344C810e502Ed487c9bc98637f6D8')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.be.a('number');
          expect(isNaN(res.body)).to.be.false;
          done();
        });
    });
  });

  describe('GET getPriorityFee', function() {
    it('should get priority fee', done => {
      request.get('/api/ETH/regtest/priorityFee/3')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('feerate');
          expect(res.body.feerate).to.be.a('number');
          expect(isNaN(res.body.feerate)).to.be.false;
          done();
        });
    });
  });

  describe('GET getAaveUserAccountData', function() {
    const address = '0x856BC683A7e2fF87192B896c7dA99DdA5ab81E6C';
    const v2PoolMainnet = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

    it('should get v2 account-data shape using hardcoded public ETH mainnet RPC', function(done) {
      this.timeout(30000);
      // Keep route network as sepolia (configured in test config), but force a mainnet v2 web3/pool path in-test.
      const web3 = new Web3('https://ethereum.publicnode.com');
      sandbox.stub(ETH, 'getWeb3').resolves({ web3 } as any);
      sandbox.stub(aaveApi, 'getAavePoolAddress').returns(v2PoolMainnet);

      request.get(`/api/ETH/sepolia/aave/account/${address}?version=v2`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.include.keys([
            'totalCollateralETH',
            'totalDebtETH',
            'availableBorrowsETH',
            'currentLiquidationThreshold',
            'ltv',
            'healthFactor'
          ]);
          expect(res.body.totalCollateralETH).to.be.a('string');
          expect(res.body.totalDebtETH).to.be.a('string');
          expect(res.body.availableBorrowsETH).to.be.a('string');
          expect((ETH.getWeb3 as any).calledOnceWith('sepolia')).to.be.true;
          done();
        });
    });

    it('should return 400 for unsupported chain/network on v2', done => {
      request.get(`/api/ETH/sepolia/aave/account/${address}?version=v2`)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.text).to.equal('Unsupported chain or network for Aave');
          done();
        });
    });

    it('should get v3 account-data shape', function(done)  {
      this.timeout(30000);
      request.get(`/api/ETH/sepolia/aave/account/${address}?version=v3`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.include.keys([
            'totalCollateralBase',
            'totalDebtBase',
            'availableBorrowsBase',
            'currentLiquidationThreshold',
            'ltv',
            'healthFactor'
          ]);
          done();
        });
    });

    it('should return 400 for unsupported chain/network on v3', done => {
      request.get(`/api/ETH/regtest/aave/account/${address}?version=v3`)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.text).to.equal('Unsupported chain or network for Aave');
          done();
        });
    });

    it('should return 400 for unsupported Aave version', done => {
      request.get(`/api/ETH/sepolia/aave/account/${address}?version=v9`)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.text).to.equal('Unsupported Aave version');
          done();
        });
    });
  });
});