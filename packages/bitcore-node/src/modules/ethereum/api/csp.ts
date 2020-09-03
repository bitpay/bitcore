import { CryptoRpc } from 'crypto-rpc';
import * as _ from 'lodash';
import { ObjectID } from 'mongodb';
import { Readable } from 'stream';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Transaction } from 'web3/eth/types';
import Config from '../../../config';
import logger from '../../../logger';
import { MongoBound } from '../../../models/base';
import { ITransaction } from '../../../models/baseTransaction';
import { CacheStorage } from '../../../models/cache';
import { WalletAddressStorage } from '../../../models/walletAddress';
import { InternalStateProvider } from '../../../providers/chain-state/internal/internal';
import { Storage } from '../../../services/storage';
import { SpentHeightIndicators } from '../../../types/Coin';
import {
  BroadcastTransactionParams,
  GetBalanceForAddressParams,
  GetBlockParams,
  GetWalletBalanceParams,
  IChainStateService,
  StreamAddressUtxosParams,
  StreamTransactionParams,
  StreamTransactionsParams,
  StreamWalletTransactionsArgs,
  StreamWalletTransactionsParams,
  UpdateWalletParams
} from '../../../types/namespaces/ChainStateProvider';
import { partition } from '../../../utils/partition';
import { StatsUtil } from '../../../utils/stats';
import { ERC20Abi } from '../abi/erc20';
import { EthBlockStorage } from '../models/block';
import { EthTransactionStorage } from '../models/transaction';
import { EthTransactionJSON, IEthBlock, IEthTransaction } from '../types';
import { Erc20RelatedFilterTransform } from './erc20Transform';
import { InternalTxRelatedFilterTransform } from './internalTxTransform';
import { PopulateReceiptTransform } from './populateReceiptTransform';
import { EthListTransactionsStream } from './transform';
export interface EventLog<T> {
  event: string;
  address: string;
  returnValues: T;
  logIndex: number;
  transactionIndex: number;
  transactionHash: string;
  blockHash: string;
  blockNumber: number;
  raw?: { data: string; topics: any[] };
}
interface ERC20Transfer
  extends EventLog<{
    [key: string]: string;
  }> {}

export class ETHStateProvider extends InternalStateProvider implements IChainStateService {
  config: any;
  static rpcs = {} as { [network: string]: { rpc: CryptoRpc; web3: Web3 } };

  constructor(public chain: string = 'ETH') {
    super(chain);
    this.config = Config.chains[this.chain];
  }

  async getWeb3(network: string): Promise<{ rpc: CryptoRpc; web3: Web3 }> {
    try {
      if (ETHStateProvider.rpcs[network]) {
        await ETHStateProvider.rpcs[network].web3.eth.getBlockNumber();
      }
    } catch (e) {
      delete ETHStateProvider.rpcs[network];
    }
    if (!ETHStateProvider.rpcs[network]) {
      console.log('making a new connection');
      const rpcConfig = { ...this.config[network].provider, chain: this.chain, currencyConfig: {} };
      const rpc = new CryptoRpc(rpcConfig, {}).get(this.chain);
      ETHStateProvider.rpcs[network] = { rpc, web3: rpc.web3 };
    }
    return ETHStateProvider.rpcs[network];
  }

  async erc20For(network: string, address: string) {
    const { web3 } = await this.getWeb3(network);
    const contract = new web3.eth.Contract(ERC20Abi as AbiItem[], address);
    return contract;
  }

