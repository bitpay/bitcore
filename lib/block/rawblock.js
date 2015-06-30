'use strict';

function RawBlock(br) {
  /* jshint maxstatements: 40 */

  this.version = br.readUInt32LE();
  this.prevHash = br.read(32);
  this.merkleRoot = br.read(32);
  this.timestamp = br.readUInt32LE();
  this.bits = br.readUInt32LE();
  this.nonce = br.readUInt32LE();

  var transactionLength = br.readVarintNum();
  this.transactions = [];
  for (var i = 0; i < transactionLength; i++) {
    var tx = {};
    tx.version = br.readUInt32LE();

    var inputLength = br.readVarintNum();
    tx.inputs = [];
    for (var j = 0; j < inputLength; j++) {
      var input = {};
      input.prevTxId = br.readReverse(32);
      input.outputIndex = br.readUInt32LE();
      var size = br.readVarintNum();
      input.scriptBuffer = br.read(size);
      input.sequenceNumber = br.readUInt32LE();
      tx.inputs.push(input);
    }

    var outputLength = br.readVarintNum();
    tx.outputs = [];
    for (var k = 0; k < outputLength; k++) {
      var output = {};
      output.satoshis = br.readUInt64LEBN();
      var size = br.readVarintNum();
      if (size !== 0) {
        output.scriptBuffer = br.read(size);
      } else {
        output.scriptBuffer = new Buffer([]);
      }
      tx.outputs.push(output);
    }

    tx.nLockTime = br.readUInt32LE();
    this.transactions.push(tx);
  }
}

module.exports = RawBlock;
