import { expect } from 'chai';
import logger from '../../../src/logger';
import { BitcoinBlockStorage } from '../../../src/models/block';
import { CoinStorage } from '../../../src/models/coin';
import { TransactionStorage } from '../../../src/models/transaction';
import { SpentHeightIndicators } from '../../../src/types/Coin';
import { TEST_BLOCK } from '../../data/test-block';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

async function insertBlocks() {
  await BitcoinBlockStorage.collection.insertOne({
    chain: 'BTC',
    network: 'regtest',
    height: 5,
    hash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
    version: 100,
    merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
    time: new Date(1526326784),
    timeNormalized: new Date(1526326784),
    transactionCount: 1,
    reward: 50,
    nonce: 3,
    previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
    nextBlockHash: '',
    size: 264,
    bits: parseInt('207fffff', 16),
    processed: true
  });
  await BitcoinBlockStorage.collection.insertOne({
    chain: 'BTC',
    network: 'regtest',
    height: 6,
    hash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
    version: 100,
    merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
    time: new Date(1526326784),
    timeNormalized: new Date(1526326784),
    transactionCount: 1,
    reward: 50,
    nonce: 3,
    previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
    nextBlockHash: '',
    size: 264,
    bits: parseInt('207fffff', 16),
    processed: true
  });
  await BitcoinBlockStorage.collection.insertOne({
    chain: 'BTC',
    network: 'regtest',
    height: 7,
    hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
    version: 100,
    merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
    time: new Date(1526326784),
    timeNormalized: new Date(1526326784),
    transactionCount: 1,
    reward: 50,
    nonce: 3,
    previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
    nextBlockHash: '',
    size: 264,
    bits: parseInt('207fffff', 16),
    processed: true
  });
  await BitcoinBlockStorage.collection.insertOne({
    chain: 'BTC',
    network: 'regtest',
    height: 8,
    hash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9',
    version: 100,
    merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
    time: new Date(1526326784),
    timeNormalized: new Date(1526326784),
    transactionCount: 1,
    reward: 50,
    nonce: 3,
    previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
    nextBlockHash: '',
    size: 264,
    bits: parseInt('207fffff', 16),
    processed: true
  });
}

