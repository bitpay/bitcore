'use strict';

// inspired in bitcoin core test:
// https://github.com/bitcoin/bitcoin/blob/7d49a9173ab636d118c2a81fc3c3562192e7813a/src/test/sighash_tests.cpp

var chai = chai || require('chai');
var should = chai.should();
var bitcore = bitcore || require('../bitcore');
var Transaction = bitcore.Transaction;
var Script = bitcore.Script;
var Opcode = bitcore.Opcode;

var randInt = function(low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
};
var randUIntN = function(nBits) {
  return randInt(0, Math.pow(2, nBits));
};
var randUInt32 = function() {
  return randUIntN(32);
};
var randBool = function() {
  return Math.random() < 0.5;
};
var hexAlphabet = '0123456789abcdef';
var randHex = function() {
  return hexAlphabet[randInt(0, 15)];
};
var randHexN = function(n) {
  var s = '';
  while (n--) {
    s += randHex();
  }
  return s;
};
var randTxHash = function() {
  return randHexN(64);
};
var randPick = function(list) {
  return list[randInt(0, list.length-1)];
};


var opList = Opcode.asList();

var randomScript = function() {
  var s = new Script();
  var ops = randInt(0,10);
  for (var i=0; i<ops; i++) {
    var op = randPick(opList);
    s.writeOp(Opcode.map[op]);
  }
  return s;
};

var randomTx = function(single) {
  var tx = new Transaction({
    version: randUInt32(),
    lock_time: randBool() ? randUInt32() : 0
  });
  var insN = randInt(1, 5);
  var outsN = single ? insN : randInt(1, 5);
  for (var i = 0; i < insN; i++) {
    var txin = new Transaction.In({
      oTxHash: randTxHash(),
      oIndex: randInt(0, 4),
      script: randomScript().serialize(),
      sequence: randBool() ? randUInt32() : 0xffffffff
    });
    tx.ins.push(txin);
  }
  for (i = 0; i < outsN; i++) {
    var txout = Transaction.Out({
      value: randInt(0,100000000),
      script: randomScript().serialize()
    });
    tx.outs.push(txout);
  }
  return tx;
};

describe('Transaction sighash (#hashForSignature)', function() {
  for (var i = 0; i < 10; i++) {
    it('should hash correctly random tx #'+(i+1), function() {
      var tx = randomTx();
      console.log(tx);
      tx.hashForSignature(script, inIndex, hashType);
      return;
    });
  }
});
