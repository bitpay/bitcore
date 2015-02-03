'use strict';

var Bitcore = require('bitcore');

function Address(opts) {
  opts = opts || {};

  this.createdOn = Math.floor(Date.now() / 1000);
  this.address = opts.address;
  this.path = opts.path;
  this.publicKeys = opts.publicKeys;
};

Address.fromObj = function (obj) {
  var x = new Address();

  x.createdOn = obj.createdOn;
  x.address = obj.address;
  x.path = obj.path;
  x.publicKeys = obj.publicKeys;
  return x;
};


/**
 * getScriptPubKey
 *
 * @param {number} threshold - amount of required signatures to spend the output
 * @return {Script}
 */
Address.prototype.getScriptPubKey = function (threshold) {
  return Bitcore.Script.buildMultisigOut(this.publicKeys, threshold)
};

module.exports = Address;
