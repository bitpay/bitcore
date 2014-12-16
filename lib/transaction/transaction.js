'use strict';

var _ = require('lodash');
var buffer = require('buffer');
var assert = require('assert');

var util = require('../util/js');
var bufferUtil = require('../util/buffer');
var JSUtil = require('../util/js');
var BufferReader = require('../encoding/bufferreader');
var BufferWriter = require('../encoding/bufferwriter');
var Hash = require('../crypto/hash');
var Signature = require('../crypto/signature');
var Sighash = require('./sighash');

var Address = require('../address');
var Unit = require('../unit');
var Input = require('./input');
var PublicKeyHashInput = Input.PublicKeyHash;
var MultiSigScriptHashInput = Input.MultiSigScriptHash;
var Output = require('./output');
var Script = require('../script');
var PrivateKey = require('../privatekey');

var CURRENT_VERSION = 1;
var DEFAULT_NLOCKTIME = 0;
var DEFAULT_SEQNUMBER = 0xFFFFFFFF;

/**
 * Represents a transaction, a set of inputs and outputs to change
 * ownership of tokens
 *
 * @param {*} serialized
 */
function Transaction(serialized) {
  if (!(this instanceof Transaction)) {
    return new Transaction(serialized);
  }
  this.inputs = [];
  this.outputs = [];
  this._inputAmount = 0;
  this._outputAmount = 0;

  if (serialized) {
    if (serialized instanceof Transaction) {
      return Transaction.shallowCopy(serialized);
    } else if (util.isHexa(serialized)) {
      this.fromString(serialized);
    } else if (bufferUtil.isBuffer(serialized)) {
      this.fromBuffer(serialized);
    } else if (_.isObject(serialized)) {
      this.fromObject(serialized);
    }
  } else {
    this._newTransaction();
  }
}

/* Constructors and Serialization */

/**
 * Create a "shallow" copy of the transaction, by serializing and deserializing
 * it dropping any additional information that inputs and outputs may have hold
 *
 * @param {Transaction} transaction
 * @return {Transaction}
 */
Transaction.shallowCopy = function(transaction) {
  var copy = new Transaction(transaction.toBuffer());
  return copy;
};

var hashProperty = {
  configurable: false,
  writeable: false,
  get: function() {
    return new BufferReader(this._getHash()).readReverse().toString('hex');
  }
};
Object.defineProperty(Transaction.prototype, 'hash', hashProperty);
Object.defineProperty(Transaction.prototype, 'id', hashProperty);

/**
 * Retrieve the little endian hash of the transaction (used for serialization)
 * @return {Buffer}
 */
Transaction.prototype._getHash = function() {
  return Hash.sha256sha256(this.toBuffer());
};

/**
 * Retrieve a hexa string that can be used with bitcoind's CLI interface
 * (decoderawtransaction, sendrawtransaction)
 *
 * @return {string}
 */
Transaction.prototype.serialize = Transaction.prototype.toString = function() {
  return this.toBuffer().toString('hex');
};

Transaction.prototype.inspect = function() {
  return '<Transaction: ' + this.toString() + '>';
};

Transaction.prototype.toBuffer = function() {
  var writer = new BufferWriter();
  return this.toBufferWriter(writer).toBuffer();
};

Transaction.prototype.toBufferWriter = function(writer) {
  writer.writeUInt32LE(this.version);
  writer.writeVarintNum(this.inputs.length);
  _.each(this.inputs, function(input) {
    input.toBufferWriter(writer);
  });
  writer.writeVarintNum(this.outputs.length);
  _.each(this.outputs, function(output) {
    output.toBufferWriter(writer);
  });
  writer.writeUInt32LE(this.nLockTime);
  return writer;
};

Transaction.prototype.fromBuffer = function(buffer) {
  var reader = new BufferReader(buffer);
  return this.fromBufferReader(reader);
};

Transaction.prototype.fromBufferReader = function(reader) {
  var i, sizeTxIns, sizeTxOuts;

  this.version = reader.readUInt32LE();
  sizeTxIns = reader.readVarintNum();
  for (i = 0; i < sizeTxIns; i++) {
    var input = Input.fromBufferReader(reader);
    this.inputs.push(input);
  }
  sizeTxOuts = reader.readVarintNum();
  for (i = 0; i < sizeTxOuts; i++) {
    this.outputs.push(Output.fromBufferReader(reader));
  }
  this.nLockTime = reader.readUInt32LE();
  return this;
};

