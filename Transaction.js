var imports = require('soop').imports();
var config = imports.config || require('./config');
var log = imports.log || require('./util/log');
var Address = imports.Address || require('./Address');
var Script = imports.Script || require('./Script');
var ScriptInterpreter = imports.ScriptInterpreter || require('./ScriptInterpreter');
var util = imports.util || require('./util/util');
var bignum = imports.bignum || require('bignum');
var Put = imports.Put || require('bufferput');
var Parser = imports.Parser || require('./util/BinaryParser');
var Step = imports.Step || require('step');
var buffertools = imports.buffertools || require('buffertools');
var error = imports.error || require('./util/error');
var networks = imports.networks || require('./networks');
var WalletKey = imports.WalletKey || require('./WalletKey');
var PrivateKey = imports.PrivateKey || require('./PrivateKey');

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

TransactionIn.prototype.getScript = function getScript() {
  return new Script(this.s);
};

TransactionIn.prototype.isCoinBase = function isCoinBase() {
  if (!this.o) return false;

  //The new Buffer is for Firefox compatibility
  return  buffertools.compare(new Buffer(this.o), COINBASE_OP) === 0;
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
this.class = Transaction;
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

var SIGHASH_ALL = 1;
var SIGHASH_NONE = 2;
var SIGHASH_SINGLE = 3;
var SIGHASH_ANYONECANPAY = 80;

Transaction.SIGHASH_ALL = SIGHASH_ALL;
Transaction.SIGHASH_NONE = SIGHASH_NONE;
Transaction.SIGHASH_SINGLE = SIGHASH_SINGLE;
Transaction.SIGHASH_ANYONECANPAY = SIGHASH_ANYONECANPAY;

Transaction.prototype.hashForSignature =
  function hashForSignature(script, inIndex, hashType) {
    if (+inIndex !== inIndex ||
      inIndex < 0 || inIndex >= this.ins.length) {
      throw new Error("Input index '" + inIndex + "' invalid or out of bounds " +
        "(" + this.ins.length + " inputs)");
    }

    // In case concatenating two scripts ends up with two codeseparators,
    // or an extra one at the end, this prevents all those possible
    // incompatibilities.
    script.findAndDelete(OP_CODESEPARATOR);

    // Get mode portion of hashtype
    var hashTypeMode = hashType & 0x1f;

    // Generate modified transaction data for hash
    var bytes = (new Put());
    bytes.word32le(this.version);

    // Serialize inputs
    if (hashType & SIGHASH_ANYONECANPAY) {
      // Blank out all inputs except current one, not recommended for open
      // transactions.
      bytes.varint(1);
      bytes.put(this.ins[inIndex].o);
      bytes.varint(script.buffer.length);
      bytes.put(script.buffer);
      bytes.word32le(this.ins[inIndex].q);
    } else {
      bytes.varint(this.ins.length);
      for (var i = 0, l = this.ins.length; i < l; i++) {
        var txin = this.ins[i];
        bytes.put(this.ins[i].o);

        // Current input's script gets set to the script to be signed, all others
        // get blanked.
        if (inIndex === i) {
          bytes.varint(script.buffer.length);
          bytes.put(script.buffer);
        } else {
          bytes.varint(0);
        }

        if (hashTypeMode === SIGHASH_NONE && inIndex !== i) {
          bytes.word32le(0);
        } else {
          bytes.word32le(this.ins[i].q);
        }
      }
    }

    // Serialize outputs
    if (hashTypeMode === SIGHASH_NONE) {
      bytes.varint(0);
    } else {
      var outsLen;
      if (hashTypeMode === SIGHASH_SINGLE) {
        if (inIndex >= this.outs.length) {
          // bug present in bitcoind which must be also present in bitcore
          // see https://bitcointalk.org/index.php?topic=260595
          // Transaction.hashForSignature(): SIGHASH_SINGLE 
          // no corresponding txout found - out of bounds
          var ret = new Buffer(1);
          ret.writeUInt8(1, 0);
          return ret; // return 1 bug
        }
        outsLen = inIndex + 1;
      } else {
        outsLen = this.outs.length;
      }

      // TODO: If hashTypeMode !== SIGHASH_SINGLE, we could memcpy this whole
      //       section from the original transaction as is.
      bytes.varint(outsLen);
      for (var i = 0; i < outsLen; i++) {
        if (hashTypeMode === SIGHASH_SINGLE && i !== inIndex) {
          // Zero all outs except the one we want to keep
          bytes.put(util.INT64_MAX);
          bytes.varint(0);
        } else {
          bytes.put(this.outs[i].v);
          bytes.varint(this.outs[i].s.length);
          bytes.put(this.outs[i].s);
        }
      }
    }

    bytes.word32le(this.lock_time);

    var buffer = bytes.buffer();

    // Append hashType
    buffer = Buffer.concat([buffer, new Buffer([parseInt(hashType), 0, 0, 0])]);

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
      }
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

Transaction.prototype.getSize = function getHash() {
  if (!this.size) {
    this.size = this.calcSize();
  }
  return this.size;
};


Transaction.prototype.countInputMissingSignatures = function(index) {
  var ret = 0;
  var script = new Script(this.ins[index].s);
  return script.countMissingSignatures();
};


Transaction.prototype.isInputComplete = function(index) {
  return this.countInputMissingSignatures(index)===0;
};

Transaction.prototype.isComplete = function() {
  var ret = true;
  var l   = this.ins.length;

  for (var i = 0; i < l; i++) {
    if (!this.isInputComplete(i)){
      ret = false;
      break;
    }
  }

  return ret;
};


module.exports = require('soop')(Transaction);
