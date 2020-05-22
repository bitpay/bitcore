import { LoggifyClass } from '../../../decorators/Loggify';
import logger from '../../../logger';
import { MongoBound } from '../../../models/base';
import { BaseBlock } from '../../../models/baseBlock';
import { EventStorage } from '../../../models/events';
import { StorageService } from '../../../services/storage';
import { IBlock } from '../../../types/Block';
import { TransformOptions } from '../../../types/TransformOptions';
import { IEthBlock, IEthTransaction } from '../types';
import { EthTransactionStorage } from './transaction';

@LoggifyClass
export class EthBlockModel extends BaseBlock<IEthBlock> {
  constructor(storage?: StorageService) {
    super(storage);
  }

  async onConnect() {
    super.onConnect();
  }

  async addBlock(params: {
    block: IEthBlock;
    transactions: IEthTransaction[];
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
  }) {
    const { block, chain, network } = params;

    let reorg = false;
    const headers = await this.validateLocatorHashes({ chain, network });
    if (headers.length) {
      const last = headers[headers.length - 1];
      reorg = await this.handleReorg({ block: last, chain, network });
    }

    reorg = reorg || (await this.handleReorg({ block, chain, network }));

    if (reorg) {
      return Promise.reject('reorg');
    }
    return this.processBlock(params);
  }

  async processBlock(params: {
    block: IEthBlock;
    transactions: IEthTransaction[];
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
  }) {
    const { chain, network, transactions, parentChain, forkHeight, initialSyncComplete } = params;
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

    await EthTransactionStorage.batchImport({
      txs: transactions,
      blockHash: convertedBlock.hash,
      blockTime: new Date(time),
      blockTimeNormalized: new Date(timeNormalized),
      height,
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
  }

  async getBlockOp(params: { block: IEthBlock; chain: string; network: string }) {
    const { block, chain, network } = params;
    const blockTime = block.time;
    const prevHash = block.previousBlockHash;

    const previousBlock = await this.collection.findOne({ hash: prevHash, chain, network });

    const timeNormalized = (() => {
      const prevTime = previousBlock ? new Date(previousBlock.timeNormalized) : null;
      if (prevTime && blockTime.getTime() <= prevTime.getTime()) {
        return new Date(prevTime.getTime() + 1);
      } else {
        return blockTime;
      }
    })();

    const height = block.height;
    logger.debug('Setting blockheight', height);
    return {
      updateOne: {
        filter: {
          hash: block.hash,
          chain,
          network
        },
        update: {
          $set: { ...block, timeNormalized }
        },
        upsert: true
      }
    };
  }

  async handleReorg(params: { block: IBlock; chain: string; network: string }): Promise<boolean> {
    const { block, chain, network } = params;
    const prevHash = block.previousBlockHash;
    let localTip = await this.getLocalTip(params);
    if (block != null && localTip != null && (localTip.hash === prevHash || localTip.hash === block.hash)) {
      return false;
    }
    if (!localTip || localTip.height === 0) {
      return false;
    }
    if (block) {
      const prevBlock = await this.collection.findOne({ chain, network, hash: prevHash });
      if (prevBlock) {
        localTip = prevBlock;
      } else {
        logger.error("Previous block isn't in the DB need to roll back until we have a block in common");
      }
      logger.info(`Resetting tip to ${localTip.height - 1}`, { chain, network });
    }
    const reorgOps = [
      this.collection.deleteMany({ chain, network, height: { $gte: localTip.height } }),
      EthTransactionStorage.collection.deleteMany({ chain, network, blockHeight: { $gte: localTip.height } })
    ];
    await Promise.all(reorgOps);

    logger.debug('Removed data from above blockHeight: ', localTip.height);
    return localTip.hash !== prevHash;
  }

  _apiTransform(block: Partial<MongoBound<IEthBlock>>, options?: TransformOptions): any {
    const transform = {
      _id: block._id,
      chain: block.chain,
      network: block.network,
      hash: block.hash,
      height: block.height,
      size: block.size,
      gasLimit: block.gasLimit,
      gasUsed: block.gasUsed,
      merkleRoot: block.merkleRoot,
      time: block.time,
      timeNormalized: block.timeNormalized,
      nonce: block.nonce,
      previousBlockHash: block.previousBlockHash,
      nextBlockHash: block.nextBlockHash,
      reward: block.reward,
      transactionCount: block.transactionCount,
      difficulty: block.difficulty,
      totalDifficulty: block.totalDifficulty
    };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
  }
}

export let EthBlockStorage = new EthBlockModel();
