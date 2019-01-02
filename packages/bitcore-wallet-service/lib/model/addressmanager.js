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
  x.skippedPaths = [];

  return x;
};

AddressManager.fromObj = function(obj) {
  var x = new AddressManager();

  x.version = obj.version;
  x.derivationStrategy = obj.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
  x.receiveAddressIndex = obj.receiveAddressIndex;
  x.changeAddressIndex = obj.changeAddressIndex;
  x.copayerIndex = obj.copayerIndex;

  // this is not stored, only temporary.
  x.skippedPaths = [];

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

AddressManager.prototype.rewindIndex = function(isChange, step, n) {
  step = _.isUndefined(step) ? 1 : step;
  n = _.isUndefined(n) ? 1 : n;
console.log('[addressmanager.js.65] BEFORE REWIND, ADDRESS SKIPPED/step/n', this.skippedPaths.length, step, n); //TODO
console.log('change/receive:', this.changeAddressIndex, this.receiveAddressIndex);



  if (isChange) {
    this.changeAddressIndex = Math.max(0, this.changeAddressIndex - n * step);
  } else {
    this.receiveAddressIndex = Math.max(0, this.receiveAddressIndex - n * step);
  }

  //clear skipppedPath, since index is rewinded
  // n address were actually derived.
  this.skippedPaths = this.skippedPaths.splice(0,this.skippedPaths.length - step * n + n);

console.log('[addressmanager.js.65] AFTER REWIND, ADDRESS SKIPPED/step/n', this.skippedPaths.length, step, n); //TODO
console.log('change/receive:', this.changeAddressIndex, this.receiveAddressIndex);
};

AddressManager.prototype.getCurrentIndex = function(isChange) {
  return isChange ? this.changeAddressIndex : this.receiveAddressIndex;
};


AddressManager.prototype.getBaseAddressPath = function(isChange) {
  return 'm/' +
    (this.derivationStrategy == Constants.DERIVATION_STRATEGIES.BIP45 ? this.copayerIndex + '/' : '') +
    (isChange ? 1 : 0) + '/' +
    0;
};

AddressManager.prototype.getCurrentAddressPath = function(isChange) {
  return 'm/' +
    (this.derivationStrategy == Constants.DERIVATION_STRATEGIES.BIP45 ? this.copayerIndex + '/' : '') +
    (isChange ? 1 : 0) + '/' +
    (isChange ? this.changeAddressIndex : this.receiveAddressIndex);
};

AddressManager.prototype.getNewAddressPath = function(isChange, step) {
  var ret;
  var i = 0;
  step = step || 1;

  while (i++ < step ) {
    if (ret) {
      this.skippedPaths.push({path:ret, isChange: isChange});
    }

    ret = this.getCurrentAddressPath(isChange);
    this._incrementIndex(isChange);
  }
  return ret;
};


AddressManager.prototype.getNextSkippedPath = function() {
  if (_.isEmpty(this.skippedPaths))
    return null;

  var ret = this.skippedPaths.pop();
  return ret;
};


module.exports = AddressManager;
