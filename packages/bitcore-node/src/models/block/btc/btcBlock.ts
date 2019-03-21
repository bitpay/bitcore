import { valueOrDefault } from '../../../utils/check';
import { CoinStorage } from '../.././coin';
import { BtcTransactionStorage } from '../.././transaction/btc/btcTransaction';
import { TransformOptions } from '../../../types/TransformOptions';
import { LoggifyClass } from '../../../decorators/Loggify';
import { Bitcoin } from '../../../types/namespaces/Bitcoin';
import { MongoBound } from '../.././base';
import logger from '../../../logger';
import { IBtcBlock } from '../../../types/Block';
import { SpentHeightIndicators } from '../../../types/Coin';
import { EventStorage } from '../.././events';
import config from '../../../config';
import { StorageService } from '../../../services/storage';
import { BlockModel } from '../base/base';
export { IBtcBlock };

@LoggifyClass
export class BtcBlockModel extends BlockModel<IBtcBlock> {
  constructor(storage?: StorageService) {
    super(storage);
  }

  chainTips: Mapping<Mapping<IBtcBlock>> = {};

  async onConnect() {
    super.onConnect();
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

    await BtcTransactionStorage.batchImport({
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
    logger.debug('Setting blockheight', height);

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

  updateCachedChainTip(params: { block: IBtcBlock; chain: string; network: string }) {
    const { chain, network, block } = params;
    this.chainTips[chain] = valueOrDefault(this.chainTips[chain], {});
    this.chainTips[chain][network] = valueOrDefault(this.chainTips[chain][network], block);
    if (this.chainTips[chain][network].height < block.height) {
      this.chainTips[chain][network] = block;
    }
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
        this.updateCachedChainTip({ chain, network, block: prevBlock });
      } else {
        delete this.chainTips[chain][network];
        logger.error(`Previous block isn't in the DB need to roll back until we have a block in common`);
      }
      logger.info(`Resetting tip to ${localTip.height - 1}`, { chain, network });
    }
    const reorgOps = [
      this.collection.deleteMany({ chain, network, height: { $gte: localTip.height } }),
      BtcTransactionStorage.collection.deleteMany({ chain, network, blockHeight: { $gte: localTip.height } }),
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

  _apiTransform(block: Partial<MongoBound<IBtcBlock>>, options?: TransformOptions): any {
    return super._apiTransform(block, options);
  }
}

export let BtcBlockStorage = new BtcBlockModel();
