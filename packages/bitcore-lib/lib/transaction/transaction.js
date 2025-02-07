'use strict';

var _ = require('lodash');
var $ = require('../util/preconditions');
var buffer = require('buffer');
var compare = Buffer.compare || require('buffer-compare');

var errors = require('../errors');
var BufferUtil = require('../util/buffer');
var JSUtil = require('../util/js');
var BufferReader = require('../encoding/bufferreader');
var BufferWriter = require('../encoding/bufferwriter');
var Hash = require('../crypto/hash');
var Signature = require('../crypto/signature');
var Sighash = require('./sighash');
var SighashWitness = require('./sighashwitness');
const SighashSchnorr = require('./sighashschnorr');

var Address = require('../address');
var UnspentOutput = require('./unspentoutput');
var Input = require('./input');
var PublicKeyHashInput = Input.PublicKeyHash;
var PublicKeyInput = Input.PublicKey;
var MultiSigScriptHashInput = Input.MultiSigScriptHash;
var MultiSigInput = Input.MultiSig;
const TaprootInput = Input.Taproot;
var Output = require('./output');
var Script = require('../script');
var PrivateKey = require('../privatekey');
var BN = require('../crypto/bn');

/**
 * Represents a transaction, a set of inputs and outputs to change ownership of tokens
 *
 * @param {*} serialized
 * @constructor
 */
function Transaction(serialized, opts) {
  if (!(this instanceof Transaction)) {
    return new Transaction(serialized);
  }
  this.inputs = [];
  this.outputs = [];
  this._inputAmount = undefined;
  this._outputAmount = undefined;

  if (serialized) {
    if (serialized instanceof Transaction) {
      return Transaction.shallowCopy(serialized);
    } else if (JSUtil.isHexa(serialized)) {
      this.fromString(serialized);
    } else if (BufferUtil.isBuffer(serialized)) {
      this.fromBuffer(serialized);
    } else if (_.isObject(serialized)) {
      this.fromObject(serialized, opts);
    } else {
      throw new errors.InvalidArgument('Must provide an object or string to deserialize a transaction');
    }
  } else {
    this._newTransaction();
  }
}
var CURRENT_VERSION = 2;
var DEFAULT_NLOCKTIME = 0;
var MAX_BLOCK_SIZE = 1000000;

// Minimum amount for an output for it not to be considered a dust output
Transaction.DUST_AMOUNT = 546;

// Margin of error to allow fees in the vecinity of the expected value but doesn't allow a big difference
Transaction.FEE_SECURITY_MARGIN = 150;

// max amount of satoshis in circulation
Transaction.MAX_MONEY = 21000000 * 1e8;

// nlocktime limit to be considered block height rather than a timestamp
Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT = 5e8;

// Max value for an unsigned 32 bit value
Transaction.NLOCKTIME_MAX_VALUE = 4294967295;

// Value used for fee estimation (satoshis per kilobyte)
Transaction.FEE_PER_KB = 100000;

// Safe upper bound for change address script size in bytes
Transaction.CHANGE_OUTPUT_MAX_SIZE = 20 + 4 + 34 + 4;
Transaction.MAXIMUM_EXTRA_SIZE = 4 + 9 + 9 + 4;

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
  enumerable: true,
  get: function() {
    this._hash = new BufferReader(this._getHash()).readReverse().toString('hex');
    return this._hash;
  }
};

var witnessHashProperty = {
  configurable: false,
  enumerable: true,
  get: function() {
    return new BufferReader(this._getWitnessHash()).readReverse().toString('hex');
  }
};

Object.defineProperty(Transaction.prototype, 'witnessHash', witnessHashProperty);
Object.defineProperty(Transaction.prototype, 'hash', hashProperty);
Object.defineProperty(Transaction.prototype, 'id', hashProperty);

var ioProperty = {
  configurable: false,
  enumerable: true,
  get: function() {
    return this._getInputAmount();
  }
};
Object.defineProperty(Transaction.prototype, 'inputAmount', ioProperty);
ioProperty.get = function() {
  return this._getOutputAmount();
};
Object.defineProperty(Transaction.prototype, 'outputAmount', ioProperty);

Object.defineProperty(Transaction.prototype, 'size', {
  configurable: false,
  enumerable: false,
  get: function() {
    return this._calculateSize();
  }
});

Object.defineProperty(Transaction.prototype, 'vsize', {
  configurable: false,
  enumerable: false,
  get: function() {
    return this._calculateVSize();
  }
});

Object.defineProperty(Transaction.prototype, 'weight', {
  configurable: false,
  enumerable: false,
  get: function() {
    return this._calculateWeight();
  }
});

/**
 * Retrieve the little endian hash of the transaction (used for serialization)
 * @return {Buffer}
 */
Transaction.prototype._getHash = function() {
  return Hash.sha256sha256(this.toBuffer(true));
};

/**
 * Retrieve the little endian hash of the transaction including witness data
 * @return {Buffer}
 */
Transaction.prototype._getWitnessHash = function() {
  return Hash.sha256sha256(this.toBuffer(false));
};

/**
 * Retrieve a hexa string that can be used with bitcoind's CLI interface
 * (decoderawtransaction, sendrawtransaction)
 *
 * @param {Object|boolean=} unsafe if true, skip all tests. if it's an object,
 *   it's expected to contain a set of flags to skip certain tests:
 * * `disableAll`: disable all checks
 * * `disableSmallFees`: disable checking for fees that are too small
 * * `disableLargeFees`: disable checking for fees that are too large
 * * `disableIsFullySigned`: disable checking if all inputs are fully signed
 * * `disableDustOutputs`: disable checking if there are no outputs that are dust amounts
 * * `disableMoreOutputThanInput`: disable checking if the transaction spends more bitcoins than the sum of the input amounts
 * @return {string}
 */
