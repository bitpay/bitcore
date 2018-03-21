const JSONStream = require('JSONStream');
const ListTransactionsStream = require('./transforms');
const Storage = require('../../../services/storage');
const mongoose = require('mongoose');
const Wallet = mongoose.model('Wallet');
const WalletAddress = mongoose.model('WalletAddress');
const Transaction = mongoose.model('Transaction');
const Coin = mongoose.model('Coin');
const Block = mongoose.model('Coin');

function BTCStateProvider(chain){
  this.chain = chain || 'BTC';
  this.chain = this.chain.toUpperCase();
}

BTCStateProvider.prototype.getAddressUtxos = async function(network, address, stream, args) {
  if (typeof address !== 'string' || !this.chain || !network) {
    throw 'Missing required param';
  }
  network = network.toLowerCase();
  let query = {chain: this.chain, network, address};
  const unspent = args.unspent;
  if (unspent) {
    query.spentHeight = { $lt: 0 };
  }
  Storage.apiStreamingFind(Coin, query, stream);
};

BTCStateProvider.prototype.getBalanceForAddress = async function(network, address){
  let query = {chain: this.chain, network, address};
  return Coin.getBalance({ query }).exec();
};

BTCStateProvider.prototype.getBalanceForWallet = async function(walletId){
  let query = { wallets: walletId};
  return Coin.getBalance({query}).exec();
};

BTCStateProvider.prototype.getBlock = async function(network, blockId){
  if (typeof blockId !== 'string' || !this.chain || !network){
    throw 'Missing required param';
  }
  network = network.toLowerCase();
  let query = {chain: this.chain, network};
  if (blockId.length === 64){
    query.hash = blockId;
  } else {
    let height = parseInt(blockId, 10);
    if (Number.isNaN(height) || height.toString(10) !== blockId) {
      throw 'invalid block id provided';
    }
    query.height = height;
  }
  let block = await Block.findOne(query);
  if(!block) {
    throw 'block not found';
  }
  return Block._apiTransform(block,{object:true});
};

BTCStateProvider.prototype.getTransactions = async function(network, stream, args){
  if (!this.chain || !network) {
    throw 'Missing chain or network';
  }
  network = network.toLowerCase();
  let query = {chain: this.chain, network};
  if(args.blockHeight) {
    query.blockHeight = parseInt(args.blockHeight);
  }
  if(args.blockHash) {
    query.blockHash = args.blockHash;
  }
  Transaction.getTransactions({ query }).pipe(JSONStream.stringify()).pipe(stream);
};

BTCStateProvider.prototype.getTransaction = (network, txId, stream) => {
  if (typeof txid !== 'string' || !this.chain || !network || !stream) {
    throw 'Missing required param';
  }
  network = network.toLowerCase();
  let query = {chain: this.chain, network, txid: txId};
  Transaction.getTransactions({ query }).pipe(JSONStream.stringify()).pipe(stream);
};

BTCStateProvider.prototype.createWallet = async (network, name, pubKey, args) => {
  if (typeof name !== 'string' || !network) {
    throw 'Missing required param';
  }
  return Wallet.create({
    chain: this.chain,
    network,
    name,
    pubKey,
    path: args.path
  });
};

BTCStateProvider.prototype.getWallet = async (chain, walletId) => {
  let wallet = await Wallet.findOne({ _id: walletId }).exec();
  return Wallet._apiTransform(wallet);
};

BTCStateProvider.prototype.getWalletAddresses = async function(walletId, stream){
  let query = { wallet: walletId };
  Storage.apiStreamingFind(WalletAddress, query, stream);
};

BTCStateProvider.prototype.updateWallet = (chain, walletId, addresses) => {
  return WalletAddress.updateCoins(walletId, addresses);
};

BTCStateProvider.prototype.getWalletTransactions = (walletId, stream, args) => {
  let query = {
    wallets: walletId
  };
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
  let transactionStream = Transaction.getTransactions({query});
  let listTransactionsStream = new ListTransactionsStream(walletId);
  transactionStream.pipe(listTransactionsStream).pipe(stream);
};

BTCStateProvider.prototype.getWalletBalance = async (walletId) => {
  let query = { wallets: walletId };
  return Coin.getBalance({query}).exec();
};

BTCStateProvider.prototype.getWalletUtxos = (walletId, stream, args) => {
  let query = { wallets: walletId, spentHeight: {$lt: 0} };
  if (args.spent){
    query.spentHeight = { $gt: 0 };
  }
  Storage.apiStreamingFind(Coin, query, stream);
};

/*
 *BTCStateProvider.prototype.broadcastTransaction = (chain, tx) => {
 *  return this.get(chain).broadcastTransaction(tx);
 *};
 */

module.exports = BTCStateProvider;
