var Address = require('../address');
var BufferReader = require('../encoding/bufferreader');
var BufferWriter = require('../encoding/bufferwriter');
var Hash = require('../crypto/hash');
var Opcode = require('../opcode');
var PublicKey = require('../publickey');
var Signature = require('../crypto/signature');
var Networks = require('../networks');
var $ = require('../util/preconditions');
var _ = require('lodash');
var errors = require('../errors');
var buffer = require('buffer');
var BufferUtil = require('../util/buffer');
var JSUtil = require('../util/js');

/**
 * A bitcoin transaction script. Each transaction's inputs and outputs
 * has a script that is evaluated to validate it's spending.
 *
 * See https://en.bitcoin.it/wiki/Script
 *
 * @constructor
 * @param {Object|string|Buffer=} from optional data to populate script
 */
var Script = function Script(from) {
  if (!(this instanceof Script)) {
    return new Script(from);
  }
  this.chunks = [];

  if (BufferUtil.isBuffer(from)) {
    return Script.fromBuffer(from);
  } else if (from instanceof Address) {
    return Script.fromAddress(from);
  } else if (from instanceof Script) {
    return Script.fromBuffer(from.toBuffer());
  } else if (_.isString(from)) {
    return Script.fromString(from);
  } else if (_.isObject(from) && _.isArray(from.chunks)) {
    this.set(from);
  }
};

Script.prototype.set = function(obj) {
  $.checkArgument(_.isObject(obj));
  $.checkArgument(_.isArray(obj.chunks));
  this.chunks = obj.chunks;
  return this;
};

Script.fromBuffer = function(buffer) {
  var script = new Script();
  script.chunks = [];

  var br = new BufferReader(buffer);
  while (!br.finished()) {
    try {
      var opcodenum = br.readUInt8();

      var len, buf;
      if (opcodenum > 0 && opcodenum < Opcode.OP_PUSHDATA1) {
        len = opcodenum;
        script.chunks.push({
          buf: br.read(len),
          len: len,
          opcodenum: opcodenum
        });
      } else if (opcodenum === Opcode.OP_PUSHDATA1) {
        len = br.readUInt8();
        buf = br.read(len);
        script.chunks.push({
          buf: buf,
          len: len,
          opcodenum: opcodenum
        });
      } else if (opcodenum === Opcode.OP_PUSHDATA2) {
        len = br.readUInt16LE();
        buf = br.read(len);
        script.chunks.push({
          buf: buf,
          len: len,
          opcodenum: opcodenum
        });
      } else if (opcodenum === Opcode.OP_PUSHDATA4) {
        len = br.readUInt32LE();
        buf = br.read(len);
        script.chunks.push({
          buf: buf,
          len: len,
          opcodenum: opcodenum
        });
      } else {
        script.chunks.push({
          opcodenum: opcodenum
        });
      }
    } catch (e) {
      if (e instanceof RangeError) {
        throw new errors.Script.InvalidBuffer(buffer.toString('hex'));
      }
      throw e;
    }
  }

  return script;
};

Script.prototype.toBuffer = function() {
  var bw = new BufferWriter();

  for (var i = 0; i < this.chunks.length; i++) {
    var chunk = this.chunks[i];
    var opcodenum = chunk.opcodenum;
    bw.writeUInt8(chunk.opcodenum);
    if (chunk.buf) {
      if (opcodenum < Opcode.OP_PUSHDATA1) {
        bw.write(chunk.buf);
      } else if (opcodenum === Opcode.OP_PUSHDATA1) {
        bw.writeUInt8(chunk.len);
        bw.write(chunk.buf);
      } else if (opcodenum === Opcode.OP_PUSHDATA2) {
        bw.writeUInt16LE(chunk.len);
        bw.write(chunk.buf);
      } else if (opcodenum === Opcode.OP_PUSHDATA4) {
        bw.writeUInt32LE(chunk.len);
        bw.write(chunk.buf);
      }
    }
  }

  return bw.concat();
};

Script.fromASM = function(str) {
  var script = new Script();
  script.chunks = [];

  var tokens = str.split(' ');
  var i = 0;
  while (i < tokens.length) {
    var token = tokens[i];
    var opcode = Opcode(token);
    var opcodenum = opcode.toNumber();

    if (_.isUndefined(opcodenum)) {
      var buf = Buffer.from(tokens[i], 'hex');
      var opcodenum;
      var len = buf.length;
      if (len >= 0 && len < Opcode.OP_PUSHDATA1) {
        opcodenum = len;
      } else if (len < Math.pow(2, 8)) {
        opcodenum = Opcode.OP_PUSHDATA1;
      } else if (len < Math.pow(2, 16)) {
        opcodenum = Opcode.OP_PUSHDATA2;
      } else if (len < Math.pow(2, 32)) {
        opcodenum = Opcode.OP_PUSHDATA4;
      }
      script.chunks.push({
        buf: buf,
        len: buf.length,
        opcodenum: opcodenum
      });
      i = i + 1;
    } else {
      script.chunks.push({
        opcodenum: opcodenum
      });
      i = i + 1;
    }
  }
  return script;
};

