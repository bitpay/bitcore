import { expect } from 'chai';
import { resetModel } from '../../helpers/index';
import { BlockModel } from '../../../src/models/block';
// import * as sinon from 'sinon';
// import { CoinModel } from '../../../src/models/coin';
import { TEST_BLOCK } from '../../data/test-block';
import { AdapterProvider } from '../../../src/providers/adapter';
import { Adapter } from '../../../src/types/namespaces/ChainAdapter';
import { Bitcoin } from '../../../src/types/namespaces/Bitcoin';


describe('Block Model', function () {

  beforeEach(async () => {
    return resetModel(BlockModel);
  });
  describe('addBlock', () => {
    it('should add a block', async () => {

    });
  });
  describe('getLocalTip', () => {
    it('should get the highest processed block for a particular chain and network', async () => {

      await BlockModel.create({ processed: true, chain: 'BTC', network: 'regtest', height: 1 });
      await BlockModel.create({ processed: true, chain: 'BTC', network: 'regtest', height: 2 });
      await BlockModel.create({ processed: true, chain: 'BTC', network: 'regtest', height: 3 });

      const result = await BlockModel.getLocalTip({ chain: 'BTC', network: 'regtest' });

      expect(result.height).to.equal(3);
      expect(result.processed).to.equal(true);
      expect(result.chain).to.equal('BTC');
      expect(result.network).to.equal('regtest');

    });
    it('should return block with height zero if block is not found for a particular chain and network', async () => {

      await BlockModel.create({ processed: true, chain: 'BTC', network: 'regtest', height: 1 });
      await BlockModel.create({ processed: true, chain: 'BTC', network: 'regtest', height: 2 });
      await BlockModel.create({ processed: true, chain: 'BTC', network: 'regtest', height: 3 });
      await BlockModel.create({ processed: true, chain: 'BCH', network: 'regtest', height: 10 });
      await BlockModel.create({ processed: true, chain: 'BTC', network: 'testnet', height: 10 });

      const result = await BlockModel.getLocalTip({ chain: 'ETH', network: 'regtest' });

      expect(result.height).to.equal(0);

    });
  });
  describe('getLocatorHashes', () => {
    it('should return the highest processed block hash for the last thirty blocks for a particular chain and network', async () => {

      await BlockModel.create({ processed: true, chain: 'BTC', network: 'regtest', height: 1, hash: '1e980bdd683513b2cdeaf81985f1f52e17175d3ce34e3be56e0c210eed0a21a3' });
      await BlockModel.create({ processed: true, chain: 'BTC', network: 'regtest', height: 2, hash: '3d7c133d28353247312c9673a8d60151c0858486fa87fc16764f5e282f06f9f7' });
      await BlockModel.create({ processed: true, chain: 'BTC', network: 'regtest', height: 3, hash: '74b8e5f1231638c9ba880d2252ad451e6b675a7afde815f2702dd78c95152769' });
      await BlockModel.create({ processed: true, chain: 'BTC', network: 'regtest', height: 7, hash: '3577099967d5036c116dcd7810d637334a011523c9f20a4092018feacc3b8837' });

      const result = await BlockModel.getLocatorHashes({ chain: 'BTC', network: 'regtest' });

      expect(result).to.deep.equal([
        '3577099967d5036c116dcd7810d637334a011523c9f20a4092018feacc3b8837',
        '74b8e5f1231638c9ba880d2252ad451e6b675a7afde815f2702dd78c95152769',
        '3d7c133d28353247312c9673a8d60151c0858486fa87fc16764f5e282f06f9f7',
        '1e980bdd683513b2cdeaf81985f1f52e17175d3ce34e3be56e0c210eed0a21a3'
      ]);

    });
    it('should return block hash with sixty four zeros if processed block count less than two is found for a particular chain and network', async () => {

      await BlockModel.create({ processed: true, chain: 'BTC', network: 'regtest', height: 1 });

      const result = await BlockModel.getLocatorHashes({ chain: 'BTC', network: 'regtest' });

      expect(result).to.deep.equal([Array(65).join('0')]);

    });
  });
  describe.only('handleReorg', () => {
    it('should be able to properly handle a reorg condition', async () => {

      let blockMethodParams: Adapter.ConvertBlockParams<Bitcoin.Block> = {
        chain: 'BTC',
        network: 'regtest',
        block: TEST_BLOCK,
        height: 1355
      };
      const block = AdapterProvider.convertBlock(blockMethodParams);

      await BlockModel.create(block);
      await BlockModel.create(block1);
      const result = await BlockModel.handleReorg({ chain: 'BTC', network: 'BTC' });




    });
  });
});
