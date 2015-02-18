var _ = require('lodash');
var HDPath = require('../hdpath');

function AddressManager() {
  this.version = '1.0.0';
};

AddressManager.create = function(opts) {
  opts = opts || {};

  var x = new AddressManager();

  x.receiveAddressIndex = 0;
  x.changeAddressIndex = 0;
  x.copayerIndex = (opts && _.isNumber(opts.copayerIndex)) ? opts.copayerIndex : HDPath.SHARED_INDEX;

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
  return HDPath.Branch(isChange ? this.changeAddressIndex : this.receiveAddressIndex, isChange, this.copayerIndex);
};

AddressManager.prototype.getNewAddressPath = function(isChange) {
  var ret = this.getCurrentAddressPath(isChange);
  this._incrementIndex(isChange);
  return ret;
};

module.exports = AddressManager;
