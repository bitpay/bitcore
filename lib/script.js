'use strict';

var BufferReader = require('./encoding/bufferreader');
var BufferWriter = require('./encoding/bufferwriter');
var Opcode = require('./opcode');
var PublicKey = require('./publickey');
var Hash = require('./crypto/hash');
var bu = require('./util/buffer');

var Script = function Script(from) {
  if (!(this instanceof Script)) {
    return new Script(from);
  }

  this.chunks = [];

  if (bu.isBuffer(from)) {
    return Script.fromBuffer(from);
  } else if (typeof from === 'string') {
    return Script.fromString(from);
  } else if (typeof from !== 'undefined') {
    this.set(from);
  }
};

Script.prototype.set = function(obj) {
  this.chunks = obj.chunks || this.chunks;
  return this;
};

Script.fromBuffer = function(buffer) {
  var script = new Script();
  script.chunks = [];

  var br = new BufferReader(buffer);
  while (!br.eof()) {
    var opcodenum = br.readUInt8();

    var len, buf;
    if (opcodenum > 0 && opcodenum < Opcode.map.OP_PUSHDATA1) {
      len = opcodenum;
      script.chunks.push({
        buf: br.read(len),
        len: len,
        opcodenum: opcodenum
      });
    } else if (opcodenum === Opcode.map.OP_PUSHDATA1) {
      len = br.readUInt8();
      buf = br.read(len);
      script.chunks.push({
        buf: buf,
        len: len,
        opcodenum: opcodenum
      });
    } else if (opcodenum === Opcode.map.OP_PUSHDATA2) {
      len = br.readUInt16LE();
      buf = br.read(len);
      script.chunks.push({
        buf: buf,
        len: len,
        opcodenum: opcodenum
      });
    } else if (opcodenum === Opcode.map.OP_PUSHDATA4) {
      len = br.readUInt32LE();
      buf = br.read(len);
      script.chunks.push({
        buf: buf,
        len: len,
        opcodenum: opcodenum
      });
    } else {
      script.chunks.push(opcodenum);
    }
  }

  return script;
};

Script.prototype.toBuffer = function() {
  var bw = new BufferWriter();

  for (var i = 0; i < this.chunks.length; i++) {
    var chunk = this.chunks[i];
    var opcodenum;
    if (typeof chunk === 'number') {
      opcodenum = chunk;
      bw.writeUInt8(opcodenum);
    } else {
      opcodenum = chunk.opcodenum;
      bw.writeUInt8(chunk.opcodenum);
      if (opcodenum < Opcode.map.OP_PUSHDATA1) {
        bw.write(chunk.buf);
      } else if (opcodenum === Opcode.map.OP_PUSHDATA1) {
        bw.writeUInt8(chunk.len);
        bw.write(chunk.buf);
      } else if (opcodenum === Opcode.map.OP_PUSHDATA2) {
        bw.writeUInt16LE(chunk.len);
        bw.write(chunk.buf);
      } else if (opcodenum === Opcode.map.OP_PUSHDATA4) {
        bw.writeUInt32LE(chunk.len);
        bw.write(chunk.buf);
      }
    }
  }

  return bw.concat();
};

Script.fromString = function(str) {
  var script = new Script();
  script.chunks = [];

  var tokens = str.split(' ');
  var i = 0;
  while (i < tokens.length) {
    var token = tokens[i];
    var opcode = Opcode(token);
    var opcodenum = opcode.toNumber();

    if (typeof opcodenum === 'undefined') {
      opcodenum = parseInt(token);
      if (opcodenum > 0 && opcodenum < Opcode.map.OP_PUSHDATA1) {
        script.chunks.push({
          buf: new Buffer(tokens[i + 1].slice(2), 'hex'),
          len: opcodenum,
          opcodenum: opcodenum
        });
        i = i + 2;
      } else {
        throw new Error('Invalid script: ' + JSON.stringify(str));
      }
    } else if (opcodenum === Opcode.map.OP_PUSHDATA1 ||
      opcodenum === Opcode.map.OP_PUSHDATA2 ||
      opcodenum === Opcode.map.OP_PUSHDATA4) {
      if (tokens[i + 2].slice(0, 2) !== '0x') {
        throw new Error('Pushdata data must start with 0x');
      }
      script.chunks.push({
        buf: new Buffer(tokens[i + 2].slice(2), 'hex'),
        len: parseInt(tokens[i + 1]),
        opcodenum: opcodenum
      });
      i = i + 3;
    } else {
      script.chunks.push(opcodenum);
      i = i + 1;
    }
  }
  return script;
};

