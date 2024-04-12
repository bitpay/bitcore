import { CryptoRpc } from 'crypto-rpc';
import _ from 'lodash';
import Web3 from 'web3';
import Config from '../../../../config';
import logger from '../../../../logger';
import { IBlock } from '../../../../types/Block';
import { IChainConfig, IEVMNetworkConfig, IProvider } from '../../../../types/Config';
import {
  ExternalGetBlockResults,
  GetBlockParams,
  GetWalletBalanceAtTimeParams,
  IChainStateService,
  StreamAddressUtxosParams,
  StreamBlocksParams,
  StreamTransactionParams,
  StreamTransactionsParams
} from '../../../../types/namespaces/ChainStateProvider';
import { StatsUtil } from '../../../../utils/stats';
import MoralisAPI from '../../external/moralis';
import { InternalStateProvider } from '../../internal/internal';
import { EVMTransactionStorage } from '../models/transaction';
import { EVMTransactionJSON } from '../types';
import { BaseEVMStateProvider } from './csp';
import { 
  getProvider,
  isValidProviderType
 } from './provider';

export class BaseEVMExternalStateProvider extends InternalStateProvider implements IChainStateService {
  config: IChainConfig<IEVMNetworkConfig>;

  constructor(public chain: string = 'ETH') {
    super(chain);
    this.config = Config.chains[this.chain] as IChainConfig<IEVMNetworkConfig>;
  }

  async getWeb3(network: string, params?: { type: IProvider['dataType'] }): Promise<{ rpc: CryptoRpc; web3: Web3; dataType: string }> {
    try {
      if (isValidProviderType(params?.type, BaseEVMStateProvider.rpcs[this.chain]?.[network]?.dataType)) {
        await BaseEVMStateProvider.rpcs[this.chain][network].web3.eth.getBlockNumber();
      }
    } catch (e) {
      delete BaseEVMStateProvider.rpcs[this.chain][network];
    }
    if (!BaseEVMStateProvider.rpcs[this.chain] || !BaseEVMStateProvider.rpcs[this.chain][network]) {
      logger.info(`Making a new connection for ${this.chain}:${network}`);
      const dataType = params?.type;
      const providerConfig = getProvider({ network, dataType, config: this.config });
      // Default to using ETH CryptoRpc with all EVM chain configs
      const rpcConfig = { ...providerConfig, chain: 'ETH', currencyConfig: {} };
      const rpc = new CryptoRpc(rpcConfig, {}).get('ETH');
      if (BaseEVMStateProvider.rpcs[this.chain]) {
        BaseEVMStateProvider.rpcs[this.chain][network] = { rpc, web3: rpc.web3, dataType: dataType || 'combinded' };
      } else {
        BaseEVMStateProvider.rpcs[this.chain] = { [network]: { rpc, web3: rpc.web3, dataType: dataType || 'combinded'  } };
      }
    }
    return BaseEVMStateProvider.rpcs[this.chain][network];
  }

  async getLocalTip({ chain, network }): Promise<IBlock> {
    const { web3 } = await this.getWeb3(network);
    const block = await web3.eth.getBlock('latest');
    return this.transformBlockData({ chain, network, block }) as IBlock;
  }

  async getFee(params) {
    let { network, target = 4 } = params;
    const { web3 } = await this.getWeb3(network, { type: 'historical' });
    const latestBlock = await web3.eth.getBlockNumber();
    // Getting the 25th percentile gas prices from the last 4k blocks
    const feeHistory = await web3.eth.getFeeHistory(20 * 200, latestBlock, [25]);
    const gasPrices = feeHistory.reward.map(reward => parseInt(reward[0])).sort((a, b) => b - a);
    const whichQuartile = Math.min(target, 4) || 1;
    const quartileMedian = StatsUtil.getNthQuartileMedian(gasPrices, whichQuartile);
    const roundedGwei = (quartileMedian / 1e9).toFixed(2);
    const gwei = Number(roundedGwei) || 0;
    const feerate = gwei * 1e9;
    return { feerate, blocks: target };
  }

