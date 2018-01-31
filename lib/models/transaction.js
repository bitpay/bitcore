const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const async = require('async');
const bitcore = require('bitcore-lib');

const config = require('../config');
const Coin = mongoose.model('Coin');

const TransactionSchema = new Schema({
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
TransactionSchema.index({blockTimeNormalized: 1});
TransactionSchema.index({wallets: 1}, {sparse: true});

TransactionSchema.statics.batchImport = async function (params, callback) {
  let partition = (array, n) => {
    return array.length ? [array.splice(0, n)].concat(partition(array, n)) : [];
  };

  async.series([
    function(cb){
      Transaction.mintCoins(params, async (err, mintOps) => {
        mintOps = partition(mintOps, 500);
        async.each(mintOps, async (mintBatch) => {
          await Coin.collection.bulkWrite(mintBatch, { ordered: false });
        }, cb);
      }, cb);
    },
    function(cb){
      let spendOps = Transaction.spendCoins(params);
      spendOps = partition(spendOps, 500);
      async.each(spendOps, async (spendBatch) => {
        await Coin.collection.bulkWrite(spendBatch, { ordered: false });
      }, cb);
    },
    async function(cb){
      Transaction.addTransactions(params, (err, txOps) => {
        txOps = partition(txOps, 500);
        async.each(txOps, async (txBatch) => {
          await Transaction.collection.bulkWrite(txBatch, { ordered: false });
        }, cb);
      }, cb);
    }
  ], callback);
};

TransactionSchema.statics.addTransactions = function(params, callback){
  let { blockHash, blockTime, blockTimeNormalized, height, network, txs } = params;
  async.mapLimit(txs, config.maxPoolSize, (tx, cb) => {
    Coin.aggregate([
      {
        $match: {
          $or: [
            { spentTxid: tx.hash },
            { mintTxid: tx.hash }
          ]
        }
      },
      { $unwind: '$wallets' },
      { $group: { _id: null, wallets: { $addToSet: '$wallets' } } },
      { $project: { _id: false } }
    ], (err, wallets) => {
      if (err){
        return cb(err);
      }
      if (wallets.length) {
        wallets = wallets[0].wallets;
      }
      let op = {
        updateOne: {
          filter: {
            txid: tx.hash
          },
          update: {
            $set: {
              network: network,
              blockHeight: height,
              blockHash: blockHash,
              blockTime: blockTime,
              blockTimeNormalized: blockTimeNormalized,
              coinbase: tx.isCoinbase(),
              size: tx.toBuffer().length,
              locktime: tx.nLockTime,
              wallets: wallets
            }
          },
          upsert: true
        }
      };
      cb(null, op);
    });
  }, (err, txOps) => {
    callback(err, txOps);
  });
};

TransactionSchema.statics.mintCoins = async function (params, callback) {
  let { height, network, txs } = params;
  let mintOps = [];
  async.eachLimit(txs, config.maxPoolSize, (tx, cb) => {
    async.eachOfLimit(tx.outputs, config.maxPoolSize, (output, index, cb) => {
      let address;
      try {
        address = output.script.toAddress(network).toString();
        if (address === 'false' && output.script.classify() === 'Pay to public key') {
          let hash = bitcore.crypto.Hash.sha256ripemd160(output.script.chunks[0].buf);
          address = bitcore.Address(hash, network).toString();
        }
      } catch (e) {
        address = 'noAddress';
      }
      mongoose.model('WalletAddress').find({ address: address }).lean().exec((err, wallets) => {
        if (err){
          return cb(err);
        }
        wallets = wallets.map((wallet) => wallet.wallet);
        let op = {
          updateOne: {
            filter: {
              mintTxid: tx.hash,
              mintIndex: index
            },
            update: {
              $set: {
                network: network,
                mintHeight: height,
                coinbase: tx.isCoinbase(),
                value: output.satoshis,
                address: address,
                script: output.script && output.script.toBuffer(),
                spentHeight: -2,
                wallets: wallets
              }
            },
            upsert: true
          }
        };
        mintOps.push(op);
        cb();
      });
    }, cb);
  }, (err) => {
    callback(err, mintOps);
  });
};

TransactionSchema.statics.spendCoins = function (params) {
  let { height, txs } = params;
  let spendOps = [];
  for (let tx of txs) {
    if (tx.isCoinbase()) {
      continue;
    }
    for (let input of tx.inputs) {
      input = input.toObject();
      spendOps.push({
        updateOne: {
          filter: {
            mintTxid: input.prevTxId,
            mintIndex: input.outputIndex,
            spentHeight: { $lt: 0 }
          },
          update: {
            $set: {
              spentTxid: tx.hash,
              spentHeight: height
            }
          }
        }
      });
    }
  }
  return spendOps;
};

TransactionSchema.statics.getTransactions = function (params) {
  let query = params.query;
  return this.collection.aggregate([
    { $match: query },
    {
      $lookup:
        {
          from: 'coins',
          localField: 'txid',
          foreignField: 'spentTxid',
          as: 'inputs'
        }
    },
    {
      $lookup:
        {
          from: 'coins',
          localField: 'txid',
          foreignField: 'mintTxid',
          as: 'outputs'
        }
    }
  ]);
};

TransactionSchema.statics._apiTransform = function(tx, options) {
  let transform = {
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