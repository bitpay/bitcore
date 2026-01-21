import supertest from 'supertest';
import { expect } from 'chai';
import app from '../../../src/routes';
import { BitcoinBlockStorage } from '../../../src/models/block';
import { TransactionStorage } from '../../../src/models/transaction';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { expectObjectToHaveProps, minutesAgo, resetDatabase } from '../../helpers';
import sinon from 'sinon';
import { ChainStateProvider } from '../../../src/providers/chain-state';
import { CoinStorage } from '../../../src/models/coin';



describe('Block Routes', function() {
  let sandbox;
  const tipHeight = 103;

  const request = supertest(app);

  async function addBlocks(
    blocks: {
      chain: 'BTC' | 'BCH';
      height: number;
      hash?: string;
      time?: Date;
      transactions?: {
        txid?: string;
        fee: number;
        size: number;
        coinbase?: boolean;
        inputs?: number[];
        outputs?: number[];
      }[];
    }[]
  ) {
    for (const block of blocks) {
      const { chain, height } = block;
      const hash = block.hash || '2c07decae68f74d6ac20184cce0216388ea66f0068cde511bb9c51f0691539a8';
      const transactions = block.transactions || [];
      const time = block.time || new Date('2025-07-07T17:16:38.002Z');
      await BitcoinBlockStorage.collection.insertOne({
        network: 'regtest',
        chain: chain,
        hash: hash,
        bits: 545259519,
        height: height,
        merkleRoot: '760a46b4f94ab17350a3ed299546fb5648c025ad9bd22271be38cf075c9cf3f4',
        nextBlockHash: '47bab8f788e3bd8d3caca2a5e054e912982a0e6dfb873a7578beb8fac90eb87d',
        nonce: 0,
        previousBlockHash: '0a60c6e93a931e9b342a6c258bada673784610fdd2504cc7c6795555ef7e53ea',
        processed: true,
        reward: 1250000000,
        size: 214,
        time: time,
        timeNormalized: time,
        transactionCount: 1,
        version: 805306368
      });

      for (const tx of transactions) {
        const { fee, size } = tx;
        const inputs = tx.inputs || [];
        const outputs = tx.outputs || [];
        const txid = tx.txid || 'da848d4c5a9d690259f5fddb6c5ca0fb0e52bc4a8ac472d3784a2de834cf448e';
        const coinbase = tx.coinbase!;

        await TransactionStorage.collection.insertOne({
          chain: chain,
          network: 'regtest',
          txid: txid,
          blockHash: hash,
          blockHeight: height,
          blockTime: new Date('2025-07-07T17:38:02.000Z'),
          blockTimeNormalized: new Date('2025-07-07T17:38:02.000Z'),
          coinbase: coinbase,
          fee: fee,
          inputCount: inputs.length || 1,
          outputCount: outputs.length || 1,
          locktime: 0,
          size: size,
          value: 10_000_000,
          wallets: []
        });

        for (const input of inputs) {
          await CoinStorage.collection.insertOne({
            chain: chain,
            network: 'regtest',
            value: input,
            mintTxid: '52e76c33561b0fc31ecf56e101c4f582d85e385381f3da3e5f5aabdb1b939f90',
            spentTxid: txid,
            spentHeight: height,
            mintHeight: height - 1,
            mintIndex: 0,
            script: Buffer.from('aiSqIant4vYcP3HR3v0/qZnfo2lTdVxpBol5mWK0i+vYNpdOjPk'),
            coinbase: coinbase,
            address: 'bcrt1qxxm47l2d6hrl8e9w9rq6w9klxav5c9e76jehw8',
            wallets: []
          });
        }
        for (let i = 0; i < outputs.length; i++) {
          const output = outputs[i];
          await CoinStorage.collection.insertOne({
            chain: chain,
            network: 'regtest',
            value: output,
            mintTxid: txid,
            spentTxid: 'c9d06466adaf5322f619c603fddb8a325cb6cdfcb9dffaa4e1919e896b2b98d7',
            spentHeight: -2,
            mintHeight: height,
            mintIndex: i,
            script: Buffer.from('aiSqIant4vYcP3HR3v0/qZnfo2lTdVxpBol5mWK0i+vYNpdOjPk'),
            coinbase: coinbase,
            address: 'bcrt1qxxm47l2d6hrl8e9w9rq6w9klxav5c9e76jehw8',
            wallets: []
          });
        }
      }
    }
  }

  before(async function() {
    this.timeout(15000);
    await intBeforeHelper();
    await resetDatabase();
    await addBlocks([
      { chain: 'BTC', height: 99, time: minutesAgo(50) },
      { chain: 'BTC', height: 100, hash: '4fedb28fb20b5dcfe4588857ac10c38c6d67e8267e35478d8bcca468c9114bbe', time: minutesAgo(40),
        transactions: [
          { txid: '3c683a2deac83349d0da065baafc326a42f0f0630199cedd34beb52d8d16d11c',
            fee: 0, size: 133, coinbase: true, outputs: [ 5000000000, 0 ] },
          { txid: 'f1bc9ab3ee4c44d304b06cb09ee1c323b072d1967f3e1c3d1bd1067eae07bd25',
            fee: 20000, size: 1056, inputs: [130000], outputs: [100000, 10000 ] },
          { txid: '85cb924a14f354aae71afa503e057e570290c769b0fec10d149c7ea55d100f94',
            fee: 20000, size: 1056, inputs: [130000], outputs: [100000, 10000 ] },
          { txid: 'a4aa0cce47e70df51407ba864be9d667b71ecb2b5ee01d48b1bb29ba32436ed2',
            fee: 25000, size: 1056, inputs: [135000], outputs: [100000, 10000 ] },
          { txid: '86950d79deed75bcbe4e6345f6e87390a02477cfc8492e3d93702b5396ea746d',
            fee: 30000, size: 1056, inputs: [140000], outputs: [100000, 10000 ] },
          { txid: '4541c61085876bbe91ed82468c46d9a5aa2df0e14b1833c1c1cd241f2f143bd6',
            fee: 35000, size: 1056, inputs: [100000, 45000 ], outputs: [ 100000, 10000 ] },
        ]
      },
      { chain: 'BTC', height: 101, time: minutesAgo(30),
        transactions: [
          { fee: 0, size: 133, coinbase: true }
        ]
      },
      { chain: 'BTC', height: 102, time: minutesAgo(20) },
      { chain: 'BTC', height: tipHeight, time: minutesAgo(10),
        transactions: [
          { fee: 0, size: 133, coinbase: true },
          { fee: 9000, size: 1056 },
          { fee: 10000, size: 1056 },
          { fee: 11000, size: 1056 },
        ]
      },
      { chain: 'BCH', height: 100, 
        transactions: [
          { fee: 0, size: 133, coinbase: true },
          { fee: 2000, size: 1056 },
          { fee: 2000, size: 1056 },
          { fee: 2500, size: 1056 },
          { fee: 3000, size: 1056 },
          { fee: 3500, size: 1056 }
        ] 
      },
      { chain: 'BCH', height: 101 },
      { chain: 'BCH', height: 102 }
    ]);
  });

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
  });

  after(async () => intAfterHelper());

  afterEach(async () => {
    sandbox.restore();
  });

  const testBlock = (block: any) => {
    const BlockProps = {
      chain: 'string',
      network: 'string',
      hash: 'string',
      height: 'number',
      version: 'number',
      size: 'number',
      merkleRoot: 'string',
      time: 'string',
      timeNormalized: 'string',
      nonce: 'number',
      bits: 'number',
      previousBlockHash: 'string',
      nextBlockHash: 'string',
      reward: 'number',
      transactionCount: 'number'
    };

    expectObjectToHaveProps(block, BlockProps);
    expect(block.chain).to.not.equal('');
    expect(block.network).to.not.equal('');
    expect(block.hash).to.have.length(64);
    expect(block.merkleRoot).to.have.length(64);
    expect(block.height).to.be.at.least(0);
    expect(block.nonce).to.be.at.least(0);
    expect(block.bits).to.be.at.least(0);
  };

  it('should get blocks on BTC regtest', done => {
    request.get('/api/BTC/regtest/block').expect(200, (err, res) => {
      if (err) console.error(err);
      const blocks = res.body;
      for (const block of blocks) {
        expect(block).to.include({ chain: 'BTC', network: 'regtest' });
        testBlock(block);
      }
      done();
    });
  });

  it('should get blocks after 101 on BTC regtest', done => {
    request.get('/api/BTC/regtest/block?sinceBlock=101').expect(200, (err, res) => {
      if (err) console.error(err);
      const blocks = res.body;
      for (const block of blocks) {
        expect(block.height).to.be.greaterThan(101);
        expect(block).to.include({ chain: 'BTC', network: 'regtest' });
        testBlock(block);
      }
      done();
    });
  });

  it('should get 3 blocks with limit=3 on BTC regtest', done => {
    request.get('/api/BTC/regtest/block?limit=3').expect(200, (err, res) => {
      if (err) console.error(err);
      const blocks = res.body;
      expect(blocks.length).to.equal(3);
      for (const block of blocks) {
        expect(block).to.include({ chain: 'BTC', network: 'regtest' });
        testBlock(block);
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
        expect(block).to.include({ chain: 'BTC', network: 'regtest', height: tipHeight });
        testBlock(block);
        done();
      });
  });

  it('should get block by height on BTC', done => {
    request.get('/api/BTC/regtest/block/101').expect(200, (err, res) => {
      if (err) console.error(err);
      const block = res.body;
      expect(block).to.include(
        { chain: 'BTC', network: 'regtest', height: 101, confirmations: tipHeight - 101 + 1 }
      );
      testBlock(block);
      done();
    });
  });

  it('should get block by height on BCH', done => {
    request.get('/api/BCH/regtest/block/101').expect(200, (err, res) => {
      if (err) console.error(err);
      const block = res.body;
      expect(block).to.include({ chain: 'BCH', network: 'regtest', height: 101 });
      testBlock(block);
      done();
    });
  });

  const testCoins = (
    chain: string,
    network: string,
    blockHeight: number,
    txids: string[],
    inputs: string[],
    outputs: string[],
  ) => {
    const coinProps = {
      chain: 'string',
      network: 'string',
      coinbase: 'boolean',
      mintIndex: 'number',
      spentTxid: 'string',
      mintTxid: 'string',
      spentHeight: 'number',
      mintHeight: 'number',
      address: 'string',
      script: 'string',
      value: 'number',
      confirmations: 'number'
    };
    // expect a transaction input for every transaction except the mined/coinbase transaction
    expect(inputs.length).to.be.at.least(txids.length - 1);
    // every transaction must have an output by definition
    expect(outputs.length).to.be.at.least(txids.length);

    for (const input of inputs) {
      expect(input).to.include({ chain, network, spentHeight: blockHeight });
      expectObjectToHaveProps(input, coinProps);
    }
    for (const output of outputs) {
      expect(output).to.include({ chain, network, mintHeight: blockHeight });
      expectObjectToHaveProps(output, coinProps);
    }
  };

  let block100Hash;
  it('should fetch block 100 and save hash for other tests', done => {
    expect(block100Hash).to.be.undefined;
    request.get('/api/BTC/regtest/block/100').expect(200, (err, res) => {
      if (err) console.error(err);
      const block = res.body;
      block100Hash = block.hash;
      testBlock(block);
      done();
    });
  });

  it('should get coins by block hash', done => {
    request.get(`/api/BTC/regtest/block/${block100Hash}/coins/0/1`).expect(200, (err, res) => {
      if (err) console.error(err);
      const { txids, inputs, outputs } = res.body;
      testCoins('BTC', 'regtest', 100, txids, inputs, outputs);
      done();
    });
  });
      
  it('should get coins by block hash and limit coins to 3', done => {
    request.get(`/api/BTC/regtest/block/${block100Hash}/coins/3/1`).expect(200, (err, res) => {
      if (err) console.error(err);
      const { txids, inputs, outputs } = res.body;
      expect(txids.length).to.equal(3);
      testCoins('BTC', 'regtest', 100, txids, inputs, outputs);
      done();
    });
  });

  let pg1txids;
  it('should get coins by block hash and seperate into 2 pages (page 1)', done => {
    request.get(`/api/BTC/regtest/block/${block100Hash}/coins/3/1`).expect(200, (err, res) => {
      if (err) console.error(err);
      const { txids, inputs, outputs } = res.body;
      pg1txids = txids;
      testCoins('BTC', 'regtest', 100, txids, inputs, outputs);
      done();
    });
  });

  it('should get coins by block hash and seperate into 2 pages (page 2)', done => {
    request.get(`/api/BTC/regtest/block/${block100Hash}/coins/3/2`).expect(200, (err, res) => {
      if (err) console.error(err);
      const { txids, inputs, outputs } = res.body;
      expect(pg1txids).to.be.an.instanceof(Array);
      for (const txid of txids) {
        expect(pg1txids).to.not.contain(txid);
      }
      testCoins('BTC', 'regtest', 100, txids, inputs, outputs);
      done();
    });
  });

  let numTxsBlock100;
  it('should get number of transactions from block 100 for other tests', done => {
    request.get(`/api/BTC/regtest/block/${block100Hash}/coins/500/1`).expect(200, (err, res) => {
      if (err) console.error(err);
      const { txids, inputs, outputs } = res.body;
      numTxsBlock100 = txids.length;
      // the following tests assume block 100 has at least 6 transactions
      expect(numTxsBlock100).to.be.at.least(6);
      testCoins('BTC', 'regtest', 100, txids, inputs, outputs);
      done();
    });
  });

  it('should get coins by block hash and handle coin limit higher than number of coins', done => {
    request.get(`/api/BTC/regtest/block/${block100Hash}/coins/500/1`).expect(200, (err, res) => {
      if (err) console.error(err);
      const { txids, inputs, outputs } = res.body;
      expect(txids.length).to.equal(numTxsBlock100);
      testCoins('BTC', 'regtest', 100, txids, inputs, outputs);
      done();
    });
  });

  it('should get all coin data if no limit is specified (:limit == 0) on page 1', done => {
    request.get(`/api/BTC/regtest/block/${block100Hash}/coins/0/1`).expect(200, (err, res) => {
      if (err) console.error(err);
      const { txids, inputs, outputs } = res.body;
      expect(txids.length).to.equal(numTxsBlock100);
      testCoins('BTC', 'regtest', 100, txids, inputs, outputs);
      done();
    });
  });


  it('should get all coin data if no limit is specified (:limit == 0) on page 2', done => {
    request.get(`/api/BTC/regtest/block/${block100Hash}/coins/0/2`).expect(200, (err, res) => {
      if (err) console.error(err);
      const { txids, inputs, outputs } = res.body;
      expect(txids.length).to.equal(numTxsBlock100);
      testCoins('BTC', 'regtest', 100, txids, inputs, outputs);
      done();
    });
  });

  it('should skip all coins if :limit > num coins and :pgnum = 2', done => {
    request.get(`/api/BTC/regtest/block/${block100Hash}/coins/500/2`).expect(200, (err, res) => {
      if (err) console.error(err);
      const { txids, inputs, outputs } = res.body;
      expect(txids.length).to.equal(0);
      testCoins('BTC', 'regtest', 100, txids, inputs, outputs);
      done();
    });
  });

  it('should recieve 0 coins if requesting a page that is too high', done => {
    request.get(`/api/BTC/regtest/block/${block100Hash}/coins/${numTxsBlock100 - 1}/3`).expect(200, (err, res) => {
      if (err) console.error(err);
      const { txids, inputs, outputs } = res.body;
      expect(txids).to.be.empty;
      expect(inputs).to.be.empty;
      expect(outputs).to.be.empty;
      done();
    });
  });

  // Test route paging of coins when remainder == i (1..3)
  for (let i = 1; i <= 3; i++) {
    it(`should recieve partial pages with remainder ${i}`, done => {
      request.get(`/api/BTC/regtest/block/${block100Hash}/coins/${numTxsBlock100 - i}/2`).expect(200, (err, res) => {
        if (err) console.error(err);
        const { txids, inputs, outputs } = res.body;
        expect(txids).to.have.length(i);
        testCoins('BTC', 'regtest', 100, txids, inputs, outputs);
        done();
      });
    });
  }

  it('should get blocks before 20 minutes ago', done => {
    request.get(`/api/BTC/regtest/block/before-time/${minutesAgo(20)}`).expect(200, (err, res) => {
      if (err) console.error(err);
      const block = res.body;
      const { timeNormalized } = block;
      expect(new Date(timeNormalized).getTime()).to.be.lessThan(minutesAgo(20).getTime());
      expect(block).to.include({ chain: 'BTC', network: 'regtest' });
      testBlock(block);
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

  describe('EVM', function() {
    it('should get tip', done => {
      request.get('/api/BASE/testnet/block/tip').expect(200, (err, res) => {
        if (err) return done(err);
        const block = res.body;
        expect(block).to.include({ chain: 'BASE', network: 'sepolia' });
        expect(block).to.have.property('height').that.is.a('number');
        expect(block).to.have.property('hash').that.is.a('string').with.length(66);
        done();
      });
    });
  });
});
