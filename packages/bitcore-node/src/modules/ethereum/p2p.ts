import Web3 from 'web3';
import logger from '../../logger';
import { ChainStateProvider } from '../../providers/chain-state';
import { StateStorage } from '../../models/state';
import { ETHStateProvider } from '../../providers/chain-state/eth/eth';
import { EthBlockModel, EthBlockStorage } from './models/block';
import { IEthTransaction, IEthBlock, Parity } from './types';
import { ParityRPC } from './parityRpc';
import { BaseP2PWorker } from '../../services/p2p';
import { EthTransactionModel, EthTransactionStorage } from './models/transaction';
import { timestamp } from '../../logger';

export class EthP2pWorker extends BaseP2PWorker<IEthBlock> {
  private chainConfig: any;
  private syncing: boolean;
  private initialSyncComplete: boolean;
  private blockModel: EthBlockModel;
  private txModel: EthTransactionModel;
  private web3: Web3;
  private txSubscription: any;
  private blockSubscription: any;
  private rpc: ParityRPC;

  constructor({ chain, network, chainConfig, blockModel = EthBlockStorage, txModel = EthTransactionStorage }) {
    super({ chain, network, chainConfig, blockModel });
    this.chain = chain || 'ETH';
    this.network = network;
    this.chainConfig = chainConfig;
    this.syncing = true;
    this.initialSyncComplete = false;
    this.blockModel = blockModel;
    this.txModel = txModel;
    this.web3 = new ETHStateProvider().getWeb3(network);
    this.rpc = new ParityRPC(this.web3);
  }

  setupListeners() {
    this.txSubscription = this.rpc.web3.eth.subscribe('pendingTransactions', tx => {
      if (!this.syncing) {
        this.processTransaction(tx);
      }
    });
    this.blockSubscription = this.rpc.web3.eth.subscribe('newBlockHeaders', () => {
      if (!this.syncing) {
        this.sync();
      }
    });
  }

  async disconnect() {
    this.txSubscription.unsubscribe();
    this.blockSubscription.unsubscribe();
  }

  public async getBlock(height: number) {
    return this.rpc.getBlock(height);
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
    let bestBlock = await this.rpc.web3.eth.getBlockNumber();
    let currentHeight = tip ? tip.height : 0;
    logger.info(`Syncing ${bestBlock - currentHeight} blocks for ${chain} ${network}`);
    while (currentHeight < bestBlock) {
      tip = await ChainStateProvider.getLocalTip({ chain, network });
      let lastLog = 0;
      try {
        const block = await this.getBlock(currentHeight);
        const { convertedBlock, convertedTxs } = this.convertBlock(block);
        const internalTxs = await this.rpc.getTransactionsFromBlock(convertedBlock.height);
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
          bestBlock = await this.rpc.web3.eth.getBlockNumber();
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
      coinbase: block.author.toLowerCase(),
      merkleRoot: block.transactionsRoot,
      time: new Date(blockTime),
      timeNormalized: new Date(blockTime),
      nonce: block.nonce,
      previousBlockHash: block.parentHash,
      nextBlockHash: '',
      transactionCount: block.transactions.length,
      size: block.size,
      reward,
      processed: false,
      gasLimit: block.gasLimit,
      gasUsed: block.gasUsed,
      stateRoot: Buffer.from(block.stateRoot)
    };
    const convertedTxs = block.transactions.map(t => this.convertTx(t, convertedBlock));
    return { convertedBlock, convertedTxs };
  }

  convertTx(tx: Parity.Transaction, block?: IEthBlock): IEthTransaction {
    if (!block) {
      const txid = tx.hash;
      const to = (tx.to || '').toLowerCase();
      const from = tx.from.toLowerCase();
      const value = Number(tx.value);
      const fee = Number(tx.gas) * Number(tx.gasPrice);
      const abiType = this.rpc.abiDecode(tx.input);
      const nonce = tx.nonce;
      const convertedTx: IEthTransaction = {
        chain: this.chain,
        network: this.network,
        blockHeight: -1,
        data: Buffer.from(tx.input),
        txid,
        blockHash: undefined,
        blockTime: new Date(),
        blockTimeNormalized: new Date(),
        fee,
        size: tx.input.length,
        value,
        wallets: [],
        to,
        from,
        gasLimit: Number(tx.gas),
        gasPrice: Number(tx.gasPrice),
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
    logger.debug(`Stopping worker for chain ${this.chain}`);
    await this.disconnect();
  }

  async start() {
    logger.debug(`Started worker for chain ${this.chain}`);
    this.setupListeners();
    this.sync();
  }
}
