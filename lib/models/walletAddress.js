const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Coin = mongoose.model('Coin');
const Transaction = mongoose.model('Transaction');

const WalletAddressSchema = new Schema({
  wallet: Schema.Types.ObjectId,
  address: String,
  chain: String,
  network: String
});

WalletAddressSchema.index({address: 1, wallet: 1});

WalletAddressSchema.statics._apiTransform = function (walletAddress, options) {
  let transform = {
    address: walletAddress.address
  };
  if (options && options.object) {
    return transform;
  }
  return JSON.stringify(transform);
};

WalletAddressSchema.statics.updateCoins = async function (wallet, addresses) {
  let partition = (array, n) => {
    return array.length ? [array.splice(0, n)].concat(partition(array, n)) : [];
  };

  let walletUpdateBatches = addresses.map((address) => {
    return {
      updateOne: {
        filter: { wallet: wallet._id, address: address },
        update: { wallet: wallet._id, address: address },
        upsert: true
      }
    };
  });

  walletUpdateBatches = partition(walletUpdateBatches, 500);
  let coinUpdateBatches = addresses.map((address) => {
    return {
      updateMany: {
        filter: { chain: wallet.chain, network: wallet.network, address: address },
        update: {
          $addToSet: { wallets: wallet._id }
        }
      }
    };
  });
  coinUpdateBatches = partition(coinUpdateBatches, 500);

  return new Promise(async (resolve) => {
    await Promise.all(walletUpdateBatches.map((walletUpdateBatch) => {
      return WalletAddressSchema.bulkWrite(walletUpdateBatch, { ordered: false });
    }));

    await Promise.all(coinUpdateBatches.map((coinUpdateBatch) => {
      return Coin.collection.bulkWrite(coinUpdateBatch, { ordered: false });
    }));

    let coinCursor = Coin.find({ wallets: wallet._id }, { spentTxid: 1, mintTxid: 1}).cursor();

    coinCursor.on('data', function(data){
      coinCursor.pause();
      Transaction.update({chain: wallet.chain, network: wallet.network, txid: {$in: [data.spentTxid, data.mintTxid]}}, {
        $addToSet: { wallets: wallet._id }
      }, { multi: true }, function(){
        // TODO Error handling if update fails?
        coinCursor.resume();
      });
    });

    coinCursor.on('end', function(){
      resolve();
    });
  });
};



module.exports = mongoose.model('WalletAddress', WalletAddressSchema);
