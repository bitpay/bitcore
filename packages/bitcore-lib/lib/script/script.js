'use strict';

const Address = require('../address');
const Hash = require('../crypto/hash');
const Signature = require('../crypto/signature');
const TaggedHash = require('../crypto/taggedhash');
const BufferReader = require('../encoding/bufferreader');
const BufferWriter = require('../encoding/bufferwriter');
const errors = require('../errors');
const Networks = require('../networks');
const Opcode = require('../opcode');
const PublicKey = require('../publickey');
const BufferUtil = require('../util/buffer');
const JSUtil = require('../util/js');
const $ = require('../util/preconditions');

/**
 * A bitcoin transaction script. Each transaction's inputs and outputs
 * has a script that is evaluated to validate it's spending.
 *
 * See https://en.bitcoin.it/wiki/Script
 *
 * @constructor
 * @param {Object|string|Buffer=} from optional data to populate script
 */
const Script = function Script(from) {
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
  } else if (typeof from === 'string') {
    return Script.fromString(from);
  } else if (typeof from === 'object' && Array.isArray(from?.chunks)) {
    this.set(from);
  }
};


Script.prototype.set = function(obj) {
  $.checkArgument(typeof obj === 'object' && obj !== null);
  $.checkArgument(Array.isArray(obj.chunks));
  this.chunks = obj.chunks;
  return this;
};

Script.fromBuffer = function(buffer) {
  const script = new Script();
  script.chunks = [];

  const br = new BufferReader(buffer);
  while (!br.finished()) {
    try {
      const opcodenum = br.readUInt8();

      let len, buf;
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
      } else if (Opcode.isOpSuccess(opcodenum)) {
        // OP_SUCCESSx processing overrides everything, including stack element size limits
        buf = br.readAll();
        len = buf.length;
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
  const bw = new BufferWriter();

  for (let i = 0; i < this.chunks.length; i++) {
    const chunk = this.chunks[i];
    const opcodenum = chunk.opcodenum;
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
      } else {
        // Could reach here if opcodenum is OP_SUCCESSx (see comment in .fromBuffer)
        bw.write(chunk.buf);
      }
    }
  }

  return bw.concat();
};

