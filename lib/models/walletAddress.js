var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var WalletAddressSchema = new Schema({
  wallet: Schema.Types.ObjectId,
  address: String
});

WalletAddressSchema.index({address: 1, wallet: 1});

WalletAddressSchema.statics._apiTransform = function (walletAddress, options) {
  var transform = {
    address: walletAddress.address
  };
  if (options && options.object) {
    return transform;
  }
  return JSON.stringify(transform);
};


module.exports = mongoose.model('WalletAddress', WalletAddressSchema);