Script.fromHex = function(str) {
  return new Script(Buffer.from(str, 'hex'));
};

Script.fromString = function(str) {
  if (JSUtil.isHexa(str) || str.length === 0) {
    return new Script(Buffer.from(str, 'hex'));
  }
  var script = new Script();
  script.chunks = [];

  var tokens = str.split(' ');
  var i = 0;
  while (i < tokens.length) {
    var token = tokens[i];
    var opcode = Opcode(token);
    var opcodenum = opcode.toNumber();

    if (_.isUndefined(opcodenum)) {
      opcodenum = parseInt(token);
      if (opcodenum > 0 && opcodenum < Opcode.OP_PUSHDATA1) {
        script.chunks.push({
          buf: Buffer.from(tokens[i + 1].slice(2), 'hex'),
          len: opcodenum,
          opcodenum: opcodenum
        });
        i = i + 2;
      } else {
        throw new Error('Invalid script: ' + JSON.stringify(str));
      }
    } else if (opcodenum === Opcode.OP_PUSHDATA1 ||
      opcodenum === Opcode.OP_PUSHDATA2 ||
      opcodenum === Opcode.OP_PUSHDATA4) {
      if (tokens[i + 2].slice(0, 2) !== '0x') {
        throw new Error('Pushdata data must start with 0x');
      }
      script.chunks.push({
        buf: Buffer.from(tokens[i + 2].slice(2), 'hex'),
        len: parseInt(tokens[i + 1]),
        opcodenum: opcodenum
      });
      i = i + 3;
    } else {
      script.chunks.push({
        opcodenum: opcodenum
      });
      i = i + 1;
    }
  }
  return script;
};

Script.prototype._chunkToString = function(chunk, type) {
  var opcodenum = chunk.opcodenum;
  var asm = (type === 'asm');
  var str = '';
  if (!chunk.buf) {
    // no data chunk
    if (typeof Opcode.reverseMap[opcodenum] !== 'undefined') {
      if (asm) {
        // A few cases where the opcode name differs from reverseMap
        // aside from 1 to 16 data pushes.
        if (opcodenum === 0) {
          // OP_0 -> 0
          str = str + ' 0';
        } else if(opcodenum === 79) {
          // OP_1NEGATE -> 1
          str = str + ' -1';
        } else {
          str = str + ' ' + Opcode(opcodenum).toString();
        }
      } else {
        str = str + ' ' + Opcode(opcodenum).toString();
      }
    } else {
      var numstr = opcodenum.toString(16);
      if (numstr.length % 2 !== 0) {
        numstr = '0' + numstr;
      }
      if (asm) {
        str = str + ' ' + numstr;
      } else {
        str = str + ' ' + '0x' + numstr;
      }
    }
  } else {
    // data chunk
    if (!asm && (opcodenum === Opcode.OP_PUSHDATA1 ||
      opcodenum === Opcode.OP_PUSHDATA2 ||
      opcodenum === Opcode.OP_PUSHDATA4)) {
      str = str + ' ' + Opcode(opcodenum).toString();
    }
    if (chunk.len > 0) {
      if (asm) {
        str = str + ' ' + chunk.buf.toString('hex');
      } else {
        str = str + ' ' + chunk.len + ' ' + '0x' + chunk.buf.toString('hex');
      }
    }
  }
  return str;
};

Script.prototype.toASM = function() {
  var str = '';
  for (var i = 0; i < this.chunks.length; i++) {
    var chunk = this.chunks[i];
    str += this._chunkToString(chunk, 'asm');
  }

  return str.substr(1);
};

Script.prototype.toString = function() {
  var str = '';
  for (var i = 0; i < this.chunks.length; i++) {
    var chunk = this.chunks[i];
    str += this._chunkToString(chunk);
  }

  return str.substr(1);
};

Script.prototype.toHex = function() {
  return this.toBuffer().toString('hex');
};

Script.prototype.inspect = function() {
  return '<Script: ' + this.toString() + '>';
};

// script classification methods

/**
 * @returns {boolean} if this is a pay to pubkey hash output script
 */
Script.prototype.isPublicKeyHashOut = function() {
  return !!(this.chunks.length === 5 &&
    this.chunks[0].opcodenum === Opcode.OP_DUP &&
    this.chunks[1].opcodenum === Opcode.OP_HASH160 &&
    this.chunks[2].buf &&
    this.chunks[2].buf.length === 20 &&
    this.chunks[3].opcodenum === Opcode.OP_EQUALVERIFY &&
    this.chunks[4].opcodenum === Opcode.OP_CHECKSIG);
};

/**
 * @returns {boolean} if this is a pay to public key hash input script
 */
