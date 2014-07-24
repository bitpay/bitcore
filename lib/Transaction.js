var config = require('../config');
var log = require('../util/log');
var Address = require('./Address');
var Script = require('./Script');
var ScriptInterpreter = require('./ScriptInterpreter');
var util = require('../util');
var bignum = require('bignum');
var Put = require('bufferput');
var Parser = require('../util/BinaryParser');
var Step = require('step');
var buffertools = require('buffertools');
var error = require('../util/error');
var WalletKey = require('./WalletKey');
var PrivateKey = require('./PrivateKey');
var preconditions = require('preconditions').singleton();

var COINBASE_OP = Buffer.concat([util.NULL_HASH, new Buffer('FFFFFFFF', 'hex')]);
var FEE_PER_1000B_SAT = parseInt(0.0001 * util.COIN);

Transaction.COINBASE_OP = COINBASE_OP;

function TransactionIn(data) {
  if ("object" !== typeof data) {
    data = {};
  }
  if (data.o) {
    this.o = data.o;
  } else {
    if (data.oTxHash && typeof data.oIndex !== 'undefined' && data.oIndex >= 0) {
      var hash = new Buffer(data.oTxHash, 'hex');
      hash = buffertools.reverse(hash);
      var voutBuf = new Buffer(4);
      voutBuf.writeUInt32LE(data.oIndex, 0);
      this.o = Buffer.concat([hash, voutBuf]);
    }
  }
  this.s = Buffer.isBuffer(data.s) ? data.s :
    Buffer.isBuffer(data.script) ? data.script : util.EMPTY_BUFFER;
  this.q = data.q ? data.q : data.sequence;
}

TransactionIn.MAX_SEQUENCE = 0xffffffff;

TransactionIn.prototype.getScript = function getScript() {
  return new Script(this.s);
};

TransactionIn.prototype.isCoinBase = function isCoinBase() {
  if (!this.o) return false;

  //The new Buffer is for Firefox compatibility
  return buffertools.compare(new Buffer(this.o), COINBASE_OP) === 0;
};

TransactionIn.prototype.serialize = function serialize() {
  var slen = util.varIntBuf(this.s.length);
  var qbuf = new Buffer(4);
  qbuf.writeUInt32LE(this.q, 0);

  var ret = Buffer.concat([this.o, slen, this.s, qbuf]);
  return ret;
};

TransactionIn.prototype.getOutpointHash = function getOutpointHash() {
  if ("undefined" !== typeof this.o.outHashCache) {
    return this.o.outHashCache;
  }
  return this.o.outHashCache = this.o.slice(0, 32);
};

TransactionIn.prototype.getOutpointIndex = function getOutpointIndex() {
  return (this.o[32]) +
    (this.o[33] << 8) +
    (this.o[34] << 16) +
    (this.o[35] << 24);
};

TransactionIn.prototype.setOutpointIndex = function setOutpointIndex(n) {
  this.o[32] = n & 0xff;
  this.o[33] = n >> 8 & 0xff;
  this.o[34] = n >> 16 & 0xff;
  this.o[35] = n >> 24 & 0xff;
};


function TransactionOut(data) {
  if ("object" !== typeof data) {
    data = {};
  }
  this.v = data.v ? data.v : data.value;
  this.s = data.s ? data.s : data.script;
};

TransactionOut.prototype.getValue = function getValue() {
  return new Parser(this.v).word64lu();
};

TransactionOut.prototype.getScript = function getScript() {
  return new Script(this.s);
};

TransactionOut.prototype.serialize = function serialize() {
  var slen = util.varIntBuf(this.s.length);
  return Buffer.concat([this.v, slen, this.s]);
};

function Transaction(data) {
  if ("object" !== typeof data) {
    data = {};
  }
  this.hash = data.hash || null;
  this.version = data.version;
  this.lock_time = data.lock_time;
  this.ins = Array.isArray(data.ins) ? data.ins.map(function(data) {
    var txin = new TransactionIn();
    txin.s = data.s;
    txin.q = data.q;
    txin.o = data.o;
    return txin;
  }) : [];
  this.outs = Array.isArray(data.outs) ? data.outs.map(function(data) {
    var txout = new TransactionOut();
    txout.v = data.v;
    txout.s = data.s;
    return txout;
  }) : [];
  if (data.buffer) this._buffer = data.buffer;
};
Transaction.In = TransactionIn;
Transaction.Out = TransactionOut;

