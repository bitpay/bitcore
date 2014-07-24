var config = require('../config');
var log = require('../util/log');
var Opcode = require('./Opcode');
var buffertools = require('buffertools');
var util = require('../util/util');
var Parser = require('../util/BinaryParser');
var Put = require('bufferput');

var TX_UNKNOWN = 0;
var TX_PUBKEY = 1;
var TX_PUBKEYHASH = 2;
var TX_MULTISIG = 3;
var TX_SCRIPTHASH = 4;

var TX_TYPES = [
  'unknown',
  'pubkey',
  'pubkeyhash',
  'multisig',
  'scripthash'
];

function Script(buffer) {
  if (buffer) {
    this.buffer = buffer;
  } else {
    this.buffer = util.EMPTY_BUFFER;
  }
  this.chunks = [];
  this.parse();
}

Script.TX_UNKNOWN = TX_UNKNOWN;
Script.TX_PUBKEY = TX_PUBKEY;
Script.TX_PUBKEYHASH = TX_PUBKEYHASH;
Script.TX_MULTISIG = TX_MULTISIG;
Script.TX_SCRIPTHASH = TX_SCRIPTHASH;

Script.prototype.parse = function() {
  this.chunks = [];

  var parser = new Parser(this.buffer);
  while (!parser.eof()) {
    var opcode = parser.word8();

    var len, chunk;
    if (opcode > 0 && opcode < Opcode.map.OP_PUSHDATA1) {
      // Read some bytes of data, opcode value is the length of data
      this.chunks.push(parser.buffer(opcode));
    } else if (opcode === Opcode.map.OP_PUSHDATA1) {
      len = parser.word8();
      chunk = parser.buffer(len);
      this.chunks.push(chunk);
    } else if (opcode === Opcode.map.OP_PUSHDATA2) {
      len = parser.word16le();
      chunk = parser.buffer(len);
      this.chunks.push(chunk);
    } else if (opcode === Opcode.map.OP_PUSHDATA4) {
      len = parser.word32le();
      chunk = parser.buffer(len);
      this.chunks.push(chunk);
    } else {
      this.chunks.push(opcode);
    }
  }
};

Script.prototype.isPushOnly = function() {
  for (var i = 0; i < this.chunks.length; i++) {
    var op = this.chunks[i];
    if (!Buffer.isBuffer(op) && op > Opcode.map.OP_16) {
      return false;
    }
  }

  return true;
};

Script.prototype.isP2SH = function() {
  return (this.chunks.length == 3 &&
    this.chunks[0] == Opcode.map.OP_HASH160 &&
    Buffer.isBuffer(this.chunks[1]) &&
    this.chunks[1].length == 20 &&
    this.chunks[2] == Opcode.map.OP_EQUAL);
};

Script.prototype.isPubkey = function() {
  return (this.chunks.length == 2 &&
    Buffer.isBuffer(this.chunks[0]) &&
    this.chunks[1] == Opcode.map.OP_CHECKSIG);
};

Script.prototype.isPubkeyHash = function() {
  return (this.chunks.length == 5 &&
    this.chunks[0] == Opcode.map.OP_DUP &&
    this.chunks[1] == Opcode.map.OP_HASH160 &&
    Buffer.isBuffer(this.chunks[2]) &&
    this.chunks[2].length == 20 &&
    this.chunks[3] == Opcode.map.OP_EQUALVERIFY &&
    this.chunks[4] == Opcode.map.OP_CHECKSIG);
};

function isSmallIntOp(opcode) {
  return ((opcode == Opcode.map.OP_0) ||
    ((opcode >= Opcode.map.OP_1) && (opcode <= Opcode.map.OP_16)));
};

Script.prototype.isMultiSig = function() {
  return (this.chunks.length > 3 &&
    isSmallIntOp(this.chunks[0]) &&
    this.chunks.slice(1, this.chunks.length - 2).every(function(i) {
      return Buffer.isBuffer(i);
    }) &&
    isSmallIntOp(this.chunks[this.chunks.length - 2]) &&
    this.chunks[this.chunks.length - 1] == Opcode.map.OP_CHECKMULTISIG);
};

