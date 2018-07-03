import { Response } from 'express';
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

const JSONStream = require('JSONStream');
const ListTransactionsStream = require('./transforms');

type StreamWalletUtxoArgs = { includeSpent: 'true' | undefined };
type StreamWalletUtxoParams = { wallet: IWallet; args: Partial<StreamWalletUtxoArgs>; stream: Response };

@LoggifyClass
export class InternalStateProvider implements CSP.IChainStateService {
  chain: string;

  constructor(chain: string) {
    this.chain = chain;
    this.chain = this.chain.toUpperCase();
  }

  getRPC(network: string) {
    const RPC_PEER = config.chains[this.chain][network].rpc;
    const { username, password, host, port } = RPC_PEER;
    return new RPC(username, password, host, port);
  }

  streamAddressUtxos(params: CSP.StreamAddressUtxosParams) {
    const { network, address, stream, args } = params;
    if (typeof address !== 'string' || !this.chain || !network) {
      throw 'Missing required param';
    }
    let query = { chain: this.chain, network: network.toLowerCase(), address } as any;
    const unspent = args.unspent;
    if (unspent) {
      query.spentHeight = { $lt: 0 };
    }
    Storage.apiStreamingFind(CoinModel, query, stream);
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

  async getBlocks(params: CSP.GetBlocksParams) {
    const { network, sinceBlock, args } = params;
    let { limit, startDate, endDate, date } = args;
    if (!this.chain || !network) {
      throw 'Missing required param';
    }
    let query: any = {
      chain: this.chain,
      network: network.toLowerCase(),
      processed: true
    };
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
    if(date) {
      let firstDate = new Date(date);
      let nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      query.time = { $gt: firstDate, $lt: nextDate};
    }
    limit = limit || 200;
    limit = limit > 1000 ? 1000 : limit;
    let blocks = await BlockModel.find(query)
      .sort({ height: -1 })
      .limit(limit)
      .toArray();
    if (!blocks) {
      throw 'blocks not found';
    }
    let transformedBlocks = blocks.map(block => BlockModel._apiTransform(block, { object: true }).valueOf());
    return transformedBlocks;
  }

  async getBlock(params: CSP.GetBlockParams) {
    const { network, blockId } = params;
    if (typeof blockId !== 'string' || !this.chain || !network) {
      throw 'Missing required param';
    }
    let query: any = {
      chain: this.chain,
      network: network.toLowerCase(),
      processed: true
    };
    if (blockId.length === 64) {
      query.hash = blockId;
    } else {
      let height = parseInt(blockId, 10);
      if (Number.isNaN(height) || height.toString(10) !== blockId) {
        throw 'invalid block id provided';
      }
      query.height = height;
    }
    let block = await BlockModel.findOne(query);
    if (!block) {
      throw 'block not found';
    }
    return BlockModel._apiTransform(block, { object: true });
  }

  streamTransactions(params: CSP.StreamTransactionsParams) {
    const { network, stream, args } = params;
    if (!this.chain || !network) {
      throw 'Missing chain or network';
    }
    let query: any = {
      chain: this.chain,
      network: network.toLowerCase()
    };
    if (args.blockHeight) {
      query.blockHeight = Number(args.blockHeight);
    }
    if (args.blockHash) {
      query.blockHash = args.blockHash;
    }
    TransactionModel.getTransactions({ query })
      .pipe(JSONStream.stringify())
      .pipe(stream);
  }

  streamTransaction(params: CSP.StreamTransactionParams) {
    let { network, txId, stream } = params;
    if (typeof txId !== 'string' || !this.chain || !network || !stream) {
      throw 'Missing required param';
    }
    network = network.toLowerCase();
    let query = { chain: this.chain, network, txid: txId };
    TransactionModel.getTransactions({ query })
      .pipe(JSONStream.stringify())
      .pipe(stream);
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
    await WalletModel.insert(wallet);
    return wallet;
  }

  async getWallet(params: CSP.GetWalletParams) {
    const { pubKey } = params;
    return WalletModel.findOne({ pubKey });
  }

  streamWalletAddresses(params: CSP.StreamWalletAddressesParams) {
    let { walletId, stream } = params;
    let query = { wallet: walletId };
    Storage.apiStreamingFind(WalletAddressModel, query, stream);
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
    transactionStream.pipe(listTransactionsStream).pipe(stream);
  }

  async getWalletBalance(params: { wallet: IWallet }) {
    let query = { wallets: params.wallet._id };
    return CoinModel.getBalance({ query });
  }

  streamWalletUtxos(params: StreamWalletUtxoParams) {
    const { wallet, args = {}, stream } = params;
    let query: any = { wallets: wallet._id };
    if (args.includeSpent !== 'true') {
      query.spentHeight = { $lt: 0 };
    }
    Storage.apiStreamingFind(CoinModel, query, stream);
  }

  async getFee(params: CSP.GetEstimateSmartFeeParams) {
    const { network, target } = params;
    return new Promise((resolve, reject) => {
      this.getRPC(network).getEstimateSmartFee(Number(target), (err: any, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  async broadcastTransaction(params: CSP.BroadcastTransactionParams) {
    let { network, rawTx } = params;
    let txPromise = new Promise((resolve, reject) => {
      this.getRPC(network).sendTransaction(rawTx, (err: any, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
    return txPromise;
  }
}
