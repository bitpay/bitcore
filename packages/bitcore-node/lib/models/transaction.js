const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const config = require('../config');
const Chain = require('../chain');
const Coin = mongoose.model('Coin');
const WalletAddress = mongoose.model('WalletAddress');

const TransactionSchema = new Schema({
  txid: String,
  chain: String,
  network: String,
  blockHeight: Number,
  blockHash: String,
  blockTime: Date,
  blockTimeNormalized: Date,
  coinbase: Boolean,
  fee: Number,
  size: Number,
  locktime: Number,
  wallets: { type: [Schema.Types.ObjectId] }
});

TransactionSchema.index({ txid: 1 });
TransactionSchema.index({ chain: 1, network: 1, blockHeight: 1 });
TransactionSchema.index({ blockHash: 1 });
TransactionSchema.index({ chain: 1, network: 1, blockTimeNormalized: 1 });
TransactionSchema.index({ wallets: 1 }, { sparse: true });

TransactionSchema.statics.batchImport = async function(params) {
  return new Promise(async resolve => {
    let partition = (array, n) => {
      return array.length
        ? [array.splice(0, n)].concat(partition(array, n))
        : [];
    };
    let mintOps = await Transaction.mintCoins(params);
    if (mintOps.length) {
      mintOps = partition(mintOps, 100);
      mintOps = mintOps.map(mintBatch =>
        Coin.collection.bulkWrite(mintBatch, { ordered: false })
      );
      await Promise.all(mintOps);
    }

    let spendOps = Transaction.spendCoins(params);
    if (spendOps.length) {
      spendOps = partition(spendOps, 100);
      spendOps = spendOps.map(spendBatch =>
        Coin.collection.bulkWrite(spendBatch, { ordered: false })
      );
      await Promise.all(spendOps);
    }

    let txOps = await Transaction.addTransactions(params);
    txOps = partition(txOps, 100);
    txOps = txOps.map(txBatch =>
      Transaction.collection.bulkWrite(txBatch, { ordered: false })
    );
    await Promise.all(txOps);
    resolve();
  });
};