Script.prototype.isPubkeyHashScript = function() {
  // TODO: add more restrictions to chunks
  return (this.chunks.length == 2 &&
    Buffer.isBuffer(this.chunks[0]) &&
    Buffer.isBuffer(this.chunks[1]));
};

Script.prototype.isP2shScriptSig = function() {
  if (!isSmallIntOp(this.chunks[0]) || this.chunks[0] !== 0)
    return false;

  var redeemScript = new Script(this.chunks[this.chunks.length - 1]);
  var type = redeemScript.classify();
  return type !== TX_UNKNOWN;
};

Script.prototype.isMultiSigScriptSig = function() {
  if (!isSmallIntOp(this.chunks[0]) || this.chunks[0] !== 0)
    return false;
  return !this.isP2shScriptSig();
};

Script.prototype.countSignatures = function() {
  var ret = 0;
  var l = this.chunks.length;
  // Multisig?
  if (this.isMultiSigScriptSig()) {
    ret = l - 1;
  }
  // p2sh
  else if (this.isP2shScriptSig()) {
    ret = l - 2;
  }
  // p2pubkeyhash
  else if (this.isPubkeyHashScript()) {
    ret = 1;
  }
  // p2pubkey
  else {
    ret = 0;
  }
  return ret;
};


Script.prototype.getSignatures = function() {
  ret = [];
  var l = this.chunks.length;
  // Multisig?
  if (this.isMultiSigScriptSig()) {
    for(var i = 1; i<l; i++) {
      ret.push(this.chunks[i]);
    } 
  }
  // p2sh
  else if (this.isP2shScriptSig()) {
    for (var i=1; i<l-1; i++) {
      ret.push(this.chunks[i]);
    }
  }
  // p2pubkeyhash
  else if (this.isPubkeyHashScript()) {
    ret.push(this.chunks[0]);
  }
  // p2pubkey
  else {
    // no signatures
  }
  return ret;
};

Script.prototype.getHashType = function() {
  var sigs = this.getSignatures();
  var hashType = null;
  for (var i=0; i<sigs.length; i++) {
    var sig = sigs[i];
    var hashTypeI = sig[sig.length - 1];
    if (hashType !== null && hashType !== hashTypeI) return null;
    hashType = hashTypeI;
  }
  return hashType;
};


Script.prototype.countMissingSignatures = function() {
  if (this.isMultiSig()) {
    log.debug("Can not count missing signatures on normal Multisig script");
    return null;
  }

  var ret = 0;
  var l = this.chunks.length;
  // P2SH?
  if (isSmallIntOp(this.chunks[0]) && this.chunks[0] === 0) {
    var redeemScript = new Script(this.chunks[l - 1]);
    if (!isSmallIntOp(redeemScript.chunks[0])) {
      log.debug("Unrecognized script type");
    } else {
      var nreq = redeemScript.chunks[0] - 80; //see OP_2-OP_16
      ret = nreq - (l - 2); // 2-> marked 0 + redeemScript
    }
  }
  // p2pubkey or p2pubkeyhash
  else {
    if (buffertools.compare(this.getBuffer(), util.EMPTY_BUFFER) === 0) {
      ret = 1;
    }
  }
  return ret;
};

Script.prototype.finishedMultiSig = function() {
  var missing = this.countMissingSignatures();
  if (missing === null) return null;

  return missing === 0;
};

Script.prototype.getMultiSigInfo = function() {
  if (!this.isMultiSig()) {
    throw new Error("Script.getMultiSigInfo(): Not a multiSig script.");
  }

  var nsigs = this.chunks[0] - 80; //see OP_2-OP_16;
  var npubkeys = this.chunks[this.chunks.length - 2] - 80; //see OP_2-OP_16;

  var pubkeys = [];
  for (var i = 1; i < this.chunks.length - 2; i++) {
    pubkeys.push(this.chunks[i]);
  }

  if (pubkeys.length != npubkeys) {
    throw new Error("Script.getMultiSigInfo(): Amount of PKs does not match what the script specifies.");
  }

  return {
    nsigs: nsigs,
    npubkeys: npubkeys,
    pubkeys: pubkeys
  }
};

