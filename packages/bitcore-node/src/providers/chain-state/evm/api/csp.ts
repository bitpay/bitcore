import { CryptoRpc } from 'crypto-rpc';
import { ObjectID } from 'mongodb';
import Web3 from 'web3';
import { Transaction } from 'web3-eth';
import { AbiItem } from 'web3-utils';
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
  GetWalletBalanceParams,
  IChainStateService,
  StreamAddressUtxosParams,
  StreamBlocksParams,
  StreamTransactionParams,
  StreamTransactionsParams,
  StreamWalletTransactionsArgs,
  StreamWalletTransactionsParams,
  UpdateWalletParams
} from '../../../../types/namespaces/ChainStateProvider';
import { partition, range } from '../../../../utils';
import { StatsUtil } from '../../../../utils/stats';
import { ReadableWithEventPipe, TransformWithEventPipe } from '../../../../utils/streamWithEventPipe';
import ExternalProviders from '../../external/providers';
import { ExternalApiStream } from '../../external/streams/apiStream';
import { ERC20Abi } from '../abi/erc20';
import { MultisendAbi } from '../abi/multisend';
import { EVMBlockStorage } from '../models/block';
import { EVMTransactionStorage } from '../models/transaction';
import { ERC20Transfer, EVMTransactionJSON, IEVMBlock, IEVMTransaction, IEVMTransactionInProcess } from '../types';
import { Erc20RelatedFilterTransform } from './erc20Transform';
import { InternalTxRelatedFilterTransform } from './internalTxTransform';
import { PopulateEffectsTransform } from './populateEffectsTransform';
import { PopulateReceiptTransform } from './populateReceiptTransform';
import {
  getProvider,
  isValidProviderType
} from './provider';
import { EVMListTransactionsStream } from './transform';

export interface GetWeb3Response { rpc: CryptoRpc; web3: Web3; dataType: string };

export class BaseEVMStateProvider extends InternalStateProvider implements IChainStateService {
  config: IChainConfig<IEVMNetworkConfig>;
  static rpcs = {} as { [chain: string]: { [network: string]: GetWeb3Response[] } };
  // ecsp: BaseEVMExternalStateProvider;

  constructor(public chain: string = 'ETH') {
    super(chain);
    this.config = Config.chains[this.chain] as IChainConfig<IEVMNetworkConfig>;
    // this.ecsp = new BaseEVMExternalStateProvider(chain);
  }

  async getWeb3(network: string, params?: { type: IProvider['dataType'] }): Promise<GetWeb3Response> {
    for (const rpc of BaseEVMStateProvider.rpcs[this.chain]?.[network] || []) {
      if (!isValidProviderType(params?.type, rpc.dataType)) {
        continue;
      }

      try {
        await Promise.race([
          rpc.web3.eth.getBlockNumber(),
          new Promise((_, reject) => setTimeout(reject, 5000))
        ]);
        return rpc; // return the first applicable rpc that's responsive
      } catch (e) {
        // try reconnecting
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
    const rpc = new CryptoRpc(rpcConfig, {}).get('ETH');
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
    const contract = new web3.eth.Contract(ERC20Abi as AbiItem[], address);
    return contract;
  }

  async getMultisendContract(network: string, address: string) {
    const { web3 } = await this.getWeb3(network);
    const contract = new web3.eth.Contract(MultisendAbi as AbiItem[], address);
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
    let { network, target = 4, txType } = params;
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
    let { network, percentile } = params;
    const chain = this.chain;
    const priorityFeePercentile = percentile || 15;
    if (network === 'livenet') {
      network = 'mainnet';
    }
    let cacheKey = `getFee-${chain}-${network}-priorityFee-${priorityFeePercentile}`;

    return CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        const { rpc } = await this.getWeb3(network);
        let feerate = await rpc.estimateMaxPriorityFee({ percentile: priorityFeePercentile });
        return { feerate };
      },
      CacheStorage.Times.Minute
    );
  }

