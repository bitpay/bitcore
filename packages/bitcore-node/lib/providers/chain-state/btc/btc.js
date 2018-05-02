const config = require('../../../config');
const JSONStream = require('JSONStream');
const ListTransactionsStream = require('./transforms');
const Storage = require('../../../services/storage');
const mongoose = require('mongoose');
const Wallet = mongoose.model('Wallet');
const WalletAddress = mongoose.model('WalletAddress');
const Transaction = mongoose.model('Transaction');
const Coin = mongoose.model('Coin');
const Block = mongoose.model('Block');
const RPC = require('../../../rpc');

class BTCStateProvider {
  constructor(chain) {
    this.chain = chain || 'BTC';
    this.chain = this.chain.toUpperCase();
  }

  getRPC(network) {
    const RPC_PEER = config.chains[this.chain][network].rpc;
    const { username, password, host, port } = RPC_PEER;
    return new RPC(username, password, host, port);
  }

  streamAddressUtxos(network, address, stream, args) {
    if (typeof address !== 'string' || !this.chain || !network) {
      throw 'Missing required param';
    }
    network = network.toLowerCase();
    let query = { chain: this.chain, network, address };
    const unspent = args.unspent;
    if (unspent) {
      query.spentHeight = { $lt: 0 };
    }
    Storage.apiStreamingFind(Coin, query, stream);
  }

  getBalanceForAddress(network, address) {
    let query = { chain: this.chain, network, address };
    return Coin.getBalance({ query }).exec();
  }

  async getBalanceForWallet(walletId) {
    let query = { wallets: walletId };
    return Coin.getBalance({ query }).exec();
  }

  async getBlocks(network, sinceBlock, args) {
    let { limit } = args || {};
    if (!this.chain || !network) {
      throw 'Missing required param';
    }
    network = network.toLowerCase();
    let query = { chain: this.chain, network, processed: true };
    if (sinceBlock) {
      let height = parseInt(sinceBlock, 10);
      if (Number.isNaN(height) || height.toString(10) !== sinceBlock) {
        throw 'invalid block id provided';
      }
      query.height = { $gt: height };
    }
    let blocks = await Block.find(query)
      .sort({ height: -1 })
      .limit(limit || 100)
      .exec();
    if (!blocks) {
      throw 'blocks not found';
    }
    let transformedBlocks = blocks.map(block =>
      Block._apiTransform(block, { object: true })
    );
    return transformedBlocks;
  }

  async getBlock(network, blockId) {
    if (typeof blockId !== 'string' || !this.chain || !network) {
      throw 'Missing required param';
    }
    network = network.toLowerCase();
    let query = { chain: this.chain, network, processed: true };
    if (blockId.length === 64) {
      query.hash = blockId;
    } else {
      let height = parseInt(blockId, 10);
      if (Number.isNaN(height) || height.toString(10) !== blockId) {
        throw 'invalid block id provided';
      }
      query.height = height;
    }
    let block = await Block.findOne(query).exec();
    if (!block) {
      throw 'block not found';
    }
    return Block._apiTransform(block, { object: true });
  }

  streamTransactions(network, stream, args) {
    if (!this.chain || !network) {
      throw 'Missing chain or network';
    }
    network = network.toLowerCase();
    let query = { chain: this.chain, network };
    if (args.blockHeight) {
      query.blockHeight = parseInt(args.blockHeight);
    }
    if (args.blockHash) {
      query.blockHash = args.blockHash;
    }
    Transaction.getTransactions({ query })
      .pipe(JSONStream.stringify())
      .pipe(stream);
  }

  streamTransaction(network, txId, stream) {
    if (typeof txId !== 'string' || !this.chain || !network || !stream) {
      throw 'Missing required param';
    }
    network = network.toLowerCase();
    let query = { chain: this.chain, network, txid: txId };
    Transaction.getTransactions({ query })
      .pipe(JSONStream.stringify())
      .pipe(stream);
  }

  async createWallet(params) {
    const { network, name, pubKey, path } = params;
    if (typeof name !== 'string' || !network) {
      throw 'Missing required param';
    }
    return Wallet.create({
      chain: this.chain,
      network,
      name,
      pubKey,
      path
    });
  }

  async getWallet(params) {
    const { pubKey } = params;
    let wallet = await Wallet.findOne({ pubKey }).exec();
    return wallet;
  }

  streamWalletAddresses(network, walletId, stream) {
    let query = { wallet: walletId };
    Storage.apiStreamingFind(WalletAddress, query, stream);
  }

  async updateWallet(params) {
    const { wallet, addresses } = params;
    return WalletAddress.updateCoins({ wallet, addresses });
  }

  async streamWalletTransactions(network, wallet, stream, args) {
    let query = {
      chain: this.chain,
      network,
      wallets: wallet._id
    };
    if (args) {
      if (args.startBlock) {
        query.blockHeight = { $gte: parseInt(args.startBlock) };
      }
      if (args.endBlock) {
        query.blockHeight = query.blockHeight || {};
        query.blockHeight.$lte = parseInt(args.endBlock);
      }
      if (args.startDate) {
        query.blockTimeNormalized = { $gte: new Date(args.startDate) };
      }
      if (args.endDate) {
        query.blockTimeNormalized = query.blockTimeNormalized || {};
        query.blockTimeNormalized.$lt = new Date(args.endDate);
      }
    }
    let transactionStream = Transaction.getTransactions({ query });
    let listTransactionsStream = new ListTransactionsStream(wallet);
    transactionStream.pipe(listTransactionsStream).pipe(stream);
  }

  async getWalletBalance(params) {
    let query = { wallets: params.wallet._id };
    return Coin.getBalance({ query }).exec();
  }

  streamWalletUtxos(params) {
    const { wallet, args = {}, stream } = params;
    let query = { wallets: wallet._id };
    if (args.includeSpent !== 'true') {
      query.spentHeight = { $lt: 0 };
    }
    Storage.apiStreamingFind(Coin, query, stream);
  }

  async broadcastTransaction(network, rawTx) {
    let txPromise = new Promise((resolve, reject) => {
      this.getRPC(network).sendTransaction(rawTx, (err, result) => {
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

module.exports = BTCStateProvider;