Script.prototype.prependOp0 = function() {
  var chunks = [0];
  for (i in this.chunks) {
    if (this.chunks.hasOwnProperty(i)) {
      chunks.push(this.chunks[i]);
    }
  }
  this.chunks = chunks;
  this.updateBuffer();
  return this;
};

// is this a script form we know?
Script.prototype.classify = function() {
  if (this.isPubkeyHash())
    return TX_PUBKEYHASH;
  if (this.isP2SH())
    return TX_SCRIPTHASH;
  if (this.isMultiSig())
    return TX_MULTISIG;
  if (this.isPubkey())
    return TX_PUBKEY;
  return TX_UNKNOWN;
};

// extract useful data items from known scripts
Script.prototype.capture = function() {
  var txType = this.classify();
  var res = [];
  switch (txType) {
    case TX_PUBKEY:
      res.push(this.chunks[0]);
      break;
    case TX_PUBKEYHASH:
      res.push(this.chunks[2]);
      break;
    case TX_MULTISIG:
      for (var i = 1; i < (this.chunks.length - 2); i++)
        res.push(this.chunks[i]);
      break;
    case TX_SCRIPTHASH:
      res.push(this.chunks[1]);
      break;

    case TX_UNKNOWN:
    default:
      // do nothing
      break;
  }

  return res;
};

// return first extracted data item from script
Script.prototype.captureOne = function() {
  var arr = this.capture();
  return arr[0];
};

Script.prototype.getOutType = function() {
  var txType = this.classify();
  switch (txType) {
    case TX_PUBKEY:
      return 'Pubkey';
    case TX_PUBKEYHASH:
      return 'Address';
    default:
      return 'Strange';
  }
};

Script.prototype.getRawOutType = function() {
  return TX_TYPES[this.classify()];
};

Script.prototype.simpleOutHash = function() {
  switch (this.getOutType()) {
    case 'Address':
      return this.chunks[2];
    case 'Pubkey':
      return util.sha256ripe160(this.chunks[0]);
    default:
      log.debug("Encountered non-standard scriptPubKey");
      log.debug("Strange script was: " + this.toString());
      return null;
  }
};

Script.prototype.getInType = function() {
  if (this.chunks.length == 1) {
    // Direct IP to IP transactions only have the public key in their scriptSig.
    return 'Pubkey';
  } else if (this.chunks.length == 2 &&
    Buffer.isBuffer(this.chunks[0]) &&
    Buffer.isBuffer(this.chunks[1])) {
    return 'Address';
  } else {
    return 'Strange';
  }
};

Script.prototype.simpleInPubKey = function() {
  switch (this.getInType()) {
    case 'Address':
      return this.chunks[1];
    case 'Pubkey':
      return null;
    default:
      log.debug("Encountered non-standard scriptSig");
      log.debug("Strange script was: " + this.toString());
      return null;
  }
};

Script.prototype.getBuffer = function() {
  return this.buffer;
};

Script.prototype.serialize = Script.prototype.getBuffer;

Script.prototype.getStringContent = function(truncate, maxEl) {
  if (truncate === null) {
    truncate = true;
  }

  if ('undefined' === typeof maxEl) {
    maxEl = 15;
  }

  var s = '';
  for (var i = 0, l = this.chunks.length; i < l; i++) {
    var chunk = this.chunks[i];

    if (i > 0) {
      s += ' ';
    }

    if (Buffer.isBuffer(chunk)) {
      s += '0x' + util.formatBuffer(chunk, truncate ? null : 0);
    } else {
      s += Opcode.reverseMap[chunk];
    }

    if (maxEl && i > maxEl) {
      s += ' ...';
      break;
    }
  }
  return s;
};

Script.prototype.toString = function(truncate, maxEl) {
  var script = "<Script ";
  script += this.getStringContent(truncate, maxEl);
  script += ">";
  return script;
};

Script.prototype.writeOp = function(opcode) {
  var buf = Buffer(this.buffer.length + 1);
  this.buffer.copy(buf);
  buf.writeUInt8(opcode, this.buffer.length);

  this.buffer = buf;

  this.chunks.push(opcode);
};

