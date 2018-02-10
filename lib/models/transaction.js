const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const async = require('async');
const bitcore = require('bitcore-lib');

const Coin = mongoose.model('Coin');
const WalletAddress = mongoose.model('WalletAddress');
const workerService = require('../services/worker');

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
    let partition = (array, n) => {
      return array.length ? [array.splice(0, n)].concat(partition(array, n)) : [];
    };

    async.eachLimit(params.txs, 8, async function(tx, cb){
      let mintParams = params;
      mintParams.tx = tx;
      try {
        await workerService.sendTask('mintCoins', mintParams);
      } catch (e){
        return cb(e);
      }
      cb();
    }, async function(){
      let spendOps = Transaction.spendCoins(params);
      if (spendOps.length) {
        spendOps = partition(spendOps, 100);
        spendOps = spendOps.map((spendBatch) => Coin.collection.bulkWrite(spendBatch, { ordered: false }));
        await Promise.all(spendOps);
      }

      let txOps = await Transaction.addTransactions(params);
      txOps = partition(txOps, 100);
      txOps = txOps.map((txBatch) => Transaction.collection.bulkWrite(txBatch, { ordered: false }));
      await Promise.all(txOps);
      resolve();
    });
  });
};

TransactionSchema.statics.addTransactions = async function(params){
  let { blockHash, blockTime, blockTimeNormalized, height, network, txs } = params;
  return new Promise(async (resolve) => {
    let txids = txs.map((tx) => tx.hash);
    let mintWallets = await Coin.collection.aggregate([
      {
        $match: { mintTxid: {$in: txids} }
      },
      { $unwind: '$wallets' },
      { $group: { _id: '$mintTxid', wallets: { $addToSet: '$wallets' } } }
    ]).toArray();
    let spentWallets = await Coin.collection.aggregate([
      {
        $match: { spentTxid: { $in: txids } }
      },
      { $unwind: '$wallets' },
      { $group: { _id: '$spentTxid', wallets: { $addToSet: '$wallets' } } }
    ]).toArray();

    let txOps = txs.map((tx) => {
      let wallets = [];
      for (let wallet of mintWallets.concat(spentWallets).filter((wallet) => wallet._id === tx.hash)){
        for (let walletMatch of wallet.wallets){
          if (!wallets.find((wallet) => wallet.toHexString() === walletMatch.toHexString())){
            wallets.push(walletMatch);
          }
        }
      }

      return {
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
          upsert: true,
          forceServerObjectId: true
        }
      };
    });
    resolve(txOps);
  });
};

TransactionSchema.statics.mintCoins = async function (params) {
  let { height, network, tx } = params;
  tx = bitcore.Transaction(tx);
  let mintOps = [];
  for (let [index, output] of tx.outputs.entries()) {
    let address;
    let scriptBuffer = output.script && output.script.toBuffer();
    try {
      address = output.script.toAddress(network).toString();
      if (address === 'false' && output.script.classify() === 'Pay to public key') {
        let hash = bitcore.crypto.Hash.sha256ripemd160(output.script.chunks[0].buf);
        address = bitcore.Address(hash, network).toString();
      }
    } catch (e) {
      address = 'noAddress';
    }
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
            script: scriptBuffer,
            spentHeight: -2,
            wallets: []
          }
        },
        upsert: true,
        forceServerObjectId: true
      }
    };
    mintOps.push(op);
  }
  let mintOpsAddresses = mintOps.map((mintOp) => mintOp.updateOne.update.$set.address);
  let wallets = await WalletAddress.collection.find({ address: { $in: mintOpsAddresses } }, { batchSize: 100}).toArray();
  if (wallets.length){
    mintOps = mintOps.map((mintOp) => {
      mintOp.updateOne.update.$set.wallets = wallets.filter((wallet) => wallet.address === mintOp.updateOne.update.$set.address).map((wallet) => wallet.wallet);
      return mintOp;
    });
  }
  await Coin.collection.bulkWrite(mintOps, { ordered: false });
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