Transaction.prototype.isCoinBase = function() {
  return this.ins.length == 1 && this.ins[0].isCoinBase();
};

Transaction.prototype.isStandard = function isStandard() {
  var i;
  for (i = 0; i < this.ins.length; i++) {
    if (this.ins[i].getScript().getInType() == "Strange") {
      return false;
    }
  }
  for (i = 0; i < this.outs.length; i++) {
    if (this.outs[i].getScript().getOutType() == "Strange") {
      return false;
    }
  }
  return true;
};

Transaction.prototype.serialize = function serialize() {
  var bufs = [];

  var buf = new Buffer(4);
  buf.writeUInt32LE(this.version, 0);
  bufs.push(buf);

  bufs.push(util.varIntBuf(this.ins.length));
  this.ins.forEach(function(txin) {
    bufs.push(txin.serialize());
  });

  bufs.push(util.varIntBuf(this.outs.length));
  this.outs.forEach(function(txout) {
    bufs.push(txout.serialize());
  });

  var buf = new Buffer(4);
  buf.writeUInt32LE(this.lock_time, 0);
  bufs.push(buf);

  this._buffer = Buffer.concat(bufs);
  return this._buffer;
};

Transaction.prototype.getBuffer = function getBuffer() {
  if (this._buffer) return this._buffer;

  return this.serialize();
};

Transaction.prototype.calcHash = function calcHash() {
  this.hash = util.twoSha256(this.getBuffer());
  return this.hash;
};

Transaction.prototype.checkHash = function checkHash() {
  if (!this.hash || !this.hash.length) return false;

  return buffertools.compare(this.calcHash(), this.hash) === 0;
};

Transaction.prototype.getHash = function getHash() {
  if (!this.hash || !this.hash.length) {
    this.hash = this.calcHash();
  }
  return this.hash;
};


Transaction.prototype.calcNormalizedHash = function() {
  this.normalizedHash = this.hashForSignature(new Script(), 0, SIGHASH_ALL);
  return this.normalizedHash;
};


Transaction.prototype.getNormalizedHash = function() {
  if (!this.normalizedHash || !this.normalizedHash.length) {
    this.normalizedHash = this.calcNormalizedHash();
  }
  return this.normalizedHash;
};



// convert encoded list of inputs to easy-to-use JS list-of-lists
Transaction.prototype.inputs = function inputs() {
  var res = [];
  for (var i = 0; i < this.ins.length; i++) {
    var txin = this.ins[i];
    var outHash = txin.getOutpointHash();
    var outIndex = txin.getOutpointIndex();
    res.push([outHash, outIndex]);
  }

  return res;
};

Transaction.prototype.verifyInput = function verifyInput(n, scriptPubKey, opts, callback) {
  var scriptSig = this.ins[n].getScript();
  return ScriptInterpreter.verifyFull(
    scriptSig,
    scriptPubKey,
    this, n, 0,
    opts,
    callback);
};

/**
 * Returns an object containing all pubkey hashes affected by this transaction.
 *
 * The return object contains the base64-encoded pubKeyHash values as keys
 * and the original pubKeyHash buffers as values.
 */
Transaction.prototype.getAffectedKeys = function getAffectedKeys(txCache) {
  // TODO: Function won't consider results cached if there are no affected
  //       accounts.
  if (!(this.affects && this.affects.length)) {
    this.affects = [];

    // Index any pubkeys affected by the outputs of this transaction
    for (var i = 0, l = this.outs.length; i < l; i++) {
      var txout = this.outs[i];
      var script = txout.getScript();

      var outPubKey = script.simpleOutPubKeyHash();
      if (outPubKey) {
        this.affects.push(outPubKey);
      }
    };

    // Index any pubkeys affected by the inputs of this transaction
    var txIndex = txCache.txIndex;
    for (var i = 0, l = this.ins.length; i < l; i++) {
      var txin = this.ins[i];

      if (txin.isCoinBase()) continue;

      // In the case of coinbase or IP transactions, the txin doesn't
      // actually contain the pubkey, so we look at the referenced txout
      // instead.
      var outHash = txin.getOutpointHash();
      var outIndex = txin.getOutpointIndex();
      var outHashBase64 = outHash.toString('base64');
      var fromTxOuts = txIndex[outHashBase64];

      if (!fromTxOuts) {
        throw new Error("Input not found!");
      }

      var txout = fromTxOuts[outIndex];
      var script = txout.getScript();

      var outPubKey = script.simpleOutPubKeyHash();
      if (outPubKey) {
        this.affects.push(outPubKey);
      }
    }
  }

  var affectedKeys = {};

  this.affects.forEach(function(pubKeyHash) {
    affectedKeys[pubKeyHash.toString('base64')] = pubKeyHash;
  });

  return affectedKeys;
};

