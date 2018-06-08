import { expect } from 'chai';
import { BlockModel } from '../../../src/models/block';
import { TransactionModel } from '../../../src/models/transaction';
import { CoinModel } from '../../../src/models/coin';
import * as sinon from 'sinon';
import { TEST_BLOCK, TEST_CORE_BLOCK, TEST_MONGO_BLOCK } from '../../data/test-block';

describe('Block Model', function () {

  describe('addBlock', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should be able to add a block', async () => {
      let newBlock = Object.assign(
        { save: () => Promise.resolve() },
        BlockModel,
        TEST_MONGO_BLOCK
      );
      sandbox.stub(BlockModel, 'handleReorg').resolves();
      sandbox.stub(BlockModel, 'findOne').resolves(newBlock);
      sandbox.stub(BlockModel, 'update').resolves(newBlock);
      sandbox.stub(newBlock, 'save').resolves();
      sandbox.stub(TransactionModel, 'batchImport').resolves();

      const result = await BlockModel.addBlock(TEST_CORE_BLOCK);
      // TODO: if `update` is stubbed out to return `newBlock`, then
      // this test just tests if `addBlock` calls returns the result from update
      expect(TEST_BLOCK.hash).to.be.equal(result.hash);
      expect('BTC').to.be.equal(result.chain);
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
        sort: sandbox.stub().resolves(null),
        exec: sandbox.stub().resolves(null)
      });
      const params = { chain: 'BTC', network: 'regtest' };
      const result = await BlockModel.getLocalTip(params);
      expect(result).to.deep.equal({ height: 0 });
    });
  });

  describe('getPoolInfo', () => {
    xit('should return pool info given a coinbase string');
  });

  describe('getLocatorHashes', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should return 65 zeros if there are no processed blocks for the chain and network', async () => {
      sandbox.stub(BlockModel, 'find').returns({
        sort: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        exec: sandbox.stub().returns(Promise.resolve([]))
      });
      const params = { chain: 'BTC', network: 'regtest' };
      const result = await BlockModel.getLocatorHashes(params);
      expect(result).to.deep.equal([Array(65).join('0')]);
    });
  });

  describe('handleReorg', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
      sandbox.restore();
    });

    const chainnet = {
      chain: 'BTC',
      network: 'regtest',
    };

    it('should return if localTip hash equals the previous hash', async () => {
      let blockModelRemoveSpy = sandbox.stub(BlockModel, 'remove').resolves();
      let transactionModelRemoveSpy = sandbox.stub(TransactionModel, 'remove').resolves();
      let coinModelRemoveSpy = sandbox.stub(CoinModel, 'remove').resolves();
      let coinModelUpdateSpy = sandbox.stub(CoinModel, 'update').resolves();
      let blockModelGetLocalTipSpy = sandbox.stub(BlockModel, 'getLocalTip').returns({
        hash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      const params = {
        header: {
          prevHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9',
          hash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
          time: 1526756523,
          version: '536870912',
          merkleRoot: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
          bits: parseInt('207fffff', 16).toString(),
          nonce: '2'
        },
        chain: 'BTC',
        network: 'regtest'
      };

      await BlockModel.handleReorg(params.header.prevHash, params);
      expect(blockModelRemoveSpy.notCalled).to.be.true;
      expect(transactionModelRemoveSpy.notCalled).to.be.true;
      expect(coinModelRemoveSpy.notCalled).to.be.true;
      expect(coinModelUpdateSpy.notCalled).to.be.true;
      expect(blockModelGetLocalTipSpy.notCalled).to.be.false;

    });

    it('should return if localTip height is zero', async () => {
      let blockModelRemoveSpy = sandbox.stub(BlockModel, 'remove').resolves();
      let transactionModelRemoveSpy = sandbox.stub(TransactionModel, 'remove').resolves();
      let coinModelRemoveSpy = sandbox.stub(CoinModel, 'remove').resolves();
      let coinModelUpdateSpy = sandbox.stub(CoinModel, 'update').resolves();
      let blockModelGetLocalTipSpy = sandbox.stub(BlockModel, 'getLocalTip').returns({
        height: 0
      });

      await BlockModel.handleReorg(TEST_CORE_BLOCK.header.prevHash, chainnet);
      expect(blockModelRemoveSpy.notCalled).to.be.true;
      expect(transactionModelRemoveSpy.notCalled).to.be.true;
      expect(coinModelRemoveSpy.notCalled).to.be.true;
      expect(coinModelUpdateSpy.notCalled).to.be.true;
      expect(blockModelGetLocalTipSpy.notCalled).to.be.false;
    });

    it('should call blockModel remove', async () => {
      let blockModelRemoveSpy = sandbox.stub(BlockModel, 'remove').resolves();
      sandbox.stub(TransactionModel, 'remove').resolves();
      sandbox.stub(CoinModel, 'remove').resolves();
      sandbox.stub(CoinModel, 'update').resolves();
      sandbox.stub(BlockModel, 'getLocalTip').returns({
        height: 1,
        previousBlockHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      await BlockModel.handleReorg(TEST_CORE_BLOCK.header.prevHash, chainnet);
      expect(blockModelRemoveSpy.calledOnce).to.be.true;
    });

    it('should call transactionModel remove', async () => {
      sandbox.stub(BlockModel, 'remove').resolves();
      let transactionModelRemoveSpy = sandbox.stub(TransactionModel, 'remove').resolves();
      sandbox.stub(CoinModel, 'remove').resolves();
      sandbox.stub(CoinModel, 'update').resolves();
      sandbox.stub(BlockModel, 'getLocalTip').returns({
        height: 1,
        previousBlockHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      await BlockModel.handleReorg(TEST_CORE_BLOCK.header.prevHash, chainnet);
      expect(transactionModelRemoveSpy.calledOnce).to.be.true;
    });

    it('should call coinModel remove', async () => {
      sandbox.stub(BlockModel, 'remove').resolves();
      sandbox.stub(TransactionModel, 'remove').resolves();
      let coinModelRemoveSpy = sandbox.stub(CoinModel, 'remove').resolves();
      sandbox.stub(CoinModel, 'update').resolves();
      sandbox.stub(BlockModel, 'getLocalTip').returns({
        height: 1,
        previousBlockHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      await BlockModel.handleReorg(TEST_CORE_BLOCK.header.prevHash, chainnet);
      expect(coinModelRemoveSpy.calledOnce).to.be.true;
    });

    it('should call coinModel update', async () => {
      sandbox.stub(BlockModel, 'remove').resolves();
      sandbox.stub(TransactionModel, 'remove').resolves();
      sandbox.stub(CoinModel, 'remove').resolves();
      let coinModelUpdateSpy = sandbox.stub(CoinModel, 'update').resolves();
      sandbox.stub(BlockModel, 'getLocalTip').returns({
        height: 1,
        previousBlockHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      await BlockModel.handleReorg(TEST_CORE_BLOCK.header.prevHash, chainnet);
      expect(coinModelUpdateSpy.calledOnce).to.be.true;
    });
  });

  describe('_apiTransform', () => {
    it('should return the transform object with block values', () => {
      const block = new BlockModel(TEST_MONGO_BLOCK);
      const result = BlockModel._apiTransform(block, { 'object': false });
      const parseResult = JSON.parse(result);

      expect(parseResult.hash).to.be.equal(block.hash);
      expect(parseResult.version).to.be.equal(block.version);
      expect(parseResult.size).to.be.equal(block.size);
      expect(parseResult.merkleRoot).to.be.equal(block.merkleRoot);
      expect(parseResult.time).to.not.equal(block.time);
      expect(parseResult.nonce).to.be.equal(block.nonce);
      expect(parseResult.bits).to.be.equal(block.bits);
      expect(parseResult.previousBlockHash).to.be.equal(block.previousBlockHash);
      expect(parseResult.transactionCount).to.be.equal(block.transactionCount);
    });
  });
});
