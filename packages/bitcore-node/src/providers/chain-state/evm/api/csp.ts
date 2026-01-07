import { CryptoRpc } from 'crypto-rpc';
import { Utils } from 'crypto-wallet-core';
import { ObjectID } from 'mongodb';
import Config from '../../../../config';
import {
  historical,
  internal,
  realtime
} from '../../../../decorators/decorators';
import logger from '../../../../logger';
import { MongoBound } from '../../../../models/base';
import { ITransaction } from '../../../../models/baseTransaction';
import { CacheStorage } from '../../../../models/cache';
import { WalletAddressStorage } from '../../../../models/walletAddress';
import { InternalStateProvider } from '../../../../providers/chain-state/internal/internal';
import { Storage } from '../../../../services/storage';
import { IBlock } from '../../../../types/Block';
import { ChainId } from '../../../../types/ChainNetwork';
import { SpentHeightIndicators } from '../../../../types/Coin';
import { IChainConfig, IEVMNetworkConfig, IProvider } from '../../../../types/Config';
import {
  BroadcastTransactionParams,
  GetBalanceForAddressParams,
  GetBlockParams,
  GetWalletBalanceAtTimeParams,
  GetWalletBalanceParams,
  IChainStateService,
  StreamAddressUtxosParams,
  StreamTransactionParams,
  StreamTransactionsParams,
  StreamWalletTransactionsArgs,
  StreamWalletTransactionsParams,
  UpdateWalletParams,
  WalletBalanceType
} from '../../../../types/namespaces/ChainStateProvider';
import { partition, range } from '../../../../utils';
import { StatsUtil } from '../../../../utils/stats';
import { TransformWithEventPipe } from '../../../../utils/streamWithEventPipe';
import {
  getProvider,
  isValidProviderType
} from '../../external/providers/provider';
import { ExternalApiStream } from '../../external/streams/apiStream';
import { ERC20Abi } from '../abi/erc20';
import { MultisendAbi } from '../abi/multisend';
import { EVMBlockStorage } from '../models/block';
import { EVMTransactionStorage } from '../models/transaction';
import { EVMTransactionJSON, IEVMBlock, IEVMTransaction, IEVMTransactionInProcess } from '../types';
import { Erc20RelatedFilterTransform } from './erc20Transform';
import { InternalTxRelatedFilterTransform } from './internalTxTransform';
import { PopulateEffectsTransform } from './populateEffectsTransform';
import { PopulateReceiptTransform } from './populateReceiptTransform';
import { EVMListTransactionsStream } from './transform';
import type { EthRpc } from 'crypto-rpc/lib/eth/EthRpc';
import type { Web3, Web3Types } from 'crypto-wallet-core';

export interface GetWeb3Response { rpc: EthRpc; web3: Web3; dataType: string; lastPingTime?: number };

export interface BuildWalletTxsStreamParams {
  transactionStream: TransformWithEventPipe;
  populateEffects: PopulateEffectsTransform;
  walletAddresses: string[];
}


export class BaseEVMStateProvider extends InternalStateProvider implements IChainStateService {
  config: IChainConfig<IEVMNetworkConfig>;
  static rpcs = {} as { [chain: string]: { [network: string]: GetWeb3Response[] } };

  constructor(public chain: string = 'ETH') {
    super(chain);
    this.config = Config.chains[this.chain] as IChainConfig<IEVMNetworkConfig>;
  }

