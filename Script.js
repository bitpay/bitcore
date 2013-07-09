require('classtool');

function spec(b) {
  var Opcode = require('./opcode').class();

  // Make opcodes available as pseudo-constants
  for (var i in Opcode.map) {
    eval(i + " = " + Opcode.map[i] + ";");
  }

  var logger = b.logger || require('../ext/logger');
  var Util = b.Util || require('../ext/util');
  var Parser = b.Parser || require('../ext/binaryParser').class();
  var Put = b.Put || require('bufferput');

  function Script(buffer) {
    if(buffer) {
      this.buffer = buffer;
    } else {
      this.buffer = Util.EMPTY_BUFFER;
    }
    this.chunks = [];
    this.parse();
  };
  this.class = Script;

  Script.prototype.parse = function () {
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

  Script.prototype.isSentToIP = function ()
  {
    if (this.chunks.length != 2) {
      return false;
    }
    return this.chunks[1] == OP_CHECKSIG && Buffer.isBuffer(this.chunks[0]);
  };

  Script.prototype.getOutType = function ()
  {
    if (this.chunks.length == 5 &&
      this.chunks[0] == OP_DUP &&
      this.chunks[1] == OP_HASH160 &&
      this.chunks[3] == OP_EQUALVERIFY &&
      this.chunks[4] == OP_CHECKSIG) {

      // Transfer to Bitcoin address
      return 'Address';
    } else if (this.chunks.length == 2 &&
      this.chunks[1] == OP_CHECKSIG) {

      // Transfer to IP address
      return 'Pubkey';
    } else {
      return 'Strange';
    }
  };

  Script.prototype.simpleOutHash = function ()
  {
    switch (this.getOutType()) {
    case 'Address':
      return this.chunks[2];
    case 'Pubkey':
      return Util.sha256ripe160(this.chunks[0]);
    default:
      logger.scrdbg("Encountered non-standard scriptPubKey");
      logger.scrdbg("Strange script was: " + this.toString());
      return null;
    }
  };

  Script.prototype.getInType = function ()
  {
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

  Script.prototype.simpleInPubKey = function ()
  {
    switch (this.getInType()) {
    case 'Address':
      return this.chunks[1];
    case 'Pubkey':
      return null;
    default:
      logger.scrdbg("Encountered non-standard scriptSig");
      logger.scrdbg("Strange script was: " + this.toString());
      return null;
    }
  };

  Script.prototype.getBuffer = function ()
  {
    return this.buffer;
  };

  Script.prototype.getStringContent = function (truncate, maxEl)
  {
    if (truncate === null) {
      truncate = true;
    }

    if ("undefined" === typeof maxEl) {
      maxEl = 15;
    }

    var script = '';
    for (var i = 0, l = this.chunks.length; i < l; i++) {
      var chunk = this.chunks[i];

      if (i > 0) {
        script += " ";
      }

      if (Buffer.isBuffer(chunk)) {
        script += "0x"+Util.formatBuffer(chunk, truncate ? null : 0);
      } else {
        script += Opcode.reverseMap[chunk];
      }

      if (maxEl && i > maxEl) {
        script += " ...";
        break;
      }
    }
    return script;
  };

  Script.prototype.toString = function (truncate, maxEl)
  {
    var script = "<Script ";
    script += this.getStringContent(truncate, maxEl);
    script += ">";
    return script;
  };


  Script.prototype.writeOp = function (opcode)
  {
    var buf = Put();
    buf.put(this.buffer);
    buf.word8(opcode);
    this.buffer = buf.buffer();

    this.chunks.push(opcode);
  };

  Script.prototype.writeBytes = function (data)
  {
    var buf = Put();
    buf.put(this.buffer);
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
    this.buffer = buf.buffer();
    this.chunks.push(data);
  };

  Script.prototype.updateBuffer = function ()
  {
    this.buffer = Script.chunksToBuffer(this.chunks);
  };

  Script.prototype.findAndDelete = function (chunk)
  {
    var dirty = false;
    if (Buffer.isBuffer(chunk)) {
      for (var i = 0, l = this.chunks.length; i < l; i++) {
        if (Buffer.isBuffer(this.chunks[i]) &&
            this.chunks[i].compare(chunk) == 0) {
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
  Script.createPubKeyOut = function (pubkey) {
    var script = new Script();
    script.writeBytes(pubkey);
    script.writeOp(OP_CHECKSIG);
    return script;
  };

  /**
   * Creates a standard txout script.
   */
  Script.createPubKeyHashOut = function (pubKeyHash) {
    var script = new Script();
    script.writeOp(OP_DUP);
    script.writeOp(OP_HASH160);
    script.writeBytes(pubKeyHash);
    script.writeOp(OP_EQUALVERIFY);
    script.writeOp(OP_CHECKSIG);
    return script;
  };

  Script.fromTestData = function (testData) {
    testData = testData.map(function (chunk) {
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

  Script.fromChunks = function (chunks) {
    var script = new Script();
    script.chunks = chunks;
    script.updateBuffer();
    return script;
  };

  Script.chunksToBuffer = function (chunks) {
    var buf = Put();
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