Script.prototype.writeN = function(n) {
  if (n < 0 || n > 16)
    throw new Error("writeN: out of range value " + n);

  if (n == 0)
    this.writeOp(Opcode.map.OP_0);
  else
    this.writeOp(Opcode.map.OP_1 + n - 1);
};

function prefixSize(data_length) {
  if (data_length < Opcode.map.OP_PUSHDATA1) {
    return 1;
  } else if (data_length <= 0xff) {
    return 1 + 1;
  } else if (data_length <= 0xffff) {
    return 1 + 2;
  } else {
    return 1 + 4;
  }
};

function encodeLen(data_length) {
  var buf = undefined;
  if (data_length < Opcode.map.OP_PUSHDATA1) {
    buf = new Buffer(1);
    buf.writeUInt8(data_length, 0);
  } else if (data_length <= 0xff) {
    buf = new Buffer(1 + 1);
    buf.writeUInt8(Opcode.map.OP_PUSHDATA1, 0);
    buf.writeUInt8(data_length, 1);
  } else if (data_length <= 0xffff) {
    buf = new Buffer(1 + 2);
    buf.writeUInt8(Opcode.map.OP_PUSHDATA2, 0);
    buf.writeUInt16LE(data_length, 1);
  } else {
    buf = new Buffer(1 + 4);
    buf.writeUInt8(Opcode.map.OP_PUSHDATA4, 0);
    buf.writeUInt32LE(data_length, 1);
  }

  return buf;
};

Script.prototype.writeBytes = function(data) {
  var newSize = this.buffer.length + prefixSize(data.length) + data.length;
  this.buffer = Buffer.concat([this.buffer, encodeLen(data.length), data]);
  this.chunks.push(data);
};

Script.prototype.updateBuffer = function() {
  this.buffer = Script.chunksToBuffer(this.chunks);
};

Script.prototype.findAndDelete = function(chunk) {
  var dirty = false;
  if (Buffer.isBuffer(chunk)) {
    for (var i = 0, l = this.chunks.length; i < l; i++) {
      if (Buffer.isBuffer(this.chunks[i]) &&
        buffertools.compare(this.chunks[i], chunk) === 0) {
        this.chunks.splice(i, 1);
        i--;
        dirty = true;
      }
    }
  } else if ("number" === typeof chunk) {
    for (var i = 0, l = this.chunks.length; i < l; i++) {
      if (this.chunks[i] === chunk) {
        this.chunks.splice(i, 1);
        i--;
        dirty = true;
      }
    }
  } else {
    throw new Error("Invalid chunk datatype.");
  }
  if (dirty) {
    this.updateBuffer();
  }
};

/**
 * Creates a simple OP_CHECKSIG with pubkey output script.
 *
 * These are used for coinbase transactions and at some point were used for
 * IP-based transactions as well.
 */
Script.createPubKeyOut = function(pubkey) {
  var script = new Script();
  script.writeBytes(pubkey);
  script.writeOp(Opcode.map.OP_CHECKSIG);
  return script;
};

/**
 * Creates a standard txout script.
 */
Script.createPubKeyHashOut = function(pubKeyHash) {
  var script = new Script();
  script.writeOp(Opcode.map.OP_DUP);
  script.writeOp(Opcode.map.OP_HASH160);
  script.writeBytes(pubKeyHash);
  script.writeOp(Opcode.map.OP_EQUALVERIFY);
  script.writeOp(Opcode.map.OP_CHECKSIG);
  return script;
};

Script._sortKeys = function(keys) {
  return keys.sort(function(buf1, buf2) {
    var len = buf1.length > buf1.length ? buf1.length : buf2.length;
    for (var i = 0; i <= len; i++) {
      if (buf1[i] === undefined)
        return -1; //shorter strings come first
      if (buf2[i] === undefined)
        return 1;
      if (buf1[i] < buf2[i])
        return -1;
      if (buf1[i] > buf2[i])
        return 1;
      else
        continue;
    }
    return 0;
  });
};

