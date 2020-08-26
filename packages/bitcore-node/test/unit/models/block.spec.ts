import { expect } from 'chai';
import { ObjectID } from 'mongodb';
import * as sinon from 'sinon';
import { MongoBound } from '../../../src/models/base';
import { BitcoinBlockStorage } from '../../../src/models/block';
import { IBtcBlock } from '../../../src/models/block';
import { CoinStorage } from '../../../src/models/coin';
import { TransactionStorage } from '../../../src/models/transaction';
import { ChainStateProvider } from '../../../src/providers/chain-state';
import { Storage } from '../../../src/services/storage';
import { TEST_BLOCK } from '../../data/test-block';
import { mockStorage } from '../../helpers';
import { mockCollection } from '../../helpers/index.js';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

describe('Block Model', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  let addBlockParams = {
    chain: 'BTC',
    network: 'regtest',
    block: TEST_BLOCK,
    height: 1355,
    initialSyncComplete: false,
    processed: true
  };

  describe('addBlock', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should be able to add a block', async () => {
      let newBlock = Object.assign({ save: () => Promise.resolve() }, BitcoinBlockStorage, addBlockParams);

      mockStorage(newBlock);
      sandbox.stub(BitcoinBlockStorage, 'handleReorg').resolves();
      sandbox.stub(TransactionStorage, 'batchImport').resolves();

      const result = await BitcoinBlockStorage.addBlock(addBlockParams);
      expect(result);
    });
  });

  describe('BlockModel find options', () => {
    it('should be able to create query options', () => {
      const id = new ObjectID();
      const { query, options } = Storage.getFindOptions<MongoBound<IBtcBlock>>(BitcoinBlockStorage, {
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
      const { query, options } = Storage.getFindOptions<MongoBound<IBtcBlock>>(BitcoinBlockStorage, {
        since: id,
        paging: '_id',
        limit: 100
      });
      expect(options.sort).to.be.deep.eq({ _id: -1 });
      expect(options.limit).to.be.eq(100);
      expect(query._id).to.be.deep.eq({ $lt: id });
    });

    it('should allow ascending', () => {
      const id = new ObjectID();
      const { query, options } = Storage.getFindOptions<MongoBound<IBtcBlock>>(BitcoinBlockStorage, {
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
    it('should return the new tip', async () => {
      let newBlock = Object.assign({ save: () => Promise.resolve() }, BitcoinBlockStorage, addBlockParams);
      mockStorage(newBlock);
      const params = { chain: 'BTC', network: 'regtest' };
      const result = await ChainStateProvider.getLocalTip(params);
      expect(result!.height).to.deep.equal(addBlockParams.height);
      expect(result!.chain).to.deep.equal(addBlockParams.chain);
      expect(result!.network).to.deep.equal(addBlockParams.network);
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
      Object.assign(BitcoinBlockStorage.collection, mockCollection(null));
      Object.assign(TransactionStorage.collection, mockCollection(null));
      Object.assign(CoinStorage.collection, mockCollection(null));
      let blockModelRemoveSpy = BitcoinBlockStorage.collection.deleteMany as sinon.SinonSpy;
      let transactionModelRemoveSpy = TransactionStorage.collection.deleteMany as sinon.SinonSpy;
      let coinModelRemoveSpy = CoinStorage.collection.deleteMany as sinon.SinonSpy;
      let coinModelUpdateSpy = CoinStorage.collection.updateMany as sinon.SinonSpy;

      const params = {
        header: {
          prevHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9',
          hash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
          time: 1526756523,
          version: 536870912,
          merkleRoot: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
          bits: parseInt('207fffff', 16),
          nonce: 2
        },
        chain: 'BTC',
        network: 'regtest'
      };

      await BitcoinBlockStorage.handleReorg(params);
      expect(blockModelRemoveSpy.notCalled).to.be.true;
      expect(transactionModelRemoveSpy.notCalled).to.be.true;
      expect(coinModelRemoveSpy.notCalled).to.be.true;
      expect(coinModelUpdateSpy.notCalled).to.be.true;
    });

    it('should return if localTip height is zero', async () => {
      let blockModelRemoveSpy = BitcoinBlockStorage.collection.deleteMany as sinon.SinonSpy;
      let transactionModelRemoveSpy = TransactionStorage.collection.deleteMany as sinon.SinonSpy;
      let coinModelRemoveSpy = CoinStorage.collection.deleteMany as sinon.SinonSpy;
      let coinModelUpdateSpy = CoinStorage.collection.updateMany as sinon.SinonSpy;

      let blockMethodParams = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      let params = Object.assign(BitcoinBlockStorage, blockMethodParams);

      await BitcoinBlockStorage.handleReorg(params);
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
      let params = Object.assign(BitcoinBlockStorage, blockMethodParams);
      const removeSpy = BitcoinBlockStorage.collection.deleteMany as sinon.SinonSpy;

      await BitcoinBlockStorage.handleReorg(params);
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
      let params = Object.assign(BitcoinBlockStorage, blockMethodParams);
      const removeSpy = TransactionStorage.collection.deleteMany as sinon.SinonSpy;

      await BitcoinBlockStorage.handleReorg(params);
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
      let params = Object.assign(BitcoinBlockStorage, blockMethodParams);
      const collectionSpy = Storage.db!.collection as sinon.SinonSpy;
      const removeSpy = CoinStorage.collection.deleteMany as sinon.SinonSpy;

      await BitcoinBlockStorage.handleReorg(params);
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
      let params = Object.assign(BitcoinBlockStorage, blockMethodParams);
      const collectionSpy = Storage.db!.collection as sinon.SinonSpy;
      const updateSpy = CoinStorage.collection.updateMany as sinon.SinonSpy;

      await BitcoinBlockStorage.handleReorg(params);
      expect(collectionSpy.calledOnceWith('coins'));
      expect(updateSpy.called).to.be.true;
    });
  });

  describe('_apiTransform', () => {
    it('should return the transform object with block values', () => {
      const block: IBtcBlock = {
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

      const result = BitcoinBlockStorage._apiTransform(block, { object: true });

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
