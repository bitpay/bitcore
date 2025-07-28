import supertest from 'supertest';
import { expect } from 'chai';
import app from '../../src/routes';
import { BitcoinBlockStorage } from '../../src/models/block';
import { TransactionStorage } from '../../src/models/transaction';
import { intAfterHelper, intBeforeHelper } from '../helpers/integration';
import { resetDatabase } from '../helpers';
import sinon from 'sinon';
import { ChainStateProvider } from '../../src/providers/chain-state';

const request = supertest(app);

async function addBlocks(blocks: {
   height: number,
   chain: 'BCH' | 'BTC',
}[]) {
  for (const block of blocks) {
    const { chain, height } = block;
    await BitcoinBlockStorage.collection.insertOne(
      {
        network: 'regtest',
        chain: chain,
        hash: '4c58c6cab141839d66cb99e10757522d379509c9e90a89d39ee990fe6e08ab3a',
        bits: 545259519,
        height: height,
        merkleRoot: '760a46b4f94ab17350a3ed299546fb5648c025ad9bd22271be38cf075c9cf3f4',
        nextBlockHash: '47bab8f788e3bd8d3caca2a5e054e912982a0e6dfb873a7578beb8fac90eb87d',
        nonce: 0,
        previousBlockHash: '0a60c6e93a931e9b342a6c258bada673784610fdd2504cc7c6795555ef7e53ea',
        processed: true,
        reward: 1250000000,
        size: 214,
        time: new Date('2025-07-07T17:16:38.000Z'),
        timeNormalized: new Date('2025-07-07T17:16:38.002Z'),
        transactionCount: 1,
        version: 805306368
      }
    );
  }
}

async function addTransactions(transactions: {
  fee: number,
  size: number,
  blockHeight: number 
}[]) {
  for (const tx of transactions) {
    const { fee, size, blockHeight } = tx;
    await TransactionStorage.collection.insertOne(
      {
        chain: 'BTC',
        network: 'regtest',
        txid: 'da848d4c5a9d690259f5fddb6c5ca0fb0e52bc4a8ac472d3784a2de834cf448e',
        blockHash: '6a12d0dda65f846f1bfeebc503295ae7d42d116efbde1a10c3d2b3b87a64fa56',
        blockHeight: blockHeight,
        blockTime: new Date('2025-07-07T17:38:02.000Z'),
        blockTimeNormalized: new Date('2025-07-07T17:38:02.000Z'),
        coinbase: true,
        fee: fee,
        inputCount: 1,
        locktime: 0,
        outputCount: 2,
        size: size,
        value: 10_000_000,
        wallets: []
      }
    );
  }
}

describe('Routes', function() {
  let sandbox;
  before(async function() {
    this.timeout(15000);
    await intBeforeHelper()
    await resetDatabase();
    await addBlocks([
      { chain: 'BTC', height: 100 },
      { chain: 'BTC', height: 101 },
      { chain: 'BTC', height: 102 },
      { chain: 'BTC', height: 103 },
      { chain: 'BCH', height: 100 },
      { chain: 'BCH', height: 101 },
      { chain: 'BCH', height: 102 },
    ]);
    await addTransactions([
      { fee: 0, size: 133, blockHeight: 100 },
      { fee: 20000, size: 1056, blockHeight: 100 }, 
      { fee: 20000, size: 1056, blockHeight: 100 }, 
      { fee: 25000, size: 1056, blockHeight: 100 }, 
      { fee: 30000, size: 1056, blockHeight: 100 }, 
      { fee: 35000, size: 1056, blockHeight: 100 }, 
    ]);
  });

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
  });
  
  after(async () => intAfterHelper());
  
  afterEach(async () => {
    sandbox.restore();
  });
  
  it('should respond with a 404 status code for an unknown path', done => {
    request.get('/unknown').expect(404, done);
  });

  describe('Block', function() {
    it('should respond with a 200 code for block tip and return expected data', done => {
      request
        .get('/api/BTC/regtest/block/tip')
        .set('Accept', 'application/json')
        .expect(200, (err, res) => {
          if (err) console.error(err);
          expect(res.body.height).to.equal(103); // tip is defined in the before function
          done();
        });  
    });    

    it('should get block by height on BTC', done => {
      request
        .get('/api/BTC/regtest/block/101')
        .expect(200, (err, res) => {
          if (err) console.error(err);
          expect(res.body.height).to.equal(101);
          expect(res.body.chain).to.equal('BTC');
          done();
        });
    });

    it('should get block by height on BCH', done => {
      request
        .get('/api/BCH/regtest/block/101')
        .expect(200, (err, res) => {
          if (err) console.error(err);
          expect(res.body.height).to.equal(101);
          expect(res.body.chain).to.equal('BCH');
          done();
        });
    });

    it('should calculate fee data (total, mean, median, and mode) for block correctly', done => {
      const spy = sandbox.spy(ChainStateProvider, 'getBlockFee');

      request
      .get('/api/BTC/regtest/block/100/fee')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(spy.calledOnce).to.be.true;
        // transaction data is defined in before function
        expect(res.body.feeTotal).to.equal(20000 + 20000 + 25000 + 30000 + 35000);
        expect(res.body.mean).to.equal((20000 / 1056 + 20000 / 1056 + 25000 / 1056 + 30000 / 1056 + 35000 / 1056) / 5);
        expect(res.body.median).to.equal(25000 / 1056);
        expect(res.body.mode).to.equal(20000 / 1056);
        done();
      });
    });

    it('should cache fee data', done => {
      const spy = sandbox.spy(ChainStateProvider, 'getBlockFee');

      request
      .get('/api/BTC/regtest/block/100/fee')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(spy.notCalled).to.be.true;
        // transaction data is defined in before function
        expect(res.body.feeTotal).to.equal(20000 + 20000 + 25000 + 30000 + 35000);
        expect(res.body.mean).to.equal((20000 / 1056 + 20000 / 1056 + 25000 / 1056 + 30000 / 1056 + 35000 / 1056) / 5);
        expect(res.body.median).to.equal(25000 / 1056);
        expect(res.body.mode).to.equal(20000 / 1056);
        done();
      });
    });
  });
});
