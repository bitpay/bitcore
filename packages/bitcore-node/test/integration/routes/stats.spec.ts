import supertest from 'supertest'
import app from '../../../src/routes'
import { expect } from 'chai';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { resetDatabase } from '../../helpers';
import { BitcoinBlockStorage, IBtcBlock } from '../../../src/models/block';
import { randomBytes } from 'crypto';

const requests = supertest(app);

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


const days = 40, blocksPerDay = 5;
const blocks: IBtcBlock[] = [];
const hashes: string[] = [];
for (let i = 0; i < blocksPerDay; i++)
  hashes.push(randomBytes(32).toString('hex'));
for (let day = 0; day < days; day++) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - day);
  date.setUTCHours(0, 0, 0, 0);
  
  for (let i = 0; i < blocksPerDay; i++) {
    blocks.push({
      chain: 'BTC',
      network: 'regtest',
      hash: hashes[i],
      height: day * blocksPerDay + i,
      bits: 545259519,
      merkleRoot: randomBytes(32).toString('hex'),
      nextBlockHash: hashes[i+1],
      nonce: randomInt(0, 100),
      previousBlockHash: hashes[i-1],
      processed: true,
      reward: 5000000000,
      size: randomInt(200, 4000),
      time: new Date(date.getTime() + i * 1000 * 60 * 10),
      timeNormalized: new Date(date.getTime() + i * 1000 * 60 * 10),
      transactionCount: randomInt(1, 1000),
      version: 536870912
    });
  }
}

const expectedDailyTransactions = new Map<string, number>();
for (let day = 0; day < days; day++) {
  let dailyTransactionCount = 0;
  for (let i = 0; i < blocksPerDay; i++) {
    const block = blocks[day * blocksPerDay + i];
    dailyTransactionCount += block.transactionCount;
  }
  const date = blocks[day * blocksPerDay].time.toISOString().slice(0, 10);
  expectedDailyTransactions.set(date, dailyTransactionCount );
}

describe('Stats Routes', function() {
  before(async function() {
    this.timeout(15000);
    await intBeforeHelper();
    await resetDatabase();
    await BitcoinBlockStorage.collection.insertMany(blocks);
  });

  after(async function() {
    await intAfterHelper();
  })

  it('should get daily-transactions', done => {
    requests.get('/api/BTC/regtest/stats/daily-transactions')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { chain, network, results } = res.body;
        expect(chain).to.equal('BTC');
        expect(network).to.equal('regtest');
        expect(results.length).to.equal(30);
        for (const result of results) {
          const { date, transactionCount } = result;
          expect(expectedDailyTransactions.get(date)).to.equal(transactionCount);
        }
        done();
      });
  });

  it('should get daily-transactions from yesterday', done => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    requests.get(`/api/BTC/regtest/stats/daily-transactions?startDate=${yesterday}`)
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { chain, network, results } = res.body;
        expect(chain).to.equal('BTC');
        expect(network).to.equal('regtest');
        expect(results.length).to.equal(1);
        for (const result of results) {
          const { date, transactionCount } = result;
          expect(expectedDailyTransactions.get(date)).to.equal(transactionCount);
        }
        done();
      });
  });


  it('should get daily-transactions from this week', done => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 7);
    yesterday.setUTCHours(0, 0, 0, 0);
    requests.get(`/api/BTC/regtest/stats/daily-transactions?startDate=${yesterday}`)
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { chain, network, results } = res.body;
        expect(chain).to.equal('BTC');
        expect(network).to.equal('regtest');
        expect(results.length).to.equal(7);
        for (const result of results) {
          const { date, transactionCount } = result;
          expect(expectedDailyTransactions.get(date)).to.equal(transactionCount);
          expect(new Date(date)).to.be.at.least(yesterday);
        }
        done();
      });
  });


  it('should get daily-transactions from a week', done => {
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - 7 - 25);
    const endDate = new Date();
    endDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCDate(endDate.getUTCDate() - 25);
    requests.get(`/api/BTC/regtest/stats/daily-transactions?startDate=${startDate}&endDate=${endDate}`)
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { chain, network, results } = res.body;
        expect(chain).to.equal('BTC');
        expect(network).to.equal('regtest');
        expect(results.length).to.equal(7);
        for (const result of results) {
          const { date, transactionCount } = result;
          expect(expectedDailyTransactions.get(date)).to.equal(transactionCount);
          expect(new Date(date)).to.be.at.least(startDate);
          expect(new Date(date)).to.be.at.most(endDate);
        }
        done();
      });
  });
});