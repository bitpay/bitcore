const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const async = require('async');
const bitcore = require('bitcore-lib');

const Coin = mongoose.model('Coin');
const WalletAddress = mongoose.model('WalletAddress');

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

TransactionSchema.statics.batchImport = async function (params) {
  return new Promise(async (resolve) => {
    let coinOps = await Transaction.mintCoins(params);
    coinOps.concat(Transaction.spendCoins(params));
    await Coin.collection.bulkWrite(coinOps, { ordered: true });

    let txOps = await Transaction.addTransactions(params);
    await Transaction.collection.bulkWrite(txOps);
    resolve();
  });
};

TransactionSchema.statics.addTransactions = function(params){
  let { blockHash, blockTime, blockTimeNormalized, height, network, txs } = params;
  return new Promise((resolve, reject) => {
    async.map(txs, async (tx) => {
      let wallets = await Coin.collection.aggregate([
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
      ]).toArray();
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
      return op;
    }, (err, txOps) => {
      if (err){
        reject(err);
      }
      resolve(txOps);
    });
  });
};

TransactionSchema.statics.mintCoins = async function (params) {
  let { height, network, txs } = params;
  let mintOps = [];
  return new Promise((resolve, reject) => {
    async.each(txs, (tx, cb) => {
      async.eachOf(tx.outputs, function(output, index, cb) {
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
      
        WalletAddress.find({address}, function(err, wallets){
          if (err){
            return cb(err);
          }
          wallets = wallets.map(wallet => wallet.wallet);
          let op = {
            updateOne: {
              filter: {
                mintTxid: tx.hash,
                mintIndex: index,
                spentHeight: { $lt: 0 }
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
      if (err){
        reject(err);
      }
      resolve(mintOps);
    });
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