import { CoinModel } from '../models/coin';
import { BlockModel } from '../models/block';
import { WalletModel, IWallet } from '../models/wallet';
import { WalletAddressModel } from '../models/walletAddress';
import { CSP } from '../types/namespaces/ChainStateProvider';
import { Storage } from '../services/storage';
import { RPC } from '../rpc';
import { LoggifyClass } from '../decorators/Loggify';
import config from '../config';

import { TransactionModel } from '../models/transaction';
import { StateModel } from '../models/state';

const ListTransactionsStream = require('./transforms');

@LoggifyClass
export class InternalStateProvider implements CSP.IChainStateService {
  getRPC(chain: string, network: string) {
    const RPC_PEER = config.chains[chain][network].rpc;
    if (!RPC_PEER) {
      throw new Error(`RPC not configured for ${chain} ${network}`);
    }
    const { username, password, host, port } = RPC_PEER;
    return new RPC(username, password, host, port);
  }

  private getAddressQuery(params: CSP.StreamAddressUtxosParams) {
    const { chain, network, address, args } = params;
    if (typeof address !== 'string' || !chain || !network) {
      throw 'Missing required param';
    }
    const query = { chain: chain, network: network.toLowerCase(), address } as any;
    if (args.unspent) {
      query.spentHeight = { $lt: 0 };
    }
    return query;
  }

  streamAddressUtxos(params: CSP.StreamAddressUtxosParams) {
    const { limit = 10, stream } = params;
    const query = this.getAddressQuery(params);
    Storage.apiStreamingFind(CoinModel, query, { limit }, stream);
  }

  async streamAddressTransactions(params: CSP.StreamAddressUtxosParams) {
    const { limit = 10, stream } = params;
    const query = this.getAddressQuery(params);
    const coins = await CoinModel.collection.find(query, { limit }).toArray();
    const txids = coins.map(coin => coin.mintTxid);
    const txQuery = { txid: { $in: txids } };
    Storage.apiStreamingFind(TransactionModel, txQuery, {}, stream);
  }

  async getBalanceForAddress(params: CSP.GetBalanceForAddressParams) {
    const { chain, network, address } = params;
    let query = { chain: chain, network, address };
    let balance = await CoinModel.getBalance({ query });
    return balance;
  }

  async getBalanceForWallet(params: CSP.GetBalanceForWalletParams) {
    const { walletId } = params;
    let query = { wallets: walletId };
    return CoinModel.getBalance({ query });
  }

  streamBlocks(params: CSP.StreamBlocksParams) {
    const { stream } = params;
    const { query, options } = this.getBlocksQuery(params);
    Storage.apiStreamingFind(BlockModel, query, options, stream);
  }

  async getBlocks(params: CSP.GetBlockParams) {
    const { query, options } = this.getBlocksQuery(params);
    let blocks = await BlockModel.collection.find(query, options).toArray();
    return blocks.map(block => BlockModel._apiTransform(block, { object: true }));
  }

  private getBlocksQuery(params: CSP.GetBlockParams | CSP.StreamBlocksParams) {
    const { chain, network, sinceBlock, blockId, args = {} } = params;
    let { startDate, endDate, date, since, direction, paging } = args;
    let { limit = 10, sort = { height: -1 } } = args;
    let options = { limit, sort, since, direction, paging };
    if (!chain || !network) {
      throw 'Missing required param';
    }
    let query: any = {
      chain: chain,
      network: network.toLowerCase(),
      processed: true
    };
    if (blockId) {
      if (blockId.length === 64) {
        query.hash = blockId;
      } else {
        let height = parseInt(blockId, 10);
        if (Number.isNaN(height) || height.toString(10) !== blockId) {
          throw 'invalid block id provided';
        }
        query.height = height;
      }
    }
    if (sinceBlock) {
      let height = Number(sinceBlock);
      if (Number.isNaN(height) || height.toString(10) !== sinceBlock) {
        throw 'invalid block id provided';
      }
      query.height = { $gt: height };
    }
    if (startDate) {
      query.time = { $gt: new Date(startDate) };
    }
    if (endDate) {
      Object.assign(query.time, { ...query.time, $lt: new Date(endDate) });
    }
    if (date) {
      let firstDate = new Date(date);
      let nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      query.time = { $gt: firstDate, $lt: nextDate };
    }
    return { query, options };
  }

  async getBlock(params: CSP.GetBlockParams) {
    let blocks = await this.getBlocks(params);
    return blocks[0];
  }

  streamTransactions(params: CSP.StreamTransactionsParams) {
    const { chain, network, stream, args } = params;
    let { limit = 100, blockHash, blockHeight } = args;
    if (!chain || !network) {
      throw 'Missing chain or network';
    }
    let query: any = {
      chain: chain,
      network: network.toLowerCase()
    };
    if (blockHeight) {
      query.blockHeight = Number(blockHeight);
    }
    if (blockHash) {
      query.blockHash = blockHash;
    }
    Storage.apiStreamingFind(TransactionModel, query, { limit }, stream);
  }