  async getWeb3(network: string, params?: { type: IProvider['dataType'] }): Promise<GetWeb3Response> {
    for (const rpc of BaseEVMStateProvider.rpcs[this.chain]?.[network] || []) {
      if (!isValidProviderType(params?.type, rpc.dataType)) {
        continue;
      }

      try {
        if (Date.now() - (rpc.lastPingTime || 0) < 10000) { // Keep the rpc from being blasted with ping calls
          return rpc;
        }
        await Promise.race([
          rpc.web3.eth.getBlockNumber(),
          new Promise((_, reject) => setTimeout(reject, 5000))
        ]);
        rpc.lastPingTime = Date.now();
        return rpc; // return the first applicable rpc that's responsive
      } catch {
        // try reconnecting
        logger.info(`Reconnecting to ${this.chain}:${network}`);
        if (typeof (rpc.web3.currentProvider as any)?.disconnect === 'function') {
          (rpc.web3.currentProvider as any)?.disconnect?.();
          (rpc.web3.currentProvider as any)?.connect?.();
          if ((rpc.web3.currentProvider as any)?.connected) {
            return rpc;
          }
        }
        const idx = BaseEVMStateProvider.rpcs[this.chain][network].indexOf(rpc);
        BaseEVMStateProvider.rpcs[this.chain][network].splice(idx, 1);
      }
    }

    logger.info(`Making a new connection for ${this.chain}:${network}`);
    const dataType = params?.type;
    const providerConfig = getProvider({ network, dataType, config: this.config });
    // Default to using ETH CryptoRpc with all EVM chain configs
    const rpcConfig = { ...providerConfig, chain: 'ETH', currencyConfig: {} };
    const rpc = new CryptoRpc(rpcConfig as any).get('ETH') as EthRpc;
    const rpcObj = { rpc, web3: rpc.web3, dataType: rpcConfig.dataType || 'combined' };
    if (!BaseEVMStateProvider.rpcs[this.chain]) {
      BaseEVMStateProvider.rpcs[this.chain] = {};
    }
    if (!BaseEVMStateProvider.rpcs[this.chain][network]) {
      BaseEVMStateProvider.rpcs[this.chain][network] = [];
    }
    BaseEVMStateProvider.rpcs[this.chain][network].push(rpcObj);
    return rpcObj;
  }

  async erc20For(network: string, address: string) {
    const { web3 } = await this.getWeb3(network);
    const contract = new web3.eth.Contract(ERC20Abi, address);
    return contract;
  }

  async getMultisendContract(network: string, address: string) {
    const { web3 } = await this.getWeb3(network);
    const contract = new web3.eth.Contract(MultisendAbi, address);
    return contract;
  }

  async getERC20TokenInfo(network: string, tokenAddress: string) {
    const token = await this.erc20For(network, tokenAddress);
    const [name, decimals, symbol] = await Promise.all([
      token.methods.name().call(),
      token.methods.decimals().call(),
      token.methods.symbol().call()
    ]);

    return {
      name,
      decimals,
      symbol
    };
  }

  async getERC20TokenAllowance(network: string, tokenAddress: string, ownerAddress: string, spenderAddress: string) {
    const token = await this.erc20For(network, tokenAddress);
    return await token.methods.allowance(ownerAddress, spenderAddress).call();
  }

