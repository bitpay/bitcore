'use strict';
var Transaction;
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var _ = require('underscore');
var async = require('async');
var bitcore = require('bitcore-lib');

var constants = require('../constants');
var WalletAddress = mongoose.model('WalletAddress');

var Input = new Schema({
  utxo: String,
  vout: Number,
  address: String,
  amount: Number,
  wallets: {type: [Schema.Types.ObjectId]}
});

var Output = new Schema({
  address: String,
  amount: Number,
  vout: Number,
  wallets: {type: [Schema.Types.ObjectId]},
  spent: Boolean
});

var TransactionSchema = new Schema({
  txid: String,
  chain: String,
  blockHeight: Number,
  blockHash: String,
  blockTime: Date,
  blockTimeNormalized: Date,
  inputs: [Input],
  outputs: [Output],
  coinbase: Boolean,
  fee: Number,
  inputsProcessed: Boolean,
  wallets: {type: [Schema.Types.ObjectId]}
});

TransactionSchema.index({txid: 1}, {unique: true});
TransactionSchema.index({blockHeight: 1, wallets: 1});
TransactionSchema.index({blockHash: 1});
TransactionSchema.index({blockTime: 1});
TransactionSchema.index({blockTimeNormalized: 1, wallets: 1});

TransactionSchema.index({'outputs.address': 1});
TransactionSchema.index({'inputs.address': 1});
TransactionSchema.index({'wallets': 1}, {sparse: true});
TransactionSchema.index({'inputs.wallets': 1}, {sparse: true});
TransactionSchema.index({'outputs.wallets': 1}, {sparse: true});

TransactionSchema.statics.syncTransactionAndOutputs = function(data, callback) {
  var transaction = data.transaction;
  Transaction.findOne({txid: transaction.hash}).lean().exec(function(err, hasTx) {
    if(err) {
      return callback(err);
    }
    if(hasTx) {
      return callback();
    }

    var newTx = new Transaction();
    newTx.blockHeight = data.blockHeight;
    newTx.blockHash = data.blockHash;
    newTx.blockTime = new Date(data.blockTime);
    newTx.blockTimeNormalized = new Date(data.blockTimeNormalized);
    newTx.txid = transaction.hash;

    async.eachOfLimit(transaction.outputs, constants.maxPoolSize, function(output, index, outputCb) {
      var script;
      var address;
      try {
        script = new bitcore.Script(output.script);
        address = script.toAddress('livenet').toString();
        if(address === 'false' && script.classify() === 'Pay to public key') {
          var hash = bitcore.crypto.Hash.sha256ripemd160(script.chunks[0].buf);
          address = bitcore.Address(hash, bitcore.Networks.livenet).toString();
        }
      } catch(e) {
        address = 'noAddress';
      }

      mongoose.model('WalletAddress').find({address: address}).lean().exec(function(err, wallets) {
        if(err) {
          return outputCb(err);
        }

        _.each(wallets, function(wallet) {
          newTx.wallets.addToSet(wallet.wallet);
        });

        newTx.outputs.push({
          vout: index,
          amount: parseFloat((output.satoshis * 1e-8).toFixed(8)),
          address: address,
          wallets: _.pluck(wallets, 'wallet'),
          spent: false
        });
        outputCb();
      });
    }, function(err) {
      if(err) {
        return callback(err);
      }
      // Coinbase
      if(transaction.inputs[0].prevTxId.toString('hex') === '0000000000000000000000000000000000000000000000000000000000000000') {
        newTx.coinbase = true;
        newTx.inputs.push({
          amount: _.reduce(newTx.outputs, function(total, output) {return total + output.amount;}, 0)
        });
        newTx.inputsProcessed = true;
      } else {
        transaction.inputs.forEach(function(input) {
          var prevTxId = input.prevTxId.toString('hex');
          newTx.inputs.push({
            utxo: prevTxId,
            vout: input.outputIndex
          });
        });
        newTx.inputsProcessed = false;
      }
      newTx.save({ordered: false}, callback);
    });
  });
};

TransactionSchema.statics.syncTransactionInputs = function(txid, callback) {
  Transaction.findOne({txid: txid}, function(err, transaction) {
    if(err) {
      return callback(err);
    }
    if(transaction.inputsProcessed) {
      return callback();
    }
    async.eachLimit(transaction.inputs, constants.maxPoolSize, function(input, inputCb) {
      Transaction.findOne({txid: input.utxo}).select('outputs').lean().exec(function(err, utxo) {
        if(err) {
          return inputCb(err);
        }
        if(!utxo) {
          return callback(new Error('Couldnt find utxo'));
        }
        utxo = _.findWhere(utxo.outputs, {vout: input.vout});
        input.address = utxo.address;
        input.amount = parseFloat(utxo.amount.toFixed(8));
        // TODO the find and update need to be consolidated here, while still being lean
        Transaction.update({txid: input.utxo, 'outputs.vout': input.vout},{
          $set: {'outputs.$.spent': true}
        }, function(err){
          if(err){
            return callback(err);
          }
          if(!input.address) {
            return inputCb();
          }
          WalletAddress.find({address: input.address}).lean().exec(function(err, wallets) {
            if(err) {
              return inputCb(err);
            }
            _.each(wallets, function(wallet) {
              transaction.wallets.addToSet(wallet.wallet);
            });
            input.wallets = _.pluck(wallets, 'wallet');
            inputCb();
          });
        });
      });
    }, function(err) {
      if(err) {
        return callback(err);
      }
      var totalInputs = _.reduce(transaction.inputs, function(total, input) {return total + input.amount;}, 0);
      var totalOutputs = _.reduce(transaction.outputs, function(total, output) {return total + output.amount;}, 0);
      transaction.fee = parseFloat((totalInputs - totalOutputs).toFixed(8));
      if(transaction.fee < 0) {
        return callback('Fee is negative, something is really wrong');
      }
      transaction.inputsProcessed = true;
      transaction.save({ordered: false}, callback);
    });
  });
};

var Transaction = module.exports = mongoose.model('Transaction', TransactionSchema);