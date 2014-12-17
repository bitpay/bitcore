'use strict';

var _ = require('lodash');
var $ = require('../util/preconditions');
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
var Block = require('../block');
var BN = require('../crypto/bn');

var CURRENT_VERSION = 1;
var DEFAULT_NLOCKTIME = 0;
var DEFAULT_SEQNUMBER = 0xFFFFFFFF;

/**
 * Represents a transaction, a set of inputs and outputs to change ownership of tokens
 *
 * @param {*} serialized
 * @constructor
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

// max amount of satoshis in circulation
Transaction.MAX_MONEY = 21000000 * 1e8;

/* Constructors and Serialization */

/**
 * Create a 'shallow' copy of the transaction, by serializing and deserializing
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

/**
 * Add an input to this transaction. This is a high level interface
 * to add an input, for more control, use @{link Transaction#addInput}.
 *
 * Can receive, as output information, the output of bitcoind's `listunspent` command,
 * and a slightly fancier format recognized by bitcore:
 *
 * ```
 * {
 *  address: 'mszYqVnqKoQx4jcTdJXxwKAissE3Jbrrc1',
 *  txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
 *  outputIndex: 0,
 *  script: Script.empty(),
 *  satoshis: 1020000
 * }
 * ```
 * Where `address` can be either a string or a bitcore Address object. The
 * same is true for `script`, which can be a string or a bitcore Script.
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @example
 * var transaction = new Transaction();
 *
 * // From a pay to public key hash output from bitcoind's listunspent
 * transaction.from({'txid': '0000...', vout: 0, amount: 0.1, scriptPubKey: 'OP_DUP ...'});
 *
 * // From a pay to public key hash output
 * transaction.from({'txId': '0000...', outputIndex: 0, satoshis: 1000, script: 'OP_DUP ...'});
 *
 * // From a multisig P2SH output
 * transaction.from({'txId': '0000...', inputIndex: 0, satoshis: 1000, script: '... OP_HASH'},
 *                  ['03000...', '02000...'], 2);
 *
 * @param {Object} utxo
 * @param {Array=} pubkeys
 * @param {number=} threshold
 */
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
  this._changeSetup = false;
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

/**
 * Returns true if the transaction has enough info on all inputs to be correctly validated
 *
 * @return {boolean}
 */
Transaction.prototype.hasAllUtxoInfo = function() {
  return _.all(this.inputs.map(function(input) {
    return !!input.output;
  }));
};

/**
 * Manually set the fee for this transaction. Beware that this resets all the signatures
 * for inputs (in further versions, SIGHASH_SINGLE or SIGHASH_NONE signatures will not
 * be reset).
 *
 * @param {number} amount satoshis to be sent
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.fee = function(amount) {
  this._fee = amount;
  this._changeSetup = false;
  return this;
};

/* Output management */

/**
 * Set the change address for this transaction
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @param {number} amount satoshis to be sent
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.change = function(address) {
  this._change = new Address(address);
  this._changeSetup = false;
  return this;
};

/**
 * Add an output to the transaction.
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @param {string|Address} address
 * @param {number} amount in satoshis
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.to = function(address, amount) {
  this._addOutput(new Output({
    script: Script(new Address(address)),
    satoshis: amount
  }));
  return this;
};

/**
 * Add an OP_RETURN output to the transaction.
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @param {Buffer|string} value the data to be stored in the OP_RETURN output.
 *    In case of a string, the UTF-8 representation will be stored
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.addData = function(value) {
  this._addOutput(new Output({
    script: Script.buildDataOut(value),
    satoshis: 0
  }));
  return this;
};

Transaction.prototype._addOutput = function(output) {
  this.outputs.push(output);
  this._changeSetup = false;
  this._outputAmount += output.satoshis;
};

Transaction.prototype._updateChangeOutput = function() {
  if (!this._change) {
    return;
  }
  if (this._changeSetup) {
    return;
  }
  if (!_.isUndefined(this._changeSetup)) {
    this._clearSignatures();
  }
  if (!_.isUndefined(this._changeOutput)) {
    this.removeOutput(this._changeOutput);
  }
  var estimatedSize = this._estimateSize();
  var available = this._inputAmount - this._outputAmount;
  var fee = this._fee || Transaction._estimateFee(estimatedSize, available);
  if (available - fee > 0) {
    this._changeOutput = this.outputs.length;
    this._addOutput(new Output({
      script: Script.fromAddress(this._change),
      satoshis: available - fee
    }));
  } else {
    this._changeOutput = undefined;
  }
  this._changeSetup = true;
};

Transaction.prototype._clearSignatures = function() {
  _.each(this.inputs, function(input) {
    input.clearSignatures();
  });
};

Transaction.FEE_PER_KB = 10000;
Transaction.CHANGE_OUTPUT_MAX_SIZE = 20 + 4 + 34 + 4;

Transaction._estimateFee = function(size, amountAvailable) {
  var fee = Math.ceil(size / Transaction.FEE_PER_KB);
  if (amountAvailable > fee) {
    // Safe upper bound for change address script
    size += Transaction.CHANGE_OUTPUT_MAX_SIZE;
  }
  return Math.ceil(size / 1000 / Transaction.FEE_PER_KB) * 1000;
};

Transaction.MAXIMUM_EXTRA_SIZE = 4 + 9 + 9 + 4;

Transaction.prototype._estimateSize = function() {
  var result = Transaction.MAXIMUM_EXTRA_SIZE;
  _.each(this.inputs, function(input) {
    result += input._estimateSize();
  });
  _.each(this.outputs, function(output) {
    result += output.script.toBuffer().length + 9;
  });
  return result;
};

Transaction.prototype.removeOutput = function(index) {
  var output = this.outputs[index];
  this._outputAmount -= output.satoshis;
  this.outputs = _.without(this.outputs, this.outputs[this._changeOutput]);
};

/* Signature handling */