Script.prototype.isPublicKeyHashIn = function() {
  if (this.chunks.length === 2) {
    var signatureBuf = this.chunks[0].buf;
    var pubkeyBuf = this.chunks[1].buf;
    if (signatureBuf &&
        signatureBuf.length &&
        pubkeyBuf &&
        pubkeyBuf.length
       ) {
      var version = pubkeyBuf[0];
      if ((version === 0x04 ||
           version === 0x06 ||
           version === 0x07) && pubkeyBuf.length === 65) {
        return true;
      } else if ((version === 0x03 || version === 0x02) && pubkeyBuf.length === 33) {
        return true;
      }
    }
  }
  return false;
};

Script.prototype.getPublicKey = function() {
  $.checkState(this.isPublicKeyOut(), 'Can\'t retrieve PublicKey from a non-PK output');
  return this.chunks[0].buf;
};

Script.prototype.getPublicKeyHash = function() {
  $.checkState(this.isPublicKeyHashOut(), 'Can\'t retrieve PublicKeyHash from a non-PKH output');
  return this.chunks[2].buf;
};

/**
 * @returns {boolean} if this is a public key output script
 */
Script.prototype.isPublicKeyOut = function() {
  if (this.chunks.length === 2 &&
      this.chunks[0].buf &&
      this.chunks[0].buf.length &&
      this.chunks[1].opcodenum === Opcode.OP_CHECKSIG) {
    var pubkeyBuf = this.chunks[0].buf;
    var version = pubkeyBuf[0];
    var isVersion = false;
    if ((version === 0x04 ||
         version === 0x06 ||
         version === 0x07) && pubkeyBuf.length === 65) {
      isVersion = true;
    } else if ((version === 0x03 || version === 0x02) && pubkeyBuf.length === 33) {
      isVersion = true;
    }
    if (isVersion) {
      return PublicKey.isValid(pubkeyBuf);
    }
  }
  return false;
};

/**
 * @returns {boolean} if this is a pay to public key input script
 */
Script.prototype.isPublicKeyIn = function() {
  if (this.chunks.length === 1) {
    var signatureBuf = this.chunks[0].buf;
    if (signatureBuf &&
        signatureBuf.length &&
        signatureBuf[0] === 0x30) {
      return true;
    }
  }
  return false;
};

/**
 * @returns {boolean} if this is a p2sh output script
 */
Script.prototype.isScriptHashOut = function() {
  var buf = this.toBuffer();
  return (buf.length === 23 &&
    buf[0] === Opcode.OP_HASH160 &&
    buf[1] === 0x14 &&
    buf[buf.length - 1] === Opcode.OP_EQUAL);
};

/**
 * @returns {boolean} if this is a p2sh input script
 * Note that these are frequently indistinguishable from pubkeyhashin
 */
Script.prototype.isScriptHashIn = function() {
  if (this.chunks.length <= 1) {
    return false;
  }
  var redeemChunk = this.chunks[this.chunks.length - 1];
  var redeemBuf = redeemChunk.buf;
  if (!redeemBuf) {
    return false;
  }

  var redeemScript;
  try {
    redeemScript = Script.fromBuffer(redeemBuf);
  } catch (e) {
    if (e instanceof errors.Script.InvalidBuffer) {
      return false;
    }
    throw e;
  }
  var type = redeemScript.classify();
  return type !== Script.types.UNKNOWN;
};

/**
 * @returns {boolean} if this is a mutlsig output script
 */
Script.prototype.isMultisigOut = function() {
  return (this.chunks.length > 3 &&
    Opcode.isSmallIntOp(this.chunks[0].opcodenum) &&
    this.chunks.slice(1, this.chunks.length - 2).every(function(obj) {
      return obj.buf && BufferUtil.isBuffer(obj.buf);
    }) &&
    Opcode.isSmallIntOp(this.chunks[this.chunks.length - 2].opcodenum) &&
    this.chunks[this.chunks.length - 1].opcodenum === Opcode.OP_CHECKMULTISIG);
};


/**
 * @returns {boolean} if this is a multisig input script
 */
Script.prototype.isMultisigIn = function() {
  return this.chunks.length >= 2 &&
    this.chunks[0].opcodenum === 0 &&
    this.chunks.slice(1, this.chunks.length).every(function(obj) {
      return obj.buf &&
        BufferUtil.isBuffer(obj.buf) &&
        Signature.isTxDER(obj.buf);
    });
};

/**
 * @returns {boolean} true if this is a valid standard OP_RETURN output
 */
Script.prototype.isDataOut = function() {
  var step1 = this.chunks.length >= 1 &&
    this.chunks[0].opcodenum === Opcode.OP_RETURN &&
    this.toBuffer().length <= 223; // 223 instead of 220 because (+1 for OP_RETURN, +2 for the pushdata opcodes)
  if (!step1) return false;
  var chunks = this.chunks.slice(1);
  var script2 = new Script({chunks: chunks});
  return script2.isPushOnly();
};

/**
 * Retrieve the associated data for this script.
 * In the case of a pay to public key hash or P2SH, return the hash.
 * In the case of a standard OP_RETURN, return the data
 * @returns {Buffer}
 */
