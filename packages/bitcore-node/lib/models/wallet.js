const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const WalletSchema = new Schema({
  name: String,
  chain: String,
  network: String,
  singleAddress: Boolean,
  pubKey: String,
  path: String
});

WalletSchema.index({ pubKey: 1 });

WalletSchema.statics._apiTransform = function (wallet, options) {
  let transform = {
    name: wallet.name,
    pubKey: wallet.pubKey
  };
  if (options && options.object) {
    return transform;
  }
  return JSON.stringify(transform);
};

WalletSchema.statics.updateCoins = async function (wallet) {
  const WalletAddress = mongoose.model('WalletAddress');
  let addresses = await WalletAddress.find({wallet: wallet._id});
  return WalletAddress.updateCoins({wallet, addresses});
};

module.exports = mongoose.model('Wallet', WalletSchema);
