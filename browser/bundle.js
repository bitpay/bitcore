(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
function sAddress(b) {
  var superclass = b.superclass || require('./util/VersionedData').class();

  function Address() {
    Address.super(this, arguments);
  };

  Address.superclass = superclass;
  superclass.applyEncodingsTo(Address);

  Address.prototype.validate = function() {
    this.doAsBinary(function() {
      Address.super(this, 'validate', arguments);
      if(this.data.length != 21) throw new Error('invalid data length');
    });
  };

  return Address;
};


if(!(typeof module === 'undefined')) {
  module.defineClass(sAddress);
} else if(!(typeof define === 'undefined')) {
  define(['classtool', 'util/VersionedData'],function(Classtool) {
    return Classtool.defineClass(sAddress);
  });
}


},{"./util/VersionedData":46}],2:[function(require,module,exports){
function sOpcode(b) {
  function Opcode(num) {
    this.code = num;
  };

  Opcode.prototype.toString = function () {
    return Opcode.reverseMap[this.code];
  };

  Opcode.map = {
    // push value
    OP_FALSE     : 0,
    OP_0         : 0,
    OP_PUSHDATA1 : 76,
    OP_PUSHDATA2 : 77,
    OP_PUSHDATA4 : 78,
    OP_1NEGATE   : 79,
    OP_RESERVED  : 80,
    OP_TRUE      : 81,
    OP_1         : 81,
    OP_2         : 82,
    OP_3         : 83,
    OP_4         : 84,
    OP_5         : 85,
    OP_6         : 86,
    OP_7         : 87,
    OP_8         : 88,
    OP_9         : 89,
    OP_10        : 90,
    OP_11        : 91,
    OP_12        : 92,
    OP_13        : 93,
    OP_14        : 94,
    OP_15        : 95,
    OP_16        : 96,

    // control
    OP_NOP       : 97,
    OP_VER       : 98,
    OP_IF        : 99,
    OP_NOTIF     : 100,
    OP_VERIF     : 101,
    OP_VERNOTIF  : 102,
    OP_ELSE      : 103,
    OP_ENDIF     : 104,
    OP_VERIFY    : 105,
    OP_RETURN    : 106,

    // stack ops
    OP_TOALTSTACK   : 107,
    OP_FROMALTSTACK : 108,
    OP_2DROP        : 109,
    OP_2DUP         : 110,
    OP_3DUP         : 111,
    OP_2OVER        : 112,
    OP_2ROT         : 113,
    OP_2SWAP        : 114,
    OP_IFDUP        : 115,
    OP_DEPTH        : 116,
    OP_DROP         : 117,
    OP_DUP          : 118,
    OP_NIP          : 119,
    OP_OVER         : 120,
    OP_PICK         : 121,
    OP_ROLL         : 122,
    OP_ROT          : 123,
    OP_SWAP         : 124,
    OP_TUCK         : 125,

    // splice ops
    OP_CAT          : 126,
    OP_SUBSTR       : 127,
    OP_LEFT         : 128,
    OP_RIGHT        : 129,
    OP_SIZE         : 130,

    // bit logic
    OP_INVERT       : 131,
    OP_AND          : 132,
    OP_OR           : 133,
    OP_XOR          : 134,
    OP_EQUAL        : 135,
    OP_EQUALVERIFY  : 136,
    OP_RESERVED1    : 137,
    OP_RESERVED2    : 138,

    // numeric
    OP_1ADD         : 139,
    OP_1SUB         : 140,
    OP_2MUL         : 141,
    OP_2DIV         : 142,
    OP_NEGATE       : 143,
    OP_ABS          : 144,
    OP_NOT          : 145,
    OP_0NOTEQUAL    : 146,

    OP_ADD          : 147,
    OP_SUB          : 148,
    OP_MUL          : 149,
    OP_DIV          : 150,
    OP_MOD          : 151,
    OP_LSHIFT       : 152,
    OP_RSHIFT       : 153,

    OP_BOOLAND             : 154,
    OP_BOOLOR              : 155,
    OP_NUMEQUAL            : 156,
    OP_NUMEQUALVERIFY      : 157,
    OP_NUMNOTEQUAL         : 158,
    OP_LESSTHAN            : 159,
    OP_GREATERTHAN         : 160,
    OP_LESSTHANOREQUAL     : 161,
    OP_GREATERTHANOREQUAL  : 162,
    OP_MIN                 : 163,
    OP_MAX                 : 164,

    OP_WITHIN              : 165,

    // crypto
    OP_RIPEMD160           : 166,
    OP_SHA1                : 167,
    OP_SHA256              : 168,
    OP_HASH160             : 169,
    OP_HASH256             : 170,
    OP_CODESEPARATOR       : 171,
    OP_CHECKSIG            : 172,
    OP_CHECKSIGVERIFY      : 173,
    OP_CHECKMULTISIG       : 174,
    OP_CHECKMULTISIGVERIFY : 175,

    // expansion
    OP_NOP1  : 176,
    OP_NOP2  : 177,
    OP_NOP3  : 178,
    OP_NOP4  : 179,
    OP_NOP5  : 180,
    OP_NOP6  : 181,
    OP_NOP7  : 182,
    OP_NOP8  : 183,
    OP_NOP9  : 184,
    OP_NOP10 : 185,

    // template matching params
    OP_PUBKEYHASH    : 253,
    OP_PUBKEY        : 254,
    OP_INVALIDOPCODE : 255
  };

  Opcode.reverseMap = [];

  for (var k in Opcode.map) {
    if(Opcode.map.hasOwnProperty(k)) {
      Opcode.reverseMap[Opcode.map[k]] = k.substr(3);
    }
  }

  return Opcode;
};


if(!(typeof module === 'undefined')) {
  module.defineClass(sOpcode);
} else if(!(typeof define === 'undefined')) {
  define(['classtool'], function(Classtool) {
    return Classtool.defineClass(sOpcode);
  });
}



},{}],3:[function(require,module,exports){
(function (Buffer){'use strict';

function sScript(b) {
  var config = b.config || require('./config');
  var log = b.log || require('./util/log');

  var Opcode = require('./Opcode').class();

  // Make opcodes available as pseudo-constants
  for (var i in Opcode.map) {
    eval(i + ' = ' + Opcode.map[i] + ';');
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
    if(buffer) {
      this.buffer = buffer;
    } else {
      this.buffer = util.EMPTY_BUFFER;
    }
    this.chunks = [];
    this.parse();
  }
  this.class = Script;

  Script.TX_UNKNOWN=TX_UNKNOWN;
  Script.TX_PUBKEY=TX_PUBKEY;
  Script.TX_PUBKEYHASH=TX_PUBKEYHASH;
  Script.TX_MULTISIG=TX_MULTISIG;
  Script.TX_SCRIPTHASH=TX_SCRIPTHASH;

  Script.prototype.parse = function () {
    this.chunks = [];

    var parser = new Parser(this.buffer);
    while (!parser.eof()) {
      var opcode = parser.word8();

      var len;
      if (opcode > 0 && opcode < OP_PUSHDATA1) {
        // Read some bytes of data, opcode value is the length of data
        this.chunks.push(parser.buffer(opcode));
      } else if (opcode === OP_PUSHDATA1) {
        len = parser.word8();
        this.chunks.push(parser.buffer(len));
      } else if (opcode === OP_PUSHDATA2) {
        len = parser.word16le();
        this.chunks.push(parser.buffer(len));
      } else if (opcode === OP_PUSHDATA4) {
        len = parser.word32le();
        this.chunks.push(parser.buffer(len));
      } else {
        this.chunks.push(opcode);
      }
    }
  };

  Script.prototype.isPushOnly = function ()
  {
    for (var i = 0; i < this.chunks.length; i++)
      if (!Buffer.isBuffer(this.chunks[i]))
        return false;

    return true;
  };

  Script.prototype.isP2SH = function ()
  {
    return (this.chunks.length === 3 &&
      this.chunks[0] === OP_HASH160 &&
      Buffer.isBuffer(this.chunks[1]) &&
      this.chunks[1].length === 20 &&
      this.chunks[2] === OP_EQUAL);
  };

  Script.prototype.isPubkey = function ()
  {
    return (this.chunks.length === 2 &&
          Buffer.isBuffer(this.chunks[0]) &&
          this.chunks[1] === OP_CHECKSIG);
  };

  Script.prototype.isPubkeyHash = function ()
  {
    return (this.chunks.length === 5 &&
            this.chunks[0] === OP_DUP &&
            this.chunks[1] === OP_HASH160 &&
      Buffer.isBuffer(this.chunks[2]) &&
      this.chunks[2].length === 20 &&
            this.chunks[3] === OP_EQUALVERIFY &&
            this.chunks[4] === OP_CHECKSIG);
  };

  function isSmallIntOp(opcode)
  {
    return ((opcode === OP_0) ||
          ((opcode >= OP_1) && (opcode <= OP_16)));
  }

  Script.prototype.isMultiSig = function ()
  {
    return (this.chunks.length > 3 &&
          isSmallIntOp(this.chunks[0]) &&
          isSmallIntOp(this.chunks[this.chunks.length-2]) &&
      this.chunks[this.chunks.length-1] === OP_CHECKMULTISIG);
  };

  Script.prototype.finishedMultiSig = function()
  {
    var nsigs = 0;
    for (var i = 0; i < this.chunks.length-1; i++)
      if (this.chunks[i] !== 0)
        nsigs++;

    var serializedScript = this.chunks[this.chunks.length-1];
    var script = new Script(serializedScript);
    var nreq = script.chunks[0] - 80; //see OP_2-OP_16

    if (nsigs == nreq)
      return true;
    else
      return false;
  }

  Script.prototype.removePlaceHolders = function()
  {
    var chunks = [];
    for (var i in this.chunks)
    {
      var chunk = this.chunks[i];
      if (chunk != 0)
        chunks.push(chunk);
    }
    this.chunks = chunks;
    this.updateBuffer();
    return this;
  }

  Script.prototype.prependOp0 = function()
  {
    var chunks = [0];
    for (i in this.chunks)
      chunks.push(this.chunks[i]);
    this.chunks = chunks;
    this.updateBuffer();
    return this;
  }

  // is this a script form we know?
  Script.prototype.classify = function ()
  {
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
  Script.prototype.capture = function ()
  {
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
  Script.prototype.captureOne = function ()
  {
    var arr = this.capture();
  return arr[0];
  };

  Script.prototype.getOutType = function ()
  {
    var txType = this.classify();
    switch (txType) {
      case TX_PUBKEY:   return 'Pubkey';
      case TX_PUBKEYHASH: return 'Address';
      default:    return 'Strange';
    }
  };

  Script.prototype.getRawOutType = function() {
    return TX_TYPES[this.classify()];
  };

  Script.prototype.simpleOutHash = function ()
  {
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
      log.debug("Encountered non-standard scriptSig");
      log.debug("Strange script was: " + this.toString());
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

    if ('undefined' === typeof maxEl) {
      maxEl = 15;
    }

    var script = '';
    for (var i = 0, l = this.chunks.length; i < l; i++) {
      var chunk = this.chunks[i];

      if (i > 0) {
        script += " ";
      }

      if (Buffer.isBuffer(chunk)) {
        script += "0x"+util.formatBuffer(chunk, truncate ? null : 0);
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
    var buf = Buffer(this.buffer.length + 1);
    this.buffer.copy(buf);
    buf.writeUInt8(opcode, this.buffer.length);

    this.buffer = buf;

    this.chunks.push(opcode);
  };

  Script.prototype.writeN = function (n)
  {
    if (n < 0 || n > 16)
      throw new Error("writeN: out of range value " + n);

    if (n == 0)
      this.writeOp(OP_0);
    else
      this.writeOp(OP_1 + n - 1);
  };

  function prefixSize(data_length)
  {
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
    }
    
    else if (data_length <= 0xff) {
      buf = new Buffer(1 + 1);
      buf.writeUInt8(OP_PUSHDATA1, 0);
      buf.writeUInt8(data_length, 1);
    }
    
    else if (data_length <= 0xffff) {
      buf = new Buffer(1 + 2);
      buf.writeUInt8(OP_PUSHDATA2, 0);
      buf.writeUInt16LE(data_length, 1);
    }
    
    else {
      buf = new Buffer(1 + 4);
      buf.writeUInt8(OP_PUSHDATA4, 0);
      buf.writeUInt32LE(data_length, 1);
    }

    return buf;
  };

  Script.prototype.writeBytes = function (data)
  {
    var newSize = this.buffer.length + prefixSize(data.length) + data.length;
    this.buffer = Buffer.concat([this.buffer, encodeLen(data.length), data]);
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


if(!(typeof module === 'undefined')) {
  module.defineClass(sScript);
} else if(!(typeof define === 'undefined')) {
  define(['classtool', 'Opcode', 'util/util'], function(Classtool) {
    return Classtool.defineClass(sScript);
  });
}


}).call(this,require("buffer").Buffer)
},{"./Opcode":2,"./config":6,"./util/BinaryParser":44,"./util/log":48,"./util/util":49,"buffer":29,"bufferput":15}],4:[function(require,module,exports){
(function (process,Buffer){require('classtool');

function spec(b) {
  var assert = require('assert');
  var config = b.config || require('./config');
  var log = b.log || require('./util/log');

  var Opcode = require('./Opcode').class();

  // Make opcodes available as pseudo-constants
  for (var i in Opcode.map) {
    eval(i + " = " + Opcode.map[i] + ";");
  }

  var bignum = b.bignum || require('bignum');
  var Util = b.Util || require('./util/util');
  var Script = require('./Script').class();

  function ScriptInterpreter() {
    this.stack = [];
    this.disableUnsafeOpcodes = true;
  };

  ScriptInterpreter.prototype.eval = function eval(script, tx, inIndex, hashType, callback)
  {
    if ("function" !== typeof callback) {
      throw new Error("ScriptInterpreter.eval() requires a callback");
    }

    var pc = 0;

    var execStack = [];
    var altStack = [];
    var hashStart = 0;
    var opCount = 0;

    if (script.buffer.length > 10000) {
      callback(new Error("Oversized script (> 10k bytes)"));
      return this;
    }

    // Start execution by running the first step
    executeStep.call(this, callback);

    function executeStep(cb) {
      // Once all chunks have been processed, execution ends
      if (pc >= script.chunks.length) {
        // Execution stack must be empty at the end of the script
        if (execStack.length) {
          cb(new Error("Execution stack ended non-empty"));
          return;
        }

        // Execution successful (Note that we still have to check whether the
        // final stack contains a truthy value.)
        cb(null);
        return;
      }

      try {
        // The execution bit is true if there are no "false" values in the
        // execution stack. (A "false" value indicates that we're in the
        // inactive branch of an if statement.)
        var exec = !~execStack.indexOf(false);

        var opcode = script.chunks[pc++];

        if (opcode.length > 520) {
          throw new Error("Max push value size exceeded (>520)");
        }

        if (opcode > OP_16 && ++opCount > 201) {
          throw new Error("Opcode limit exceeded (>200)");
        }

        if (this.disableUnsafeOpcodes &&
            "number" === typeof opcode &&
            (opcode === OP_CAT ||
             opcode === OP_SUBSTR ||
             opcode === OP_LEFT ||
             opcode === OP_RIGHT ||
             opcode === OP_INVERT ||
             opcode === OP_AND ||
             opcode === OP_OR ||
             opcode === OP_XOR ||
             opcode === OP_2MUL ||
             opcode === OP_2DIV ||
             opcode === OP_MUL ||
             opcode === OP_DIV ||
             opcode === OP_MOD ||
             opcode === OP_LSHIFT ||
             opcode === OP_RSHIFT)) {
          throw new Error("Encountered a disabled opcode");
        }

        if (exec && Buffer.isBuffer(opcode))
          this.stack.push(opcode);
        else if (exec || (OP_IF <= opcode && opcode <= OP_ENDIF))
        switch (opcode) {
        case OP_0:
          this.stack.push(new Buffer([]));
          break;

        case OP_1NEGATE:
        case OP_1:
        case OP_2:
        case OP_3:
        case OP_4:
        case OP_5:
        case OP_6:
        case OP_7:
        case OP_8:
        case OP_9:
        case OP_10:
        case OP_11:
        case OP_12:
        case OP_13:
        case OP_14:
        case OP_15:
        case OP_16:
          this.stack.push(bigintToBuffer(opcode - OP_1 + 1));
          break;

        case OP_NOP:
        case OP_NOP1: case OP_NOP2: case OP_NOP3: case OP_NOP4: case OP_NOP5:
        case OP_NOP6: case OP_NOP7: case OP_NOP8: case OP_NOP9: case OP_NOP10:
          break;

        case OP_IF:
        case OP_NOTIF:
          // <expression> if [statements] [else [statements]] endif
          var value = false;
          if (exec) {
            value = castBool(this.stackPop());
            if (opcode === OP_NOTIF) {
              value = !value;
            }
          }
          execStack.push(value);
          break;

        case OP_ELSE:
          if (execStack.length < 1) {
            throw new Error("Unmatched OP_ELSE");
          }
          execStack[execStack.length-1] = !execStack[execStack.length-1];
          break;

        case OP_ENDIF:
          if (execStack.length < 1) {
            throw new Error("Unmatched OP_ENDIF");
          }
          execStack.pop();
          break;

        case OP_VERIFY:
          var value = castBool(this.stackTop());
          if (value) {
            this.stackPop();
          } else {
            throw new Error("OP_VERIFY negative");
          }
          break;

        case OP_RETURN:
          throw new Error("OP_RETURN");

        case OP_TOALTSTACK:
          altStack.push(this.stackPop());
          break;

        case OP_FROMALTSTACK:
          if (altStack.length < 1) {
            throw new Error("OP_FROMALTSTACK with alt stack empty");
          }
          this.stack.push(altStack.pop());
          break;

        case OP_2DROP:
          // (x1 x2 -- )
          this.stackPop();
          this.stackPop();
          break;

        case OP_2DUP:
          // (x1 x2 -- x1 x2 x1 x2)
          var v1 = this.stackTop(2);
          var v2 = this.stackTop(1);
          this.stack.push(v1);
          this.stack.push(v2);
          break;

        case OP_3DUP:
          // (x1 x2 -- x1 x2 x1 x2)
          var v1 = this.stackTop(3);
          var v2 = this.stackTop(2);
          var v3 = this.stackTop(1);
          this.stack.push(v1);
          this.stack.push(v2);
          this.stack.push(v3);
          break;

        case OP_2OVER:
          // (x1 x2 x3 x4 -- x1 x2 x3 x4 x1 x2)
          var v1 = this.stackTop(4);
          var v2 = this.stackTop(3);
          this.stack.push(v1);
          this.stack.push(v2);
          break;

        case OP_2ROT:
          // (x1 x2 x3 x4 x5 x6 -- x3 x4 x5 x6 x1 x2)
          var v1 = this.stackTop(6);
          var v2 = this.stackTop(5);
          this.stack.splice(this.stack.length - 6, 2);
          this.stack.push(v1);
          this.stack.push(v2);
          break;

        case OP_2SWAP:
          // (x1 x2 x3 x4 -- x3 x4 x1 x2)
          this.stackSwap(4, 2);
          this.stackSwap(3, 1);
          break;

        case OP_IFDUP:
          // (x - 0 | x x)
          var value = this.stackTop();
          if (castBool(value)) {
            this.stack.push(value);
          }
          break;

        case OP_DEPTH:
          // -- stacksize
          var value = bignum(this.stack.length);
          this.stack.push(bigintToBuffer(value));
          break;

        case OP_DROP:
          // (x -- )
          this.stackPop();
          break;

        case OP_DUP:
          // (x -- x x)
          this.stack.push(this.stackTop());
          break;

        case OP_NIP:
          // (x1 x2 -- x2)
          if (this.stack.length < 2) {
            throw new Error("OP_NIP insufficient stack size");
          }
          this.stack.splice(this.stack.length - 2, 1);
          break;

        case OP_OVER:
          // (x1 x2 -- x1 x2 x1)
          this.stack.push(this.stackTop(2));
          break;

        case OP_PICK:
        case OP_ROLL:
          // (xn ... x2 x1 x0 n - xn ... x2 x1 x0 xn)
          // (xn ... x2 x1 x0 n - ... x2 x1 x0 xn)
          var n = castInt(this.stackPop());
          if (n < 0 || n >= this.stack.length) {
            throw new Error("OP_PICK/OP_ROLL insufficient stack size");
          }
          var value = this.stackTop(n+1);
          if (opcode === OP_ROLL) {
            this.stack.splice(this.stack.length - n - 1, 1);
          }
          this.stack.push(value);
          break;

        case OP_ROT:
          // (x1 x2 x3 -- x2 x3 x1)
          //  x2 x1 x3  after first swap
          //  x2 x3 x1  after second swap
          this.stackSwap(3, 2);
          this.stackSwap(2, 1);
          break;

        case OP_SWAP:
          // (x1 x2 -- x2 x1)
          this.stackSwap(2, 1);
          break;

        case OP_TUCK:
          // (x1 x2 -- x2 x1 x2)
          if (this.stack.length < 2) {
            throw new Error("OP_TUCK insufficient stack size");
          }
          this.stack.splice(this.stack.length - 2, 0, this.stackTop());
          break;

        case OP_CAT:
          // (x1 x2 -- out)
          var v1 = this.stackTop(2);
          var v2 = this.stackTop(1);
          this.stackPop();
          this.stackPop();
          this.stack.push(v1.concat(v2));
          break;

        case OP_SUBSTR:
          // (in begin size -- out)
          var buf = this.stackTop(3);
          var start = castInt(this.stackTop(2));
          var len = castInt(this.stackTop(1));
          if (start < 0 || len < 0) {
            throw new Error("OP_SUBSTR start < 0 or len < 0");
          }
          if ((start + len) >= buf.length) {
            throw new Error("OP_SUBSTR range out of bounds");
          }
          this.stackPop();
          this.stackPop();
          this.stack[this.stack.length-1] = buf.slice(start, start + len);
          break;

        case OP_LEFT:
        case OP_RIGHT:
          // (in size -- out)
          var buf = this.stackTop(2);
          var size = castInt(this.stackTop(1));
          if (size < 0) {
            throw new Error("OP_LEFT/OP_RIGHT size < 0");
          }
          if (size > buf.length) {
            size = buf.length;
          }
          this.stackPop();
          if (opcode === OP_LEFT) {
            this.stack[this.stack.length-1] = buf.slice(0, size);
          } else {
            this.stack[this.stack.length-1] = buf.slice(buf.length - size);
          }
          break;

        case OP_SIZE:
          // (in -- in size)
          var value = bignum(this.stackTop().length);
          this.stack.push(bigintToBuffer(value));
          break;

        case OP_INVERT:
          // (in - out)
          var buf = this.stackTop();
          for (var i = 0, l = buf.length; i < l; i++) {
            buf[i] = ~buf[i];
          }
          break;

        case OP_AND:
        case OP_OR:
        case OP_XOR:
          // (x1 x2 - out)
          var v1 = this.stackTop(2);
          var v2 = this.stackTop(1);
          this.stackPop();
          this.stackPop();
          var out = new Buffer(Math.max(v1.length, v2.length));
          if (opcode === OP_AND) {
            for (var i = 0, l = out.length; i < l; i++) {
              out[i] = v1[i] & v2[i];
            }
          } else if (opcode === OP_OR) {
            for (var i = 0, l = out.length; i < l; i++) {
              out[i] = v1[i] | v2[i];
            }
          } else if (opcode === OP_XOR) {
            for (var i = 0, l = out.length; i < l; i++) {
              out[i] = v1[i] ^ v2[i];
            }
          }
          this.stack.push(out);
          break;

        case OP_EQUAL:
        case OP_EQUALVERIFY:
        //case OP_NOTEQUAL: // use OP_NUMNOTEQUAL
          // (x1 x2 - bool)
          var v1 = this.stackTop(2);
          var v2 = this.stackTop(1);
          var value = v1.compare(v2) == 0;

          // OP_NOTEQUAL is disabled because it would be too easy to say
          // something like n != 1 and have some wiseguy pass in 1 with extra
          // zero bytes after it (numerically, 0x01 == 0x0001 == 0x000001)
          //if (opcode == OP_NOTEQUAL)
          //    fEqual = !fEqual;

          this.stackPop();
          this.stackPop();
          this.stack.push(new Buffer([value ? 1 : 0]));
          if (opcode === OP_EQUALVERIFY) {
            if (value) {
              this.stackPop();
            } else {
              throw new Error("OP_EQUALVERIFY negative");
            }
          }
          break;

        case OP_1ADD:
        case OP_1SUB:
        case OP_2MUL:
        case OP_2DIV:
        case OP_NEGATE:
        case OP_ABS:
        case OP_NOT:
        case OP_0NOTEQUAL:
          // (in -- out)
          var num = castBigint(this.stackTop());
          switch (opcode) {
          case OP_1ADD:      num = num.add(bignum(1)); break;
          case OP_1SUB:      num = num.sub(bignum(1)); break;
          case OP_2MUL:      num = num.mul(bignum(2)); break;
          case OP_2DIV:      num = num.div(bignum(2)); break;
          case OP_NEGATE:    num = num.neg(); break;
          case OP_ABS:       num = num.abs(); break;
          case OP_NOT:       num = bignum(num.cmp(0) == 0 ? 1 : 0); break;
          case OP_0NOTEQUAL: num = bignum(num.cmp(0) == 0 ? 0 : 1); break;
          }
          this.stack[this.stack.length-1] = bigintToBuffer(num);
          break;

        case OP_ADD:
        case OP_SUB:
        case OP_MUL:
        case OP_DIV:
        case OP_MOD:
        case OP_LSHIFT:
        case OP_RSHIFT:
        case OP_BOOLAND:
        case OP_BOOLOR:
        case OP_NUMEQUAL:
        case OP_NUMEQUALVERIFY:
        case OP_NUMNOTEQUAL:
        case OP_LESSTHAN:
        case OP_GREATERTHAN:
        case OP_LESSTHANOREQUAL:
        case OP_GREATERTHANOREQUAL:
        case OP_MIN:
        case OP_MAX:
          // (x1 x2 -- out)
          var v1 = castBigint(this.stackTop(2));
          var v2 = castBigint(this.stackTop(1));
          var num;
          switch (opcode) {
          case OP_ADD: num = v1.add(v2); break;
          case OP_SUB: num = v1.sub(v2); break;
          case OP_MUL: num = v1.mul(v2); break;
          case OP_DIV: num = v1.div(v2); break;
          case OP_MOD: num = v1.mod(v2); break;

          case OP_LSHIFT:
            if (v2.cmp(0) < 0 || v2.cmp(2048) > 0) {
              throw new Error("OP_LSHIFT parameter out of bounds");
            }
            num = v1.shiftLeft(v2);
            break;

          case OP_RSHIFT:
            if (v2.cmp(0) < 0 || v2.cmp(2048) > 0) {
              throw new Error("OP_RSHIFT parameter out of bounds");
            }
            num = v1.shiftRight(v2);
            break;

          case OP_BOOLAND:
            num = bignum((v1.cmp(0) != 0 && v2.cmp(0) != 0) ? 1 : 0);
            break;

          case OP_BOOLOR:
            num = bignum((v1.cmp(0) != 0 || v2.cmp(0) != 0) ? 1 : 0);
            break;

          case OP_NUMEQUAL:
          case OP_NUMEQUALVERIFY:
            num = bignum(v1.cmp(v2) == 0 ? 1 : 0);
            break;

          case OP_NUMNOTEQUAL:;
            num = bignum(v1.cmp(v2) != 0 ? 1 : 0);
            break;

          case OP_LESSTHAN:
            num = bignum(v1.lt(v2) ? 1 : 0);
            break;

          case OP_GREATERTHAN:
            num = bignum(v1.gt(v2) ? 1 : 0);
            break;

          case OP_LESSTHANOREQUAL:
            num = bignum(v1.gt(v2) ? 0 : 1);
            break;

          case OP_GREATERTHANOREQUAL:
            num = bignum(v1.lt(v2) ? 0 : 1);
            break;

          case OP_MIN: num = (v1.lt(v2) ? v1 : v2); break;
          case OP_MAX: num = (v1.gt(v2) ? v1 : v2); break;
          }
          this.stackPop();
          this.stackPop();
          this.stack.push(bigintToBuffer(num));

          if (opcode === OP_NUMEQUALVERIFY) {
            if (castBool(this.stackTop())) {
              this.stackPop();
            } else {
              throw new Error("OP_NUMEQUALVERIFY negative");
            }
          }
          break;

        case OP_WITHIN:
          // (x min max -- out)
          var v1 = castBigint(this.stackTop(3));
          var v2 = castBigint(this.stackTop(2));
          var v3 = castBigint(this.stackTop(1));
          this.stackPop();
          this.stackPop();
          this.stackPop();
          var value = v1.cmp(v2) >= 0 && v1.cmp(v3) < 0;
          this.stack.push(bigintToBuffer(value ? 1 : 0));
          break;

        case OP_RIPEMD160:
        case OP_SHA1:
        case OP_SHA256:
        case OP_HASH160:
        case OP_HASH256:
          // (in -- hash)
          var value = this.stackPop();
          var hash;
          if (opcode === OP_RIPEMD160) {
            hash = Util.ripe160(value);
          } else if (opcode === OP_SHA1) {
            hash = Util.sha1(value);
          } else if (opcode === OP_SHA256) {
            hash = Util.sha256(value);
          } else if (opcode === OP_HASH160) {
            hash = Util.sha256ripe160(value);
          } else if (opcode === OP_HASH256) {
            hash = Util.twoSha256(value);
          }
          this.stack.push(hash);
          break;

        case OP_CODESEPARATOR:
          // Hash starts after the code separator
          hashStart = pc;
          break;

        case OP_CHECKSIG:
        case OP_CHECKSIGVERIFY:
          // (sig pubkey -- bool)
          var sig = this.stackTop(2);
          var pubkey = this.stackTop(1);

          // Get the part of this script since the last OP_CODESEPARATOR
          var scriptChunks = script.chunks.slice(hashStart);

          // Convert to binary
          var scriptCode = Script.fromChunks(scriptChunks);

          // Remove signature if present (a signature can't sign itself)
          scriptCode.findAndDelete(sig);

          // Verify signature
          checkSig(sig, pubkey, scriptCode, tx, inIndex, hashType, function (e, result) {
            try {
              var success;

              if (e) {
                // We intentionally ignore errors during signature verification and
                // treat these cases as an invalid signature.
                success = false;
              } else {
                success = result;
              }

              // Update stack
              this.stackPop();
              this.stackPop();
              this.stack.push(new Buffer([success ? 1 : 0]));
              if (opcode === OP_CHECKSIGVERIFY) {
                if (success) {
                  this.stackPop();
                } else {
                  throw new Error("OP_CHECKSIGVERIFY negative");
                }
              }

              // Run next step
              executeStep.call(this, cb);
            } catch(e) {
              cb(e);
            }
          }.bind(this));

          // Note that for asynchronous opcodes we have to return here to prevent
          // the next opcode from being executed.
          return;

        case OP_CHECKMULTISIG:
        case OP_CHECKMULTISIGVERIFY:
          // ([sig ...] num_of_signatures [pubkey ...] num_of_pubkeys -- bool)
          var keysCount = castInt(this.stackPop());
          if (keysCount < 0 || keysCount > 20) {
            throw new Error("OP_CHECKMULTISIG keysCount out of bounds");
          }
          opCount += keysCount;
          if (opCount > 201) {
            throw new Error("Opcode limit exceeded (>200)");
          }
          var keys = [];
          for (var i = 0, l = keysCount; i < l; i++) {
            keys.push(this.stackPop());
          }
          var sigsCount = castInt(this.stackPop());
          if (sigsCount < 0 || sigsCount > keysCount) {
            throw new Error("OP_CHECKMULTISIG sigsCount out of bounds");
          }
          var sigs = [];
          for (var i = 0, l = sigsCount; i < l; i++) {
            sigs.push(this.stackPop());
          }

          // The original client has a bug where it pops an extra element off the
          // stack. It can't be fixed without causing a chain split and we need to
          // imitate this behavior as well.
          this.stackPop();

          // Get the part of this script since the last OP_CODESEPARATOR
          var scriptChunks = script.chunks.slice(hashStart);

          // Convert to binary
          var scriptCode = Script.fromChunks(scriptChunks);

          // Drop the signatures, since a signature can't sign itself
          sigs.forEach(function (sig) {
            scriptCode.findAndDelete(sig);
          });

          var success = true, isig = 0, ikey = 0;
          checkMultiSigStep.call(this);

          function checkMultiSigStep() {
            try {
              if (success && sigsCount > 0) {
                var sig = sigs[isig];
                var key = keys[ikey];

                checkSig(sig, key, scriptCode, tx, inIndex, hashType, function (e, result) {
                  try {
                    if (!e && result) {
                      isig++;
                      sigsCount--;
                    } else {
                      ikey++;
                      keysCount--;

                      // If there are more signatures than keys left, then too many
                      // signatures have failed
                      if (sigsCount > keysCount) {
                        success = false;
                      }
                    }

                    checkMultiSigStep.call(this);
                  } catch (e) {
                    cb(e);
                  }
                }.bind(this));
              } else {
                this.stack.push(new Buffer([success ? 1 : 0]));
                if (opcode === OP_CHECKMULTISIGVERIFY) {
                  if (success) {
                    this.stackPop();
                  } else {
                    throw new Error("OP_CHECKMULTISIGVERIFY negative");
                  }
                }

                // Run next step
                executeStep.call(this, cb);
              }
            } catch(e) {
              cb(e);
            }
          };

          // Note that for asynchronous opcodes we have to return here to prevent
          // the next opcode from being executed.
          return;

        default:
          throw new Error("Unknown opcode encountered");
        }

        // Size limits
        if ((this.stack.length + altStack.length) > 1000) {
          throw new Error("Maximum stack size exceeded");
        }

        // Run next step
        if (pc % 100) {
          // V8 allows for much deeper stacks than Bitcoin's scripting language,
          // but just to be safe, we'll reset the stack every 100 steps
          process.nextTick(executeStep.bind(this, cb));
        } else {
          executeStep.call(this, cb);
        }
      } catch (e) {
        log.debug("Script aborted: "+
                      (e.message ? e : e));
        cb(e);
      }
    }
  };

  ScriptInterpreter.prototype.evalTwo =
  function evalTwo(scriptSig, scriptPubkey, tx, n, hashType, callback)
  {
    var self = this;

    self.eval(scriptSig, tx, n, hashType, function (e) {
      if (e) {
        callback(e)
        return;
      }

      self.eval(scriptPubkey, tx, n, hashType, callback);
    });
  };

  /**
   * Get the top element of the stack.
   *
   * Using the offset parameter this function can also access lower elements
   * from the stack.
   */
  ScriptInterpreter.prototype.stackTop = function stackTop(offset) {
    offset = +offset || 1;
    if (offset < 1) offset = 1;

    if (offset > this.stack.length) {
      throw new Error('ScriptInterpreter.stackTop(): Stack underrun');
    }

    return this.stack[this.stack.length-offset];
  };

  ScriptInterpreter.prototype.stackBack = function stackBack() 
  {
    return this.stack[-1];
  };

  /**
   * Pop the top element off the stack and return it.
   */
  ScriptInterpreter.prototype.stackPop = function stackPop() {
    if (this.stack.length < 1) {
      throw new Error('ScriptInterpreter.stackTop(): Stack underrun');
    }

    return this.stack.pop();
  };

  ScriptInterpreter.prototype.stackSwap = function stackSwap(a, b) {
    if (this.stack.length < a || this.stack.length < b) {
      throw new Error('ScriptInterpreter.stackTop(): Stack underrun');
    }

    var s = this.stack,
        l = s.length;

    var tmp = s[l - a];
    s[l - a] = s[l - b];
    s[l - b] = tmp;
  };

  /**
   * Returns a version of the stack with only primitive types.
   *
   * The return value is an array. Any single byte buffer is converted to an
   * integer. Any longer Buffer is converted to a hex string.
   */
  ScriptInterpreter.prototype.getPrimitiveStack = function getPrimitiveStack() {
    return this.stack.map(function (entry) {
      if (entry.length > 2) {
        return entry.slice(0).toHex();
      }
      var num = castBigint(entry);
      if (num.cmp(-128) >= 0 && num.cmp(127) <= 0) {
        return num.toNumber();
      } else {
        return entry.slice(0).toHex();
      }
    });
  };

  var castBool = ScriptInterpreter.castBool = function castBool(v) {
    for (var i = 0, l = v.length; i < l; i++) {
      if (v[i] != 0) {
        // Negative zero is still zero
        if (i == (l-1) && v[i] == 0x80) {
          return false;
        }
        return true;
      }
    }
    return false;
  };
  var castInt = ScriptInterpreter.castInt = function castInt(v) {
    return castBigint(v).toNumber();
  };
  var castBigint = ScriptInterpreter.castBigint = function castBigint(v) {
    if (!v.length) {
      return bignum(0);
    }

    // Arithmetic operands must be in range [-2^31...2^31]
    if (v.length > 4) {
      throw new Error("Bigint cast overflow (> 4 bytes)");
    }

    var w = new Buffer(v.length);
    v.copy(w);
    w.reverse();
    if (w[0] & 0x80) {
      w[0] &= 0x7f;
      return bignum.fromBuffer(w).neg();
    } else {
      // Positive number
      return bignum.fromBuffer(w);
    }
  };
  var bigintToBuffer = ScriptInterpreter.bigintToBuffer = function bigintToBuffer(v) {
    if ("number" === typeof v) {
      v = bignum(v);
    }

    var b,c;

    var cmp = v.cmp(0);
    if (cmp > 0) {
      b = v.toBuffer();
      if (b[0] & 0x80) {
        c = new Buffer(b.length + 1);
        b.copy(c, 1);
        c[0] = 0;
        return c.reverse();
      } else {
        return b.reverse();
      }
    } else if (cmp == 0) {
      return new Buffer([]);
    } else {
      b = v.neg().toBuffer();
      if (b[0] & 0x80) {
        c = new Buffer(b.length + 1);
        b.copy(c, 1);
        c[0] = 0x80;
        return c.reverse();
      } else {
        b[0] |= 0x80;
        return b.reverse();
      }
    }
  };

  ScriptInterpreter.prototype.getResult = function getResult() {
    if (this.stack.length === 0) {
      throw new Error("Empty stack after script evaluation");
    }

    return castBool(this.stack[this.stack.length-1]);
  };

  ScriptInterpreter.verify =
  function verify(scriptSig, scriptPubKey, txTo, n, hashType, callback)
  {
    if ("function" !== typeof callback) {
      throw new Error("ScriptInterpreter.verify() requires a callback");
    }

    // Create execution environment
    var si = new ScriptInterpreter();

    // Evaluate scripts
    si.evalTwo(scriptSig, scriptPubKey, txTo, n, hashType, function (err) {
      if (err) {
        callback(err);
        return;
      }

      // Cast result to bool
      try {
        var result = si.getResult();
      } catch (err) {
        callback(err);
        return;
      }

      callback(null, result);
    });

    return si;
  };

  function verifyStep4(scriptSig, scriptPubKey, txTo, nIn,
           hashType, opts, callback, si, siCopy)
  {
  if (siCopy.stack.length == 0) {
    callback(null, false);
    return;
  }
  
  callback(null, castBool(siCopy.stackBack()));
  }

  function verifyStep3(scriptSig, scriptPubKey, txTo, nIn,
           hashType, opts, callback, si, siCopy)
  {
  if (si.stack.length == 0) {
    callback(null, false);
    return;
  }
    if (castBool(si.stackBack()) == false) {
    callback(null, false);
    return;
  }

  // if not P2SH, we're done
  if (!opts.verifyP2SH || !scriptPubKey.isP2SH()) {
    callback(null, true);
    return;
  }

  if (!scriptSig.isPushOnly()) {
    callback(null, false);
    return;
  }

  assert.notEqual(siCopy.length, 0);

  var subscript = new Script(siCopy.stackPop());

  ok = true;
  siCopy.eval(subscript, txTo, nIn, hashType, function (err) {
    if (err)
      callback(err);
    else
      verifyStep4(scriptSig, scriptPubKey, txTo, nIn,
            hashType, opts, callback, si, siCopy);
  });
  }

  function verifyStep2(scriptSig, scriptPubKey, txTo, nIn,
           hashType, opts, callback, si, siCopy)
  {
  if (opts.verifyP2SH) {
    si.stack.forEach(function(item) {
      siCopy.stack.push(item);
    });
  }

  si.eval(scriptPubKey, txTo, nIn, hashType, function (err) {
    if (err)
      callback(err);
    else
      verifyStep3(scriptSig, scriptPubKey, txTo, nIn,
            hashType, opts, callback, si, siCopy);
  });
  }

  ScriptInterpreter.verifyFull =
  function verifyFull(scriptSig, scriptPubKey, txTo, nIn, hashType,
            opts, callback)
  {
    var si = new ScriptInterpreter();
    var siCopy = new ScriptInterpreter();

  si.eval(scriptSig, txTo, nIn, hashType, function (err) {
    if (err)
      callback(err);
    else
      verifyStep2(scriptSig, scriptPubKey, txTo, nIn,
            hashType, opts, callback, si, siCopy);
  });
  };

  var checkSig = ScriptInterpreter.checkSig =
  function (sig, pubkey, scriptCode, tx, n, hashType, callback) {
    if (!sig.length) {
      callback(null, false);
      return;
    }

    if (hashType == 0) {
      hashType = sig[sig.length -1];
    } else if (hashType != sig[sig.length -1]) {
      callback(null, false);
      return;
    }
    sig = sig.slice(0, sig.length-1);

    try {
      // Signature verification requires a special hash procedure
      var hash = tx.hashForSignature(scriptCode, n, hashType);

      // Verify signature
      var key = new Util.BitcoinKey();
      key.public = pubkey;
      key.verifySignature(hash, sig, callback);
    } catch (err) {
      callback(null, false);
    }
  };

  return ScriptInterpreter;
};
module.defineClass(spec);
}).call(this,require("/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),require("buffer").Buffer)
},{"./Opcode":2,"./Script":3,"./config":6,"./util/log":48,"./util/util":49,"/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":28,"assert":19,"bignum":9,"buffer":29,"classtool":17}],5:[function(require,module,exports){
(function (Buffer){'use strict';

function sTransaction(b) {
  var config = b.config || require('./config');
  var log = b.log || require('./util/log');
  var Address = b.Address || require('./Address').class();
  var Script = b.Script || require('./Script').class();
  var ScriptInterpreter = b.ScriptInterpreter || require('./ScriptInterpreter').class();
  var util = b.util || require('./util/util');
  var bignum = b.bignum || require('bignum');
  var Put = b.Put || require('bufferput');
  var Parser = b.Parser || require('./util/BinaryParser').class();
  var Step = b.Step || require('step');

  var error = b.error || require('./util/error');
  var VerificationError = error.VerificationError;
  var MissingSourceError = error.MissingSourceError;

  var COINBASE_OP = util.NULL_HASH.concat(new Buffer('FFFFFFFF', 'hex'));

  function TransactionIn(data) {
    if ('object' !== typeof data) {
      data = {};
    }
    if (data.o) {
      this.o = data.o;
    }
    this.s = Buffer.isBuffer(data.s) ? data.s :
             Buffer.isBuffer(data.script) ? data.script : util.EMPTY_BUFFER;
    this.q = data.q ? data.q : data.sequence;
  }

  TransactionIn.prototype.getScript = function getScript() {
    return new Script(this.s);
  };

  TransactionIn.prototype.isCoinBase = function isCoinBase() {
    return this.o.compare(COINBASE_OP) === 0;
  };

  TransactionIn.prototype.serialize = function serialize() {
    var slen = util.varIntBuf(this.s.length);
    var qbuf = new Buffer(4);
    qbuf.writeUInt32LE(this.q, 0);

    return Buffer.concat([this.o, slen, this.s, qbuf]);
  };

  TransactionIn.prototype.getOutpointHash = function getOutpointHash() {
    if ('undefined' !== typeof this.o.outHashCache) {
      return this.o.outHashCache;
    }

    this.o.outHashCache = this.o.slice(0, 32);
    return this.o.outHashCache;
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
    if ('object' !== typeof data) {
      data = {};
    }
    this.v = data.v ? data.v : data.value;
    this.s = data.s ? data.s : data.script;
  }

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
    if ('object' !== typeof data) {
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
  }

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

    return this._buffer = Buffer.concat(bufs);
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

    return this.calcHash().compare(this.hash) == 0;
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
              if (results[0].getHash().compare(self.getHash()) == 0) {
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
    buffer = buffer.concat(new Buffer([parseInt(hashType), 0, 0, 0]));

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
          hash: new Buffer(txin.getOutpointHash()).reverse().toString('hex'),
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
      hash.reverse();
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

  return Transaction;
};

if(!(typeof module === 'undefined')) {
  module.defineClass(sTransaction);
} else if(!(typeof define === 'undefined')) {
  define(['classtool', 'config', 'util/log', 'Address', 'Script'], function(Classtool) {
    return Classtool.defineClass(sTransaction);
  });
}

}).call(this,require("buffer").Buffer)
},{"./Address":1,"./Script":3,"./ScriptInterpreter":4,"./config":6,"./util/BinaryParser":44,"./util/error":47,"./util/log":48,"./util/util":49,"bignum":9,"buffer":29,"bufferput":15,"step":43}],6:[function(require,module,exports){
config = {
    network: 'livenet',
    logger: 'normal' // none, normal, debug
}
if(!(typeof module === 'undefined')) {
  module.exports = config;
} else if(!(typeof define === 'undefined')) {
  define(config);
}

},{}],7:[function(require,module,exports){

var Address = require('./Address').class();   
var Transaction = require('./Transaction').class();


},{"./Address":1,"./Transaction":5}],8:[function(require,module,exports){
(function (Buffer){var lib = require('bindings')('base58');
var crypto = require('crypto');

// Vanilla Base58 Encoding
var base58 = {
  encode: lib.base58_encode,
  decode: lib.base58_decode,
};
exports.base58 = base58;
exports.encode = base58.encode;
exports.decode = base58.decode;

// Base58Check Encoding
function sha256(data) {
  return new Buffer(crypto.createHash('sha256').update(data).digest('binary'), 'binary');
};

function doubleSHA256(data) {
  return sha256(sha256(data));
};

exports.base58Check = {
  encode: function(buf) {
    var checkedBuf = new Buffer(buf.length + 4);
    var hash = doubleSHA256(buf);
    buf.copy(checkedBuf);
    hash.copy(checkedBuf, buf.length);
    return base58.encode(checkedBuf);
  },

  decode: function(s) {
    var buf = base58.decode(s);
    if (buf.length < 4) {
      throw new Error("invalid input: too short");
    }

    var data = buf.slice(0, -4);
    var csum = buf.slice(-4);

    var hash = doubleSHA256(data);
    var hash4 = hash.slice(0, 4);

    if (csum.toString() != hash4.toString()) {
      throw new Error("checksum mismatch");
    }

    return data;
  },
};
}).call(this,require("buffer").Buffer)
},{"bindings":14,"buffer":29,"crypto":21}],9:[function(require,module,exports){
(function (Buffer){try {
    var cc = new require('./build/Debug/bignum');
} catch(e) {
    var cc = new require('./build/Release/bignum');
}
var BigNum = cc.BigNum;

module.exports = BigNum;

BigNum.conditionArgs = function(num, base) {
    if (typeof num !== 'string') num = num.toString(base || 10);

    if (num.match(/e\+/)) { // positive exponent
        if (!Number(num).toString().match(/e\+/)) {
        return {
            num: Math.floor(Number(num)).toString(),
            base: 10
        };
    }
    else {
        var pow = Math.ceil(Math.log(num) / Math.log(2));
        var n = (num / Math.pow(2, pow)).toString(2)
            .replace(/^0/,'');
        var i = n.length - n.indexOf('.');
        n = n.replace(/\./,'');

        for (; i <= pow; i++) n += '0';
           return {
               num : n,
               base : 2,
           };
        }
    }
    else if (num.match(/e\-/)) { // negative exponent
        return {
            num : Math.floor(Number(num)).toString(),
            base : base || 10
        };
    }
    else {
        return {
            num : num,
            base : base || 10,
        };
    }
};

cc.setJSConditioner(BigNum.conditionArgs);

BigNum.prototype.inspect = function () {
    return '<BigNum ' + this.toString(10) + '>';
};

BigNum.prototype.toString = function (base) {
    var value;
    if (base) {
        value = this.tostring(base);
    } else {
        value = this.tostring();
    }
    if (base > 10 && "string" === typeof value) {
      value = value.toLowerCase();
    }
    return value;
};

BigNum.prototype.toNumber = function () {
    return parseInt(this.toString(), 10);
};

[ 'add', 'sub', 'mul', 'div', 'mod' ].forEach(function (op) {
    BigNum.prototype[op] = function (num) {
        if (num instanceof BigNum) {
            return this['b'+op](num);
        }
        else if (typeof num === 'number') {
            if (num >= 0) {
                return this['u'+op](num);
            }
            else if (op === 'add') {
                return this.usub(-num);
            }
            else if (op === 'sub') {
                return this.uadd(-num);
            }
            else {
                var x = BigNum(num);
                return this['b'+op](x);
            }
        }
        else if (typeof num === 'string') {
            var x = BigNum(num);
            return this['b'+op](x);
        }
        else {
            throw new TypeError('Unspecified operation for type '
                + (typeof num) + ' for ' + op);
        }
    };
});

BigNum.prototype.abs = function () {
    return this.babs();
};

BigNum.prototype.neg = function () {
    return this.bneg();
};

BigNum.prototype.powm = function (num, mod) {
    var m, res;

    if ((typeof mod) === 'number' || (typeof mod) === 'string') {
        m = BigNum(mod);
    }
    else if (mod instanceof BigNum) {
        m = mod;
    }

    if ((typeof num) === 'number') {
        return this.upowm(num, m);
    }
    else if ((typeof num) === 'string') {
        var n = BigNum(num);
        return this.bpowm(n, m);
    }
    else if (num instanceof BigNum) {
        return this.bpowm(num, m);
    }
};

BigNum.prototype.mod = function (num, mod) {
    var m, res;

    if ((typeof mod) === 'number' || (typeof mod) === 'string') {
        m = BigNum(mod);
    }
    else if (mod instanceof BigNum) {
        m = mod;
    }

    if ((typeof num) === 'number') {
        return this.umod(num, m);
    }
    else if ((typeof num) === 'string') {
        var n = BigNum(num);
        return this.bmod(n, m);
    }
    else if (num instanceof BigNum) {
        return this.bmod(num, m);
    }
};


BigNum.prototype.pow = function (num) {
    if (typeof num === 'number') {
        if (num >= 0) {
            return this.upow(num);
        }
        else {
            return BigNum.prototype.powm.call(this, num, this);
        }
    }
    else {
        var x = parseInt(num.toString(), 10);
        return BigNum.prototype.pow.call(this, x);
    }
};

BigNum.prototype.shiftLeft = function (num) {
    if (typeof num === 'number') {
        if (num >= 0) {
            return this.umul2exp(num);
        }
        else {
            return this.shiftRight(-num);
        }
    }
    else {
        var x = parseInt(num.toString(), 10);
        return BigNum.prototype.shiftLeft.call(this, x);
    }
};

BigNum.prototype.shiftRight = function (num) {
    if (typeof num === 'number') {
        if (num >= 0) {
            return this.udiv2exp(num);
        }
        else {
            return this.shiftLeft(-num);
        }
    }
    else {
        var x = parseInt(num.toString(), 10);
        return BigNum.prototype.shiftRight.call(this, x);
    }
};

BigNum.prototype.cmp = function (num) {
    if (num instanceof BigNum) {
        return this.bcompare(num);
    }
    else if (typeof num === 'number') {
        if (num < 0) {
            return this.scompare(num);
        }
        else {
            return this.ucompare(num);
        }
    }
    else {
        var x = BigNum(num);
        return this.bcompare(x);
    }
};

BigNum.prototype.gt = function (num) {
    return this.cmp(num) > 0;
};

BigNum.prototype.ge = function (num) {
    return this.cmp(num) >= 0;
};

BigNum.prototype.eq = function (num) {
    return this.cmp(num) === 0;
};

BigNum.prototype.ne = function (num) {
    return this.cmp(num) !== 0;
};

BigNum.prototype.lt = function (num) {
    return this.cmp(num) < 0;
};

BigNum.prototype.le = function (num) {
    return this.cmp(num) <= 0;
};

'and or xor'.split(' ').forEach(function (name) {
    BigNum.prototype[name] = function (num) {
        if (num instanceof BigNum) {
            return this['b' + name](num);
        }
        else {
            var x = BigNum(num);
            return this['b' + name](x);
        }
    };
});

BigNum.prototype.sqrt = function() {
    return this.bsqrt();
};

BigNum.prototype.root = function(num) {
    if (num instanceof BigNum) {
        return this.broot(num);
    }
    else {
        var x = BigNum(num);
        return this.broot(num);
    }
};

BigNum.prototype.rand = function (to) {
    if (to === undefined) {
        if (this.toString() === '1') {
            return BigNum(0);
        }
        else {
            return this.brand0();
        }
    }
    else {
        var x = to instanceof BigNum
            ? to.sub(this)
            : BigNum(to).sub(this);
        return x.brand0().add(this);
    }
};

BigNum.prototype.invertm = function (mod) {
    if (mod instanceof BigNum) {
        return this.binvertm(mod);
    }
    else {
        var x = BigNum(mod);
        return this.binvertm(x);
    }
};

BigNum.prime = function (bits, safe) {
  if ("undefined" === typeof safe) {
    safe = true;
  }

  // Force uint32
  bits >>>= 0;

  return BigNum.uprime0(bits, !!safe);
};

BigNum.prototype.probPrime = function (reps) {
    var n = this.probprime(reps || 10);
    return { 1 : true, 0 : false }[n];
};

BigNum.prototype.nextPrime = function () {
    var num = this;
    do {
        num = num.add(1);
    } while (!num.probPrime());
    return num;
};

BigNum.fromBuffer = function (buf, opts) {
    if (!opts) opts = {};

    var endian = { 1 : 'big', '-1' : 'little' }[opts.endian]
        || opts.endian || 'big'
    ;

    var size = opts.size === 'auto' ? Math.ceil(buf.length) : (opts.size || 1);

    if (buf.length % size !== 0) {
        throw new RangeError('Buffer length (' + buf.length + ')'
            + ' must be a multiple of size (' + size + ')'
        );
    }

    var hex = [];
    for (var i = 0; i < buf.length; i += size) {
        var chunk = [];
        for (var j = 0; j < size; j++) {
            chunk.push(buf[
                i + (endian === 'big' ? j : (size - j - 1))
            ]);
        }

        hex.push(chunk
            .map(function (c) {
                return (c < 16 ? '0' : '') + c.toString(16);
            })
            .join('')
        );
    }

    return BigNum(hex.join(''), 16);
};

BigNum.prototype.toBuffer = function (opts) {
    if (typeof opts === 'string') {
        if (opts !== 'mpint') return 'Unsupported Buffer representation';

        var abs = this.abs();
        var buf = abs.toBuffer({ size : 1, endian : 'big' });
        var len = buf.length === 1 && buf[0] === 0 ? 0 : buf.length;
        if (buf[0] & 0x80) len ++;

        var ret = new Buffer(4 + len);
        if (len > 0) buf.copy(ret, 4 + (buf[0] & 0x80 ? 1 : 0));
        if (buf[0] & 0x80) ret[4] = 0;

        ret[0] = len & (0xff << 24);
        ret[1] = len & (0xff << 16);
        ret[2] = len & (0xff << 8);
        ret[3] = len & (0xff << 0);

        // two's compliment for negative integers:
        var isNeg = this.lt(0);
        if (isNeg) {
            for (var i = 4; i < ret.length; i++) {
                ret[i] = 0xff - ret[i];
            }
        }
        ret[4] = (ret[4] & 0x7f) | (isNeg ? 0x80 : 0);
        if (isNeg) ret[ret.length - 1] ++;

        return ret;
    }

    if (!opts) opts = {};

    var endian = { 1 : 'big', '-1' : 'little' }[opts.endian]
        || opts.endian || 'big'
    ;

    var hex = this.toString(16);
    if (hex.charAt(0) === '-') throw new Error(
        'converting negative numbers to Buffers not supported yet'
    );

    var size = opts.size === 'auto' ? Math.ceil(hex.length / 2) : (opts.size || 1);

    var len = Math.ceil(hex.length / (2 * size)) * size;
    var buf = new Buffer(len);

    // zero-pad the hex string so the chunks are all `size` long
    while (hex.length < 2 * len) hex = '0' + hex;

    var hx = hex
        .split(new RegExp('(.{' + (2 * size) + '})'))
        .filter(function (s) { return s.length > 0 })
    ;

    hx.forEach(function (chunk, i) {
        for (var j = 0; j < size; j++) {
            var ix = i * size + (endian === 'big' ? j : size - j - 1);
            buf[ix] = parseInt(chunk.slice(j*2,j*2+2), 16);
        }
    });

    return buf;
};

Object.keys(BigNum.prototype).forEach(function (name) {
    if (name === 'inspect' || name === 'toString') return;

    BigNum[name] = function (num) {
        var args = [].slice.call(arguments, 1);

        if (num instanceof BigNum) {
            return num[name].apply(num, args);
        }
        else {
            var bigi = BigNum(num);
            return bigi[name].apply(bigi, args);
        }
    };
});
}).call(this,require("buffer").Buffer)
},{"buffer":29}],10:[function(require,module,exports){
(function (Buffer){var Chainsaw = require('chainsaw');
var EventEmitter = require('events').EventEmitter;
var Buffers = require('buffers');
var Vars = require('./lib/vars.js');
var Stream = require('stream').Stream;

exports = module.exports = function (bufOrEm, eventName) {
    if (Buffer.isBuffer(bufOrEm)) {
        return exports.parse(bufOrEm);
    }
    
    var s = exports.stream();
    if (bufOrEm && bufOrEm.pipe) {
        bufOrEm.pipe(s);
    }
    else if (bufOrEm) {
        bufOrEm.on(eventName || 'data', function (buf) {
            s.write(buf);
        });
        
        bufOrEm.on('end', function () {
            s.end();
        });
    }
    return s;
};

exports.stream = function (input) {
    if (input) return exports.apply(null, arguments);
    
    var pending = null;
    function getBytes (bytes, cb, skip) {
        pending = {
            bytes : bytes,
            skip : skip,
            cb : function (buf) {
                pending = null;
                cb(buf);
            },
        };
        dispatch();
    }
    
    var offset = null;
    function dispatch () {
        if (!pending) {
            if (caughtEnd) done = true;
            return;
        }
        if (typeof pending === 'function') {
            pending();
        }
        else {
            var bytes = offset + pending.bytes;
            
            if (buffers.length >= bytes) {
                var buf;
                if (offset == null) {
                    buf = buffers.splice(0, bytes);
                    if (!pending.skip) {
                        buf = buf.slice();
                    }
                }
                else {
                    if (!pending.skip) {
                        buf = buffers.slice(offset, bytes);
                    }
                    offset = bytes;
                }
                
                if (pending.skip) {
                    pending.cb();
                }
                else {
                    pending.cb(buf);
                }
            }
        }
    }
    
    function builder (saw) {
        function next () { if (!done) saw.next() }
        
        var self = words(function (bytes, cb) {
            return function (name) {
                getBytes(bytes, function (buf) {
                    vars.set(name, cb(buf));
                    next();
                });
            };
        });
        
        self.tap = function (cb) {
            saw.nest(cb, vars.store);
        };
        
        self.into = function (key, cb) {
            if (!vars.get(key)) vars.set(key, {});
            var parent = vars;
            vars = Vars(parent.get(key));
            
            saw.nest(function () {
                cb.apply(this, arguments);
                this.tap(function () {
                    vars = parent;
                });
            }, vars.store);
        };
        
        self.flush = function () {
            vars.store = {};
            next();
        };
        
        self.loop = function (cb) {
            var end = false;
            
            saw.nest(false, function loop () {
                this.vars = vars.store;
                cb.call(this, function () {
                    end = true;
                    next();
                }, vars.store);
                this.tap(function () {
                    if (end) saw.next()
                    else loop.call(this)
                }.bind(this));
            }, vars.store);
        };
        
        self.buffer = function (name, bytes) {
            if (typeof bytes === 'string') {
                bytes = vars.get(bytes);
            }
            
            getBytes(bytes, function (buf) {
                vars.set(name, buf);
                next();
            });
        };
        
        self.skip = function (bytes) {
            if (typeof bytes === 'string') {
                bytes = vars.get(bytes);
            }
            
            getBytes(bytes, function () {
                next();
            });
        };
        
        self.scan = function find (name, search) {
            if (typeof search === 'string') {
                search = new Buffer(search);
            }
            else if (!Buffer.isBuffer(search)) {
                throw new Error('search must be a Buffer or a string');
            }
            
            var taken = 0;
            pending = function () {
                var pos = buffers.indexOf(search, offset + taken);
                var i = pos-offset-taken;
                if (pos !== -1) {
                    pending = null;
                    if (offset != null) {
                        vars.set(
                            name,
                            buffers.slice(offset, offset + taken + i)
                        );
                        offset += taken + i + search.length;
                    }
                    else {
                        vars.set(
                            name,
                            buffers.slice(0, taken + i)
                        );
                        buffers.splice(0, taken + i + search.length);
                    }
                    next();
                    dispatch();
                } else {
                    i = Math.max(buffers.length - search.length - offset - taken, 0);
				}
                taken += i;
            };
            dispatch();
        };
        
        self.peek = function (cb) {
            offset = 0;
            saw.nest(function () {
                cb.call(this, vars.store);
                this.tap(function () {
                    offset = null;
                });
            });
        };
        
        return self;
    };
    
    var stream = Chainsaw.light(builder);
    stream.writable = true;
    
    var buffers = Buffers();
    
    stream.write = function (buf) {
        buffers.push(buf);
        dispatch();
    };
    
    var vars = Vars();
    
    var done = false, caughtEnd = false;
    stream.end = function () {
        caughtEnd = true;
    };
    
    stream.pipe = Stream.prototype.pipe;
    Object.getOwnPropertyNames(EventEmitter.prototype).forEach(function (name) {
        stream[name] = EventEmitter.prototype[name];
    });
    
    return stream;
};

exports.parse = function parse (buffer) {
    var self = words(function (bytes, cb) {
        return function (name) {
            if (offset + bytes <= buffer.length) {
                var buf = buffer.slice(offset, offset + bytes);
                offset += bytes;
                vars.set(name, cb(buf));
            }
            else {
                vars.set(name, null);
            }
            return self;
        };
    });
    
    var offset = 0;
    var vars = Vars();
    self.vars = vars.store;
    
    self.tap = function (cb) {
        cb.call(self, vars.store);
        return self;
    };
    
    self.into = function (key, cb) {
        if (!vars.get(key)) {
            vars.set(key, {});
        }
        var parent = vars;
        vars = Vars(parent.get(key));
        cb.call(self, vars.store);
        vars = parent;
        return self;
    };
    
    self.loop = function (cb) {
        var end = false;
        var ender = function () { end = true };
        while (end === false) {
            cb.call(self, ender, vars.store);
        }
        return self;
    };
    
    self.buffer = function (name, size) {
        if (typeof size === 'string') {
            size = vars.get(size);
        }
        var buf = buffer.slice(offset, Math.min(buffer.length, offset + size));
        offset += size;
        vars.set(name, buf);
        
        return self;
    };
    
    self.skip = function (bytes) {
        if (typeof bytes === 'string') {
            bytes = vars.get(bytes);
        }
        offset += bytes;
        
        return self;
    };
    
    self.scan = function (name, search) {
        if (typeof search === 'string') {
            search = new Buffer(search);
        }
        else if (!Buffer.isBuffer(search)) {
            throw new Error('search must be a Buffer or a string');
        }
        vars.set(name, null);
        
        // simple but slow string search
        for (var i = 0; i + offset <= buffer.length - search.length + 1; i++) {
            for (
                var j = 0;
                j < search.length && buffer[offset+i+j] === search[j];
                j++
            );
            if (j === search.length) break;
        }
        
        vars.set(name, buffer.slice(offset, offset + i));
        offset += i + search.length;
        return self;
    };
    
    self.peek = function (cb) {
        var was = offset;
        cb.call(self, vars.store);
        offset = was;
        return self;
    };
    
    self.flush = function () {
        vars.store = {};
        return self;
    };
    
    self.eof = function () {
        return offset >= buffer.length;
    };
    
    return self;
};

// convert byte strings to unsigned little endian numbers
function decodeLEu (bytes) {
    var acc = 0;
    for (var i = 0; i < bytes.length; i++) {
        acc += Math.pow(256,i) * bytes[i];
    }
    return acc;
}

// convert byte strings to unsigned big endian numbers
function decodeBEu (bytes) {
    var acc = 0;
    for (var i = 0; i < bytes.length; i++) {
        acc += Math.pow(256, bytes.length - i - 1) * bytes[i];
    }
    return acc;
}

// convert byte strings to signed big endian numbers
function decodeBEs (bytes) {
    var val = decodeBEu(bytes);
    if ((bytes[0] & 0x80) == 0x80) {
        val -= Math.pow(256, bytes.length);
    }
    return val;
}

// convert byte strings to signed little endian numbers
function decodeLEs (bytes) {
    var val = decodeLEu(bytes);
    if ((bytes[bytes.length - 1] & 0x80) == 0x80) {
        val -= Math.pow(256, bytes.length);
    }
    return val;
}

function words (decode) {
    var self = {};
    
    [ 1, 2, 4, 8 ].forEach(function (bytes) {
        var bits = bytes * 8;
        
        self['word' + bits + 'le']
        = self['word' + bits + 'lu']
        = decode(bytes, decodeLEu);
        
        self['word' + bits + 'ls']
        = decode(bytes, decodeLEs);
        
        self['word' + bits + 'be']
        = self['word' + bits + 'bu']
        = decode(bytes, decodeBEu);
        
        self['word' + bits + 'bs']
        = decode(bytes, decodeBEs);
    });
    
    // word8be(n) == word8le(n) for all n
    self.word8 = self.word8u = self.word8be;
    self.word8s = self.word8bs;
    
    return self;
}
}).call(this,require("buffer").Buffer)
},{"./lib/vars.js":11,"buffer":29,"buffers":16,"chainsaw":12,"events":26,"stream":34}],11:[function(require,module,exports){
module.exports = function (store) {
    function getset (name, value) {
        var node = vars.store;
        var keys = name.split('.');
        keys.slice(0,-1).forEach(function (k) {
            if (node[k] === undefined) node[k] = {};
            node = node[k]
        });
        var key = keys[keys.length - 1];
        if (arguments.length == 1) {
            return node[key];
        }
        else {
            return node[key] = value;
        }
    }
    
    var vars = {
        get : function (name) {
            return getset(name);
        },
        set : function (name, value) {
            return getset(name, value);
        },
        store : store || {},
    };
    return vars;
};

},{}],12:[function(require,module,exports){
(function (process){var Traverse = require('traverse');
var EventEmitter = require('events').EventEmitter;

module.exports = Chainsaw;
function Chainsaw (builder) {
    var saw = Chainsaw.saw(builder, {});
    var r = builder.call(saw.handlers, saw);
    if (r !== undefined) saw.handlers = r;
    saw.record();
    return saw.chain();
};

Chainsaw.light = function ChainsawLight (builder) {
    var saw = Chainsaw.saw(builder, {});
    var r = builder.call(saw.handlers, saw);
    if (r !== undefined) saw.handlers = r;
    return saw.chain();
};

Chainsaw.saw = function (builder, handlers) {
    var saw = new EventEmitter;
    saw.handlers = handlers;
    saw.actions = [];

    saw.chain = function () {
        var ch = Traverse(saw.handlers).map(function (node) {
            if (this.isRoot) return node;
            var ps = this.path;

            if (typeof node === 'function') {
                this.update(function () {
                    saw.actions.push({
                        path : ps,
                        args : [].slice.call(arguments)
                    });
                    return ch;
                });
            }
        });

        process.nextTick(function () {
            saw.emit('begin');
            saw.next();
        });

        return ch;
    };

    saw.pop = function () {
        return saw.actions.shift();
    };

    saw.next = function () {
        var action = saw.pop();

        if (!action) {
            saw.emit('end');
        }
        else if (!action.trap) {
            var node = saw.handlers;
            action.path.forEach(function (key) { node = node[key] });
            node.apply(saw.handlers, action.args);
        }
    };

    saw.nest = function (cb) {
        var args = [].slice.call(arguments, 1);
        var autonext = true;

        if (typeof cb === 'boolean') {
            var autonext = cb;
            cb = args.shift();
        }

        var s = Chainsaw.saw(builder, {});
        var r = builder.call(s.handlers, s);

        if (r !== undefined) s.handlers = r;

        // If we are recording...
        if ("undefined" !== typeof saw.step) {
            // ... our children should, too
            s.record();
        }

        cb.apply(s.chain(), args);
        if (autonext !== false) s.on('end', saw.next);
    };

    saw.record = function () {
        upgradeChainsaw(saw);
    };

    ['trap', 'down', 'jump'].forEach(function (method) {
        saw[method] = function () {
            throw new Error("To use the trap, down and jump features, please "+
                            "call record() first to start recording actions.");
        };
    });

    return saw;
};

function upgradeChainsaw(saw) {
    saw.step = 0;

    // override pop
    saw.pop = function () {
        return saw.actions[saw.step++];
    };

    saw.trap = function (name, cb) {
        var ps = Array.isArray(name) ? name : [name];
        saw.actions.push({
            path : ps,
            step : saw.step,
            cb : cb,
            trap : true
        });
    };

    saw.down = function (name) {
        var ps = (Array.isArray(name) ? name : [name]).join('/');
        var i = saw.actions.slice(saw.step).map(function (x) {
            if (x.trap && x.step <= saw.step) return false;
            return x.path.join('/') == ps;
        }).indexOf(true);

        if (i >= 0) saw.step += i;
        else saw.step = saw.actions.length;

        var act = saw.actions[saw.step - 1];
        if (act && act.trap) {
            // It's a trap!
            saw.step = act.step;
            act.cb();
        }
        else saw.next();
    };

    saw.jump = function (step) {
        saw.step = step;
        saw.next();
    };
};
}).call(this,require("/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":28,"events":26,"traverse":13}],13:[function(require,module,exports){
module.exports = Traverse;
function Traverse (obj) {
    if (!(this instanceof Traverse)) return new Traverse(obj);
    this.value = obj;
}

Traverse.prototype.get = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) {
            node = undefined;
            break;
        }
        node = node[key];
    }
    return node;
};

Traverse.prototype.set = function (ps, value) {
    var node = this.value;
    for (var i = 0; i < ps.length - 1; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) node[key] = {};
        node = node[key];
    }
    node[ps[i]] = value;
    return value;
};

Traverse.prototype.map = function (cb) {
    return walk(this.value, cb, true);
};

Traverse.prototype.forEach = function (cb) {
    this.value = walk(this.value, cb, false);
    return this.value;
};

Traverse.prototype.reduce = function (cb, init) {
    var skip = arguments.length === 1;
    var acc = skip ? this.value : init;
    this.forEach(function (x) {
        if (!this.isRoot || !skip) {
            acc = cb.call(this, acc, x);
        }
    });
    return acc;
};

Traverse.prototype.deepEqual = function (obj) {
    if (arguments.length !== 1) {
        throw new Error(
            'deepEqual requires exactly one object to compare against'
        );
    }
    
    var equal = true;
    var node = obj;
    
    this.forEach(function (y) {
        var notEqual = (function () {
            equal = false;
            //this.stop();
            return undefined;
        }).bind(this);
        
        //if (node === undefined || node === null) return notEqual();
        
        if (!this.isRoot) {
        /*
            if (!Object.hasOwnProperty.call(node, this.key)) {
                return notEqual();
            }
        */
            if (typeof node !== 'object') return notEqual();
            node = node[this.key];
        }
        
        var x = node;
        
        this.post(function () {
            node = x;
        });
        
        var toS = function (o) {
            return Object.prototype.toString.call(o);
        };
        
        if (this.circular) {
            if (Traverse(obj).get(this.circular.path) !== x) notEqual();
        }
        else if (typeof x !== typeof y) {
            notEqual();
        }
        else if (x === null || y === null || x === undefined || y === undefined) {
            if (x !== y) notEqual();
        }
        else if (x.__proto__ !== y.__proto__) {
            notEqual();
        }
        else if (x === y) {
            // nop
        }
        else if (typeof x === 'function') {
            if (x instanceof RegExp) {
                // both regexps on account of the __proto__ check
                if (x.toString() != y.toString()) notEqual();
            }
            else if (x !== y) notEqual();
        }
        else if (typeof x === 'object') {
            if (toS(y) === '[object Arguments]'
            || toS(x) === '[object Arguments]') {
                if (toS(x) !== toS(y)) {
                    notEqual();
                }
            }
            else if (x instanceof Date || y instanceof Date) {
                if (!(x instanceof Date) || !(y instanceof Date)
                || x.getTime() !== y.getTime()) {
                    notEqual();
                }
            }
            else {
                var kx = Object.keys(x);
                var ky = Object.keys(y);
                if (kx.length !== ky.length) return notEqual();
                for (var i = 0; i < kx.length; i++) {
                    var k = kx[i];
                    if (!Object.hasOwnProperty.call(y, k)) {
                        notEqual();
                    }
                }
            }
        }
    });
    
    return equal;
};

Traverse.prototype.paths = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.path); 
    });
    return acc;
};

Traverse.prototype.nodes = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.node);
    });
    return acc;
};