  async getBlocks(params: GetBlockParams) {
    // TODO use sparse data when available and necessary
    // otherwise use external providers to access data
    try {
      const { chain, network } = params;
      const { query } = await this.getBlocksParams(params);
      const { web3 } = await this.getWeb3(network, { type: 'historical' });
      const tip = await this.getLocalTip(params);
      const tipHeight = tip ? tip.height : 0;
      const blockTransform = async (block) => {
        block = await block;
        let confirmations = 0;
        const blockHeight = block.height || block.number || 0;
        if (blockHeight >= 0 ) {
          confirmations = tipHeight - blockHeight + 1;
        }
        const convertedBlock = this.transformBlockData({ chain, network, block }) as IBlock;
        return { ...convertedBlock, confirmations };
      };

      const batch = new web3.eth.BatchRequest();
      const blockPromises: Promise<any>[] = [];
      const blockNumbers = _.range(query.startBlock, query.endBlock + 1);
      // batch getBlock requests to reduce latency
     for (let i = 0; i < blockNumbers.length; i++) {
        const blockPromise = new Promise<any>((resolve, reject) => {
          batch.add(
            (web3.eth.getBlock as any).request(blockNumbers[i], (error, block) => {
              if (error) {
                return reject(error);
              }
              return resolve(block);
          }));
        });
        blockPromises.push(blockPromise);
      };
      batch.execute();

      return Promise.all(blockPromises)
      .then(blockPromises.map(blockTransform) as any)
      .catch(error => error); 
  } catch (error) {
    console.error(error);
  }
    return undefined;
  }

  async getTransaction(params: StreamTransactionParams) {
    try {
      let { chain, network, txId } = params;
      if (typeof txId !== 'string' || !chain || !network) {
        throw new Error('Missing required param');
      }
      network = network.toLowerCase();
      const { web3 } = await this.getWeb3(network, { type: 'historical' });
      const tip = await this.getLocalTip(params);
      const tipHeight = tip ? tip.height : 0;
      const tx : any = await web3.eth.getTransaction(txId);
      if (tx) {
        let confirmations = 0;
        if (tx.blockNumber && tx.blockNumber >= 0) {
          confirmations = tipHeight - tx.blockNumber + 1;
        }
        tx.blockTime = await this.getBlockTimestamp(tx.blockHash, params);
        const receipt = await web3.eth.getTransactionReceipt(txId);
        if (receipt) {
          const fee = receipt.gasUsed * parseInt(tx.gasPrice);
          tx.receipt = receipt;
          tx.fee = fee;
        }
        const tansformedTx = this.transformTransactionData({ tx, network, chain });
        const convertedTx = EVMTransactionStorage._apiTransform(tansformedTx, { object: true }) as EVMTransactionJSON;
        return { ...convertedTx, confirmations };
      } else {
        return undefined;
      }
    } catch (err) {
      console.error(err);
    }
    return undefined;
  }

  async getWalletBalanceAtTime(_params: GetWalletBalanceAtTimeParams): Promise<{ confirmed: number; unconfirmed: number; balance: number }> {
    throw new Error('Method not implemented.');
  }

  async streamBlocks(_params: StreamBlocksParams) {
    throw new Error('Method not implemented.');
  }

  async streamAddressTransactions(_params: StreamAddressUtxosParams) {
    throw new Error('Method not implemented.');
  }

  async streamTransactions(_params: StreamTransactionsParams) {
    throw new Error('Method not implemented.');
  }

  async getBlockTimestamp(blockNumber, { network }) : Promise<Date> {
    const { web3 } = await this.getWeb3(network);
    const block = await web3.eth.getBlock(blockNumber);
    return new Date(Number(block.timestamp) * 1000);
  }