  async getBalanceForAddress(params: GetBalanceForAddressParams) {
    const { chain, network, address } = params;
    const { web3 } = await this.getWeb3(network, { type: 'realtime' });
    const tokenAddress = params.args && params.args.tokenAddress;
    const addressLower = address.toLowerCase();
    const cacheKey = tokenAddress
      ? `getBalanceForAddress-${chain}-${network}-${addressLower}-${tokenAddress.toLowerCase()}`
      : `getBalanceForAddress-${chain}-${network}-${addressLower}`;
    const balances = await CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        if (tokenAddress) {
          const token = await this.erc20For(network, tokenAddress);
          const balance = await token.methods.balanceOf(address).call();
          const numberBalance = Number(balance);
          return { confirmed: numberBalance, unconfirmed: 0, balance: numberBalance };
        } else {
          const balance = await web3.eth.getBalance(address);
          const numberBalance = Number(balance);
          return { confirmed: numberBalance, unconfirmed: 0, balance: numberBalance };
        }
      },
      CacheStorage.Times.Minute
    );
    return balances;
  }

  async getLocalTip({ chain, network }): Promise<IBlock> {
    if (this.isExternallyProvided({ network })) {
      const { web3 } = await this.getWeb3(network);
      const block = await web3.eth.getBlock('latest');
      return EVMBlockStorage.convertRawBlock(chain, network, block);
    }
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
        const fee = receipt.gasUsed * tx.gasPrice;
        await EVMTransactionStorage.collection.updateOne({ _id: tx._id }, { $set: { receipt, fee } });
        tx.receipt = receipt;
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
      let { chain, network, txId } = params;
      if (typeof txId !== 'string') {
        throw new Error('Missing required param: txId');
      }
      if (!chain) {
        throw new Error('Missing required param: chain');
      }
      if (!network) {
        throw new Error('Missing required param: network');
      }
      network = network.toLowerCase();
      let tipHeight = 0;
      let found: MongoBound<IEVMTransaction> | null | undefined;

      if (this.isExternallyProvided({ network })) {
        const { web3 } = await this.getWeb3(network, { type: 'historical' });
        tipHeight = await web3.eth.getBlockNumber();
        const chainId = await this.getChainId({ network });
        found = await this.getExternalProvider({ network }).getTransaction({ chain, network, chainId, txId });
      } else {
        let query = { chain, network, txid: txId };
        const tip = await this.getLocalTip(params);
        tipHeight = tip ? tip.height : tipHeight;
        found = await EVMTransactionStorage.collection.findOne(query);
      }
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
        const { req, res, args, chain, network, address } = params;
        const { limit, /*since,*/ tokenAddress } = args;

        if (this.isExternallyProvided({ network })) {
          const chainId = await this.getChainId({ network });
          const provider = this.getExternalProvider({ network });
          const txStream = await provider.streamAddressTransactions({
            chainId,
            chain: this.chain,
            network,
            address,
            args: {
              limit: 10, // default limit
              ...args
            }
          });
          // TODO unify `ExternalApiStream.onStream` and `Storage.apiStream` which are effectively doing the same thing
          const result = await ExternalApiStream.onStream(txStream, req!, res!);
          if (!result?.success) {
            logger.error('Error mid-stream (streamAddressTransactions): %o', result.error?.log || result.error);
          }
        } else if (!args.tokenAddress) {
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
          Storage.apiStreamingFind(EVMTransactionStorage, query, { limit /*since, paging: '_id'*/ }, req!, res!);
        } else {
          try {
            const tokenTransfers = await this.getErc20Transfers(network, address, tokenAddress, args);
            res!.json(tokenTransfers);
          } catch (err: any) {
            logger.error('Error streaming address transactions: %o', err.stack || err.message || err);
            return reject(err);
          }
        }
        return resolve();
      } catch (err) {
        return reject(err);
      }
    });
  }

  @historical
  @internal
  async streamTransactions(params: StreamTransactionsParams) {
    const { chain, network, req, res, args } = params;
    let { blockHash, blockHeight } = args;
    if (!chain || !network) {
      throw new Error('Missing chain or network');
    }
    let query: any = {
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
  async getWalletBalance(params: GetWalletBalanceParams) {
    const { network } = params;
    if (params.wallet._id === undefined) {
      throw new Error('Wallet balance can only be retrieved for wallets with the _id property');
    }
    let addresses = await this.getWalletAddresses(params.wallet._id);
    let addressBalancePromises = addresses.map(({ address }) =>
      this.getBalanceForAddress({ chain: this.chain, network, address, args: params.args })
    );
    let addressBalances = await Promise.all<{ confirmed: number; unconfirmed: number; balance: number }>(
      addressBalancePromises
    );
    let balance = addressBalances.reduce(
      (prev, cur) => ({
        unconfirmed: prev.unconfirmed + Number(cur.unconfirmed),
        confirmed: prev.confirmed + Number(cur.confirmed),
        balance: prev.balance + Number(cur.balance)
      }),
      { unconfirmed: 0, confirmed: 0, balance: 0 }
    );
    return balance;
  }

  getWalletTransactionQuery(params: StreamWalletTransactionsParams) {
    const { chain, network, wallet, args } = params;
    let query = {
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
        let blockRangeQuery = {} as any;
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

      let transactionStream = new TransformWithEventPipe({ objectMode: true, passThrough: true });
      const walletAddresses = (await this.getWalletAddresses(wallet._id!)).map(waddres => waddres.address);
      const ethTransactionTransform = new EVMListTransactionsStream(walletAddresses);
      const populateReceipt = new PopulateReceiptTransform();
      const populateEffects = new PopulateEffectsTransform();

      if (this.isExternallyProvided({ network })) {
        const chainId = await this.getChainId({ network });
        const provider = this.getExternalProvider({ network });
        for (const address of walletAddresses) {
          const txStream = await provider.streamAddressTransactions({
            chainId,
            chain: this.chain,
            network,
            address,
            args: {
              limit: 10, // default limit
              order: 'ASC',
              ...args
            }
          });
          transactionStream = txStream.eventPipe(transactionStream);
        }
      } else {
        const query = this.getWalletTransactionQuery(params);

        transactionStream = EVMTransactionStorage.collection
          .find(query)
          .sort({ blockTimeNormalized: 1 })
          .addCursorFlag('noCursorTimeout', true)
          .pipe(new TransformWithEventPipe({ objectMode: true, passThrough: true }));

        transactionStream = transactionStream.eventPipe(populateEffects); // For old db entires
      }
      if (!args.tokenAddress && wallet._id) {
        const internalTxTransform = new InternalTxRelatedFilterTransform(web3, wallet._id);
        transactionStream = transactionStream.eventPipe(internalTxTransform);
      }

      if (args.tokenAddress) {
        const erc20Transform = new Erc20RelatedFilterTransform(args.tokenAddress);
        transactionStream = transactionStream.eventPipe(erc20Transform);
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

  async getErc20Transfers(
    network: string,
    address: string,
    tokenAddress: string,
    args: Partial<StreamWalletTransactionsArgs> = {}
  ): Promise<Array<Partial<Transaction>>> {
    const token = await this.erc20For(network, tokenAddress);
    const [sent, received] = await Promise.all([
      token.getPastEvents('Transfer', {
        filter: { _from: address },
        fromBlock: args.startBlock || 0,
        toBlock: args.endBlock || 'latest'
      }),
      token.getPastEvents('Transfer', {
        filter: { _to: address },
        fromBlock: args.startBlock || 0,
        toBlock: args.endBlock || 'latest'
      })
    ]);
    return this.convertTokenTransfers([...sent, ...received]);
  }

  convertTokenTransfers(tokenTransfers: Array<ERC20Transfer>) {
    return tokenTransfers.map(this.convertTokenTransfer);
  }

  convertTokenTransfer(transfer: ERC20Transfer) {
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
    } as Partial<Transaction>;
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
    const allTokenQueries = Array<Promise<Array<Partial<Transaction>>>>();
    for (const walletAddress of addresses) {
      const transfers = this.getErc20Transfers(network, walletAddress.address, tokenAddress, args);
      allTokenQueries.push(transfers);
    }
    let batches = await Promise.all(allTokenQueries);
    let txs = batches.reduce((agg, batch) => agg.concat(batch));
    return txs.sort((tx1, tx2) => tx1.blockNumber! - tx2.blockNumber!);
  }

  @realtime
  async estimateGas(params): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        let { network, value, from, data, /*gasPrice,*/ to } = params;
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
          _value = web3.utils.toHex(value)
        }

        const opts = {
          method: 'eth_estimateGas',
          params: [
            {
              data,
              to: to && to.toLowerCase(),
              from: from && from.toLowerCase(),
              // gasPrice: web3.utils.toHex(gasPrice), // Setting this lower than the baseFee of the last block will cause an error. Better to just leave it out.
              value: _value
            }
          ],
          jsonrpc: '2.0',
          id: 'bitcore-' + Date.now()
        };

        let provider = web3.currentProvider as any;
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

  isExternallyProvided({ network }) {
    return !!ExternalProviders[this.config[network]?.chainSource || 'p2p'];
  }

  getExternalProvider({ network }) {
    return ExternalProviders[this.config[network]?.chainSource || 'p2p'];
  }

  async getBlocks(params: GetBlockParams) {
    const { chain, network } = params;
    let blocks: MongoBound<IEVMBlock>[] = [];
    let tipHeight = 0;

    if (this.isExternallyProvided({ network })) {
      const { web3 } = await this.getWeb3(network);
      tipHeight = await web3.eth.getBlockNumber();
      const chainId = await this.getChainId({ network });
      const blockRange = await this.getBlocksRange({ ...params, chainId });

      for (const blockNum of blockRange) {
        const block = await web3.eth.getBlock(blockNum);
        const nextBlock = await web3.eth.getBlock(block.number + 1);
        const convertedBlock = EVMBlockStorage.convertRawBlock(chain, network, block);
        convertedBlock.nextBlockHash = nextBlock?.hash;
        blocks.push(convertedBlock);
      }
    } else {
      const { query, options } = this.getBlocksQuery(params);
      let cursor = EVMBlockStorage.collection.find(query, options).addCursorFlag('noCursorTimeout', true);
      if (options.sort) {
        cursor = cursor.sort(options.sort);
      }
      blocks = await cursor.toArray();
      const tip = await this.getLocalTip(params);
      tipHeight = tip ? tip.height : tipHeight;
    }
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

  async updateWallet(params: UpdateWalletParams) {
    const { chain, network } = params;
    const addressBatches = partition(params.addresses, 500);
    for (let addressBatch of addressBatches) {
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

  private async getBlocksRange(params: GetBlockParams & ChainId) {
    const { chain, network, chainId, sinceBlock, args = {} } = params;
    let { blockId } = params;
    let { startDate, endDate, date, limit = 10, sort = { height: -1 } } = args;
    const query: { startBlock?: number; endBlock?: number } = {};
    if (!chain || !network) {
      throw new Error('Missing required chain and/or network param');
    }

    let height: number | null = null;
    if (blockId && blockId.length < 64) {
      height = parseInt(blockId, 10);
      if (isNaN(height) || height.toString(10) !== blockId) {
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
      const provider = this.getExternalProvider({ network });
      if (startDate) {
        query.startBlock = await provider.getBlockNumberByDate({ date: startDate, chainId }) || 0;
      }
      if (endDate) {
        query.endBlock = await provider.getBlockNumberByDate({ date: endDate, chainId }) || 0;
      }
    }

    // Get range
    if (sinceBlock) {
      let height = Number(sinceBlock);
      if (isNaN(height) || height.toString(10) !== sinceBlock) {
        throw new Error('invalid block id provided');
      }
      const { web3 } = await this.getWeb3(network);
      const tipHeight = await web3.eth.getBlockNumber();
      if (tipHeight > height) {
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
      height = blk.number;
    }

    if (height != null) {
      query.startBlock = height;
      query.endBlock = height + limit;
    }

    if (query.startBlock == null || query.endBlock == null) {
      // Calaculate range with options
      const { web3 } = await this.getWeb3(network);
      const tipHeight = await web3.eth.getBlockNumber();
      query.endBlock = query.endBlock ?? tipHeight;
      query.startBlock = query.startBlock ?? query.endBlock - limit;
    }

    if (limit > 0 && (query.endBlock - query.startBlock) > limit) {
      query.endBlock = query.startBlock + limit;
    }

    if (sort?.height === -1) {
      let b = query.startBlock;
      query.startBlock = query.endBlock;
      query.endBlock = b;
    }

    return range(query.startBlock, query.endBlock + 1);
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

  async streamBlocks(params: StreamBlocksParams) {
    const { chain, network, req, res } = params;

    if (!this.isExternallyProvided({ network })) {
      return super.streamBlocks(params);
    }

    const { web3 } = await this.getWeb3(network);
    const tipHeight = await web3.eth.getBlockNumber();
    const chainId = await this.getChainId({ network });
    const blockRange = await this.getBlocksRange({ ...params, chainId });
    let isReading = false;
  
    const stream = new ReadableWithEventPipe({
      objectMode: true,
      async read() {
        if (isReading) {
          return;
        }
        isReading = true;

        let block;
        let nextBlock;
        try {
          for (const blockNum of blockRange) {
            // stage next block in new var so `nextBlock` doesn't get overwritten if needed for `block`
            const thisNextBlock = parseInt(block?.number) === blockNum + 1 ? block : await web3.eth.getBlock(blockNum + 1);
            block = parseInt(nextBlock?.number) === blockNum ? nextBlock : await web3.eth.getBlock(blockNum);
            if (!block) {
              continue;
            }
            nextBlock = thisNextBlock;
            const convertedBlock = EVMBlockStorage.convertRawBlock(chain, network, block);
            convertedBlock.nextBlockHash = nextBlock?.hash;
            convertedBlock.confirmations = tipHeight - block.number + 1;
            this.push(convertedBlock);
          }
        } catch (e) {
          logger.error('Error streaming blocks: %o', e);
        }
        this.push(null);
      }
    });

    return ExternalApiStream.onStream(stream, req!, res!);
  }
}
