'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var _ = require('underscore');
var async = require('async');

var config = require('../config');

var TransactionSchema = new Schema({
  txid: String,
  network: String,
  chain: String,
  blockHeight: Number,
  blockHash: String,
  blockTime: Date,
  blockTimeNormalized: Date,
  coinbase: Boolean,
  fee: Number,
  size: Number,
  locktime: Number,
  wallets: { type: [Schema.Types.ObjectId] },
});

TransactionSchema.index({txid: 1});
TransactionSchema.index({blockHeight: 1});
TransactionSchema.index({blockHash: 1});
TransactionSchema.index({blockTime: 1});
TransactionSchema.index({blockTimeNormalized: 1});
TransactionSchema.index({wallets: 1});

TransactionSchema.statics.addTransaction = function(options, callback){
  Transaction.findOneAndUpdate({txid: options.transaction.rhash()}, {
    txid: options.transaction.rhash(),
    network: options.network,
    blockHeight: options.blockHeight,
    blockHash: options.blockHash,
    blockTime: options.blockTime,
    blockTimeNormalized: options.blockTimeNormalized,
    coinbase: options.transaction.isCoinbase(),
    size: options.transaction.getSize(),
    locktime: options.transaction.locktime
  }, {upsert:true, new: true}, function(err, transaction){
    if(err){
      return callback(err);
    }
    transaction.mintCoins(options.outputs, function(err){
      callback(err, transaction);
    });
  });
};

TransactionSchema.methods.mintCoins = function(outputs, callback){
  var self = this;
  async.eachOfLimit(outputs, 4, function(output, index, outputCb){
    var address = output.getAddress();
    if(address) {
      address = address.toString(config.network);
    }
    mongoose.model('WalletAddress').find({address: address}).lean().exec(function(err, wallets) {
      mongoose.model('Coin').findOneAndUpdate({mintTxid: self.txid, mintIndex: index}, {
        network: self.network,
        mintTxid: self.txid,
        mintIndex: index,
        mintHeight: self.blockHeight,
        coinbase: self.coinbase,
        value: output.value,
        address: address,
        wallets: _.pluck(wallets, 'wallet')
      }, {upsert: true, new: true}, outputCb);
    });
  }, callback);
};

TransactionSchema.methods.spendCoins = function(inputs, callback){
  var self = this;
  if(self.coinbase){
    return callback();
  }
  async.eachLimit(inputs, 4, function(input, inputCb){
    mongoose.model('Coin').update({mintTxid: input.prevout.rhash(), mintIndex: input.prevout.index}, {
      $set: {spentTxid: self.txid, spentHeight: self.blockHeight}
    }, inputCb);
  }, callback);
};

TransactionSchema.statics._apiTransform = function(tx, options) {
  var transform = {
    txid: tx.txid,
    network: tx.network,
    blockHeight: tx.blockHeight,
    blockHash: tx.blockHash,
    blockTime: tx.blockTime,
    blockTimeNormalized: tx.blockTimeNormalized,
    coinbase: tx.coinbase,
    fee: tx.fee,
  };
  if(options && options.object) {
    return transform;
  }
  return JSON.stringify(transform);
};

var Transaction = module.exports = mongoose.model('Transaction', TransactionSchema);