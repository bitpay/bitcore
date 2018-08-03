import { expect } from 'chai';
import { resetDatabase } from '../../helpers';
import { BlockModel } from '../../../src/models/block';
import { TransactionModel } from '../../../src/models/transaction';
import { CoinModel } from '../../../src/models/coin';
import { TEST_BLOCK } from '../../data/test-block';
import logger from '../../../src/logger';

describe('Block Model', function () {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('addBlock', () => {
    it('should add a block when incoming block references previous block hash', async () => {
      await BlockModel.collection.insert({
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
      await BlockModel.collection.insert({
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
      await BlockModel.collection.insert({
        chain: 'BTC',
        network: 'regtest',
        height: 7,
        hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        version: '536870912',
        merkleRoot: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
        time: new Date(1526326785),
        nonce: '3',
        previousBlockHash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true,
      });
      await BlockModel.collection.insert({
        chain: 'BTC',
        network: 'regtest',
        height: 8,
        hash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9',
        version: '536870912',
        merkleRoot: 'be9a7cc27cceef8dee3cfff0754df46590b6934987fdf24bd9528ce8718978f0',
        time: new Date(1526326786),
        timeNormalized: new Date(1526326786),
        nonce: '2',
        previousBlockHash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true,
      });

      await BlockModel.addBlock({ block: TEST_BLOCK, chain: 'BTC', network: 'regtest', initialSyncComplete: false });

      const blocks = await BlockModel.collection.find({ chain: 'BTC', network: 'regtest' }).sort({ height: 1 }).toArray();
      expect(blocks.length).to.equal(5);
      const ownBlock = blocks[4];
      expect(ownBlock.chain).to.equal('BTC');
      expect(ownBlock.hash).to.equal('64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929');
      expect(ownBlock.network).to.equal('regtest');
      expect(ownBlock.bits).to.equal('545259519');
      expect(ownBlock.height).to.equal(9);
      expect(ownBlock.merkleRoot).to.equal('08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08');
      expect(ownBlock.nonce).to.equal('2');
      expect(ownBlock.previousBlockHash).to.equal('3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9');
      expect(ownBlock.reward).to.equal(0.09765625);
      expect(ownBlock.size).to.equal(264);
      expect(ownBlock.version).to.equal('536870912');
      // TODO: assertion for block times
      expect(ownBlock.transactionCount).to.equal(1);
      expect(ownBlock.processed).to.equal(true);

      logger.info(`new block was successfully added with hash`, ownBlock.hash);

      const transaction = await TransactionModel.collection.find({
        chain: 'BTC',
        network: 'regtest',
        blockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929'
      }).toArray();
      expect(transaction.length).to.equal(1);
      expect(transaction[0].chain).to.equal('BTC');
      expect(transaction[0].network).to.equal('regtest');
      expect(transaction[0].txid).to.equal('08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08');
      expect(transaction[0].blockHash).to.equal('64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929');
      expect(transaction[0].blockHeight).to.equal(9);
      expect(transaction[0].coinbase).to.equal(true);
      expect(transaction[0].locktime).to.equal(0);
      expect(transaction[0].size).to.equal(0);
      // TODO: assertion for block times
      expect(transaction[0].wallets.length).to.equal(0);

      logger.info(`tx: ${transaction[0].txid} was successfully stored in the TX model`);

    });
  });

  describe('handleReorg', () => {
    it('should not reorg if the incoming block\'s prevHash matches the block hash of the current highest block', async () => {

      await BlockModel.collection.insert({
        chain: 'BTC',
        network: 'regtest',
        height: 1335,
        hash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        version: '536870912',
        merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        time: new Date(1526326784),
        nonce: '3',
        previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true
      });
      await BlockModel.collection.insert({
        chain: 'BTC',
        network: 'regtest',
        height: 1336,
        hash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        version: '536870912',
        merkleRoot: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        time: new Date(1526326785),
        nonce: '0',
        previousBlockHash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true
      });
      await BlockModel.collection.insert({
        chain: 'BTC',
        network: 'regtest',
        height: 1337,
        hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        version: '536870912',
        merkleRoot: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        time: new Date(1526326785),
        nonce: '3',
        previousBlockHash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        size: 264,
        bits: parseInt('207fffff', 16).toString(),
        processed: true,
      });

      await BlockModel.handleReorg({
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

      const result = await BlockModel.collection.find({ chain: 'BTC', network: 'regtest' }).toArray();
      expect(result.length).to.equal(3);

    });
    it('should not reorg if localTip height is zero', async () => {

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

      const result = await BlockModel.collection.find({ chain: 'BTC', network: 'regtest' }).toArray();
      expect(result.length).to.equal(0);

    });
    it('should successfully handle reorg', async () => {
      // setting the Block model
      await BlockModel.collection.insert({
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
      await BlockModel.collection.insert({
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
      await BlockModel.collection.insert({
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

      // setting TX model
      await TransactionModel.collection.insert({
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
      await TransactionModel.collection.insert({
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
      await TransactionModel.collection.insert({
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

      // setting the Coin model
      await CoinModel.collection.insert({
        network: 'regtest',
        chain: 'BTC',
        mintTxid: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        mintIndex: 0,
        mintHeight: 8,
        coinbase: true,
        value: 500.0,
        address: 'mkjB6LmjiNfJWgH4aP4v1GkFjRcQTfDSfj'
      });
      await CoinModel.collection.insert({
        network: 'regtest',
        chain: 'BTC',
        mintTxid: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        mintIndex: 0,
        mintHeight: 9,
        coinbase: true,
        value: 500.0,
        address: 'mkjB6LmjiNfJWgH4aP4v1GkFjRcQTfDSfj'
      });
      await CoinModel.collection.insert({
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

      // check for removed block after Reorg in db
      const blocks = await BlockModel.collection.find({
        chain: 'BTC',
        network: 'regtest'
      }).toArray();
      expect(blocks.length).to.equal(2);

      const removedBlock = await BlockModel.collection.find({
        chain: 'BTC',
        network: 'regtest',
        height: {
          $gte: 7
        }
      }).toArray();
      expect(removedBlock.length).to.equal(0);

      // check for removed tx after Reorg in db
      const transaction = await TransactionModel.collection.find({
        chain: 'BTC',
        network: 'regtest'
      }).toArray();
      expect(transaction.length).to.equal(1);

      const removedTransaction = await TransactionModel.collection.find({
        chain: 'BTC',
        network: 'regtest',
        blockHeight: {
          $gte: 7
        }
      }).toArray();
      expect(removedTransaction.length).to.equal(0);

      // check for removed coin after Reorg in db
      const coinModel = await CoinModel.collection.find({
        chain: 'BTC',
        network: 'regtest',
      }).toArray();
      expect(coinModel.length).to.equal(1);

      const removedCoin = await CoinModel.collection.find({
        chain: 'BTC',
        network: 'regtest',
        mintHeight: {
          $gte: 7
        }
      }).toArray();
      expect(removedCoin.length).to.equal(0);

      // check for unspent coins in the db
      const unspentCoins = await CoinModel.collection.find({
        chain: 'BTC',
        network: 'regtest',
        spentTxid: null,
        spentHeight: -1
      }).toArray();
      expect(unspentCoins.length).equal(1);
      expect(unspentCoins[0].chain).to.equal('BTC');
      expect(unspentCoins[0].network).to.equal('regtest');
      expect(unspentCoins[0].mintTxid).to.equal('8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f'),
        expect(unspentCoins[0].mintIndex).to.equal(0);
      expect(unspentCoins[0].mintHeight).to.equal(5);
      expect(unspentCoins[0].coinbase).to.equal(true);
      expect(unspentCoins[0].value).to.equal(500.0);
      expect(unspentCoins[0].address).to.equal('mkjB6LmjiNfJWgH4aP4v1GkFjRcQTfDSfj');
      expect(unspentCoins[0].spentTxid).to.equal(null);
      expect(unspentCoins[0].spentHeight).to.equal(-1);

    });
  });
});