Script.prototype.getData = function() {
  if (this.isDataOut() || this.isScriptHashOut()) {
    if (_.isUndefined(this.chunks[1])) {
      return Buffer.alloc(0);
    } else {
      return Buffer.from(this.chunks[1].buf);
    }
  }
  if (this.isPublicKeyHashOut()) {
    return Buffer.from(this.chunks[2].buf);
  }
  throw new Error('Unrecognized script type to get data from');
};

/**
 * @returns {boolean} if the script is only composed of data pushing
 * opcodes or small int opcodes (OP_0, OP_1, ..., OP_16)
 */
Script.prototype.isPushOnly = function() {
  return _.every(this.chunks, function(chunk) {
    return chunk.opcodenum <= Opcode.OP_16 ||
      chunk.opcodenum === Opcode.OP_PUSHDATA1 ||
      chunk.opcodenum === Opcode.OP_PUSHDATA2 ||
      chunk.opcodenum === Opcode.OP_PUSHDATA4;
  });
};


Script.types = {};
Script.types.UNKNOWN = 'Unknown';
Script.types.PUBKEY_OUT = 'Pay to public key';
Script.types.PUBKEY_IN = 'Spend from public key';
Script.types.PUBKEYHASH_OUT = 'Pay to public key hash';
Script.types.PUBKEYHASH_IN = 'Spend from public key hash';
Script.types.SCRIPTHASH_OUT = 'Pay to script hash';
Script.types.SCRIPTHASH_IN = 'Spend from script hash';
Script.types.MULTISIG_OUT = 'Pay to multisig';
Script.types.MULTISIG_IN = 'Spend from multisig';
Script.types.DATA_OUT = 'Data push';

Script.OP_RETURN_STANDARD_SIZE = 220;

/**
 * @returns {object} The Script type if it is a known form,
 * or Script.UNKNOWN if it isn't
 */
Script.prototype.classify = function() {
  if (this._isInput) {
    return this.classifyInput();
  } else if (this._isOutput) {
    return this.classifyOutput();
  } else {
    var outputType = this.classifyOutput();
    return outputType != Script.types.UNKNOWN ? outputType : this.classifyInput();
  }
};

Script.outputIdentifiers = {};
Script.outputIdentifiers.PUBKEY_OUT = Script.prototype.isPublicKeyOut;
Script.outputIdentifiers.PUBKEYHASH_OUT = Script.prototype.isPublicKeyHashOut;
Script.outputIdentifiers.MULTISIG_OUT = Script.prototype.isMultisigOut;
Script.outputIdentifiers.SCRIPTHASH_OUT = Script.prototype.isScriptHashOut;
Script.outputIdentifiers.DATA_OUT = Script.prototype.isDataOut;

/**
 * @returns {object} The Script type if it is a known form,
 * or Script.UNKNOWN if it isn't
 */
Script.prototype.classifyOutput = function() {
  for (var type in Script.outputIdentifiers) {
    if (Script.outputIdentifiers[type].bind(this)()) {
      return Script.types[type];
    }
  }
  return Script.types.UNKNOWN;
};

Script.inputIdentifiers = {};
Script.inputIdentifiers.PUBKEY_IN = Script.prototype.isPublicKeyIn;
Script.inputIdentifiers.PUBKEYHASH_IN = Script.prototype.isPublicKeyHashIn;
Script.inputIdentifiers.MULTISIG_IN = Script.prototype.isMultisigIn;
Script.inputIdentifiers.SCRIPTHASH_IN = Script.prototype.isScriptHashIn;

/**
 * @returns {object} The Script type if it is a known form,
 * or Script.UNKNOWN if it isn't
 */
Script.prototype.classifyInput = function() {
  for (var type in Script.inputIdentifiers) {
    if (Script.inputIdentifiers[type].bind(this)()) {
      return Script.types[type];
    }
  }
  return Script.types.UNKNOWN;
};


/**
 * @returns {boolean} if script is one of the known types
 */
Script.prototype.isStandard = function() {
  // TODO: Add BIP62 compliance
  return this.classify() !== Script.types.UNKNOWN;
};


// Script construction methods

/**
 * Adds a script element at the start of the script.
 * @param {*} obj a string, number, Opcode, Buffer, or object to add
 * @returns {Script} this script instance
 */
Script.prototype.prepend = function(obj) {
  this._addByType(obj, true);
  return this;
};

/**
 * Compares a script with another script
 */
Script.prototype.equals = function(script) {
  $.checkState(script instanceof Script, 'Must provide another script');
  if (this.chunks.length !== script.chunks.length) {
    return false;
  }
  var i;
  for (i = 0; i < this.chunks.length; i++) {
    if (BufferUtil.isBuffer(this.chunks[i].buf) && !BufferUtil.isBuffer(script.chunks[i].buf)) {
      return false;
    }
    if (BufferUtil.isBuffer(this.chunks[i].buf) && !BufferUtil.equals(this.chunks[i].buf, script.chunks[i].buf)) {
      return false;
    } else if (this.chunks[i].opcodenum !== script.chunks[i].opcodenum) {
      return false;
    }
  }
  return true;
};