Script.createMultisig = function(n_required, inKeys, opts) {
  opts = opts || {};
  var keys = opts.noSorting ? inKeys : this._sortKeys(inKeys);
  var script = new Script();
  script.writeN(n_required);
  keys.forEach(function(key) {
    script.writeBytes(key);
  });
  script.writeN(keys.length);
  script.writeOp(Opcode.map.OP_CHECKMULTISIG);
  return script;
};

Script.createP2SH = function(scriptHash) {
  var script = new Script();
  script.writeOp(Opcode.map.OP_HASH160);
  script.writeBytes(scriptHash);
  script.writeOp(Opcode.map.OP_EQUAL);
  return script;
};

Script.fromTestData = function(testData) {
  testData = testData.map(function(chunk) {
    if ("string" === typeof chunk) {
      return new Buffer(chunk, 'hex');
    } else {
      return chunk;
    }
  });

  var script = new Script();
  script.chunks = testData;
  script.updateBuffer();
  return script;
};

Script.fromChunks = function(chunks) {
  var script = new Script();
  script.chunks = chunks;
  script.updateBuffer();
  return script;
};

Script.fromHumanReadable = function(s) {
  return new Script(Script.stringToBuffer(s));
};

Script.prototype.toHumanReadable = function() {
  var s = '';
  for (var i = 0, l = this.chunks.length; i < l; i++) {
    var chunk = this.chunks[i];

    if (i > 0) {
      s += ' ';
    }

    if (Buffer.isBuffer(chunk)) {
      if (chunk.length === 0) {
        s += '0';
      } else {
        s += '0x' + util.formatBuffer(encodeLen(chunk.length), 0) + ' ';
        s += '0x' + util.formatBuffer(chunk, 0);
      }
    } else {
      var opcode = Opcode.reverseMap[chunk];
      if (typeof opcode === 'undefined') {
        opcode = '0x' + chunk.toString(16);
      }
      s += opcode;
    }
  }
  return s;
};

Script.stringToBuffer = function(s) {
  var buf = new Put();
  var split = s.split(' ');
  for (var i = 0; i < split.length; i++) {
    var word = split[i];
    if (word === '') continue;
    if (word.length > 2 && word.substring(0, 2) === '0x') {
      // raw hex value
      //console.log('hex value');
      buf.put(new Buffer(word.substring(2, word.length), 'hex'));
    } else {
      var opcode = Opcode.map['OP_' + word] || Opcode.map[word];
      if (typeof opcode !== 'undefined') {
        // op code in string form
        //console.log('opcode');
        buf.word8(opcode);
      } else {
        var integer = parseInt(word);
        if (!isNaN(integer)) {
          // integer
          //console.log('integer');
          var data = util.intToBufferSM(integer);
          buf.put(Script.chunksToBuffer([data]));
        } else if (word[0] === '\'' && word[word.length - 1] === '\'') {
          // string
          //console.log('string');
          word = word.substring(1, word.length - 1);
          buf.put(Script.chunksToBuffer([new Buffer(word)]));
        } else {
          throw new Error('Could not parse word "' + word + '" from script "' + s + '"');
        }
      }
    }
  }
  return buf.buffer();
};

Script.chunksToBuffer = function(chunks) {
  var buf = new Put();

  for (var i = 0, l = chunks.length; i < l; i++) {
    var data = chunks[i];
    if (Buffer.isBuffer(data)) {
      if (data.length < Opcode.map.OP_PUSHDATA1) {
        buf.word8(data.length);
      } else if (data.length <= 0xff) {
        buf.word8(Opcode.map.OP_PUSHDATA1);
        buf.word8(data.length);
      } else if (data.length <= 0xffff) {
        buf.word8(Opcode.map.OP_PUSHDATA2);
        buf.word16le(data.length);
      } else {
        buf.word8(Opcode.map.OP_PUSHDATA4);
        buf.word32le(data.length);
      }
      buf.put(data);
    } else if ("number" === typeof data) {
      buf.word8(data);
    } else {
      throw new Error("Script.chunksToBuffer(): Invalid chunk datatype");
    }
  }
  return buf.buffer();
};



module.exports = Script;
