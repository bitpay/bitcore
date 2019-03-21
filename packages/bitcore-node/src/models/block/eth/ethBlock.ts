import logger from '../../../logger';
import BN from 'bn.js';
import { BtcTransactionStorage } from '../.././transaction/btc/btcTransaction';
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
    const blockTime = new Date(header.timestamp.readUInt32BE(0) * 1000).getTime();
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

    const height = (previousBlock && previousBlock.height + 1) || 1;
    logger.debug('Setting blockheight', height);

    const convertedBlock = {
      chain,
      network,
      height: new BN(header.number).toNumber(),
      hash: block.header.hash().toString('hex'),
      version: 1,
      merkleRoot: block.header.transactionsTrie.toString('hex'),
      time: new Date(header.timestamp.readUInt32BE(0) * 1000),
      timeNormalized: new Date(header.timestamp.readUInt32BE(0) * 1000),
      nonce: Number(header.nonce.toString('hex')),
      blockTimeNormalized,
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

  async handleReorg(params: { header: Ethereum.Header; chain: string; network: string }): Promise<boolean> {
    const { header, chain, network } = params;
    const prevHash = header.parentHash.toString('hex');
    let localTip = await this.getLocalTip(params);
    if (header && localTip && localTip.hash === prevHash) {
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
      this.collection.deleteMany({ chain, network, height: { $gte: localTip.height } }),
      BtcTransactionStorage.collection.deleteMany({ chain, network, blockHeight: { $gte: localTip.height } })
    ];
    await Promise.all(reorgOps);

    logger.debug('Removed data from above blockHeight: ', localTip.height);
    return true;
  }
}

export let EthBlockStorage = new EthBlockModel();