Transaction.prototype.serialize = function(unsafe) {
  if (true === unsafe || unsafe && unsafe.disableAll) {
    return this.uncheckedSerialize();
  } else {
    return this.checkedSerialize(unsafe);
  }
};

Transaction.prototype.uncheckedSerialize = Transaction.prototype.toString = function() {
  return this.toBuffer().toString('hex');
};

/**
 * Retrieve a hexa string that can be used with bitcoind's CLI interface
 * (decoderawtransaction, sendrawtransaction)
 *
 * @param {Object} opts allows to skip certain tests. {@see Transaction#serialize}
 * @return {string}
 */
Transaction.prototype.checkedSerialize = function(opts) {
  var serializationError = this.getSerializationError(opts);
  if (serializationError) {
    serializationError.message += ' - For more information please see: ' +
      'https://github.com/bitpay/bitcore/blob/master/packages/bitcore-lib/docs/transaction.md#serialization-checks';
    throw serializationError;
  }
  return this.uncheckedSerialize();
};

Transaction.prototype.invalidSatoshis = function() {
  var invalid = false;
  for (var i = 0; i < this.outputs.length; i++) {
    if (this.outputs[i].invalidSatoshis()) {
      invalid = true;
    }
  }
  return invalid;
};

/**
 * Retrieve a possible error that could appear when trying to serialize and
 * broadcast this transaction.
 *
 * @param {Object} opts allows to skip certain tests. {@see Transaction#serialize}
 * @return {bitcore.Error}
 */
Transaction.prototype.getSerializationError = function(opts) {
  opts = opts || {};

  if (this.invalidSatoshis()) {
    return new errors.Transaction.InvalidSatoshis();
  }

  var unspent = this._getUnspentValue();
  var unspentError;
  if (unspent < 0) {
    if (!opts.disableMoreOutputThanInput) {
      unspentError = new errors.Transaction.InvalidOutputAmountSum();
    }
  } else {
    unspentError = this._hasFeeError(opts, unspent);
  }

  return unspentError ||
    this._hasDustOutputs(opts) ||
    this._isMissingSignatures(opts);
};

Transaction.prototype._hasFeeError = function(opts, unspent) {

  if (this._fee != null && this._fee !== unspent) {
    return new errors.Transaction.FeeError.Different(
      'Unspent value is ' + unspent + ' but specified fee is ' + this._fee
    );
  }

  if (!opts.disableLargeFees) {
    var maximumFee = Math.floor(Transaction.FEE_SECURITY_MARGIN * this._estimateFee());
    if (unspent > maximumFee) {
      if (this._missingChange()) {
        return new errors.Transaction.ChangeAddressMissing(
          'Fee is too large and no change address was provided'
        );
      }
      return new errors.Transaction.FeeError.TooLarge(
        'expected less than ' + maximumFee + ' but got ' + unspent
      );
    }
  }

  if (!opts.disableSmallFees) {
    var minimumFee = Math.ceil(this._estimateFee() / Transaction.FEE_SECURITY_MARGIN);
    if (unspent < minimumFee) {
      return new errors.Transaction.FeeError.TooSmall(
        'expected more than ' + minimumFee + ' but got ' + unspent
      );
    }
  }
};

Transaction.prototype._missingChange = function() {
  return !this._changeScript;
};

Transaction.prototype._hasDustOutputs = function(opts) {
  if (opts.disableDustOutputs) {
    return;
  }
  var index, output;
  for (index in this.outputs) {
    output = this.outputs[index];
    if (output.satoshis < Transaction.DUST_AMOUNT && !output.script.isDataOut()) {
      return new errors.Transaction.DustOutputs();
    }
  }
};

Transaction.prototype._isMissingSignatures = function(opts) {
  if (opts.disableIsFullySigned) {
    return;
  }
  if (!this.isFullySigned()) {
    return new errors.Transaction.MissingSignatures();
  }
};

Transaction.prototype.inspect = function() {
  return '<Transaction: ' + this.uncheckedSerialize() + '>';
};

Transaction.prototype.toBuffer = function(noWitness) {
  var writer = new BufferWriter();
  return this.toBufferWriter(writer, noWitness).toBuffer();
};

Transaction.prototype.hasWitnesses = function() {
  for (var i = 0; i < this.inputs.length; i++) {
    if (this.inputs[i].hasWitnesses()) {
      return true;
    }
  }
  return false;
};

Transaction.prototype.toBufferWriter = function(writer, noWitness) {
  writer.writeInt32LE(this.version);

  const hasWitnesses = this.hasWitnesses();

  if (hasWitnesses && !noWitness) {
    writer.write(Buffer.from('0001', 'hex'));
  }

  writer.writeVarintNum(this.inputs ? this.inputs.length : 0);
  for (const input of this.inputs || []) {
    input.toBufferWriter(writer);
  }

  writer.writeVarintNum(this.outputs ? this.outputs.length : 0);
  for (const output of this.outputs || []) {
    output.toBufferWriter(writer);
  }

  if (hasWitnesses && !noWitness) {
    for (const input of this.inputs) {
      const witnesses = input.getWitnesses();
      writer.writeVarintNum(witnesses.length);
      for (let j = 0; j < witnesses.length; j++) {
        writer.writeVarintNum(witnesses[j].length);
        writer.write(witnesses[j]);
      }
    }
  }

  writer.writeUInt32LE(this.nLockTime);
  return writer;
};