Script.prototype.toString = function() {
  var str = '';

  for (var i = 0; i < this.chunks.length; i++) {
    var chunk = this.chunks[i];
    var opcodenum;
    if (typeof chunk === 'number') {
      opcodenum = chunk;
      str = str + Opcode(opcodenum).toString() + ' ';
    } else {
      opcodenum = chunk.opcodenum;
      if (opcodenum === Opcode.map.OP_PUSHDATA1 ||
        opcodenum === Opcode.map.OP_PUSHDATA2 ||
        opcodenum === Opcode.map.OP_PUSHDATA4) {
        str = str + Opcode(opcodenum).toString() + ' ';
      }
      str = str + chunk.len + ' ';
      str = str + '0x' + chunk.buf.toString('hex') + ' ';
    }
  }

  return str.substr(0, str.length - 1);
};



// script classification methods

/**
 * @returns true if this is a pay to pubkey hash output script
 */
Script.prototype.isPublicKeyHashOut = function() {
  return this.chunks[0] === Opcode('OP_DUP').toNumber() &&
    this.chunks[1] === Opcode('OP_HASH160').toNumber() &&
    this.chunks[2].buf &&
    this.chunks[3] === Opcode('OP_EQUALVERIFY').toNumber() &&
    this.chunks[4] === Opcode('OP_CHECKSIG').toNumber();
};

/**
 * @returns true if this is a pay to public key hash input script
 */
Script.prototype.isPublicKeyHashIn = function() {
  return !!(this.chunks.length === 2 &&
    this.chunks[0].buf &&
    this.chunks[0].buf.length >= 0x47 &&
    this.chunks[0].buf.length <= 0x49 &&
    this.chunks[1].buf &&
    PublicKey.isValid(this.chunks[1].buf));
};

/**
 * @returns true if this is a public key output script
 */
Script.prototype.isPublicKeyOut = function() {
  return this.chunks.length === 2 &&
    bu.isBuffer(this.chunks[0].buf) &&
    PublicKey.isValid(this.chunks[0].buf) &&
    this.chunks[1] === Opcode('OP_CHECKSIG').toNumber();
};

/**
 * @returns true if this is a pay to public key input script
 */
Script.prototype.isPublicKeyIn = function() {
  return this.chunks.length === 1 &&
    bu.isBuffer(this.chunks[0].buf) &&
    this.chunks[0].buf.length === 0x47;
};


/**
 * @returns true if this is a p2sh output script
 */
Script.prototype.isScriptHashOut = function() {
  return this.chunks.length === 3 &&
    this.chunks[0] === Opcode('OP_HASH160').toNumber() &&
    this.chunks[1].buf &&
    this.chunks[1].buf.length === 20 &&
    this.chunks[2] === Opcode('OP_EQUAL').toNumber();
};

/** 
 * @returns true if this is a p2sh input script
 * Note that these are frequently indistinguishable from pubkeyhashin
 */
Script.prototype.isScriptHashIn = function() {
  if (this.chunks.length === 0) {
    return false;
  }
  var chunk = this.chunks[this.chunks.length - 1];
  if (!chunk) {
    return false;
  }
  var scriptBuf = chunk.buf;
  if (!scriptBuf) {
    return false;
  }
  var redeemScript = new Script(scriptBuf);
  var type = redeemScript.classify();
  return type !== Script.types.UNKNOWN;
};

/**
 * @returns true if this is a mutlsig output script
 */
Script.prototype.isMultisigOut = function() {
  return (this.chunks.length > 3 &&
    Opcode.isSmallIntOp(this.chunks[0]) &&
    this.chunks.slice(1, this.chunks.length - 2).every(function(obj) {
      return obj.buf && bu.isBuffer(obj.buf);
    }) &&
    Opcode.isSmallIntOp(this.chunks[this.chunks.length - 2]) &&
    this.chunks[this.chunks.length - 1] === Opcode.map.OP_CHECKMULTISIG);
};


/**
 * @returns true if this is a mutlsig input script
 */
Script.prototype.isMultisigIn = function() {
  return this.chunks[0] === 0 &&
    this.chunks.slice(1, this.chunks.length).every(function(obj) {
      return obj.buf &&
        bu.isBuffer(obj.buf) &&
        obj.buf.length === 0x47;
    });
};

/**
 * @returns true if this is an OP_RETURN data script
 */
