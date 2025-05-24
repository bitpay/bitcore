import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'assert';
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
  const sandbox = sinon.createSandbox();

  before(unitBeforeHelper);
  after(unitAfterHelper);

  afterEach(function() {
    sandbox.restore();
  });

  const addBlockParams = {
    chain: 'BTC',
    network: 'regtest',
    block: TEST_BLOCK,
    height: 1355,
    initialSyncComplete: false,
    processed: true
  };

  describe('addBlock', () => {
    it('should be able to add a block', async () => {
      const newBlock = Object.assign({ save: () => Promise.resolve() }, BitcoinBlockStorage, addBlockParams);

      mockStorage(newBlock);
      sandbox.stub(BitcoinBlockStorage, 'handleReorg').resolves();
      sandbox.stub(TransactionStorage, 'batchImport').resolves();

      const result = await BitcoinBlockStorage.addBlock(addBlockParams);
      assert.equal(result, null, 'result should not exist');
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
      assert.strictEqual(options.limit, 100);
      assert.deepEqual(query._id, { $lt: id });
      assert.deepEqual(options.sort, { _id: -1 });
    });

    it('should default to descending', () => {
      const id = new ObjectID();
      const { query, options } = Storage.getFindOptions<MongoBound<IBtcBlock>>(BitcoinBlockStorage, {
        since: id,
        paging: '_id',
        limit: 100
      });
      assert.deepEqual(options.sort, { _id: -1 });
      assert.strictEqual(options.limit, 100);
      assert.deepEqual(query._id, { $lt: id });
    });

    it('should allow ascending', () => {
      const id = new ObjectID();
      const { query, options } = Storage.getFindOptions<MongoBound<IBtcBlock>>(BitcoinBlockStorage, {
        since: id,
        paging: '_id',
        limit: 100,
        direction: 1
      });
      assert.deepEqual(options.sort, { _id: 1 });
      assert.strictEqual(options.limit, 100);
      assert.deepEqual(query._id, { $gt: id });
    });
  });

  describe('getLocalTip', () => {
    it('should return the new tip', async () => {
      let newBlock = Object.assign({ save: () => Promise.resolve() }, BitcoinBlockStorage, addBlockParams);
      mockStorage(newBlock);
      const params = { chain: 'BTC', network: 'regtest' };
      const result = await ChainStateProvider.getLocalTip(params);
      assert.deepEqual(result!.height, addBlockParams.height);
      assert.deepEqual(result!.chain, addBlockParams.chain);
      assert.deepEqual(result!.network, addBlockParams.network);
    });
  });

  describe('getPoolInfo', () => {
    it.skip('should return pool info given a coinbase string');
  });

  describe('getLocatorHashes', () => {
    it('should return 65 zeros if there are no processed blocks for the chain and network', async () => {
      const params = { chain: 'BTC', network: 'regtest' };
      const result = await ChainStateProvider.getLocatorHashes(params);
      assert.deepEqual(result, [Array(65).join('0')]);
    });
  });

  describe('handleReorg', () => {
    it('should return if localTip hash equals the previous hash', async () => {
      Object.assign(BitcoinBlockStorage.collection, mockCollection(null));
      Object.assign(TransactionStorage.collection, mockCollection(null));
      Object.assign(CoinStorage.collection, mockCollection(null));
      const blockModelRemoveSpy = BitcoinBlockStorage.collection.deleteMany as sinon.SinonSpy;
      const transactionModelRemoveSpy = TransactionStorage.collection.deleteMany as sinon.SinonSpy;
      const coinModelRemoveSpy = CoinStorage.collection.deleteMany as sinon.SinonSpy;
      const coinModelUpdateSpy = CoinStorage.collection.updateMany as sinon.SinonSpy;

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
      assert.strictEqual(blockModelRemoveSpy.notCalled, true);
      assert.strictEqual(transactionModelRemoveSpy.notCalled, true);
      assert.strictEqual(coinModelRemoveSpy.notCalled, true);
      assert.strictEqual(coinModelUpdateSpy.notCalled, true);
    });

    it('should return if localTip height is zero', async () => {
      const blockModelRemoveSpy = BitcoinBlockStorage.collection.deleteMany as sinon.SinonSpy;
      const transactionModelRemoveSpy = TransactionStorage.collection.deleteMany as sinon.SinonSpy;
      const coinModelRemoveSpy = CoinStorage.collection.deleteMany as sinon.SinonSpy;
      const coinModelUpdateSpy = CoinStorage.collection.updateMany as sinon.SinonSpy;

      const blockMethodParams = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      const params = Object.assign(BitcoinBlockStorage, blockMethodParams);

      await BitcoinBlockStorage.handleReorg(params);
      assert.strictEqual(blockModelRemoveSpy.notCalled, true);
      assert.strictEqual(transactionModelRemoveSpy.notCalled, true);
      assert.strictEqual(coinModelRemoveSpy.notCalled, true);
      assert.strictEqual(coinModelUpdateSpy.notCalled, true);
    });

    it('should call blockModel deleteMany', async () => {
      mockStorage({
        height: 1,
        previousBlockHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });
      const blockMethodParams = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      const params = Object.assign(BitcoinBlockStorage, blockMethodParams);
      const removeSpy = BitcoinBlockStorage.collection.deleteMany as sinon.SinonSpy;

      await BitcoinBlockStorage.handleReorg(params);
      assert.strictEqual(removeSpy.called, true);
    });

    it('should call transactionModel deleteMany', async () => {
      mockStorage({
        height: 1,
        previousBlockHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      const blockMethodParams = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      const params = Object.assign(BitcoinBlockStorage, blockMethodParams);
      const removeSpy = TransactionStorage.collection.deleteMany as sinon.SinonSpy;

      await BitcoinBlockStorage.handleReorg(params);
      assert.strictEqual(removeSpy.called, true);
    });

    it('should call coinModel deleteMany', async () => {
      mockStorage({
        height: 1,
        previousBlockHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      const blockMethodParams = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      const params = Object.assign(BitcoinBlockStorage, blockMethodParams);
      const collectionSpy = Storage.db!.collection as sinon.SinonSpy;
      const coinRemoveSpy = CoinStorage.collection.deleteMany as sinon.SinonSpy;

      await BitcoinBlockStorage.handleReorg(params);
      assert.strictEqual(collectionSpy.calledWith('coins'), true);
      assert.strictEqual(coinRemoveSpy.callCount, 3);
    });

    it('should call coinModel update', async () => {
      mockStorage({
        height: 1,
        previousBlockHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      const blockMethodParams = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      const params = Object.assign(BitcoinBlockStorage, blockMethodParams);
      const collectionSpy = Storage.db!.collection as sinon.SinonSpy;
      const updateSpy = CoinStorage.collection.updateMany as sinon.SinonSpy;

      await BitcoinBlockStorage.handleReorg(params);
      assert.strictEqual(collectionSpy.calledWith('coins'), true);
      assert.strictEqual(updateSpy.called, true);
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

      assert.strictEqual(result.hash, block.hash);
      assert.strictEqual(result.height, block.height);
      assert.strictEqual(result.version, block.version);
      assert.strictEqual(result.size, block.size);
      assert.strictEqual(result.merkleRoot, block.merkleRoot);
      assert.strictEqual(result.time, block.time);
      assert.strictEqual(result.timeNormalized, block.timeNormalized);
      assert.strictEqual(result.nonce, block.nonce);
      assert.strictEqual(result.bits, block.bits);
      assert.strictEqual(result.previousBlockHash, block.previousBlockHash);
      assert.strictEqual(result.nextBlockHash, block.nextBlockHash);
      assert.strictEqual(result.transactionCount, block.transactionCount);
      assert.strictEqual(Object.hasOwn(result, 'processed'), false);
    });
  });
});