/**
 * Sign the transaction using one or more private keys.
 *
 * It tries to sign each input, verifying that the signature will be valid
 * (matches a public key).
 *
 * @param {Array|String|PrivateKey} privateKey
 * @param {number} sigtype
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.sign = function(privateKey, sigtype) {
  $.checkState(this.hasAllUtxoInfo());
  this._updateChangeOutput();
  var self = this;
  if (_.isArray(privateKey)) {
    _.each(privateKey, function(privateKey) {
      self.sign(privateKey);
    });
    return this;
  }
  _.each(this.getSignatures(privateKey, sigtype), function(signature) {
    self.applySignature(signature);
  });
  return this;
};

Transaction.prototype.getSignatures = function(privKey, sigtype) {
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

/**
 * Add a signature to the transaction
 *
 * @param {Object} signature
 * @param {number} signature.inputIndex
 * @param {number} signature.sighash
 * @param {PublicKey} signature.publicKey
 * @param {Signature} signature.signature
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.applySignature = function(signature) {
  this.inputs[signature.inputIndex].addSignature(this, signature);
  return this;
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
Transaction.prototype.verifySignature = function(sig, pubkey, nin, subscript) {
  return Sighash.verify(this, sig, pubkey, nin, subscript);
};

/**
 * Check that a transaction passes basic sanity tests. If not, return a string
 * describing the error. This function contains the same logic as
 * CheckTransaction in bitcoin core.
 */
Transaction.prototype.verify = function() {
  // Basic checks that don't depend on any context
  if (this.inputs.length === 0) {
    return 'transaction txins empty';
  }

  if (this.outputs.length === 0) {
    return 'transaction txouts empty';
  }

  // Size limits
  if (this.toBuffer().length > Block.MAX_BLOCK_SIZE) {
    return 'transaction over the maximum block size';
  }

  // Check for negative or overflow output values
  var valueoutbn = BN(0);
  for (var i = 0; i < this.outputs.length; i++) {
    var txout = this.outputs[i];
    var valuebn = BN(txout.satoshis.toString(16));
    if (valuebn.lt(0)) {
      return 'transaction txout ' + i + ' negative';
    }
    if (valuebn.gt(Transaction.MAX_MONEY)) {
      return 'transaction txout ' + i + ' greater than MAX_MONEY';
    }
    valueoutbn = valueoutbn.add(valuebn);
    if (valueoutbn.gt(Transaction.MAX_MONEY)) {
      return 'transaction txout ' + i + ' total output greater than MAX_MONEY';
    }
  }

  // Check for duplicate inputs
  var txinmap = {};
  for (i = 0; i < this.inputs.length; i++) {
    var txin = this.inputs[i];

    var inputid = txin.prevTxId + ':' + txin.outputIndex;
    if (!_.isUndefined(txinmap[inputid])) {
      return 'transaction input ' + i + ' duplicate input';
    }
    txinmap[inputid] = true;
  }

  var isCoinbase = this.isCoinbase();
  if (isCoinbase) {
    var buf = this.inputs[0]._script.toBuffer();
    if (buf.length < 2 || buf.length > 100) {
      return 'coinbase trasaction script size invalid';
    }
  } else {
    for (i = 0; i < this.inputs.length; i++) {
      if (this.inputs[i].isNull()) {
        return 'tranasction input ' + i + ' has null input';
      }
    }
  }
  return true;
};

/**
 * Analagous to bitcoind's IsCoinBase function in transaction.h
 */
Transaction.prototype.isCoinbase = function() {
  return (this.inputs.length === 1 && this.inputs[0].isNull());
};


module.exports = Transaction;