Traverse.prototype.clone = function () {
    var parents = [], nodes = [];
    
    return (function clone (src) {
        for (var i = 0; i < parents.length; i++) {
            if (parents[i] === src) {
                return nodes[i];
            }
        }
        
        if (typeof src === 'object' && src !== null) {
            var dst = copy(src);
            
            parents.push(src);
            nodes.push(dst);
            
            Object.keys(src).forEach(function (key) {
                dst[key] = clone(src[key]);
            });
            
            parents.pop();
            nodes.pop();
            return dst;
        }
        else {
            return src;
        }
    })(this.value);
};

function walk (root, cb, immutable) {
    var path = [];
    var parents = [];
    var alive = true;
    
    return (function walker (node_) {
        var node = immutable ? copy(node_) : node_;
        var modifiers = {};
        
        var state = {
            node : node,
            node_ : node_,
            path : [].concat(path),
            parent : parents.slice(-1)[0],
            key : path.slice(-1)[0],
            isRoot : path.length === 0,
            level : path.length,
            circular : null,
            update : function (x) {
                if (!state.isRoot) {
                    state.parent.node[state.key] = x;
                }
                state.node = x;
            },
            'delete' : function () {
                delete state.parent.node[state.key];
            },
            remove : function () {
                if (Array.isArray(state.parent.node)) {
                    state.parent.node.splice(state.key, 1);
                }
                else {
                    delete state.parent.node[state.key];
                }
            },
            before : function (f) { modifiers.before = f },
            after : function (f) { modifiers.after = f },
            pre : function (f) { modifiers.pre = f },
            post : function (f) { modifiers.post = f },
            stop : function () { alive = false }
        };
        
        if (!alive) return state;
        
        if (typeof node === 'object' && node !== null) {
            state.isLeaf = Object.keys(node).length == 0;
            
            for (var i = 0; i < parents.length; i++) {
                if (parents[i].node_ === node_) {
                    state.circular = parents[i];
                    break;
                }
            }
        }
        else {
            state.isLeaf = true;
        }
        
        state.notLeaf = !state.isLeaf;
        state.notRoot = !state.isRoot;
        
        // use return values to update if defined
        var ret = cb.call(state, state.node);
        if (ret !== undefined && state.update) state.update(ret);
        if (modifiers.before) modifiers.before.call(state, state.node);
        
        if (typeof state.node == 'object'
        && state.node !== null && !state.circular) {
            parents.push(state);
            
            var keys = Object.keys(state.node);
            keys.forEach(function (key, i) {
                path.push(key);
                
                if (modifiers.pre) modifiers.pre.call(state, state.node[key], key);
                
                var child = walker(state.node[key]);
                if (immutable && Object.hasOwnProperty.call(state.node, key)) {
                    state.node[key] = child.node;
                }
                
                child.isLast = i == keys.length - 1;
                child.isFirst = i == 0;
                
                if (modifiers.post) modifiers.post.call(state, child);
                
                path.pop();
            });
            parents.pop();
        }
        
        if (modifiers.after) modifiers.after.call(state, state.node);
        
        return state;
    })(root).node;
}

