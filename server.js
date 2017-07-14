'use strict';

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/fullNodePlus');
var Transaction = require('./lib/models/Transaction');
var rpc = require('./lib/rpc');
var async = require('async');
var _ = require('underscore');
var JSONStream = require('JSONStream');
var express = require('express');
var bodyParser = require('body-parser');
var bitcore = require('bitcore-lib');
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.raw({limit: 100000000}));

function processBlock(block, height, callback){
  block = new bitcore.Block.fromString(block);
  var resultTransactions = [];
  async.eachLimit(block.transactions, 32, function(transaction, txCb){
    Transaction.findOne({txid: transaction.hash}, function(err, hasTx){
      if (err){
        return txCb(err);
      }
      if (hasTx){
        return txCb();
      }
      var newTx = {inputs:[], outputs:[], wallets:[]};
      newTx.txid = transaction.hash;
      newTx.blockHeight = height;
      newTx.blockHash = block.hash;

      transaction.outputs.forEach(function (output, index) {
        newTx.outputs.push({
          vout: index,
          amount: parseFloat((output.satoshis*1e-8).toFixed(8)),
          address: output.script.toAddress('livenet').toString()
        });
      });

      async.eachLimit(transaction.inputs, 2, function (input, inputCb) {
        if (transaction.isCoinbase()) {
          newTx.coinbase = true;
          newTx.inputs.push({
            amount: newTx.outputs[0].amount
          });
          return inputCb();
        }

        var prevTxId = input.prevTxId.toString('hex');

        Transaction.findOne({ txid: prevTxId }, function (err, inputTx) {
          if (err) {
            return inputCb(err);
          }
          if (!inputTx) {
            inputTx = _.findWhere(block.transactions, { hash: prevTxId });
            if (inputTx) {
              inputTx = {
                outputs: [
                  {
                    vout: input.outputIndex,
                    amount: parseFloat((inputTx.outputs[input.outputIndex].satoshis * 1e-8).toFixed(8)),
                    address: inputTx.outputs[input.outputIndex].script.toAddress('livenet').toString()
                  }
                ]
              };
            }
          }
          if (err || !inputTx) {
            return inputCb(new Error('Could not find input transaction'));
          }
          var utxo = _.findWhere(inputTx.outputs, { vout: input.outputIndex });
          if (!utxo) {
            return inputCb(new Error('Could not find utxo'));
          }
          newTx.inputs.push({
            txid: prevTxId,
            vout: input.outputIndex,
            address: utxo.address,
            amount: utxo.amount
          });
          inputCb();
        });
      }, function (err) {
        if (err){
          return txCb(err);
        }
        var totalInputs = _.reduce(newTx.inputs, function (total, input) { return total + input.amount; }, 0);
        var totalOutputs = _.reduce(newTx.outputs, function (total, output) { return total + output.amount; }, 0);
        newTx.fee = parseFloat((totalInputs - totalOutputs).toFixed(8));
        var addresses = _.compact(_.uniq(_.union(_.pluck(newTx.inputs, 'address'), _.pluck(newTx.outputs, 'address'))));
        WalletAddress.find({address: {$in: addresses}}, function(err, wallets){
          if (err){
            return txCb(err);
          }
          if (wallets.length){
            wallets.forEach(function (wallet) {
              newTx.wallets.push(wallet.wallet);
            });
          }
          resultTransactions.push(newTx);
          txCb();
        });

      });
    });

  }, function(err){
    callback(err, resultTransactions);
  });
}

function insertTransactions(transactions, callback){
  if (!transactions.length){
    return callback();
  }
  transactions = transactions.map(function(transaction){
    return {
      insertOne:{
        document: transaction
      }
    };
  });
  Transaction.bulkWrite(transactions, {ordered:false, safe:{w:1}}, callback);
}