var OP_CODESEPARATOR = 171;

var SIGHASH_ALL = Transaction.SIGHASH_ALL = ScriptInterpreter.SIGHASH_ALL;
var SIGHASH_NONE = Transaction.SIGHASH_NONE = ScriptInterpreter.SIGHASH_NONE;
var SIGHASH_SINGLE = Transaction.SIGHASH_SINGLE = ScriptInterpreter.SIGHASH_SINGLE;
var SIGHASH_ANYONECANPAY = Transaction.SIGHASH_ANYONECANPAY = ScriptInterpreter.SIGHASH_ANYONECANPAY;

var TransactionSignatureSerializer = function(txTo, scriptCode, nIn, nHashType) {
  this.txTo = txTo;
  this.scriptCode = scriptCode;
  this.nIn = nIn;
  this.anyoneCanPay = !!(nHashType & SIGHASH_ANYONECANPAY);
  var hashTypeMode = nHashType & 0x1f;
  this.hashSingle = hashTypeMode === SIGHASH_SINGLE;
  this.hashNone = hashTypeMode === SIGHASH_NONE;
  this.bytes = new Put();
};

// serialize an output of txTo
TransactionSignatureSerializer.prototype.serializeOutput = function(nOutput) {
  if (this.hashSingle && nOutput != this.nIn) {
    // Do not lock-in the txout payee at other indices as txin
    // ::Serialize(s, CTxOut(), nType, nVersion);
    this.bytes.put(util.INT64_MAX);
    this.bytes.varint(0);
  } else {
    //::Serialize(s, txTo.vout[nOutput], nType, nVersion);
    var out = this.txTo.outs[nOutput];
    this.bytes.put(out.v);
    this.bytes.varint(out.s.length);
    this.bytes.put(out.s);
  }
};

// serialize the script
TransactionSignatureSerializer.prototype.serializeScriptCode = function() {
  this.scriptCode.findAndDelete(OP_CODESEPARATOR);
  this.bytes.varint(this.scriptCode.buffer.length);
  this.bytes.put(this.scriptCode.buffer);
};

// serialize an input of txTo
TransactionSignatureSerializer.prototype.serializeInput = function(nInput) {
  // In case of SIGHASH_ANYONECANPAY, only the input being signed is serialized
  if (this.anyoneCanPay) nInput = this.nIn;

  // Serialize the prevout
  this.bytes.put(this.txTo.ins[nInput].o);

  // Serialize the script
  if (nInput !== this.nIn) {
    // Blank out other inputs' signatures
    this.bytes.varint(0);
  } else {
    this.serializeScriptCode();
  }
  // Serialize the nSequence
  if (nInput !== this.nIn && (this.hashSingle || this.hashNone)) {
    // let the others update at will
    this.bytes.word32le(0);
  } else {
    this.bytes.word32le(this.txTo.ins[nInput].q);
  }

};


// serialize txTo for signature
TransactionSignatureSerializer.prototype.serialize = function() {
  // serialize nVersion
  this.bytes.word32le(this.txTo.version);
  // serialize vin
  var nInputs = this.anyoneCanPay ? 1 : this.txTo.ins.length;
  this.bytes.varint(nInputs);
  for (var nInput = 0; nInput < nInputs; nInput++) {
    this.serializeInput(nInput);
  }
  // serialize vout
  var nOutputs = this.hashNone ? 0 : (this.hashSingle ? this.nIn + 1 : this.txTo.outs.length);
  this.bytes.varint(nOutputs);
  for (var nOutput = 0; nOutput < nOutputs; nOutput++) {
    this.serializeOutput(nOutput);
  }

  // serialize nLockTime
  this.bytes.word32le(this.txTo.lock_time);
};

