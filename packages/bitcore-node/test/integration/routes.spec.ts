import supertest from 'supertest';
import app from '../../src/routes';
import { intAfterHelper, intBeforeHelper } from '../helpers/integration';
import { resetDatabase } from '../helpers';
import { BitcoinBlockStorage } from '../../src/models/block';
import { expect } from 'chai';
import { TransactionStorage } from '../../src/models/transaction';

const request = supertest(app);

async function addTransactions(transactions: { fee: number, size: number, value?: number, blockHeight: number }[]) {
  for (const tx of transactions) {
    const { fee, size, value, blockHeight } = tx;
    await TransactionStorage.collection.insertOne(
      {
        chain: "BTC",
        network: "regtest",
        txid: "da848d4c5a9d690259f5fddb6c5ca0fb0e52bc4a8ac472d3784a2de834cf448e",
        blockHash: "6a12d0dda65f846f1bfeebc503295ae7d42d116efbde1a10c3d2b3b87a64fa56",
        blockHeight: blockHeight,
        blockTime: new Date("2025-07-07T17:38:02.000Z"),
        blockTimeNormalized: new Date("2025-07-07T17:38:02.000Z"),
        coinbase: true,
        fee: fee,
        inputCount: 1,
        locktime: 0,
        outputCount: 2,
        size: size,
        value: value || 10_000_000,
        wallets: []
      }
    );
  }
}

describe('Routes', function() {
  this.timeout(500000);
  before(intBeforeHelper);
  after(async () => intAfterHelper());

  before(async () => {
    await resetDatabase();
    await BitcoinBlockStorage.collection.insertMany([
      {
        network: "regtest",
        chain: "BTC",
        hash: "4c58c6cab141839d66cb99e10757522d379509c9e90a89d39ee990fe6e08ab3a",
        bits: 545259519,
        height: 311,
        merkleRoot: "760a46b4f94ab17350a3ed299546fb5648c025ad9bd22271be38cf075c9cf3f4",
        nextBlockHash: "47bab8f788e3bd8d3caca2a5e054e912982a0e6dfb873a7578beb8fac90eb87d",
        nonce: 0,
        previousBlockHash: "0a60c6e93a931e9b342a6c258bada673784610fdd2504cc7c6795555ef7e53ea",
        processed: true,
        reward: 1250000000,
        size: 214,
        time: new Date("2025-07-07T17:16:38.000Z"),
        timeNormalized: new Date("2025-07-07T17:16:38.002Z"),
        transactionCount: 1,
        version: 805306368
      },
      {
        chain: "BTC",
        hash: "47bab8f788e3bd8d3caca2a5e054e912982a0e6dfb873a7578beb8fac90eb87d",
        network: "regtest",
        bits: 545259519,
        height: 312,
        merkleRoot: "7fbb924312f9a9c88ad0439db8898e5b535d119d7a52d880ec0927473cda54f6",
        nextBlockHash: "1cb1a36d9fecdaad0ae4621bbd2cbbc379776e0c365953cadaa3edc044c0f314",
        nonce: 1,
        previousBlockHash: "4c58c6cab141839d66cb99e10757522d379509c9e90a89d39ee990fe6e08ab3a",
        processed: true,
        reward: 1250000000,
        size: 214,
        time: new Date("2025-07-07T17:16:38.000Z"),
        timeNormalized: new Date("2025-07-07T17:16:38.003Z"),
        transactionCount: 1,
        version: 805306368
      },
      {
        network: "regtest",
        hash: "1cb1a36d9fecdaad0ae4621bbd2cbbc379776e0c365953cadaa3edc044c0f314",
        chain: "BTC",
        bits: 545259519,
        height: 313,
        merkleRoot: "11657a1da31ee0bc8382a09ad8e6b383037085d268b92fb9a85eedb280e9b7b9",
        nextBlockHash: "5a1bd692f4f784dc97985362294e72b84ec6de9d016f128118d58961a8508ad0",
        nonce: 0,
        previousBlockHash: "47bab8f788e3bd8d3caca2a5e054e912982a0e6dfb873a7578beb8fac90eb87d",
        processed: true,
        reward: 1250000000,
        size: 214,
        time: new Date("2025-07-07T17:16:38.000Z"),
        timeNormalized: new Date("2025-07-07T17:16:38.004Z"),
        transactionCount: 1,
        version: 805306368
      },
      {
        chain: "BTC",
        hash: "6a12d0dda65f846f1bfeebc503295ae7d42d116efbde1a10c3d2b3b87a64fa56",
        network: "regtest",
        bits: 545259519,
        height: 100,
        merkleRoot: "5e167fec1755630de1b63d2f2f72953770430777ac3f067c694415c59d614aa3",
        nextBlockHash: "43d5241c686aafa25ca8ef2ee943fdf789c3299777e1e6bfa432c1915d9828ea",
        nonce: 1,
        previousBlockHash: "66718175372194a83c9ce204bf3a6ae18e8d623109c01efd3e732bfd7f9f2c37",
        processed: true,
        reward: 1250023300,
        size: 1763,
        time: new Date("2025-07-07T17:38:02.000Z"),
        timeNormalized: new Date("2025-07-07T17:38:02.000Z"),
        transactionCount: 7,
        version: 805306368
      }
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

  it('should respond with a 200 code for block tip and return expected data', done => {
    request
      .get('/api/BTC/regtest/block/tip')
      .set('Accept', 'application/json')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(res.body.height).to.equal(313); // tip is defined in the before function
        done();
      });
  });

  it('should respond with a 404 status code for an unknown path', done => {
    request.get('/unknown').expect(404, done);
  });

  it('should get block by height', done => {
    request
      .get('/api/BTC/regtest/block/312')
      .expect((res) => {
        expect(res.body.height).to.equal(312);
      })
      .expect(200, done);
  });

  it('should get block fee data', done => {
    request
    .get('/api/BTC/regtest/block/100/fee')
    .expect((res) => {
      expect(res.body.feeTotal).to.equal(20000 + 20000 + 25000 + 30000 + 35000)
      expect(res.body.mean).to.equal((20000 / 1056 + 20000 / 1056 + 25000 / 1056 + 30000 / 1056 + 35000 / 1056) / 5)
      expect(res.body.median).to.equal(25000 / 1056)
      expect(res.body.mode).to.equal(20000 / 1056)
    })
    .expect(200, done);
  })
});
