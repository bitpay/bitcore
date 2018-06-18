import { CoinModel } from './coin';
import { TransactionModel } from './transaction';
import { TransformOptions } from '../types/TransformOptions';
import { ChainNetwork } from '../types/ChainNetwork';
import { LoggifyClass } from '../decorators/Loggify';
import { Bitcoin } from '../types/namespaces/Bitcoin';
import { BaseModel } from "./base";
import logger from '../logger';

export type IBlock = {
  chain: string;
  network: string;
  height: number;
  hash: string;
  version: number;
  merkleRoot: string;
  time: Date;
  timeNormalized: Date;
  nonce: number;
  previousBlockHash: string;
  nextBlockHash: string;
  transactionCount: number;
  size: number;
  bits: number;
  reward: number;
  processed: boolean;
}

@LoggifyClass
class Block extends BaseModel<IBlock> {

  constructor() {
    super('blocks');
    this.collection.createIndex({ hash: 1 });
    this.collection.createIndex({ chain: 1, network: 1, processed: 1, height: -1 });
    this.collection.createIndex({ chain: 1, network: 1, timeNormalized: 1 });
    this.collection.createIndex({ previousBlockHash: 1 });
  }

  async addBlock(params: {
    block: Bitcoin.Block;
    parentChain?: string;
    forkHeight?: number;
    chain: string;
    network: string;
  }) {
    const { block, chain, network, parentChain, forkHeight } = params;
    const header = block.header.toObject();
    const blockTime = header.time * 1000;

    await this.handleReorg({ header, chain, network });

    const previousBlock = (await this.collection.findOneAndUpdate({
      hash: header.prevHash,
      chain,
      network
    }, {nextBlockHash: header.hash})).value;

    const blockTimeNormalized = (() => {
      if (previousBlock && blockTime <= previousBlock.timeNormalized.getTime()) {
        return previousBlock.timeNormalized.getTime() + 1;
      } else {
        return blockTime;
      }
    })();

    const height = (previousBlock && previousBlock.height + 1) || 1;
    logger.debug('Setting blockheight', height);

    await this.collection.update(
      {
        hash: header.hash,
        chain,
        network
      },
      {
        chain,
        network,
        height,
        version: header.version,
        previousBlockHash: header.prevHash,
        merkleRoot: header.merkleRoot,
        time: new Date(blockTime),
        timeNormalized: new Date(blockTimeNormalized),
        bits: header.bits,
        nonce: header.nonce,
        transactionCount: block.transactions.length,
        size: block.toBuffer().length,
        reward: block.transactions[0].outputAmount
      },
      {
        upsert: true
      }
    );

    await TransactionModel.batchImport({
      txs: block.transactions,
      blockHash: header.hash,
      blockTime: new Date(blockTime),
      blockTimeNormalized: new Date(blockTimeNormalized),
      height: height,
      chain,
      network,
      parentChain,
      forkHeight
    });

    return this.collection.update(
      { hash: header.hash, chain, network },
      { $set: { processed: true } }
    );
  }


  getPoolInfo(coinbase: string) {
    //TODO need to make this actually parse the coinbase input and map to miner strings
    // also should go somewhere else
    return coinbase;
  };

  async getLocalTip(params: ChainNetwork)  {
    const { chain, network } = params;
    const [ bestBlock ] = await this.collection.find({
      processed: true,
      chain,
      network
    }).sort({ height: -1 }).limit(1).toArray();
    return bestBlock || { height: 0 };
  };


  async getLocatorHashes(params: ChainNetwork) {
    const { chain, network } = params;
    const locatorBlocks = await this.collection.find({
      processed: true,
      chain,
      network
    })
      .sort({ height: -1 })
      .limit(30)
      .toArray();

    if (locatorBlocks.length < 2) {
      return [Array(65).join('0')];
    }
    return locatorBlocks.map(block => block.hash);
  };


  async handleReorg(params: {
    header?: Bitcoin.Block.HeaderObj;
    chain: string;
    network: string;
  }) {
    const { header, chain, network } = params;
    const localTip = await BlockModel.getLocalTip(params);
    if (header && localTip.hash === header.prevHash) {
      return;
    }
    if (localTip.height === 0) {
      return;
    }
    logger.info(`Resetting tip to ${localTip.previousBlockHash}`, {
      chain,
      network
    });

    await this.collection.remove({
      chain,
      network,
      height: {
        $gte: localTip.height
      }
    });
    await TransactionModel.remove({
      chain,
      network,
      blockHeight: {
        $gte: localTip.height
      }
    });
    await CoinModel.remove({
      chain,
      network,
      mintHeight: {
        $gte: localTip.height
      }
    });
    await CoinModel.update(
      {
        chain,
        network,
        spentHeight: {
          $gte: localTip.height
        }
      },
      {
        $set: { spentTxid: null, spentHeight: -1 }
      },
      {
        multi: true
      }
    );

    logger.debug('Removed data from above blockHeight: ', localTip.height);
  };



  _apiTransform( block: IBlock, options: TransformOptions) {
    let transform = {
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
  };
}

export let BlockModel = new Block();