Transaction.prototype.fromBuffer = function(buffer) {
  var reader = new BufferReader(buffer);
  return this.fromBufferReader(reader);
};

Transaction.prototype.fromBufferReader = function(reader) {
  $.checkArgument(!reader.finished(), 'No transaction data received');

  this.version = reader.readInt32LE();
  var sizeTxIns = reader.readVarintNum();

  // check for segwit
  var hasWitnesses = false;
  if (sizeTxIns === 0 && reader.buf[reader.pos] !== 0) {
    reader.pos += 1;
    hasWitnesses = true;
    sizeTxIns = reader.readVarintNum();
  }

  for (var i = 0; i < sizeTxIns; i++) {
    var input = Input.fromBufferReader(reader);
    this.inputs.push(input);
  }

  var sizeTxOuts = reader.readVarintNum();
  for (var j = 0; j < sizeTxOuts; j++) {
    this.outputs.push(Output.fromBufferReader(reader));
  }

  if (hasWitnesses) {
    for (var k = 0; k < sizeTxIns; k++) {
      var itemCount = reader.readVarintNum();
      var witnesses = [];
      for (var l = 0; l < itemCount; l++) {
        var size = reader.readVarintNum();
        var item = reader.read(size);
        witnesses.push(item);
      }
      this.inputs[k].setWitnesses(witnesses);
    }
  }

  this.nLockTime = reader.readUInt32LE();
  return this;
};


Transaction.prototype.toObject = Transaction.prototype.toJSON = function toObject() {
  var inputs = [];
  this.inputs.forEach(function(input) {
    inputs.push(input.toObject());
  });
  var outputs = [];
  this.outputs.forEach(function(output) {
    outputs.push(output.toObject());
  });
  var obj = {
    hash: this.hash,
    version: this.version,
    inputs: inputs,
    outputs: outputs,
    nLockTime: this.nLockTime
  };
  if (this._changeScript) {
    obj.changeScript = this._changeScript.toString();
  }
  if (this._changeIndex != null) {
    obj.changeIndex = this._changeIndex;
  }
  if (this._fee != null) {
    obj.fee = this._fee;
  }
  return obj;
};

Transaction.prototype.fromObject = function fromObject(arg, opts) {
  /* jshint maxstatements: 20 */
  $.checkArgument(_.isObject(arg) || arg instanceof Transaction);
  var transaction;
  if (arg instanceof Transaction) {
    transaction = arg.toObject();
  } else {
    transaction = arg;
  }
  for (const input of transaction.inputs || []) {
    if (!input.output || !input.output.script) {
      this.uncheckedAddInput(new Input(input));
      continue;
    }
    var script = new Script(input.output.script);
    var txin;
    if ((script.isScriptHashOut() || script.isWitnessScriptHashOut()) && input.publicKeys && input.threshold) {
      txin = new Input.MultiSigScriptHash(
        input, input.publicKeys, input.threshold, input.signatures, opts
      );
    } else if (script.isPublicKeyHashOut() || script.isWitnessPublicKeyHashOut() || script.isScriptHashOut()) {
      txin = new Input.PublicKeyHash(input);
    } else if (script.isPublicKeyOut()) {
      txin = new Input.PublicKey(input);
    } else {
      throw new errors.Transaction.Input.UnsupportedScript(input.output.script);
    }
    this.addInput(txin);
  }
  for (const output of transaction.outputs || []) {
    this.addOutput(new Output(output));
  }
  if (transaction.changeIndex) {
    this._changeIndex = transaction.changeIndex;
  }
  if (transaction.changeScript) {
    this._changeScript = new Script(transaction.changeScript);
  }
  if (transaction.fee) {
    this._fee = transaction.fee;
  }
  this.nLockTime = transaction.nLockTime;
  this.version = transaction.version;
  this._checkConsistency(arg);
  return this;
};

Transaction.prototype._checkConsistency = function(arg) {
  if (this._changeIndex != null) {
    $.checkState(this._changeScript, 'Change script is expected.');
    $.checkState(this.outputs[this._changeIndex], 'Change index points to undefined output.');
    $.checkState(this.outputs[this._changeIndex].script.toString() ===
      this._changeScript.toString(), 'Change output has an unexpected script.');
  }
  if (arg && arg.hash) {
    $.checkState(arg.hash === this.hash, 'Hash in object does not match transaction hash.');
  }
};

/**
 * Sets nLockTime so that transaction is not valid until the desired date(a
 * timestamp in seconds since UNIX epoch is also accepted)
 *
 * @param {Date | Number} time
 * @return {Transaction} this
 */
Transaction.prototype.lockUntilDate = function(time) {
  $.checkArgument(time);
  if (!isNaN(time) && time < Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT) {
    throw new errors.Transaction.LockTimeTooEarly();
  }
  if (_.isDate(time)) {
    time = time.getTime() / 1000;
  }

  for (var i = 0; i < this.inputs.length; i++) {
    if (this.inputs[i].sequenceNumber === Input.DEFAULT_SEQNUMBER){
      this.inputs[i].sequenceNumber = Input.DEFAULT_LOCKTIME_SEQNUMBER;
    }
  }

  this.nLockTime = time;
  return this;
};

/**
 * Sets nLockTime so that transaction is not valid until the desired block
 * height.
 *
 * @param {Number} height
 * @return {Transaction} this
 */
