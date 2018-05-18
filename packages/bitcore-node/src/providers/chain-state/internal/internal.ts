import { Response } from 'express';
import { CoinModel, CoinQuery } from '../../../models/coin';
import { BlockModel, BlockQuery } from '../../../models/block';
import { IWalletModel } from '../../../models/wallet';
import { WalletModel } from '../../../models/wallet';
import { WalletAddressModel } from '../../../models/walletAddress';
import { CSP } from '../../../types/namespaces/ChainStateProvider';
import { Storage } from '../../../services/storage';
import { RPC } from '../../../rpc';
import { LoggifyClass } from '../../../decorators/Loggify';
import config from '../../../config';

import {
  TransactionQuery,
  TransactionModel
} from '../../../models/transaction';

const JSONStream = require('JSONStream');
const ListTransactionsStream = require('./transforms');

type StreamWalletUtxoArgs = { includeSpent: 'true' | undefined };
type StreamWalletUtxoParams = {
  wallet: IWalletModel;
  args: Partial<StreamWalletUtxoArgs>;
  stream: Response;
};

@LoggifyClass
export class InternalStateProvider implements CSP.IChainStateService {
  chain: string;
  constructor(chain: string) {
    this.chain = chain;
    this.chain = this.chain.toUpperCase();
  }
/**
 * Returns an RPC client that
 *
 * @param {string} network
 * @returns {RPC}
 * @memberof InternalStateProvider
*/
getRPC(network: string): RPC {
    const RPC_PEER = config.chains[this.chain][network].rpc;
    const { username, password, host, port } = RPC_PEER;
    return new RPC(username, password, host, port);
  }
/**
 * Writes all UTXOs for an address to a stream
 *
 * @param {CSP.StreamAddressUtxosParams} params
 * @memberof InternalStateProvider
 */
streamAddressUtxos(params: CSP.StreamAddressUtxosParams) {
    const { network, address, stream, args } = params;
    if (typeof address !== 'string' || !this.chain || !network) {
      throw 'Missing required param';
    }
    let query: CoinQuery = {
      chain: this.chain,
      network: network.toLowerCase(),
      address
    };
    const unspent = args.unspent;
    if (unspent) {
      query.spentHeight = { $lt: 0 };
    }
    Storage.apiStreamingFind(CoinModel, query, stream);
  }

  /**
   * Gets a promise of an array of balances
   *
   * @param {CSP.GetBalanceForAddressParams} params
   * @returns A promise for an array of {balance: number }
   * @memberof InternalStateProvider
   */
  getBalanceForAddress(params: CSP.GetBalanceForAddressParams) {
    const { network, address } = params;
    let query = { chain: this.chain, network, address };
    return CoinModel.getBalance({ query });
  }
/**
 * Gets a promise of an array of balances for a wallet
 *
 * @param {CSP.GetBalanceForWalletParams} params
 * @returns A promise for an array of {balance: number}
 * @memberof InternalStateProvider
 */
async getBalanceForWallet(params: CSP.GetBalanceForWalletParams) {
    const { walletId } = params;
    let query = { wallets: walletId };
    return CoinModel.getBalance({ query });
  }


