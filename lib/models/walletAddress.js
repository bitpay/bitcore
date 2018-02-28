const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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


module.exports = mongoose.model('WalletAddress', WalletAddressSchema);