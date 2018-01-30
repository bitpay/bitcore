const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const async = require('async');
const bitcore = require('bitcore-lib');

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
  let mintOps = await this.mintCoins(params);
  let spendOps = this.spendCoins(params);
  let coinOps = mintOps.concat(spendOps);
  coinOps = partition(coinOps, 500);
  let txOps = await this.addTransactions(params);
  txOps = partition(txOps, 500);

  async.eachSeries(coinOps, async (coinBatch) => {
    await Coin.collection.bulkWrite(coinBatch, { ordered: true });
  }, function (err) {
    if (err) {
      return callback(err);
    }
    async.eachSeries(txOps, async (txBatch) => {
      await Transaction.collection.bulkWrite(txBatch, { ordered: true });
    }, callback);
  });
};

TransactionSchema.statics.addTransactions = async function(params){
  let { blockHash, blockTime, blockTimeNormalized, height, network, txs } = params;
  let txOps = [];
  for (let tx of txs){
    let wallets = await Coin.aggregate([
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
    ]);
    if (wallets.length) {
      wallets = wallets[0].wallets;
    }
    txOps.push({
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
    });
  }

  return txOps;
};

TransactionSchema.statics.mintCoins = async function (params) {
  let { height, network, txs } = params;
  let mintOps = [];
  for (let tx of txs) {
    for (let index = 0; index < tx.outputs.length; index++) {
      let address;
      try {
        address = tx.outputs[index].script.toAddress(network).toString();
        if (address === 'false' && tx.outputs[index].script.classify() === 'Pay to public key') {
          let hash = bitcore.crypto.Hash.sha256ripemd160(tx.outputs[index].script.chunks[0].buf);
          address = bitcore.Address(hash, network).toString();
        }
      } catch (e) {
        address = 'noAddress';
      }
      let wallets = await mongoose.model('WalletAddress').find({ address: address }).lean().exec();
      wallets = wallets.map((wallet) => wallet.wallet);
      mintOps.push({
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
              value: tx.outputs[index].satoshis,
              address: address,
              script: tx.outputs[index].script && tx.outputs[index].script.toBuffer(),
              spentHeight: -2,
              wallets: wallets
            }
          },
          upsert: true
        }
      });
    }
  }
  return mintOps;
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