'use strict';

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/fullNodePlus');
var Transaction = require('./lib/models/Transaction');
var rpc = require('./lib/rpc');
var async = require('async');
var _ = require('underscore');

rpc.getChainTip(function(err, chainTip){
  Transaction.find({}).limit(1).sort({ blockHeight: -1 }).exec(function (err, localTip) {
    localTip = (localTip[0] && localTip[0].blockHeight) || 0;
    var blockTimes = new Array(72);
    async.eachSeries(_.range(localTip, chainTip.height), function (blockN, blockCb) {
      var start = Date.now();
      rpc.getBlockByHeight(blockN, function (err, block) {
        if (err) {
          console.error(err);
        }
        async.eachLimit(block.tx, 60, function (tx, txCb) {
          Transaction.count({ txid: tx, blockHeight: block.height, blockHash: block.hash }, function (err, count) {
            if (err) {
              console.error(err);
            }
            if (count) {
              return txCb();
            }
            rpc.getTransaction(tx, function (err, transaction) {
              if (err || !transaction) {
                console.error('Could not get tx:', tx);
                return txCb();
              }
              var newTx = new Transaction();
              newTx.txid = transaction.hash;
              newTx.blockHeight = block.height;
              newTx.blockHash = block.hash;

              transaction.vout.forEach(function (vout) {
                newTx.outputs.push({
                  vout: vout.n,
                  amount: vout.value,
                  address: vout.scriptPubKey.addresses && vout.scriptPubKey.addresses[0]
                });
              });

              async.eachLimit(transaction.vin, 16, function (input, inputCb) {
                if (input.coinbase) {
                  newTx.coinbase = true;
                  newTx.inputs.push({
                    amount: newTx.outputs[0].amount
                  });
                  return inputCb();
                }

                Transaction.findOne({ txid: input.txid }, function (err, inputTx) {
                  if (err) {
                    console.error(err);
                  }
                  if (err || !inputTx) {
                    return inputCb();
                  }
                  var utxo = _.findWhere(inputTx.outputs, { vout: input.vout });
                  if (!utxo) {
                    return inputCb();
                  }
                  newTx.inputs.push({
                    txid: input.txid,
                    vout: input.vout,
                    address: utxo.address,
                    amount: utxo.amount
                  });
                  inputCb();
                });
              }, function () {
                var totalInputs = _.reduce(newTx.inputs, function (total, input) { return total + input.amount; }, 0);
                var totalOutputs = _.reduce(newTx.outputs, function (total, output) { return total + output.amount; }, 0);
                newTx.fee = totalInputs - totalOutputs;
                // console.log('adding tx: ', tx);
                newTx.save(txCb);
              });
            });
          });
        }, function () {
          var end = Date.now();
          blockTimes.push(end-start);
          blockTimes.shift();
          var avgBlockTime = _.reduce(blockTimes, function (total, time) { return total + time; }, 0) / 72;
          if (!Number.isNaN(avgBlockTime)){
            console.log('Estimated hours left: ' + (chainTip.height - blockN) * avgBlockTime / 1000 / 60 / 60);
          }
          console.log('added block: ' + blockN + ' time ' + new Date(block.time * 1000) );
          blockCb();
        });
      });
    }, function () {
      console.log('done');
    });
  });
});




