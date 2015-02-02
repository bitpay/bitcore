'use strict';

function Address(opts) {
  opts = opts || {};

  this.createdOn = Math.floor(Date.now() / 1000);
  this.address = opts.address;
  this.path = opts.path;
};

Address.fromObj = function (obj) {
  var x = new Address();

  x.createdOn = obj.createdOn;
  x.address = obj.address;
  x.path = obj.path;
  return x;
};

module.exports = Address;
