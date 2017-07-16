'use strict';
var cluster = require('cluster');
var numWorkers = require('os').cpus().length - 1;
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/fullNodePlus');
var Transaction = require('./lib/models/Transaction');
var Wallet = require('./lib/models/wallet');
var WalletAddress = require('./lib/models/walletAddress');
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

var blockTimes = new Array(144);

function syncTransactionAndOutputs(data, callback){
  var transaction = data.transaction;
  Transaction.findOne({txid: transaction.hash}, function(err, hasTx){
    if (err){
      return callback(err);
    }
    if (hasTx){
      return callback();
    }

    var newTx = { inputs: [], outputs: [], wallets: [] };
    newTx.blockHeight = data.blockHeight;
    newTx.blockHash = data.blockHash;
    newTx.txid = transaction.hash;

    async.eachOfLimit(transaction.outputs, 4, function(output, index, outputCb){
      var script;
      var address;
      try {
        script = new bitcore.Script(output.script);
        address = script.toAddress('livenet').toString();
        if (address === 'false' && script.classify() === 'Pay to public key') {
          var hash = bitcore.crypto.Hash.sha256ripemd160(script.chunks[0].buf);
          address = bitcore.Address(hash, bitcore.Networks.livenet).toString();
        }
      } catch (e){
        address = 'noAddress';
      }

      WalletAddress.find({ address: address }, function (err, wallets) {
        if (err) {
          return outputCb(err);
        }

        newTx.outputs.push({
          vout: index,
          amount: parseFloat((output.satoshis * 1e-8).toFixed(8)),
          address: address,
          wallets: _.pluck(wallets, 'wallet')
        });
        outputCb();
      });
    }, function(err){
      if (err){
        return callback(err);
      }
      // Coinbase
      if (transaction.inputs[0].prevTxId.toString('hex') === '0000000000000000000000000000000000000000000000000000000000000000') {
        newTx.coinbase = true;
        newTx.inputs.push({
          amount: _.reduce(newTx.outputs, function (total, output) { return total + output.amount; }, 0)
        });
        newTx.inputsProcessed = true;
      } else {
        transaction.inputs.forEach(function (input) {
          var prevTxId = input.prevTxId.toString('hex');
          newTx.inputs.push({
            utxo: prevTxId,
            vout: input.outputIndex
          });
        });
        newTx.inputsProcessed = false;
      }
      Transaction.create(newTx, callback);
    });
  });
}

function syncTransactionInputs(txid, callback){
  Transaction.findOne({txid: txid}, function(err, transaction){
    if (err){
      return callback(err);
    }
    async.eachLimit(transaction.inputs, 1, function(input, inputCb){
      if (transaction.inputsProcessed) {
        return inputCb();
      }
      Transaction.findOne({txid: input.utxo}, function(err, utxo){
        if (err) {
          return inputCb(err);
        }
        if (!utxo){
          return callback(new Error('Couldnt find utxo'));
        }
        utxo = _.findWhere(utxo.outputs, {vout:input.vout});
        input.address = utxo.address;
        input.amount = parseFloat(utxo.amount.toFixed(8));
        if (!input.address){
          inputCb();
        }
        WalletAddress.find({address: input.address}, function(err, wallets){
          if (err){
            return inputCb(err);
          }
          input.wallets = _.pluck(wallets, 'wallet');
          inputCb();
        });
      });
    }, function(err){
      if (err){
        return callback(err);
      }
      var totalInputs = _.reduce(transaction.inputs, function (total, input) { return total + input.amount; }, 0);
      var totalOutputs = _.reduce(transaction.outputs, function (total, output) { return total + output.amount; }, 0);
      transaction.fee = parseFloat((totalInputs - totalOutputs).toFixed(8));
      if (transaction.fee < 0){
        return callback('Fee is negative, something is really wrong');
      }
      transaction.inputsProcessed = true;
      transaction.save(callback);
    });
  });
}

var workers = [];
if (cluster.isMaster){
  console.log(`Master ${process.pid} is running`);
  _.times(numWorkers, function(){
    workers.push({ worker: cluster.fork(), active: false });
  });
  cluster.on('exit', function(worker) {
    console.log(`worker ${worker.process.pid} died`);
  });
}
if (cluster.isWorker) {
  console.log(`Worker ${process.pid} started`);
  process.on('message', function(payload){
    if (payload.task === 'syncTransactionAndOutputs') {
      syncTransactionAndOutputs(payload.argument, function (err) {
        process.send({error:err});
      });
    }
    if (payload.task === 'syncTransactionInputs') {
      syncTransactionInputs(payload.argument, function (err) {
        process.send({error:err});
      });
    }
  });
}


