'use strict';
var cluster = require('cluster');
var numWorkers = require('os').cpus().length;
var maxPoolSize = 10;
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/fullNodePlus', {
  server: {
    socketOptions: {
      keepAlive: 120,
      socketTimeoutMS: 0,
      connectionTimeout: 0,
      noDelay: true
    },
    poolSize: maxPoolSize
  }
});
var Transaction = require('./lib/models/Transaction');
var Block = require('./lib/models/Block');
var WalletAddress = require('./lib/models/walletAddress');
var rpc = require('./lib/rpc');
var async = require('async');
var _ = require('underscore');
var express = require('express');
var bodyParser = require('body-parser');
var bitcore = require('bitcore-lib');
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.raw({limit: 100000000}));

var blockTimes = new Array(144);

function syncTransactionAndOutputs(data, callback) {
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

    async.eachOfLimit(transaction.outputs, maxPoolSize, function(output, index, outputCb) {
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

      WalletAddress.find({address: address}).lean().exec(function(err, wallets) {
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
          wallets: _.pluck(wallets, 'wallet')
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
}

function syncTransactionInputs(txid, callback) {
  Transaction.findOne({txid: txid}, function(err, transaction) {
    if(err) {
      return callback(err);
    }
    if(transaction.inputsProcessed) {
      return callback();
    }
    async.eachLimit(transaction.inputs, maxPoolSize, function(input, inputCb) {
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
}

var workers = [];
if(cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  _.times(numWorkers, function() {
    workers.push({worker: cluster.fork(), active: false});
  });
  cluster.on('exit', function(worker) {
    console.log(`worker ${worker.process.pid} died`);
  });
}
if(cluster.isWorker) {
  console.log(`Worker ${process.pid} started`);
  process.on('message', function(payload) {
    if(payload.task === 'syncTransactionAndOutputs') {
      syncTransactionAndOutputs(payload.argument, function(err) {
        process.send({error: err});
      });
    }
    if(payload.task === 'syncTransactionInputs') {
      syncTransactionInputs(payload.argument, function(err) {
        process.send({error: err});
      });
    }
  });
}


function processBlock(block, height, callback) {
  block = new bitcore.Block.fromString(block);
  var blockTime = block.header.time * 1000;
  var blockTimeNormalized;
  var start = Date.now();
  async.series([
    function(cb) {
      Block.findOne({hash: block.header.prevHash}, function(err, previousBlock) {
        if(err) {
          return cb(err);
        }
        blockTimeNormalized = blockTime;
        if(previousBlock && blockTime <= previousBlock.timeNormalized.getTime()) {
          blockTimeNormalized = previousBlock.blockTimeNormalized.getTime() + 1;
        }
        Block.update({hash: block.hash}, {
          mainChain: true,
          height: height,
          version: block.header.version,
          previousBlockHash: block.header.prevHash,
          merkleRoot: block.header.merkleRoot,
          time: new Date(blockTime),
          timeNormalized: new Date(blockTimeNormalized),
          bits: block.header.bits,
          nonce: block.header.nonce,
          transactionCount: block.transactions.length
        }, {upsert: true}, cb);
      });
    },
    function(cb) {
      async.eachLimit(block.transactions, numWorkers, function(transaction, txCb) {
        if(workers.length) {
          var worker = _.findWhere(workers, {active: false});
          worker.worker.once('message', function(result) {
            worker.active = false;
            txCb(result.error);
          });
          worker.active = true;
          worker.worker.send({
            task: 'syncTransactionAndOutputs',
            argument: {
              transaction: transaction,
              blockHeight: height,
              blockHash: block.hash,
              blockTime: blockTime,
              blockTimeNormalized: blockTimeNormalized
            }
          });
        } else {
          syncTransactionAndOutputs({
            transaction: transaction,
            blockHeight: height,
            blockHash: block.hash,
            blockTime: blockTime,
            blockTimeNormalized: blockTimeNormalized
          }, txCb);
        }
      }, cb);
    },
    function(cb) {
      async.eachLimit(block.transactions, numWorkers, function(transaction, txCb) {
        if(workers.length) {
          var worker = _.findWhere(workers, {active: false});
          worker.worker.once('message', function(result) {
            worker.active = false;
            txCb(result.error);
          });
          worker.active = true;
          worker.worker.send({task: 'syncTransactionInputs', argument: transaction.hash});
        } else {
          syncTransactionInputs(transaction.hash, txCb);
        }

      }, cb);
    }
  ], function(err) {
    var end = Date.now();
    blockTimes.push(end - start);
    blockTimes.shift();
    console.log('Block Time:\t\t' + new Date(block.header.timestamp * 1000));
    console.log('tx count:\t\t' + block.transactions.length);
    console.log('tx/s :\t\t\t' + (block.transactions.length / (end - start) * 1000).toFixed(2));
    callback(err);
  });
}

function sync(done) {
  rpc.getChainTip(function(err, chainTip) {
    Block.find({}).limit(1).sort({height: -1}).exec(function(err, localTip) {
      if(err) {
        return done(err);
      }
      localTip = (localTip[0] && localTip[0].height) || 0;
      if(localTip >= chainTip.height - 6) {
        return done();
      }
      var targetHeight = chainTip.height - 6;
      async.eachSeries(_.range(localTip, targetHeight), function(blockN, blockCb) {
        rpc.getBlockByHeight(blockN, function(err, block) {
          if(err) {
            return blockCb(err);
          }
          processBlock(block, blockN, function(err) {
            if(err) {
              return blockCb(err);
            }
            var avgBlockTime = _.reduce(_.compact(blockTimes), function(total, time) {
              return total + time;
            }, 0) / _.compact(blockTimes).length;
            if(!Number.isNaN(avgBlockTime)) {
              console.log('est hours left:\t\t' +
                ((targetHeight - blockN) * avgBlockTime / 1000 / 60 / 60).toFixed(2));
            }
            console.log('added block:\t\t' + blockN);
            console.log('===============================================================');

            blockCb(err);
          });
        });
      }, function(err) {
        if(err) {
          console.error('Syncing failed: ' + err);
          return done(err);
        }
        console.log('Sync completed');
        done();
      });
    });
  });
}

if(cluster.isMaster) {
  sync(function() {
    setTimeout(function() {
      sync(function() {});
    }, 60000);
  });
}

if(cluster.isMaster) { // this should later be cluster.isWorker
  var router = require('./lib/routes');
  app.use(router);
  app.listen(3000, function() {
    console.log('api server listening on port 3000!');
  });
}