TransactionSignatureSerializer.prototype.buffer = function() {
  this.serialize();
  return this.bytes.buffer();
};

Transaction.Serializer = TransactionSignatureSerializer;

var oneBuffer = function() {
  // bug present in bitcoind which must be also present in bitcore
  // see https://bitcointalk.org/index.php?topic=260595
  var ret = new Buffer(32);
  ret.writeUInt8(1, 0);
  for (var i = 1; i < 32; i++) ret.writeUInt8(0, i);
  return ret; // return 1 bug
};

Transaction.prototype.getHashType = function(inIndex) {
  preconditions.checkArgument(inIndex < this.ins.length);
  var input = this.ins[inIndex];
  var scriptSig = input.getScript();
  return scriptSig.getHashType();
};

Transaction.prototype.hashForSignature =
  function hashForSignature(script, inIndex, hashType) {

    if (+inIndex !== inIndex ||
      inIndex < 0 || inIndex >= this.ins.length) {
      return oneBuffer();
    }
    // Check for invalid use of SIGHASH_SINGLE
    var hashTypeMode = hashType & 0x1f;
    if (hashTypeMode === SIGHASH_SINGLE) {
      if (inIndex >= this.outs.length) {
        return oneBuffer();
      }
    }

    // Wrapper to serialize only the necessary parts of the transaction being signed
    var serializer = new TransactionSignatureSerializer(this, script, inIndex, hashType);
    // Serialize
    var buffer = serializer.buffer();
    // Append hashType
    var hashBuf = new Put().word32le(hashType).buffer();
    buffer = Buffer.concat([buffer, hashBuf]);
    return util.twoSha256(buffer);
};

/**
 * Returns an object with the same field names as jgarzik's getblock patch.
 */
Transaction.prototype.getStandardizedObject = function getStandardizedObject() {
  var tx = {
    hash: util.formatHashFull(this.getHash()),
    version: this.version,
    lock_time: this.lock_time
  };

  var totalSize = 8; // version + lock_time
  totalSize += util.getVarIntSize(this.ins.length); // tx_in count
  var ins = this.ins.map(function(txin) {
    var txinObj = {
      prev_out: {
        hash: buffertools.reverse(new Buffer(txin.getOutpointHash())).toString('hex'),
        n: txin.getOutpointIndex()
      },
      sequence: txin.q
    };
    if (txin.isCoinBase()) {
      txinObj.coinbase = txin.s.toString('hex');
    } else {
      txinObj.scriptSig = new Script(txin.s).getStringContent(false, 0);
    }
    totalSize += 36 + util.getVarIntSize(txin.s.length) +
      txin.s.length + 4; // outpoint + script_len + script + sequence
    return txinObj;
  });

  totalSize += util.getVarIntSize(this.outs.length);
  var outs = this.outs.map(function(txout) {
    totalSize += util.getVarIntSize(txout.s.length) +
      txout.s.length + 8; // script_len + script + value
    return {
      value: util.formatValue(txout.v),
      scriptPubKey: new Script(txout.s).getStringContent(false, 0)
    };
  });

  tx.size = totalSize;

  tx["in"] = ins;
  tx["out"] = outs;

  return tx;
};

// Add some Mongoose compatibility functions to the plain object
Transaction.prototype.toObject = function toObject() {
  return this;
};

Transaction.prototype.fromObj = function fromObj(obj) {
  var txobj = {};
  txobj.version = obj.version || 1;
  txobj.lock_time = obj.lock_time || 0;
  txobj.ins = [];
  txobj.outs = [];

  obj.inputs.forEach(function(inputobj) {
    var txin = new TransactionIn();
    txin.s = util.EMPTY_BUFFER;
    txin.q = 0xffffffff;

    var hash = new Buffer(inputobj.txid, 'hex');
    hash = buffertools.reverse(hash);
    var vout = parseInt(inputobj.vout);
    var voutBuf = new Buffer(4);
    voutBuf.writeUInt32LE(vout, 0);

    txin.o = Buffer.concat([hash, voutBuf]);

    txobj.ins.push(txin);
  });

  var keys = Object.keys(obj.outputs);
  keys.forEach(function(addrStr) {
    var addr = new Address(addrStr);
    var script = Script.createPubKeyHashOut(addr.payload());

    var valueNum = bignum(obj.outputs[addrStr]);
    var value = util.bigIntToValue(valueNum);

    var txout = new TransactionOut();
    txout.v = value;
    txout.s = script.getBuffer();

    txobj.outs.push(txout);
  });

  this.lock_time = txobj.lock_time;
  this.version = txobj.version;
  this.ins = txobj.ins;
  this.outs = txobj.outs;
}

