import supertest from 'supertest';
import { expect } from 'chai';
import app from '../../src/routes';
import { BitcoinBlockStorage } from '../../src/models/block';
import { TransactionStorage } from '../../src/models/transaction';
import { intAfterHelper, intBeforeHelper } from '../helpers/integration';
import { resetDatabase } from '../helpers';
import sinon from 'sinon';
import { ChainStateProvider } from '../../src/providers/chain-state';
import { CoinStorage } from '../../src/models/coin';

const request = supertest(app);

async function addBlocks(
  blocks: {
    chain: 'BTC' | 'BCH';
    hash?: string;
    height: number;
    time?: Date;
  }[]
) {
  for (const block of blocks) {
    const { chain, hash, height, time } = block;
    await BitcoinBlockStorage.collection.insertOne({
      network: 'regtest',
      chain: chain,
      hash: hash || '2c07decae68f74d6ac20184cce0216388ea66f0068cde511bb9c51f0691539a8',
      bits: 545259519,
      height: height,
      merkleRoot: '760a46b4f94ab17350a3ed299546fb5648c025ad9bd22271be38cf075c9cf3f4',
      nextBlockHash: '47bab8f788e3bd8d3caca2a5e054e912982a0e6dfb873a7578beb8fac90eb87d',
      nonce: 0,
      previousBlockHash: '0a60c6e93a931e9b342a6c258bada673784610fdd2504cc7c6795555ef7e53ea',
      processed: true,
      reward: 1250000000,
      size: 214,
      time: time || new Date('2025-07-07T17:16:38.000Z'),
      timeNormalized: time || new Date('2025-07-07T17:16:38.002Z'),
      transactionCount: 1,
      version: 805306368
    });
  }
}

async function addTransactions(
  transactions: {
    chain: 'BTC' | 'BCH';
    blockHash?: string;
    txId?: string;
    fee: number;
    size: number;
    blockHeight: number;
    coinbase?: boolean;
    inputs?: {
      value: number;
    }[];
    outputs?: {
      value: number;
    }[];
  }[]
) {
  for (const tx of transactions) {
    const { chain, blockHash, fee, size, blockHeight, coinbase } = tx;
    let { txId, inputs, outputs } = tx;
    inputs = inputs || [];
    outputs = outputs || [];
    txId = txId || 'da848d4c5a9d690259f5fddb6c5ca0fb0e52bc4a8ac472d3784a2de834cf448e';
    await TransactionStorage.collection.insertOne({
      chain: chain,
      network: 'regtest',
      txid: txId,
      blockHash: blockHash || '2c07decae68f74d6ac20184cce0216388ea66f0068cde511bb9c51f0691539a8',
      blockHeight: blockHeight,
      blockTime: new Date('2025-07-07T17:38:02.000Z'),
      blockTimeNormalized: new Date('2025-07-07T17:38:02.000Z'),
      coinbase: coinbase!!,
      fee: fee,
      inputCount: inputs.length || 1,
      outputCount: outputs.length || 1,
      locktime: 0,
      size: size,
      value: 10_000_000,
      wallets: []
    });
    for (const input of inputs) {
      const { value } = input;
      await CoinStorage.collection.insertOne({
        chain: chain,
        network: 'regtest',
        value: value,
        mintTxid: '52e76c33561b0fc31ecf56e101c4f582d85e385381f3da3e5f5aabdb1b939f90',
        spentTxid: txId,
        spentHeight: blockHeight,
        mintHeight: blockHeight - 1,
        mintIndex: 0,
        script: Buffer.from('aiSqIant4vYcP3HR3v0/qZnfo2lTdVxpBol5mWK0i+vYNpdOjPk'),
        coinbase: true,
        address: 'bcrt1qxxm47l2d6hrl8e9w9rq6w9klxav5c9e76jehw8',
        wallets: []
      });
    }
    for (const output of outputs) {
      const { value } = output;
      await CoinStorage.collection.insertOne({
        chain: chain,
        network: 'regtest',
        value: value,
        mintTxid: txId,
        spentTxid: 'c9d06466adaf5322f619c603fddb8a325cb6cdfcb9dffaa4e1919e896b2b98d7',
        spentHeight: -2,
        mintHeight: blockHeight,
        mintIndex: 0,
        script: Buffer.from('aiSqIant4vYcP3HR3v0/qZnfo2lTdVxpBol5mWK0i+vYNpdOjPk'),
        coinbase: true,
        address: 'bcrt1qxxm47l2d6hrl8e9w9rq6w9klxav5c9e76jehw8',
        wallets: []
      });
    }
  }
}

