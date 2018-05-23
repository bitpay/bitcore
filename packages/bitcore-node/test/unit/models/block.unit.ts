import { expect } from 'chai';
import { BlockModel } from '../../../src/models/block';
import { TransactionModel } from '../../../src/models/transaction';
import { CoinModel } from '../../../src/models/coin';
import * as sinon from 'sinon';

describe('Block Model', function () {
  it('should have a test which runs', function () {
    expect(true).to.equal(true);
  });

  // TODO: addBlock
  describe('addBlock', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should be able to add a block', () => {
      sandbox.stub(BlockModel, 'handleReorg').returns({
        handleReorg: sandbox.stub().returnsThis()
      });
      sandbox.stub(BlockModel, 'findOne').returns({
        findOne: sandbox.stub().returnsThis()
      });
      sandbox.stub(BlockModel, 'update').returns({
        update: sandbox.stub().returnsThis()
      });
      sandbox.stub(TransactionModel, 'batchImport').returns({
        batchImport: sandbox.stub().returnsThis()
      });

      const TEST_TX = {
        hash: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
        _hash: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
        isCoinbase: () => true,
        outputAmount: 0.09765625,
        inputs: [],
        outputs: [],
        nLockTime: 0,
        toBuffer: () => Buffer.from('')
      };

      const TEST_BLOCK = {
        hash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
        transactions: [TEST_TX],
        toBuffer: () => {
          return { length: 264 } as Buffer;
        },
        header: {
          toObject: () => {
            return {
              hash:
              '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
              confirmations: 1,
              strippedsize: 228,
              size: 264,
              weight: 948,
              height: 1355,
              version: '536870912',
              versionHex: '20000000',
              merkleRoot:
              '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
              tx: [
                '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08'
              ],
              time: 1526756523,
              mediantime: 1526066375,
              nonce: '2',
              bits: parseInt('207fffff', 16).toString(),
              difficulty: 4.656542373906925e-10,
              chainwork:
              '0000000000000000000000000000000000000000000000000000000000000a98',
              prevHash:
              '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
            };
          }
        }
      };

      const params = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1335
      }
      const result = BlockModel.addBlock(params, function(err, result) {
        expect(err).to.not.exist;
        expect(params.block.transactions).to.be.deep.equal(result.txs);
        expect(params.block.hash).to.be.equal(result.blockHash);
        expect(params.height).to.be.equal(result.height);
        expect(params.chain).to.be.equal(result.chain);
      });
    });
  });

  describe('getLocalTip', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should return with height zero if there are no blocks', async () => {
      sandbox.stub(BlockModel, 'findOne').returns({
        sort: sandbox.stub().returnsThis(),
        exec: sandbox.stub().returns(null, null)
      });
      const params = { chain: 'BTC', network: 'regtest' };
      const result = await BlockModel.getLocalTip(params);
      expect(result).to.deep.equal({ height: 0 });
    });
  });

  describe('getPoolInfo', () => {
    it('UNIMPLEMENTED: should return pool info given a coinbase string', () => {
      expect(() => {
        const result = BlockModel.getPoolInfo('');
      }).to.not.throw(TypeError);
    });
  });

  describe('getLocatorHashes', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should return 65 zeros if there are no processed blocks for the chain and network', function (done) {
      sandbox.stub(BlockModel, 'find').returns({
        sort: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        exec: sandbox.stub().yields(null, [])
      });
      const params = { chain: 'BTC', network: 'regtest' };
      const result = BlockModel.getLocatorHashes(params, function (err, result) {
        expect(err).to.not.exist;
        expect(result).to.deep.equal([Array(65).join('0')]);
        done();
      });
    });
  });

  //TODO: handleReorg
  describe('handleReorg', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should be able to reset head to a previous block', async () => {
      sandbox.stub(BlockModel, 'remove').returns({
        remove: sandbox.stub().returnsThis()
      });
      sandbox.stub(TransactionModel, 'remove').returns({
        remove: sandbox.stub().returnsThis()
      });
      sandbox.stub(CoinModel, 'remove').returns({
        remove: sandbox.stub().returnsThis()
      });
      sandbox.stub(CoinModel, 'update').returns({
        update: sandbox.stub().returnsThis()
      });

      const params = {
        header: {
          prevHash: 'prev123',
          hash: 'hash123',
          time: 0,
          version: 'test123',
          merkleRoot: 'fooBar',
          bits: 'bits123',
          nonce: 'random123'
        },
        chain: 'BTC',
        network: 'regtest'
      };
      const localTip = BlockModel.getLocalTip(params);
      expect(localTip.hash).to.not.equal(params.header.prevHash);
      expect(localTip.height).to.not.equal(0);
    });
  });

  describe('_apiTransform', () => {
    it('should return the transform object with block values', () => {
      const block = {
        chain: 'BTC',
        network: 'regtest',
        height: 0,
        hash: 'test123',
        version: 0,
        merkleRoot: 'fooBar',
        time: Date.now(),
        timeNormalized: Date.now(),
        nonce: 0,
        previousBlockHash: 'previous123',
        nextBlockHash: 'next123',
        transactionCount: 0,
        size: 0,
        bits: 0,
        reward: 0,
        processed: true,
      }

      const result = BlockModel._apiTransform(new BlockModel(block), { object: false });
      const parseResult = JSON.parse(result);

      expect(parseResult.hash).to.be.equal('test123');
      expect(parseResult.height).to.be.equal(0);
      expect(parseResult.version).to.be.equal(0);
      expect(parseResult.size).to.be.equal(0);
      expect(parseResult.merkleRoot).to.be.equal('fooBar');
      expect(parseResult.time).to.not.equal(Date.now());
      expect(parseResult.timeNormalized).to.not.equal(Date.now());
      expect(parseResult.nonce).to.be.equal(0);
      expect(parseResult.bits).to.be.equal(0);
      expect(parseResult.previousBlockHash).to.be.equal('previous123');
      expect(parseResult.nextBlockHash).to.be.equal('next123');
      expect(parseResult.transactionCount).to.be.equal(0);
    });
  });
});