Object.keys(Traverse.prototype).forEach(function (key) {
    Traverse[key] = function (obj) {
        var args = [].slice.call(arguments, 1);
        var t = Traverse(obj);
        return t[key].apply(t, args);
    };
});

function copy (src) {
    if (typeof src === 'object' && src !== null) {
        var dst;
        
        if (Array.isArray(src)) {
            dst = [];
        }
        else if (src instanceof Date) {
            dst = new Date(src);
        }
        else if (src instanceof Boolean) {
            dst = new Boolean(src);
        }
        else if (src instanceof Number) {
            dst = new Number(src);
        }
        else if (src instanceof String) {
            dst = new String(src);
        }
        else {
            dst = Object.create(Object.getPrototypeOf(src));
        }
        
        Object.keys(src).forEach(function (key) {
            dst[key] = src[key];
        });
        return dst;
    }
    else return src;
}

},{}],14:[function(require,module,exports){
(function (process,__filename){
/**
 * Module dependencies.
 */

var fs = require('fs')
  , path = require('path')
  , join = path.join
  , dirname = path.dirname
  , exists = fs.existsSync || path.existsSync
  , defaults = {
        arrow: process.env.NODE_BINDINGS_ARROW || ' → '
      , compiled: process.env.NODE_BINDINGS_COMPILED_DIR || 'compiled'
      , platform: process.platform
      , arch: process.arch
      , version: process.versions.node
      , bindings: 'bindings.node'
      , try: [
          // node-gyp's linked version in the "build" dir
          [ 'module_root', 'build', 'bindings' ]
          // node-waf and gyp_addon (a.k.a node-gyp)
        , [ 'module_root', 'build', 'Debug', 'bindings' ]
        , [ 'module_root', 'build', 'Release', 'bindings' ]
          // Debug files, for development (legacy behavior, remove for node v0.9)
        , [ 'module_root', 'out', 'Debug', 'bindings' ]
        , [ 'module_root', 'Debug', 'bindings' ]
          // Release files, but manually compiled (legacy behavior, remove for node v0.9)
        , [ 'module_root', 'out', 'Release', 'bindings' ]
        , [ 'module_root', 'Release', 'bindings' ]
          // Legacy from node-waf, node <= 0.4.x
        , [ 'module_root', 'build', 'default', 'bindings' ]
          // Production "Release" buildtype binary (meh...)
        , [ 'module_root', 'compiled', 'version', 'platform', 'arch', 'bindings' ]
        ]
    }

/**
 * The main `bindings()` function loads the compiled bindings for a given module.
 * It uses V8's Error API to determine the parent filename that this function is
 * being invoked from, which is then used to find the root directory.
 */

function bindings (opts) {

  // Argument surgery
  if (typeof opts == 'string') {
    opts = { bindings: opts }
  } else if (!opts) {
    opts = {}
  }
  opts.__proto__ = defaults

  // Get the module root
  if (!opts.module_root) {
    opts.module_root = exports.getRoot(exports.getFileName())
  }

  // Ensure the given bindings name ends with .node
  if (path.extname(opts.bindings) != '.node') {
    opts.bindings += '.node'
  }

  var tries = []
    , i = 0
    , l = opts.try.length
    , n
    , b
    , err

  for (; i<l; i++) {
    n = join.apply(null, opts.try[i].map(function (p) {
      return opts[p] || p
    }))
    tries.push(n)
    try {
      b = opts.path ? require.resolve(n) : require(n)
      if (!opts.path) {
        b.path = n
      }
      return b
    } catch (e) {
      if (!/not find/i.test(e.message)) {
        throw e
      }
    }
  }

  err = new Error('Could not locate the bindings file. Tried:\n'
    + tries.map(function (a) { return opts.arrow + a }).join('\n'))
  err.tries = tries
  throw err
}
module.exports = exports = bindings


/**
 * Gets the filename of the JavaScript file that invokes this function.
 * Used to help find the root directory of a module.
 */

exports.getFileName = function getFileName () {
  var origPST = Error.prepareStackTrace
    , dummy = {}
    , fileName

  Error.prepareStackTrace = function (e, st) {
    for (var i=0, l=st.length; i<l; i++) {
      fileName = st[i].getFileName()
      if (fileName !== __filename) {
        return
      }
    }
  }

  // run the 'prepareStackTrace' function above
  Error.captureStackTrace(dummy)
  dummy.stack

  // cleanup
  Error.prepareStackTrace = origPST

  return fileName
}

/**
 * Gets the root directory of a module, given an arbitrary filename
 * somewhere in the module tree. The "root directory" is the directory
 * containing the `package.json` file.
 *
 *   In:  /home/nate/node-native-module/lib/index.js
 *   Out: /home/nate/node-native-module
 */

exports.getRoot = function getRoot (file) {
  var dir = dirname(file)
    , prev
  while (true) {
    if (dir === '.') {
      // Avoids an infinite loop in rare cases, like the REPL
      dir = process.cwd()
    }
    if (exists(join(dir, 'package.json')) || exists(join(dir, 'node_modules'))) {
      // Found the 'package.json' file or 'node_modules' dir; we're done
      return dir
    }
    if (prev === dir) {
      // Got to the top
      throw new Error('Could not find module root given file: "' + file
                    + '". Do you have a `package.json` file? ')
    }
    // Try the parent dir next
    prev = dir
    dir = join(dir, '..')
  }
}
}).call(this,require("/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),"/node_modules/bindings/bindings.js")
},{"/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":28,"fs":18,"path":32}],15:[function(require,module,exports){
(function (Buffer){function BufferPut () {
  this.words = [];
  this.len = 0;
};
module.exports = BufferPut;

BufferPut.prototype.put = function(buf) {
  this.words.push({buffer: buf});
  this.len += buf.length;
  return this;
};

BufferPut.prototype.word8 = function(x) {
  this.words.push({bytes: 1, value: x});
  this.len += 1;
  return this;
};

BufferPut.prototype.floatle = function(x) {
  this.words.push({bytes: 'float', endian: 'little', value: x});
  this.len += 4;
  return this;
};

BufferPut.prototype.varint = function(i) {
  if(i < 0xFD) {
    this.word8(i);
  } else if(i <= 1<<16) {
    this.word8(0xFD);
    this.word16le(i);
  } else if(i <= 1<<32) {
    this.word8(0xFE);
    this.word32le(i);
  } else {
    this.word8(0xFF);
    this.word64le(i);
  }
};

[8, 16, 24, 32, 64].forEach(function(bits) {
  BufferPut.prototype['word'+bits+'be'] = function(x) {
    this.words.push({endian: 'big', bytes: bits / 8, value: x});
    this.len += bits / 8;
    return this;
  };

  BufferPut.prototype['word'+bits+'le'] = function(x) {
    this.words.push({endian: 'little', bytes: bits / 8, value: x});
    this.len += bits / 8;
    return this;
  };
});

BufferPut.prototype.pad = function(bytes) {
  this.words.push({endian: 'big', bytes: bytes, value: 0});
  this.len += bytes;
  return this;
};

BufferPut.prototype.length = function() {
  return this.len;
};

BufferPut.prototype.buffer = function () {
  var buf = new Buffer(this.len);
  var offset = 0;
  this.words.forEach(function(word) {
    if(word.buffer) {
      word.buffer.copy(buf, offset, 0);
      offset += word.buffer.length;
    } else if(word.bytes == 'float') {
      // s * f * 2^e
      var v = Math.abs(word.value);
      var s = (word.value >= 0) * 1;
      var e = Math.ceil(Math.log(v) / Math.LN2);
      var f = v / (1 << e);

      // s:1, e:7, f:23
      // [seeeeeee][efffffff][ffffffff][ffffffff]
      buf[offset++] = (s << 7) & ~~(e / 2);
      buf[offset++] = ((e & 1) << 7) & ~~(f / (1 << 16));
      buf[offset++] = 0;
      buf[offset++] = 0;
      offset += 4;
    } else {
      var big = word.endian === 'big';
      var ix = big ? [ (word.bytes - 1) * 8, -8 ] : [ 0, 8 ];
      for(var i=ix[0]; big ? i >= 0 : i < word.bytes * 8; i += ix[1]) {
        if(i >= 32) {
          buf[offset++] = Math.floor(word.value / Math.pow(2, i)) & 0xff;
        } else {
          buf[offset++] = (word.value >> i) & 0xff;
        }
      }
    }
  });
  return buf;
};

BufferPut.prototype.write = function(stream) {
  stream.write(this.buffer());
};
}).call(this,require("buffer").Buffer)
},{"buffer":29}],16:[function(require,module,exports){
(function (Buffer){module.exports = Buffers;

function Buffers (bufs) {
    if (!(this instanceof Buffers)) return new Buffers(bufs);
    this.buffers = bufs || [];
    this.length = this.buffers.reduce(function (size, buf) {
        return size + buf.length
    }, 0);
}

Buffers.prototype.push = function () {
    for (var i = 0; i < arguments.length; i++) {
        if (!Buffer.isBuffer(arguments[i])) {
            throw new TypeError('Tried to push a non-buffer');
        }
    }
    
    for (var i = 0; i < arguments.length; i++) {
        var buf = arguments[i];
        this.buffers.push(buf);
        this.length += buf.length;
    }
    return this.length;
};

Buffers.prototype.unshift = function () {
    for (var i = 0; i < arguments.length; i++) {
        if (!Buffer.isBuffer(arguments[i])) {
            throw new TypeError('Tried to unshift a non-buffer');
        }
    }
    
    for (var i = 0; i < arguments.length; i++) {
        var buf = arguments[i];
        this.buffers.unshift(buf);
        this.length += buf.length;
    }
    return this.length;
};

Buffers.prototype.copy = function (dst, dStart, start, end) {
    return this.slice(start, end).copy(dst, dStart, 0, end - start);
};

Buffers.prototype.splice = function (i, howMany) {
    var buffers = this.buffers;
    var index = i >= 0 ? i : this.length - i;
    var reps = [].slice.call(arguments, 2);
    
    if (howMany === undefined) {
        howMany = this.length - index;
    }
    else if (howMany > this.length - index) {
        howMany = this.length - index;
    }
    
    for (var i = 0; i < reps.length; i++) {
        this.length += reps[i].length;
    }
    
    var removed = new Buffers();
    var bytes = 0;
    
    var startBytes = 0;
    for (
        var ii = 0;
        ii < buffers.length && startBytes + buffers[ii].length < index;
        ii ++
    ) { startBytes += buffers[ii].length }
    
    if (index - startBytes > 0) {
        var start = index - startBytes;
        
        if (start + howMany < buffers[ii].length) {
            removed.push(buffers[ii].slice(start, start + howMany));
            
            var orig = buffers[ii];
            //var buf = new Buffer(orig.length - howMany);
            var buf0 = new Buffer(start);
            for (var i = 0; i < start; i++) {
                buf0[i] = orig[i];
            }
            
            var buf1 = new Buffer(orig.length - start - howMany);
            for (var i = start + howMany; i < orig.length; i++) {
                buf1[ i - howMany - start ] = orig[i]
            }
            
            if (reps.length > 0) {
                var reps_ = reps.slice();
                reps_.unshift(buf0);
                reps_.push(buf1);
                buffers.splice.apply(buffers, [ ii, 1 ].concat(reps_));
                ii += reps_.length;
                reps = [];
            }
            else {
                buffers.splice(ii, 1, buf0, buf1);
                //buffers[ii] = buf;
                ii += 2;
            }
        }
        else {
            removed.push(buffers[ii].slice(start));
            buffers[ii] = buffers[ii].slice(0, start);
            ii ++;
        }
    }
    
    if (reps.length > 0) {
        buffers.splice.apply(buffers, [ ii, 0 ].concat(reps));
        ii += reps.length;
    }
    
    while (removed.length < howMany) {
        var buf = buffers[ii];
        var len = buf.length;
        var take = Math.min(len, howMany - removed.length);
        
        if (take === len) {
            removed.push(buf);
            buffers.splice(ii, 1);
        }
        else {
            removed.push(buf.slice(0, take));
            buffers[ii] = buffers[ii].slice(take);
        }
    }
    
    this.length -= removed.length;
    
    return removed;
};
 
Buffers.prototype.slice = function (i, j) {
    var buffers = this.buffers;
    if (j === undefined) j = this.length;
    if (i === undefined) i = 0;
    
    if (j > this.length) j = this.length;
    
    var startBytes = 0;
    for (
        var si = 0;
        si < buffers.length && startBytes + buffers[si].length <= i;
        si ++
    ) { startBytes += buffers[si].length }
    
    var target = new Buffer(j - i);
    
    var ti = 0;
    for (var ii = si; ti < j - i && ii < buffers.length; ii++) {
        var len = buffers[ii].length;
        
        var start = ti === 0 ? i - startBytes : 0;
        var end = ti + len >= j - i
            ? Math.min(start + (j - i) - ti, len)
            : len
        ;
        
        buffers[ii].copy(target, ti, start, end);
        ti += end - start;
    }
    
    return target;
};

Buffers.prototype.pos = function (i) {
    if (i < 0 || i >= this.length) throw new Error('oob');
    var l = i, bi = 0, bu = null;
    for (;;) {
        bu = this.buffers[bi];
        if (l < bu.length) {
            return {buf: bi, offset: l};
        } else {
            l -= bu.length;
        }
        bi++;
    }
};

Buffers.prototype.get = function get (i) {
    var pos = this.pos(i);

    return this.buffers[pos.buf].get(pos.offset);
};

Buffers.prototype.set = function set (i, b) {
    var pos = this.pos(i);

    return this.buffers[pos.buf].set(pos.offset, b);
};

Buffers.prototype.indexOf = function (needle, offset) {
    if ("string" === typeof needle) {
        needle = new Buffer(needle);
    } else if (needle instanceof Buffer) {
        // already a buffer
    } else {
        throw new Error('Invalid type for a search string');
    }

    if (!needle.length) {
        return 0;
    }

    if (!this.length) {
        return -1;
    }

    var i = 0, j = 0, match = 0, mstart, pos = 0;

    // start search from a particular point in the virtual buffer
    if (offset) {
        var p = this.pos(offset);
        i = p.buf;
        j = p.offset;
        pos = offset;
    }

    // for each character in virtual buffer
    for (;;) {
        while (j >= this.buffers[i].length) {
            j = 0;
            i++;

            if (i >= this.buffers.length) {
                // search string not found
                return -1;
            }
        }

        var char = this.buffers[i][j];

        if (char == needle[match]) {
            // keep track where match started
            if (match == 0) {
                mstart = {
                    i: i,
                    j: j,
                    pos: pos
                };
            }
            match++;
            if (match == needle.length) {
                // full match
                return mstart.pos;
            }
        } else if (match != 0) {
            // a partial match ended, go back to match starting position
            // this will continue the search at the next character
            i = mstart.i;
            j = mstart.j;
            pos = mstart.pos;
            match = 0;
        }

        j++;
        pos++;
    }
};

Buffers.prototype.toBuffer = function() {
    return this.slice();
}

Buffers.prototype.toString = function(encoding, start, end) {
    return this.slice(start, end).toString(encoding);
}
}).call(this,require("buffer").Buffer)
},{"buffer":29}],17:[function(require,module,exports){
// Define functions and methods used for simulating class like structures
// including inheritance.  An important feature of this system is that it
// enables one to define a class like structure while controlling all bindings
// to the outside world.  This approach allows a class to be instantiated 
// multiple times, which enables a more compositional approach to inheritance. 

module.__proto__.defineClass = function(classConstructor) {
  var self = this;
  var classes = {};
  
  // Private class constructor
  function _createClass(bindings) {
    var answer = classConstructor(bindings || {});
    answer.inherit = function(parent) {
      if(arguments.length > 1) {
        // this allows chaining multiple classes in the call
        parent.inherit(Array.prototype.slice.call(arguments, 1));
      }
      this._super = parent;
      Object.defineProperty(this.prototype, '_constructor', {enumerable: false, value: this});
      this.prototype.__proto__ = parent.prototype;
      this.__proto__ = parent;
    };
    answer.super = function(receiver, method, args) {
      if(!this._super) return;
      if(typeof method == 'string') {
        return this._super.prototype[method].apply(receiver, args);
      } else {
        return this._super.apply(receiver, method);
      }
    };
    if(answer.superclass) answer.inherit(answer.superclass);
    return answer;
  };

  // Private class wrapper (we wrap classes to enable cyclic references)
  function _wrapClass(wrapper, cls) {
    wrapper.prototype = cls.prototype;
    wrapper.prototype._constructor = wrapper;
    wrapper._super = cls._super;
    wrapper.inherit = cls.inherit;
    wrapper.super = cls.super;
    for(x in cls) {
      wrapper[x] = cls[x];
    }
    return wrapper;
  };

  // Public createClass() function - creates a new class with the given
  // bindings and an optional name...the name, if given, can be used to
  // later recall the same class instance using class())
  this.exports.createClass = function(name, bindings) {
    if(typeof name != 'string') return _createClass(name);
    classes[name] = function() {return tmp.apply(this, arguments);};
    var tmp = _createClass(bindings);
    return _wrapClass(classes[name], tmp);
  };

  // Public class() function - Return the class for the given name if 
  // it has already been created, otherwise create it (note, you cannot 
  // override the default bindings with this method, use createClass() if
  // you need to override the default bindings).  If the name is omitted, 
  // use 'default'
  this.exports.class = function(name) {
    name = name || 'default';
    if(classes[name]) return classes[name];
    return this.createClass(name);
  };

  // Public new() method - This is a conventience function to create a 
  // new instance of the "default" class instance
  this.exports.new = function() {
    var ClassInstance = this.class();
    var answer = Object.create(ClassInstance.prototype);
    ClassInstance.apply(answer, arguments);
    return answer;
  };
};

},{}],18:[function(require,module,exports){

},{}],19:[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = require('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
  else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && (isNaN(value) || !isFinite(value))) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

},{"util/":42}],20:[function(require,module,exports){
var Buffer = require('buffer').Buffer;
var intSize = 4;
var zeroBuffer = new Buffer(intSize); zeroBuffer.fill(0);
var chrsz = 8;

function toArray(buf, bigEndian) {
  if ((buf.length % intSize) !== 0) {
    var len = buf.length + (intSize - (buf.length % intSize));
    buf = Buffer.concat([buf, zeroBuffer], len);
  }

  var arr = [];
  var fn = bigEndian ? buf.readInt32BE : buf.readInt32LE;
  for (var i = 0; i < buf.length; i += intSize) {
    arr.push(fn.call(buf, i));
  }
  return arr;
}

function toBuffer(arr, size, bigEndian) {
  var buf = new Buffer(size);
  var fn = bigEndian ? buf.writeInt32BE : buf.writeInt32LE;
  for (var i = 0; i < arr.length; i++) {
    fn.call(buf, arr[i], i * 4, true);
  }
  return buf;
}

function hash(buf, fn, hashSize, bigEndian) {
  if (!Buffer.isBuffer(buf)) buf = new Buffer(buf);
  var arr = fn(toArray(buf, bigEndian), buf.length * chrsz);
  return toBuffer(arr, hashSize, bigEndian);
}

module.exports = { hash: hash };

},{"buffer":29}],21:[function(require,module,exports){
var Buffer = require('buffer').Buffer
var sha = require('./sha')
var sha256 = require('./sha256')
var rng = require('./rng')
var md5 = require('./md5')

var algorithms = {
  sha1: sha,
  sha256: sha256,
  md5: md5
}

var blocksize = 64
var zeroBuffer = new Buffer(blocksize); zeroBuffer.fill(0)
function hmac(fn, key, data) {
  if(!Buffer.isBuffer(key)) key = new Buffer(key)
  if(!Buffer.isBuffer(data)) data = new Buffer(data)

  if(key.length > blocksize) {
    key = fn(key)
  } else if(key.length < blocksize) {
    key = Buffer.concat([key, zeroBuffer], blocksize)
  }

  var ipad = new Buffer(blocksize), opad = new Buffer(blocksize)
  for(var i = 0; i < blocksize; i++) {
    ipad[i] = key[i] ^ 0x36
    opad[i] = key[i] ^ 0x5C
  }

  var hash = fn(Buffer.concat([ipad, data]))
  return fn(Buffer.concat([opad, hash]))
}

function hash(alg, key) {
  alg = alg || 'sha1'
  var fn = algorithms[alg]
  var bufs = []
  var length = 0
  if(!fn) error('algorithm:', alg, 'is not yet supported')
  return {
    update: function (data) {
      if(!Buffer.isBuffer(data)) data = new Buffer(data)
        
      bufs.push(data)
      length += data.length
      return this
    },
    digest: function (enc) {
      var buf = Buffer.concat(bufs)
      var r = key ? hmac(fn, key, buf) : fn(buf)
      bufs = null
      return enc ? r.toString(enc) : r
    }
  }
}

function error () {
  var m = [].slice.call(arguments).join(' ')
  throw new Error([
    m,
    'we accept pull requests',
    'http://github.com/dominictarr/crypto-browserify'
    ].join('\n'))
}

exports.createHash = function (alg) { return hash(alg) }
exports.createHmac = function (alg, key) { return hash(alg, key) }
exports.randomBytes = function(size, callback) {
  if (callback && callback.call) {
    try {
      callback.call(this, undefined, new Buffer(rng(size)))
    } catch (err) { callback(err) }
  } else {
    return new Buffer(rng(size))
  }
}

function each(a, f) {
  for(var i in a)
    f(a[i], i)
}

// the least I can do is make error messages for the rest of the node.js/crypto api.
each(['createCredentials'
, 'createCipher'
, 'createCipheriv'
, 'createDecipher'
, 'createDecipheriv'
, 'createSign'
, 'createVerify'
, 'createDiffieHellman'
, 'pbkdf2'], function (name) {
  exports[name] = function () {
    error('sorry,', name, 'is not implemented yet')
  }
})

},{"./md5":22,"./rng":23,"./sha":24,"./sha256":25,"buffer":29}],22:[function(require,module,exports){
/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.1 Copyright (C) Paul Johnston 1999 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

var helpers = require('./helpers');

/*
 * Perform a simple self-test to see if the VM is working
 */
function md5_vm_test()
{
  return hex_md5("abc") == "900150983cd24fb0d6963f7d28e17f72";
}

/*
 * Calculate the MD5 of an array of little-endian words, and a bit length
 */
function core_md5(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << ((len) % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
    d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
    c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
    b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
    a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
    d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
    c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
    b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
    a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
    d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
    c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
    b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
    d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
    c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
    b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

    a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
    d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
    c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
    b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
    a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
    d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
    c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
    b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
    a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
    d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
    c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
    b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
    a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
    d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
    c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
    b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

    a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
    d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
    c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
    b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
    a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
    d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
    c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
    b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
    d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
    c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
    b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
    a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
    d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
    c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
    b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

    a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
    d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
    c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
    b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
    a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
    d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
    c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
    b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
    a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
    d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
    c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
    b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
    a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
    d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
    b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
  }
  return Array(a, b, c, d);

}

/*
 * These functions implement the four basic operations the algorithm uses.
 */
function md5_cmn(q, a, b, x, s, t)
{
  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
}
function md5_ff(a, b, c, d, x, s, t)
{
  return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t)
{
  return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t)
{
  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t)
{
  return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

module.exports = function md5(buf) {
  return helpers.hash(buf, core_md5, 16);
};

},{"./helpers":20}],23:[function(require,module,exports){
// Original code adapted from Robert Kieffer.
// details at https://github.com/broofa/node-uuid
(function() {
  var _global = this;

  var mathRNG, whatwgRNG;

  // NOTE: Math.random() does not guarantee "cryptographic quality"
  mathRNG = function(size) {
    var bytes = new Array(size);
    var r;

    for (var i = 0, r; i < size; i++) {
      if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
      bytes[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return bytes;
  }

  if (_global.crypto && crypto.getRandomValues) {
    whatwgRNG = function(size) {
      var bytes = new Uint8Array(size);
      crypto.getRandomValues(bytes);
      return bytes;
    }
  }

  module.exports = whatwgRNG || mathRNG;

}())

},{}],24:[function(require,module,exports){
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

var helpers = require('./helpers');

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function core_sha1(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << (24 - len % 32);
  x[((len + 64 >> 9) << 4) + 15] = len;

  var w = Array(80);
  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;
  var e = -1009589776;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    var olde = e;

    for(var j = 0; j < 80; j++)
    {
      if(j < 16) w[j] = x[i + j];
      else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
      var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
                       safe_add(safe_add(e, w[j]), sha1_kt(j)));
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = t;
    }

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
    e = safe_add(e, olde);
  }
  return Array(a, b, c, d, e);

}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft(t, b, c, d)
{
  if(t < 20) return (b & c) | ((~b) & d);
  if(t < 40) return b ^ c ^ d;
  if(t < 60) return (b & c) | (b & d) | (c & d);
  return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt(t)
{
  return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
         (t < 60) ? -1894007588 : -899497514;
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

module.exports = function sha1(buf) {
  return helpers.hash(buf, core_sha1, 20, true);
};

},{"./helpers":20}],25:[function(require,module,exports){

/**
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined
 * in FIPS 180-2
 * Version 2.2-beta Copyright Angel Marin, Paul Johnston 2000 - 2009.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 *
 */

var helpers = require('./helpers');

var safe_add = function(x, y) {
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
};

var S = function(X, n) {
  return (X >>> n) | (X << (32 - n));
};

var R = function(X, n) {
  return (X >>> n);
};

var Ch = function(x, y, z) {
  return ((x & y) ^ ((~x) & z));
};

var Maj = function(x, y, z) {
  return ((x & y) ^ (x & z) ^ (y & z));
};

var Sigma0256 = function(x) {
  return (S(x, 2) ^ S(x, 13) ^ S(x, 22));
};

var Sigma1256 = function(x) {
  return (S(x, 6) ^ S(x, 11) ^ S(x, 25));
};

var Gamma0256 = function(x) {
  return (S(x, 7) ^ S(x, 18) ^ R(x, 3));
};

var Gamma1256 = function(x) {
  return (S(x, 17) ^ S(x, 19) ^ R(x, 10));
};

var core_sha256 = function(m, l) {
  var K = new Array(0x428A2F98,0x71374491,0xB5C0FBCF,0xE9B5DBA5,0x3956C25B,0x59F111F1,0x923F82A4,0xAB1C5ED5,0xD807AA98,0x12835B01,0x243185BE,0x550C7DC3,0x72BE5D74,0x80DEB1FE,0x9BDC06A7,0xC19BF174,0xE49B69C1,0xEFBE4786,0xFC19DC6,0x240CA1CC,0x2DE92C6F,0x4A7484AA,0x5CB0A9DC,0x76F988DA,0x983E5152,0xA831C66D,0xB00327C8,0xBF597FC7,0xC6E00BF3,0xD5A79147,0x6CA6351,0x14292967,0x27B70A85,0x2E1B2138,0x4D2C6DFC,0x53380D13,0x650A7354,0x766A0ABB,0x81C2C92E,0x92722C85,0xA2BFE8A1,0xA81A664B,0xC24B8B70,0xC76C51A3,0xD192E819,0xD6990624,0xF40E3585,0x106AA070,0x19A4C116,0x1E376C08,0x2748774C,0x34B0BCB5,0x391C0CB3,0x4ED8AA4A,0x5B9CCA4F,0x682E6FF3,0x748F82EE,0x78A5636F,0x84C87814,0x8CC70208,0x90BEFFFA,0xA4506CEB,0xBEF9A3F7,0xC67178F2);
  var HASH = new Array(0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19);
    var W = new Array(64);
    var a, b, c, d, e, f, g, h, i, j;
    var T1, T2;
  /* append padding */
  m[l >> 5] |= 0x80 << (24 - l % 32);
  m[((l + 64 >> 9) << 4) + 15] = l;
  for (var i = 0; i < m.length; i += 16) {
    a = HASH[0]; b = HASH[1]; c = HASH[2]; d = HASH[3]; e = HASH[4]; f = HASH[5]; g = HASH[6]; h = HASH[7];
    for (var j = 0; j < 64; j++) {
      if (j < 16) {
        W[j] = m[j + i];
      } else {
        W[j] = safe_add(safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])), W[j - 16]);
      }
      T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j]);
      T2 = safe_add(Sigma0256(a), Maj(a, b, c));
      h = g; g = f; f = e; e = safe_add(d, T1); d = c; c = b; b = a; a = safe_add(T1, T2);
    }
    HASH[0] = safe_add(a, HASH[0]); HASH[1] = safe_add(b, HASH[1]); HASH[2] = safe_add(c, HASH[2]); HASH[3] = safe_add(d, HASH[3]);
    HASH[4] = safe_add(e, HASH[4]); HASH[5] = safe_add(f, HASH[5]); HASH[6] = safe_add(g, HASH[6]); HASH[7] = safe_add(h, HASH[7]);
  }
  return HASH;
};

module.exports = function sha256(buf) {
  return helpers.hash(buf, core_sha256, 32, true);
};

},{"./helpers":20}],26:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],27:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],28:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],29:[function(require,module,exports){
var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
   // Detect if browser supports Typed Arrays. Supported browsers are IE 10+,
   // Firefox 4+, Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+.
   if (typeof Uint8Array === 'undefined' || typeof ArrayBuffer === 'undefined')
      return false

  // Does the browser support adding properties to `Uint8Array` instances? If
  // not, then that's the same as no `Uint8Array` support. We need to be able to
  // add all the node Buffer API methods.
  // Relevant Firefox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var arr = new Uint8Array(0)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // Assume object is an array
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof Uint8Array === 'function' &&
      subject instanceof Uint8Array) {
    // Speed optimization -- use set if we're copying from a Uint8Array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  switch (encoding || 'utf8') {
    case 'hex':
      return str.length / 2
    case 'utf8':
    case 'utf-8':
      return utf8ToBytes(str).length
    case 'ascii':
    case 'binary':
      return str.length
    case 'base64':
      return base64ToBytes(str).length
    default:
      throw new Error('Unknown encoding')
  }
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  switch (encoding) {
    case 'hex':
      return _hexWrite(this, string, offset, length)
    case 'utf8':
    case 'utf-8':
      return _utf8Write(this, string, offset, length)
    case 'ascii':
      return _asciiWrite(this, string, offset, length)
    case 'binary':
      return _binaryWrite(this, string, offset, length)
    case 'base64':
      return _base64Write(this, string, offset, length)
    default:
      throw new Error('Unknown encoding')
  }
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  switch (encoding) {
    case 'hex':
      return _hexSlice(self, start, end)
    case 'utf8':
    case 'utf-8':
      return _utf8Slice(self, start, end)
    case 'ascii':
      return _asciiSlice(self, start, end)
    case 'binary':
      return _binarySlice(self, start, end)
    case 'base64':
      return _base64Slice(self, start, end)
    default:
      throw new Error('Unknown encoding')
  }
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  // copy!
  for (var i = 0; i < end - start; i++)
    target[i + target_start] = this[i + start]
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

// http://nodejs.org/api/buffer.html#buffer_buf_slice_start_end
Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array === 'function') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment the Uint8Array *instance* (not the class!) with Buffer methods
 */
