var _ = require('lodash');

var SHARED_INDEX = 0x80000000 - 1;

function AddressManager() {
  this.version = '1.0.0';
};

AddressManager.create = function(opts) {
  opts = opts || {};

  var x = new AddressManager();

  x.receiveAddressIndex = 0;
  x.changeAddressIndex = 0;
  x.copayerIndex = (opts && _.isNumber(opts.copayerIndex)) ? opts.copayerIndex : SHARED_INDEX;

  return x;
};


AddressManager.fromObj = function(obj) {
  var x = new AddressManager();

  x.receiveAddressIndex = obj.receiveAddressIndex;
  x.changeAddressIndex = obj.changeAddressIndex;
  x.copayerIndex = obj.copayerIndex;

  return x;
};


AddressManager.prototype._incrementIndex = function(isChange) {
  if (isChange) {
    this.changeAddressIndex++;
  } else {
    this.receiveAddressIndex++;
  }
};

AddressManager.prototype.getCurrentAddressPath = function(isChange) {
  return 'm/' +
    this.copayerIndex + '/' +
    (isChange ? 1 : 0) + '/' +
    (isChange ? this.changeAddressIndex : this.receiveAddressIndex);
};

AddressManager.prototype.getNewAddressPath = function(isChange) {
  var ret = this.getCurrentAddressPath(isChange);
  this._incrementIndex(isChange);
  return ret;
};

module.exports = AddressManager;
