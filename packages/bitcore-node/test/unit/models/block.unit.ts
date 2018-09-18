import { expect } from 'chai';
import { BlockModel, IBlock } from '../../../src/models/block';
import { TransactionModel } from '../../../src/models/transaction';
import { CoinModel } from '../../../src/models/coin';
import * as sinon from 'sinon';
import { TEST_BLOCK } from '../../data/test-block';
import { Storage } from '../../../src/services/storage';
import { mockStorage } from '../../helpers';
import { mockCollection } from '../../helpers/index.js';
import { ChainStateProvider } from '../../../src/providers/chain-state';
import { ObjectID } from 'mongodb';
import { MongoBound } from '../../../src/models/base';

describe('Block Model', function() {
  describe('addBlock', () => {
    let addBlockParams = {
      chain: 'BTC',
      network: 'regtest',
      block: TEST_BLOCK,
      height: 1355,
      initialSyncComplete: false
    };
    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should be able to add a block', async () => {
      let newBlock = Object.assign({ save: () => Promise.resolve() }, BlockModel, addBlockParams);

      mockStorage(newBlock);
      sandbox.stub(BlockModel, 'handleReorg').resolves();
      sandbox.stub(TransactionModel, 'batchImport').resolves();

      const result = await BlockModel.addBlock(addBlockParams);
      expect(result);
    });
  });

  describe('BlockModel find options', () => {
    it('should be able to create query options', () => {
      const id = new ObjectID();
      const { query, options } = Storage.getFindOptions<MongoBound<IBlock>>(BlockModel, {
        since: id,
        paging: '_id',
        limit: 100,
        direction: -1
      });
      expect(options.limit).to.be.eq(100);
      expect(query._id).to.be.deep.eq({ $lt: id });
      expect(options.sort).to.be.deep.eq({ _id: -1 });
    });

    it('should default to descending', () => {
      const id = new ObjectID();
      const { query, options } = Storage.getFindOptions<MongoBound<IBlock>>(BlockModel, {
        since: id,
        paging: '_id',
        limit: 100,
      });
      expect(options.sort).to.be.deep.eq({ _id: -1 });
      expect(options.limit).to.be.eq(100);
      expect(query._id).to.be.deep.eq({ $lt: id });
    });

    it('should allow ascending', () => {
      const id = new ObjectID();
      const { query, options } = Storage.getFindOptions<MongoBound<IBlock>>(BlockModel, {
        since: id,
        paging: '_id',
        limit: 100,
        direction: 1
      });
      expect(options.sort).to.be.deep.eq({ _id: 1 });
      expect(options.limit).to.be.eq(100);
      expect(query._id).to.be.deep.eq({ $gt: id });
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
    it('should return null if there are no blocks', async () => {
      mockStorage(null);
      const params = { chain: 'BTC', network: 'regtest' };
      const result = await ChainStateProvider.getLocalTip(params);
      expect(result).to.deep.equal(null);
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
      const params = { chain: 'BTC', network: 'regtest' };
      const result = await ChainStateProvider.getLocatorHashes(params);
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

    it('should return if localTip hash equals the previous hash', async () => {
      Object.assign(BlockModel.collection, mockCollection(null));
      Object.assign(TransactionModel.collection, mockCollection(null));
      Object.assign(CoinModel.collection, mockCollection(null));
      let blockModelRemoveSpy = BlockModel.collection.deleteMany as sinon.SinonSpy;
      let transactionModelRemoveSpy = TransactionModel.collection.deleteMany as sinon.SinonSpy;
      let coinModelRemoveSpy = CoinModel.collection.deleteMany as sinon.SinonSpy;
      let coinModelUpdateSpy = CoinModel.collection.updateMany as sinon.SinonSpy;

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

      await BlockModel.handleReorg(params);
      expect(blockModelRemoveSpy.notCalled).to.be.true;
      expect(transactionModelRemoveSpy.notCalled).to.be.true;
      expect(coinModelRemoveSpy.notCalled).to.be.true;
      expect(coinModelUpdateSpy.notCalled).to.be.true;
    });

    it('should return if localTip height is zero', async () => {
      let blockModelRemoveSpy = BlockModel.collection.deleteMany as sinon.SinonSpy;
      let transactionModelRemoveSpy = TransactionModel.collection.deleteMany as sinon.SinonSpy;
      let coinModelRemoveSpy = CoinModel.collection.deleteMany as sinon.SinonSpy;
      let coinModelUpdateSpy = CoinModel.collection.updateMany as sinon.SinonSpy;

      let blockMethodParams = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      let params = Object.assign(BlockModel, blockMethodParams);

      await BlockModel.handleReorg(params);
      expect(blockModelRemoveSpy.notCalled).to.be.true;
      expect(transactionModelRemoveSpy.notCalled).to.be.true;
      expect(coinModelRemoveSpy.notCalled).to.be.true;
      expect(coinModelUpdateSpy.notCalled).to.be.true;
    });

    it('should call blockModel deleteMany', async () => {
      mockStorage({
        height: 1,
        previousBlockHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });
      let blockMethodParams = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      let params = Object.assign(BlockModel, blockMethodParams);
      const removeSpy = BlockModel.collection.deleteMany as sinon.SinonSpy;

      await BlockModel.handleReorg(params);
      expect(removeSpy.called).to.be.true;
    });

    it('should call transactionModel deleteMany', async () => {
      mockStorage({
        height: 1,
        previousBlockHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      let blockMethodParams = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      let params = Object.assign(BlockModel, blockMethodParams);
      const removeSpy = TransactionModel.collection.deleteMany as sinon.SinonSpy;

      await BlockModel.handleReorg(params);
      expect(removeSpy.called).to.be.true;
    });

    it('should call coinModel deleteMany', async () => {
      mockStorage({
        height: 1,
        previousBlockHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      let blockMethodParams = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      let params = Object.assign(BlockModel, blockMethodParams);
      const collectionSpy = Storage.db!.collection as sinon.SinonSpy;
      const removeSpy = CoinModel.collection.deleteMany as sinon.SinonSpy;

      await BlockModel.handleReorg(params);
      expect(collectionSpy.calledOnceWith('coins'));
      expect(removeSpy.callCount).to.eq(3);
    });

    it('should call coinModel update', async () => {
      mockStorage({
        height: 1,
        previousBlockHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      let blockMethodParams = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      let params = Object.assign(BlockModel, blockMethodParams);
      const collectionSpy = Storage.db!.collection as sinon.SinonSpy;
      const updateSpy = CoinModel.collection.updateMany as sinon.SinonSpy;

      await BlockModel.handleReorg(params);
      expect(collectionSpy.calledOnceWith('coins'));
      expect(updateSpy.called).to.be.true;
    });
  });

  describe('_apiTransform', () => {
    it('should return the transform object with block values', () => {
      const block: IBlock = {
        chain: 'BTC',
        network: 'mainnet',
        height: 1,
        hash: 'abcd',
        version: 1,
        merkleRoot: 'deff',
        time: new Date(),
        timeNormalized: new Date(),
        nonce: 1,
        previousBlockHash: 'aabb',
        nextBlockHash: 'bbcc',
        transactionCount: 1,
        size: 255,
        bits: 256,
        reward: 5000000000,
        processed: true
      };

      const result = BlockModel._apiTransform(block, { object: true });

      expect(result.hash).to.be.equal(block.hash);
      expect(result.height).to.be.equal(block.height);
      expect(result.version).to.be.equal(block.version);
      expect(result.size).to.be.equal(block.size);
      expect(result.merkleRoot).to.be.equal(block.merkleRoot);
      expect(result.time).to.equal(block.time);
      expect(result.timeNormalized).to.equal(block.timeNormalized);
      expect(result.nonce).to.be.equal(block.nonce);
      expect(result.bits).to.be.equal(block.bits);
      expect(result.previousBlockHash).to.be.equal(block.previousBlockHash);
      expect(result.nextBlockHash).to.be.equal(block.nextBlockHash);
      expect(result.transactionCount).to.be.equal(block.transactionCount);
      expect(result).to.not.have.property('processed');
    });
  });
});
