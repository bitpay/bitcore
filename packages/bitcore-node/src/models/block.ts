import { LoggifyClass } from '../decorators/Loggify';
import logger from '../logger';
import { StorageService } from '../services/storage';
import { IBlock } from '../types/Block';
import { SpentHeightIndicators } from '../types/Coin';
import { BitcoinBlockType, BitcoinHeaderObj } from '../types/namespaces/Bitcoin';
import { TransformOptions } from '../types/TransformOptions';
import { MongoBound } from './base';
import { BaseBlock } from './baseBlock';
import { CoinStorage } from './coin';
import { EventStorage } from './events';
import { TransactionStorage } from './transaction';

export type IBtcBlock = IBlock & {
  version: number;
  merkleRoot: string;
  bits: number;
  nonce: number;
  feeData?: FeeData;
};

interface FeeData {
  mean: number;
  median: number;
  mode: number;
  feeTotal: number;
}

@LoggifyClass
export class BitcoinBlock extends BaseBlock<IBtcBlock> {
  constructor(storage?: StorageService) {
    super(storage);
  }

  async addBlock(params: {
    block: BitcoinBlockType;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
    initialHeight?: number;
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
    block: BitcoinBlockType;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
    initialHeight?: number;
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
      logger.debug('Updating previous block.nextBlockHash %o', convertedBlock.hash);
    }

    await TransactionStorage.batchImport({
      txs: block.transactions,
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

    const feeData = await this.getBlockFee({ chain, network, blockId: block.hash });

    await this.collection.updateOne({ hash: convertedBlock.hash, chain, network }, { $set: { processed: true, feeData } });
  }

  async getBlockOp(params: { block: BitcoinBlockType; chain: string; network: string; initialHeight?: number }) {
    const { block, chain, network } = params;
    const header = block.header.toObject();
    const blockTime = header.time * 1000;

    const previousBlock = await this.collection.findOne({ hash: header.prevHash, chain, network });

    const blockTimeNormalized = (() => {
      const prevTime = previousBlock ? new Date(previousBlock.timeNormalized) : null;
      if (prevTime && blockTime <= prevTime.getTime()) {
        return prevTime.getTime() + 1;
      } else {
        return blockTime;
      }
    })();

    const height = previousBlock?.height! + 1 || params.initialHeight || 0;
    logger.debug('Setting blockheight: ' + height);

    const convertedBlock: IBtcBlock = {
      chain,
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

  async handleReorg(params: { header?: BitcoinHeaderObj; chain: string; network: string }): Promise<boolean> {
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
      } else {
        logger.error("Previous block isn't in the DB need to roll back until we have a block in common");
      }
      logger.info(`Resetting tip to ${localTip.height - 1}, %o`, { chain, network });
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

    logger.debug('Removed data from above blockHeight: %o', localTip.height);
    return true;
  }

  _apiTransform(block: Partial<MongoBound<IBtcBlock>>, options?: TransformOptions): any {
    const transform = {
      chain: block.chain,
      network: block.network,
      hash: block.hash,
      height: block.height,
      version: block.version,
      size: block.size,
      merkleRoot: block.merkleRoot,
      time: block.time,
      timeNormalized: block.timeNormalized,
      nonce: block.nonce,
      bits: block.bits,
      /*
       *difficulty: block.difficulty,
       */
      /*
       *chainWork: block.chainWork,
       */
      previousBlockHash: block.previousBlockHash,
      nextBlockHash: block.nextBlockHash,
      reward: block.reward,
      /*
       *isMainChain: block.mainChain,
       */
      transactionCount: block.transactionCount
      /*
       *minedBy: BlockModel.getPoolInfo(block.minedBy)
       */
    };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
  }

  async getBlockFee(params: {
    chain: string,
    network: string,
    blockId: string
  }) : Promise<FeeData> {
    const { chain, network, blockId } = params;
    const transactions = blockId.length >= 64 
      ? await TransactionStorage.collection.find({ chain, network, blockHash: blockId }).toArray()
      : await TransactionStorage.collection.find({ chain, network, blockHeight: parseInt(blockId, 10) }).toArray();
    if (transactions.length <= 1)
      return { feeTotal: 0, mean: 0, median: 0, mode: 0 };

    let feeRateSum = 0;
    let feeTotal = 0;
    const feeRates: number[] = [];
    const freq = {};
    let mode = 0, maxCount = 0;
    for (const tx of transactions) {
      if (tx.coinbase) continue; // skip coinbase transaction
      const rate = tx.fee && tx.size ? tx.fee / tx.size : 0; // does not add fee rate 0 or divide by zero
      feeRates.push(rate);
      feeRateSum += rate;
      feeTotal += tx.fee || 0;
      
      freq[rate] = (freq[rate] || 0) + 1;
      if (freq[rate] > maxCount) {
        mode = rate;
        maxCount = freq[rate];
      }
    }
    const mean = feeRateSum / feeRates.length;
    feeRates.sort((a, b) => a - b);
    const median = feeRates.length % 2 === 1
      ? feeRates[Math.floor(feeRates.length / 2)]
      : (feeRates[feeRates.length / 2 - 1] + feeRates[feeRates.length / 2]) / 2;

    return { feeTotal, mean, median, mode };
  }
}

export let BitcoinBlockStorage = new BitcoinBlock();