/**
 * Adds a script element to the end of the script.
 *
 * @param {*} obj a string, number, Opcode, Buffer, or object to add
 * @returns {Script} this script instance
 *
 */
Script.prototype.add = function(obj) {
  this._addByType(obj, false);
  return this;
};

Script.prototype._addByType = function(obj, prepend) {
  if (typeof obj === 'string') {
    this._addOpcode(obj, prepend);
  } else if (typeof obj === 'number') {
    this._addOpcode(obj, prepend);
  } else if (obj instanceof Opcode) {
    this._addOpcode(obj, prepend);
  } else if (BufferUtil.isBuffer(obj)) {
    this._addBuffer(obj, prepend);
  } else if (obj instanceof Script) {
    this.chunks = this.chunks.concat(obj.chunks);
  } else if (typeof obj === 'object') {
    this._insertAtPosition(obj, prepend);
  } else {
    throw new Error('Invalid script chunk');
  }
};

Script.prototype._insertAtPosition = function(op, prepend) {
  if (prepend) {
    this.chunks.unshift(op);
  } else {
    this.chunks.push(op);
  }
};

Script.prototype._addOpcode = function(opcode, prepend) {
  var op;
  if (typeof opcode === 'number') {
    op = opcode;
  } else if (opcode instanceof Opcode) {
    op = opcode.toNumber();
  } else {
    op = Opcode(opcode).toNumber();
  }
  this._insertAtPosition({
    opcodenum: op
  }, prepend);
  return this;
};

Script.prototype._addBuffer = function(buf, prepend) {
  var opcodenum;
  var len = buf.length;
  if (len >= 0 && len < Opcode.OP_PUSHDATA1) {
    opcodenum = len;
  } else if (len < Math.pow(2, 8)) {
    opcodenum = Opcode.OP_PUSHDATA1;
  } else if (len < Math.pow(2, 16)) {
    opcodenum = Opcode.OP_PUSHDATA2;
  } else if (len < Math.pow(2, 32)) {
    opcodenum = Opcode.OP_PUSHDATA4;
  } else {
    throw new Error('You can\'t push that much data');
  }
  this._insertAtPosition({
    buf: buf,
    len: len,
    opcodenum: opcodenum
  }, prepend);
  return this;
};


Script.prototype.removeCodeseparators = function() {
  var chunks = [];
  for (var i = 0; i < this.chunks.length; i++) {
    if (this.chunks[i].opcodenum !== Opcode.OP_CODESEPARATOR) {
      chunks.push(this.chunks[i]);
    }
  }
  this.chunks = chunks;
  return this;
};

// high level script builder methods

/**
 * @returns {Script} a new Multisig output script for given public keys,
 * requiring m of those public keys to spend
 * @param {PublicKey[]} publicKeys - list of all public keys controlling the output
 * @param {number} threshold - amount of required signatures to spend the output
 * @param {Object=} opts - Several options:
 *        - noSorting: defaults to false, if true, don't sort the given
 *                      public keys before creating the script
 */
Script.buildMultisigOut = function(publicKeys, threshold, opts) {
  $.checkArgument(threshold <= publicKeys.length,
    'Number of required signatures must be less than or equal to the number of public keys');
  opts = opts || {};
  var script = new Script();
  script.add(Opcode.smallInt(threshold));
  publicKeys = _.map(publicKeys, PublicKey);
  var sorted = publicKeys;
  if (!opts.noSorting) {
    sorted = _.sortBy(publicKeys, function(publicKey) {
      return publicKey.toString('hex');
    });
  }
  for (var i = 0; i < sorted.length; i++) {
    var publicKey = sorted[i];
    script.add(publicKey.toBuffer());
  }
  script.add(Opcode.smallInt(publicKeys.length));
  script.add(Opcode.OP_CHECKMULTISIG);
  return script;
};

/**
 * A new Multisig input script for the given public keys, requiring m of those public keys to spend
 *
 * @param {PublicKey[]} pubkeys list of all public keys controlling the output
 * @param {number} threshold amount of required signatures to spend the output
 * @param {Array} signatures and array of signature buffers to append to the script
 * @param {Object=} opts
 * @param {boolean=} opts.noSorting don't sort the given public keys before creating the script (false by default)
 * @param {Script=} opts.cachedMultisig don't recalculate the redeemScript
 *
 * @returns {Script}
 */