TransactionSchema.statics.addTransactions = async function(params) {
  let {
    blockHash,
    blockTime,
    blockTimeNormalized,
    chain,
    height,
    network,
    txs
  } = params;
  return new Promise(async (resolve, reject) => {
    let txids = txs.map(tx => tx._hash);
    let mintWallets, spentWallets;
    try {
      mintWallets = await Coin.collection
        .aggregate([
          {
            $match: { mintTxid: { $in: txids }, chain, network }
          },
          { $unwind: '$wallets' },
          { $group: { _id: '$mintTxid', wallets: { $addToSet: '$wallets' } } }
        ])
        .toArray();
      spentWallets = await Coin.collection
        .aggregate([
          {
            $match: { spentTxid: { $in: txids }, chain, network }
          },
          { $unwind: '$wallets' },
          { $group: { _id: '$spentTxid', wallets: { $addToSet: '$wallets' } } }
        ])
        .toArray();
    } catch (e) {
      reject(e);
    }

    let txOps = txs.map((tx, index) => {
      let wallets = [];
      for (let wallet of mintWallets
        .concat(spentWallets)
        .filter(wallet => wallet._id === txids[index])) {
        for (let walletMatch of wallet.wallets) {
          if (
            !wallets.find(
              wallet => wallet.toHexString() === walletMatch.toHexString()
            )
          ) {
            wallets.push(walletMatch);
          }
        }
      }

      return {
        updateOne: {
          filter: {
            txid: txids[index],
            chain,
            network
          },
          update: {
            $set: {
              chain,
              network,
              blockHeight: height,
              blockHash,
              blockTime,
              blockTimeNormalized,
              coinbase: tx.isCoinbase(),
              size: tx.toBuffer().length,
              locktime: tx.nLockTime,
              wallets
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

TransactionSchema.statics.mintCoins = async function(params) {
  return new Promise(async (resolve, reject) => {
    let { chain, height, network, txs, parentChain, forkHeight } = params;
    let mintOps = [];
    let parentChainCoins = [];
    if (parentChain && height < forkHeight) {
      parentChainCoins = await Coin.find({
        chain: parentChain,
        network,
        mintHeight: height,
        spentHeight: { $gt: -2, $lt: forkHeight }
      }).lean();
    }
    for (let tx of txs) {
      tx._hash = tx.hash;
      let txid = tx._hash;
      let isCoinbase = tx.isCoinbase();
      for (let [index, output] of tx.outputs.entries()) {
        let parentChainCoin = parentChainCoins.find(
          parentChainCoin =>
            parentChainCoin.mintTxid === txid &&
            parentChainCoin.mintIndex === index
        );
        if (parentChainCoin) {
          continue;
        }
        let address = '';
        let scriptBuffer = output.script && output.script.toBuffer();
        if (scriptBuffer) {
          address = output.script.toAddress(network).toString(true);
          if (
            address === 'false' &&
            output.script.classify() === 'Pay to public key'
          ) {
            let hash = Chain[chain].lib.crypto.Hash.sha256ripemd160(
              output.script.chunks[0].buf
            );
            address = Chain[chain].lib.Address(hash, network).toString(true);
          }
        }

        mintOps.push({
          updateOne: {
            filter: {
              mintTxid: txid,
              mintIndex: index,
              spentHeight: { $lt: 0 },
              chain,
              network
            },
            update: {
              $set: {
                chain,
                network,
                mintHeight: height,
                coinbase: isCoinbase,
                value: output.satoshis,
                address,
                script: scriptBuffer,
                spentHeight: -2,
                wallets: []
              }
            },
            upsert: true,
            forceServerObjectId: true
          }
        });
      }
    }
    let mintOpsAddresses = mintOps.map(
      mintOp => mintOp.updateOne.update.$set.address
    );
    try {
      let wallets = await WalletAddress.collection
        .find(
          { address: { $in: mintOpsAddresses }, chain, network },
          { batchSize: 100 }
        )
        .toArray();
      if (wallets.length) {
        mintOps = mintOps.map(mintOp => {
          mintOp.updateOne.update.$set.wallets = wallets
            .filter(
              wallet => wallet.address === mintOp.updateOne.update.$set.address
            )
            .map(wallet => wallet.wallet);
          return mintOp;
        });
      }
      resolve(mintOps);
    } catch (e) {
      reject(e);
    }
  });
};

TransactionSchema.statics.spendCoins = function(params) {
  let { chain, network, height, txs, parentChain, forkHeight } = params;
  let spendOps = [];
  if (parentChain && height < forkHeight) {
    return spendOps;
  }
  for (let tx of txs) {
    if (tx.isCoinbase()) {
      continue;
    }
    let txid = tx._hash;
    for (let input of tx.inputs) {
      input = input.toObject();
      const updateQuery = {
        updateOne: {
          filter: {
            mintTxid: input.prevTxId,
            mintIndex: input.outputIndex,
            spentHeight: { $lt: 0 },
            chain,
            network
          },
          update: {
            $set: {
              spentTxid: txid,
              spentHeight: height
            }
          }
        }
      };
      if (config.pruneSpentScripts && height > 0) {
        updateQuery.updateOne.update.$unset = { script: null };
      }
      spendOps.push(updateQuery);
    }
  }
  return spendOps;
};

TransactionSchema.statics.getTransactions = function(params) {
  let query = params.query;
  return this.collection.aggregate([
    { $match: query },
    {
      $lookup: {
        from: 'coins',
        localField: 'txid',
        foreignField: 'spentTxid',
        as: 'inputs'
      }
    },
    {
      $lookup: {
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
    fee: tx.fee
  };
  if (options && options.object) {
    return transform;
  }
  return JSON.stringify(transform);
};

var Transaction = (module.exports = mongoose.model(
  'Transaction',
  TransactionSchema
));