  streamTransaction(params: CSP.StreamTransactionParams) {
    let { chain, network, txId, stream } = params;
    if (typeof txId !== 'string' || !chain || !network || !stream) {
      throw 'Missing required param';
    }
    network = network.toLowerCase();
    let query = { chain: chain, network, txid: txId };
    Storage.apiStreamingFind(TransactionModel, query, { limit: 100 }, stream);
  }

  async createWallet(params: CSP.CreateWalletParams) {
    const { chain, network, name, pubKey, path, singleAddress } = params;
    if (typeof name !== 'string' || !network) {
      throw 'Missing required param';
    }
    const state = await StateModel.collection.findOne({});
    const initialSyncComplete =
      state && state.initialSyncComplete && state.initialSyncComplete.includes(`${chain}:${network}`);
    if (!initialSyncComplete) {
      throw 'Wallet creation not permitted before intitial sync is complete';
    }
    const wallet: IWallet = {
      chain: chain,
      network,
      name,
      pubKey,
      path,
      singleAddress
    };
    await WalletModel.collection.insert(wallet);
    return wallet;
  }

  async getWallet(params: CSP.GetWalletParams) {
    const { pubKey } = params;
    return WalletModel.collection.findOne({ pubKey });
  }

  streamWalletAddresses(params: CSP.StreamWalletAddressesParams) {
    let { walletId, limit = 1000, stream } = params;
    let query = { wallet: walletId };
    Storage.apiStreamingFind(WalletAddressModel, query, { limit }, stream);
  }

  async updateWallet(params: CSP.UpdateWalletParams) {
    const { wallet, addresses } = params;
    return WalletAddressModel.updateCoins({ wallet, addresses });
  }

  async streamWalletTransactions(params: CSP.StreamWalletTransactionsParams) {
    let { chain, network, wallet, stream, args } = params;
    let query: any = {
      chain: chain,
      network,
      wallets: wallet._id
    };
    if (args) {
      if (args.startBlock) {
        query.blockHeight = { $gte: Number(args.startBlock) };
      }
      if (args.endBlock) {
        query.blockHeight = query.blockHeight || {};
        query.blockHeight.$lte = Number(args.endBlock);
      }
      if (args.startDate) {
        query.blockTimeNormalized = { $gte: new Date(args.startDate) };
      }
      if (args.endDate) {
        query.blockTimeNormalized = query.blockTimeNormalized || {};
        query.blockTimeNormalized.$lt = new Date(args.endDate);
      }
    }
    let transactionStream = TransactionModel.getTransactions({ query });
    let listTransactionsStream = new ListTransactionsStream(wallet);
    transactionStream.pipe(listTransactionsStream).pipe(stream);
  }

  async getWalletBalance(params: CSP.GetWalletBalanceParams) {
    let query = { wallets: params.wallet._id };
    return CoinModel.getBalance({ query });
  }

  streamWalletUtxos(params: CSP.StreamWalletUtxosParams) {
    const { wallet, limit, args = {}, stream } = params;
    let query: any = { wallets: wallet._id };
    if (args.includeSpent !== 'true') {
      query.spentHeight = { $lt: -1 };
    }
    Storage.apiStreamingFind(CoinModel, query, { limit }, stream);
  }

  async getFee(params: CSP.GetEstimateSmartFeeParams) {
    const { chain, network, target } = params;
    return this.getRPC(chain, network).getEstimateSmartFee(Number(target));
  }

  async broadcastTransaction(params: CSP.BroadcastTransactionParams) {
    const { chain, network, rawTx } = params;
    return new Promise((resolve, reject) => {
      this.getRPC(chain, network).sendTransaction(rawTx, (err: any, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  async getCoinsForTx({ chain, network, txid }: { chain: string; network: string; txid: string }) {
    const tx = await TransactionModel.collection.find({ txid }).count();
    if (tx === 0) {
      throw new Error(`No such transaction ${txid}`);
    }

    let inputs = await CoinModel.collection
      .find({
        chain,
        network,
        spentTxid: txid
      })
      .toArray();

    const outputs = await CoinModel.collection
      .find({
        chain,
        network,
        mintTxid: txid
      })
      .toArray();

    return {
      inputs: inputs.map(input => CoinModel._apiTransform(input, { object: true })),
      outputs: outputs.map(output => CoinModel._apiTransform(output, { object: true }))
    };
  }

  async getLocalTip({ chain, network }) {
    return BlockModel.collection.findOne({ chain, network, processed: true }, { sort: { height: -1 } });
  }

  async getLocatorHashes(params) {
    const { chain, network } = params;
    const locatorBlocks = await BlockModel.collection
      .find(
        {
          processed: true,
          chain,
          network
        },
        { sort: { height: -1 }, limit: 30 }
      )
      .toArray();
    if (locatorBlocks.length < 2) {
      return [Array(65).join('0')];
    }
    return locatorBlocks.map(block => block.hash);
  }
}

export const InternalState = new InternalStateProvider();