function augment (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value == 'number', 'cannot write a non-number as a number')
  assert(value >= 0,
      'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint(value, max, min) {
  assert(typeof value == 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754(value, max, min) {
  assert(typeof value == 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":30,"ieee754":31}],30:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var ZERO   = '0'.charCodeAt(0)
	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	module.exports.toByteArray = b64ToByteArray
	module.exports.fromByteArray = uint8ToBase64
}())

},{}],31:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],32:[function(require,module,exports){
(function (process){// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;
}).call(this,require("/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":28}],33:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

module.exports = Duplex;
var inherits = require('inherits');
var setImmediate = require('process/browser.js').nextTick;
var Readable = require('./readable.js');
var Writable = require('./writable.js');

inherits(Duplex, Readable);

Duplex.prototype.write = Writable.prototype.write;
Duplex.prototype.end = Writable.prototype.end;
Duplex.prototype._write = Writable.prototype._write;

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  var self = this;
  setImmediate(function () {
    self.end();
  });
}

},{"./readable.js":37,"./writable.js":39,"inherits":27,"process/browser.js":35}],34:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('./readable.js');
Stream.Writable = require('./writable.js');
Stream.Duplex = require('./duplex.js');
Stream.Transform = require('./transform.js');
Stream.PassThrough = require('./passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"./duplex.js":33,"./passthrough.js":36,"./readable.js":37,"./transform.js":38,"./writable.js":39,"events":26,"inherits":27}],35:[function(require,module,exports){
module.exports=require(28)
},{}],36:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

