'use strict';
var util = require('util');
var Transform = require('stream').Transform;

var router = require('express').Router();
var JSONStream = require('JSONStream');
var _ = require('underscore');
var async = require('async');
var mongoose = require('mongoose');

var config = require('../config');
var Wallet = mongoose.model('Wallet');
var WalletAddress = mongoose.model('WalletAddress');
var Transaction = mongoose.model('Transaction');

router.post('/', function(req, res) {
  Wallet.create({name: req.body.name}, function(err, result) {
    if(err) {
      res.status(500).send(err);
    }
    res.send(result);
  });
});

router.get('/:walletId', function(req, res) {
  Wallet.findOne({_id: req.params.walletId}, function(err, wallet) {
    if(err) {
      return res.status(500).send(err);
    }
    if(!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    res.send(wallet);
  });
});

router.get('/:walletId/addresses', function(req, res) {
  Wallet.findOne({_id: req.params.walletId}, function(err, wallet) {
    if(err) {
      return res.status(500).send(err);
    }
    if(!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    var addressStream = WalletAddress.find({wallet: wallet._id}, {address: true, _id: false}).cursor();
    addressStream.pipe(JSONStream.stringify()).pipe(res);
  });
});

router.post('/:walletId', function(req, res) {
  Wallet.findOne({_id: req.params.walletId}, function(err, wallet) {
    if(err) {
      return res.status(500).send(err);
    }
    if(!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }

    var addresses;
    try {
      addresses = [];
      req.body.toString().split('\n').forEach(function(line){
        if (line.length > 2){
          line = JSON.parse(line);
          var address = line.address;
          if (address){
            addresses.push(address);
          }
        }
      });
    } catch(e) {
      return res.status(500).send(err);
    }
    res.send({success: true});
    var walletUpdates = addresses.map(function(address) {
      return {
        updateOne: {
          filter: {wallet: wallet._id, address: address},
          update: {wallet: wallet._id, address: address},
          upsert: true
        }
      };
    });
    WalletAddress.bulkWrite(walletUpdates, {ordered: false}, function(err, result) {
      if(err) {
        return res.status(500).end(err.message);
      }
      console.log('Added ' + result.nModified + ' addresses to wallet ' + wallet._id);
      async.eachLimit(addresses, 20, function(address, cb) {
        var txStream = Transaction.find({$or: [{'outputs.address': address}, {'inputs.address': address}], wallets: {$nin: [wallet._id]}}).cursor();
        var error;
        txStream.on('error', function(err) {
          error = err;
        });
        txStream.on('data', function(tx) {
          txStream.pause();
          tx.wallets.addToSet(wallet._id);
          tx.inputs.forEach(function(input) {
            if(input.address === address) {
              input.wallets.addToSet(wallet._id);
            }
          });
          tx.outputs.forEach(function(output) {
            if(output.address === address) {
              output.wallets.addToSet(wallet._id);
            }
          });
          if(!tx.isModified()){
            txStream.resume();
          } else {
            tx.save(function() {
              console.log('Added wallet ' + wallet._id + ' to tx ' + tx.txid);
              txStream.resume();
            });
          }
        });
        txStream.on('end', function() {
          cb(error);
        });
      }, function(err) {
        if(err) {
          console.error(err);
        }
        console.log('Completed import for wallet ' + wallet._id);
      });
    });
  });
});

function ListTransactionsStream(walletId) {
  this.walletId = walletId;
  Transform.call(this, {objectMode: true});
}

util.inherits(ListTransactionsStream, Transform);

ListTransactionsStream.prototype._transform = function(transaction, enc, done) {
  var self = this;
  var wallet = this.walletId.toString();
  var fee = Math.round(transaction.fee * 1e8);
  var sending = _.some(transaction.inputs, function(input) {
    var contains = false;
    _.each(input.wallets, function(inputWallet) {
      if(inputWallet.equals(wallet)) {
        contains = true;
      }
    });
    return contains;
  });

  if(sending) {
    var recipients = 0;
    _.each(transaction.outputs, function(output) {
      var contains = false;
      _.each(output.wallets, function(outputWallet) {
        if(outputWallet.equals(wallet)) {
          contains = true;
        }
      });
      if(!contains) {
        recipients++;
        self.push(JSON.stringify({
          txid: transaction.txid,
          category: 'send',
          satoshis: -Math.round(output.amount * 1e8),
          height: transaction.blockHeight,
          address: output.address,
          outputIndex: output.vout,
          blockTime: transaction.blockTimeNormalized
        }) + '\n');
      }
    });
    if (recipients > 1){
      console.log('probably missing a change address');
    }
    if(fee > 0) {
      self.push(JSON.stringify({
        txid: transaction.txid,
        category: 'fee',
        satoshis: -fee,
        height: transaction.blockHeight,
        blockTime: transaction.blockTimeNormalized
      }) + '\n');
    }
    return done();
  }

  _.each(transaction.outputs, function(output) {
    var contains = false;
    _.each(output.wallets, function(outputWallet) {
      if(outputWallet.equals(wallet)) {
        contains = true;
      }
    });
    if(contains) {
      self.push(JSON.stringify({
        txid: transaction.txid,
        category: 'receive',
        satoshis: Math.round(output.amount * 1e8),
        height: transaction.blockHeight,
        address: output.address,
        outputIndex: output.vout,
        blockTime: transaction.blockTimeNormalized
      }) + '\n');
    }
  });

  done();
};

router.get('/:walletId/transactions', function(req, res) {
  Wallet.findOne({_id: req.params.walletId}, function(err, wallet) {
    if(err) {
      return res.status(500).send(err);
    }
    if(!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    var query = {
      wallets: wallet._id,
      mainChain:true
    };
    if(req.query.startBlock) {
      query.blockHeight = {$gte: req.query.startBlock};
    }
    if(req.query.endBlock) {
      query.blockHeight = query.blockHeight || {};
      query.blockHeight.$lte = req.query.endBlock;
    }
    if(req.query.startDate) {
      query.blockTimeNormalized = {$gte: new Date(req.query.startDate)};
    }
    if(req.query.endDate) {
      query.blockTimeNormalized = query.blockTimeNormalized || {};
      query.blockTimeNormalized.$lt = new Date(req.query.endDate);
    }

    var transactionStream = Transaction.find(query).cursor();
    var listTransactionsStream = new ListTransactionsStream(wallet._id);
    transactionStream.pipe(listTransactionsStream).pipe(res);
  });
});

router.get('/:walletId/balance', function(req, res) {
  Wallet.findOne({_id: req.params.walletId}, function(err, wallet) {
    if(err) {
      return res.status(500).send(err);
    }
    if(!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    var unspent = Transaction.aggregate([
      {$match: {mainChain: true, 'outputs.wallets': wallet._id}},
      {$unwind: '$outputs'},
      {$match: {mainChain: true, 'outputs.wallets': wallet._id, 'outputs.spent': false}},
      {
        $group: {
          _id: null,
          balance: {$sum: '$outputs.amount'}
        }
      }
    ]);
    unspent.addCursorFlag('noCursorTimeout', true).allowDiskUse(true).exec(function(err, result) {
      if(err) {
        return res.status(500).send(err);
      }
      res.send(result[0]);
    });
  });
});

router.get('/:walletId/utxos', function(req, res){
  Wallet.findOne({_id: req.params.walletId}, function(err, wallet){
    if(err) {
      return res.status(500).send(err);
    }
    if(!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    Transaction.find({
      mainChain: true, 'outputs.wallets': wallet._id, 'outputs.spent': false
    }).lean().stream(); //WIP
  });
});

module.exports = {
  router: router,
  path: '/wallet'
};