Script.fromASM = function(str) {
  const script = new Script();
  script.chunks = [];

  const tokens = str.split(' ');
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const opcode = Opcode(token);
    const opcodenum = opcode.toNumber();

    if (opcodenum == null) {
      const buf = Buffer.from(tokens[i], 'hex');
      script.chunks.push({
        buf: buf,
        len: buf.length,
        opcodenum: buf.length
      });
      i = i + 1;
    } else if (opcodenum === Opcode.OP_PUSHDATA1 ||
      opcodenum === Opcode.OP_PUSHDATA2 ||
      opcodenum === Opcode.OP_PUSHDATA4) {
      script.chunks.push({
        buf: Buffer.from(tokens[i + 2], 'hex'),
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

Script.fromHex = function(str) {
  return new Script(Buffer.from(str, 'hex'));
};

Script.fromString = function(str) {
  if (JSUtil.isHexa(str) || str.length === 0) {
    return new Script(Buffer.from(str, 'hex'));
  }
  const script = new Script();
  script.chunks = [];

  const tokens = str.split(' ');
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const opcode = Opcode(token);
    let opcodenum = opcode.toNumber();

    if (opcodenum == null) {
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
  const opcodenum = chunk.opcodenum;
  const asm = (type === 'asm');
  let str = '';
  if (!chunk.buf) {
    // no data chunk
    if (typeof Opcode.reverseMap[opcodenum] !== 'undefined') {
      if (asm) {
        // A few cases where the opcode name differs from reverseMap
        // aside from 1 to 16 data pushes.
        if (opcodenum === 0) {
          // OP_0 -> 0
          str = str + ' 0';
        } else if (opcodenum === 79) {
          // OP_1NEGATE -> 1
          str = str + ' -1';
        } else {
          str = str + ' ' + Opcode(opcodenum).toString();
        }
      } else {
        str = str + ' ' + Opcode(opcodenum).toString();
      }
    } else {
      let numstr = opcodenum.toString(16);
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
    if (!asm && opcodenum === Opcode.OP_PUSHDATA1 ||
      opcodenum === Opcode.OP_PUSHDATA2 ||
      opcodenum === Opcode.OP_PUSHDATA4) {
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
  let str = '';
  for (let i = 0; i < this.chunks.length; i++) {
    const chunk = this.chunks[i];
    str += this._chunkToString(chunk, 'asm');
  }

  return str.substr(1);
};

Script.prototype.toString = function() {
  let str = '';
  for (let i = 0; i < this.chunks.length; i++) {
    const chunk = this.chunks[i];
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
    const signatureBuf = this.chunks[0].buf;
    const pubkeyBuf = this.chunks[1].buf;
    if (signatureBuf &&
        signatureBuf.length &&
        signatureBuf[0] === 0x30 &&
        pubkeyBuf &&
        pubkeyBuf.length
    ) {
      const version = pubkeyBuf[0];
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
  if (this.isPublicKeyHashOut()) {
    return this.chunks[2].buf;
  } else if (this.isWitnessPublicKeyHashOut()) {
    return this.chunks[1].buf;
  } else if (this.isTaproot()) {
    return this.chunks[1].buf;
  } else {
    throw new Error('Can\'t retrieve PublicKeyHash from a non-PKH output');
  }
};

/**
 * @returns {boolean} if this is a public key output script
 */
Script.prototype.isPublicKeyOut = function() {
  if (this.chunks.length === 2 &&
      this.chunks[0].buf &&
      this.chunks[0].buf.length &&
      this.chunks[1].opcodenum === Opcode.OP_CHECKSIG) {
    const pubkeyBuf = this.chunks[0].buf;
    const version = pubkeyBuf[0];
    let isVersion = false;
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
    const signatureBuf = this.chunks[0].buf;
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
  const buf = this.toBuffer();
  return (buf.length === 23 &&
    buf[0] === Opcode.OP_HASH160 &&
    buf[1] === 0x14 &&
    buf[buf.length - 1] === Opcode.OP_EQUAL);
};

/**
 * @returns {boolean} if this is a p2wsh output script
 */
Script.prototype.isWitnessScriptHashOut = function() {
  const buf = this.toBuffer();
  return (buf.length === 34 && buf[0] === Opcode.OP_0 && buf[1] === 32);
};

/**
 * @returns {boolean} if this is a p2wpkh output script
 */
Script.prototype.isWitnessPublicKeyHashOut = function() {
  const buf = this.toBuffer();
  return (buf.length === 22 && buf[0] === Opcode.OP_0 && buf[1] === 20);
};

/**
 * @returns {boolean} if this is a p2tr output script
 */
Script.prototype.isTaproot = function() {
  const buf = this.toBuffer();
  return (buf.length === 34 && buf[0] === Opcode.OP_1 && buf[1] === 32);
};

/**
 * @param {Object=} values - The return values
 * @param {Number} values.version - Set with the witness version
 * @param {Buffer} values.program - Set with the witness program
 * @returns {boolean} if this is a p2wpkh output script
 */
Script.prototype.isWitnessProgram = function(values) {
  if (!values) {
    values = {};
  }
  const buf = this.toBuffer();
  if (buf.length < 4 || buf.length > 42) {
    return false;
  }
  if (buf[0] !== Opcode.OP_0 && !(buf[0] >= Opcode.OP_1 && buf[0] <= Opcode.OP_16)) {
    return false;
  }

  if (buf.length === buf[1] + 2) {
    values.version = Opcode.decodeOpN(buf[0]);
    values.program = buf.slice(2, buf.length);
    return true;
  }

  return false;
};

/**
 * @returns {boolean} if this is a p2sh input script
 * Note that these are frequently indistinguishable from pubkeyhashin
 */
Script.prototype.isScriptHashIn = function() {
  if (this.chunks.length <= 1) {
    return false;
  }
  const redeemChunk = this.chunks[this.chunks.length - 1];
  const redeemBuf = redeemChunk.buf;
  if (!redeemBuf) {
    return false;
  }

  let redeemScript;
  try {
    redeemScript = Script.fromBuffer(redeemBuf);
  } catch (e) {
    if (e instanceof errors.Script.InvalidBuffer) {
      return false;
    }
    throw e;
  }
  const type = redeemScript.classify();
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
  return this.chunks.length >= 1 &&
    this.chunks[0].opcodenum === Opcode.OP_RETURN &&
    (this.chunks.length === 1 ||
      (this.chunks.length === 2 &&
        this.chunks[1].buf &&
        this.chunks[1].buf.length <= Script.OP_RETURN_STANDARD_SIZE &&
        this.chunks[1].length === this.chunks.len));
};

/**
 * Retrieve the associated data for this script.
 * In the case of a pay to public key hash, P2SH, P2WSH, or P2WPKH, return the hash.
 * In the case of a standard OP_RETURN, return the data
 * @returns {Buffer}
 */
Script.prototype.getData = function() {
  if (this.isDataOut() || this.isScriptHashOut() || this.isWitnessScriptHashOut() || this.isWitnessPublicKeyHashOut() || this.isTaproot()) {
    if (this.chunks[1] == null) {
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
  return this.chunks.every(function(chunk) {
    return chunk.opcodenum <= Opcode.OP_16;
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

Script.OP_RETURN_STANDARD_SIZE = 80;

// Tag for input annex. If there are at least two witness elements for a transaction input,
// and the first byte of the last element is 0x50, this last element is called annex, and
// has meanings independent of the script
Script.ANNEX_TAG = 0x50;

// Validation weight per passing signature (Tapscript only, see BIP 342).
Script.VALIDATION_WEIGHT_PER_SIGOP_PASSED = 50;

// How much weight budget is added to the witness size (Tapscript only, see BIP 342).
Script.VALIDATION_WEIGHT_OFFSET = 50;


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
    const outputType = this.classifyOutput();
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
  for (const type in Script.outputIdentifiers) {
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
  for (const type in Script.inputIdentifiers) {
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
  let i;
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
  let op;
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
  let opcodenum;
  const len = buf.length;
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

Script.prototype.hasCodeseparators = function() {
  for (let i = 0; i < this.chunks.length; i++) {
    if (this.chunks[i].opcodenum === Opcode.OP_CODESEPARATOR) {
      return true;
    }
  }
  return false;
};

Script.prototype.removeCodeseparators = function() {
  const chunks = [];
  for (let i = 0; i < this.chunks.length; i++) {
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
 * @param {Object=} opts Options:
 *        - noSorting: defaults to false, if true, don't sort the given
 *                      public keys before creating the script
 */
Script.buildMultisigOut = function(publicKeys, threshold, opts) {
  $.checkArgument(threshold <= publicKeys.length,
    'Number of required signatures must be less than or equal to the number of public keys');
  opts = opts || {};
  const script = new Script();
  script.add(Opcode.smallInt(threshold));
  publicKeys = publicKeys.map(PublicKey);
  let sorted = publicKeys;
  if (!opts.noSorting) {
    // avoid mutating input
    sorted = [...publicKeys].sort(function(a, b) {
      const aHex = a.toString('hex');
      const bHex = b.toString('hex');
      if (aHex < bHex) {
        return -1;
      }
      if (aHex > bHex) {
        return 1;
      }
      return 0;
    });
  }
  for (let i = 0; i < sorted.length; i++) {
    const publicKey = sorted[i];
    script.add(publicKey.toBuffer());
  }
  script.add(Opcode.smallInt(publicKeys.length));
  script.add(Opcode.OP_CHECKMULTISIG);
  return script;
};

Script.buildWitnessMultisigOutFromScript = function(script) {
  if (script instanceof Script) {
    const s = new Script();
    s.add(Opcode.OP_0);
    s.add(Hash.sha256(script.toBuffer()));
    return s;
  } else {
    throw new TypeError('First argument is expected to be a p2sh script');
  }
};

/**
 * A new Multisig input script for the given public keys, requiring m of those public keys to spend
 *
 * @param {PublicKey[]} pubkeys list of all public keys controlling the output
 * @param {number} threshold amount of required signatures to spend the output
 * @param {Array} signatures and array of signature buffers to append to the script
 * @param {Object=} _opts
 * @param {boolean=} opts.noSorting don't sort the given public keys before creating the script (false by default)
 * @param {Script=} opts.cachedMultisig don't recalculate the redeemScript
 *
 * @returns {Script}
 */
Script.buildMultisigIn = function(pubkeys, threshold, signatures, opts) {
  $.checkArgument(Array.isArray(pubkeys));
  $.checkArgument(!isNaN(threshold));
  $.checkArgument(Array.isArray(signatures));
  opts = opts || {};
  const s = new Script();
  s.add(Opcode.OP_0);
  for (const signature of signatures) {
    $.checkArgument(BufferUtil.isBuffer(signature), 'Signatures must be an array of Buffers');
    // TODO: allow signatures to be an array of Signature objects
    s.add(signature);
  }
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
 *
 * @returns {Script}
 */
Script.buildP2SHMultisigIn = function(pubkeys, threshold, signatures, opts) {
  $.checkArgument(Array.isArray(pubkeys));
  $.checkArgument(!isNaN(threshold));
  $.checkArgument(Array.isArray(signatures));
  opts = opts || {};
  const s = new Script();
  s.add(Opcode.OP_0);
  for (const signature of signatures) {
    $.checkArgument(BufferUtil.isBuffer(signature), 'Signatures must be an array of Buffers');
    // TODO: allow signatures to be an array of Signature objects
    s.add(signature);
  }
  s.add((opts.cachedMultisig || Script.buildMultisigOut(pubkeys, threshold, opts)).toBuffer());
  return s;
};

/**
 * @returns {Script} a new pay to public key hash output for the given
 * address or public key
 * @param {(Address|PublicKey)} to - destination address or public key
 */
Script.buildPublicKeyHashOut = function(to) {
  $.checkArgument(to != null);
  $.checkArgument(to instanceof PublicKey || to instanceof Address || typeof to === 'string');
  if (to instanceof PublicKey) {
    to = to.toAddress();
  } else if (typeof to === 'string') {
    to = new Address(to);
  }
  const s = new Script();
  s.add(Opcode.OP_DUP)
    .add(Opcode.OP_HASH160)
    .add(to.hashBuffer)
    .add(Opcode.OP_EQUALVERIFY)
    .add(Opcode.OP_CHECKSIG);
  s._network = to.network;
  return s;
};

/**
 * @returns {Script} a new pay to witness v0 output for the given
 * address
 * @param {(Address|PublicKey)} to - destination address
 */
Script.buildWitnessV0Out = function(to) {
  $.checkArgument(to instanceof PublicKey || to instanceof Address || typeof to === 'string', '`to` must be a PublicKey, Address, or string');
  if (to instanceof PublicKey) {
    to = to.toAddress(null, Address.PayToWitnessPublicKeyHash);
  } else if (typeof to === 'string') {
    to = new Address(to);
  }
  const s = new Script();
  s.add(Opcode.OP_0)
    .add(to.hashBuffer);
  s._network = to.network;
  return s;
};


/**
 * Build Taproot script output
 * @param {PublicKey|Address} to recipient's pubKey or address
 * @param {Array|Object} scriptTree single leaf object OR array of leaves. leaf: { script: String, leafVersion: Integer }
 * @returns {Script}
 */
Script.buildWitnessV1Out = function(to, scriptTree) {
  $.checkArgument(to instanceof PublicKey || to instanceof Address || typeof to === 'string');
  $.checkArgument(!scriptTree || Array.isArray(scriptTree) || !!scriptTree.script);

  if (typeof to === 'string') {
    try {
      to = PublicKey.fromTaproot(to);
    } catch {
      to = Address.fromString(to);
    }
  }
  
  function buildTree(tree) {
    if (Array.isArray(tree)) {
      const [left, leftH] = buildTree(tree[0]);
      const [right, rightH] = buildTree(tree[1]);
      const ret = [[[left[0], left[1]], rightH], [[right[0], right[1]], leftH]];
      const hWriter = TaggedHash.TAPBRANCH;
      if (leftH.compare(rightH) === 1) {
        hWriter.write(rightH);
        hWriter.write(leftH);
      } else {
        hWriter.write(leftH);
        hWriter.write(rightH);
      }
      return [ret, hWriter.finalize()];
    } else {
      const { leafVersion, script } = tree;
      const scriptBuf = new Script(script).toBuffer();
      const leafWriter = TaggedHash.TAPLEAF;
      leafWriter.writeUInt8(leafVersion);
      leafWriter.writeUInt8(scriptBuf.length);
      leafWriter.write(scriptBuf);
      const h = leafWriter.finalize();
      return [[Buffer.from([leafVersion]), scriptBuf], h];
    }
  }

  let taggedHash = null;
  if (scriptTree) { 
    const [_, h] = buildTree(scriptTree);
    taggedHash = h;
  }
  
  let tweakedPubKey;
  if (to instanceof PublicKey) {
    tweakedPubKey = to.createTapTweak(taggedHash).tweakedPubKey;
  } else { // Address
    tweakedPubKey = to.hashBuffer;
  }
  const s = new Script();
  s.add(Opcode.OP_1);
  s.add(tweakedPubKey);
  return s;
};


/**
 * @returns {Script} a new pay to public key output for the given
 *  public key
 */
Script.buildPublicKeyOut = function(pubkey) {
  $.checkArgument(pubkey instanceof PublicKey);
  const s = new Script();
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
  $.checkArgument(data == null || typeof data === 'string' || BufferUtil.isBuffer(data));
  if (typeof data === 'string') {
    data = Buffer.from(data, encoding);
  }
  const s = new Script();
  s.add(Opcode.OP_RETURN);
  if (data != null) {
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
  const s = new Script();
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
  $.checkArgument(sigtype == null || !isNaN(sigtype));
  if (signature instanceof Signature) {
    signature = signature.toBuffer();
  }
  const script = new Script();
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
  $.checkArgument(sigtype == null || !isNaN(sigtype));
  if (signature instanceof Signature) {
    signature = signature.toBuffer();
  }
  const script = new Script()
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
  } else if (address.isPayToWitnessPublicKeyHash()) {
    return Script.buildWitnessV0Out(address);
  } else if (address.isPayToWitnessScriptHash()) {
    return Script.buildWitnessV0Out(address);
  } else if (address.isPayToTaproot()) {
    return Script.buildWitnessV1Out(address);
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
    const info = this._getOutputAddressInfo();
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
  const info = {};
  if (this.isScriptHashOut()) {
    info.hashBuffer = this.getData();
    info.type = Address.PayToScriptHash;
  } else if (this.isPublicKeyHashOut()) {
    info.hashBuffer = this.getData();
    info.type = Address.PayToPublicKeyHash;
  } else if (this.isWitnessScriptHashOut()) {
    info.hashBuffer = this.getData();
    info.type = Address.PayToWitnessScriptHash;
  } else if (this.isWitnessPublicKeyHashOut()) {
    info.hashBuffer = this.getData();
    info.type = Address.PayToWitnessPublicKeyHash;
  } else if (this.isTaproot()) {
    info.hashBuffer = this.getData();
    info.type = Address.PayToTaproot;
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
  const info = {};
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
  const info = this.getAddressInfo();
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
  const buf = script.toBuffer();
  const hex = buf.toString('hex');
  for (let i = 0; i < this.chunks.length; i++) {
    const script2 = Script({
      chunks: [this.chunks[i]]
    });
    const buf2 = script2.toBuffer();
    const hex2 = buf2.toString('hex');
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
  const chunk = this.chunks[i];
  const buf = chunk.buf;
  const opcodenum = chunk.opcodenum;
  if (!buf) {
    return true;
  }
  if (buf.length === 0) {
    // Could have used OP_0.
    return opcodenum === Opcode.OP_0;
  } else if (buf.length === 1 && buf[0] >= 1 && buf[0] <= 16) {
    // Could have used OP_1 .. OP_16.
    return opcodenum === Opcode.OP_1 + (buf[0] - 1);
  } else if (buf.length === 1 && buf[0] === 0x81) {
    // Could have used OP_1NEGATE
    return opcodenum === Opcode.OP_1NEGATE;
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
 * Comes from bitcoind's script GetSigOpCount(boolean) function
 * @param {boolean} use current (true) or pre-version-0.6 (false) logic
 * @returns {number} number of signature operations required by this script
 */
Script.prototype.getSignatureOperationsCount = function(accurate) {
  accurate = (accurate == null ? true : accurate);
  let n = 0;
  let lastOpcode = Opcode.OP_INVALIDOPCODE;
  for (const chunk of this.chunks) {
    const opcode = chunk.opcodenum;
    if (opcode == Opcode.OP_CHECKSIG || opcode == Opcode.OP_CHECKSIGVERIFY) {
      n++;
    } else if (opcode == Opcode.OP_CHECKMULTISIG || opcode == Opcode.OP_CHECKMULTISIGVERIFY) {
      if (accurate && lastOpcode >= Opcode.OP_1 && lastOpcode <= Opcode.OP_16) {
        n += Opcode.decodeOpN(lastOpcode);
      } else {
        n += 20;
      }
    }
    lastOpcode = opcode;
  }
  return n;
};

module.exports = Script;
