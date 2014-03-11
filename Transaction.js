var imports            = require('soop').imports();
var config             = imports.config || require('./config');
var log                = imports.log || require('./util/log');
var Address            = imports.Address || require('./Address');
var Script             = imports.Script || require('./Script');
var ScriptInterpreter  = imports.ScriptInterpreter || require('./ScriptInterpreter');
var util               = imports.util || require('./util/util');
var bignum             = imports.bignum || require('bignum');
var Put                = imports.Put || require('bufferput');
var Parser             = imports.Parser || require('./util/BinaryParser');
var Step               = imports.Step || require('step');
var buffertools        = imports.buffertools || require('buffertools');
var error              = imports.error || require('./util/error');
var networks           = imports.networks || require('./networks');
var WalletKey          = imports.WalletKey || require('./WalletKey');
var PrivateKey         = imports.PrivateKey || require('./PrivateKey');

var COINBASE_OP = Buffer.concat([util.NULL_HASH, new Buffer('FFFFFFFF', 'hex')]);
var FEE_PER_1000B_SAT = parseInt(0.0001 * util.COIN); 

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
  return buffertools.compare(this.o, COINBASE_OP) === 0;
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
  return (this.o[32]      ) +
         (this.o[33] <<  8) +
         (this.o[34] << 16) +
         (this.o[35] << 24);
};