describe('Block Model', function() {
  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(() => intAfterHelper(suite));

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('addBlock', () => {
    it('should add a block when incoming block references previous block hash', async () => {
      await insertBlocks();
      await BitcoinBlockStorage.addBlock({
        block: TEST_BLOCK,
        chain: 'BTC',
        network: 'regtest',
        initialSyncComplete: false
      });

      const blocks = await BitcoinBlockStorage.collection
        .find({ chain: 'BTC', network: 'regtest' })
        .sort({ height: 1 })
        .toArray();
      expect(blocks.length).to.equal(5);
      const ownBlock = blocks[4];
      expect(ownBlock.chain).to.equal('BTC');
      expect(ownBlock.hash).to.equal('64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929');
      expect(ownBlock.network).to.equal('regtest');
      expect(ownBlock.bits).to.equal(545259519);
      expect(ownBlock.height).to.equal(9);
      expect(ownBlock.merkleRoot).to.equal('08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08');
      expect(ownBlock.nonce).to.equal(2);
      expect(ownBlock.previousBlockHash).to.equal('3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9');
      expect(ownBlock.reward).to.equal(0.09765625);
      expect(ownBlock.size).to.equal(264);
      expect(ownBlock.version).to.equal(536870912);
      // TODO: assertion for block times
      expect(ownBlock.transactionCount).to.equal(1);
      expect(ownBlock.processed).to.equal(true);

      logger.info('new block was successfully added with hash', ownBlock.hash);

      const transaction = await TransactionStorage.collection
        .find({
          chain: 'BTC',
          network: 'regtest',
          blockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929'
        })
        .toArray();
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
    it("should not reorg if the incoming block's prevHash matches the block hash of the current highest block", async () => {
      await BitcoinBlockStorage.collection.insertOne({
        chain: 'BTC',
        network: 'regtest',
        height: 1335,
        hash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        version: 100,
        merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        time: new Date(1526326784),
        timeNormalized: new Date(1526326784),
        transactionCount: 1,
        reward: 50,
        nonce: 3,
        previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
        nextBlockHash: '',
        size: 264,
        bits: parseInt('207fffff', 16),
        processed: true
      });
      await BitcoinBlockStorage.collection.insertOne({
        chain: 'BTC',
        network: 'regtest',
        height: 1336,
        hash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        version: 100,
        merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        time: new Date(1526326784),
        timeNormalized: new Date(1526326784),
        transactionCount: 1,
        reward: 50,
        nonce: 3,
        previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
        nextBlockHash: '',
        size: 264,
        bits: parseInt('207fffff', 16),
        processed: true
      });
      await BitcoinBlockStorage.collection.insertOne({
        chain: 'BTC',
        network: 'regtest',
        height: 1337,
        hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        version: 100,
        merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        time: new Date(1526326784),
        timeNormalized: new Date(1526326784),
        transactionCount: 1,
        reward: 50,
        nonce: 3,
        previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
        nextBlockHash: '',
        size: 264,
        bits: parseInt('207fffff', 16),
        processed: true
      });

      await BitcoinBlockStorage.handleReorg({
        header: {
          prevHash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
          hash: '12c719927ce18f9a61d7c5a7af08d3110cacfa43671aa700956c3c05ed38bdaa',
          time: 1526326785,
          version: 536870912,
          merkleRoot: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
          bits: parseInt('207fffff', 16),
          nonce: 3
        },
        chain: 'BTC',
        network: 'regtest'
      });

      const result = await BitcoinBlockStorage.collection.find({ chain: 'BTC', network: 'regtest' }).toArray();
      expect(result.length).to.equal(3);
    });
    it('should not reorg if localTip height is zero', async () => {
      await BitcoinBlockStorage.handleReorg({
        header: {
          prevHash: '12c719927ce18f9a61d7c5a7af08d3110cacfa43671aa700956c3c05ed38bdaa',
          hash: '4c6872bf45ecab2fb8b38c8b8f50fc4a8309c6171d28d479b8226afcb1a99920',
          time: 1526326785,
          version: 536870912,
          merkleRoot: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
          bits: parseInt('207fffff', 16),
          nonce: 3
        },
        chain: 'BTC',
        network: 'regtest'
      });

      const result = await BitcoinBlockStorage.collection.find({ chain: 'BTC', network: 'regtest' }).toArray();
      expect(result.length).to.equal(0);
    });
    it('should successfully handle reorg', async () => {
      // setting the Block model
      await BitcoinBlockStorage.collection.insertOne({
        chain: 'BTC',
        network: 'regtest',
        height: 5,
        hash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        version: 100,
        merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        time: new Date(1526326784),
        timeNormalized: new Date(1526326784),
        transactionCount: 1,
        reward: 50,
        nonce: 3,
        previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
        nextBlockHash: '',
        size: 264,
        bits: parseInt('207fffff', 16),
        processed: true
      });
      await BitcoinBlockStorage.collection.insertOne({
        chain: 'BTC',
        network: 'regtest',
        height: 6,
        hash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        version: 100,
        merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        time: new Date(1526326784),
        timeNormalized: new Date(1526326784),
        transactionCount: 1,
        reward: 50,
        nonce: 3,
        previousBlockHash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        nextBlockHash: '',
        size: 264,
        bits: parseInt('207fffff', 16),
        processed: true
      });
      await BitcoinBlockStorage.collection.insertOne({
        chain: 'BTC',
        network: 'regtest',
        height: 7,
        hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        version: 100,
        merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        time: new Date(1526326784),
        timeNormalized: new Date(1526326784),
        transactionCount: 1,
        reward: 50,
        nonce: 3,
        previousBlockHash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        nextBlockHash: '',
        size: 264,
        bits: parseInt('207fffff', 16),
        processed: true
      });

      // setting TX model
      await TransactionStorage.collection.insertOne({
        txid: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919g',
        chain: 'BTC',
        network: 'regtest',
        blockHash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        blockTime: new Date(1526326784),
        value: 100000,
        fee: 100,
        coinbase: true,
        locktime: 0,
        size: 145,
        inputCount: 1,
        outputCount: 1,
        wallets: [],
        blockHeight: 5
      });

      await TransactionStorage.collection.insertOne({
        txid: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
        chain: 'BTC',
        network: 'regtest',
        blockHash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        blockTime: new Date(1526326785),
        value: 100000,
        fee: 100,
        coinbase: true,
        locktime: 0,
        size: 145,
        inputCount: 1,
        outputCount: 1,
        wallets: [],
        blockHeight: 6
      });

      await TransactionStorage.collection.insertOne({
        txid: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        chain: 'BTC',
        network: 'regtest',
        blockHash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        blockTime: new Date(1526326784),
        value: 100000,
        fee: 100,
        coinbase: true,
        locktime: 0,
        size: 145,
        inputCount: 1,
        outputCount: 1,
        wallets: [],
        blockHeight: 7
      });

      await TransactionStorage.collection.insertOne({
        txid: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        chain: 'BTC',
        network: 'regtest',
        blockHash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        blockTime: new Date(1526326785),
        value: 100000,
        fee: 100,
        coinbase: true,
        locktime: 0,
        size: 145,
        inputCount: 1,
        outputCount: 1,
        wallets: [],
        blockHeight: 7
      });

      // setting the Coin model
      await CoinStorage.collection.insertOne({
        network: 'regtest',
        chain: 'BTC',
        mintTxid: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919g',
        spentTxid: '',
        mintIndex: 0,
        spentHeight: SpentHeightIndicators.unspent,
        mintHeight: 5,
        coinbase: true,
        script: Buffer.from(''),
        wallets: [],
        value: 500.0,
        address: 'mkjB6LmjiNfJWgH4aP4v1GkFjRcQTfDSfj'
      });

      await CoinStorage.collection.insertOne({
        network: 'regtest',
        chain: 'BTC',
        mintTxid: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        spentTxid: '',
        mintIndex: 0,
        spentHeight: SpentHeightIndicators.unspent,
        mintHeight: 7,
        coinbase: true,
        script: Buffer.from(''),
        wallets: [],
        value: 500.0,
        address: 'mkjB6LmjiNfJWgH4aP4v1GkFjRcQTfDSfj'
      });
      await CoinStorage.collection.insertOne({
        network: 'regtest',
        chain: 'BTC',
        mintTxid: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        spentTxid: '',
        mintIndex: 0,
        spentHeight: SpentHeightIndicators.unspent,
        mintHeight: 7,
        coinbase: true,
        script: Buffer.from(''),
        wallets: [],
        value: 500.0,
        address: 'mkjB6LmjiNfJWgH4aP4v1GkFjRcQTfDSfj'
      });
      await CoinStorage.collection.insertOne({
        network: 'regtest',
        chain: 'BTC',
        mintTxid: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
        mintIndex: 0,
        spentHeight: 8,
        mintHeight: 7,
        coinbase: true,
        script: Buffer.from(''),
        wallets: [],
        value: 500.0,
        address: 'mkjB6LmjiNfJWgH4aP4v1GkFjRcQTfDSfj',
        spentTxid: 'eec8570a0c960b19fa6c86c71a06ebda379b86b5fe0be0e64ba83b2e0a3d05a3'
      });

      await BitcoinBlockStorage.handleReorg({
        header: {
          prevHash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
          hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
          time: 1526326785,
          version: 536870912,
          merkleRoot: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
          bits: parseInt('207fffff', 16),
          nonce: 3
        },
        chain: 'BTC',
        network: 'regtest'
      });

      // check for removed block after Reorg in db
      const blocks = await BitcoinBlockStorage.collection
        .find({
          chain: 'BTC',
          network: 'regtest'
        })
        .toArray();
      expect(blocks.length).to.equal(1);

      const removedBlock = await BitcoinBlockStorage.collection
        .find({
          chain: 'BTC',
          network: 'regtest',
          height: {
            $gte: 7
          }
        })
        .toArray();
      expect(removedBlock.length).to.equal(0);

      // check for removed tx after Reorg in db
      const transaction = await TransactionStorage.collection
        .find({
          chain: 'BTC',
          network: 'regtest'
        })
        .toArray();
      expect(transaction.length).to.equal(1);

      const removedTransaction = await TransactionStorage.collection
        .find({
          chain: 'BTC',
          network: 'regtest',
          blockHeight: {
            $gte: 7
          }
        })
        .toArray();
      expect(removedTransaction.length).to.equal(0);

      // check for removed coin after Reorg in db
      const coinModel = await CoinStorage.collection
        .find({
          chain: 'BTC',
          network: 'regtest'
        })
        .toArray();
      expect(coinModel.length).to.equal(1);

      const removedCoin = await CoinStorage.collection
        .find({
          chain: 'BTC',
          network: 'regtest',
          mintHeight: {
            $gte: 7
          }
        })
        .toArray();
      expect(removedCoin.length).to.equal(0);

      // check for unspent coins in the db
      const unspentCoins = await CoinStorage.collection
        .find({
          chain: 'BTC',
          network: 'regtest',
          spentHeight: SpentHeightIndicators.unspent
        })
        .toArray();
      expect(unspentCoins.length).equal(1);
      expect(unspentCoins[0].chain).to.equal('BTC');
      expect(unspentCoins[0].network).to.equal('regtest');
      expect(unspentCoins[0].mintTxid).to.equal('a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919g');
      expect(unspentCoins[0].mintIndex).to.equal(0);
      expect(unspentCoins[0].mintHeight).to.equal(5);
      expect(unspentCoins[0].coinbase).to.equal(true);
      expect(unspentCoins[0].value).to.equal(500.0);
      expect(unspentCoins[0].address).to.equal('mkjB6LmjiNfJWgH4aP4v1GkFjRcQTfDSfj');
      expect(unspentCoins[0].spentTxid).to.equal('');
      expect(unspentCoins[0].spentHeight).to.equal(SpentHeightIndicators.unspent);
    });

    it('should detect a fault in the block hashes', async () => {
      const chain = 'BTC';
      const network = 'regtest';

      await insertBlocks();
      const badHash = '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312';
      await BitcoinBlockStorage.collection.updateOne(
        { chain, network, hash: badHash },
        { $set: { previousBlockHash: 'aaaaa' } }
      );
      const invalidChain = await BitcoinBlockStorage.validateLocatorHashes({ chain, network });
      expect(invalidChain[1].hash).to.eq(badHash);
    });

    it('should detect a missing block', async () => {
      const chain = 'BTC';
      const network = 'regtest';

      await insertBlocks();
      const badHash = '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312';
      const lastKnown = '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86';
      await BitcoinBlockStorage.collection.deleteOne({ chain, network, hash: badHash });
      const invalidChain = await BitcoinBlockStorage.validateLocatorHashes({ chain, network });
      expect(invalidChain[1].hash).to.eq(lastKnown);
    });
  });
});