  @historical
  async getFee(params) {
    let { network } = params;
    const { target = 4, txType } = params;
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
        if (txType?.toString() === '2') {
          const { rpc } = await this.getWeb3(network, { type: 'historical' });
          feerate = await rpc.estimateFee({ nBlocks: target, txType });
        } else {
          const txs = await EVMTransactionStorage.collection
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
          const quartileMedian = StatsUtil.getNthQuartileMedian(blockGasPrices, whichQuartile);

          const roundedGwei = (quartileMedian / 1e9).toFixed(2);
          const gwei = Number(roundedGwei) || 0;
          feerate = gwei * 1e9;
        }
        return { feerate, blocks: target };
      },
      CacheStorage.Times.Minute
    );
  }

  async getPriorityFee(params) {
    let { network } = params;
    const { percentile } = params;
    const chain = this.chain;
    const priorityFeePercentile = percentile || 15;
    if (network === 'livenet') {
      network = 'mainnet';
    }
    const cacheKey = `getFee-${chain}-${network}-priorityFee-${priorityFeePercentile}`;

    return CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        const { rpc } = await this.getWeb3(network);
        const feerate = await rpc.estimateMaxPriorityFee({ percentile: priorityFeePercentile });
        return { feerate };
      },
      CacheStorage.Times.Minute
    );
  }

  async getWalletBalanceAtTime(params: GetWalletBalanceAtTimeParams): Promise<WalletBalanceType> {
    let { args } = params;
    const { network, wallet, time } = params;
    if (time) {
      if (args) {
        args.time = time;
      } else {
        args = { time };
      }
    }
    const hex = args.hex === 'true' || args.hex === '1';
    if (wallet._id === undefined) {
      throw new Error('Wallet balance can only be retrieved for wallets with the _id property');
    }
    let addresses = await this.getWalletAddresses(wallet._id);
    addresses = !args.address ? addresses : addresses.filter(({ address }) => address.toLowerCase() === args.address.toLowerCase());
    const addressBalances = await Promise.all<WalletBalanceType>(addresses.map(({ address }) =>
      this.getBalanceForAddress({ chain: this.chain, network, address, args })
    ));
    const balance = addressBalances.reduce(
      (prev, cur) => ({
        unconfirmed: BigInt(prev.unconfirmed) + BigInt(cur.unconfirmed),
        confirmed: BigInt(prev.confirmed) + BigInt(cur.confirmed),
        balance: BigInt(prev.balance) + BigInt(cur.balance)
      }),
      { unconfirmed: 0n, confirmed: 0n, balance: 0n }
    );
    return {
      unconfirmed: hex ? '0x' + balance.unconfirmed.toString(16) : Number(balance.unconfirmed),
      confirmed: hex ? '0x' + balance.confirmed.toString(16) : Number(balance.confirmed),
      balance: hex ? '0x' + balance.balance.toString(16) : Number(balance.balance)
    };
  }

  async getBalanceForAddress(params: GetBalanceForAddressParams): Promise<WalletBalanceType> {
    const { chain, network, address, args } = params;
    const { web3 } = await this.getWeb3(network, { type: args?.time ? 'historical' : 'realtime' });
    const tokenAddress = args?.tokenAddress;
    const addressLower = address.toLowerCase();
    const hex = args?.hex === 'true' || args?.hex === '1';
    let blockNumber: number | string = 'latest';
    if (args?.time) {
      const block = await this.getBlockBeforeTime({ chain, network, time: args.time });
      if (!block) {
        throw new Error(`Balance not found at ${args.time}`);
      }
      blockNumber = block.height;
    }
    const cacheKey = tokenAddress
      ? `getBalanceForAddress-${chain}-${network}-${addressLower}-${tokenAddress.toLowerCase()}`
      : `getBalanceForAddress-${chain}-${network}-${addressLower}`;
    const balance = await CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        if (tokenAddress) {
          const token = new web3.eth.Contract(ERC20Abi, tokenAddress);
          const balance = await token.methods.balanceOf(address).call<bigint>({}, blockNumber);
          const numberBalance = '0x' + BigInt(balance).toString(16);
          return { confirmed: numberBalance, unconfirmed: '0x0', balance: numberBalance };
        } else {
          const balance = await web3.eth.getBalance(address, blockNumber);
          const numberBalance = '0x' + BigInt(balance).toString(16);
          return { confirmed: numberBalance, unconfirmed: '0x0', balance: numberBalance };
        }
      },
      args?.time ? CacheStorage.Times.None : CacheStorage.Times.Minute
    );
    return {
      confirmed: hex ? balance.confirmed : Number(balance.confirmed),
      unconfirmed: hex ? balance.unconfirmed : Number(balance.unconfirmed),
      balance: hex ? balance.balance : Number(balance.balance)
    };
  }

  async getLocalTip({ chain, network }): Promise<IBlock> {
    return EVMBlockStorage.getLocalTip({ chain, network });
  }

  async getReceipt(network: string, txid: string) {
    const { web3 } = await this.getWeb3(network, { type: 'historical' });
    return web3.eth.getTransactionReceipt(txid);
  }

  async populateReceipt(tx: MongoBound<IEVMTransaction>) {
    if (!tx.receipt) {
      const receipt = await this.getReceipt(tx.network, tx.txid);
      if (receipt) {
        const fee = Number(receipt.gasUsed * BigInt(tx.gasPrice));
        // TEST if/how this db save works with bigint values in receipt
        await EVMTransactionStorage.collection.updateOne({ _id: tx._id }, { $set: { receipt, fee } });
        tx.receipt = receipt as any;
        tx.fee = fee;
      }
    }
    return tx;
  }

  populateEffects(tx: MongoBound<IEVMTransaction>) {
    if (!tx.effects || (tx.effects && tx.effects.length == 0)) {
      tx.effects = EVMTransactionStorage.getEffects(tx as IEVMTransactionInProcess);
    }
    return tx;
  }

  async getTransaction(params: StreamTransactionParams) {
    try {
      params.network = params.network.toLowerCase();
      const { chain, network, txId } = params;
      if (typeof txId !== 'string') {
        throw new Error('Missing required param: txId');
      }
      if (!chain) {
        throw new Error('Missing required param: chain');
      }
      if (!network) {
        throw new Error('Missing required param: network');
      }

      const tx = await this._getTransaction(params);
      let { found } = tx;
      const { tipHeight } = tx;
      
      if (found) {
        let confirmations = 0;
        if (found.blockHeight && found.blockHeight >= 0) {
          confirmations = tipHeight - found.blockHeight + 1;
        }
        found = await this.populateReceipt(found);
        // Add effects to old db entries
        found = this.populateEffects(found);
        const convertedTx = EVMTransactionStorage._apiTransform(found, { object: true }) as EVMTransactionJSON;
        return { ...convertedTx, confirmations };
      }
    } catch (err) {
      console.error(err);
    }
    return undefined;
  }

  async _getTransaction(params: StreamTransactionParams) {
    const { chain, network, txId } = params;
    const query = { chain, network, txid: txId };
    const tip = await this.getLocalTip(params);
    const tipHeight = tip ? tip.height : 0;
    const found = await EVMTransactionStorage.collection.findOne(query);
    return { tipHeight, found };
  }

  async broadcastTransaction(params: BroadcastTransactionParams) {
    const { network, rawTx } = params;
    const { web3 } = await this.getWeb3(network, { type: 'realtime' });
    const rawTxs = typeof rawTx === 'string' ? [rawTx] : rawTx;
    const txids = new Array<string>();
    for (const tx of rawTxs) {
      const txid = await new Promise<string>((resolve, reject) => {
        web3.eth
          .sendSignedTransaction(tx)
          .on('transactionHash', resolve)
          .on('error', reject)
          .catch(e => {
            logger.error('%o', e);
            reject(e);
          });
      });
      txids.push(txid);
    }
    return txids.length === 1 ? txids[0] : txids;
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
    const { req, res, args, chain, network, address } = params;
    const { limit, /* since,*/ tokenAddress } = args;

    if (!args.tokenAddress) {
      const query = {
        $or: [
          { chain, network, from: address },
          { chain, network, to: address },
          { chain, network, 'internal.action.to': address }, // Retained for old db entries
          { chain, network, 'effects.to': address }
        ]
      };

      // NOTE: commented out since and paging for now b/c they were causing extra long query times on insight.
      // The case where an address has >1000 txns is an edge case ATM and can be addressed later
      Storage.apiStreamingFind(EVMTransactionStorage, query, { limit /* since, paging: '_id'*/ }, req!, res!);
    } else {
      try {
        const tokenTransfers = await this.getErc20Transfers(network, address, tokenAddress, args);
        res!.json(tokenTransfers);
      } catch (err: any) {
        logger.error('Error streaming address transactions: %o', err.stack || err.message || err);
        throw err;
      }
    }
  }


  @historical
  @internal
  async streamTransactions(params: StreamTransactionsParams) {
    const { chain, network, req, res, args } = params;
    const { blockHash, blockHeight } = args;
    if (!chain || !network) {
      throw new Error('Missing chain or network');
    }
    const query: any = {
      chain,
      network: network.toLowerCase()
    };
    if (blockHeight !== undefined) {
      query.blockHeight = Number(blockHeight);
    }
    if (blockHash !== undefined) {
      query.blockHash = blockHash;
    }
    const tip = await this.getLocalTip(params);
    const tipHeight = tip ? tip.height : 0;
    return Storage.apiStreamingFind(EVMTransactionStorage, query, args, req, res, t => {
      let confirmations = 0;
      if (t.blockHeight !== undefined && t.blockHeight >= 0) {
        confirmations = tipHeight - t.blockHeight + 1;
      }
      // Add effects to old db entries
      if (!t.effects || (t.effects && t.effects.length == 0)) {
        t.effects = EVMTransactionStorage.getEffects(t as IEVMTransactionInProcess);
      }
      const convertedTx = EVMTransactionStorage._apiTransform(t, { object: true }) as Partial<ITransaction>;
      return JSON.stringify({ ...convertedTx, confirmations });
    });
  }

  @realtime
  async getWalletBalance(params: GetWalletBalanceParams): Promise<WalletBalanceType> {
    const { network, args, wallet } = params;
    const hex = args.hex === 'true' || args.hex === '1';
    if (wallet._id === undefined) {
      throw new Error('Wallet balance can only be retrieved for wallets with the _id property');
    }
    let addresses = await this.getWalletAddresses(wallet._id);
    addresses = !args.address ? addresses : addresses.filter(({ address }) => address.toLowerCase() === args.address.toLowerCase());
    const addressBalances = await Promise.all<WalletBalanceType>(addresses.map(({ address }) =>
      this.getBalanceForAddress({ chain: this.chain, network, address, args })
    ));
    const balance = addressBalances.reduce(
      (prev, cur) => ({
        unconfirmed: BigInt(prev.unconfirmed) + BigInt(cur.unconfirmed),
        confirmed: BigInt(prev.confirmed) + BigInt(cur.confirmed),
        balance: BigInt(prev.balance) + BigInt(cur.balance)
      }),
      { unconfirmed: 0n, confirmed: 0n, balance: 0n }
    );
    return {
      unconfirmed: hex ? '0x' + balance.unconfirmed.toString(16) : Number(balance.unconfirmed),
      confirmed: hex ? '0x' + balance.confirmed.toString(16) : Number(balance.confirmed),
      balance: hex ? '0x' + balance.balance.toString(16) : Number(balance.balance)
    };
  }

  getWalletTransactionQuery(params: StreamWalletTransactionsParams) {
    const { chain, network, wallet, args } = params;
    const query = {
      chain,
      network,
      wallets: wallet._id,
      'wallets.0': { $exists: true },
      blockHeight: { $gt: -3 } // Exclude invalid transactions
    } as any;
    if (args) {
      if (args.startBlock || args.endBlock) {
        query.$or = [];
        if (args.includeMempool) {
          query.$or.push({ blockHeight: SpentHeightIndicators.pending });
        }
        const blockRangeQuery = {} as any;
        if (args.startBlock) {
          blockRangeQuery.$gte = Number(args.startBlock);
        }
        if (args.endBlock) {
          blockRangeQuery.$lte = Number(args.endBlock);
        }
        query.$or.push({ blockHeight: blockRangeQuery });
      } else {
        if (args.startDate) {
          const startDate = new Date(args.startDate);
          if (startDate.getTime()) {
            query.blockTimeNormalized = { $gte: new Date(args.startDate) };
          }
        }
        if (args.endDate) {
          const endDate = new Date(args.endDate);
          if (endDate.getTime()) {
            query.blockTimeNormalized = query.blockTimeNormalized || {};
            query.blockTimeNormalized.$lt = new Date(args.endDate);
          }
        }
      }
      if (args.includeInvalidTxs) {
        delete query.blockHeight;
      }
    }
    return query;
  }

  async streamWalletTransactions(params: StreamWalletTransactionsParams) {
    return new Promise<void>(async (resolve, reject) => {
      const { network, wallet, req, res, args } = params;
      const { web3 } = await this.getWeb3(network);
      args.tokenAddress = args.tokenAddress ? web3.utils.toChecksumAddress(args.tokenAddress) : undefined;

      let transactionStream = new TransformWithEventPipe({ objectMode: true, passThrough: true });
      const walletAddresses = (await this.getWalletAddresses(wallet._id!)).map(waddres => waddres.address);
      if (walletAddresses.length === 0) {
        res.status(400).send('No addresses found for wallet');
        return resolve();
      }
      const ethTransactionTransform = new EVMListTransactionsStream(walletAddresses, args.tokenAddress);
      const populateReceipt = new PopulateReceiptTransform();
      const populateEffects = new PopulateEffectsTransform();

      const streamParams: BuildWalletTxsStreamParams = {
        transactionStream,
        populateEffects,
        walletAddresses
      };
      transactionStream = await this._buildWalletTransactionsStream(params, streamParams);

      if (!args.tokenAddress && wallet._id) {
        const internalTxTransform = new InternalTxRelatedFilterTransform(web3, wallet._id);
        transactionStream = transactionStream.eventPipe(internalTxTransform);
      }

      transactionStream = transactionStream
        .eventPipe(populateReceipt)
        .eventPipe(ethTransactionTransform);

      try {
        const result = await ExternalApiStream.onStream(transactionStream, req!, res!, { jsonl: true });
        if (!result?.success) {
          logger.error('Error mid-stream (streamWalletTransactions): %o', result.error?.log || result.error);
        }  
        return resolve();
      } catch (err) {
        return reject(err);
      }
    });
  }

  async _buildWalletTransactionsStream(params: StreamWalletTransactionsParams, streamParams: BuildWalletTxsStreamParams) {
    const query = this.getWalletTransactionQuery(params);
    let { transactionStream } = streamParams;
    const { populateEffects } = streamParams;

    transactionStream = EVMTransactionStorage.collection
      .find(query)
      .sort({ blockTimeNormalized: 1 })
      .addCursorFlag('noCursorTimeout', true)
      .pipe(new TransformWithEventPipe({ objectMode: true, passThrough: true }));

    transactionStream = transactionStream.eventPipe(populateEffects); // For old db entires

    if (params.args.tokenAddress) {
      const erc20Transform = new Erc20RelatedFilterTransform(params.args.tokenAddress);
      transactionStream = transactionStream.eventPipe(erc20Transform);
    }
    return transactionStream;
  }

  async getErc20Transfers(
    network: string,
    address: string,
    tokenAddress: string,
    args: Partial<StreamWalletTransactionsArgs> = {}
  ): Promise<Array<Partial<Web3Types.Transaction>>> {
    const token = await this.erc20For(network, tokenAddress);
    let windowSize = 100n;
    const { web3 } = await this.getWeb3(network);
    const tip = await web3.eth.getBlockNumber();
    
    if (isNaN(args.startBlock!) || isNaN(args.endBlock!)) {
      throw new Error('startBlock and endBlock must be numbers');
    }

    let endBlock = args.endBlock == null ? null : BigInt(args.endBlock);
    let startBlock = args.startBlock == null ? null : BigInt(args.startBlock);

    // If endBlock or startBlock is negative, it is a block offset from the tip
    if (endBlock! < 0n) {
      endBlock = tip + endBlock!;
    }
    if (startBlock! < 0n) {
      startBlock = tip + startBlock!;
    }

    endBlock = Utils.BI.min<bigint>([endBlock ?? tip, tip]) as bigint;
    startBlock = Utils.BI.max<bigint>([startBlock != null ? startBlock : endBlock - 10000n, 0n]) as bigint;
    
    if (endBlock < startBlock!) {
      throw new Error('startBlock cannot be greater than endBlock');
    } else if (endBlock - startBlock > 10000n) {
      throw new Error('Cannot scan more than 10000 blocks at a time. Please limit your search with startBlock and endBlock');
    }

    windowSize = Utils.BI.min<bigint>([windowSize, endBlock - startBlock]);
    const tokenTransfers: Partial<Web3Types.Transaction>[] = [];
    while (windowSize > 0n) {
      const [sent, received] = await Promise.all([
        token.getPastEvents('Transfer', {
          filter: { _from: address },
          fromBlock: endBlock - windowSize,
          toBlock: endBlock
        }) as Promise<Array<Web3Types.EventLog>>,
        token.getPastEvents('Transfer', {
          filter: { _to: address },
          fromBlock: endBlock - windowSize,
          toBlock: endBlock
        }) as Promise<Array<Web3Types.EventLog>>
      ]);
      tokenTransfers.push(...this.convertTokenTransfers([...sent, ...received]));
      endBlock -= windowSize + 1n;
      windowSize = Utils.BI.min<bigint>([windowSize, endBlock - startBlock]);
    }
    return tokenTransfers;
  }

  convertTokenTransfers(tokenTransfers: Array<Web3Types.EventLog>) {
    return tokenTransfers.map(this.convertTokenTransfer);
  }

  convertTokenTransfer(transfer: Web3Types.EventLog) {
    const { blockHash, blockNumber, transactionHash, returnValues, transactionIndex } = transfer;
    return {
      blockHash,
      blockNumber,
      transactionHash,
      transactionIndex,
      hash: transactionHash,
      from: returnValues['_from'],
      to: returnValues['_to'],
      value: returnValues['_value']
    } as Partial<Web3Types.Transaction>;
  }

  @realtime
  async getAccountNonce(network: string, address: string) {
    const { web3 } = await this.getWeb3(network, { type: 'realtime' });
    const count = await web3.eth.getTransactionCount(address);
    return count;
    /*
     *return EthTransactionStorage.collection.countDocuments({
     *  chain: 'ETH',
     *  network,
     *  from: address,
     *  blockHeight: { $gt: -1 }
     *});
     */
  }

  async getWalletTokenTransactions(
    network: string,
    walletId: ObjectID,
    tokenAddress: string,
    args: StreamWalletTransactionsArgs
  ) {
    const addresses = await this.getWalletAddresses(walletId);
    const allTokenQueries = Array<Promise<Array<Partial<Web3Types.TransactionInfo>>>>();
    for (const walletAddress of addresses) {
      const transfers = this.getErc20Transfers(network, walletAddress.address, tokenAddress, args);
      allTokenQueries.push(transfers);
    }
    const batches = await Promise.all(allTokenQueries);
    const txs = batches.reduce((agg, batch) => agg.concat(batch));
    // TODO fix this.
    return txs.sort((tx1, tx2) => Number(BigInt(tx1.blockNumber!) - BigInt(tx2.blockNumber!)));
  }

  @realtime
  async estimateGas(params): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        let { value } = params;
        const { network, from, data, /* gasPrice */ to } = params;
        const { web3 } = await this.getWeb3(network, { type: 'realtime' });
        const dataDecoded = EVMTransactionStorage.abiDecode(data);

        if (dataDecoded && dataDecoded.type === 'INVOICE' && dataDecoded.name === 'pay') {
          value = dataDecoded.params[0].value;
          // gasPrice = dataDecoded.params[1].value;
        } else if (data && data.type === 'MULTISEND') {
          try {
            let method, gasLimit;
            const contract = await this.getMultisendContract(network, to);
            const addresses = web3.eth.abi.decodeParameter('address[]', data.addresses);
            const amounts = web3.eth.abi.decodeParameter('uint256[]', data.amounts);

            switch (data.method) {
              case 'sendErc20':
                method = contract.methods.sendErc20(data.tokenAddress, addresses, amounts);
                gasLimit = method ? await method.estimateGas({ from }) : undefined;
                break;
              case 'sendEth':
                method = contract.methods.sendEth(addresses, amounts);
                gasLimit = method ? await method.estimateGas({ from, value }) : undefined;
                break;
              default:
                break;
            }
            return resolve(Number(gasLimit));
          } catch (err) {
            return reject(err);
          }
        }

        let _value;
        if (data) {
          // Gas estimation might fail with `insufficient funds` if value is higher than balance for a normal send.
          // We want this method to give a blind fee estimation, though, so we should not include the value
          // unless it's needed for estimating smart contract execution.
          _value = Utils.toHex(value);
        }

        const opts = {
          method: 'eth_estimateGas',
          params: [
            {
              data,
              to: to && to.toLowerCase(),
              from: from && from.toLowerCase(),
              // gasPrice: Utils.toHex(gasPrice), // Setting this lower than the baseFee of the last block will cause an error. Better to just leave it out.
              value: _value
            }
          ],
          jsonrpc: '2.0',
          id: 'bitcore-' + Date.now()
        };

        const provider = web3.currentProvider as any;
        provider.send(opts, (err, data) => {
          if (err) return reject(err);
          if (!data.result) return reject(data.error || data);
          return resolve(Number(data.result));
        });
      } catch (err) {
        return reject(err);
      }
    });
  }


  async getBlocks(params: GetBlockParams) {
    const { tipHeight, blocks } = await this._getBlocks(params);
    const blockTransform = (b: IEVMBlock) => {
      let confirmations = 0;
      if (b.height && b.height >= 0) {
        confirmations = tipHeight - b.height + 1;
      }
      const convertedBlock = EVMBlockStorage._apiTransform(b, { object: true }) as IEVMBlock;
      return { ...convertedBlock, confirmations };
    };
    return blocks.map(blockTransform);
  }

  async _getBlocks(params: GetBlockParams) {
    const { query, options } = this.getBlocksQuery(params);
    let cursor = EVMBlockStorage.collection.find(query, options).addCursorFlag('noCursorTimeout', true);
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }
    const blocks = await cursor.toArray();
    const tip = await this.getLocalTip(params);
    const tipHeight = tip ? tip.height : 0;
    return { tipHeight, blocks };
  }

  async updateWallet(params: UpdateWalletParams) {
    const { chain, network } = params;
    const addressBatches = partition(params.addresses, 500);
    for (const addressBatch of addressBatches) {
      const walletAddressInserts = addressBatch.map(address => {
        return {
          insertOne: {
            document: { chain, network, wallet: params.wallet._id, address, processed: false }
          }
        };
      });

      try {
        await WalletAddressStorage.collection.bulkWrite(walletAddressInserts);
      } catch (err: any) {
        if (err.code !== 11000) {
          throw err;
        }
      }

      const addressBatchLC = addressBatch.map(address => address.toLowerCase());

      await EVMTransactionStorage.collection.updateMany(
        {
          $or: [
            { chain, network, from: { $in: addressBatch } },
            { chain, network, to: { $in: addressBatch } },
            { chain, network, 'internal.action.to': { $in: addressBatchLC } }, // Support old db entries
            { chain, network, 'calls.to': { $in: addressBatchLC } }, // Support old db entries
            { // Support old db entries
              chain,
              network,
              'calls.abiType.type': 'ERC20',
              'calls.abiType.name': { $in: ['transfer', 'transferFrom'] },
              'calls.abiType.params.type': 'address',
              'calls.abiType.params.value': { $in: addressBatchLC }
            },
            { chain, network, 'effects.to': { $in: addressBatch } },
            { chain, network, 'effects.from': { $in: addressBatch } },
          ]
        },
        { $addToSet: { wallets: params.wallet._id } }
      );

      await WalletAddressStorage.collection.updateMany(
        { chain, network, address: { $in: addressBatch }, wallet: params.wallet._id },
        { $set: { processed: true } }
      );
    }
  }

  protected async getBlocksRange(params: GetBlockParams & ChainId) {
    const { chain, network, chainId, sinceBlock, args = {} } = params;
    let { blockId } = params;
    let { startDate, endDate, limit = 10 } = args;
    const { date, sort = { height: -1 } } = args;
    const query: { startBlock?: number; endBlock?: number } = {};
    if (!chain || !network) {
      throw new Error('Missing required chain and/or network param');
    }

    // limit - 1 because startBlock is inclusive; ensure limit is >= 0
    limit = Math.max(limit - 1, 0);

    let height: number | null = null;
    if (blockId && blockId.length < 64) {
      height = parseInt(blockId, 10);
      if (isNaN(height) || height.toString(10) != blockId) {
        throw new Error('invalid block id provided');
      }
      blockId = undefined;
    }
  
    if (date) {
      startDate = new Date(date);
      endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
    }
    if (startDate || endDate) {
      if (startDate) {
        query.startBlock = await this._getBlockNumberByDate({ date: startDate, chainId }) || 0;
      }
      if (endDate) {
        query.endBlock = await this._getBlockNumberByDate({ date: endDate, chainId }) || 0;
      }
    }

    // Get range
    if (sinceBlock) {
      const height = Number(sinceBlock);
      if (isNaN(height) || height.toString(10) != sinceBlock) {
        throw new Error('invalid block id provided');
      }
      const { web3 } = await this.getWeb3(network);
      const tipHeight = Number(await web3.eth.getBlockNumber());
      if (tipHeight < height) {
        return [];
      }
      query.endBlock = query.endBlock ?? tipHeight;
      query.startBlock = query.startBlock ?? query.endBlock - limit;
    } else if (blockId) {
      const { web3 } = await this.getWeb3(network);
      const blk = await web3.eth.getBlock(blockId);
      if (!blk || blk.number == null) {
        throw new Error(`Could not get block ${blockId}`);
      }
      height = Number(blk.number);
    }

    if (height != null) {
      query.startBlock = height;
      query.endBlock = height + limit;
    }

    if (query.startBlock == null || query.endBlock == null) {
      // Calaculate range with options
      const { web3 } = await this.getWeb3(network);
      const tipHeight = Number(await web3.eth.getBlockNumber());
      query.endBlock = query.endBlock ?? tipHeight;
      query.startBlock = query.startBlock ?? query.endBlock - limit;
    }

    if (query.endBlock - query.startBlock > limit) {
      query.endBlock = query.startBlock + limit;
    }

    const r = range(query.startBlock, query.endBlock + 1); // +1 since range is [start, end)

    if (sort?.height === -1 && query.startBlock < query.endBlock) {
      return r.reverse();
    }
    return r;
  }

  async _getBlockNumberByDate(params: {
    date: Date;
    network?: string;
    chainId?: string | bigint;
  }) {
    const { date, network } = params;
    const block = await EVMBlockStorage.collection.findOne({ chain: this.chain, network, timeNormalized: { $gte: date } }, { sort: { timeNormalized: 1 } });
    return block?.height;
  }

  async getChainId({ network }) {
    const { web3 } = await this.getWeb3(network);
    return web3.eth.getChainId();
  }

  async getCoinsForTx() {
    return {
      inputs: [],
      outputs: []
    };
  }
}
