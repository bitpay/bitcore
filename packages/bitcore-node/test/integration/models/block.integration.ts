import { expect } from 'chai';
import { resetModel } from '../../helpers/index';
import { BlockModel } from '../../../src/models/block';
import { TransactionModel } from '../../../src/models/transaction';
import { CoinModel } from '../../../src/models/coin';
import { TEST_BLOCK } from '../../data/test-block';
// import { AdapterProvider } from '../../../src/providers/adapter';
// import { Adapter } from '../../../src/types/namespaces/ChainAdapter';
// import { Bitcoin } from '../../../src/types/namespaces/Bitcoin';
// import * as sinon from 'sinon';


describe('Block Model', function () {

  beforeEach(async () => {
    return resetModel(BlockModel);
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

  describe('handleReorg', () => {
    xit('should be able to properly handle a reorg condition if incoming block already exists', async () => {

      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 1335,
        hash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        version: '536870912',
        merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        time: 1526326784,
        nonce: '3',
        previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true
      });
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 1336,
        hash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        version: '536870912',
        merkleRoot: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        time: 1526326785,
        nonce: '0',
        previousBlockHash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true
      });
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 1337,
        hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        version: '536870912',
        merkleRoot: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        time: 1526326785,
        nonce: '3',
        previousBlockHash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true,
      });


      const result_1 = await BlockModel.getLocalTip({ chain: 'BTC', network: 'regtest' });
      console.log('getLocalTip', result_1.hash);

      const result = await BlockModel.handleReorg({
        header: {
          prevHash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
          hash: '12c719927ce18f9a61d7c5a7af08d3110cacfa43671aa700956c3c05ed38bdaa',
          time: 1526326785,
          version: '536870912',
          merkleRoot: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
          bits: parseInt('207fffff', 16).toString(),
          nonce: '3'
        },
        chain: 'BTC',
        network: 'regtest'
      });
      console.log(result);

      //TODO: compare against initial db


    });
    xit('should be able to handle return cases *need a better explanation here', async () => {
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 1335,
        hash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        version: '536870912',
        merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        time: 1526326784,
        nonce: '3',
        previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true
      });
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 1336,
        hash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        version: '536870912',
        merkleRoot: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        time: 1526326785,
        nonce: '0',
        previousBlockHash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true
      });
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 1337,
        hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        version: '536870912',
        merkleRoot: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        time: 1526326785,
        nonce: '3',
        previousBlockHash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true,
      });

      const result = await BlockModel.handleReorg({
        header: {
          prevHash: '12c719927ce18f9a61d7c5a7af08d3110cacfa43671aa700956c3c05ed38bdaa',
          hash: '4c6872bf45ecab2fb8b38c8b8f50fc4a8309c6171d28d479b8226afcb1a99920',
          time: 1526326785,
          version: '536870912',
          merkleRoot: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
          bits: parseInt('207fffff', 16).toString(),
          nonce: '3'
        },
        chain: 'ETH',
        network: 'regtest'
      });
      console.log(result);
      //TODO: compare against initial db


    });
    it('should handle reorg', async () => {
      //setting up the Block Model
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 5,
        hash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        version: '536870912',
        merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        time: 1526326784,
        nonce: '3',
        previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true
      });
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 6,
        hash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        version: '536870912',
        merkleRoot: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        time: 1526326785,
        nonce: '0',
        previousBlockHash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true
      });
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 7,
        hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        version: '536870912',
        merkleRoot: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
        time: 1526326785,
        nonce: '3',
        previousBlockHash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true,
      });

      const localTip = await BlockModel.getLocalTip({ chain: 'BTC', network: 'regtest' });
      expect(localTip).to.exist;
      expect(localTip.chain).to.equal('BTC');
      expect(localTip.height).to.equal(7);
      expect(localTip.network).to.equal('regtest');
      expect(localTip.version).to.equal(536870912);
      expect(localTip.hash).to.equal('3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312');
      expect(localTip.merkleRoot).to.equal('8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f');
      expect(localTip.previousBlockHash).to.equal('2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86');
      expect(localTip.nonce).to.equal(3);
      expect(localTip.size).to.equal(264);
      expect(localTip.bits).to.equal(545259519);
      expect(localTip.processed).to.equal(true);

      /*
        BlockModel remove everything besides height 7 block
         { _id: 5b16a85a5e8854650f5f2559,
          chain: 'BTC',
          network: 'regtest',
          height: 7,
          hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
          version: 536870912,
          merkleRoot: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
          time: 1970-01-18T15:58:46.785Z,
          nonce: 3,
          previousBlockHash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
          size: 264,
          bits: 545259519,
          processed: true,
          __v: 0
        }
      */

      // setting up the TX model
      await TransactionModel.create({
        txid: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        chain: 'BTC',
        network: 'regtest',
        blockHash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        blockTime: 1526326784,
        coinbase: true,
        locktime: 0,
        size: 145,
        blockHeight: 8
      });
      await TransactionModel.create({
        txid: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        chain: 'BTC',
        network: 'regtest',
        blockHash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        blockTime: 1526326785,
        coinbase: true,
        locktime: 0,
        size: 145,
        blockHeight: 8
      });
      await TransactionModel.create({
        txid: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
        chain: 'BTC',
        network: 'regtest',
        blockHash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        blockTime: 1526326785,
        coinbase: true,
        locktime: 0,
        size: 145,
        blockHeight: 3
      });

      /* Should just retain one document- with BlockHeight 3 */


      // setting up the Coin model
      await CoinModel.create({
        network: 'regtest',
        chain: 'BTC',
        mintTxid: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        mintIndex: 0,
        mintHeight: 8,
        coinbase: true,
        value: 500.0,
        address: 'mkjB6LmjiNfJWgH4aP4v1GkFjRcQTfDSfj'
      });
      await CoinModel.create({
        network: 'regtest',
        chain: 'BTC',
        mintTxid: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        mintIndex: 0,
        mintHeight: 9,
        coinbase: true,
        value: 500.0,
        address: 'mkjB6LmjiNfJWgH4aP4v1GkFjRcQTfDSfj'
      });
      await CoinModel.create({
        network: 'regtest',
        chain: 'BTC',
        mintTxid: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
        mintIndex: 0,
        mintHeight: 5,
        coinbase: true,
        value: 500.0,
        address: 'mkjB6LmjiNfJWgH4aP4v1GkFjRcQTfDSfj',
        spentTxid: 'eec8570a0c960b19fa6c86c71a06ebda379b86b5fe0be0e64ba83b2e0a3d05a3',
        spentHeight: 9
      });

      /* should retain the document with mintHeight 5 with the spentTxid changed to null and spentHeight to -1 */

      await BlockModel.handleReorg({
        header: {
          prevHash: '12c719927ce18f9a61d7c5a7af08d3110cacfa43671aa700956c3c05ed38bdaa',
          hash: '4c6872bf45ecab2fb8b38c8b8f50fc4a8309c6171d28d479b8226afcb1a99920',
          time: 1526326785,
          version: '536870912',
          merkleRoot: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
          bits: parseInt('207fffff', 16).toString(),
          nonce: '3'
        },
        chain: 'BTC',
        network: 'regtest'
      });

      const blockModel = BlockModel.find({
        chain: 'BTC',
        network: 'regtest',
        height: {
          $gte: 5
        }
      }).sort({ height: - 1 });

      console.log(blockModel);

      //TODO: need to compare that correct localTip.height exist, correct no of documents in respective models


    });
  });

  describe.only('addBlock', () => {
    it('should be able to add a block accordingly when a previousBlock exists', async () => {
      // setting up blocks in the database
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 5,
        hash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        version: '536870912',
        merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        time: 1526326784,
        nonce: '3',
        previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true
      });
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 6,
        hash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        version: '536870912',
        merkleRoot: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        time: 1526326785,
        nonce: '0',
        previousBlockHash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true
      });
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 7,
        hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        version: '536870912',
        merkleRoot: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
        time: 1526326785,
        nonce: '3',
        previousBlockHash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true,
      });
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 8,
        hash: '6cc50922e8c1376ce0e4182c60dded5ca301789782693b40c93db00bc4827ca8',
        version: '536870912',
        merkleRoot: 'be9a7cc27cceef8dee3cfff0754df46590b6934987fdf24bd9528ce8718978f0',
        time: 1526326786,
        nonce: '2',
        previousBlockHash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true,
      });

      // should have 3 blocks inside the db, added 4 one- this should act as localTip best block now

      const result = await BlockModel.handleReorg({
        header: {
        prevHash: '6cc50922e8c1376ce0e4182c60dded5ca301789782693b40c93db00bc4827ca8',
        hash: '63b61a1650d89db4c93f2e661280437ade826969cd429d0fb05d39e47458bac1',
        time: 1526326786,
        version: '536870912',
        merkleRoot: '636c76d8434e67f919d38cb60617ae60d30b8090c613b573fd39c1c838488880',
        bits: parseInt('207fffff', 16).toString(),
        nonce: '0'
        },
        chain: 'BTC',
        network: 'regtest'
      });

      console.log(result);
      // handle reorg dealt with here

      const previousBlock = await BlockModel.findOne({
        hash: '6cc50922e8c1376ce0e4182c60dded5ca301789782693b40c93db00bc4827ca8',
        chain: 'BTC',
        network: 'regtest'
      });
      console.log('Handles the previous block (returns it) ',previousBlock);

      // Conditional checking of blockTimeNormalized and height



    });

    xit('should be able to add a block', async () => {

      // setting up blocks in the database
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 5,
        hash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        version: '536870912',
        merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        time: 1526326784,
        nonce: '3',
        previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true
      });
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 6,
        hash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        version: '536870912',
        merkleRoot: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        time: 1526326785,
        nonce: '0',
        previousBlockHash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true
      });
      await BlockModel.create({
        chain: 'BTC',
        network: 'regtest',
        height: 7,
        hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        version: '536870912',
        merkleRoot: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
        time: 1526326785,
        nonce: '3',
        previousBlockHash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true,
      });

      // should have 3 blocks inside the db

      /*

      ** handleReorg and findOne are more or so safety checks before adding the actual block

      -- handle Reorg:

      * remove above block
      * remove the tx, coinmodel and, update coinmodel

      -- findOne:

      * findOne with header.prevHash: prevHash in TEST_BLOCK
      * findOne should return null

      -- checks:

      1st check won't trigger, just return *header.time = blockTime*

      -- height:

      Will return *height: 1* as previousBlock was not found in this case

      -- update:

      happens when it doesn't match the query

      -- checks:

      if there was a previousBlock now it the hash of the current block
      save it

      -- batchImport:

      //

      -- set processed true:

      final step


      */


      // 2 Scenarios one where previous block exist and one where it doesn't



      const localTip = await BlockModel.getLocalTip({ chain: 'BTC', network: 'regtest' });
      console.log('LocalTip:', localTip);

      const findOne = await BlockModel.findOne({
        hash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9',
        chain: 'BTC',
        network: 'regtest'
      });
      console.log(findOne);


      await BlockModel.addBlock({ block: TEST_BLOCK, chain: 'BTC', network: 'regtest'});



    });
  });
});