Script.prototype.isDataOut = function() {
  return (this.chunks[0] === Opcode('OP_RETURN').toNumber() &&
    (this.chunks.length === 1 ||
      (this.chunks.length === 2 &&
        this.chunks[1].buf &&
        this.chunks[1].buf.length <= 40 &&
        this.chunks[1].length === this.chunks.len)));
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

Script.identifiers = {};
Script.identifiers.PUBKEY_OUT = Script.prototype.isPublicKeyOut;
Script.identifiers.PUBKEY_IN = Script.prototype.isPublicKeyIn;
Script.identifiers.PUBKEYHASH_OUT = Script.prototype.isPublicKeyHashOut;
Script.identifiers.PUBKEYHASH_IN = Script.prototype.isPublicKeyHashIn;
Script.identifiers.MULTISIG_OUT = Script.prototype.isMultisigOut;
Script.identifiers.MULTISIG_IN = Script.prototype.isMultisigIn;
Script.identifiers.SCRIPTHASH_OUT = Script.prototype.isScriptHashOut;
Script.identifiers.SCRIPTHASH_IN = Script.prototype.isScriptHashIn;
Script.identifiers.DATA_OUT = Script.prototype.isDataOut;

/**
 * @returns {object} The Script type if it is a known form,
 * or Script.UNKNOWN if it isn't
 */
Script.prototype.classify = function() {
  for (var type in Script.identifiers) {
    if (Script.identifiers[type].bind(this)()) {
      return Script.types[type];
    }
  }
  return Script.types.UNKNOWN;
};


/**
 * @returns true if script is one of the known types
 */
Script.prototype.isStandard = function() {
  return this.classify() !== Script.types.UNKNOWN;
};


// Script construction methods

/**
 * Adds a script element at the start of the script.
 * @param {*} obj a string, number, Opcode, Bufer, or object to add
 * @returns {Script} this script instance
 */
Script.prototype.prepend = function(obj) {
  this._addByType(obj, true);
  return this;
};

/**
 * Adds a script element to the end of the script.
 *
 * @param {*} obj a string, number, Opcode, Bufer, or object to add
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
  } else if (obj.constructor && obj.constructor.name && obj.constructor.name === 'Opcode') {
    this._addOpcode(obj, prepend);
  } else if (bu.isBuffer(obj)) {
    this._addBuffer(obj, prepend);
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
  } else if (opcode.constructor && opcode.constructor.name && opcode.constructor.name === 'Opcode') {
    op = opcode.toNumber();
  } else {
    op = Opcode(opcode).toNumber();
  }
  this._insertAtPosition(op, prepend);
  return this;
};

Script.prototype._addBuffer = function(buf, prepend) {
  var opcodenum;
  var len = buf.length;
  if (len === 0) {
    return;
  } else if (len > 0 && len < Opcode.map.OP_PUSHDATA1) {
    opcodenum = len;
  } else if (len < Math.pow(2, 8)) {
    opcodenum = Opcode.map.OP_PUSHDATA1;
  } else if (len < Math.pow(2, 16)) {
    opcodenum = Opcode.map.OP_PUSHDATA2;
  } else if (len < Math.pow(2, 32)) {
    opcodenum = Opcode.map.OP_PUSHDATA4;
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


// high level script builder methods

/**
 * @returns a new Multisig output script for given public keys,
 * requiring m of those public keys to spend
 */
Script.buildMultisigOut = function(pubkeys, m) {
  var s = new Script();
  s.add(Opcode.smallInt(m));
  for (var i = 0; i < pubkeys.length; i++) {
    var pubkey = pubkeys[i];
    s.add(pubkey.toBuffer());
  }
  s.add(Opcode.smallInt(pubkeys.length));
  s.add(Opcode('OP_CHECKMULTISIG'));
  return s;
};

/**
 * @returns a new pay to public key hash output for the given
 * address or public key
 */
Script.buildPublicKeyHashOut = function(to) {
  if (to instanceof PublicKey) {
    to = to.toAddress();
  }
  var s = new Script();
  s.add(Opcode('OP_DUP'))
    .add(Opcode('OP_HASH160'))
    .add(to.hashBuffer)
    .add(Opcode('OP_EQUALVERIFY'))
    .add(Opcode('OP_CHECKSIG'));
  return s;
};

/**
 * @returns a new pay to public key output for the given
 *  public key
 */
Script.buildPublicKeyOut = function(pubkey) {
  var s = new Script();
  s.add(pubkey.toBuffer())
    .add(Opcode('OP_CHECKSIG'));
  return s;
};

/**
 * @returns a new OP_RETURN script with data
 */
Script.buildDataOut = function(data) {
  if (typeof data === 'string') {
    data = new Buffer(data);
  }
  var s = new Script();
  s.add(Opcode('OP_RETURN'))
    .add(data);
  return s;
};

/**
 * @returns a new pay to script hash script for given script
 */
Script.buildScriptHashOut = function(script) {
  var s = new Script();
  s.add(Opcode('OP_HASH160'))
    .add(Hash.sha256ripemd160(script.toBuffer()))
    .add(Opcode('OP_EQUAL'));
  return s;
};


/**
 * @returns a new pay to script hash script that pays to this script
 */
Script.prototype.toScriptHashOut = function() {
  return Script.buildScriptHashOut(this);
};

module.exports = Script;
