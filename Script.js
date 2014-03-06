require('classtool');

function spec(b) {
  var config = b.config || require('./config');
  var log = b.log || require('./util/log');

  var Opcode = b.Opcode || require('./Opcode').class();
  var buffertools = b.buffertools || require('buffertools');

  // Make opcodes available as pseudo-constants
  for (var i in Opcode.map) {
    eval(i + " = " + Opcode.map[i] + ";");
  }

  var util = b.util || require('./util/util');
  var Parser = b.Parser || require('./util/BinaryParser').class();
  var Put = b.Put || require('bufferput');

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
  };
  this.class = Script;

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

      var len;
      if (opcode > 0 && opcode < OP_PUSHDATA1) {
        // Read some bytes of data, opcode value is the length of data
        this.chunks.push(parser.buffer(opcode));
      } else if (opcode == OP_PUSHDATA1) {
        len = parser.word8();
        this.chunks.push(parser.buffer(len));
      } else if (opcode == OP_PUSHDATA2) {
        len = parser.word16le();
        this.chunks.push(parser.buffer(len));
      } else if (opcode == OP_PUSHDATA4) {
        len = parser.word32le();
        this.chunks.push(parser.buffer(len));
      } else {
        this.chunks.push(opcode);
      }
    }
  };

  Script.prototype.isPushOnly = function() {
    for (var i = 0; i < this.chunks.length; i++)
      if (!Buffer.isBuffer(this.chunks[i]))
        return false;

    return true;
  };

  Script.prototype.isP2SH = function() {
    return (this.chunks.length == 3 &&
      this.chunks[0] == OP_HASH160 &&
      Buffer.isBuffer(this.chunks[1]) &&
      this.chunks[1].length == 20 &&
      this.chunks[2] == OP_EQUAL);
  };

  Script.prototype.isPubkey = function() {
    return (this.chunks.length == 2 &&
      Buffer.isBuffer(this.chunks[0]) &&
      this.chunks[1] == OP_CHECKSIG);
  };

  Script.prototype.isPubkeyHash = function() {
    return (this.chunks.length == 5 &&
      this.chunks[0] == OP_DUP &&
      this.chunks[1] == OP_HASH160 &&
      Buffer.isBuffer(this.chunks[2]) &&
      this.chunks[2].length == 20 &&
      this.chunks[3] == OP_EQUALVERIFY &&
      this.chunks[4] == OP_CHECKSIG);
  };

  function isSmallIntOp(opcode) {
    return ((opcode == OP_0) ||
      ((opcode >= OP_1) && (opcode <= OP_16)));
  };

  Script.prototype.isMultiSig = function() {
    return (this.chunks.length > 3 &&
      isSmallIntOp(this.chunks[0]) &&
      isSmallIntOp(this.chunks[this.chunks.length - 2]) &&
      this.chunks[this.chunks.length - 1] == OP_CHECKMULTISIG);
  };

  Script.prototype.finishedMultiSig = function() {
    var nsigs = 0;
    for (var i = 0; i < this.chunks.length - 1; i++)
      if (this.chunks[i] !== 0)
        nsigs++;

    var serializedScript = this.chunks[this.chunks.length - 1];
    var script = new Script(serializedScript);
    var nreq = script.chunks[0] - 80; //see OP_2-OP_16

    if (nsigs == nreq)
      return true;
    else
      return false;
  }

  Script.prototype.removePlaceHolders = function() {
    var chunks = [];
    for (var i in this.chunks) {
      if (this.chunks.hasOwnProperty(i)) {
        var chunk = this.chunks[i];
        if (chunk != 0)
          chunks.push(chunk);
      }
    }
    this.chunks = chunks;
    this.updateBuffer();
    return this;
  }

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
  }

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

  Script.fromStringContent = function(s) {
    var chunks = [];
    var split = s.split(' ');
    for (var i = 0; i < split.length; i++) {
      var word = split[i];
      if (word.length > 2 && word.substring(0, 2) === '0x') {
        chunks.push(new Buffer(word.substring(2, word.length), 'hex'));
      } else {
        var opcode = Opcode.map['OP_' + word];
        if (opcode) {
          chunks.push(opcode);
        } else {
          var integer = parseInt(word);
          if (!isNaN(integer)) {
            //console.log(integer+' bits=\t'+integer.toString(2).replace('-','').length);
            var data = util.intToBuffer(integer);
            chunks.push(data);
          }
        }
      }
    }
    return Script.fromChunks(chunks);
  };

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
      this.writeOp(OP_0);
    else
      this.writeOp(OP_1 + n - 1);
  };

  function prefixSize(data_length) {
    if (data_length < OP_PUSHDATA1) {
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
    if (data_length < OP_PUSHDATA1) {
      buf = new Buffer(1);
      buf.writeUInt8(data_length, 0);
    } else if (data_length <= 0xff) {
      buf = new Buffer(1 + 1);
      buf.writeUInt8(OP_PUSHDATA1, 0);
      buf.writeUInt8(data_length, 1);
    } else if (data_length <= 0xffff) {
      buf = new Buffer(1 + 2);
      buf.writeUInt8(OP_PUSHDATA2, 0);
      buf.writeUInt16LE(data_length, 1);
    } else {
      buf = new Buffer(1 + 4);
      buf.writeUInt8(OP_PUSHDATA4, 0);
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
          dirty = true;
        }
      }
    } else if ("number" === typeof chunk) {
      for (var i = 0, l = this.chunks.length; i < l; i++) {
        if (this.chunks[i] === chunk) {
          this.chunks.splice(i, 1);
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
    script.writeOp(OP_CHECKSIG);
    return script;
  };

  /**
   * Creates a standard txout script.
   */
  Script.createPubKeyHashOut = function(pubKeyHash) {
    var script = new Script();
    script.writeOp(OP_DUP);
    script.writeOp(OP_HASH160);
    script.writeBytes(pubKeyHash);
    script.writeOp(OP_EQUALVERIFY);
    script.writeOp(OP_CHECKSIG);
    return script;
  };

  Script.createMultisig = function(n_required, keys) {
    var script = new Script();
    script.writeN(n_required);
    keys.forEach(function(key) {
      script.writeBytes(key);
    });
    script.writeN(keys.length);
    script.writeOp(OP_CHECKMULTISIG);
    return script;
  };

  Script.createP2SH = function(scriptHash) {
    var script = new Script();
    script.writeOp(OP_HASH160);
    script.writeBytes(scriptHash);
    script.writeOp(OP_EQUAL);
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

  Script.chunksToBuffer = function(chunks) {
    var buf = new Put();

    for (var i = 0, l = chunks.length; i < l; i++) {
      var data = chunks[i];
      if (Buffer.isBuffer(data)) {
        if (data.length < OP_PUSHDATA1) {
          buf.word8(data.length);
        } else if (data.length <= 0xff) {
          buf.word8(OP_PUSHDATA1);
          buf.word8(data.length);
        } else if (data.length <= 0xffff) {
          buf.word8(OP_PUSHDATA2);
          buf.word16le(data.length);
        } else {
          buf.word8(OP_PUSHDATA4);
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

  return Script;
};
module.defineClass(spec);
