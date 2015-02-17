var _ = require('lodash');
var HDPath = require('../hdpath');

function AddressManager(opts) {
  this.receiveAddressIndex = 0;
  this.changeAddressIndex = 0;
  this.copayerIndex = (opts && _.isNumber(opts.copayerIndex)) ? opts.copayerIndex : HDPath.SHARED_INDEX;
};


AddressManager.fromObj = function (obj) {
  var x = new AddressManager();

  x.receiveAddressIndex = obj.receiveAddressIndex; 
  x.changeAddressIndex = obj.changeAddressIndex;
  x.copayerIndex = obj.copayerIndex;

  return x;
};

AddressManager.prototype._incrementIndex = function (isChange) {
  if (isChange) {
    this.changeAddressIndex++;
  } else {
    this.receiveAddressIndex++;
  }
};

AddressManager.prototype.getCurrentAddressPath = function (isChange) {
  return HDPath.Branch(isChange  ? this.changeAddressIndex : this.receiveAddressIndex, isChange, this.copayerIndex);
};

AddressManager.prototype.getNewAddressPath = function (isChange) {
  var ret = this.getCurrentAddressPath(isChange);
  this._incrementIndex(isChange);
  return ret;
};

module.exports = AddressManager;
