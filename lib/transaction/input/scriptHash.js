'use strict';

var inherits = require('inherits');
var Input = require('./input');
var Hash = require('../../crypto/hash');
var Signature = require('../../crypto/signature');
var Sighash = require('../sighash');
var BufferUtil = require('../../util/buffer');

function ScriptHashInput() {
}
inherits(ScriptHashInput, Input);

ScriptHashInput.prototype.getSignatures = function(transaction, privateKey, index, sigtype, hashData) {
  hashData = hashData || Hash.sha256ripemd160(privateKey.publicKey.toBuffer());
  sigtype = sigtype || Signature.SIGHASH_ALL;
  if (BufferUtil.equals(hashData, this.output.script.address.hashData)) {
    return [{
      address: this.output.script.address,
      publicKey: privateKey.publicKey,
      prevTxId: this.txId,
      outputIndex: this.outputIndex,
      inputIndex: index,
      signature: Sighash.sign(transaction, privateKey, sigtype, index, this.output.script),
      sigtype: sigtype
    }];
  }
  return [];
};

module.exports = ScriptHashInput;