rpc.getChainTip(function(err, chainTip){
  Transaction.find({}).limit(1).sort({ blockHeight: -1 }).exec(function (err, localTip) {
    localTip = (localTip[0] && localTip[0].blockHeight) || 0;
    var blockTimes = new Array(144);
    async.eachSeries(_.range(localTip, chainTip.height), function (blockN, blockCb) {
      var start = Date.now();
      rpc.getBlockByHeight(blockN, function(err, block){
        if (err){
          return blockCb(err);
        }
        processBlock(block, blockN, function (err, transactions) {
          if (err) {
            return blockCb(err);
          }
          insertTransactions(transactions, function (err) {
            if (err) {
              return blockCb(err);
            }
            var end = Date.now();
            console.log('tx total:\t\t' + transactions.length);
            console.log('tx per second:\t\t' + (transactions.length / ((end - start) / 1000)).toFixed(2));
            blockTimes.push(end - start);
            blockTimes.shift();
            var avgBlockTime = _.reduce(_.compact(blockTimes), function (total, time) { return total + time; }, 0) / _.compact(blockTimes).length;
            if (!Number.isNaN(avgBlockTime)) {
              console.log('est hours left:\t\t' + ((chainTip.height - blockN) * avgBlockTime / 1000 / 60 / 60).toFixed(2));
            }
            console.log('added block:\t\t' + blockN);
            console.log('=========================================');
            blockCb(err);
          });
        });
      });
    }, function (err) {
      if (err){
        console.error(err);
      }
      console.log('done');
    });
  });
});

var Wallet = require('./lib/models/wallet');
var WalletAddress = require('./lib/models/walletAddress');

app.post('/wallet', function (req, res) {
  Wallet.create({ name: req.body.name }, function (err, result) {
    if (err) {
      res.status(500).send(err);
    }
    res.send(result);
  });
});

app.get('/wallet/:walletId', function(req, res){
  Wallet.findOne({_id: req.params.walletId}, function(err, wallet){
    if (err) {
      return res.status(500).send(err);
    }
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    res.send(wallet);
  });
});

app.get('/wallet/:walletId/addresses', function (req, res) {
  Wallet.findOne({ _id: req.params.walletId }, function (err, wallet) {
    if (err) {
      return res.status(500).send(err);
    }
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    var addressStream = WalletAddress.find({ wallet: wallet._id }, {address: true, _id:false}).cursor();
    addressStream.pipe(JSONStream.stringify()).pipe(res);
  });
});

app.post('/wallet/:walletId', function (req, res) {
  Wallet.findOne({_id: req.params.walletId}, function(err, wallet){
    if (err) {
      return res.status(500).send(err);
    }
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }

    var walletFile;
    try{
      walletFile = JSON.parse(req.body.toString());
    } catch (e){
      return res.status(500).send(err);
    }


    var walletUpdates = walletFile.addresses.map(function (address) {
      return {
        updateOne: {
          filter: { wallet: wallet._id, address: address.address },
          update: { wallet: wallet._id, address: address.address },
          upsert: true
        }
      };
    });
    var transactionUpdates = walletFile.addresses.map(function (address) {
      return {
        updateMany: {
          filter: { $or: [{ 'inputs.address': address.address }, { 'outputs.address': address.address }] },
          update: { $addToSet: { wallets: wallet._id } }
        }
      };
    });
    WalletAddress.bulkWrite(walletUpdates, { ordered: false }, function (err) {
      if (err) {
        return res.status(500).send(err);
      }
      Transaction.bulkWrite(transactionUpdates, {ordered:false}, function (err) {
        if (err) {
          return res.status(500).send(err);
        }
        res.send({ success: true });
      });
    });
  });
});

app.get('/wallet/:walletId/transactions', function (req, res) {
  Wallet.findOne({ _id: req.params.walletId }, function (err, wallet) {
    if (err) {
      return res.status(500).send(err);
    }
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    var transactionStream = Transaction.find({ wallets: wallet._id }, {txid:true}).cursor();
    transactionStream.pipe(JSONStream.stringify()).pipe(res);
  });
});

app.listen(3000, function () {
  console.log('api server listening on port 3000!');
});



