import { valueOrDefault } from '../utils/check';
import { CoinStorage } from './coin';
import { TransactionStorage } from './transaction';
import { LoggifyClass } from '../decorators/Loggify';
import { Bitcoin } from '../types/namespaces/Bitcoin';
import { BaseModel, MongoBound } from './base';
import logger from '../logger';
import { IBlock, BlockJSON } from '../types/Block';
import { SpentHeightIndicators } from '../types/Coin';
import { EventStorage } from './events';
import config from '../config';
import { StorageService } from '../services/storage';

export { IBlock };

@LoggifyClass
export class BlockModel extends BaseModel<IBlock> {
  constructor(storage?: StorageService) {
    super('blocks', storage);
  }

  chainTips: Mapping<Mapping<IBlock>> = {};

  allowedPaging = [
    {
      key: 'height' as 'height',
      type: 'number' as 'number'
    }
  ];

  async onConnect() {
    this.collection.createIndex({ hash: 1 }, { background: true });
    this.collection.createIndex({ chain: 1, network: 1, processed: 1, height: -1 }, { background: true });
    this.collection.createIndex({ chain: 1, network: 1, timeNormalized: 1 }, { background: true });
    this.collection.createIndex({ previousBlockHash: 1 }, { background: true });
    this.wireup();
  }

  async wireup() {
    for (let chain of Object.keys(config.chains)) {
      for (let network of Object.keys(config.chains[chain])) {
        const tip = await this.getLocalTip({ chain, network });
        if (tip) {
          this.chainTips[chain] = { [network]: tip };
        }
      }
    }
  }

  async addBlock(params: {
    block: Bitcoin.Block;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
  }) {
    const { block, chain, network } = params;
    const header = block.header.toObject();

    const reorg = await this.handleReorg({ header, chain, network });

    if (reorg) {
      return Promise.reject('reorg');
    }
    return this.processBlock(params);
  }

  async processBlock(params: {
    block: Bitcoin.Block;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
  }) {
    const { chain, network, block, parentChain, forkHeight, initialSyncComplete } = params;
    const blockOp = await this.getBlockOp(params);
    const convertedBlock = blockOp.updateOne.update.$set;
    const { height, timeNormalized, time } = convertedBlock;

    const previousBlock = await this.collection.findOne({ hash: convertedBlock.previousBlockHash, chain, network });

    await this.collection.bulkWrite([blockOp]);
    if (previousBlock) {
      await this.collection.updateOne(
        { chain, network, hash: previousBlock.hash },
        { $set: { nextBlockHash: convertedBlock.hash } }
      );
      logger.debug('Updating previous block.nextBlockHash ', convertedBlock.hash);
    }

    await TransactionStorage.batchImport({
      txs: block.transactions,
      blockHash: convertedBlock.hash,
      blockTime: new Date(time),
      blockTimeNormalized: new Date(timeNormalized),
      height: height,
      chain,
      network,
      parentChain,
      forkHeight,
      initialSyncComplete
    });

    if (initialSyncComplete) {
      EventStorage.signalBlock(convertedBlock);
    }

    await this.collection.updateOne({ hash: convertedBlock.hash, chain, network }, { $set: { processed: true } });
    this.updateCachedChainTip({ block: convertedBlock, chain, network });
  }

  async getBlockOp(params: { block: Bitcoin.Block; chain: string; network: string }) {
    const { block, chain, network } = params;
    const header = block.header.toObject();
    const blockTime = header.time * 1000;

    const previousBlock = await this.collection.findOne({ hash: header.prevHash, chain, network });

    const blockTimeNormalized = (() => {
      const prevTime = previousBlock ? previousBlock.timeNormalized : null;
      if (prevTime && blockTime <= prevTime.getTime()) {
        return prevTime.getTime() + 1;
      } else {
        return blockTime;
      }
    })();

    const height = (previousBlock && previousBlock.height + 1) || 1;
    logger.debug('Setting block height', height);

    const coinbaseTransaction = block.transactions[0];
    const coinbaseInput = coinbaseTransaction.inputs[0].toObject();
    const convertedBlock: IBlock = {
      chain,
      coinbaseTxId: coinbaseTransaction.hash,
      coinbaseUnlockingScript: coinbaseInput.script,
      coinbaseUnlockingScriptUtf8: Buffer.from(coinbaseInput.script, 'hex').toString(),
      coinbaseSequenceNumber: coinbaseInput.sequenceNumber,
      coinbaseMintTxId: coinbaseInput.prevTxId,
      coinbaseMintIndex: coinbaseInput.outputIndex,
      network,
      hash: block.hash,
      height,
      version: header.version,
      nextBlockHash: '',
      previousBlockHash: header.prevHash,
      merkleRoot: header.merkleRoot,
      time: new Date(blockTime),
      timeNormalized: new Date(blockTimeNormalized),
      bits: header.bits,
      nonce: header.nonce,
      transactionCount: block.transactions.length,
      size: block.toBuffer().length,
      reward: block.transactions[0].outputAmount,
      processed: false
    };
    return {
      updateOne: {
        filter: {
          hash: header.hash,
          chain,
          network
        },
        update: {
          $set: convertedBlock
        },
        upsert: true
      }
    };
  }

