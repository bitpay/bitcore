import { CryptoRpc } from 'crypto-rpc';
import Web3 from 'web3';
import * as worker from 'worker_threads';
import logger from '../../../logger';
import { Config } from '../../../services/config';
import { Storage } from '../../../services/storage';
import { valueOrDefault } from '../../../utils/check';
import { EthBlockStorage } from '../models/block';
import { EthTransactionStorage } from '../models/transaction';
import { IEthBlock, IEthTransaction, ParityBlock, ParityTransaction } from '../types';
import { IRpc, Rpcs } from './rpcs';

class SyncWorker {
  private chain: string = worker.workerData.chain;
  private network: string = worker.workerData.network;
  private parentPort: worker.MessagePort = worker.parentPort as worker.MessagePort;
  private chainConfig: any;
  private web3?: Web3;
  private rpc?: IRpc;
  private stopping: boolean = false;

  constructor() {
    this.chainConfig = Config.get().chains[this.chain][this.network];
    this.connect();
  }

  async start() {
    await Storage.start();
    this.parentPort!.on('message', this.messageHandler.bind(this));
  }

  async messageHandler(msg) {
    switch (msg.message) {
      case 'shutdown':
        logger.info('Stopping syncing thread ' + worker.threadId);
        this.stopping = true;
        return;
      default:
        this.syncBlock(msg);
        return;
    }
  }

  async syncBlock({ blockNum }) {
    try {
      if (this.stopping) {
        await Storage.stop();
        process.exit(0);
      }

      const block = ((await this.rpc!.getBlock(blockNum)) as unknown) as ParityBlock;
      if (!block) {
        worker.parentPort!.postMessage({ message: 'sync', notFound: true, blockNum, threadId: worker.threadId });
        return;
      }

      logger.info('Thread ' + worker.threadId + ' here!!!!!');
      const { convertedBlock, convertedTxs } = await this.convertBlock(block);
      logger.info('Thread ' + worker.threadId + ' here22222!!!!!');
      await this.processBlock(convertedBlock, convertedTxs);
      logger.info('Thread ' + worker.threadId + ' here33333!!!!!');

      worker.parentPort!.postMessage({
        message: 'sync',
        notFound: !block,
        blockNum: block.number,
        threadId: worker.threadId
      });
    } catch (err) {
      logger.debug(`Syncing thread ${worker.threadId} error: ${err.stack}`);

      let error = err.message;
      if (error === 'Invalid JSON RPC response: ""') {
        error = null;
      }
      if (error.includes('connect')) {
        error = null;
        logger.info(`Syncing thread ${worker.threadId} lost connection to the node. Reconnecting.`);
        this.connect();
      }
      worker.parentPort!.postMessage({ message: 'sync', notFound: true, blockNum, threadId: worker.threadId, error });
    }
  }

  connect() {
    const providerIdx = worker.threadId % this.chainConfig.providers.length;
    const providerConfig = this.chainConfig.providers[providerIdx];
    const rpcConfig = { ...providerConfig, chain: this.chain, currencyConfig: {} };
    this.web3 = new CryptoRpc(rpcConfig).get(this.chain).web3;
    this.rpc = new Rpcs[this.chainConfig.client || 'geth'](this.web3!);
    return { web3: this.web3, rpc: this.rpc };
  }

  async processBlock(block: IEthBlock, transactions: IEthTransaction[]): Promise<any> {
    await EthBlockStorage.addBlock({
      chain: this.chain,
      network: this.network,
      forkHeight: this.chainConfig.forkHeight,
      parentChain: this.chainConfig.parentChain,
      initialSyncComplete: false,
      block,
      transactions
    });
  }

  async convertBlock(block: ParityBlock) {
    const blockTime = Number(block.timestamp) * 1000;
    const hash = block.hash;
    const height = block.number;
    let reward = 5;
    const ForkHeights = {
      Byzantium: 4370000,
      Constantinople: 7280000
    };

    if (height > ForkHeights.Byzantium) {
      reward = 3;
    } else if (height > ForkHeights.Constantinople) {
      reward = 2;
    }

    const convertedBlock: IEthBlock = {
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
    const transactions = block.transactions as Array<ParityTransaction>;
    const convertedTxs = transactions.map(t => this.convertTx(t, convertedBlock));
    const internalTxs = await this.rpc!.getTransactionsFromBlock(convertedBlock.height);
    for (const tx of internalTxs) {
      if (tx.type === 'reward') {
        if (tx.action.rewardType && tx.action.rewardType === 'block') {
          const gasSum = convertedTxs.reduce((sum, e) => sum + e.fee, 0);
          const totalReward = Number.parseInt(tx.action.value, 16) + gasSum;
          convertedBlock.reward = totalReward;
        }
        if (tx.action.rewardType && tx.action.rewardType === 'uncle') {
          const uncles = convertedBlock.uncleReward || [];
          const uncleValue = Number.parseInt(tx.action.value, 16);
          Object.assign(convertedBlock, { uncleReward: uncles.concat([uncleValue]) });
        }
      }
      if (tx && tx.action) {
        const foundIndex = convertedTxs.findIndex(
          t =>
            t.txid === tx.transactionHash &&
            t.from !== tx.action.from &&
            t.to.toLowerCase() !== (tx.action.to || '').toLowerCase()
        );
        if (foundIndex > -1) {
          convertedTxs[foundIndex].internal.push(tx);
        }
        if (tx.error) {
          const errorIndex = convertedTxs.findIndex(t => t.txid === tx.transactionHash);
          if (errorIndex && errorIndex > -1) {
            convertedTxs[errorIndex].error = tx.error;
          }
        }
      }
    }

    return { convertedBlock, convertedTxs };
  }

  convertTx(tx: Partial<ParityTransaction>, block?: IEthBlock): IEthTransaction {
    const txid = tx.hash || '';
    const to = tx.to || '';
    const from = tx.from || '';
    const value = Number(tx.value);
    const fee = Number(tx.gas) * Number(tx.gasPrice);
    const abiType = EthTransactionStorage.abiDecode(tx.input!);
    const nonce = tx.nonce || 0;
    const convertedTx: IEthTransaction = {
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
      // gasUsed: Number(tx.gasUsed),
      nonce,
      internal: []
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
