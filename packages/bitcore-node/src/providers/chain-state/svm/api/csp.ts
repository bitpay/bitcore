import Web3 from '@solana/web3.js';
import { CryptoRpc } from 'crypto-rpc';
import Config from '../../../../config';
import logger from '../../../../logger';
import { CacheStorage } from '../../../../models/cache';
import { IChainConfig, IProvider, ISVMNetworkConfig } from '../../../../types/Config';
import { IChainStateService, StreamAddressUtxosParams } from '../../../../types/namespaces/ChainStateProvider';
import { StatsUtil } from '../../../../utils/stats';
import { EVMTransactionStorage } from '../../evm/models/transaction';
import ExternalProviders from '../../external/providers';
import {
  getProvider,
  isValidProviderType
} from '../../external/providers/provider';
// import { EVMTransactionStorage } from '../../evm/models/transaction';
import { NodeQueryStream } from '../../external/streams/nodeStream';
import { InternalStateProvider } from '../../internal/internal';

export interface GetSolWeb3Response { rpc: CryptoRpc; connection: Web3.Connection; web3: any; dataType: string };

export interface SolTx {
  address: string;
  date: Date;
  signatures: string[];
  recentBlockhash: string;
  addressTableLookups?: Web3.ParsedAddressTableLookup[] | null;
  instructions: (Web3.ParsedInstruction | Web3.PartiallyDecodedInstruction)[];
  accountKeys: Web3.ParsedMessageAccount[];
}
export class BaseSVMStateProvider extends InternalStateProvider implements IChainStateService { 
  config: IChainConfig<ISVMNetworkConfig>;
  static rpcs = {} as { [chain: string]: { [network: string]: GetSolWeb3Response[] } };

  constructor(public chain: string = 'SOL') {
    super(chain);
    this.config = Config.chains[this.chain] as IChainConfig<ISVMNetworkConfig>;
  }
  // async getConnection(network: string, params?: { type: IProvider['dataType'] }): Promise<Web3.Connection> {
  //   const rpc = await this._getRPC(network, params);
  //   return rpc?.connection;
  // }

  // async getWeb3(network: string, params?: { type: IProvider['dataType'] }): Promise<Web3.Connection> {
  //   const rpc = await this._getRPC(network, params);
  //   return rpc?.web3;
  // }

  async _getRPC(network: string, params?: { type: IProvider['dataType'] }): Promise<GetSolWeb3Response> {
    for (const rpc of BaseSVMStateProvider.rpcs[this.chain]?.[network] || []) {
      if (!isValidProviderType(params?.type, rpc.dataType)) {
        continue;
      }

      try {
        await Promise.race([
          rpc.connection.getSlot({ commitment: 'confirmed' }),
          new Promise((_, reject) => setTimeout(reject, 5000))
        ]);
        return rpc; // return the first applicable rpc that's responsive
      } catch (e) {
        const idx = BaseSVMStateProvider.rpcs[this.chain][network].indexOf(rpc);
        BaseSVMStateProvider.rpcs[this.chain][network].splice(idx, 1);
      }
    }

    logger.info(`Making a new connection for ${this.chain}:${network}`);
    const dataType = params?.type;
    const providerConfig = getProvider({ network, dataType, config: this.config });
    const rpcConfig = { ...providerConfig, chain: 'SOL', currencyConfig: {} };
    const rpc = new CryptoRpc(rpcConfig, {}).get('SOL');
    const rpcObj = { rpc, connection: rpc.connection, dataType: rpcConfig.dataType || 'combined', web3: rpc.web3 };
    if (!BaseSVMStateProvider.rpcs[this.chain]) {
      BaseSVMStateProvider.rpcs[this.chain] = {};
    }
    if (!BaseSVMStateProvider.rpcs[this.chain][network]) {
      BaseSVMStateProvider.rpcs[this.chain][network] = [];
    }
    BaseSVMStateProvider.rpcs[this.chain][network].push(rpcObj);
    return rpcObj;
  }

  async getFee(params) {
    let { network, target = 4, txType, rawTx } = params;
    const chain = this.chain;
    if (network === 'livenet') {
      network = 'mainnet';
    }
    let cacheKey = `getFee-${chain}-${network}-${target}`;
    if (txType) {
      cacheKey += `-type${txType}`;
    }

    return CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        let feerate;
        if (txType?.toString() === '2' || this.isExternallyProvided({ network })) {
          const { rpc } = await this._getRPC(network, { type: 'historical' });
          feerate = await rpc.estimateFee({ nBlocks: target, txType, rawTx});
        } else {
          const txs = await EVMTransactionStorage.collection // SVMTransactionStorage.collection
            .find({ chain, network, blockHeight: { $gt: 0 } })
            .project({ gasPrice: 1, blockHeight: 1 })
            .sort({ blockHeight: -1 })
            .limit(20 * 200)
            .toArray();

          const blockGasPrices = txs
            .map(tx => Number(tx.gasPrice))
            .filter(gasPrice => gasPrice)
            .sort((a, b) => b - a);

          const whichQuartile = Math.min(target, 4) || 1;
          const quartileMedian = Number(StatsUtil.getNthQuartileMedian(blockGasPrices, whichQuartile));

          const roundedGwei = (quartileMedian / 1e9).toFixed(2);
          const gwei = Number(roundedGwei) || 0;
          feerate = gwei * 1e9;
        }
        return { feerate, blocks: target };
      },
      CacheStorage.Times.Minute
    );
  }

  async streamAddressTransactions(params: StreamAddressUtxosParams) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        await this._buildAddressTransactionsStream(params);
        return resolve();
      } catch (err) {
        return reject(err);
      }
    });
  }

  async _buildAddressTransactionsStream(params: StreamAddressUtxosParams) { 
    const { req, res, args, network, address } = params;
    const { limit } = args;    
    const resultStream: any [] = [];
    const handler = (data) => data;

    try {
      const { connection, web3 } = await this._getRPC(network);
      const pubKey =  new web3.PublicKey(address);
      const txList = await connection.getSignaturesForAddress(pubKey, {limit});
      const sigList = txList.map(tx => tx.signature); 
      const parsedTxs = await connection.getParsedTransactions(sigList, {maxSupportedTransactionVersion: 3});
      for (let i = 0; i < txList.length; i++) {
        const date = new Date((txList[i]?.blockTime || 0) * 1000);
        const instructions = parsedTxs[i]!.transaction?.message?.instructions;
        resultStream.push({
          ...txList[i],
          date,
          instructions
        })
      }
    } catch (err: any) {
      logger.error('Error streaming address transactions: %o', err.stack || err.message || err);
      throw err;
    }

    const stream = new NodeQueryStream(resultStream, handler, {}); 
    const result = await NodeQueryStream.onStream(stream, req!, res!);
    if (!result?.success) {
      logger.error('Error mid-stream (streamAddressTransactions): %o', result.error?.log || result.error);
    }
  } 

  isExternallyProvided({ network }) {
    return !!ExternalProviders[this.config[network]?.chainSource || 'p2p'];
  }

  getExternalProvider({ network }) {
    return ExternalProviders[this.config[network]?.chainSource || 'p2p'];
  }

}