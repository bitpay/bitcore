import logger from '../../../logger';
import BN from 'bn.js';
import { LoggifyClass } from '../../../decorators/Loggify';
import { IEthBlock } from '../../../types/Block';
import { EventStorage } from '../.././events';
import { StorageService } from '../../../services/storage';
import { Ethereum } from '../../../types/namespaces/Ethereum';
import { EthTransactionStorage } from '../../transaction/eth/ethTransaction';
import { BlockModel } from '../base/base';

@LoggifyClass
export class EthBlockModel extends BlockModel<IEthBlock> {
  constructor(storage?: StorageService) {
    super(storage);
  }

  async onConnect() {
    super.onConnect();
  }

  async addBlock(params: {
    block: Ethereum.Block;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
  }) {
    const { block, chain, network } = params;
    const header = block.header;

    const reorg = await this.handleReorg({ header, chain, network });

    if (reorg) {
      return Promise.reject('reorg');
    }
    return this.processBlock(params);
  }

  async processBlock(params: {
    block: Ethereum.Block;
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

    await EthTransactionStorage.batchImport({
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
  }

  async getBlockOp(params: { block: Ethereum.Block; chain: string; network: string }) {
    const { block, chain, network } = params;
    const { header } = block;
    const blockTime = Number.parseInt(header.timestamp.toString('hex') || '0', 16) * 1000;
    const prevHash = header.parentHash.toString('hex');

    const previousBlock = await this.collection.findOne({ hash: prevHash, chain, network });

    const blockTimeNormalized = (() => {
      const prevTime = previousBlock ? previousBlock.timeNormalized : null;
      if (prevTime && blockTime <= prevTime.getTime()) {
        return prevTime.getTime() + 1;
      } else {
        return blockTime;
      }
    })();

    const height = new BN(header.number).toNumber();
    logger.debug('Setting blockheight', height);
    const hash = block.header.hash().toString('hex');
    const convertedBlock = {
      chain,
      network,
      height,
      hash,
      version: 1,
      merkleRoot: block.header.transactionsTrie.toString('hex'),
      time: new Date(blockTime),
      nonce: header.nonce.toString('hex'),
      timeNormalized: new Date(blockTimeNormalized),
      previousBlockHash: header.parentHash.toString('hex'),
      nextBlockHash: '',
      transactionCount: block.transactions.length,
      size: block.raw.length,
      reward: 3,
      processed: false,
      bits: 0,
      gasLimit: Number.parseInt(header.gasLimit.toString('hex'), 16) || 0,
      gasUsed: Number.parseInt(header.gasUsed.toString('hex'), 16) || 0,
      stateRoot: header.stateRoot
    };
    return {
      updateOne: {
        filter: {
          hash,
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

  async handleReorg(params: { header: Ethereum.Header; chain: string; network: string }): Promise<boolean> {
    const { header, chain, network } = params;
    const prevHash = header.parentHash.toString('hex');
    let localTip = await this.getLocalTip(params);
    if (header != null && localTip != null && localTip.hash === prevHash) {
      return false;
    }
    if (!localTip || localTip.height === 0) {
      return false;
    }
    if (header) {
      const prevBlock = await this.collection.findOne({ chain, network, hash: prevHash });
      if (prevBlock) {
        localTip = prevBlock;
      } else {
        logger.error(`Previous block isn't in the DB need to roll back until we have a block in common`);
      }
      logger.info(`Resetting tip to ${localTip.height - 1}`, { chain, network });
    }
    const reorgOps = [
      this.collection.deleteMany({ chain, network, height: { $gt: localTip.height } }),
      EthTransactionStorage.collection.deleteMany({ chain, network, blockHeight: { $gt: localTip.height } })
    ];
    await Promise.all(reorgOps);

    logger.debug('Removed data from above blockHeight: ', localTip.height);
    return localTip.hash !== prevHash;
  }
}

export let EthBlockStorage = new EthBlockModel();