Script.buildMultisigIn = function(pubkeys, threshold, signatures, opts) {
  $.checkArgument(_.isArray(pubkeys));
  $.checkArgument(_.isNumber(threshold));
  $.checkArgument(_.isArray(signatures));
  opts = opts || {};
  var s = new Script();

  if (opts.signingMethod === "schnorr" && opts.checkBits) {

    // Spec according to https://github.com/bitcoincashorg/bitcoincash.org/blob/master/spec/2019-11-15-schnorrmultisig.md#scriptsig-size
    let checkBitsString = Buffer.from(opts.checkBits).reverse().join('');
    let checkBitsDecimal = parseInt(checkBitsString, 2);
    let checkBitsHex = parseInt(checkBitsDecimal.toString(16), 16);
    let N = pubkeys.length;
      // N should only be 1-20
        if (N >= 1 && N <= 4) {
          s.add(Opcode(checkBitsHex));
        }
        else if (N >= 5 && N <= 8) {
        if(checkBitsHex === 0x81) {
            s.add(Opcode("OP_1NEGATE")) // OP_1NEGATE
          } else if(checkBitsHex > 0x10) {
            s.add(0x01);
            s.add(checkBitsHex);
          } else {
            s.add(Opcode(checkBitsHex));
          }
          
        }
        else if (N >= 9 && N <= 16) {
          s.add(0x02);
          s.add(checkBitsHex);
        } 
        else if (N >= 17 && N <= 20) {
          s.add(0x03);
          s.add(checkBitsHex);
        }
    } else {
      s.add(Opcode.OP_0); // ecdsa schnorr mode; multisig dummy param of 0
    }
  
  
  _.each(signatures, function(signature) {
    $.checkArgument(BufferUtil.isBuffer(signature), 'Signatures must be an array of Buffers');
    // TODO: allow signatures to be an array of Signature objects
    s.add(signature);
  });
  return s;
};

/**
 * A new P2SH Multisig input script for the given public keys, requiring m of those public keys to spend
 *
 * @param {PublicKey[]} pubkeys list of all public keys controlling the output
 * @param {number} threshold amount of required signatures to spend the output
 * @param {Array} signatures and array of signature buffers to append to the script
 * @param {Object=} opts
 * @param {boolean=} opts.noSorting don't sort the given public keys before creating the script (false by default)
 * @param {Script=} opts.cachedMultisig don't recalculate the redeemScript
 * @param {Uint8Array} opts.checkBits bitfield map 1 or 0 to check which signatures to map against public keys for verification in schnorr multisig mode
 * @param {String} opts.signingMethod method with which input will be signed "ecdsa" or "schnorr"
 *
 * @returns {Script}
 */
Script.buildP2SHMultisigIn = function(pubkeys, threshold, signatures, opts) {
  $.checkArgument(_.isArray(pubkeys));
  $.checkArgument(_.isNumber(threshold));
  $.checkArgument(_.isArray(signatures));
  opts = opts || {};
  var s = new Script();
  
  if (opts.signingMethod === "schnorr" && opts.checkBits) {

    // Spec according to https://github.com/bitcoincashorg/bitcoincash.org/blob/master/spec/2019-11-15-schnorrmultisig.md#scriptsig-size
    let checkBitsString = Buffer.from(opts.checkBits).reverse().join('');
    let checkBitsDecimal = parseInt(checkBitsString, 2);
    let checkBitsHex = parseInt(checkBitsDecimal.toString(16), 16);
    let N = pubkeys.length;
    // N should only be 1-20
      if (N >= 1 && N <= 4) {
        s.add(Opcode.smallInt(checkBitsDecimal));
      }
      else if (N >= 5 && N <= 8) {
       if(checkBitsHex === 0x81) {
          s.add(Opcode("OP_1NEGATE")) // OP_1NEGATE
        } else if(checkBitsHex > 0x10) {
          s.add(0x01);
          s.add(checkBitsHex);
        } else {
          s.add(Opcode.smallInt(checkBitsDecimal));
        }
      }
      else if (N >= 9 && N <= 16) {
        s.add(0x02);
        s.add(checkBitsHex);
      } 
      else if (N >= 17 && N <= 20) {
        s.add(0x03);
        s.add(checkBitsHex);
      }
  } else {
    s.add(Opcode.OP_0); // ecdsa schnorr mode; multisig dummy param of 0
  }
  
  _.each(signatures, function(signature) {
    $.checkArgument(BufferUtil.isBuffer(signature), 'Signatures must be an array of Buffers');
    // TODO: allow signatures to be an array of Signature objects
    s.add(signature);
  });
  s.add((opts.cachedMultisig || Script.buildMultisigOut(pubkeys, threshold, opts)).toBuffer());
  return s;
};

/**
 * @returns {Script} a new pay to public key hash output for the given
 * address or public key
 * @param {(Address|PublicKey)} to - destination address or public key
 */
Script.buildPublicKeyHashOut = function(to) {
  $.checkArgument(!_.isUndefined(to));
  $.checkArgument(to instanceof PublicKey || to instanceof Address || _.isString(to));
  if (to instanceof PublicKey) {
    to = to.toAddress();
  } else if (_.isString(to)) {
    to = new Address(to);
  }
  var s = new Script();
  s.add(Opcode.OP_DUP)
    .add(Opcode.OP_HASH160)
    .add(to.hashBuffer)
    .add(Opcode.OP_EQUALVERIFY)
    .add(Opcode.OP_CHECKSIG);
  s._network = to.network;
  return s;
};

