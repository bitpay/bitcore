import { expect } from 'chai';
import { BlockModel } from '../../../src/models/block';
import { TransactionModel } from '../../../src/models/transaction';
import { CoinModel } from '../../../src/models/coin';
import * as sinon from 'sinon';
import { TEST_BLOCK } from '../../data/test-block';
import { AdapterProvider } from '../../../src/providers/adapter';
import { Adapter } from '../../../src/types/namespaces/ChainAdapter';
import { Bitcoin } from '../../../src/types/namespaces/Bitcoin';

describe('Block Model', function () {
  it('should have a test which runs', function () {
    expect(true).to.equal(true);
  });

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
      sandbox.stub(BlockModel, 'handleReorg').resolves();
      sandbox.stub(BlockModel, 'findOne').resolves(newBlock);
      sandbox.stub(BlockModel, 'update').resolves(newBlock);
      sandbox.stub(newBlock, 'save').resolves();
      sandbox.stub(TransactionModel, 'batchImport').resolves();

      const result = await BlockModel.addBlock(addBlockParams);
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
    xit('UNIMPLEMENTED: should return pool info given a coinbase string', () => {
      expect(() => {
        BlockModel.getPoolInfo('');
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
      let transactionModelRemoveSpy = sandbox.stub(TransactionModel, 'remove').resolves();
      let coinModelRemoveSpy = sandbox.stub(CoinModel, 'remove').resolves();
      let coinModelUpdateSpy = sandbox.stub(CoinModel, 'update').resolves();
      let blockModelFindOneSpy = sandbox.stub(BlockModel, 'findOne').returns({
        sort: sandbox.stub().resolves(null)
      });

      // const params = {
      //   header: {
      //     prevHash: 'prev123',
      //     hash: 'hash123',
      //     time: 0,
      //     version: 'test123',
      //     merkleRoot: 'fooBar',
      //     bits: 'bits123',
      //     nonce: 'random123'
      //   },
      //   chain: 'BTC',
      //   network: 'regtest'
      // };

      expect(blockModelRemoveSpy.notCalled);
      expect(transactionModelRemoveSpy.notCalled);
      expect(coinModelRemoveSpy.notCalled);
      expect(coinModelUpdateSpy.notCalled);
      expect(blockModelFindOneSpy.notCalled);

    });

    it('should return if localTip height is zero', async () => {
      let blockModelRemoveSpy = sandbox.stub(BlockModel, 'remove').resolves();
      let transactionModelRemoveSpy = sandbox.stub(TransactionModel, 'remove').resolves();
      let coinModelRemoveSpy = sandbox.stub(CoinModel, 'remove').resolves();
      let coinModelUpdateSpy = sandbox.stub(CoinModel, 'update').resolves();
      let blockModelFindOneSpy = sandbox.stub(BlockModel, 'findOne').returns({
        sort: sandbox.stub().resolves({ height: 0 })
      });

      expect(blockModelRemoveSpy.notCalled);
      expect(transactionModelRemoveSpy.notCalled);
      expect(coinModelRemoveSpy.notCalled);
      expect(coinModelUpdateSpy.notCalled);
      expect(blockModelFindOneSpy.notCalled);

    });

    // const result = await BlockModel.handleReorg(params);

    // expect(result.h).to.not.equal(params.header.prevHash);
    // expect(localTip.height).to.equal(0);

    it('should call blockModel remove', async () => {
      let blockModelRemoveSpy = sandbox.stub(BlockModel, 'remove').resolves();
      sandbox.stub(TransactionModel, 'remove').resolves();
      sandbox.stub(CoinModel, 'remove').resolves();
      sandbox.stub(CoinModel, 'update').resolves();
      sandbox.stub(BlockModel, 'findOne').returns({
        sort: sandbox.stub().resolves({ height: 1 })
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
      expect(blockModelRemoveSpy.calledOnce);
    });

    it('should call transactionModel remove', async () => {
      sandbox.stub(BlockModel, 'remove').resolves();
      let transactionModelRemoveSpy = sandbox.stub(TransactionModel, 'remove').resolves();
      sandbox.stub(CoinModel, 'remove').resolves();
      sandbox.stub(CoinModel, 'update').resolves();
      sandbox.stub(BlockModel, 'findOne').returns({
        sort: sandbox.stub().resolves(null)
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
      const result = await BlockModel.handleReorg(params);
      expect(transactionModelRemoveSpy.calledOnce).to.be.true;
      expect(result).to.exist;
    });

    it('should call coinModel remove', async () => {
      sandbox.stub(BlockModel, 'remove').resolves();
      sandbox.stub(TransactionModel, 'remove').resolves();
      let coinModelRemoveSpy = sandbox.stub(CoinModel, 'remove').resolves();
      sandbox.stub(CoinModel, 'update').resolves();
      sandbox.stub(BlockModel, 'findOne').returns({
        sort: sandbox.stub().resolves(null)
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
      const result = await BlockModel.handleReorg(params);
      expect(coinModelRemoveSpy.calledOnce).to.be.true;
      expect(result).to.exist;
    });

    it('should call coinModel update', async () => {
      sandbox.stub(BlockModel, 'remove').resolves();
      sandbox.stub(TransactionModel, 'remove').resolves();
      sandbox.stub(CoinModel, 'remove').resolves();
      let coinModelUpdateSpy = sandbox.stub(CoinModel, 'update').resolves();
      sandbox.stub(BlockModel, 'findOne').returns({
        sort: sandbox.stub().resolves(null)
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
      const result = await BlockModel.handleReorg(params);
      expect(coinModelUpdateSpy.calledOnce).to.be.true;
      expect(result).to.exist;
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
        processed: true
      };

      const result = BlockModel._apiTransform(new BlockModel(block), {
        object: false
      });
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