Transaction.prototype.fromJSON = function(json) {
  if (JSUtil.isValidJSON(json)) {
    json = JSON.parse(json);
  }
  var self = this;
  this.inputs = [];
  var inputs = json.inputs || json.txins;
  inputs.forEach(function(input) {
    self.inputs.push(Input.fromJSON(input));
  });
  this.outputs = [];
  var outputs = json.outputs || json.txouts;
  outputs.forEach(function(output) {
    self.outputs.push(Output.fromJSON(output));
  });
  this.version = json.version;
  this.nLockTime = json.nLockTime;
  return this;
};

Transaction.prototype.toObject = function toObject() {
  var inputs = [];
  this.inputs.forEach(function(input) {
    inputs.push(input.toObject());
  });
  var outputs = [];
  this.outputs.forEach(function(output) {
    outputs.push(output.toObject());
  });
  return {
    version: this.version,
    inputs: inputs,
    outputs: outputs,
    nLockTime: this.nLockTime
  };
};

Transaction.prototype.toJSON = function toJSON() {
  return JSON.stringify(this.toObject());
};

Transaction.prototype.fromString = function(string) {
  this.fromBuffer(new buffer.Buffer(string, 'hex'));
};

Transaction.prototype._newTransaction = function() {
  this.version = CURRENT_VERSION;
  this.nLockTime = DEFAULT_NLOCKTIME;
};

/* Transaction creation interface */

Transaction.prototype.from = function(utxo, pubkeys, threshold) {
  if (pubkeys && threshold) {
    this._fromMultiSigP2SH(utxo, pubkeys, threshold);
  } else {
    this._fromNonP2SH(utxo);
  }
  return this;
};

Transaction.prototype._fromMultiSigP2SH = function(utxo, pubkeys, threshold) {
  if (Transaction._isNewUtxo(utxo)) {
    this._fromMultisigNewUtxo(utxo, pubkeys, threshold);
  } else if (Transaction._isOldUtxo(utxo)) {
    this._fromMultisigOldUtxo(utxo, pubkeys, threshold);
  } else {
    throw new Transaction.Errors.UnrecognizedUtxoFormat(utxo);
  }
};

Transaction.prototype._fromNonP2SH = function(utxo) {
  var self = this;
  if (_.isArray(utxo)) {
    _.each(utxo, function(single) {
      self._fromNonP2SH(single);
    });
    return;
  }
  if (Transaction._isNewUtxo(utxo)) {
    this._fromNewUtxo(utxo);
  } else if (Transaction._isOldUtxo(utxo)) {
    this._fromOldUtxo(utxo);
  } else {
    throw new Transaction.Errors.UnrecognizedUtxoFormat(utxo);
  }
};

Transaction._isNewUtxo = function(utxo) {
  var isDefined = function(param) {
    return !_.isUndefined(param);
  };
  return _.all(_.map([utxo.txId, utxo.outputIndex, utxo.satoshis, utxo.script], isDefined));
};

Transaction._isOldUtxo = function(utxo) {
  var isDefined = function(param) {
    return !_.isUndefined(param);
  };
  return _.all(_.map([utxo.txid, utxo.vout, utxo.scriptPubKey, utxo.amount], isDefined));
};

Transaction.prototype._fromOldUtxo = function(utxo) {
  return this._fromNewUtxo({
    address: utxo.address && new Address(utxo.address),
    txId: utxo.txid,
    outputIndex: utxo.vout,
    script: util.isHexa(utxo.script) ? new buffer.Buffer(utxo.scriptPubKey, 'hex') : utxo.scriptPubKey,
    satoshis: Unit.fromBTC(utxo.amount).satoshis
  });
};

