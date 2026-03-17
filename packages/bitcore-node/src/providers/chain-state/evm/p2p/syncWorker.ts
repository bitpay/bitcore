import * as worker from 'worker_threads';
import { CryptoRpc } from '@bitpay-labs/crypto-rpc';
import logger from '../../../../logger';
import { Config } from '../../../../services/config';
import { Storage } from '../../../../services/storage';
import { wait } from '../../../../utils';
import { EVMBlockStorage } from '../models/block';
import { EVMTransactionStorage } from '../models/transaction';
import { type IRpc, Rpcs } from './rpcs';
import type { IEVMBlock, IEVMTransactionInProcess } from '../types';
import type { Web3, Web3Types } from '@bitpay-labs/crypto-wallet-core';

export class SyncWorker {
  private chain: string = worker.workerData.chain;
  private network: string = worker.workerData.network;
  private parentPort: worker.MessagePort = worker.parentPort as worker.MessagePort;
  private chainConfig: any;
  private txModel = EVMTransactionStorage;
  private web3?: Web3;
  private rpc?: IRpc;
  private client?: 'erigon' | 'geth';
  private stopping: boolean = false;
  private isWorking: boolean = false;

  constructor() {
    this.chainConfig = Config.get().chains[this.chain][this.network];
  }

  async start() {
    await this.connect();
    await Storage.start();
    this.parentPort!.on('message', this.messageHandler.bind(this));
  }

  async stop() {
    this.stopping = true;
    logger.info('Stopping syncing thread ' + worker.threadId);
    while (this.isWorking) {
      await wait(1000);
    }
    await Storage.stop();
    await (this.web3?.currentProvider as any)?.disconnect();
    process.exit(0);
  }

  async messageHandler(msg) {
    switch (msg.message) {
      case 'shutdown':
        this.stop();
        return;
      default:
        this.syncBlock(msg);
        return;
    }
  }

  async syncBlock({ blockNum }) {
    try {
      if (this.stopping) {
        return;
      }
      this.isWorking = true;

      const block = await this.rpc!.getBlock(blockNum);
      if (!block) {
        worker.parentPort!.postMessage({ message: 'sync', notFound: true, blockNum, threadId: worker.threadId });
        return;
      }

      const { convertedBlock, convertedTxs } = await this.convertBlock(block);
      await this.processBlock(convertedBlock, convertedTxs);

      worker.parentPort!.postMessage({
        message: 'sync',
        notFound: !block,
        blockNum: Number(block.number),
        threadId: worker.threadId
      });
    } catch (err: any) {
      logger.debug(`Syncing thread ${worker.threadId} error: ${err.stack}`);

      let error = err.message;
      if (error === 'Invalid JSON RPC response: ""') {
        error = null;
      }
      if (error.includes('connect')) {
        error = null;
        logger.info(`Syncing thread ${worker.threadId} lost connection to the node. Reconnecting.`);
        await this.connect();
      }
      worker.parentPort!.postMessage({ message: 'sync', notFound: true, blockNum, threadId: worker.threadId, error });
    } finally {
      this.isWorking = false;
    }
  }

  async getClient() {
    const nodeVersion = await this.web3!.eth.getNodeInfo();
    const client = nodeVersion.split('/')[0].toLowerCase() as 'erigon' | 'geth';
    if (client !== 'erigon' && client !== 'geth') {
      // assume it's a geth fork, or at least more like geth.
      // this is helpful when using a dev solution like ganache.
      return 'geth';
    }
    return client;
  }

  async connect() {
    const providerIdx = worker.threadId % (this.chainConfig.providers || []).length;
    const providerConfig = this.chainConfig.provider || this.chainConfig.providers[providerIdx];
    const rpcConfig = { ...providerConfig, chain: this.chain, currencyConfig: {} };
    this.web3 = new CryptoRpc(rpcConfig).get(this.chain).web3;
    this.client = await this.getClient();
    this.rpc = new Rpcs[this.client](this.web3!);
    return { web3: this.web3, rpc: this.rpc };
  }

  async processBlock(block: IEVMBlock, transactions: IEVMTransactionInProcess[]): Promise<any> {
    await EVMBlockStorage.addBlock({
      chain: this.chain,
      network: this.network,
      forkHeight: this.chainConfig.forkHeight,
      parentChain: this.chainConfig.parentChain,
      initialSyncComplete: false,
      block,
      transactions
    });
  }

  getBlockReward(block: Web3Types.Block): number {
    block;
    return 0;
  }

  async convertBlock(block: Web3Types.Block) {
    const blockTime = Number(block.timestamp) * 1000;
    const hash = block.hash as string;
    const height = block.number;
    const reward = this.getBlockReward(block);

    const convertedBlock: IEVMBlock = {
      chain: this.chain,
      network: this.network,
      height: Number(height),
      hash,
      coinbase: Buffer.from(block.miner),
      merkleRoot: Buffer.from(block.transactionsRoot),
      time: new Date(blockTime),
      timeNormalized: new Date(blockTime),
      nonce: Buffer.from(block.extraData),
      previousBlockHash: block.parentHash as string,
      difficulty: Number(block.difficulty).toString(),
      totalDifficulty: block.totalDifficulty != undefined ? Number(block.totalDifficulty).toString() : undefined,
      nextBlockHash: '',
      transactionCount: block.transactions.length,
      size: Number(block.size),
      reward,
      logsBloom: Buffer.from(block.logsBloom as string),
      sha3Uncles: Buffer.from(block.sha3Uncles),
      receiptsRoot: Buffer.from(block.receiptsRoot),
      processed: false,
      gasLimit: Number(block.gasLimit),
      gasUsed: Number(block.gasUsed),
      stateRoot: Buffer.from(block.stateRoot)
    };
    const convertedTxs = block.transactions.map(t => this.txModel.convertRawTx(this.chain, this.network, t, convertedBlock));
    const traceTxs = await this.rpc!.getTransactionsFromBlock(convertedBlock.height);
    this.rpc!.reconcileTraces(convertedBlock, convertedTxs, traceTxs);
    this.txModel.addEffectsToTxs(convertedTxs);
    return { convertedBlock, convertedTxs };
  }

}

worker.parentPort!.once('message', async function(msg) {
  if (msg.message !== 'start') {
    throw new Error('Unknown startup message');
  }
  await new SyncWorker().start();
  return worker.parentPort!.postMessage({ message: 'ready' });
});