/**
 * @returns {Script} a new pay to public key output for the given
 *  public key
 */
Script.buildPublicKeyOut = function(pubkey) {
  $.checkArgument(pubkey instanceof PublicKey);
  var s = new Script();
  s.add(pubkey.toBuffer())
    .add(Opcode.OP_CHECKSIG);
  return s;
};

/**
 * @returns {Script} a new OP_RETURN script with data
 * @param {(string|Buffer)} data - the data to embed in the output
 * @param {(string)} encoding - the type of encoding of the string
 */
Script.buildDataOut = function(data, encoding) {
  $.checkArgument(_.isUndefined(data) || _.isString(data) || BufferUtil.isBuffer(data));
  if (_.isString(data)) {
    data = Buffer.from(data, encoding);
  }
  var s = new Script();
  s.add(Opcode.OP_RETURN);
  if (!_.isUndefined(data)) {
    s.add(data);
  }
  return s;
};

/**
 * @param {Script|Address} script - the redeemScript for the new p2sh output.
 *    It can also be a p2sh address
 * @returns {Script} new pay to script hash script for given script
 */
Script.buildScriptHashOut = function(script) {
  $.checkArgument(script instanceof Script ||
    (script instanceof Address && script.isPayToScriptHash()));
  var s = new Script();
  s.add(Opcode.OP_HASH160)
    .add(script instanceof Address ? script.hashBuffer : Hash.sha256ripemd160(script.toBuffer()))
    .add(Opcode.OP_EQUAL);

  s._network = script._network || script.network;
  return s;
};

/**
 * Builds a scriptSig (a script for an input) that signs a public key output script.
 *
 * @param {Signature|Buffer} signature - a Signature object, or the signature in DER canonical encoding
 * @param {number=} sigtype - the type of the signature (defaults to SIGHASH_ALL)
 */
Script.buildPublicKeyIn = function(signature, sigtype) {
  $.checkArgument(signature instanceof Signature || BufferUtil.isBuffer(signature));
  $.checkArgument(_.isUndefined(sigtype) || _.isNumber(sigtype));
  if (signature instanceof Signature) {
    signature = signature.toBuffer();
  }
  var script = new Script();
  script.add(BufferUtil.concat([
    signature,
    BufferUtil.integerAsSingleByteBuffer(sigtype || Signature.SIGHASH_ALL)
  ]));
  return script;
};

/**
 * Builds a scriptSig (a script for an input) that signs a public key hash
 * output script.
 *
 * @param {Buffer|string|PublicKey} publicKey
 * @param {Signature|Buffer} signature - a Signature object, or the signature in DER canonical encoding
 * @param {number=} sigtype - the type of the signature (defaults to SIGHASH_ALL)
 */
Script.buildPublicKeyHashIn = function(publicKey, signature, sigtype) {
  $.checkArgument(signature instanceof Signature || BufferUtil.isBuffer(signature));
  $.checkArgument(_.isUndefined(sigtype) || _.isNumber(sigtype));
  if (signature instanceof Signature) {
    signature = signature.toBuffer();
  }
  var script = new Script()
    .add(BufferUtil.concat([
      signature,
      BufferUtil.integerAsSingleByteBuffer(sigtype || Signature.SIGHASH_ALL)
    ]))
    .add(new PublicKey(publicKey).toBuffer());
  return script;
};

/**
 * @returns {Script} an empty script
 */
Script.empty = function() {
  return new Script();
};

/**
 * @returns {Script} a new pay to script hash script that pays to this script
 */
Script.prototype.toScriptHashOut = function() {
  return Script.buildScriptHashOut(this);
};

/**
 * @return {Script} an output script built from the address
 */
Script.fromAddress = function(address) {
  address = Address(address);
  if (address.isPayToScriptHash()) {
    return Script.buildScriptHashOut(address);
  } else if (address.isPayToPublicKeyHash()) {
    return Script.buildPublicKeyHashOut(address);
  }
  throw new errors.Script.UnrecognizedAddress(address);
};

/**
 * Will return the associated address information object
 * @return {Address|boolean}
 */
Script.prototype.getAddressInfo = function(opts) {
  if (this._isInput) {
    return this._getInputAddressInfo();
  } else if (this._isOutput) {
    return this._getOutputAddressInfo();
  } else {
    var info = this._getOutputAddressInfo();
    if (!info) {
      return this._getInputAddressInfo();
    }
    return info;
  }
};

/**
 * Will return the associated output scriptPubKey address information object
 * @return {Address|boolean}
 * @private
 */
Script.prototype._getOutputAddressInfo = function() {
  var info = {};
  if (this.isScriptHashOut()) {
    info.hashBuffer = this.getData();
    info.type = Address.PayToScriptHash;
  } else if (this.isPublicKeyHashOut()) {
    info.hashBuffer = this.getData();
    info.type = Address.PayToPublicKeyHash;
  } else {
    return false;
  }
  return info;
};