Transaction.prototype.lockUntilBlockHeight = function(height) {
  $.checkArgument(!isNaN(height));
  if (height >= Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT) {
    throw new errors.Transaction.BlockHeightTooHigh();
  }
  if (height < 0) {
    throw new errors.Transaction.NLockTimeOutOfRange();
  }

  for (var i = 0; i < this.inputs.length; i++) {
    if (this.inputs[i].sequenceNumber === Input.DEFAULT_SEQNUMBER){
      this.inputs[i].sequenceNumber = Input.DEFAULT_LOCKTIME_SEQNUMBER;
    }
  }


  this.nLockTime = height;
  return this;
};

/**
 *  Returns a semantic version of the transaction's nLockTime.
 *  @return {Number|Date}
 *  If nLockTime is 0, it returns null,
 *  if it is < 500000000, it returns a block height (number)
 *  else it returns a Date object.
 */
Transaction.prototype.getLockTime = function() {
  if (!this.nLockTime) {
    return null;
  }
  if (this.nLockTime < Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT) {
    return this.nLockTime;
  }
  return new Date(1000 * this.nLockTime);
};

Transaction.prototype.fromString = function(string) {
  this.fromBuffer(buffer.Buffer.from(string, 'hex'));
};

Transaction.prototype._newTransaction = function() {
  this.version = CURRENT_VERSION;
  this.nLockTime = DEFAULT_NLOCKTIME;
};

/* Transaction creation interface */

/**
 * @typedef {Object} Transaction~fromObject
 * @property {string} prevTxId
 * @property {number} outputIndex
 * @property {(Buffer|string|Script)} script
 * @property {number} satoshis
 */

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
 * ```javascript
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
 * ```
 *
 * @param {(Array.<Transaction~fromObject>|Transaction~fromObject)} utxo
 * @param {Array=} pubkeys
 * @param {number=} threshold
 * @param {Object=} opts - Several options:
 *        - noSorting: defaults to false, if true and is multisig, don't
 *                      sort the given public keys before creating the script
 */
Transaction.prototype.from = function(utxo, pubkeys, threshold, opts) {
  if (Array.isArray(utxo)) {
    for(const u of utxo) {
      this.from(u, pubkeys, threshold, opts);
    };
    return this;
  }
  const exists = this.inputs.some(function(input) {
    // TODO: Maybe prevTxId should be a string? Or defined as read only property?
    return input.prevTxId.toString('hex') === utxo.txId && input.outputIndex === utxo.outputIndex;
  });
  if (exists) {
    return this;
  }
  if (pubkeys && threshold) {
    this._fromMultisigUtxo(utxo, pubkeys, threshold, opts);
  } else {
    this._fromNonP2SH(utxo, opts);
  }
  return this;
};

/**
 * associateInputs - Update inputs with utxos, allowing you to specify value, and pubkey.
 * Populating these inputs allows for them to be signed with .sign(privKeys)
 *
 * @param {Array<Object>} utxos
 * @param {Array<string | PublicKey>} pubkeys
 * @param {number} threshold
 * @param {Object} opts
 * @returns {Array<number>}
 */
Transaction.prototype.associateInputs = function(utxos, pubkeys, threshold, opts = {}) {
  let indexes = [];
  for(let utxo of utxos) {
    const index = this.inputs.findIndex(i => i.prevTxId.toString('hex') === utxo.txId && i.outputIndex === utxo.outputIndex);
    indexes.push(index);
    if(index >= 0) {
      const sequenceNumber = this.inputs[index].sequenceNumber; // preserve the set sequence number
      this.inputs[index] = this._getInputFrom(utxo, pubkeys, threshold, opts);
      this.inputs[index].sequenceNumber = sequenceNumber;
    }
  }
  return indexes;
}


Transaction.prototype._selectInputType = function(utxo, pubkeys, threshold) {
  var clazz;
  utxo = new UnspentOutput(utxo);
  if(pubkeys && threshold) {
    if (utxo.script.isMultisigOut()) {
      clazz = MultiSigInput;
    } else if (utxo.script.isScriptHashOut() || utxo.script.isWitnessScriptHashOut()) {
      clazz = MultiSigScriptHashInput;
    }
  } else if (utxo.script.isPublicKeyHashOut() || utxo.script.isWitnessPublicKeyHashOut() || utxo.script.isScriptHashOut()) {
    clazz = PublicKeyHashInput;
  } else if (utxo.script.isTaproot()) {
    clazz = TaprootInput;
  } else if (utxo.script.isPublicKeyOut()) {
    clazz = PublicKeyInput;
  } else {
    clazz = Input;
  }
  return clazz;
}


Transaction.prototype._getInputFrom = function(utxo, pubkeys, threshold, opts = {}) {
  utxo = new UnspentOutput(utxo);
  const InputClass = this._selectInputType(utxo, pubkeys, threshold);
  const input = {
    output: new Output({
      script: utxo.script,
      satoshis: utxo.satoshis
    }),
    prevTxId: utxo.txId,
    outputIndex: utxo.outputIndex,
    sequenceNumber: opts.sequenceNumber,
    script: Script.empty()
  };
  let args = pubkeys && threshold ? [pubkeys, threshold, false, opts] : []
  return new InputClass(input, ...args);
}

Transaction.prototype._fromNonP2SH = function(utxo, opts) {
  const input = this._getInputFrom(utxo, null, null, opts);
  this.addInput(input);
};

Transaction.prototype._fromMultisigUtxo = function(utxo, pubkeys, threshold, opts) {
  $.checkArgument(threshold <= pubkeys.length,
    'Number of required signatures must be greater than the number of public keys');
  const input = this._getInputFrom(utxo, pubkeys, threshold, opts);
  this.addInput(input);
};