  updateCachedChainTip(params: { block: IBlock; chain: string; network: string }) {
    const { chain, network, block } = params;
    this.chainTips[chain] = valueOrDefault(this.chainTips[chain], {});
    this.chainTips[chain][network] = valueOrDefault(this.chainTips[chain][network], block);
    if (this.chainTips[chain][network].height < block.height) {
      this.chainTips[chain][network] = block;
    }
  }

  getLocalTip({ chain, network }) {
    return this.collection.findOne({ chain, network, processed: true }, { sort: { height: -1 } });
  }

  async handleReorg(params: { header?: Bitcoin.Block.HeaderObj; chain: string; network: string }): Promise<boolean> {
    const { header, chain, network } = params;
    let localTip = await this.getLocalTip(params);
    if (header && localTip && localTip.hash === header.prevHash) {
      return false;
    }
    if (!localTip || localTip.height === 0) {
      return false;
    }
    if (header) {
      const prevBlock = await this.collection.findOne({ chain, network, hash: header.prevHash });
      if (prevBlock) {
        localTip = prevBlock;
        this.updateCachedChainTip({chain, network, block: prevBlock})
      } else {
        delete this.chainTips[chain][network];
        logger.error(`Previous block isn't in the DB need to roll back until we have a block in common`);
      }
      logger.info(`Resetting tip to ${localTip.height - 1}`, { chain, network });
    }
    const reorgOps = [
      this.collection.deleteMany({ chain, network, height: { $gte: localTip.height } }),
      TransactionStorage.collection.deleteMany({ chain, network, blockHeight: { $gte: localTip.height } }),
      CoinStorage.collection.deleteMany({ chain, network, mintHeight: { $gte: localTip.height } })
    ];
    await Promise.all(reorgOps);

    await CoinStorage.collection.updateMany(
      { chain, network, spentHeight: { $gte: localTip.height } },
      { $set: { spentTxid: null, spentHeight: SpentHeightIndicators.unspent } }
    );

    logger.debug('Removed data from above blockHeight: ', localTip.height);
    return true;
  }

  _apiTransform(block: Partial<MongoBound<IBlock>>, options?: TransformOptions): BlockJSON {
    return {
      chain: valueOrDefault(block.chain, ''),
      coinbaseTxId: valueOrDefault(block.coinbaseTxId, ''),
      coinbaseUnlockingScript: valueOrDefault(block.coinbaseUnlockingScript, ''),
      coinbaseUnlockingScriptUtf8: valueOrDefault(block.coinbaseUnlockingScriptUtf8, ''),
      coinbaseSequenceNumber: valueOrDefault(block.coinbaseSequenceNumber, -1),
      coinbaseMintTxId: valueOrDefault(block.coinbaseMintTxId, ''),
      coinbaseMintIndex: valueOrDefault(block.coinbaseMintIndex, -1),
      network: valueOrDefault(block.network, ''),
      version: valueOrDefault(block.version, -1),
      hash: valueOrDefault(block.hash, ''),
      height: valueOrDefault(block.height, -1),
      size: valueOrDefault(block.size, -1),
      merkleRoot: valueOrDefault(block.merkleRoot, ''),
      time: block.time ? block.time.toISOString() : '',
      timeNormalized: block.timeNormalized ? block.timeNormalized.toISOString() : '',
      nonce: valueOrDefault(block.nonce, -1),
      bits: valueOrDefault(block.bits, -1),
      previousBlockHash: valueOrDefault(block.previousBlockHash, ''),
      nextBlockHash: valueOrDefault(block.nextBlockHash, ''),
      reward: valueOrDefault(block.reward, -1),
      transactionCount: valueOrDefault(block.transactionCount, -1)
    };
  }
}

export let BlockStorage = new BlockModel();
