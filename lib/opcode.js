'use strict';

var _ = require('lodash');
var $ = require('./util/preconditions');
var BufferUtil = require('./util/buffer');
var JSUtil = require('./util/js');

function Opcode(num) {
  if (!(this instanceof Opcode)) {
    return new Opcode(num);
  }

  var value;

  if (_.isNumber(num)) {
    value = num;
  } else if (_.isString(num)) {
    value = Opcode.map[num];
  } else {
    throw new TypeError('Unrecognized num type: "' + typeof(num) + '" for Opcode');
  }

  JSUtil.defineImmutable(this, {
    num: value
  });

  return this;
}

Opcode.fromBuffer = function(buf) {
  $.checkArgument(BufferUtil.isBuffer(buf));
  return new Opcode(Number('0x' + buf.toString('hex')));
};

Opcode.fromNumber = function(num) {
  $.checkArgument(_.isNumber(num));
  return new Opcode(num);
};

Opcode.fromString = function(str) {
  $.checkArgument(_.isString(str));
  var value = Opcode.map[str];
  if (typeof value === 'undefined') {
    throw new TypeError('Invalid opcodestr');
  }
  return new Opcode(value);
};

Opcode.prototype.toHex = function() {
  return this.num.toString(16);
};

Opcode.prototype.toBuffer = function() {
  return new Buffer(this.toHex(), 'hex');
};

Opcode.prototype.toNumber = function() {
  return this.num;
};

Opcode.prototype.toString = function() {
  var str = Opcode.reverseMap[this.num];
  if (typeof str === 'undefined') {
    throw new Error('Opcode does not have a string representation');
  }
  return str;
};

Opcode.smallInt = function(n) {
  $.checkArgument(n >= 0 && n <= 16, 'Invalid Argument: n must be between 0 and 16');
  if (n === 0) {
    return Opcode('OP_0');
  }
  return new Opcode(Opcode.map.OP_1 + n - 1);
};

Opcode.map = {
  // push value
  OP_FALSE: 0,
  OP_0: 0,
  OP_PUSHDATA1: 76,
  OP_PUSHDATA2: 77,
  OP_PUSHDATA4: 78,
  OP_1NEGATE: 79,
  OP_RESERVED: 80,
  OP_TRUE: 81,
  OP_1: 81,
  OP_2: 82,
  OP_3: 83,
  OP_4: 84,
  OP_5: 85,
  OP_6: 86,
  OP_7: 87,
  OP_8: 88,
  OP_9: 89,
  OP_10: 90,
  OP_11: 91,
  OP_12: 92,
  OP_13: 93,
  OP_14: 94,
  OP_15: 95,
  OP_16: 96,

  // control
  OP_NOP: 97,
  OP_VER: 98,
  OP_IF: 99,
  OP_NOTIF: 100,
  OP_VERIF: 101,
  OP_VERNOTIF: 102,
  OP_ELSE: 103,
  OP_ENDIF: 104,
  OP_VERIFY: 105,
  OP_RETURN: 106,

  // stack ops
  OP_TOALTSTACK: 107,
  OP_FROMALTSTACK: 108,
  OP_2DROP: 109,
  OP_2DUP: 110,
  OP_3DUP: 111,
  OP_2OVER: 112,
  OP_2ROT: 113,
  OP_2SWAP: 114,
  OP_IFDUP: 115,
  OP_DEPTH: 116,
  OP_DROP: 117,
  OP_DUP: 118,
  OP_NIP: 119,
  OP_OVER: 120,
  OP_PICK: 121,
  OP_ROLL: 122,
  OP_ROT: 123,
  OP_SWAP: 124,
  OP_TUCK: 125,

  // splice ops
  OP_CAT: 126,
  OP_SUBSTR: 127,
  OP_LEFT: 128,
  OP_RIGHT: 129,
  OP_SIZE: 130,

  // bit logic
  OP_INVERT: 131,
  OP_AND: 132,
  OP_OR: 133,
  OP_XOR: 134,
  OP_EQUAL: 135,
  OP_EQUALVERIFY: 136,
  OP_RESERVED1: 137,
  OP_RESERVED2: 138,

  // numeric
  OP_1ADD: 139,
  OP_1SUB: 140,
  OP_2MUL: 141,
  OP_2DIV: 142,
  OP_NEGATE: 143,
  OP_ABS: 144,
  OP_NOT: 145,
  OP_0NOTEQUAL: 146,

  OP_ADD: 147,
  OP_SUB: 148,
  OP_MUL: 149,
  OP_DIV: 150,
  OP_MOD: 151,
  OP_LSHIFT: 152,
  OP_RSHIFT: 153,

  OP_BOOLAND: 154,
  OP_BOOLOR: 155,
  OP_NUMEQUAL: 156,
  OP_NUMEQUALVERIFY: 157,
  OP_NUMNOTEQUAL: 158,
  OP_LESSTHAN: 159,
  OP_GREATERTHAN: 160,
  OP_LESSTHANOREQUAL: 161,
  OP_GREATERTHANOREQUAL: 162,
  OP_MIN: 163,
  OP_MAX: 164,

  OP_WITHIN: 165,

  // crypto
  OP_RIPEMD160: 166,
  OP_SHA1: 167,
  OP_SHA256: 168,
  OP_HASH160: 169,
  OP_HASH256: 170,
  OP_CODESEPARATOR: 171,
  OP_CHECKSIG: 172,
  OP_CHECKSIGVERIFY: 173,
  OP_CHECKMULTISIG: 174,
  OP_CHECKMULTISIGVERIFY: 175,

  // expansion
  OP_NOP1: 176,
  OP_NOP2: 177,
  OP_NOP3: 178,
  OP_NOP4: 179,
  OP_NOP5: 180,
  OP_NOP6: 181,
  OP_NOP7: 182,
  OP_NOP8: 183,
  OP_NOP9: 184,
  OP_NOP10: 185,

  // template matching params
  OP_PUBKEYHASH: 253,
  OP_PUBKEY: 254,
  OP_INVALIDOPCODE: 255
};

Opcode.reverseMap = [];

for (var k in Opcode.map) {
  Opcode.reverseMap[Opcode.map[k]] = k;
}

// Easier access to opcodes
_.extend(Opcode, Opcode.map);

/**
 * @returns true if opcode is one of OP_0, OP_1, ..., OP_16
 */
Opcode.isSmallIntOp = function(opcode) {
  if (opcode instanceof Opcode) {
    opcode = opcode.toNumber();
  }
  return ((opcode === Opcode.map.OP_0) ||
    ((opcode >= Opcode.map.OP_1) && (opcode <= Opcode.map.OP_16)));
};

/**
 * Will return a string formatted for the console
 *
 * @returns {string} Script opcode
 */
Opcode.prototype.inspect = function() {
  return '<Opcode: ' + this.toString() + ', hex: '+this.toHex()+', decimal: '+this.num+'>';
};

module.exports = Opcode;