/**
 * Add an input to this transaction. The input must be an instance of the `Input` class.
 * It should have information about the Output that it's spending, but if it's not already
 * set, two additional parameters, `outputScript` and `satoshis` can be provided.
 *
 * @param {Input} input
 * @param {String|Script} outputScript
 * @param {number} satoshis
 * @return Transaction this, for chaining
 */
Transaction.prototype.addInput = function(input, outputScript, satoshis) {
  $.checkArgumentType(input, Input, 'input');
  if (!input.output && (outputScript == null || satoshis == null)) {
    throw new errors.Transaction.NeedMoreInfo('Need information about the UTXO script and satoshis');
  }
  if (!input.output && outputScript && satoshis != null) {
    outputScript = outputScript instanceof Script ? outputScript : new Script(outputScript);
    $.checkArgumentType(satoshis, 'number', 'satoshis');
    input.output = new Output({
      script: outputScript,
      satoshis: satoshis
    });
  }
  return this.uncheckedAddInput(input);
};

/**
 * Add an input to this transaction, without checking that the input has information about
 * the output that it's spending.
 *
 * @param {Input} input
 * @return Transaction this, for chaining
 */
Transaction.prototype.uncheckedAddInput = function(input) {
  $.checkArgumentType(input, Input, 'input');
  this.inputs.push(input);
  this._inputAmount = undefined;
  this._updateChangeOutput();
  return this;
};

/**
 * Returns true if the transaction has enough info on all inputs to be correctly validated
 *
 * @return {boolean}
 */
Transaction.prototype.hasAllUtxoInfo = function() {
  return this.inputs.every(function(input) {
    return !!input.output;
  });
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
  $.checkArgument(!isNaN(amount), 'amount must be a number');
  this._fee = amount;
  this._updateChangeOutput();
  return this;
};

/**
 * Manually set the fee per KB for this transaction. Beware that this resets all the signatures
 * for inputs (in further versions, SIGHASH_SINGLE or SIGHASH_NONE signatures will not
 * be reset).
 *
 * @param {number} amount satoshis per KB to be sent
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.feePerKb = function(amount) {
  $.checkArgument(!isNaN(amount), 'amount must be a number');
  this._feePerKb = amount;
  this._updateChangeOutput();
  return this;
};

/**
 * Manually set the fee per Byte for this transaction. Beware that this resets all the signatures
 * for inputs (in further versions, SIGHASH_SINGLE or SIGHASH_NONE signatures will not
 * be reset).
 * fee per Byte will be ignored if fee per KB is set
 *
 * @param {number} amount satoshis per Byte to be sent
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.feePerByte = function (amount) {
  $.checkArgument(!isNaN(amount), 'amount must be a number');
  this._feePerByte = amount;
  this._updateChangeOutput();
  return this;
};

/* Output management */

/**
 * Set the change address for this transaction
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @param {Address} address An address for change to be sent to.
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.change = function(address) {
  $.checkArgument(address, 'address is required');
  this._changeScript = Script.fromAddress(address);
  this._updateChangeOutput();
  return this;
};


/**
 * @return {Output} change output, if it exists
 */
Transaction.prototype.getChangeOutput = function() {
  if (this._changeIndex != null) {
    return this.outputs[this._changeIndex];
  }
  return null;
};

/**
 * @typedef {Object} Transaction~toObject
 * @property {(string|Address)} address
 * @property {number} satoshis
 */

/**
 * Add an output to the transaction.
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @param {(string|Address|Array.<Transaction~toObject>)} address
 * @param {number} amount in satoshis
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.to = function(address, amount) {
  if (Array.isArray(address)) {
    for (const to of address) {
      this.to(to.address, to.satoshis);
    }
    return this;
  }

  $.checkArgument(
    JSUtil.isNaturalNumber(amount),
    'Amount is expected to be a positive integer'
  );
  this.addOutput(new Output({
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
  this.addOutput(new Output({
    script: Script.buildDataOut(value),
    satoshis: 0
  }));
  return this;
};


/**
 * Add an output to the transaction.
 *
 * @param {Output} output the output to add.
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.addOutput = function(output) {
  $.checkArgumentType(output, Output, 'output');
  this._addOutput(output);
  this._updateChangeOutput();
  return this;
};


/**
 * Remove all outputs from the transaction.
 *
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.clearOutputs = function() {
  this.outputs = [];
  this._clearSignatures();
  this._outputAmount = undefined;
  this._changeIndex = undefined;
  this._updateChangeOutput();
  return this;
};


Transaction.prototype._addOutput = function(output) {
  this.outputs.push(output);
  this._outputAmount = undefined;
};


/**
 * Calculates or gets the total output amount in satoshis
 *
 * @return {Number} the transaction total output amount
 */
Transaction.prototype._getOutputAmount = function() {
  if (this._outputAmount == null) {
    var self = this;
    this._outputAmount = 0;
    for (const output of this.outputs || []) {
      self._outputAmount += output.satoshis;
    }
  }
  return this._outputAmount;
};


/**
 * Calculates or gets the total input amount in satoshis
 *
 * @return {Number} the transaction total input amount
 */
Transaction.prototype._getInputAmount = function() {
  if (this._inputAmount == null) {
    this._inputAmount = _.sumBy(this.inputs, function(input) {
      if (input.output == null) {
        throw new errors.Transaction.Input.MissingPreviousOutput();
      }
      return input.output.satoshis;
    });
  }
  return this._inputAmount;
};