Transaction.prototype.parse = function(parser) {
  if (Buffer.isBuffer(parser)) {
    this._buffer = parser;
    parser = new Parser(parser);
  }

  var i, sLen, startPos = parser.pos;

  this.version = parser.word32le();

  var txinCount = parser.varInt();

  this.ins = [];
  for (j = 0; j < txinCount; j++) {
    var txin = new TransactionIn();
    txin.o = parser.buffer(36); // outpoint
    sLen = parser.varInt(); // script_len
    txin.s = parser.buffer(sLen); // script
    txin.q = parser.word32le(); // sequence
    this.ins.push(txin);
  }

  var txoutCount = parser.varInt();

  this.outs = [];
  for (j = 0; j < txoutCount; j++) {
    var txout = new TransactionOut();
    txout.v = parser.buffer(8); // value
    sLen = parser.varInt(); // script_len
    txout.s = parser.buffer(sLen); // script
    this.outs.push(txout);
  }

  this.lock_time = parser.word32le();
  this.calcHash();
};




Transaction.prototype.calcSize = function() {
  var totalSize = 8; // version + lock_time
  totalSize += util.getVarIntSize(this.ins.length); // tx_in count
  this.ins.forEach(function(txin) {
    totalSize += 36 + util.getVarIntSize(txin.s.length) +
      txin.s.length + 4; // outpoint + script_len + script + sequence
  });

  totalSize += util.getVarIntSize(this.outs.length);
  this.outs.forEach(function(txout) {
    totalSize += util.getVarIntSize(txout.s.length) +
      txout.s.length + 8; // script_len + script + value
  });
  this.size = totalSize;
  return totalSize;
};

Transaction.prototype.getSize = function() {
  if (!this.size) {
    this.size = this.calcSize();
  }
  return this.size;
};

Transaction.prototype.countInputSignatures = function(index) {
  var ret = 0;
  var script = new Script(this.ins[index].s);
  return script.countSignatures();
};

// Works on p2pubkey, p2pubkeyhash & p2sh (no normal multisig)
Transaction.prototype.countInputMissingSignatures = function(index) {
  var ret = 0;
  var script = new Script(this.ins[index].s);
  return script.countMissingSignatures();
};

// Works on p2pubkey, p2pubkeyhash & p2sh (no normal multisig)
Transaction.prototype.isInputComplete = function(index) {
  var m = this.countInputMissingSignatures(index);
  if (m === null) return null;
  return m === 0;
};

// Works on p2pubkey, p2pubkeyhash & p2sh (no normal multisig)
Transaction.prototype.isComplete = function() {
  var ret = true;
  var l = this.ins.length;

  for (var i = 0; i < l; i++) {
    if (!this.isInputComplete(i)) {
      ret = false;
      break;
    }
  }
  return ret;
};

Transaction.prototype.getReceivingAddresses = function(networkName) {
  if (!networkName) networkName = 'livenet';
  ret = [];
  for (var i = 0; i<this.outs.length; i++) {
    var o = this.outs[i];
    var addr = Address.fromScriptPubKey(o.getScript(), networkName)[0].toString();
    ret.push(addr);
  }
  return ret;
};
Transaction.prototype.getSendingAddresses = function(networkName) {
  var ret = [];
  if (!networkName) networkName = 'livenet';
  for (var i = 0; i<this.ins.length; i++) {
    var input = this.ins[i];
    var scriptSig = input.getScript();
    if (scriptSig.getBuffer().length === 0) {
      ret.push(null);
      continue;
    }
    var addr = Address.fromScriptSig(scriptSig, networkName);
    ret.push(addr?addr.toString():null);
  }
  return ret;
};


module.exports = Transaction;