Transaction.prototype._fromNewUtxo = function(utxo) {
  utxo.address = utxo.address && new Address(utxo.address);
  utxo.script = new Script(util.isHexa(utxo.script) ? new buffer.Buffer(utxo.script, 'hex') : utxo.script);
  this.inputs.push(new PublicKeyHashInput({
    output: new Output({
      script: utxo.script,
      satoshis: utxo.satoshis
    }),
    prevTxId: utxo.txId,
    outputIndex: utxo.outputIndex,
    sequenceNumber: DEFAULT_SEQNUMBER,
    script: Script.empty()
  }));
  this._inputAmount += utxo.satoshis;
};

Transaction.prototype._fromMultisigOldUtxo = function(utxo, pubkeys, threshold) {
  return this._fromMultisigNewUtxo({
    address: utxo.address && new Address(utxo.address),
    txId: utxo.txid,
    outputIndex: utxo.vout,
    script: new buffer.Buffer(utxo.scriptPubKey, 'hex'),
    satoshis: Unit.fromBTC(utxo.amount).satoshis
  }, pubkeys, threshold);
};

Transaction.prototype._fromMultisigNewUtxo = function(utxo, pubkeys, threshold) {
  utxo.address = utxo.address && new Address(utxo.address);
  utxo.script = new Script(util.isHexa(utxo.script) ? new buffer.Buffer(utxo.script, 'hex') : utxo.script);
  this.inputs.push(new MultiSigScriptHashInput({
    output: new Output({
      script: utxo.script,
      satoshis: utxo.satoshis
    }),
    prevTxId: utxo.txId,
    outputIndex: utxo.outputIndex,
    sequenceNumber: DEFAULT_SEQNUMBER,
    script: Script.empty()
  }, pubkeys, threshold));
  this._inputAmount += utxo.satoshis;
};

Transaction.prototype.hasAllUtxoInfo = function() {
  return _.all(this.inputs.map(function(input) {
    return !!input.output;
  }));
};

Transaction.prototype.fee = function(amount) {
  this._fee = amount;
  return this;
};

/* Output management */

Transaction.prototype.change = function(address) {
  this._change = address;
  return this;
};

Transaction.prototype.to = function(address, amount) {
  this._addOutput(new Output({
    script: Script(new Address(address)),
    satoshis: amount
  }));
  return this;
};

Transaction.prototype._addOutput = function(output) {
  this.outputs.push(output);
  this._outputAmount += output.satoshis;
};

Transaction.prototype.addData = function(value) {
  this._addOutput(new Output({
    script: Script.buildDataOut(value),
    satoshis: 0
  }));
  return this;
};

/* Signature handling */

Transaction.prototype.sign = function(privKey, sigtype) {
  // TODO: Change for preconditions
  assert(this.hasAllUtxoInfo());
  var self = this;
  if (_.isArray(privKey)) {
    _.each(privKey, function(privKey) {
      self.sign(privKey);
    });
    return this;
  }
  _.each(this.getSignatures(privKey, sigtype), function(signature) {
    self.applySignature(signature);
  });
  return this;
};

Transaction.prototype._getPrivateKeySignatures = function(privKey, sigtype) {
  privKey = new PrivateKey(privKey);
  sigtype = sigtype || Signature.SIGHASH_ALL;
  var transaction = this;
  var results = [];
  var hashData = Hash.sha256ripemd160(privKey.publicKey.toBuffer());
  _.each(this.inputs, function forEachInput(input, index) {
    _.each(input.getSignatures(transaction, privKey, index, sigtype, hashData), function(signature) {
      results.push(signature);
    });
  });
  return results;
};

Transaction.prototype.applySignature = function(signature) {
  this.inputs[signature.inputIndex].addSignature(this, signature);
  return this;
};

Transaction.prototype.getSignatures = function(privKey, sigtype) {
  return this._getPrivateKeySignatures(privKey, sigtype);
};

Transaction.prototype.isFullySigned = function() {
  return _.all(_.map(this.inputs, function(input) {
    return input.isFullySigned();
  }));
};

Transaction.prototype.isValidSignature = function(signature) {
  var self = this;
  return this.inputs[signature.inputIndex].isValidSignature(self, signature);
};

/**
 * @returns {bool} whether the signature is valid for this transaction input
 */
Transaction.prototype.verify = function(sig, pubkey, nin, subscript) {
  return Sighash.verify(this, sig, pubkey, nin, subscript);
};

module.exports = Transaction;