Transaction.prototype._updateChangeOutput = function(noClearSigs) {
  if (!this._changeScript) {
    return;
  }
  if (!noClearSigs) {
    this._clearSignatures();
  }
  if (this._changeIndex != null) {
    this._removeOutput(this._changeIndex);
  }
  var available = this._getUnspentValue();
  var fee = this.getFee();
  var changeAmount = available - fee;
  if (changeAmount > Transaction.DUST_AMOUNT) {
    this._changeIndex = this.outputs.length;
    this._addOutput(new Output({
      script: this._changeScript,
      satoshis: changeAmount
    }));
  } else {
    this._changeIndex = undefined;
  }
};
/**
 * Calculates the fee of the transaction.
 *
 * If there's a fixed fee set, return that.
 *
 * If there is no change output set, the fee is the
 * total value of the outputs minus inputs. Note that
 * a serialized transaction only specifies the value
 * of its outputs. (The value of inputs are recorded
 * in the previous transaction outputs being spent.)
 * This method therefore raises a "MissingPreviousOutput"
 * error when called on a serialized transaction.
 *
 * If there's no fee set and no change address,
 * estimate the fee based on size.
 *
 * @return {Number} fee of this transaction in satoshis
 */
Transaction.prototype.getFee = function() {
  if (this.isCoinbase()) {
    return 0;
  }
  if (this._fee != null) {
    return this._fee;
  }
  // if no change output is set, fees should equal all the unspent amount
  if (!this._changeScript) {
    return this._getUnspentValue();
  }
  return this._estimateFee();
};

/**
 * Estimates fee from serialized transaction size in bytes.
 */
Transaction.prototype._estimateFee = function () {
  const estimatedSize = this._estimateSize();
  const available = this._getUnspentValue();
  const feeRate = this._feePerByte || (this._feePerKb || Transaction.FEE_PER_KB) / 1000;
  function getFee(size) {
    return size * feeRate;
  }
  const fee = Math.ceil(getFee(estimatedSize));
  const feeWithChange = Math.ceil(getFee(estimatedSize) + getFee(this._estimateSizeOfChangeOutput()));
  if (!this._changeScript || available <= feeWithChange) {
    return fee;
  }
  return feeWithChange;
};

Transaction.prototype._estimateSizeOfChangeOutput = function () {
  if (!this._changeScript) {
    return 0;
  }
  const scriptLen = this._changeScript.toBuffer().length;
  // 8 bytes for satoshis + script size + actual script size
  return 8 + BufferWriter.varintBufNum(scriptLen).length + scriptLen;
};

Transaction.prototype._getUnspentValue = function() {
  return this._getInputAmount() - this._getOutputAmount();
};

Transaction.prototype._clearSignatures = function() {
  for (const input of this.inputs || []) {
    input.clearSignatures();
  }
};

/**
 * Estimate the tx size before input signatures are added.
 */
Transaction.prototype._estimateSize = function() {
  let result = 4; // version

  if (this.hasWitnesses()) {
    result += .5;
  }

  result += BufferWriter.varintBufNum(this.inputs.length).length;
  for (const input of this.inputs || []) {
    result += input._estimateSize();
  }

  result += BufferWriter.varintBufNum(this.outputs.length).length;
  for (const output of this.outputs || []) {
    result += output.calculateSize();
  }

  result += 4; // nLockTime
  return Math.ceil(result);
};

Transaction.prototype._calculateSize = function() {
  return this.toBuffer().length;
};

Transaction.prototype._calculateVSize = function(noRound) {
  const vsize = this._calculateWeight() / 4;
  return noRound ? vsize : Math.ceil(vsize);
};

Transaction.prototype._calculateWeight = function() {
  return (this.toBuffer(true).length * 3) + this.toBuffer(false).length;
};

Transaction.prototype._removeOutput = function(index) {
  var output = this.outputs[index];
  this.outputs = _.without(this.outputs, output);
  this._outputAmount = undefined;
};

Transaction.prototype.removeOutput = function(index) {
  this._removeOutput(index);
  this._updateChangeOutput();
};

/**
 * Sort a transaction's inputs and outputs according to BIP69
 *
 * @see {https://github.com/bitcoin/bips/blob/master/bip-0069.mediawiki}
 * @return {Transaction} this
 */
Transaction.prototype.sort = function() {
  this.sortInputs(function(inputs) {
    var copy = Array.prototype.concat.apply([], inputs);
    let i = 0;
    copy.forEach((x) => { x.i = i++});
    copy.sort(function(first, second) {
     return compare(first.prevTxId, second.prevTxId)
        || first.outputIndex - second.outputIndex
        || first.i - second.i;  // to ensure stable sort
    });
    return copy;
  });
  this.sortOutputs(function(outputs) {
    var copy = Array.prototype.concat.apply([], outputs);
    let i = 0;
    copy.forEach((x) => { x.i = i++});
    copy.sort(function(first, second) {
      return first.satoshis - second.satoshis
        || compare(first.script.toBuffer(), second.script.toBuffer())
        || first.i - second.i;  // to ensure stable sort
    });
    return copy;
  });
  return this;
};

/**
 * Randomize this transaction's outputs ordering. The shuffling algorithm is a
 * version of the Fisher-Yates shuffle, provided by lodash's _.shuffle().
 *
 * @return {Transaction} this
 */
Transaction.prototype.shuffleOutputs = function() {
  return this.sortOutputs(_.shuffle);
};

/**
 * Sort this transaction's outputs, according to a given sorting function that
 * takes an array as argument and returns a new array, with the same elements
 * but with a different order. The argument function MUST NOT modify the order
 * of the original array
 *
 * @param {Function} sortingFunction
 * @return {Transaction} this
 */
Transaction.prototype.sortOutputs = function(sortingFunction) {
  var outs = sortingFunction(this.outputs);
  return this._newOutputOrder(outs);
};