TransactionIn.prototype.setOutpointIndex = function setOutpointIndex(n) {
  this.o[32] = n       & 0xff;
  this.o[33] = n >>  8 & 0xff;
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
  this.ins = Array.isArray(data.ins) ? data.ins.map(function (data) {
    var txin = new TransactionIn();
    txin.s = data.s;
    txin.q = data.q;
    txin.o = data.o;
    return txin;
  }) : [];
  this.outs = Array.isArray(data.outs) ? data.outs.map(function (data) {
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

Transaction.prototype.isCoinBase = function () {
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
  this.ins.forEach(function (txin) {
    bufs.push(txin.serialize());
  });

  bufs.push(util.varIntBuf(this.outs.length));
  this.outs.forEach(function (txout) {
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
  this.hash =  util.twoSha256(this.getBuffer());
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
}

/**
 * Load and cache transaction inputs.
 *
 * This function will try to load the inputs for a transaction.
 *
 * @param {BlockChain} blockChain A reference to the BlockChain object.
 * @param {TransactionMap|null} txStore Additional transactions to consider.
 * @param {Boolean} wait Whether to keep trying until the dependencies are
 * met (or a timeout occurs.)
 * @param {Function} callback Function to call on completion.
 */
Transaction.prototype.cacheInputs =
function cacheInputs(blockChain, txStore, wait, callback) {
  var self = this;

  var txCache = new TransactionInputsCache(this);
  txCache.buffer(blockChain, txStore, wait, callback);
};

Transaction.prototype.verify = function verify(txCache, blockChain, callback) {
  var self = this;

  var txIndex = txCache.txIndex;

  var outpoints = [];

  var valueIn = bignum(0);
  var valueOut = bignum(0);

  function getTxOut(txin, n) {
    var outHash = txin.getOutpointHash();
    var outIndex = txin.getOutpointIndex();
    var outHashBase64 = outHash.toString('base64');
    var fromTxOuts = txIndex[outHashBase64];

    if (!fromTxOuts) {
      throw new MissingSourceError(
        "Source tx " + util.formatHash(outHash) +
          " for inputs " + n  + " not found",
        // We store the hash of the missing tx in the error
        // so that the txStore can watch out for it.
        outHash.toString('base64')
      );
    }

    var txout = fromTxOuts[outIndex];

    if (!txout) {
      throw new Error("Source output index "+outIndex+
                      " for input "+n+" out of bounds");
    }

    return txout;
  };

  Step(
    function verifyInputs() {
      var group = this.group();

      if (self.isCoinBase()) {
        throw new Error("Coinbase tx are invalid unless part of a block");
      }

      self.ins.forEach(function (txin, n) {
        var txout = getTxOut(txin, n);

        // TODO: Verify coinbase maturity

        valueIn = valueIn.add(util.valueToBigInt(txout.v));

        outpoints.push(txin.o);

        self.verifyInput(n, txout.getScript(), group());
      });
    },

    function verifyInputsResults(err, results) {
      if (err) throw err;

      for (var i = 0, l = results.length; i < l; i++) {
        if (!results[i]) {
          var txout = getTxOut(self.ins[i]);
          log.debug('Script evaluated to false');
          log.debug('|- scriptSig', ""+self.ins[i].getScript());
          log.debug('`- scriptPubKey', ""+txout.getScript());
          throw new VerificationError('Script for input '+i+' evaluated to false');
        }
      }

      this();
    },

    function queryConflicts(err) {
      if (err) throw err;

      // Make sure there are no other transactions spending the same outs
      blockChain.countConflictingTransactions(outpoints, this);
    },
    function checkConflicts(err, count) {
      if (err) throw err;

      self.outs.forEach(function (txout) {
        valueOut = valueOut.add(util.valueToBigInt(txout.v));
      });

      if (valueIn.cmp(valueOut) < 0) {
        var outValue = util.formatValue(valueOut);
        var inValue = util.formatValue(valueIn);
        throw new Error("Tx output value (BTC "+outValue+") "+
                        "exceeds input value (BTC "+inValue+")");
      }

      var fees = valueIn.sub(valueOut);

      if (count) {
        // Spent output detected, retrieve transaction that spends it
        blockChain.getConflictingTransactions(outpoints, function (err, results) {
          if (results.length) {
            if (buffertools.compare(results[0].getHash(), self.getHash()) === 0) {
              log.warn("Detected tx re-add (recoverable db corruption): "
                          + util.formatHashAlt(results[0].getHash()));
              // TODO: Needs to return an error for the memory pool case?
              callback(null, fees);
            } else {
              callback(new Error("At least one referenced output has"
                                 + " already been spent in tx "
                                 + util.formatHashAlt(results[0].getHash())));
            }
          } else {
            callback(new Error("Outputs of this transaction are spent, but "+
                               "the transaction(s) that spend them are not "+
                               "available. This probably means you need to "+
                               "reset your database."));
          }
        });
        return;
      }

      // Success
      this(null, fees);
    },
    callback
  );
};

Transaction.prototype.verifyInput = function verifyInput(n, scriptPubKey, callback) {
  return ScriptInterpreter.verify(this.ins[n].getScript(),
                                  scriptPubKey,
                                  this, n, 0,
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
      try {
        var txout = this.outs[i];
        var script = txout.getScript();

        var outPubKey = script.simpleOutPubKeyHash();
        if (outPubKey) {
          this.affects.push(outPubKey);
        }
      } catch (err) {
        // It's not our job to validate, so we just ignore any errors and issue
        // a very low level log message.
        log.debug("Unable to determine affected pubkeys: " +
                     (err.stack ? err.stack : ""+err));
      }
    };

    // Index any pubkeys affected by the inputs of this transaction
    var txIndex = txCache.txIndex;
    for (var i = 0, l = this.ins.length; i < l; i++) {
      try {
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
      } catch (err) {
        // It's not our job to validate, so we just ignore any errors and issue
        // a very low level log message.
        log.debug("Unable to determine affected pubkeys: " +
                     (err.stack ? err.stack : ""+err));
      }
    }
  }

  var affectedKeys = {};

  this.affects.forEach(function (pubKeyHash) {
    affectedKeys[pubKeyHash.toString('base64')] = pubKeyHash;
  });

  return affectedKeys;
};

var OP_CODESEPARATOR = 171;

var SIGHASH_ALL = 1;
var SIGHASH_NONE = 2;
var SIGHASH_SINGLE = 3;
var SIGHASH_ANYONECANPAY = 80;

Transaction.SIGHASH_ALL=SIGHASH_ALL;
Transaction.SIGHASH_NONE=SIGHASH_NONE;
Transaction.SIGHASH_SINGLE=SIGHASH_SINGLE;
Transaction.SIGHASH_ANYONECANPAY=SIGHASH_ANYONECANPAY;

Transaction.prototype.hashForSignature =
function hashForSignature(script, inIndex, hashType) {
  if (+inIndex !== inIndex ||
      inIndex < 0 || inIndex >= this.ins.length) {
    throw new Error("Input index '"+inIndex+"' invalid or out of bounds "+
                    "("+this.ins.length+" inputs)");
  }

  // Clone transaction
  var txTmp = new Transaction();
  this.ins.forEach(function (txin, i) {
    txTmp.ins.push(new TransactionIn(txin));
  });
  this.outs.forEach(function (txout) {
    txTmp.outs.push(new TransactionOut(txout));
  });
  txTmp.version = this.version;
  txTmp.lock_time = this.lock_time;

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
      // TODO: Untested
      if (inIndex >= txTmp.outs.length) {
        throw new Error("Transaction.hashForSignature(): SIGHASH_SINGLE " +
                        "no corresponding txout found - out of bounds");
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
  var ins = this.ins.map(function (txin) {
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
  var outs = this.outs.map(function (txout) {
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

Transaction.prototype.parse = function (parser) {
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
    txin.o = parser.buffer(36);               // outpoint
    sLen = parser.varInt();                   // script_len
    txin.s = parser.buffer(sLen);             // script
    txin.q = parser.word32le();               // sequence
    this.ins.push(txin);
  }

  var txoutCount = parser.varInt();

  this.outs = [];
  for (j = 0; j < txoutCount; j++) {
    var txout = new TransactionOut();
    txout.v = parser.buffer(8);               // value
    sLen = parser.varInt();                   // script_len
    txout.s = parser.buffer(sLen);            // script
    this.outs.push(txout);
  }

  this.lock_time = parser.word32le();
  this.calcHash();
};



/*
 * selectUnspent
 *
 *  Selects some unspent outputs for later usage in tx inputs
 *
 * @utxos 
 * @totalNeededAmount: output transaction amount in BTC, including fee
 * @allowUnconfirmed: false (allow selecting unconfirmed utxos)
 *
 * Note that the sum of the selected unspent is >= the desired amount.
 * Returns the selected unspent outputs if the totalNeededAmount was reach. 
 * 'null' if not.
 *
 * TODO: utxo selection is not optimized to minimize mempool usage.
 *
 */

Transaction.selectUnspent = function (utxos, totalNeededAmount, allowUnconfirmed) {

  var minConfirmationSteps = [6,1];
  if (allowUnconfirmed) minConfirmationSteps.push(0);

  var ret = [];
  var l = utxos.length;
  var totalSat = bignum(0);
  var totalNeededAmountSat = util.parseValue(totalNeededAmount);
  var fulfill  = false;
  var maxConfirmations = null;

  do {
    var minConfirmations = minConfirmationSteps.shift();
    for(var i = 0; i<l; i++) {
      var u = utxos[i];

      var c = u.confirmations || 0;

      if ( c  < minConfirmations || (maxConfirmations && c >=maxConfirmations) ) 
        continue;


      var sat = u.amountSat || util.parseValue(u.amount);
      totalSat = totalSat.add(sat);
      ret.push(u);
      if(totalSat.cmp(totalNeededAmountSat) >= 0) {
        fulfill = true;
        break;
      }
    }
    maxConfirmations = minConfirmations;
  } while( !fulfill && minConfirmationSteps.length);

  //TODO(?): sort ret and check is some inputs can be avoided.
  //If the initial utxos are sorted, this step would be necesary only if
  //utxos were selected from different minConfirmationSteps.

  return fulfill ? ret : null;
}

/*
 * _scriptForAddress
 * 
 *  Returns a scriptPubKey for the given address type
 */

Transaction._scriptForAddress = function (addressString) {

  var livenet = networks.livenet;
  var testnet = networks.testnet;
  var address = new Address(addressString);

  var version = address.version();
  var script;
  if (version == livenet.addressPubkey || version == testnet.addressPubkey)
    script = Script.createPubKeyHashOut(address.payload());
  else if (version == livenet.addressScript || version == testnet.addressScript)
    script = Script.createP2SH(address.payload());
  else
    throw new Error('invalid output address');

  return script;
};

Transaction._sumOutputs = function(outs) {
  var valueOutSat = bignum(0);
  var l = outs.length;

  for(var i=0;i<outs.length;i++) {
    var sat = outs[i].amountSat || util.parseValue(outs[i].amount);
    valueOutSat = valueOutSat.add(sat);
  }
  return valueOutSat;
}

/*
 * createWithFee 
 *  Create a TX given ins (selected already), outs, and a FIXED fee
 *  details on the input on .create
 */

Transaction.createWithFee = function (ins, outs, feeSat, opts) {
  opts = opts || {};
  feeSat = feeSat ||  0;

  var txobj = {};
  txobj.version = 1;
  txobj.lock_time = opts.lockTime || 0;
  txobj.ins     = [];
  txobj.outs    = [];


  var l = ins.length;
  var valueInSat = bignum(0);
  for(var i=0; i<l; i++) {
    valueInSat = valueInSat.add(util.parseValue(ins[i].amount));

    var txin = {};
    txin.s = util.EMPTY_BUFFER;
    txin.q = 0xffffffff;

    var hash = new Buffer(ins[i].txid, 'hex');
    var hashReversed = buffertools.reverse(hash);

    var vout = parseInt(ins[i].vout);
    var voutBuf = new Buffer(4);
    voutBuf.writeUInt32LE(vout, 0);

    txin.o = Buffer.concat([hashReversed, voutBuf]);
    txobj.ins.push(txin); 
  }

  var valueOutSat = Transaction._sumOutputs(outs);
  valueOutSat = valueOutSat.add(feeSat);

  if (valueInSat.cmp(valueOutSat)<0) {
    var inv = valueInSat.toString();
    var ouv = valueOutSat.toString();
    throw new Error('transaction input amount is less than outputs: ' + 
                    inv + ' < '+ouv + ' [SAT]');
  }

  for(var i=0;i<outs.length;i++) {
    var amountSat = outs[i].amountSat || util.parseValue(outs[i].amount);
    var value = util.bigIntToValue(amountSat);
    var script = Transaction._scriptForAddress(outs[i].address);
    var txout = {
      v: value,
      s: script.getBuffer(),
    };
    txobj.outs.push(txout);
  }

  // add remainder (without modifiying outs[])
  var remainderSat = valueInSat.sub(valueOutSat);
  if (remainderSat.cmp(0)>0) {
    var remainderAddress = opts.remainderAddress || ins[0].address;
    var value = util.bigIntToValue(remainderSat);
    var script = Transaction._scriptForAddress(remainderAddress);
    var txout = {
      v: value,
      s: script.getBuffer(),
    };
    txobj.outs.push(txout);
  }


  return  new Transaction(txobj);
};

Transaction.prototype.calcSize = function () {
  var totalSize = 8; // version + lock_time
  totalSize += util.getVarIntSize(this.ins.length); // tx_in count
  this.ins.forEach(function (txin) {
    totalSize += 36 + util.getVarIntSize(txin.s.length) +
      txin.s.length + 4; // outpoint + script_len + script + sequence
  });

  totalSize += util.getVarIntSize(this.outs.length);
  this.outs.forEach(function (txout) {
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


Transaction.prototype.isComplete = function () {
  var l = this.ins.length;

  var ret = true;
  for (var i=0; i<l; i++) {
    if ( buffertools.compare(this.ins[i].s,util.EMPTY_BUFFER)===0 )  {
      ret = false;
      break;
    }
  };
  return ret;
};
 

/*
 * sign
 *
 *  signs the transaction
 *
 *  @ utxos
 *  @keypairs
 *  @opts
 *    signhash: Transaction.SIGHASH_ALL
 *
 *  Return the 'completeness' status of the tx (i.e, if all inputs are signed).
 *
 */

Transaction.prototype.sign = function (selectedUtxos, keys, opts) {
  var self = this;
  var complete = false;
  var m = keys.length;
  opts = opts || {};
  var signhash = opts.signhash || SIGHASH_ALL;

  if (selectedUtxos.length !== self.ins.length) 
    throw new Error('given selectedUtxos do not match tx inputs');

  var inputMap = [];
  var l = selectedUtxos.length;
  for(var i=0; i<l; i++) {
    inputMap[i]= {
      address: selectedUtxos[i].address, 
      scriptPubKey: selectedUtxos[i].scriptPubKey
    };
  }

  //prepare keys
  var walletKeyMap = {};
  var l = keys.length;
  var wk;
  for(var i=0; i<l; i++) {
    var k = keys[i];

    if (typeof k === 'string') {
      var pk = new PrivateKey(k);
      wk = new WalletKey({network: pk.network()});
      wk.fromObj({priv:k});
    }
    else if (k instanceof WalletKey) {
      wk = k;
    }
    else {
      throw new Error('argument must be an array of strings (WIF format) or WalletKey objects');
    }
    walletKeyMap[wk.storeObj().addr] = wk;
  }

  var inputSigned = 0;
  l = self.ins.length;
  for(var i=0;i<l;i++) {
    var aIn = self.ins[i];
    var wk = walletKeyMap[inputMap[i].address];

    if (typeof wk === 'undefined') {
      if ( buffertools.compare(aIn.s,util.EMPTY_BUFFER)!==0 ) 
        inputSigned++;
      continue;
    }
    var scriptBuf = new Buffer(inputMap[i].scriptPubKey, 'hex');
    var s = new Script(scriptBuf);
    if (s.classify() !==  Script.TX_PUBKEYHASH) {
      throw new Error('input:'+i+' script type:'+ s.getRawOutType() +' not supported yet');
    }

    var txSigHash = self.hashForSignature(s, i, signhash);

    var sigRaw;
    var triesLeft = 10;
    do {
      sigRaw = wk.privKey.signSync(txSigHash);
    } while ( wk.privKey.verifySignatureSync(txSigHash, sigRaw) === false && triesLeft-- );

    if (!triesLeft) {
      log.debug('could not sign input:'+i +' verification failed');
      continue;
    }

    var sigType = new Buffer(1);
    sigType[0] = signhash;
    var sig = Buffer.concat([sigRaw, sigType]);

    var scriptSig = new Script();
    scriptSig.chunks.push(sig);
    scriptSig.chunks.push(wk.privKey.public);
    scriptSig.updateBuffer();
    self.ins[i].s = scriptSig.getBuffer();
    inputSigned++;
  }
  var complete = inputSigned === l;
  return complete;
};

/*
 * create
 *
 *  creates a transaction without signing it.
 *
 *   @utxos
 *   @outs
 *   @opts
 *
 *  See createAndSign for documentation on the inputs
 *
 *   Returns:
 *     { tx: {}, selectedUtxos: []}
 *   see createAndSign for details
 *
 */

Transaction.create = function (utxos, outs, opts) {

    //starting size estimation
    var size    = 500;
    var opts    = opts || {};

    var givenFeeSat;
    if (opts.fee || opts.feeSat) {
      givenFeeSat = opts.fee ? opts.fee * util.COIN : opts.feeSat;
    }

    var selectedUtxos;
    do {
      // based on https://en.bitcoin.it/wiki/Transaction_fees
      maxSizeK     = parseInt(size/1000) + 1;
      var feeSat  = givenFeeSat
        ? givenFeeSat : maxSizeK * FEE_PER_1000B_SAT ;

      var valueOutSat = Transaction
        ._sumOutputs(outs)
        .add(feeSat);

      selectedUtxos = Transaction
        .selectUnspent(utxos,valueOutSat / util.COIN, opts.allowUnconfirmed);

      if (!selectedUtxos) {
        throw new Error(
          'the given UTXOs dont sum up the given outputs: ' 
          + valueOutSat.toString() 
          + ' (fee is ' + feeSat
          + ' )SAT'
        );
      }
      var tx = Transaction.createWithFee(selectedUtxos, outs, feeSat, {
        remainderAddress: opts.remainderAddress,
        lockTime: opts.lockTime,
      });

      size = tx.getSize();
    } while (size > (maxSizeK+1)*1000 );

    return {tx: tx, selectedUtxos: selectedUtxos};
};


/*
 * createAndSign
 *
 *  creates and signs a transaction
 *
 *  @utxos 
 *    unspent outputs array (UTXO), using the following format:
 *    [{
 *       address: "mqSjTad2TKbPcKQ3Jq4kgCkKatyN44UMgZ",
 *       hash: "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1",
 *       scriptPubKey: "76a9146ce4e1163eb18939b1440c42844d5f0261c0338288ac",
 *       vout: 1,
 *       amount: 0.01,                
 *       confirmations: 3
 *       }, ...
 *    ]
 * This is compatible con insight's utxo API. 
 * That amount is in BTCs (as returned in insight and bitcoind).
 * amountSat (instead of amount) can be given to provide amount in satochis.
 *

 *  @outs
 *    an array of [{
 *      address: xx, 
 *      amount:0.001
 *     },...]
 *
 *  @keys
 *     an array of strings representing private keys to sign the 
 *    transaction in WIF private key format OR WalletKey objects
 *
 *  @opts
 *    { 
 *      remainderAddress: null,
 *      fee: 0.001,
 *      lockTime: null,
 *      allowUnconfirmed: false,
 *      signhash: SIGHASH_ALL
 *    }
 *
 *
 *   Retuns:
 *   { 
 *      tx: The new created transaction,
 *      selectedUtxos: The UTXOs selected as inputs for this transaction
 *   }
 *
 *  Amounts are in BTC. instead of fee and amount; feeSat and amountSat can be given, 
 *  repectively, to provide amounts in satoshis.
 *
 *  If no remainderAddress is given, and there are remainder coins, the
 *  first IN address will be used to return the coins. (TODO: is this is reasonable?)
 *
 *  The Transaction creation is handled in 2 steps:
 *    .create
 *      .selectUnspent
 *      .createWithFee
 *    .sign
 *
 *  If you need just to create a TX and not sign it, use .create  
 *
 */

Transaction.createAndSign = function (utxos, outs, keys, opts) {
    var ret = Transaction.create(utxos, outs, opts);
    ret.tx.sign(ret.selectedUtxos, keys);
    return ret;
};

var TransactionInputsCache = exports.TransactionInputsCache =
function TransactionInputsCache(tx)
{
  var txList = [];
  var txList64 = [];
  var reqOuts = {};

  // Get list of transactions required for verification
  tx.ins.forEach(function (txin) {
    if (txin.isCoinBase()) return;

    var hash = txin.o.slice(0, 32);
    var hash64 = hash.toString('base64');
    if (txList64.indexOf(hash64) == -1) {
      txList.push(hash);
      txList64.push(hash64);
    }
    if (!reqOuts[hash64]) {
      reqOuts[hash64] = [];
    }
    reqOuts[hash64][txin.getOutpointIndex()] = true;
  });

  this.tx = tx;
  this.txList = txList;
  this.txList64 = txList64;
  this.txIndex = {};
  this.requiredOuts = reqOuts;
  this.callbacks = [];
};

TransactionInputsCache.prototype.buffer = function buffer(blockChain, txStore, wait, callback)
{
  var self = this;

  var complete = false;

  if ("function" === typeof callback) {
    self.callbacks.push(callback);
  }

  var missingTx = {};
  self.txList64.forEach(function (hash64) {
    missingTx[hash64] = true;
  });

  // A utility function to create the index object from the txs result lists
  function indexTxs(err, txs) {
    if (err) throw err;

    // Index memory transactions
    txs.forEach(function (tx) {
      var hash64 = tx.getHash().toString('base64');
      var obj = {};
      Object.keys(self.requiredOuts[hash64]).forEach(function (o) {
        obj[+o] = tx.outs[+o];
      });
      self.txIndex[hash64] = obj;
      delete missingTx[hash64];
    });

    this(null);
  };

  Step(
    // First find and index memory transactions (if a txStore was provided)
    function findMemTx() {
      if (txStore) {
        txStore.find(self.txList64, this);
      } else {
        this(null, []);
      }
    },
    indexTxs,
    // Second find and index persistent transactions
    function findBlockChainTx(err) {
      if (err) throw err;

      // TODO: Major speedup should be possible if we load only the outs and not
      //       whole transactions.
      var callback = this;
      blockChain.getOutputsByHashes(self.txList, function (err, result) {
        callback(err, result);
      });
    },
    indexTxs,
    function saveTxCache(err) {
      if (err) throw err;

      var missingTxDbg = '';
      if (Object.keys(missingTx).length) {
        missingTxDbg = Object.keys(missingTx).map(function (hash64) {
          return util.formatHash(new Buffer(hash64, 'base64'));
        }).join(',');
      }

      if (wait && Object.keys(missingTx).length) {
        // TODO: This might no longer be needed now that saveTransactions uses
        //       the safe=true option.
        setTimeout(function () {
          var missingHashes = Object.keys(missingTx);
          if (missingHashes.length) {
            self.callback(new Error('Missing inputs (timeout while searching): '
                                    + missingTxDbg));
          } else if (!complete) {
            self.callback(new Error('Callback failed to trigger'));
          }
        }, 10000);
      } else {
        complete = true;
        this(null, self);
      }
    },
    self.callback.bind(self)
  );
};


TransactionInputsCache.prototype.callback = function callback(err)
{
  var args = Array.prototype.slice.apply(arguments);

  // Empty the callback array first (because downstream functions could add new
  // callbacks or otherwise interfere if were not in a consistent state.)
  var cbs = this.callbacks;
  this.callbacks = [];

  try {
    cbs.forEach(function (cb) {
      cb.apply(null, args);
    });
  } catch (err) {
    log.err("Callback error after connecting tx inputs: "+
                 (err.stack ? err.stack : err.toString()));
  }
};

module.exports = require('soop')(Transaction);
