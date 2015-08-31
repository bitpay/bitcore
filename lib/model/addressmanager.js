var _ = require('lodash');
var $ = require('preconditions').singleton();

var WalletUtils = require('bitcore-wallet-utils');

var SHARED_INDEX = 0x80000000 - 1;

function AddressManager() {};

AddressManager.create = function(opts) {
  opts = opts || {};

  var x = new AddressManager();

  x.version = 2;
  x.derivationStrategy = opts.derivationStrategy || WalletUtils.DERIVATION_STRATEGIES.BIP44;
  $.checkState(_.contains(_.values(WalletUtils.DERIVATION_STRATEGIES), x.derivationStrategy));

  x.receiveAddressIndex = 0;
  x.changeAddressIndex = 0;
  x.copayerIndex = (opts && _.isNumber(opts.copayerIndex)) ? opts.copayerIndex : SHARED_INDEX;

  return x;
};

AddressManager.fromObj = function(obj) {
  var x = new AddressManager();

  x.version = obj.version;
  x.derivationStrategy = obj.derivationStrategy || WalletUtils.DERIVATION_STRATEGIES.BIP45;
  x.receiveAddressIndex = obj.receiveAddressIndex;
  x.changeAddressIndex = obj.changeAddressIndex;
  x.copayerIndex = obj.copayerIndex;

  return x;
};

AddressManager.prototype.supportsDerivation = function() {
  // BIP44 does not support copayer specific indexes
  return !(this.derivationStrategy == WalletUtils.DERIVATION_STRATEGIES.BIP44 && this.copayerIndex != SHARED_INDEX);
};

AddressManager.prototype._incrementIndex = function(isChange) {
  if (isChange) {
    this.changeAddressIndex++;
  } else {
    this.receiveAddressIndex++;
  }
};

AddressManager.prototype.rewindIndex = function(isChange, n) {
  n = _.isUndefined(n) ? 1 : n;
  if (isChange) {
    this.changeAddressIndex = Math.max(0, this.changeAddressIndex - n);
  } else {
    this.receiveAddressIndex = Math.max(0, this.receiveAddressIndex - n);
  }
};

AddressManager.prototype.getCurrentAddressPath = function(isChange) {
  return 'm/' +
    (this.derivationStrategy == WalletUtils.DERIVATION_STRATEGIES.BIP45 ? this.copayerIndex + '/' : '') +
    (isChange ? 1 : 0) + '/' +
    (isChange ? this.changeAddressIndex : this.receiveAddressIndex);
};

AddressManager.prototype.getNewAddressPath = function(isChange) {
  var ret = this.getCurrentAddressPath(isChange);
  this._incrementIndex(isChange);
  return ret;
};

module.exports = AddressManager;
