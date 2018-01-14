var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var WalletSchema = new Schema({
  name: String
});

WalletSchema.statics._apiTransform = function (wallet, options) {
  var transform = {
    name: wallet.name
  };
  if (options && options.object) {
    return transform;
  }
  return JSON.stringify(transform);
};

module.exports = mongoose.model('Wallet', WalletSchema);