  /**
   * Returns an array of blocks in descending order by height
   * Allows you to pass in sinceBlock and limit to adjust how many blocks to return
   * @param {CSP.GetBlocksParams} params
   * @returns
   * @memberof InternalStateProvider
   */
  async getBlocks(params: CSP.GetBlocksParams) {
    const { network, sinceBlock, args } = params;
    let { limit = undefined } = args || {};
    if (!this.chain || !network) {
      throw 'Missing required param';
    }
    let query: BlockQuery = {
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
    let blocks = await BlockModel.find(query)
      .sort({ height: -1 })
      .limit(limit || 100)
      .exec();
    if (!blocks) {
      throw 'blocks not found';
    }
    let transformedBlocks = blocks.map(block =>
      BlockModel._apiTransform(block, { object: true })
    );
    return transformedBlocks;
  }


  /**
   * Returns a single block by blockId
   *
   * @param {CSP.GetBlockParams} params
   * @returns
   * @memberof InternalStateProvider
   */
  async getBlock(params: CSP.GetBlockParams) {
    const { network, blockId } = params;
    if (typeof blockId !== 'string' || !this.chain || !network) {
      throw 'Missing required param';
    }
    let query: BlockQuery = {
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
    let block = await BlockModel.findOne(query).exec();
    if (!block) {
      throw 'block not found';
    }
    return BlockModel._apiTransform(block, { object: true });
  }

  /**
   * Write transactions to a stream. Takes in arguments for blockHeight and blockHash
   * 
   * @param {CSP.StreamTransactionsParams} params 
   * @memberof InternalStateProvider
   */
  streamTransactions(params: CSP.StreamTransactionsParams) {
    const { network, stream, args } = params;
    if (!this.chain || !network) {
      throw 'Missing chain or network';
    }
    let query: TransactionQuery = {
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

  /**
   *  Write a single transaction to a stream
   * 
   * @param {CSP.StreamTransactionParams} params 
   * @memberof InternalStateProvider
   */
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

  /**
   * Create a wallet given a wallet name, path, pubKey, chain and network
   * 
   * @param {CSP.CreateWalletParams} params 
   * @returns 
   * @memberof InternalStateProvider
   */
  async createWallet(params: CSP.CreateWalletParams) {
    const { network, name, pubKey, path } = params;
    if (typeof name !== 'string' || !network) {
      throw 'Missing required param';
    }
    return WalletModel.create({
      chain: this.chain,
      network,
      name,
      pubKey,
      path
    });
  }

  /**
   * Get a wallet by it's pubKey
   * 
   * @param {CSP.GetWalletParams} params 
   * @returns 
   * @memberof InternalStateProvider
   */
  async getWallet(params: CSP.GetWalletParams) {
    const { pubKey } = params;
    let wallet = await WalletModel.findOne({ pubKey });
    return wallet;
  }

  /**
   * Write all of a wallet's addresses to a stream
   * 
   * @param {CSP.StreamWalletAddressesParams} params 
   * @memberof InternalStateProvider
   */
  streamWalletAddresses(params: CSP.StreamWalletAddressesParams) {
    let { walletId, stream } = params;
    let query = { wallet: walletId };
    Storage.apiStreamingFind(WalletAddressModel, query, stream);
  }

  /**
   * Add a set of addresses to the wallet 
   * 
   * @param {CSP.UpdateWalletParams} params 
   * @returns 
   * @memberof InternalStateProvider
   */
  async updateWallet(params: CSP.UpdateWalletParams) {
    const { wallet, addresses } = params;
    return WalletAddressModel.updateCoins({ wallet, addresses });
  }

  /**
   * Write a wallet's transactions to a stream. 
   * Takes parameters for startBlock, endBlock, 
   * startDate, endDate
   * 
   * @param {CSP.StreamWalletTransactionsParams} params 
   * @memberof InternalStateProvider
   */
  async streamWalletTransactions(params: CSP.StreamWalletTransactionsParams) {
    let { network, wallet, stream, args } = params;
    let query: TransactionQuery = {
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

  /**
   *  Get the balance of a wallet 
   * 
   * @param {{ wallet: IWalletModel }} params 
   * @returns 
   * @memberof InternalStateProvider
   */
  async getWalletBalance(params: { wallet: IWalletModel }) {
    let query = { wallets: params.wallet._id };
    return CoinModel.getBalance({ query });
  }

  /**
   *  Get all of a wallet's utxos and write them to a stream 
   * 
   * @param {StreamWalletUtxoParams} params 
   * @memberof InternalStateProvider
   */
  streamWalletUtxos(params: StreamWalletUtxoParams) {
    const { wallet, args = {}, stream } = params;
    let query: CoinQuery = { wallets: wallet._id };
    if (args.includeSpent !== 'true') {
      query.spentHeight = { $lt: 0 };
    }
    Storage.apiStreamingFind(CoinModel, query, stream);
  }


  /**
   * Broadcast a transaction over rpc
   * 
   * @param {CSP.BroadcastTransactionParams} params 
   * @returns 
   * @memberof InternalStateProvider
   */
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
