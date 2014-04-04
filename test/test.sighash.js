'use strict';

// inspired in bitcoin core test:
// https://github.com/bitcoin/bitcoin/blob/7d49a9173ab636d118c2a81fc3c3562192e7813a/src/test/sighash_tests.cpp

var chai = chai || require('chai');
var should = chai.should();
var bitcore = bitcore || require('../bitcore');
var Transaction = bitcore.Transaction;
var Script = bitcore.Script;
var Opcode = bitcore.Opcode;
var util = bitcore.util;
var Put = bitcore.Put;
var Put = require('bufferput');
var buffertools = require('buffertools');
var testdata = testdata || require('./testdata');

var seed = 1;
// seedable pseudo-random function
var random = function() {
  var x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

var randInt = function(low, high) {
  return Math.floor(random() * (high - low + 1) + low);
};
var randUIntN = function(nBits) {
  return randInt(0, Math.pow(2, nBits));
};
var randUInt32 = function() {
  return randUIntN(32);
};
var randBool = function() {
  return random() < 0.5;
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
  return list[randInt(0, list.length - 1)];
};


var opList = Opcode.asList();

var randomScript = function() {
  var s = new Script();
  var ops = randInt(0, 10);
  for (var i = 0; i < ops; i++) {
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
    var txout = new Transaction.Out({
      value: new Buffer(8),
      script: randomScript().serialize()
    });
    tx.outs.push(txout);
  }
  return tx;
};





var oneBuffer = function() {
  // bug present in bitcoind which must be also present in bitcore
  // see https://bitcointalk.org/index.php?topic=260595
  var ret = new Buffer(32);
  ret.writeUInt8(1, 0);
  for (var i=1; i<32; i++) ret.writeUInt8(0, i);
  return ret; // return 1 bug
};



var signatureHashOld = function(tx, script, inIndex, hashType) {
  if (+inIndex !== inIndex ||
    inIndex < 0 || inIndex >= tx.ins.length) {
    return oneBuffer();
  }
  // Check for invalid use of SIGHASH_SINGLE
  var hashTypeMode = hashType & 0x1f;
  if (hashTypeMode === Transaction.SIGHASH_SINGLE) {
    if (inIndex >= tx.outs.length) {
      return oneBuffer();
    }
  }

  // Wrapper to serialize only the necessary parts of the transaction being signed
  var serializer = new Transaction.Serializer(tx, script, inIndex, hashType);
  // Serialize
  var buffer = serializer.buffer();
  // Append hashType
  var hashBuf = new Put().word32le(hashType).buffer();
  buffer = Buffer.concat([buffer, hashBuf]);
  return util.twoSha256(buffer);
};








describe('Transaction sighash (#hashForSignature)', function() {
  for (var i = 0; i < 250; i++) {
    it('should hash correctly random tx #' + (i + 1), function() {
      var tx = randomTx();
      var l = tx.ins.length;
      for (var i = 0; i < l; i++) {
        var script = randomScript();
        var hashType = randUInt32();
        var h = buffertools.toHex(tx.hashForSignature(script, i, hashType));
        var oh = buffertools.toHex(signatureHashOld(tx, script, i, hashType));
        h.should.equal(oh);
      }
    });
  }

  testdata.dataSighash.forEach(function(datum) {
    if (datum.length < 5) return;
    var raw_tx = new Buffer(datum[0], 'hex');
    var scriptPubKey = new Script(new Buffer(datum[1], 'hex'));
    var input_index = parseInt(datum[2]);
    var hashType = parseInt(datum[3]);
    var sighash = buffertools.toHex(buffertools.reverse(new Buffer(datum[4],'hex')));
    it('should validate correctly ' + buffertools.toHex(raw_tx), function() {
      var tx = new Transaction();
      tx.parse(raw_tx);
      var ser_tx = buffertools.toHex(tx.serialize());
      ser_tx.should.equal(buffertools.toHex(raw_tx));
      var h = buffertools.toHex(tx.hashForSignature(scriptPubKey, input_index, hashType));
      h.should.equal(sighash); // compare our output with bitcoind's output
    });

  });
});
