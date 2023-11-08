import { CryptoRpc } from 'crypto-rpc';
import Web3 from 'web3';
import * as worker from 'worker_threads';
import logger from '../../../../logger';
import { Config } from '../../../../services/config';
import { Storage } from '../../../../services/storage';
import { valueOrDefault } from '../../../../utils/check';
import { wait } from '../../../../utils/wait';
import { EVMBlockStorage } from '../models/block';
import { EVMTransactionStorage } from '../models/transaction';
import { AnyBlock, ErigonTransaction, GethTransaction, IEVMBlock, IEVMTransactionInProcess } from '../types';
import { IRpc, Rpcs } from './rpcs';

export class SyncWorker {
  private chain: string = worker.workerData.chain;
  private network: string = worker.workerData.network;
  private parentPort: worker.MessagePort = worker.parentPort as worker.MessagePort;
  private chainConfig: any;
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
        blockNum: block.number,
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

  getBlockReward(block: AnyBlock): number {
    block;
    return 0;
  }

  async convertBlock(block: AnyBlock) {
    const blockTime = Number(block.timestamp) * 1000;
    const hash = block.hash;
    const height = block.number;
    const reward = this.getBlockReward(block);

    const convertedBlock: IEVMBlock = {
      chain: this.chain,
      network: this.network,
      height,
      hash,
      coinbase: Buffer.from(block.miner),
      merkleRoot: Buffer.from(block.transactionsRoot),
      time: new Date(blockTime),
      timeNormalized: new Date(blockTime),
      nonce: Buffer.from(block.extraData),
      previousBlockHash: block.parentHash,
      difficulty: block.difficulty,
      totalDifficulty: block.totalDifficulty,
      nextBlockHash: '',
      transactionCount: block.transactions.length,
      size: block.size,
      reward,
      logsBloom: Buffer.from(block.logsBloom),
      sha3Uncles: Buffer.from(block.sha3Uncles),
      receiptsRoot: Buffer.from(block.receiptsRoot),
      processed: false,
      gasLimit: block.gasLimit,
      gasUsed: block.gasUsed,
      stateRoot: Buffer.from(block.stateRoot)
    };
    const transactions = block.transactions as Array<ErigonTransaction>;
    const convertedTxs = transactions.map(t => this.convertTx(t, convertedBlock));
    const traceTxs = await this.rpc!.getTransactionsFromBlock(convertedBlock.height);
    EVMTransactionStorage.addEffectsToTxs(convertedTxs);
    this.rpc!.reconcileTraces(convertedBlock, convertedTxs, traceTxs);

    return { convertedBlock, convertedTxs };
  }

  convertTx(tx: Partial<ErigonTransaction | GethTransaction>, block?: IEVMBlock): IEVMTransactionInProcess {
    const txid = tx.hash || '';
    const to = tx.to || '';
    const from = tx.from || '';
    const value = Number(tx.value);
    const fee = Number(tx.gas) * Number(tx.gasPrice);
    const abiType = EVMTransactionStorage.abiDecode(tx.input!);
    const nonce = tx.nonce || 0;
    const convertedTx: IEVMTransactionInProcess = {
      chain: this.chain,
      network: this.network,
      blockHeight: valueOrDefault(tx.blockNumber, -1),
      blockHash: valueOrDefault(tx.blockHash, undefined),
      data: Buffer.from(tx.input || '0x'),
      txid,
      blockTime: new Date(),
      blockTimeNormalized: new Date(),
      fee,
      transactionIndex: tx.transactionIndex || 0,
      value,
      wallets: [],
      to,
      from,
      gasLimit: Number(tx.gas),
      gasPrice: Number(tx.gasPrice),
      nonce,
      internal: [],
      calls: []
    };

    if (abiType) {
      convertedTx.abiType = abiType;
    }

    if (block) {
      const { hash: blockHash, time: blockTime, timeNormalized: blockTimeNormalized, height } = block;
      return {
        ...convertedTx,
        blockHeight: height,
        blockHash,
        blockTime,
        blockTimeNormalized
      };
    }
    return convertedTx;
  }
}

worker.parentPort!.once('message', async function(msg) {
  if (msg.message !== 'start') {
    throw new Error('Unknown startup message');
  }
  await new SyncWorker().start();
  return worker.parentPort!.postMessage({ message: 'ready' });
});