/**
 * Will return the associated input scriptSig address information object
 * @return {Address|boolean}
 * @private
 */
Script.prototype._getInputAddressInfo = function() {
  var info = {};
  if (this.isPublicKeyHashIn()) {
    // hash the publickey found in the scriptSig
    info.hashBuffer = Hash.sha256ripemd160(this.chunks[1].buf);
    info.type = Address.PayToPublicKeyHash;
  } else if (this.isScriptHashIn()) {
    // hash the redeemscript found at the end of the scriptSig
    info.hashBuffer = Hash.sha256ripemd160(this.chunks[this.chunks.length - 1].buf);
    info.type = Address.PayToScriptHash;
  } else {
    return false;
  }
  return info;
};

/**
 * @param {Network=} network
 * @return {Address|boolean} the associated address for this script if possible, or false
 */
Script.prototype.toAddress = function(network) {
  var info = this.getAddressInfo();
  if (!info) {
    return false;
  }
  info.network = Networks.get(network) || this._network || Networks.defaultNetwork;
  return new Address(info);
};

/**
 * Analogous to bitcoind's FindAndDelete. Find and delete equivalent chunks,
 * typically used with push data chunks.  Note that this will find and delete
 * not just the same data, but the same data with the same push data op as
 * produced by default. i.e., if a pushdata in a tx does not use the minimal
 * pushdata op, then when you try to remove the data it is pushing, it will not
 * be removed, because they do not use the same pushdata op.
 */
Script.prototype.findAndDelete = function(script) {
  var buf = script.toBuffer();
  var hex = buf.toString('hex');
  for (var i = 0; i < this.chunks.length; i++) {
    var script2 = Script({
      chunks: [this.chunks[i]]
    });
    var buf2 = script2.toBuffer();
    var hex2 = buf2.toString('hex');
    if (hex === hex2) {
      this.chunks.splice(i, 1);
    }
  }
  return this;
};

/**
 * Comes from bitcoind's script interpreter CheckMinimalPush function
 * @returns {boolean} if the chunk {i} is the smallest way to push that particular data.
 */
Script.prototype.checkMinimalPush = function(i) {
  var chunk = this.   chunks[i];
  var buf = chunk.buf;
  var opcodenum = chunk.opcodenum;
  if (!buf) {
    return true;
  }
  if (buf.length === 0) {
    // Could have used OP_0.
    return opcodenum === Opcode.OP_0;
  } else if (buf.length === 1 && buf[0] >= 1 && buf[0] <= 16) {
    // Could have used OP_1 .. OP_16.
    // return opcodenum === Opcode.OP_1 + (buf[0] - 1);
    return false;
  } else if (buf.length === 1 && buf[0] === 0x81) {
    // Could have used OP_1NEGATE
    return false;
  } else if (buf.length <= 75) {
    // Could have used a direct push (opcode indicating number of bytes pushed + those bytes).
    return opcodenum === buf.length;
  } else if (buf.length <= 255) {
    // Could have used OP_PUSHDATA.
    return opcodenum === Opcode.OP_PUSHDATA1;
  } else if (buf.length <= 65535) {
    // Could have used OP_PUSHDATA2.
    return opcodenum === Opcode.OP_PUSHDATA2;
  }
  return true;
};

/**
 * Comes from bitcoind's script DecodeOP_N function
 * @param {number} opcode
 * @returns {number} numeric value in range of 0 to 16
 */
Script.prototype._decodeOP_N = function(opcode) {
  if (opcode === Opcode.OP_0) {
    return 0;
  } else if (opcode >= Opcode.OP_1 && opcode <= Opcode.OP_16) {
    return opcode - (Opcode.OP_1 - 1);
  } else {
    throw new Error('Invalid opcode: ' + JSON.stringify(opcode));
  }
};

/**
 * Comes from bitcoind's script GetSigOpCount(boolean) function
 * @param {boolean} use current (true) or pre-version-0.6 (false) logic
 * @returns {number} number of signature operations required by this script
 */
Script.prototype.getSignatureOperationsCount = function(accurate) {
  accurate = (_.isUndefined(accurate) ? true : accurate);
  var self = this;
  var n = 0;
  var lastOpcode = Opcode.OP_INVALIDOPCODE;
  _.each(self.chunks, function getChunk(chunk) {
    var opcode = chunk.opcodenum;
    if (opcode == Opcode.OP_CHECKSIG || opcode == Opcode.OP_CHECKSIGVERIFY) {
      n++;
    } else if (opcode == Opcode.OP_CHECKMULTISIG || opcode == Opcode.OP_CHECKMULTISIGVERIFY) {
      if (accurate && lastOpcode >= Opcode.OP_1 && lastOpcode <= Opcode.OP_16) {
        n += self._decodeOP_N(lastOpcode);
      } else {
        n += 20;
      }
    }
    lastOpcode = opcode;
  });
  return n;
};

module.exports = Script;
