import { CoinModel } from '../../../models/coin';
import { BlockModel } from '../../../models/block';
import { WalletModel, IWallet } from '../../../models/wallet';
import { WalletAddressModel } from '../../../models/walletAddress';
import { CSP } from '../../../types/namespaces/ChainStateProvider';
import { Storage } from '../../../services/storage';
import { RPC } from '../../../rpc';
import { LoggifyClass } from '../../../decorators/Loggify';
import config from '../../../config';

import { TransactionModel } from '../../../models/transaction';

const ListTransactionsStream = require('./transforms');

@LoggifyClass
export class InternalStateProvider implements CSP.IChainStateService {
  chain: string;

  constructor(chain: string) {
    this.chain = chain;
    this.chain = this.chain.toUpperCase();
  }

  getRPC(network: string) {
    const RPC_PEER = config.chains[this.chain][network].rpc;
    if (!RPC_PEER) {
      throw new Error(`RPC not configured for ${this.chain} ${network}`);
    }
    const { username, password, host, port } = RPC_PEER;
    return new RPC(username, password, host, port);
  }

  private getAddressQuery(params: CSP.StreamAddressUtxosParams) {
    const {network, address, args} = params;
    if (typeof address !== 'string' || !this.chain || !network) {
      throw 'Missing required param';
    }
    const query = { chain: this.chain, network: network.toLowerCase(), address } as any;
    if(args.unspent) {
      query.spentHeight = {$lt: 0};
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
    const coins = await CoinModel.collection.find(query, {limit}).toArray();
    const txids = coins.map((coin) => coin.mintTxid);
    const txQuery = {txid: {$in: txids}};
    Storage.apiStreamingFind(TransactionModel, txQuery, {}, stream);
  }

  async getBalanceForAddress(params: CSP.GetBalanceForAddressParams) {
    const { network, address } = params;
    let query = { chain: this.chain, network, address };
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

  async getBlocks(params: CSP.StreamBlocksParams) {
    const { query, options } = this.getBlocksQuery(params);
    let blocks = await BlockModel.collection.find(query, options).toArray();
    return blocks.map(block => BlockModel._apiTransform(block, { object: true }));
  }

  private getBlocksQuery(params: CSP.StreamBlocksParams) {
    const { network, sinceBlock, blockId, args = {} } = params;
    let { startDate, endDate, date, since, direction, paging } = args;
    let { limit = 10, sort = { height: -1 } } = args;
    let options = { limit, sort, since, direction, paging };
    if (!this.chain || !network) {
      throw 'Missing required param';
    }
    let query: any = {
      chain: this.chain,
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

  async getBlock(params: CSP.StreamBlocksParams) {
    let blocks = await this.getBlocks(params);
    return blocks[0];
  }

  streamTransactions(params: CSP.StreamTransactionsParams) {
    const { network, stream, args } = params;
    let { limit = 100, blockHash, blockHeight } = args;
    if (!this.chain || !network) {
      throw 'Missing chain or network';
    }
    let query: any = {
      chain: this.chain,
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
    let { network, txId, stream } = params;
    if (typeof txId !== 'string' || !this.chain || !network || !stream) {
      throw 'Missing required param';
    }
    network = network.toLowerCase();
    let query = { chain: this.chain, network, txid: txId };
    Storage.apiStreamingFind(TransactionModel, query, { limit: 100 }, stream);
  }

  async createWallet(params: CSP.CreateWalletParams) {
    const { network, name, pubKey, path, singleAddress } = params;
    if (typeof name !== 'string' || !network) {
      throw 'Missing required param';
    }
    const wallet: IWallet = {
      chain: this.chain,
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
    let { network, wallet, stream, args } = params;
    let query: any = {
      chain: this.chain,
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
    transactionStream
      .pipe(listTransactionsStream)
      .pipe(stream);
  }

  async getWalletBalance(params: { wallet: IWallet }) {
    let query = { wallets: params.wallet._id };
    return CoinModel.getBalance({ query });
  }

  streamWalletUtxos(params: CSP.StreamWalletUtxosParams) {
    const { wallet, limit, args = {}, stream } = params;
    let query: any = { wallets: wallet._id };
    if (args.includeSpent !== 'true') {
      query.spentHeight = { $lt: 0 };
    }
    Storage.apiStreamingFind(CoinModel, query, { limit }, stream);
  }

  async getFee(params: CSP.GetEstimateSmartFeeParams) {
    const { network, target } = params;
    return this.getRPC(network).getEstimateSmartFee(Number(target));
  }

  async broadcastTransaction(params: CSP.BroadcastTransactionParams) {
    let { network, rawTx } = params;
    return new Promise((resolve, reject) => {
      this.getRPC(network).sendTransaction(rawTx, (err: any, result: any) => {
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
}
