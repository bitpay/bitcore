var _ = require('lodash');
var $ = require('preconditions').singleton();

var Constants = require('../common/constants');
var Utils = require('../common/utils');

function AddressManager() {};

AddressManager.create = function(opts) {
  opts = opts || {};

  var x = new AddressManager();

  x.version = 2;
  x.derivationStrategy = opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
  $.checkState(Utils.checkValueInCollection(x.derivationStrategy, Constants.DERIVATION_STRATEGIES));

  x.receiveAddressIndex = 0;
  x.changeAddressIndex = 0;
  x.copayerIndex = _.isNumber(opts.copayerIndex) ? opts.copayerIndex : Constants.BIP45_SHARED_INDEX;

  return x;
};

AddressManager.fromObj = function(obj) {
  var x = new AddressManager();

  x.version = obj.version;
  x.derivationStrategy = obj.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
  x.receiveAddressIndex = obj.receiveAddressIndex;
  x.changeAddressIndex = obj.changeAddressIndex;
  x.copayerIndex = obj.copayerIndex;

  return x;
};

AddressManager.supportsCopayerBranches = function(derivationStrategy) {
  return derivationStrategy == Constants.DERIVATION_STRATEGIES.BIP45;
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
    (this.derivationStrategy == Constants.DERIVATION_STRATEGIES.BIP45 ? this.copayerIndex + '/' : '') +
    (isChange ? 1 : 0) + '/' +
    (isChange ? this.changeAddressIndex : this.receiveAddressIndex);
};

AddressManager.prototype.getNewAddressPath = function(isChange) {
  var ret = this.getCurrentAddressPath(isChange);
  this._incrementIndex(isChange);
  return ret;
};

module.exports = AddressManager;
