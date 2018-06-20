import { expect } from 'chai';
import { BlockModel } from '../../../src/models/block';
import { TransactionModel } from '../../../src/models/transaction';
import { CoinModel } from '../../../src/models/coin';
import * as sinon from 'sinon';
import { TEST_BLOCK } from '../../data/test-block';
import { AdapterProvider } from '../../../src/providers/adapter';
import { Adapter } from '../../../src/types/namespaces/ChainAdapter';
import { Bitcoin } from '../../../src/types/namespaces/Bitcoin';
import { Storage } from '../../../src/services/storage';

describe('Block Model', function() {
  describe('addBlock', () => {
    let addBlockParams: Adapter.ConvertBlockParams<Bitcoin.Block> = {
      chain: 'BTC',
      network: 'regtest',
      block: TEST_BLOCK,
      height: 1355
    };
    const internalBlock = AdapterProvider.convertBlock(addBlockParams);
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
        internalBlock
      );

      mockStorage(newBlock);
      sandbox.stub(BlockModel, 'handleReorg').resolves();
      sandbox.stub(TransactionModel, 'batchImport').resolves();

      const result = (await BlockModel.addBlock(addBlockParams)).result;
      expect(addBlockParams.block.hash).to.be.equal(result.hash);
      expect(addBlockParams.height).to.be.equal(result.height);
      expect(addBlockParams.chain).to.be.equal(result.chain);
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
      mockStorage(null);
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

    it('should return if localTip hash equals the previous hash', async () => {
      let blockModelRemoveSpy = sandbox.stub(BlockModel, 'remove').resolves();
      let transactionModelRemoveSpy = sandbox
        .stub(TransactionModel, 'remove')
        .resolves();
      let coinModelRemoveSpy = sandbox.stub(CoinModel, 'remove').resolves();
      let coinModelUpdateSpy = sandbox.stub(CoinModel, 'update').resolves();
      let blockModelGetLocalTipSpy = sandbox
        .stub(BlockModel, 'getLocalTip')
        .returns({
          hash:
          '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
        });

      const params = {
        header: {
          prevHash:
          '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9',
          hash:
          '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
          time: 1526756523,
          version: '536870912',
          merkleRoot:
          '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
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
      expect(blockModelGetLocalTipSpy.notCalled).to.be.false;
    });

    it('should return if localTip height is zero', async () => {
      let blockModelRemoveSpy = sandbox.stub(BlockModel, 'remove').resolves();
      let transactionModelRemoveSpy = sandbox
        .stub(TransactionModel, 'remove')
        .resolves();
      let coinModelRemoveSpy = sandbox.stub(CoinModel, 'remove').resolves();
      let coinModelUpdateSpy = sandbox.stub(CoinModel, 'update').resolves();
      let blockModelGetLocalTipSpy = sandbox
        .stub(BlockModel, 'getLocalTip')
        .returns({
          height: 0
        });

      let blockMethodParams: Adapter.ConvertBlockParams<Bitcoin.Block> = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      const internalBlock = AdapterProvider.convertBlock(blockMethodParams);
      let params = Object.assign(BlockModel, internalBlock);

      await BlockModel.handleReorg(params);
      expect(blockModelRemoveSpy.notCalled).to.be.true;
      expect(transactionModelRemoveSpy.notCalled).to.be.true;
      expect(coinModelRemoveSpy.notCalled).to.be.true;
      expect(coinModelUpdateSpy.notCalled).to.be.true;
      expect(blockModelGetLocalTipSpy.notCalled).to.be.false;
    });

    it('should call blockModel remove', async () => {
      mockStorage({
        height: 1,
        previousBlockHash:
        '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });
      let blockMethodParams: Adapter.ConvertBlockParams<Bitcoin.Block> = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      const internalBlock = AdapterProvider.convertBlock(blockMethodParams);
      let params = Object.assign(BlockModel, internalBlock);
      const removeSpy = Storage.db!.collection('blocks')
        .remove as sinon.SinonSpy;

      await BlockModel.handleReorg(params);
      expect(removeSpy.called).to.be.true;
    });

    it('should call transactionModel remove', async () => {
      mockStorage({
        height: 1,
        previousBlockHash:
        '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      let blockMethodParams: Adapter.ConvertBlockParams<Bitcoin.Block> = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      const internalBlock = AdapterProvider.convertBlock(blockMethodParams);
      let params = Object.assign(BlockModel, internalBlock);
      const removeSpy = Storage.db!.collection('transactions')
        .remove as sinon.SinonSpy;

      await BlockModel.handleReorg(params);
      expect(removeSpy.called).to.be.true;
    });

    it('should call coinModel remove', async () => {
      mockStorage({
        height: 1,
        previousBlockHash:
        '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      let blockMethodParams: Adapter.ConvertBlockParams<Bitcoin.Block> = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      const internalBlock = AdapterProvider.convertBlock(blockMethodParams);
      let params = Object.assign(BlockModel, internalBlock);
      const collectionSpy = Storage.db!.collection as sinon.SinonSpy;
      const removeSpy = Storage.db!.collection('coins')
        .remove as sinon.SinonSpy;

      await BlockModel.handleReorg(params);
      expect(collectionSpy.calledOnceWith('coins'));
      expect(removeSpy.callCount).to.eq(3);
    });

    it('should call coinModel update', async () => {
      mockStorage({
        height: 1,
        previousBlockHash:
        '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      });

      let blockMethodParams: Adapter.ConvertBlockParams<Bitcoin.Block> = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      const internalBlock = AdapterProvider.convertBlock(blockMethodParams);
      let params = Object.assign(BlockModel, internalBlock);
      const collectionSpy = Storage.db!.collection as sinon.SinonSpy;
      const updateSpy = Storage.db!.collection('coins')
        .update as sinon.SinonSpy;

      await BlockModel.handleReorg(params);
      expect(collectionSpy.calledOnceWith('coins'));
      expect(updateSpy.called).to.be.true;
    });
  });

  describe('_apiTransform', () => {
    it('should return the transform object with block values', () => {
      let params: Adapter.ConvertBlockParams<Bitcoin.Block> = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      const block = AdapterProvider.convertBlock(params);

      const result = BlockModel._apiTransform(block, {
        object: false
      }).toString();
      const parseResult = JSON.parse(result);

      expect(parseResult.hash).to.be.equal(block.hash);
      expect(parseResult.height).to.be.equal(block.height);
      expect(parseResult.version).to.be.equal(block.version);
      expect(parseResult.size).to.be.equal(block.size);
      expect(parseResult.merkleRoot).to.be.equal(block.merkleRoot);
      expect(parseResult.time).to.equal(block.time);
      expect(parseResult.timeNormalized).to.equal(block.timeNormalized);
      expect(parseResult.nonce).to.be.equal(block.nonce);
      expect(parseResult.bits).to.be.equal(block.bits);
      expect(parseResult.previousBlockHash).to.be.equal(
        block.previousBlockHash
      );
      expect(parseResult.nextBlockHash).to.be.equal(block.nextBlockHash);
      expect(parseResult.transactionCount).to.be.equal(block.transactionCount);
    });
  });
});

function mockStorage(toReturn, collectionMethods = {}) {
  const mock = Object.assign(
    {
      find: sinon.stub().returnsThis(),
      sort: sinon.stub().returnsThis(),
      remove: sinon.stub().resolves(),
      limit: sinon.stub().returnsThis(),
      toArray: sinon.stub().resolves([toReturn]),
      findOne: sinon.stub().resolves(toReturn),
      update: sinon.stub().resolves({ result: toReturn }),
      updateOne: sinon.stub().resolves(toReturn)
    },
    collectionMethods
  );
  Storage.db = {
    collection: sinon.stub().returns(mock)
  } as any;
  return Storage;
}
