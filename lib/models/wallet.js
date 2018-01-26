const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const WalletSchema = new Schema({
  name: String
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

module.exports = mongoose.model('Wallet', WalletSchema);