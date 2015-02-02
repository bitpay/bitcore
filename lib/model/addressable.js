var _ = require('lodash');
var HDPath = require('./hdpath');

function Addressable (opts) {
  this.receiveAddressIndex = 0;
  this.changeAddressIndex = 0;
  this.copayerIndex = ( opts && _.isNumber(opts.copayerIndex)) ? opts.copayerIndex : HDPath.SHARED_INDEX;
};


Addressable.prototype.fromObj = function (obj) {
  this.receiveAddressIndex = obj.receiveAddressIndex; 
  this.changeAddressIndex = obj.changeAddressIndex;
  this.copayerIndex = obj.copayerIndex;
};

Addressable.prototype.addAddress = function (isChange) {
  if (isChange) {
    this.changeAddressIndex++;
  } else {
    this.receiveAddressIndex++;
  }
};

Addressable.prototype.getCurrentAddressPath = function (isChange) {
  return HDPath.Branch(isChange  ? this.changeAddressIndex : this.receiveAddressIndex, isChange, this.copayerIndex);
};

Addressable.prototype.getNewAddressPath = function (isChange) {
  this.addAddress(isChange);
  return this.getCurrentAddressPath(isChange);
};

module.exports = Addressable;
