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







var signatureHashOld = function(tx, script, inIndex, hashType) {
  if (+inIndex !== inIndex ||
    inIndex < 0 || inIndex >= tx.ins.length) {
    throw new Error('Input index "' + inIndex + '" invalid or out of bounds ' +
      '(' + tx.ins.length + ' inputs)');
  }

  // Clone transaction
  var txTmp = new Transaction();
  tx.ins.forEach(function(txin) {
    txTmp.ins.push(new Transaction.In(txin));
  });
  tx.outs.forEach(function(txout) {
    txTmp.outs.push(new Transaction.Out(txout));
  });
  txTmp.version = tx.version;
  txTmp.lock_time = tx.lock_time;

  // In case concatenating two scripts ends up with two codeseparators,
  // or an extra one at the end, this prevents all those possible
  // incompatibilities.
  script.findAndDelete(Opcode.map.OP_CODESEPARATOR);

  // Get mode portion of hashtype
  var hashTypeMode = hashType & 0x1f;

  // Generate modified transaction data for hash
  var bytes = (new Put());
  bytes.word32le(tx.version);

  // Serialize inputs
  if (hashType & Transaction.SIGHASH_ANYONECANPAY) {
    // Blank out all inputs except current one, not recommended for open
    // transactions.
    bytes.varint(1);
    bytes.put(tx.ins[inIndex].o);
    bytes.varint(script.buffer.length);
    bytes.put(script.buffer);
    bytes.word32le(tx.ins[inIndex].q);
  } else {
    bytes.varint(tx.ins.length);
    for (var i = 0, l = tx.ins.length; i < l; i++) {
      var txin = tx.ins[i];
      bytes.put(txin.o);

      // Current input's script gets set to the script to be signed, all others
      // get blanked.
      if (inIndex === i) {
        bytes.varint(script.buffer.length);
        bytes.put(script.buffer);
      } else {
        bytes.varint(0);
      }

      if (hashTypeMode === Transaction.SIGHASH_NONE && inIndex !== i) {
        bytes.word32le(0);
      } else {
        bytes.word32le(tx.ins[i].q);
      }
    }
  }

  // Serialize outputs
  if (hashTypeMode === Transaction.SIGHASH_NONE) {
    bytes.varint(0);
  } else {
    var outsLen;
    if (hashTypeMode === Transaction.SIGHASH_SINGLE) {
      if (inIndex >= txTmp.outs.length) {
        // bug present in bitcoind which must be also present in bitcore
        // Transaction.hashForSignature(): SIGHASH_SINGLE 
        // no corresponding txout found - out of bounds
        var ret = new Buffer(1);
        ret.writeUInt8(1, 0);
        return ret; // return 1 bug
      }
      outsLen = inIndex + 1;
    } else {
      outsLen = tx.outs.length;
    }

    bytes.varint(outsLen);
    for (var i = 0; i < outsLen; i++) {
      if (hashTypeMode === Transaction.SIGHASH_SINGLE && i !== inIndex) {
        // Zero all outs except the one we want to keep
        bytes.put(util.INT64_MAX);
        bytes.varint(0);
      } else {
        bytes.put(tx.outs[i].v);
        bytes.varint(tx.outs[i].s.length);
        bytes.put(tx.outs[i].s);
      }
    }
  }

  bytes.word32le(tx.lock_time);

  var buffer = bytes.buffer();

  // Append hashType
  buffer = Buffer.concat([buffer, new Buffer([parseInt(hashType), 0, 0, 0])]);

  return util.twoSha256(buffer);
};








describe('Transaction sighash (#hashForSignature)', function() {
  for (var i = 0; i < 250; i++) {
    it.skip('should hash correctly random tx #' + (i + 1), function() {
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
    var sighash = datum[4];
    it('should validate correctly ' + buffertools.toHex(raw_tx), function() {
      var tx = new Transaction();
      tx.parse(raw_tx);
      var ser_tx = buffertools.toHex(tx.serialize());
      ser_tx.should.equal(buffertools.toHex(raw_tx));
      var h = buffertools.toHex(tx.hashForSignature(scriptPubKey, input_index, hashType));
      h.should.equal(sighash); // compare our output with bitcoind's
    });

  });
});