module.exports = PassThrough;

var Transform = require('./transform.js');
var inherits = require('inherits');
inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./transform.js":38,"inherits":27}],37:[function(require,module,exports){
(function (process){// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Readable;
Readable.ReadableState = ReadableState;

var EE = require('events').EventEmitter;
var Stream = require('./index.js');
var Buffer = require('buffer').Buffer;
var setImmediate = require('process/browser.js').nextTick;
var StringDecoder;

var inherits = require('inherits');
inherits(Readable, Stream);

function ReadableState(options, stream) {
  options = options || {};

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = false;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // In streams that never have any data, and do push(null) right away,
  // the consumer can miss the 'end' event if they do some I/O before
  // consuming the stream.  So, we don't emit('end') until some reading
  // happens.
  this.calledRead = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;


  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (typeof chunk === 'string' && !state.objectMode) {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null || chunk === undefined) {
    state.reading = false;
    if (!state.ended)
      onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      // update the buffer info.
      state.length += state.objectMode ? 1 : chunk.length;
      if (addToFront) {
        state.buffer.unshift(chunk);
      } else {
        state.reading = false;
        state.buffer.push(chunk);
      }

      if (state.needReadable)
        emitReadable(stream);

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}



// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
};

// Don't raise the hwm > 128MB
var MAX_HWM = 0x800000;
function roundUpToNextPowerOf2(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (isNaN(n) || n === null) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = roundUpToNextPowerOf2(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else
      return state.length;
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  var state = this._readableState;
  state.calledRead = true;
  var nOrig = n;

  if (typeof n !== 'number' || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0)
      endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;

  // if we currently have less than the highWaterMark, then also read some
  if (state.length - n <= state.highWaterMark)
    doRead = true;

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading)
    doRead = false;

  if (doRead) {
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read called its callback synchronously, then `reading`
  // will be false, and we need to re-evaluate how much data we
  // can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we happened to read() exactly the remaining amount in the
  // buffer, and the EOF has been seen at this point, then make sure
  // that we emit 'end' on the very next tick.
  if (state.ended && !state.endEmitted && state.length === 0)
    endReadable(this);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode &&
      !er) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.decoder && !state.ended) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // if we've ended and we have some data left, then emit
  // 'readable' now to make sure it gets picked up.
  if (state.length > 0)
    emitReadable(stream);
  else
    endReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (state.emittedReadable)
    return;

  state.emittedReadable = true;
  if (state.sync)
    setImmediate(function() {
      emitReadable_(stream);
    });
  else
    emitReadable_(stream);
}

function emitReadable_(stream) {
  stream.emit('readable');
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    setImmediate(function() {
      maybeReadMore_(stream, state);
    });
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    setImmediate(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    if (readable !== src) return;
    cleanup();
  }

  function onend() {
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (!dest._writableState || dest._writableState.needDrain)
      ondrain();
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  // check for listeners before emit removes one-time listeners.
  var errListeners = EE.listenerCount(dest, 'error');
  function onerror(er) {
    unpipe();
    if (errListeners === 0 && EE.listenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  dest.once('error', onerror);

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    // the handler that waits for readable events after all
    // the data gets sucked out in flow.
    // This would be easier to follow with a .once() handler
    // in flow(), but that is too slow.
    this.on('readable', pipeOnReadable);

    state.flowing = true;
    setImmediate(function() {
      flow(src);
    });
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var dest = this;
    var state = src._readableState;
    state.awaitDrain--;
    if (state.awaitDrain === 0)
      flow(src);
  };
}

function flow(src) {
  var state = src._readableState;
  var chunk;
  state.awaitDrain = 0;

  function write(dest, i, list) {
    var written = dest.write(chunk);
    if (false === written) {
      state.awaitDrain++;
    }
  }

  while (state.pipesCount && null !== (chunk = src.read())) {

    if (state.pipesCount === 1)
      write(state.pipes, 0, null);
    else
      forEach(state.pipes, write);

    src.emit('data', chunk);

    // if anyone needs a drain, then we have to wait for that.
    if (state.awaitDrain > 0)
      return;
  }

  // if every destination was unpiped, either before entering this
  // function, or in the while loop, then stop flowing.
  //
  // NB: This is a pretty rare edge case.
  if (state.pipesCount === 0) {
    state.flowing = false;

    // if there were data event listeners added, then switch to old mode.
    if (EE.listenerCount(src, 'data') > 0)
      emitDataEvents(src);
    return;
  }

  // at this point, no one needed a drain, so we just ran out of data
  // on the next readable event, start it over again.
  state.ranOut = true;
}

function pipeOnReadable() {
  if (this._readableState.ranOut) {
    this._readableState.ranOut = false;
    flow(this);
  }
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data' && !this._readableState.flowing)
    emitDataEvents(this);

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        this.read(0);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  emitDataEvents(this);
  this.read(0);
  this.emit('resume');
};

Readable.prototype.pause = function() {
  emitDataEvents(this, true);
  this.emit('pause');
};

function emitDataEvents(stream, startPaused) {
  var state = stream._readableState;

  if (state.flowing) {
    // https://github.com/isaacs/readable-stream/issues/16
    throw new Error('Cannot switch to old mode now.');
  }

  var paused = startPaused || false;
  var readable = false;

  // convert to an old-style stream.
  stream.readable = true;
  stream.pipe = Stream.prototype.pipe;
  stream.on = stream.addListener = Stream.prototype.on;

  stream.on('readable', function() {
    readable = true;

    var c;
    while (!paused && (null !== (c = stream.read())))
      stream.emit('data', c);

    if (c === null) {
      readable = false;
      stream._readableState.needReadable = true;
    }
  });

  stream.pause = function() {
    paused = true;
    this.emit('pause');
  };

  stream.resume = function() {
    paused = false;
    if (readable)
      setImmediate(function() {
        stream.emit('readable');
      });
    else
      this.read(0);
    this.emit('resume');
  };

  // now make it start, just in case it hadn't already.
  stream.emit('readable');
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    if (state.decoder)
      chunk = state.decoder.write(chunk);
    if (!chunk || !state.objectMode && !chunk.length)
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (typeof stream[i] === 'function' &&
        typeof this[i] === 'undefined') {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }}(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, function (x) {
      return self.emit.apply(self, ev, x);
    });
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};



// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted && state.calledRead) {
    state.ended = true;
    setImmediate(function() {
      // Check that we didn't get one last unshift.
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit('end');
      }
    });
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}
}).call(this,require("/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"./index.js":34,"/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":28,"buffer":29,"events":26,"inherits":27,"process/browser.js":35,"string_decoder":40}],38:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

module.exports = Transform;

var Duplex = require('./duplex.js');
var inherits = require('inherits');
inherits(Transform, Duplex);


function TransformState(options, stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined)
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  var ts = this._transformState = new TransformState(options, this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  this.once('finish', function() {
    if ('function' === typeof this._flush)
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (ts.writechunk && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var rs = stream._readableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./duplex.js":33,"inherits":27}],39:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

module.exports = Writable;
Writable.WritableState = WritableState;

var isUint8Array = typeof Uint8Array !== 'undefined'
  ? function (x) { return x instanceof Uint8Array }
  : function (x) {
    return x && x.constructor && x.constructor.name === 'Uint8Array'
  }
;
var isArrayBuffer = typeof ArrayBuffer !== 'undefined'
  ? function (x) { return x instanceof ArrayBuffer }
  : function (x) {
    return x && x.constructor && x.constructor.name === 'ArrayBuffer'
  }
;

var inherits = require('inherits');
var Stream = require('./index.js');
var setImmediate = require('process/browser.js').nextTick;
var Buffer = require('buffer').Buffer;

inherits(Writable, Stream);

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
}

function WritableState(options, stream) {
  options = options || {};

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.buffer = [];
}

function Writable(options) {
  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Stream.Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, state, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  setImmediate(function() {
    cb(er);
  });
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    setImmediate(function() {
      cb(er);
    });
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (!Buffer.isBuffer(chunk) && isUint8Array(chunk))
    chunk = new Buffer(chunk);
  if (isArrayBuffer(chunk) && typeof Uint8Array !== 'undefined')
    chunk = new Buffer(new Uint8Array(chunk));
  
  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (typeof cb !== 'function')
    cb = function() {};

  if (state.ended)
    writeAfterEnd(this, state, cb);
  else if (validChunk(this, state, chunk, cb))
    ret = writeOrBuffer(this, state, chunk, encoding, cb);

  return ret;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      typeof chunk === 'string') {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  state.needDrain = !ret;

  if (state.writing)
    state.buffer.push(new WriteReq(chunk, encoding, cb));
  else
    doWrite(stream, state, len, chunk, encoding, cb);

  return ret;
}

function doWrite(stream, state, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  if (sync)
    setImmediate(function() {
      cb(er);
    });
  else
    cb(er);

  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(stream, state);

    if (!finished && !state.bufferProcessing && state.buffer.length)
      clearBuffer(stream, state);

    if (sync) {
      setImmediate(function() {
        afterWrite(stream, state, finished, cb);
      });
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  cb();
  if (finished)
    finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;

  for (var c = 0; c < state.buffer.length; c++) {
    var entry = state.buffer[c];
    var chunk = entry.chunk;
    var encoding = entry.encoding;
    var cb = entry.callback;
    var len = state.objectMode ? 1 : chunk.length;

    doWrite(stream, state, len, chunk, encoding, cb);

    // if we didn't call the onwrite immediately, then
    // it means that we need to wait until it does.
    // also, that means that the chunk and cb are currently
    // being processed, so move the buffer counter past them.
    if (state.writing) {
      c++;
      break;
    }
  }

  state.bufferProcessing = false;
  if (c < state.buffer.length)
    state.buffer = state.buffer.slice(c);
  else
    state.buffer.length = 0;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (typeof chunk !== 'undefined' && chunk !== null)
    this.write(chunk, encoding);

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(stream, state) {
  return (state.ending &&
          state.length === 0 &&
          !state.finished &&
          !state.writing);
}

function finishMaybe(stream, state) {
  var need = needFinish(stream, state);
  if (need) {
    state.finished = true;
    stream.emit('finish');
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      setImmediate(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

},{"./index.js":34,"buffer":29,"inherits":27,"process/browser.js":35}],40:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

function assertEncoding(encoding) {
  if (encoding && !Buffer.isEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  this.charBuffer = new Buffer(6);
  this.charReceived = 0;
  this.charLength = 0;
};


StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  var offset = 0;

  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var i = (buffer.length >= this.charLength - this.charReceived) ?
                this.charLength - this.charReceived :
                buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, offset, i);
    this.charReceived += (i - offset);
    offset = i;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (i == buffer.length) return charStr;

    // otherwise cut off the characters end from the beginning of this buffer
    buffer = buffer.slice(i, buffer.length);
    break;
  }

  var lenIncomplete = this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - lenIncomplete, end);
    this.charReceived = lenIncomplete;
    end -= lenIncomplete;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    this.charBuffer.write(charStr.charAt(charStr.length - 1), this.encoding);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }

  return i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  var incomplete = this.charReceived = buffer.length % 2;
  this.charLength = incomplete ? 2 : 0;
  return incomplete;
}

function base64DetectIncompleteChar(buffer) {
  var incomplete = this.charReceived = buffer.length % 3;
  this.charLength = incomplete ? 3 : 0;
  return incomplete;
}

},{"buffer":29}],41:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],42:[function(require,module,exports){
(function (process,global){// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
}).call(this,require("/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":41,"/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":28,"inherits":27}],43:[function(require,module,exports){
(function (process){/*
Copyright (c) 2011 Tim Caswell <tim@creationix.com>

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Inspired by http://github.com/willconant/flow-js, but reimplemented and
// modified to fit my taste and the node.JS error handling system.
function Step() {
  var steps = Array.prototype.slice.call(arguments),
      pending, counter, results, lock;

  // Define the main callback that's given as `this` to the steps.
  function next() {

    // Check if there are no steps left
    if (steps.length === 0) {
      // Throw uncaught errors
      if (arguments[0]) {
        throw arguments[0];
      }
      return;
    }

    // Get the next step to execute
    var fn = steps.shift();
    counter = pending = 0;
    results = [];

    // Run the step in a try..catch block so exceptions don't get out of hand.
    try {
      lock = true;
      var result = fn.apply(next, arguments);
    } catch (e) {
      // Pass any exceptions on through the next callback
      next(e);
    }


    // If a syncronous return is used, pass it to the callback
    if (result !== undefined) {
      next(undefined, result);
    }
    lock = false;
  }

  // Add a special callback generator `this.parallel()` that groups stuff.
  next.parallel = function () {
    var index = 1 + counter++;
    pending++;

    function check() {
      if (pending === 0) {
        // When they're all done, call the callback
        next.apply(null, results);
      }
    }
    process.nextTick(check); // Ensures that check is called at least once

    return function () {
      pending--;
      // Compress the error from any result to the first argument
      if (arguments[0]) {
        results[0] = arguments[0];
      }
      // Send the other results as arguments
      results[index] = arguments[1];
      if (!lock) { check(); }
    };
  };

  // Generates a callback generator for grouped results
  next.group = function () {
    var localCallback = next.parallel();
    var counter = 0;
    var pending = 0;
    var result = [];
    var error = undefined;

    function check() {
      if (pending === 0) {
        // When group is done, call the callback
        localCallback(error, result);
      }
    }
    process.nextTick(check); // Ensures that check is called at least once

    // Generates a callback for the group
    return function () {
      var index = counter++;
      pending++;
      return function () {
        pending--;
        // Compress the error from any result to the first argument
        if (arguments[0]) {
          error = arguments[0];
        }
        // Send the other results as arguments
        result[index] = arguments[1];
        if (!lock) { check(); }
      };
    };
  };

  // Start the engine an pass nothing to the first step.
  next();
}

// Tack on leading and tailing steps for input and output and return
// the whole thing as a function.  Basically turns step calls into function
// factories.
Step.fn = function StepFn() {
  var steps = Array.prototype.slice.call(arguments);
  return function () {
    var args = Array.prototype.slice.call(arguments);

    // Insert a first step that primes the data stream
    var toRun = [function () {
      this.apply(null, args);
    }].concat(steps);

    // If the last arg is a function add it as a last step
    if (typeof args[args.length-1] === 'function') {
      toRun.push(args.pop());
    }


    Step.apply(null, toRun);
  }
}


// Hook into commonJS module systems
if (typeof module !== 'undefined' && "exports" in module) {
  module.exports = Step;
}
}).call(this,require("/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"/home/maraoz/git/bitcore/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":28}],44:[function(require,module,exports){
(function (Buffer){/**
 * Simple synchronous parser based on node-binary.
 */

function spec(b) {
  function Parser(buffer)
  {
    this.subject = buffer;
    this.pos = 0;
  };

  Parser.prototype.buffer = function buffer(len) {
    var buf = this.subject.slice(this.pos, this.pos+len);
    this.pos += len;
    return buf;
  };

  Parser.prototype.search = function search(needle) {
    var len;

    if ("string" === typeof needle || Buffer.isBuffer(needle)) {
      // TODO: Slicing is probably too slow
      len = this.subject.slice(this.pos).indexOf(needle);
      if (len !== -1) {
        this.pos += len + needle.length;
      }
      return len;
    }
    if ("number" === typeof needle) {
      needle = needle & 0xff;
      // Search for single byte
      for (var i = this.pos, l = this.subject.length; i < l; i++) {
        if (this.subject[i] == needle) {
          len = i - this.pos;
          this.pos = i+1;
          return len;
        }
      }
      return -1;
    }
  };

  /**
   * Like search(), but returns the skipped bytes
   */
  Parser.prototype.scan = function scan(needle) {
    var startPos = this.pos;
    var len = this.search(needle);
    if (len !== -1) {
      return this.subject.slice(startPos, startPos+len);
    } else {
      throw new Error('No match');
    }
  };

  Parser.prototype.eof = function eof() {
    return this.pos >= this.subject.length;
  };

  // convert byte strings to unsigned little endian numbers
  function decodeLEu (bytes) {
    var acc = 0;
    for (var i = 0; i < bytes.length; i++) {
      acc += Math.pow(256,i) * bytes[i];
    }
    return acc;
  }

  // convert byte strings to unsigned big endian numbers
  function decodeBEu (bytes) {
    var acc = 0;
    for (var i = 0; i < bytes.length; i++) {
      acc += Math.pow(256, bytes.length - i - 1) * bytes[i];
    }
    return acc;
  }

  // convert byte strings to signed big endian numbers
  function decodeBEs (bytes) {
    var val = decodeBEu(bytes);
    if ((bytes[0] & 0x80) == 0x80) {
      val -= Math.pow(256, bytes.length);
    }
    return val;
  }

  // convert byte strings to signed little endian numbers
  function decodeLEs (bytes) {
    var val = decodeLEu(bytes);
    if ((bytes[bytes.length - 1] & 0x80) == 0x80) {
      val -= Math.pow(256, bytes.length);
    }
    return val;
  }

  function getDecoder(len, fn) {
    return function () {
      var buf = this.buffer(len);
      return fn(buf);
    };
  };
  [ 1, 2, 4, 8 ].forEach(function (bytes) {
    var bits = bytes * 8;
    
    Parser.prototype['word' + bits + 'le']
      = Parser.prototype['word' + bits + 'lu']
      = getDecoder(bytes, decodeLEu);
    
    Parser.prototype['word' + bits + 'ls']
      = getDecoder(bytes, decodeLEs);
    
    Parser.prototype['word' + bits + 'be']
      = Parser.prototype['word' + bits + 'bu']
      = getDecoder(bytes, decodeBEu);
    
    Parser.prototype['word' + bits + 'bs']
      = getDecoder(bytes, decodeBEs);

    Parser.prototype.word8 = Parser.prototype.word8u = Parser.prototype.word8be;
    Parser.prototype.word8s = Parser.prototype.word8bs;
  });

  Parser.prototype.varInt = function ()
  {
    var firstByte = this.word8();
    switch (firstByte) {
    case 0xFD:
      return this.word16le();

    case 0xFE:
      return this.word32le();

    case 0xFF:
      return this.word64le();

    default:
      return firstByte;
    }
  };

  Parser.prototype.varStr = function () {
    var len = this.varInt();
    return this.buffer(len);
  };

  return Parser;
};
module.defineClass(spec);
}).call(this,require("buffer").Buffer)
},{"buffer":29}],45:[function(require,module,exports){
(function (Buffer){function sEncodedData(b) {
  var base58 = b.base58 || 
    //require('base58-native').base58Check || 
    require('base58-native').base58Check;

  // Constructor.  Takes the following forms:
  //   new EncodedData(<base58_address_string>)
  //   new EncodedData(<binary_buffer>)
  //   new EncodedData(<data>, <encoding>)
  //   new EncodedData(<version>, <20-byte-hash>)
  function EncodedData(data, encoding) {
    this.data = data;
    if(!encoding && (typeof data == 'string')) {
      this.__proto__ = this.encodings['base58'];
    } else {
      this.__proto__ = this.encodings[encoding || 'binary'];
    }
  };

  // get or set the encoding used (transforms data)
  EncodedData.prototype.encoding = function(encoding) {
    if(encoding && (encoding != this._encoding)) {
      this.data = this.as(encoding);
      this.__proto__ = this.encodings[encoding];
    }
    return this._encoding;
  };

  // answer a new instance having the given encoding
  EncodedData.prototype.withEncoding = function(encoding) {
    return new EncodedData(this.as(encoding), encoding);
  };

  // answer the data in the given encoding
  EncodedData.prototype.as = function(encoding) {
    if(!encodings[encoding]) throw new Error('invalid encoding');
    return this.converters[encoding].call(this);
  };

  // validate that we can convert to binary
  EncodedData.prototype._validate = function() {
    this.withEncoding('binary');
  };

  // Boolean protocol for testing if valid
  EncodedData.prototype.isValid = function() {
    try {
      this.validate();
      return true;
    } catch(e) {
      return false;
    }
  };

  // subclasses can override to do more stuff
  EncodedData.prototype.validate = function() {
    this._validate();
  };

  // Boolean protocol for testing if valid
  EncodedData.prototype.isValid = function() {
    try {
      this.validate();
      return true;
    } catch(e) {
      return false;
    }
  };

  // convert to a string (in base58 form)
  EncodedData.prototype.toString = function() {
    return this.as('base58');
  };

  // utility
  EncodedData.prototype.doAsBinary = function(callback) {
    var oldEncoding = this.encoding();
    this.encoding('binary');
    callback.apply(this);
    this.encoding(oldEncoding);
  };

  // Setup support for various address encodings.  The object for
  // each encoding inherits from the EncodedData prototype.  This
  // allows any encoding to override any method...changing the encoding
  // for an instance will change the encoding it inherits from.  Note,
  // this will present some problems for anyone wanting to inherit from
  // EncodedData (we'll deal with that when needed).
  var encodings = {
    'binary': {
      converters: {
        'binary': function() {
          var answer = new Buffer(this.data.length);
          this.data.copy(answer);
          return answer;
        },
        'base58': function() {
          return base58.encode(this.data);
        },
        'hex': function() {
          return this.data.toString('hex');
        },
      },

      _validate: function() {
        //nothing to do here...we make no assumptions about the data
      },
    },

    'base58': {
      converters: {
        'binary': function() {
          return base58.decode(this.data);
        },
        'hex': function() {
          return this.withEncoding('binary').as('hex');
        },
      },
    },

    'hex': {
      converters: {
        'binary': function() {
          return new Buffer(this.data, 'hex');
        },
        'base58': function() {
          return this.withEncoding('binary').as('base58');
        },
      },
    },
  };

  for(var k in encodings) {
    if(!encodings[k].converters[k])
      encodings[k].converters[k] = function() {return this.data;};
    encodings[k]._encoding = k;
  }

  EncodedData.applyEncodingsTo = function(aClass) {
    var tmp = {};
    for(var k in encodings) {
      var enc = encodings[k];
      var obj = {}; 
      for(var j in enc) {
        obj[j] = enc[j];
      }
      obj.__proto__ = aClass.prototype;
      tmp[k] = obj;
    }
    aClass.prototype.encodings = tmp;
  };

  EncodedData.applyEncodingsTo(EncodedData);
  return EncodedData;
};



if(!(typeof module === 'undefined')) {
  module.defineClass(sEncodedData);
} else if(!(typeof define === 'undefined')) {
  define('EncodedData', ['classtool', 'browser/base58'], function(Classtool, base58) {
    return Classtool.defineClass(sEncodedData);  
  });
}



}).call(this,require("buffer").Buffer)
},{"base58-native":8,"buffer":29}],46:[function(require,module,exports){
(function (Buffer){function sVersionedData(b) {
  var superclass = b.superclass || require('./EncodedData').class();

  function VersionedData(version, payload) {
    if(typeof version != 'number') {
      VersionedData.super(this, arguments);
      return;
    };
    this.data = new Buffer(payload.length + 1);
    this.__proto__ = this.encodings['binary'];
    this.version(version);
    this.payload(payload);
  };
  VersionedData.superclass = superclass;
  superclass.applyEncodingsTo(VersionedData);

  // get or set the version data (the first byte of the address)
  VersionedData.prototype.version = function(num) {
    if(num || (num === 0)) {
      this.doAsBinary(function() {this.data.writeUInt8(num, 0);});
      return num;
    }
    return this.as('binary').readUInt8(0);
  };

  // get or set the payload data (as a Buffer object)
  VersionedData.prototype.payload = function(data) {
    if(data) {
      this.doAsBinary(function() {data.copy(this.data,1);});
      return data;
    }
    return this.as('binary').slice(1);
  };

  return VersionedData;
};


if(!(typeof module === 'undefined')) {
  module.defineClass(sVersionedData);
} else if(!(typeof define === 'undefined')) {
  define(['classtool', 'util/EncodedData'], function(Classtool, EncodedData) {
    return Classtool.defineClass(sVersionedData);
  });
}



}).call(this,require("buffer").Buffer)
},{"./EncodedData":45,"buffer":29}],47:[function(require,module,exports){

/**
 * Used during transcation verification when a source txout is missing.
 *
 * When a transaction is being verified by the memory pool this error causes
 * it to be added to the orphan pool instead of being discarded.
 */
function MissingSourceError(msg, missingTxHash) {
  // TODO: Since this happens in normal operation, perhaps we should
  //       avoid generating a whole stack trace.
  Error.call(this);
  Error.captureStackTrace(this, arguments.callee);
  this.message = msg;
  this.missingTxHash = missingTxHash;
  this.name = 'MissingSourceError';
};

MissingSourceError.prototype.__proto__ = Error.prototype;

exports.MissingSourceError = MissingSourceError;

/**
 * Used in several places to indicate invalid data.
 *
 * We want to distinguish invalid data errors from program errors, so we use
 * this exception to indicate the former.
 */
function VerificationError(msg, missingTxHash) {
  // TODO: Since this happens in normal operation, perhaps we should
  //       avoid generating a whole stack trace.
  Error.call(this);
  Error.captureStackTrace(this, arguments.callee);
  this.message = msg;
  this.missingTxHash = missingTxHash;
  this.name = 'VerificationError';
};

VerificationError.prototype.__proto__ = Error.prototype;

exports.VerificationError = VerificationError;

},{}],48:[function(require,module,exports){
var noop = function() {};

var loggers = {
  none: {info: noop, warn: noop, err: noop, debug: noop},
  normal: {info: console.log, warn: console.log, err: console.log, debug: noop},
  debug: {info: console.log, warn: console.log, err: console.log, debug: console.log},
};

var build_log = function(config) {
  return config.log || loggers[config.logger || 'normal'];
};
if(!(typeof module === 'undefined')) {
  var config = require('../config');
  module.exports = build_log(config);
} else if(!(typeof define === 'undefined')) {
  define(['config'], function(config){
    var e = build_log(config)
    return e;
  });
}

},{"../config":6}],49:[function(require,module,exports){
(function (Buffer){'use strict';

var crypto;
var bignum;
var Binary;
var Put;



var setup = function() {
  if (typeof exports === 'undefined') {
    exports = {};
  }
  var sha256 = function (data) {
    return new Buffer(crypto.createHash('sha256').update(data).digest('binary'), 'binary');
  };

  var ripe160 = exports.ripe160 = function (data) {
    return new Buffer(crypto.createHash('rmd160').update(data).digest('binary'), 'binary');
  };

  var sha1 = exports.sha1 = function (data) {
    return new Buffer(crypto.createHash('sha1').update(data).digest('binary'), 'binary');
  };

  var twoSha256 = exports.twoSha256 = function (data) {
    return sha256(sha256(data));
  };

  var sha256ripe160 = exports.sha256ripe160 = function (data) {
    return ripe160(sha256(data));
  };

  /**
   * Format a block hash like the official client does.
   */
  var formatHash = exports.formatHash = function (hash) {
    // Make a copy, because reverse() and toHex() are destructive.
    var hashEnd = new Buffer(10);
    hash.copy(hashEnd, 0, 22, 32);
    return hashEnd.reverse().toString('hex');
  };

  /**
   * Display the whole hash, as hex, in correct endian order.
   */
  var formatHashFull = exports.formatHashFull = function (hash) {
    // Make a copy, because reverse() and toHex() are destructive.
    var copy = new Buffer(hash.length);
    hash.copy(copy);
    var hex = copy.reverse().toHex();
    return hex;
  };

  /**
   * Format a block hash like Block Explorer does.
   *
   * Formats a block hash by removing leading zeros and truncating to 10 characters.
   */
  var formatHashAlt = exports.formatHashAlt = function (hash) {
    var hex = formatHashFull(hash);
    hex = hex.replace(/^0*/, '');
    return hex.substr(0, 10);
  };

  var formatBuffer = exports.formatBuffer = function (buffer, maxLen) {
    // Calculate amount of bytes to display
    if (maxLen === null) {
      maxLen = 10;
    }
    if (maxLen > buffer.length || maxLen === 0) {
      maxLen = buffer.length;
    }

    // Copy those bytes into a temporary buffer
    var temp = new Buffer(maxLen);
    buffer.copy(temp, 0, 0, maxLen);

    // Format as string
    var output = temp.toHex();
    if (temp.length < buffer.length) {
      output += "...";
    }
    return output;
  };

  var valueToBigInt = exports.valueToBigInt = function (valueBuffer) {
    if (Buffer.isBuffer(valueBuffer)) {
      return bignum.fromBuffer(valueBuffer, {endian: 'little', size: 8});
    } else {
      return valueBuffer;
    }
  };

  var bigIntToValue = exports.bigIntToValue = function (valueBigInt) {
    if (Buffer.isBuffer(valueBigInt)) {
      return valueBigInt;
    } else {
      return valueBigInt.toBuffer({endian: 'little', size: 8});
    }
  };

  var formatValue = exports.formatValue = function (valueBuffer) {
    var value = valueToBigInt(valueBuffer).toString();
    var integerPart = value.length > 8 ? value.substr(0, value.length-8) : '0';
    var decimalPart = value.length > 8 ? value.substr(value.length-8) : value;
    while (decimalPart.length < 8) {
      decimalPart = "0"+decimalPart;
    }
    decimalPart = decimalPart.replace(/0*$/, '');
    while (decimalPart.length < 2) {
      decimalPart += "0";
    }
    return integerPart+"."+decimalPart;
  };

  var reFullVal = /^\s*(\d+)\.(\d+)/;
  var reFracVal = /^\s*\.(\d+)/;
  var reWholeVal = /^\s*(\d+)/;

  function padFrac(frac)
  {
    frac=frac.substr(0,8); //truncate to 8 decimal places
    while (frac.length < 8)
      frac = frac + '0';
    return frac;
  }

  function parseFullValue(res)
  {
    return bignum(res[1]).mul('100000000').add(padFrac(res[2]));
  }

  function parseFracValue(res)
  {
    return bignum(padFrac(res[1]));
  }

  function parseWholeValue(res)
  {
    return bignum(res[1]).mul('100000000');
  }

  exports.parseValue = function parseValue(valueStr)
  {
    var res = valueStr.match(reFullVal);
    if (res)
      return parseFullValue(res);

    res = valueStr.match(reFracVal);
    if (res)
      return parseFracValue(res);

    res = valueStr.match(reWholeVal);
    if (res)
      return parseWholeValue(res);

    return undefined;
  };

  // Utility that synchronizes function calls based on a key
  var createSynchrotron = exports.createSynchrotron = function (fn) {
    var table = {};
    return function (key) {
      var args = Array.prototype.slice.call(arguments);
      var run = function () {
        // Function fn() will call when it finishes
        args[0] = function next() {
          if (table[key]) {
            if (table[key].length) {
              table[key].shift()();
            } else {
              delete table[key];
            }
          }
        };

        fn.apply(null, args);
      };

      if (!table[key]) {
        table[key] = [];
        run();
      } else {
        table[key].push(run);
      }
    };
  };

  /**
   * Generate a random 64-bit number.
   *
   * With ideas from node-uuid:
   * Copyright (c) 2010 Robert Kieffer
   * https://github.com/broofa/node-uuid/
   *
   * @returns Buffer random nonce
   */
  var generateNonce = exports.generateNonce = function () {
    var b32 = 0x100000000, ff = 0xff;
    var b = new Buffer(8), i = 0;

    // Generate eight random bytes
    var r = Math.random()*b32;
    b[i++] = r & ff;
    b[i++] = (r=r>>>8) & ff;
    b[i++] = (r=r>>>8) & ff;
    b[i++] = (r=r>>>8) & ff;
    r = Math.random()*b32;
    b[i++] = r & ff;
    b[i++] = (r=r>>>8) & ff;
    b[i++] = (r=r>>>8) & ff;
    b[i++] = (r=r>>>8) & ff;

    return b;
  };

  /**
   * Decode difficulty bits.
   *
   * This function calculates the difficulty target given the difficulty bits.
   */
  var decodeDiffBits = exports.decodeDiffBits = function (diffBits, asBigInt) {
    diffBits = +diffBits;
    var target = bignum(diffBits & 0xffffff);
    target = target.shiftLeft(8*((diffBits >>> 24) - 3));

    if (asBigInt) {
      return target;
    }

    // Convert to buffer
    var diffBuf = target.toBuffer();
    var targetBuf = new Buffer(32).fill(0);
    diffBuf.copy(targetBuf, 32-diffBuf.length);
    return targetBuf;
  };

  /**
   * Encode difficulty bits.
   *
   * This function calculates the compact difficulty, given a difficulty target.
   */
  var encodeDiffBits = exports.encodeDiffBits = function encodeDiffBits(target) {
    if (Buffer.isBuffer(target)) {
      target = bignum.fromBuffer(target);
    } else if ("function" === typeof target.toBuffer) { // duck-typing bignum
      // Nothing to do
    } else {
      throw new Error("Incorrect variable type for difficulty");
    }

    var mpiBuf = target.toBuffer("mpint");
    var size = mpiBuf.length - 4;

    var compact = size << 24;
    if (size >= 1) compact |= mpiBuf[4] << 16;
    if (size >= 2) compact |= mpiBuf[5] <<  8;
    if (size >= 3) compact |= mpiBuf[6]      ;

    return compact;
  };

  /**
   * Calculate "difficulty".
   *
   * This function calculates the maximum difficulty target divided by the given
   * difficulty target.
   */
  var calcDifficulty = exports.calcDifficulty = function (target) {
    if (!Buffer.isBuffer(target)) {
      target = decodeDiffBits(target);
    }
    var targetBigint = bignum.fromBuffer(target, {order: 'forward'});
    var maxBigint = bignum.fromBuffer(MAX_TARGET, {order: 'forward'});
    return maxBigint.div(targetBigint).toNumber();
  };

  var reverseBytes32 = exports.reverseBytes32 = function (data) {
    if (data.length % 4) {
      throw new Error("Util.reverseBytes32(): Data length must be multiple of 4");
    }
    var put = new Put();
    var parser = Binary.parse(data);
    while (!parser.eof()) {
      var word = parser.word32le('word').vars.word;
      put.word32be(word);
    }
    return put.buffer();
  };

  var getVarIntSize = exports.getVarIntSize = function getVarIntSize(i) {

    if (i < 0xFD) {
      // unsigned char
      return 1;
    } else if (i <= 1<<16) {
      // unsigned short (LE)
      return 3;
    } else if (i <= 1<<32) {
      // unsigned int (LE)
      return 5;
    } else {
      // unsigned long long (LE)
      return 9;
    }
  };

  var varIntBuf = exports.varIntBuf = function varIntBuf(n) {
    var buf = undefined;
    if (n < 253) {
      buf = new Buffer(1);
      buf.writeUInt8(n, 0);
    } else if (n < 0x10000) {
      buf = new Buffer(1 + 2);
      buf.writeUInt8(253, 0);
      buf.writeUInt16LE(n, 1);
    } else if (n < 0x100000000) {
      buf = new Buffer(1 + 4);
      buf.writeUInt8(254, 0);
      buf.writeUInt32LE(n, 1);
    } else {
      throw new Error("quadword not supported");
    }

    return buf;
  };

  var varStrBuf = exports.varStrBuf = function varStrBuf(s) {
    return Buffer.concat(varIntBuf(s.length), s);
  };

  // Initializations
  exports.NULL_HASH = new Buffer(32).fill(0);
  exports.EMPTY_BUFFER = new Buffer(0);
  exports.ZERO_VALUE = new Buffer(8).fill(0);
  exports.INT64_MAX = new Buffer('ffffffffffffffff', 'hex');

  // How much of Bitcoin's internal integer coin representation
  // makes 1 BTC
  exports.COIN = 100000000;

  exports.MAX_TARGET = new Buffer('00000000FFFF0000000000000000000000000000000000000000000000000000', 'hex');


  return exports;

};

if(typeof module !== 'undefined') {
  crypto = require('crypto');
  bignum = require('bignum');
  Binary = require('binary');
  Put = require('bufferput');

  setup();
} else if(typeof define !== 'undefined') {
  define(['browser/g2'], function(){
    console.log('out');
    return setup();
  });
}
}).call(this,require("buffer").Buffer)
},{"bignum":9,"binary":10,"buffer":29,"bufferput":15,"crypto":21}]},{},[7])