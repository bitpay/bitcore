'use strict';

var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;

function Address() {};

Address.create = function(opts) {
  opts = opts || {};

  var x = new Address();

  x.version = '1.0.0';
  x.createdOn = Math.floor(Date.now() / 1000);
  x.address = opts.address;
  x.walletId = opts.walletId;
  x.isChange = opts.isChange;
  x.path = opts.path;
  x.publicKeys = opts.publicKeys;
  x.network = Bitcore.Address(x.address).toObject().network;
  x.type = opts.type || WalletUtils.SCRIPT_TYPES.P2SH;
  return x;
};

Address.fromObj = function(obj) {
  var x = new Address();

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.address = obj.address;
  x.walletId = obj.walletId;
  x.network = obj.network;
  x.isChange = obj.isChange;
  x.path = obj.path;
  x.publicKeys = obj.publicKeys;
  x.type = obj.type || WalletUtils.SCRIPT_TYPES.P2SH;
  return x;
};

module.exports = Address;
