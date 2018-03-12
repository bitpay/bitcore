const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const WalletAddress = mongoose.model('WalletAddress');

const WalletSchema = new Schema({
  name: String,
  chain: String,
  network: String,
  singleAddress: Boolean,
  pubKey: String,
  path: String
});

WalletSchema.statics._apiTransform = function (wallet, options) {
  let transform = {
    name: wallet.name
  };
  if (options && options.object) {
    return transform;
  }
  return JSON.stringify(transform);
};

WalletSchema.statics.updateCoins = async function (wallet) {
  let addresses = await WalletAddress.find({wallet: wallet._id});
  return WalletAddress.updateCoins(wallet, addresses);
};

module.exports = mongoose.model('Wallet', WalletSchema);
