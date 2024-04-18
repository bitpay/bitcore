import { LoggifyClass } from '../../../../decorators/Loggify';
import logger from '../../../../logger';
import { MongoBound } from '../../../../models/base';
import { BaseBlock } from '../../../../models/baseBlock';
import { EventStorage } from '../../../../models/events';
import { StorageService } from '../../../../services/storage';
import { IBlock } from '../../../../types/Block';
import { TransformOptions } from '../../../../types/TransformOptions';
import { IEVMBlock, IEVMTransactionInProcess } from '../types';
import { EVMTransactionStorage } from './transaction';

@LoggifyClass
export class EVMBlockModel extends BaseBlock<IEVMBlock> {
  constructor(storage?: StorageService) {
    super(storage);
  }

  async onConnect() {
    super.onConnect();
  }

  async addBlock(params: {
    block: IEVMBlock;
    transactions: IEVMTransactionInProcess[];
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
  }) {
    // TODO: add skipReorg to config for development purposes
    const { block, chain, network } = params;

    let reorg = false;
    if (params.initialSyncComplete) {
      const headers = await this.validateLocatorHashes({ chain, network });
      if (headers.length) {
        const last = headers[headers.length - 1];
        reorg = await this.handleReorg({ block: last, chain, network });
      }

      reorg = reorg || (await this.handleReorg({ block, chain, network }));
    }

    if (reorg) {
      return Promise.reject('reorg');
    }
    return this.processBlock(params);
  }

  async processBlock(params: {
    block: IEVMBlock;
    transactions: IEVMTransactionInProcess[];
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

    // Put in the transactions first
    await EVMTransactionStorage.batchImport({
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

    const previousBlock = await this.collection.findOne({ hash: convertedBlock.previousBlockHash, chain, network });

    await this.collection.bulkWrite([blockOp]);
    if (previousBlock) {
      await this.collection.updateOne(
        { chain, network, hash: previousBlock.hash },
        { $set: { nextBlockHash: convertedBlock.hash } }
      );
      logger.debug('Updating previous block.nextBlockHash: %o', convertedBlock.hash);
    }

    if (initialSyncComplete) {
      EventStorage.signalBlock(convertedBlock);
    }

    await this.collection.updateOne({ hash: convertedBlock.hash, chain, network }, { $set: { processed: true } });
  }

  async getBlockOp(params: { block: IEVMBlock; chain: string; network: string }) {
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
    logger.debug('Setting blockheight: %o', height);
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
      EVMTransactionStorage.collection.deleteMany({ chain, network, blockHeight: { $gte: localTip.height } })
    ];
    await Promise.all(reorgOps);

    logger.debug('Removed data from above blockHeight: %o', localTip.height);
    return localTip.hash !== prevHash;
  }

  _apiTransform(block: Partial<MongoBound<IEVMBlock>>, options?: TransformOptions): any {
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

  async getBlockSyncGaps(params: { chain: string; network: string; startHeight?: number, endHeight?: number }): Promise<number[]> {
    const { chain, network, startHeight = 0, endHeight } = params;
    const self = this;
    return new Promise(async (resolve, reject) => {
      let timeout;
      try {
        const heightQuery = { $gte: startHeight };
        if (endHeight) {
          heightQuery['$lte'] = endHeight;
        }
        const stream = self.collection
          .find({
            chain,
            network,
            processed: true,
            height: heightQuery
          })
          .sort({ chain: 1, network: 1, processed: 1, height: -1 }) // guarantee index use by using this sort
          .addCursorFlag('noCursorTimeout', true);

        let block = (await stream.next()) as IEVMBlock;
        const maxBlock = block;
        if (!maxBlock) {
          return resolve([]);
        }
        const maxHeight = maxBlock.height;
        let prevBlock: IEVMBlock | undefined;
        const outOfSync: number[] = [];
        timeout = setInterval(
          () =>
            logger.info(
              `${chain}:${network} Block verification progress: ${(
                ((maxHeight - block.height) / (maxHeight - startHeight)) *
                100
              ).toFixed(1)}%`
            ),
          1000 * 2
        );
        // we are descending in blockHeight as we iterate
        for (let syncHeight = maxHeight; syncHeight >= startHeight; syncHeight--) {
          if (!block || block.height !== syncHeight) {
            outOfSync.push(syncHeight);
          } else {
            // prevBlock should be the next block up in height
            if (prevBlock && !block.nextBlockHash && block.height === prevBlock.height - 1) {
              const res = await self.collection.updateOne(
                { chain, network, hash: block.hash },
                { $set: { nextBlockHash: prevBlock.hash } }
              );
              if (res.modifiedCount === 1) {
                block.nextBlockHash = prevBlock.hash;
              }
            }
            prevBlock = block;
            block = (await stream.next()) as IEVMBlock;
            while (block && prevBlock && block.height === prevBlock.height) { // uncaught reorg?
              logger.error('Conflicting blocks found at height %o. %o <-> %o', block.height, block.hash, prevBlock.hash);
              block = (await stream.next()) as IEVMBlock;
            }
          }
        }
        resolve(outOfSync.reverse()); // reverse order so that they are in ascending order
      } catch (err) {
        reject(err);
      } finally {
        clearTimeout(timeout);
      }
    });
  }
}

export let EVMBlockStorage = new EVMBlockModel();
