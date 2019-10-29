import Web3 from 'web3';
import logger from '../../logger';
import { ChainStateProvider } from '../../providers/chain-state';
import { StateStorage } from '../../models/state';
import { EthBlockModel, EthBlockStorage } from './models/block';
import { IEthTransaction, IEthBlock, Parity } from './types';
import { ParityRPC } from './parityRpc';
import { BaseP2PWorker } from '../../services/p2p';
import { EthTransactionModel, EthTransactionStorage } from './models/transaction';
import { timestamp } from '../../logger';
import { ETHStateProvider } from './api/csp';
import { valueOrDefault } from '../../utils/check';
import { wait } from '../../utils/wait';

export class EthP2pWorker extends BaseP2PWorker<IEthBlock> {
  private chainConfig: any;
  private syncing: boolean;
  private initialSyncComplete: boolean;
  private blockModel: EthBlockModel;
  private txModel: EthTransactionModel;
  private txSubscription: any;
  private blockSubscription: any;
  private rpc?: ParityRPC;
  private provider: ETHStateProvider;
  private web3?: Web3;

  constructor({ chain, network, chainConfig, blockModel = EthBlockStorage, txModel = EthTransactionStorage }) {
    super({ chain, network, chainConfig, blockModel });
    this.chain = chain || 'ETH';
    this.network = network;
    this.chainConfig = chainConfig;
    this.syncing = true;
    this.initialSyncComplete = false;
    this.blockModel = blockModel;
    this.txModel = txModel;
    this.provider = new ETHStateProvider();
  }

  async setupListeners() {
    this.txSubscription = await this.web3!.eth.subscribe('pendingTransactions');
    this.txSubscription.subscribe(async (_err, txid) => {
      if (!this.syncing) {
        const tx = (await this.web3!.eth.getTransaction(txid)) as Parity.Transaction;
        if (tx) {
          this.processTransaction(tx);
        }
      }
    });
    this.blockSubscription = await this.web3!.eth.subscribe('newBlockHeaders');
    this.blockSubscription.subscribe(() => {
      if (!this.syncing) {
        this.sync();
      }
    });
  }