  async getERC20TokenInfo(network: string, tokenAddress: string) {
    const token = await ETH.erc20For(network, tokenAddress);
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

  async getFee(params) {
    let { network, target = 4 } = params;
    const chain = this.chain;
    if (network === 'livenet') {
      network = 'mainnet';
    }

    const cacheKey = `getFee-${chain}-${network}-${target}`;
    return CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        const txs = await EthTransactionStorage.collection
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
        const feerate = gwei * 1e9;
        return { feerate, blocks: target };
      },
      CacheStorage.Times.Minute
    );
  }

  async getBalanceForAddress(params: GetBalanceForAddressParams) {
    const { chain, network, address } = params;
    const { web3 } = await this.getWeb3(network);
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
      CacheStorage.Times.Hour / 2
    );
    return balances;
  }

  async getLocalTip({ chain, network }) {
    return EthBlockStorage.getLocalTip({ chain, network });
  }

  async getReceipt(network: string, txid: string) {
    const { web3 } = await this.getWeb3(network);
    return web3.eth.getTransactionReceipt(txid);
  }

  async populateReceipt(tx: MongoBound<IEthTransaction>) {
    if (!tx.receipt) {
      const receipt = await this.getReceipt(tx.network, tx.txid);
      if (receipt) {
        const fee = receipt.gasUsed * tx.gasPrice;
        await EthTransactionStorage.collection.updateOne({ _id: tx._id }, { $set: { receipt, fee } });
        tx.receipt = receipt;
        tx.fee = fee;
      }
    }
    return tx;
  }

  async getTransaction(params: StreamTransactionParams) {
    try {
      let { chain, network, txId } = params;
      if (typeof txId !== 'string' || !chain || !network) {
        throw new Error('Missing required param');
      }
      network = network.toLowerCase();
      let query = { chain, network, txid: txId };
      const tip = await this.getLocalTip(params);
      const tipHeight = tip ? tip.height : 0;
      let found = await EthTransactionStorage.collection.findOne(query);
      if (found) {
        let confirmations = 0;
        if (found.blockHeight && found.blockHeight >= 0) {
          confirmations = tipHeight - found.blockHeight + 1;
        }
        found = await this.populateReceipt(found);
        const convertedTx = EthTransactionStorage._apiTransform(found, { object: true }) as EthTransactionJSON;
        return { ...convertedTx, confirmations };
      } else {
        return undefined;
      }
    } catch (err) {
      console.error(err);
    }
    return undefined;
  }

  async broadcastTransaction(params: BroadcastTransactionParams) {
    const { network, rawTx } = params;
    const { web3 } = await this.getWeb3(network);
    const rawTxs = typeof rawTx === 'string' ? [rawTx] : rawTx;
    const txids = new Array<string>();
    for (const tx of rawTxs) {
      const txid = await new Promise<string>((resolve, reject) => {
        web3.eth
          .sendSignedTransaction(tx)
          .on('transactionHash', resolve)
          .on('error', reject)
          .catch(e => {
            logger.error(e);
            reject(e);
          });
      });
      txids.push(txid);
    }
    return txids.length === 1 ? txids[0] : txids;
  }

  async streamAddressTransactions(params: StreamAddressUtxosParams) {
    const { req, res, args, chain, network, address } = params;
    const { limit, since, tokenAddress } = args;
    if (!args.tokenAddress) {
      const query = { chain, network, $or: [{ from: address }, { to: address }] };
      Storage.apiStreamingFind(EthTransactionStorage, query, { limit, since, paging: '_id' }, req!, res!);
    } else {
      try {
        const tokenTransfers = await this.getErc20Transfers(network, address, tokenAddress);
        res!.json(tokenTransfers);
      } catch (e) {
        res!.status(500).send(e);
      }
    }
  }

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
    return Storage.apiStreamingFind(EthTransactionStorage, query, args, req, res, t => {
      let confirmations = 0;
      if (t.blockHeight !== undefined && t.blockHeight >= 0) {
        confirmations = tipHeight - t.blockHeight + 1;
      }
      const convertedTx = EthTransactionStorage._apiTransform(t, { object: true }) as Partial<ITransaction>;
      return JSON.stringify({ ...convertedTx, confirmations });
    });
  }

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
      'wallets.0': { $exists: true }
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
    }
    return query;
  }

  async streamWalletTransactions(params: StreamWalletTransactionsParams) {
    const { network, wallet, res, args } = params;
    const { web3 } = await this.getWeb3(network);
    const query = ETH.getWalletTransactionQuery(params);

    let transactionStream = new Readable({ objectMode: true });
    const walletAddresses = (await this.getWalletAddresses(wallet._id!)).map(waddres => waddres.address);
    const ethTransactionTransform = new EthListTransactionsStream(walletAddresses);
    const populateReceipt = new PopulateReceiptTransform();

    transactionStream = EthTransactionStorage.collection
      .find(query)
      .sort({ blockTimeNormalized: 1 })
      .addCursorFlag('noCursorTimeout', true);

    if (!args.tokenAddress && wallet._id) {
      const internalTxTransform = new InternalTxRelatedFilterTransform(web3, wallet._id);
      transactionStream = transactionStream.pipe(internalTxTransform);
    }

    if (args.tokenAddress) {
      const erc20Transform = new Erc20RelatedFilterTransform(web3, args.tokenAddress);
      transactionStream = transactionStream.pipe(erc20Transform);
    }

    transactionStream
      .pipe(populateReceipt)
      .pipe(ethTransactionTransform)
      .pipe(res);
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

  async getAccountNonce(network: string, address: string) {
    const { web3 } = await this.getWeb3(network);
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

  async estimateGas(params): Promise<number> {
    const { network, from, to, value, data, gasPrice } = params;
    const { web3 } = await this.getWeb3(network);
    const gasLimit = await web3.eth.estimateGas({ from, to, value, data, gasPrice });
    return gasLimit;
  }

  async getBlocks(params: GetBlockParams) {
    const { query, options } = this.getBlocksQuery(params);
    let cursor = EthBlockStorage.collection.find(query, options).addCursorFlag('noCursorTimeout', true);
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }
    let blocks = await cursor.toArray();
    const tip = await this.getLocalTip(params);
    const tipHeight = tip ? tip.height : 0;
    const blockTransform = (b: IEthBlock) => {
      let confirmations = 0;
      if (b.height && b.height >= 0) {
        confirmations = tipHeight - b.height + 1;
      }
      const convertedBlock = EthBlockStorage._apiTransform(b, { object: true }) as IEthBlock;
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
      } catch (err) {
        if (err.code !== 11000) {
          throw err;
        }
      }

      await EthTransactionStorage.collection.updateMany(
        {
          $or: [
            { chain, network, from: { $in: addressBatch } },
            { chain, network, to: { $in: addressBatch } },
            { chain, network, 'internal.action.to': { $in: addressBatch } },
            { chain, network, 'abiType.params.0.value': { $in: addressBatch.map(address => address.toLowerCase()) } }
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

  async getCoinsForTx() {
    return {
      inputs: [],
      outputs: []
    };
  }
}

export const ETH = new ETHStateProvider();