function expectBlockProps(block: any) {
  const blockProps = [
    'chain',
    'network',
    'hash',
    'height',
    'version',
    'size',
    'merkleRoot',
    'time',
    'timeNormalized',
    'nonce',
    'bits',
    'previousBlockHash',
    'nextBlockHash',
    'reward',
    'transactionCount',
  ];

  for (const key of blockProps) {
    expect(block).to.have.property(key);
  }
}

describe('Routes', function() {
  let sandbox;
  const minutesAgo = (minutes: number): Date => new Date(Date.now() - 1000 * 60 * minutes);
  const block100Hash = '4fedb28fb20b5dcfe4588857ac10c38c6d67e8267e35478d8bcca468c9114bbe';
  const tipHeight = 103;

  before(async function() {
    this.timeout(15000);
    await intBeforeHelper();
    await resetDatabase();
    await addBlocks([
      { chain: 'BTC', height: 99, time: minutesAgo(50) },
      { chain: 'BTC', hash: block100Hash, height: 100, time: minutesAgo(40) },
      { chain: 'BTC', height: 101, time: minutesAgo(30) },
      { chain: 'BTC', height: 102, time: minutesAgo(20) },
      { chain: 'BTC', height: tipHeight, time: minutesAgo(10) },
      { chain: 'BCH', height: 100 },
      { chain: 'BCH', height: 101 },
      { chain: 'BCH', height: 102 }
    ]);
    await addTransactions([
      {
        chain: 'BTC',
        blockHash: block100Hash,
        fee: 0,
        size: 133,
        blockHeight: 100,
        coinbase: true,
        outputs: [{ value: 5000000000 }, { value: 0 }]
      },
      {
        chain: 'BTC',
        blockHash: block100Hash,
        fee: 20000,
        size: 1056,
        blockHeight: 100,
        inputs: [{ value: 130000 }],
        outputs: [{ value: 100000 }, { value: 10000 }]
      },
      {
        chain: 'BTC',
        blockHash: block100Hash,
        fee: 20000,
        size: 1056,
        blockHeight: 100,
        inputs: [{ value: 130000 }],
        outputs: [{ value: 100000 }, { value: 10000 }]
      },
      {
        chain: 'BTC',
        blockHash: block100Hash,
        fee: 25000,
        size: 1056,
        blockHeight: 100,
        inputs: [{ value: 135000 }],
        outputs: [{ value: 100000 }, { value: 10000 }]
      },
      {
        chain: 'BTC',
        blockHash: block100Hash,
        fee: 30000,
        size: 1056,
        blockHeight: 100,
        inputs: [{ value: 140000 }],
        outputs: [{ value: 100000 }, { value: 10000 }]
      },
      {
        chain: 'BTC',
        blockHash: block100Hash,
        fee: 35000,
        size: 1056,
        blockHeight: 100,
        inputs: [{ value: 100000 }, { value: 35000 }],
        outputs: [{ value: 100000 }, { value: 10000 }]
      },

      { chain: 'BTC', fee: 0, size: 133, blockHeight: 101, coinbase: true },

      { chain: 'BTC', fee: 0, size: 133, blockHeight: tipHeight, coinbase: true },
      { chain: 'BTC', fee: 9000, size: 1056, blockHeight: tipHeight },
      { chain: 'BTC', fee: 10000, size: 1056, blockHeight: tipHeight },
      { chain: 'BTC', fee: 11000, size: 1056, blockHeight: tipHeight },

      { chain: 'BCH', fee: 0, size: 133, blockHeight: 100, coinbase: true },
      { chain: 'BCH', fee: 2000, size: 1056, blockHeight: 100 },
      { chain: 'BCH', fee: 2000, size: 1056, blockHeight: 100 },
      { chain: 'BCH', fee: 2500, size: 1056, blockHeight: 100 },
      { chain: 'BCH', fee: 3000, size: 1056, blockHeight: 100 },
      { chain: 'BCH', fee: 3500, size: 1056, blockHeight: 100 }
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
    it('should get blocks on BTC regtest', done => {
      request.get('/api/BTC/regtest/block').expect(200, (err, res) => {
        if (err) console.error(err);
        const blocks = res.body;
        for (const block of blocks) {
          expect(block).to.include({chain: 'BTC', network: 'regtest'});
          expectBlockProps(block);
        }
        done();
      });
    });

    it('should get blocks after 101 on BTC regtest', done => {
      request.get(`/api/BTC/regtest/block?sinceBlock=101`).expect(200, (err, res) => {
        if (err) console.error(err);
        const blocks = res.body;
        for (const block of blocks) {
          expect(block.height).to.be.greaterThan(101);
          expect(block).to.include({chain: 'BTC', network: 'regtest'});
          expectBlockProps(block);
        }
        done();
      });
    });

    it('should get 3 blocks with limit=3 on BTC regtest', done => {
      request.get(`/api/BTC/regtest/block?limit=3`).expect(200, (err, res) => {
        if (err) console.error(err);
        const blocks = res.body;
        expect(blocks.length).to.equal(3);
        for (const block of blocks) {
          expect(block).to.include({chain: 'BTC', network: 'regtest'});
          expectBlockProps(block);
        }
        done();
      });
    });

    it('should respond with a 200 code for block tip and return expected data', done => {
      request
        .get('/api/BTC/regtest/block/tip')
        .expect(200, (err, res) => {
          if (err) console.error(err);
          const block = res.body;
          expect(block).to.include({chain: 'BTC', network: 'regtest', height: tipHeight});
          expectBlockProps(block);
          done();
        });
    });

    it('should get block by height on BTC', done => {
      request.get('/api/BTC/regtest/block/101').expect(200, (err, res) => {
        if (err) console.error(err);
        const block = res.body;
        expect(block).to.include(
          {chain: 'BTC', network: 'regtest', height: 101, confirmations: tipHeight - 101 + 1}
        );
        expectBlockProps(block)
        done();
      });
    });

    it('should get block by height on BCH', done => {
      request.get('/api/BCH/regtest/block/101').expect(200, (err, res) => {
        if (err) console.error(err);
        const block = res.body;
        expect(block).to.include({chain: 'BCH', network: 'regtest', height: 101});
        done();
      });
    });

    it('should get coins by block hash', done => {
      request.get(`/api/BTC/regtest/block/${block100Hash}/coins/0/1`).expect(200, (err, res) => {
        if (err) console.error(err);
        const { txids, inputs, outputs } = res.body;
        expect(inputs.length).to.be.at.least(txids.length);
        expect(outputs.length).to.be.at.least(txids.length);

        for (const input of res.body.inputs) {
          expect(input).to.include({chain: 'BTC', network: 'regtest', spentHeight: 100});
        }
        for (const output of res.body.outputs) {
          expect(output).to.include({chain: 'BTC', network: 'regtest', mintHeight: 100});
        }
        done();
      });
    });
        
    it('should get coins by block hash and limit coins to 3', done => {
      request.get(`/api/BTC/regtest/block/${block100Hash}/coins/3/1`).expect(200, (err, res) => {
        if (err) console.error(err);
        const { txids, inputs, outputs } = res.body;
        expect(txids.length).to.equal(3);
        expect(inputs.length).to.be.at.least(txids.length);
        expect(outputs.length).to.be.at.least(txids.length);

        for (const input of res.body.inputs) {
          expect(input).to.include({chain: 'BTC', network: 'regtest', spentHeight: 100});
        }
        for (const output of res.body.outputs) {
          expect(output).to.include({chain: 'BTC', network: 'regtest', mintHeight: 100});
        }
        done();
      });
    });


    it('should get blocks before 20 minutes ago', done => {
      request.get(`/api/BTC/regtest/block/before-time/${minutesAgo(20)}`).expect(200, (err, res) => {
        if (err) console.error(err);
        const block = res.body;
        const { timeNormalized } = block;
        expect(new Date(timeNormalized).getTime()).to.be.lessThan(minutesAgo(20).getTime());
        expect(block).to.include({chain: 'BTC', network: 'regtest'})
        expectBlockProps(block);
        done();
      });
    });

    it('should calculate fee data (total, mean, median, and mode) for block correctly', done => {
      const spy = sandbox.spy(ChainStateProvider, 'getBlockFee');

      request.get('/api/BTC/regtest/block/100/fee').expect(200, (err, res) => {
        if (err) console.error(err);
        expect(spy.calledOnce).to.be.true;
        const { feeTotal, mean, median, mode } = res.body;
        // transaction data is defined in before function
        expect(feeTotal).to.equal(20000 + 20000 + 25000 + 30000 + 35000);
        expect(mean).to.equal((20000 / 1056 + 20000 / 1056 + 25000 / 1056 + 30000 / 1056 + 35000 / 1056) / 5);
        expect(median).to.equal(25000 / 1056);
        expect(mode).to.equal(20000 / 1056);
        done();
      });
    });

    it('should cache fee data', done => {
      const spy = sandbox.spy(ChainStateProvider, 'getBlockFee');

      request.get('/api/BTC/regtest/block/100/fee').expect(200, (err, res) => {
        if (err) console.error(err);
        expect(spy.notCalled).to.be.true;
        const { feeTotal, mean, median, mode } = res.body;
        // transaction data is defined in before function
        expect(feeTotal).to.equal(20000 + 20000 + 25000 + 30000 + 35000);
        expect(mean).to.equal((20000 / 1056 + 20000 / 1056 + 25000 / 1056 + 30000 / 1056 + 35000 / 1056) / 5);
        expect(median).to.equal(25000 / 1056);
        expect(mode).to.equal(20000 / 1056);
        done();
      });
    });

    it('should calculate fee data on BCH', done => {
      request.get('/api/BCH/regtest/block/100/fee').expect(200, (err, res) => {
        if (err) console.error(err);
        const { feeTotal, mean, median, mode } = res.body;
        // transaction data is defined in before function
        expect(feeTotal).to.equal(2000 + 2000 + 2500 + 3000 + 3500);
        expect(mean).to.equal((2000 / 1056 + 2000 / 1056 + 2500 / 1056 + 3000 / 1056 + 3500 / 1056) / 5);
        expect(median).to.equal(2500 / 1056);
        expect(mode).to.equal(2000 / 1056);
        done();
      });
    });

    it('should calculate tip fee data', done => {
      request.get('/api/BTC/regtest/block/tip/fee').expect(200, (err, res) => {
        if (err) console.error(err);
        const { feeTotal, mean, median, mode } = res.body;
        // transaction data is defined in before function
        expect(feeTotal).to.equal(9000 + 10000 + 11000);
        expect(mean).to.equal((9000 / 1056 + 10000 / 1056 + 11000 / 1056) / 3);
        expect(median).to.equal(10000 / 1056);
        expect(mode).to.equal(9000 / 1056);
        done();
      });
    });

    it('should calculate fee data of block with only coinbase transaction as 0', done => {
      request.get('/api/BTC/regtest/block/101/fee').expect(200, (err, res) => {
        if (err) console.error(err);
        const { feeTotal, mean, median, mode } = res.body;
        expect(feeTotal).to.equal(0);
        expect(mean).to.equal(0);
        expect(median).to.equal(0);
        expect(mode).to.equal(0);
        done();
      });
    });
  });
});