  async disconnect() {
    try {
      if (this.txSubscription) {
        this.txSubscription.unsubscribe();
      }
      if (this.blockSubscription) {
        this.blockSubscription.unsubscribe();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async getWeb3() {
    return this.provider.getWeb3(this.network);
  }

  async connect() {
    let connected = false;
    let attempt = false;
    const { host, port } = this.chainConfig.provider;
    while (!connected) {
      try {
        if (attempt) {
          logger.warn(
            `${timestamp()} | Not connected to peer: ${host}:${port} | Chain: ${this.chain} | Network: ${this.network}`
          );
        }
        attempt = true;
        this.web3 = await this.getWeb3();
        this.rpc = new ParityRPC(this.web3);
        connected = await this.web3.eth.net.isListening();
      } catch (e) {}
      await wait(20000);
    }

    logger.info(
      `${timestamp()} | Connected to peer: ${host}:${port} | Chain: ${this.chain} | Network: ${this.network}`
    );
  }

  public async getBlock(height: number) {
    return this.rpc!.getBlock(height);
  }

  async processBlock(block: IEthBlock, transactions: IEthTransaction[]): Promise<any> {
    await this.blockModel.addBlock({
      chain: this.chain,
      network: this.network,
      forkHeight: this.chainConfig.forkHeight,
      parentChain: this.chainConfig.parentChain,
      initialSyncComplete: this.initialSyncComplete,
      block,
      transactions
    });
    if (!this.syncing) {
      logger.info(`Added block ${block.hash}`, {
        chain: this.chain,
        network: this.network
      });
    }
  }

  async processTransaction(tx: Parity.Transaction) {
    const now = new Date();
    const convertedTx = this.convertTx(tx);
    this.txModel.batchImport({
      chain: this.chain,
      network: this.network,
      txs: [convertedTx],
      height: -1,
      mempoolTime: now,
      blockTime: now,
      blockTimeNormalized: now,
      initialSyncComplete: true
    });
  }

  async sync() {
    const { chain, chainConfig, network } = this;
    const { parentChain, forkHeight } = chainConfig;
    this.syncing = true;
    const state = await StateStorage.collection.findOne({});
    this.initialSyncComplete =
      state && state.initialSyncComplete && state.initialSyncComplete.includes(`${chain}:${network}`);
    let tip = await ChainStateProvider.getLocalTip({ chain, network });
    if (parentChain && (!tip || tip.height < forkHeight)) {
      let parentTip = await ChainStateProvider.getLocalTip({ chain: parentChain, network });
      while (!parentTip || parentTip.height < forkHeight) {
        logger.info(`Waiting until ${parentChain} syncs before ${chain} ${network}`);
        await new Promise(resolve => {
          setTimeout(resolve, 5000);
        });
        parentTip = await ChainStateProvider.getLocalTip({ chain: parentChain, network });
      }
    }

    const startHeight = tip ? tip.height : 0;
    const startTime = Date.now();
    let bestBlock = await this.web3!.eth.getBlockNumber();
    let lastLog = 0;
    let currentHeight = tip ? tip.height : 0;
    logger.info(`Syncing ${bestBlock - currentHeight} blocks for ${chain} ${network}`);
    while (startHeight < bestBlock && currentHeight <= bestBlock) {
      tip = await ChainStateProvider.getLocalTip({ chain, network });
      try {
        const block = ((await this.getBlock(currentHeight)) as unknown) as Parity.Block;
        const { convertedBlock, convertedTxs } = this.convertBlock(block);
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

        await this.processBlock(convertedBlock, convertedTxs);
        currentHeight++;
        if (currentHeight === bestBlock) {
          bestBlock = await this.web3!.eth.getBlockNumber();
        }
        const oneSecond = 1000;
        const now = Date.now();
        if (now - lastLog > oneSecond) {
          const blocksProcessed = currentHeight - startHeight;
          const elapsedMinutes = (now - startTime) / (60 * oneSecond);
          logger.info(
            `${timestamp()} | Syncing... | Chain: ${chain} | Network: ${network} |${(blocksProcessed / elapsedMinutes)
              .toFixed(2)
              .padStart(8)} blocks/min | Height: ${currentHeight.toString().padStart(7)}`
          );
          lastLog = Date.now();
        }
      } catch (err) {
        logger.error(`Error syncing ${chain} ${network}`, err);
        return this.sync();
      }
    }
    logger.info(`${chain}:${network} up to date.`);
    this.syncing = false;
    StateStorage.collection.findOneAndUpdate(
      {},
      { $addToSet: { initialSyncComplete: `${chain}:${network}` } },
      { upsert: true }
    );
    return true;
  }

  convertBlock(block: Parity.Block) {
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
    const transactions = block.transactions as Array<Parity.Transaction>;
    const convertedTxs = transactions.map(t => this.convertTx(t, convertedBlock));
    return { convertedBlock, convertedTxs };
  }

  convertTx(tx: Partial<Parity.Transaction>, block?: IEthBlock): IEthTransaction {
    if (!block) {
      const txid = tx.hash || '';
      const to = tx.to || '';
      const from = tx.from || '';
      const value = Number(tx.value);
      const fee = Number(tx.gas) * Number(tx.gasPrice);
      const abiType = this.txModel.abiDecode(tx.input!);
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
        nonce: nonce,
        internal: []
      };
      if (abiType) {
        convertedTx.abiType = abiType;
      }
      return convertedTx;
    } else {
      const { hash: blockHash, time: blockTime, timeNormalized: blockTimeNormalized, height } = block;
      const noBlockTx = this.convertTx(tx);
      return {
        ...noBlockTx,
        blockHeight: height,
        blockHash,
        blockTime,
        blockTimeNormalized
      };
    }
  }

  async stop() {
    this.stopping = true;
    logger.debug(`Stopping worker for chain ${this.chain} ${this.network}`);
    await this.disconnect();
  }

  async start() {
    logger.debug(`Started worker for chain ${this.chain} ${this.network}`);
    await this.connect();
    this.setupListeners();
    this.sync();
  }
}