/**
 * Sort this transaction's inputs, according to a given sorting function that
 * takes an array as argument and returns a new array, with the same elements
 * but with a different order.
 *
 * @param {Function} sortingFunction
 * @return {Transaction} this
 */
Transaction.prototype.sortInputs = function(sortingFunction) {
  this.inputs = sortingFunction(this.inputs);
  this._clearSignatures();
  return this;
};

Transaction.prototype._newOutputOrder = function(newOutputs) {
  var isInvalidSorting = (this.outputs.length !== newOutputs.length ||
                          _.difference(this.outputs, newOutputs).length !== 0);
  if (isInvalidSorting) {
    throw new errors.Transaction.InvalidSorting();
  }

  if (this._changeIndex != null) {
    var changeOutput = this.outputs[this._changeIndex];
    this._changeIndex = newOutputs.indexOf(changeOutput);
  }

  this.outputs = newOutputs;
  return this;
};

Transaction.prototype.removeInput = function(txId, outputIndex) {
  var index;
  if (!outputIndex && !isNaN(txId)) {
    index = txId;
  } else {
    index = this.inputs.findIndex(function(input) {
      return input.prevTxId.toString('hex') === txId && input.outputIndex === outputIndex;
    });
  }
  if (index < 0 || index >= this.inputs.length) {
    throw new errors.Transaction.InvalidIndex(index, this.inputs.length);
  }
  var input = this.inputs[index];
  this.inputs = _.without(this.inputs, input);
  this._inputAmount = undefined;
  this._updateChangeOutput();
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
 * @param {String} signingMethod - method used to sign - 'ecdsa' or 'schnorr'
 * @param {Buffer|String} merkleRoot - merkle root for taproot signing
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.sign = function(privateKey, sigtype, signingMethod, merkleRoot) {
  $.checkState(this.hasAllUtxoInfo(), 'Not all utxo information is available to sign the transaction.');
  if (Array.isArray(privateKey)) {
    for (const pk of privateKey) {
      this.sign(pk, sigtype, signingMethod, merkleRoot);
    }
    return this;
  }
  for (const signature of this.getSignatures(privateKey, sigtype, signingMethod, merkleRoot)) {
    this.applySignature(signature, signingMethod);
  }
  return this;
};

Transaction.prototype.getSignatures = function(privKey, sigtype, signingMethod, merkleRoot) {
  if (typeof merkleRoot === 'string') {
    merkleRoot = Buffer.from(merkleRoot, 'hex');
  }
  privKey = new PrivateKey(privKey);
  const results = [];
  const hashData = Hash.sha256ripemd160(privKey.publicKey.toBuffer());
  for (let i = 0; i < this.inputs.length; i++) {
    const input = this.inputs[i];
    for (const signature of input.getSignatures(this, privKey, i, sigtype, hashData, signingMethod, merkleRoot)) {
      results.push(signature);
    }
  }
  return results;
};

/**
 * Add a signature to the transaction
 *
 * @param {Object} signature
 * @param {number} signature.inputIndex
 * @param {number} signature.sigtype
 * @param {PublicKey} signature.publicKey
 * @param {Signature} signature.signature
 * @param {String} signingMethod - 'ecdsa' to sign transaction
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.applySignature = function(signature, signingMethod) {
  this.inputs[signature.inputIndex].addSignature(this, signature, signingMethod);
  return this;
};

Transaction.prototype.isFullySigned = function() {
  for (const input of this.inputs || []) {
    if (input.isFullySigned === Input.prototype.isFullySigned) {
      throw new errors.Transaction.UnableToVerifySignature(
        'Unrecognized script kind, or not enough information to execute script.' +
        'This usually happens when creating a transaction from a serialized transaction'
      );
    }
  }
  return this.inputs.every(function(input) {
    return input.isFullySigned();
  });
};

Transaction.prototype.isValidSignature = function(signature, signingMethod) {
  if (this.inputs[signature.inputIndex].isValidSignature === Input.prototype.isValidSignature) {
    throw new errors.Transaction.UnableToVerifySignature(
      'Unrecognized script kind, or not enough information to execute script.' +
      'This usually happens when creating a transaction from a serialized transaction'
    );
  }
  return this.inputs[signature.inputIndex].isValidSignature(this, signature, signingMethod);
};


/**
 * Verify ECDSA signature
 * @param {Signature} sig 
 * @param {PublicKey} pubkey 
 * @param {Number} nin 
 * @param {Script} subscript 
 * @param {Number} satoshis 
 * @returns {Boolean}
 */
Transaction.prototype.checkEcdsaSignature = function(sig, pubkey, nin, subscript, satoshis) {
  var subscriptBuffer = subscript.toBuffer();
  var scriptCodeWriter = new BufferWriter();
  scriptCodeWriter.writeVarintNum(subscriptBuffer.length);
  scriptCodeWriter.write(subscriptBuffer);

  var satoshisBuffer;
  if (satoshis) {
    $.checkState(JSUtil.isNaturalNumber(satoshis), 'satoshis needs to be a natural number');
    satoshisBuffer = new BufferWriter().writeUInt64LEBN(new BN(satoshis)).toBuffer();
  } else {
    satoshisBuffer = this.inputs[nin].getSatoshisBuffer();
  }
  var verified = SighashWitness.verify(
    this,
    sig,
    pubkey,
    nin,
    scriptCodeWriter.toBuffer(),
    satoshisBuffer
  );
  return verified;
};


/**
 * Verify Schnorr signature
 * @param {Signature|Buffer} sig 
 * @param {PublicKey|Buffer} pubkey 
 * @param {Number} nin 
 * @param {Number} sigversion 
 * @param {Object} execdata 
 * @returns {Boolean}
 */
Transaction.prototype.checkSchnorrSignature = function(sig, pubkey, nin, sigversion, execdata) {
  if ($.isType(pubkey, 'PublicKey')) {
    pubkey = pubkey.point.x.toBuffer();
  }
  $.checkArgument(pubkey && pubkey.length === 32, 'Schnorr signatures have 32-byte public keys. The caller is responsible for enforcing this.');

  if (Buffer.isBuffer(sig)) {
    if (sig.length !== 64 && sig.length !== 65) {
      return false;
    }
    sig = Signature.fromSchnorr(sig);
  }
  // Note that in Tapscript evaluation, empty signatures are treated specially (invalid signature that does not
  // abort script execution). This is implemented in Interpreter.evalChecksigTapscript, which won't invoke
  // CheckSchnorrSignature in that case. In other contexts, they are invalid like every other signature with
  // size different from 64 or 65.
  $.checkArgument(sig.isSchnorr, 'Signature must be schnorr');

  if (!SighashSchnorr.verify(this, sig, pubkey, sigversion, nin, execdata)) {
    return false;
  }
  return true;
};

/**
 * This is here largely for legacy reasons. However, if the sig type
 * is already known (via sigversion), then it would be better to call
 * checkEcdsaSignature or checkSchnorrSignature directly.
 * @param {Signature|Buffer} sig Signature to verify
 * @param {PublicKey|Buffer} pubkey Public key used to verify sig
 * @param {Number} nin Tx input index to verify signature against
 * @param {Script} subscript ECDSA only
 * @param {Number} sigversion See Signature.Version for valid versions (default: 0 or Signature.Version.BASE)
 * @param {Number} satoshis ECDSA only
 * @param {Object} execdata Schnorr only
 * @returns {Boolean} whether the signature is valid for this transaction input
 */
Transaction.prototype.verifySignature = function(sig, pubkey, nin, subscript, sigversion, satoshis, execdata) {
  if (sigversion == null) {
    sigversion = Signature.Version.BASE;
  }

  switch(sigversion) {
    case Signature.Version.WITNESS_V0:
      return this.checkEcdsaSignature(sig, pubkey, nin, subscript, satoshis);
    case Signature.Version.TAPROOT:
    case Signature.Version.TAPSCRIPT:
      return this.checkSchnorrSignature(sig, pubkey, nin, sigversion, execdata);
    case Signature.Version.BASE:
    default:
      return Sighash.verify(this, sig, pubkey, nin, subscript);
  }
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

  // Check for negative or overflow output values
  var valueoutbn = new BN(0);
  for (var i = 0; i < this.outputs.length; i++) {
    var txout = this.outputs[i];

    if (txout.invalidSatoshis()) {
      return 'transaction txout ' + i + ' satoshis is invalid';
    }
    if (txout._satoshisBN.gt(new BN(Transaction.MAX_MONEY, 10))) {
      return 'transaction txout ' + i + ' greater than MAX_MONEY';
    }
    valueoutbn = valueoutbn.add(txout._satoshisBN);
    if (valueoutbn.gt(new BN(Transaction.MAX_MONEY))) {
      return 'transaction txout ' + i + ' total output greater than MAX_MONEY';
    }
  }

  // Size limits
  if (this.toBuffer().length > MAX_BLOCK_SIZE) {
    return 'transaction over the maximum block size';
  }

  // Check for duplicate inputs
  var txinmap = {};
  for (i = 0; i < this.inputs.length; i++) {
    var txin = this.inputs[i];

    var inputid = txin.prevTxId + ':' + txin.outputIndex;
    if (txinmap[inputid] != null) {
      return 'transaction input ' + i + ' duplicate input';
    }
    txinmap[inputid] = true;
  }

  var isCoinbase = this.isCoinbase();
  if (isCoinbase) {
    var buf = this.inputs[0]._scriptBuffer;
    if (buf.length < 2 || buf.length > 100) {
      return 'coinbase transaction script size invalid';
    }
  } else {
    for (i = 0; i < this.inputs.length; i++) {
      if (this.inputs[i].isNull()) {
        return 'transaction input ' + i + ' has null input';
      }
    }
  }
  return true;
};

/**
 * Analogous to bitcoind's IsCoinBase function in transaction.h
 */
Transaction.prototype.isCoinbase = function() {
  return (this.inputs.length === 1 && this.inputs[0].isNull());
};

/**
 * Determines if this transaction can be replaced in the mempool with another
 * transaction that provides a sufficiently higher fee (RBF).
 */
Transaction.prototype.isRBF = function() {
  for (var i = 0; i < this.inputs.length; i++) {
    var input = this.inputs[i];
    if (input.sequenceNumber < Input.MAXINT - 1) {
      return true;
    }
  }
  return false;
};

/**
 * Enable this transaction to be replaced in the mempool (RBF) if a transaction
 * includes a sufficiently higher fee. It will set the sequenceNumber to
 * DEFAULT_RBF_SEQNUMBER for all inputs if the sequence number does not
 * already enable RBF.
 */
Transaction.prototype.enableRBF = function() {
  for (var i = 0; i < this.inputs.length; i++) {
    var input = this.inputs[i];
    if (input.sequenceNumber >= Input.MAXINT - 1) {
      input.sequenceNumber = Input.DEFAULT_RBF_SEQNUMBER;
    }
  }
  return this;
};

Transaction.prototype.setVersion = function(version) {
  $.checkArgument(
    JSUtil.isNaturalNumber(version) && version <= CURRENT_VERSION,
    'Wrong version number');
  this.version = version;
  return this;
};



module.exports = Transaction;
