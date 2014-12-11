'use strict';

var inherits = require('inherits');
var Input = require('./input');
var Hash = require('../../crypto/hash');
var Signature = require('../../crypto/signature');
var Sighash = require('../sighash');
var BufferUtil = require('../../util/buffer');

function ScriptHashInput() {
  Input.apply(this, arguments);
}
inherits(ScriptHashInput, Input);

ScriptHashInput.prototype.getSignatures = function(transaction, privateKey, index, sigtype, hashData) {
  return [];
};

module.exports = ScriptHashInput;