  protected async getBlocksParams(params: GetBlockParams | StreamBlocksParams) {
    const { chain, network, sinceBlock, blockId, args = {} } = params;
    let { startDate, endDate, date, since, direction, paging } = args;
    let { limit = 10, sort = { height: -1 } } = args;
    let options = { limit, sort, since, direction, paging };
    const query : ExternalGetBlockResults = {startBlock: 0, endBlock: 0};
    if (!chain || !network) {
      throw new Error('Missing required param');
    }
    if (blockId) {
      if (blockId.length >= 64) {
        query['block'] = blockId;
      } else {
        let height = parseInt(blockId, 10);
        if (Number.isNaN(height) || height.toString(10) !== blockId) {
          throw new Error('invalid block id provided');
        }
        query['height'] = height;
      }
    }
    if (sinceBlock) {
      let height = Number(sinceBlock);
      if (Number.isNaN(height) || height.toString(10) !== sinceBlock) {
        throw new Error('invalid block id provided');
      }
      query['height'] = height;
    }
    if (startDate) {
      query['startDateBlock'] = await this.getBlockNumberByDate({ date: startDate, network});
    }
    if (endDate) {
      query['endDateBlock'] = await this.getBlockNumberByDate({ date: endDate, network });
    }
    if (date) {
      let firstDate = new Date(date);
      let nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      query['startDateBlock'] = await this.getBlockNumberByDate({ date: firstDate, network });
      query['endDateBlock'] = await this.getBlockNumberByDate({ date: nextDate, network });
    }

    // Get range
    if (query?.block && query?.height) {
      const blockNum = await this.getBlockNumberByBlockId({blockId: query.block, network});
      if (!blockNum) {
        throw new Error(`Could not get block ${query.block}`);
      }
      query.startBlock = blockNum;
      query.endBlock = blockNum + query.height;
    }
    if (!query?.block && query?.height) {
      const blockNum = await this.getBlockNumberByBlockId({blockId: query.height, network});
      if (!blockNum) {
        throw new Error(`Could not get block ${query.block}`);
      }
      query.startBlock = blockNum;
    }
    if (query?.startDateBlock) {
      query.startBlock = query.startDateBlock;
    }
    if (query?.endDateBlock) {
      query.endBlock = query.endDateBlock;
    }

    // Calaculate range with options
    const tip = await this.getLocalTip(params);
    const tipHeight = tip ? tip.height : 0;
    let endBlock = query.endBlock || tipHeight;
    let startBlock = query.startBlock || endBlock - 1;
    
    if (limit && limit > 0 && (endBlock - startBlock) > limit) {
      endBlock = startBlock + limit;
    }
    if (sort === -1) {
      let b = startBlock;
      startBlock = endBlock;
      endBlock = b;
    }

    // { limit, sort, since, direction, paging };
    return { query, options };
  }

  async getBlockNumberByDate({ date, network }) {
    const res = await MoralisAPI.getBlockByDate({ chain: this.chain, network, date });
    const block = JSON.parse((res as any).body);
    return block.number ? Number((block as any).number) : undefined;
  }

  async getBlockNumberByBlockId({ blockId, network }) {
    const res = await MoralisAPI.getBlockByHash({ chain: this.chain, network, blockId });
    const block = JSON.parse((res as any).body);
    return block.number ? Number((block as any).number) : undefined;
  }

  transformBlockData({ chain, network, block }) {
    return {
      chain,
      network,
      height: block.number,
      hash: block.hash,
      time: new Date(block.timestamp),
      timeNormalized: new Date(block.timestamp),
      previousBlockHash: block.parentHash,
      nextBlockHash: '',
      transactionCount: block.transactions.length,
      size: block.size,
      reward: 5,
      processed: true,
      nonce: block.nonce, // hex string
      difficulty: block.difficulty,
      gasUsed: block.gasUsed, // BigNumber
      gasLimit: block.gasLimit, // BigNumber
      baseFeePerGas: block.baseFeePerGas // BigNumber
    } as IBlock; // IEVMBlock
  }

  transformTransactionData({ chain, network, tx }) {
    return {
      txid: tx.hash,
      chain,
      network,
      blockHeight: tx.blockNumber,
      blockHash: tx.blockHash,
      blockTime: tx.blockTime,
      blockTimeNormalized: tx.blockTimeNormalized,
      fee: tx.fee,
      value: tx.value,
      gasLimit: tx.gasLimit,
      gasPrice: tx.gasPrice,
      nonce: tx.nonce,
      to: tx.to,
      from: tx.from,
      data: tx.data,
      effects: tx.effects,
    }
  }
}