function processBlock(block, height, callback){
  block = new bitcore.Block.fromString(block);
  var start = Date.now();
  async.series([
    function(cb){
      async.eachLimit(block.transactions, numWorkers, function (transaction, txCb) {
        if (workers.length){
          var worker = _.findWhere(workers, { active: false });
          worker.worker.once('message', function (result) {
            worker.active = false;
            txCb(result.error);
          });
          worker.active = true;
          worker.worker.send({
            task: 'syncTransactionAndOutputs',
            argument: {
              transaction: transaction,
              blockHeight: height, blockHash: block.hash
            }
          });
        } else {
          syncTransactionAndOutputs({transaction:transaction, blockHeight:height, blockHash:block.hash}, txCb);
        }
      }, cb);
    },
    function (cb) {
      async.eachLimit(block.transactions, numWorkers, function (transaction, txCb) {
        if (workers.length){
          var worker = _.findWhere(workers, { active: false });
          worker.worker.once('message', function (result) {
            worker.active = false;
            txCb(result.error);
          });
          worker.active = true;
          worker.worker.send({ task: 'syncTransactionInputs', argument: transaction.hash });
        } else {
          syncTransactionInputs(transaction.hash,txCb);
        }

      }, cb);
    }
  ] , function(err){
    var end = Date.now();
    blockTimes.push(end - start);
    blockTimes.shift();
    console.log('Block Time:\t\t' + new Date(block.header.timestamp * 1000));
    console.log('tx count:\t\t' + block.transactions.length);
    console.log('tx/s :\t\t\t' + (block.transactions.length / (end - start) * 1000).toFixed(2));
    callback(err);
  });
}

function sync(done){
  rpc.getChainTip(function (err, chainTip) {
    Transaction.find({}).limit(1).sort({ blockHeight: -1 }).exec(function (err, localTip) {
      if (err) {
        return done(err);
      }
      localTip = (localTip[0] && localTip[0].blockHeight) || 0;
      async.eachSeries(_.range(localTip, chainTip.height), function (blockN, blockCb) {
        rpc.getBlockByHeight(blockN, function (err, block) {
          if (err) {
            return blockCb(err);
          }
          processBlock(block, blockN, function (err) {
            if (err) {
              return blockCb(err);
            }
            var avgBlockTime = _.reduce(_.compact(blockTimes), function (total, time) {
              return total + time;
            }, 0) / _.compact(blockTimes).length;
            if (!Number.isNaN(avgBlockTime)) {
              console.log('est hours left:\t\t' +
                ((chainTip.height - blockN) * avgBlockTime / 1000 / 60 / 60).toFixed(2));
            }
            console.log('added block:\t\t' + blockN);
            console.log('===============================================================');

            blockCb(err);
          });
        });
      }, function (err) {
        if (err) {
          console.error(err);
          return done(err);
        }
        console.log('done');
        done();
      });
    });
  });
};

if (cluster.isMaster) {
  sync(function(err){
    if (err){
      console.error('Syncing failed: ' + err);
    }
    console.log('Syncing finished successfully');
  });
}

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
    var transactionInputUpdates = walletFile.addresses.map(function (address) {
      return {
        updateMany: {
          filter: { 'inputs.address': address.address },
          update: {
            $addToSet: { 'inputs.$.wallets': wallet._id }
          }
        }
      };
    });
    var transactionOutputUpdates = walletFile.addresses.map(function (address) {
      return {
        updateMany: {
          filter: { 'outputs.address': address.address },
          update: {
            $addToSet: { 'outputs.$.wallets': wallet._id }
          }
        }
      };
    });

    WalletAddress.bulkWrite(walletUpdates, { ordered: false }, function (err) {
      if (err) {
        return res.status(500).send(err);
      }
      Transaction.bulkWrite(transactionInputUpdates, {ordered:false}, function (err, result) {
        if (err) {
          console.error(err);
        }
        console.log('Imported ' + result.nModified + ' input wallet txs');
        Transaction.bulkWrite(transactionOutputUpdates, { ordered: false }, function (err, result) {
          if (err){
            console.error(err);
          }
          console.log('Imported ' + result.nModified + ' output wallet txs');
        });

      });
      res.send({ success: true });
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

if (cluster.isWorker){
  app.listen(3000, function () {
    console.log('api server listening on port 3000!');
  });
}




