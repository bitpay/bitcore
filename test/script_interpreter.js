'use strict';

var should = require('chai').should();
var bitcore = require('..');
var ScriptInterpreter = bitcore.ScriptInterpreter;
var Transaction = bitcore.Transaction;
var Script = bitcore.Script;
var BN = bitcore.crypto.BN;
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var Opcode = bitcore.Opcode;

var script_valid = require('./data/bitcoind/script_valid');
var script_invalid = require('./data/bitcoind/script_invalid');
var tx_valid = require('./transaction/tx_valid');
var tx_invalid = require('./transaction/tx_invalid');

//the script string format used in bitcoind data tests
Script.fromBitcoindString = function(str) {
  var bw = new BufferWriter();
  var tokens = str.split(' ');
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (token === '') {
      continue;
    }

    var opstr;
    var opcodenum;
    var tbuf;
    if (token[0] === '0' && token[1] === 'x') {
      var hex = token.slice(2);
      bw.write(new Buffer(hex, 'hex'));
    } else if (token[0] === '\'') {
      var tstr = token.slice(1, token.length - 1);
      var cbuf = new Buffer(tstr);
      tbuf = Script().add(cbuf).toBuffer();
      bw.write(tbuf);
    } else if (typeof Opcode['OP_' + token] !== 'undefined') {
      opstr = 'OP_' + token;
      opcodenum = Opcode[opstr];
      bw.writeUInt8(opcodenum);
    } else if (typeof Opcode[token] === 'number') {
      opstr = token;
      opcodenum = Opcode[opstr];
      bw.writeUInt8(opcodenum);
    } else if (!isNaN(parseInt(token))) {
      var script = Script().add(BN(token).toScriptNumBuffer());
      tbuf = script.toBuffer();
      bw.write(tbuf);
    } else {
      throw new Error('Could not determine type of script value');
    }
  }
  var buf = bw.concat();
  return this.fromBuffer(buf);
};
describe('ScriptInterpreter', function() {

  it('should make a new interp', function() {
    var interp = new ScriptInterpreter();
    (interp instanceof ScriptInterpreter).should.equal(true);
    interp.stack.length.should.equal(0);
    interp.altstack.length.should.equal(0);
    interp.pc.should.equal(0);
    interp.pbegincodehash.should.equal(0);
    interp.nOpCount.should.equal(0);
    interp.vfExec.length.should.equal(0);
    interp.errstr.should.equal('');
    interp.flags.should.equal(0);
  });

  describe('@castToBool', function() {

    it('should cast these bufs to bool correctly', function() {
      ScriptInterpreter.castToBool(BN(0).toSM({
        endian: 'little'
      })).should.equal(false);
      ScriptInterpreter.castToBool(new Buffer('0080', 'hex')).should.equal(false); //negative 0
      ScriptInterpreter.castToBool(BN(1).toSM({
        endian: 'little'
      })).should.equal(true);
      ScriptInterpreter.castToBool(BN(-1).toSM({
        endian: 'little'
      })).should.equal(true);

      var buf = new Buffer('00', 'hex');
      var bool = BN().fromSM(buf, {
        endian: 'little'
      }).cmp(0) !== 0;
      ScriptInterpreter.castToBool(buf).should.equal(bool);
    });

  });

  describe('#verify', function() {

    it('should verify these trivial scripts', function() {
      var verified;
      var si = ScriptInterpreter();
      verified = si.verify(Script('OP_1'), Script('OP_1'));
      verified.should.equal(true);
      verified = ScriptInterpreter().verify(Script('OP_1'), Script('OP_0'));
      verified.should.equal(false);
      verified = ScriptInterpreter().verify(Script('OP_0'), Script('OP_1'));
      verified.should.equal(true);
      verified = ScriptInterpreter().verify(Script('OP_CODESEPARATOR'), Script('OP_1'));
      verified.should.equal(true);
      verified = ScriptInterpreter().verify(Script(''), Script('OP_DEPTH OP_0 OP_EQUAL'));
      verified.should.equal(true);
      verified = ScriptInterpreter().verify(Script('OP_1 OP_2'), Script('OP_2 OP_EQUALVERIFY OP_1 OP_EQUAL'));
      verified.should.equal(true);
      verified = ScriptInterpreter().verify(Script('9 0x000000000000000010'), Script(''));
      verified.should.equal(true);
      verified = ScriptInterpreter().verify(Script('OP_1'), Script('OP_15 OP_ADD OP_16 OP_EQUAL'));
      verified.should.equal(true);
      verified = ScriptInterpreter().verify(Script('OP_0'), Script('OP_IF OP_VER OP_ELSE OP_1 OP_ENDIF'));
      verified.should.equal(true);
    });

  });


  var getFlags = function getFlags(flagstr) {
    var flags = 0;
    if (flagstr.indexOf('NONE') !== -1) {
      flags = flags | ScriptInterpreter.SCRIPT_VERIFY_NONE;
    }
    if (flagstr.indexOf('P2SH') !== -1) {
      flags = flags | ScriptInterpreter.SCRIPT_VERIFY_P2SH;
    }
    if (flagstr.indexOf('STRICTENC') !== -1) {
      flags = flags | ScriptInterpreter.SCRIPT_VERIFY_STRICTENC;
    }
    if (flagstr.indexOf('DERSIG') !== -1) {
      flags = flags | ScriptInterpreter.SCRIPT_VERIFY_DERSIG;
    }
    if (flagstr.indexOf('LOW_S') !== -1) {
      flags = flags | ScriptInterpreter.SCRIPT_VERIFY_LOW_S;
    }
    if (flagstr.indexOf('NULLDUMMY') !== -1) {
      flags = flags | ScriptInterpreter.SCRIPT_VERIFY_NULLDUMMY;
    }
    if (flagstr.indexOf('SIGPUSHONLY') !== -1) {
      flags = flags | ScriptInterpreter.SCRIPT_VERIFY_SIGPUSHONLY;
    }
    if (flagstr.indexOf('MINIMALDATA') !== -1) {
      flags = flags | ScriptInterpreter.SCRIPT_VERIFY_MINIMALDATA;
    }
    if (flagstr.indexOf('DISCOURAGE_UPGRADABLE_NOPS') !== -1) {
      flags = flags | ScriptInterpreter.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS;
    }
    return flags;
  };


  var testToFromString = function(script) {
    var s = script.toString();
    Script.fromString(s).toString().should.equal(s);
  };

  var testFixture = function(vector, expected) {
    var scriptSig = Script.fromBitcoindString(vector[0]);
    var scriptPubkey = Script.fromBitcoindString(vector[1]);
    var flags = getFlags(vector[2]);


    //testToFromString(scriptSig);
    //testToFromString(scriptPubkey);

    var hashbuf = new Buffer(32);
    hashbuf.fill(0);
    var credtx = Transaction();
    credtx.inputs.push(new Transaction.Input({
      prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
      outputIndex: 0xffffffff,
      sequenceNumber: 0xffffffff,
      script: Script('OP_0 OP_0')
    }));
    credtx._addOutput(new Transaction.Output({
      script: scriptPubkey,
      satoshis: 0
    }));
    var idbuf = credtx.id;

    var spendtx = Transaction();
    spendtx.inputs.push(new Transaction.Input({
      prevTxId: idbuf.toString('hex'),
      outputIndex: 0,
      sequenceNumber: 0xffffffff,
      script: scriptSig
    }));
    spendtx._addOutput(new Transaction.Output({
      script: Script(),
      satoshis: 0
    }));

    var interp = ScriptInterpreter();
    var verified = interp.verify(scriptSig, scriptPubkey, spendtx, 0, flags);
    verified.should.equal(expected);
  };
  describe.only('bitcoind fixtures', function() {
    var testAllFixtures = function(set, expected) {
      var c = 0;
      set.forEach(function(vector) {
        if (vector.length === 1) {
          return;
        }
        c++;
        var descstr = vector[3];
        var fullScriptString = vector[0] + ' ' + vector[1];
        var comment = descstr ? (' (' + descstr + ')') : '';
        it('should pass script_' + (expected ? '' : 'in') + 'valid vector #' + c + ': ' + fullScriptString + comment, function() {
          testFixture(vector, expected);
        });
      });
    };
    //testAllFixtures(script_valid, true);
    //testAllFixtures(script_invalid, false);

    var c = 0;
    tx_valid.forEach(function(vector) {
      if (vector.length === 1) {
        return;
      }
      c++;
      it('should pass tx_valid vector ' + c, function() {
        var inputs = vector[0];
        var txhex = vector[1];
        var flags = getFlags(vector[2]);

        var map = {};
        inputs.forEach(function(input) {
          var txoutnum = input[1];
          if (txoutnum === -1) {
            txoutnum = 0xffffffff; //bitcoind casts -1 to an unsigned int
          }
          map[input[0] + ':' + txoutnum] = Script.fromBitcoindString(input[2]);
        });

        var tx = Transaction(txhex);
        tx.inputs.forEach(function(txin, j) {
          var scriptSig = txin.script;
          var txidhex = BufferReader(txin.txidbuf).readReverse().toString('hex');
          var txoutnum = txin.txoutnum;
          var scriptPubkey = map[txidhex + ':' + txoutnum];
          should.exist(scriptPubkey);
          var interp = ScriptInterpreter();
          var verified = interp.verify(scriptSig, scriptPubkey, tx, j, flags);
          verified.should.equal(true);
        });
      });
    });

    c = 0;
    tx_invalid.forEach(function(vector) {
      if (vector.length === 1) {
        return;
      }
      c++;

      // tests intentionally not performed by the script interpreter:
      // TODO: check this?
      /*
      if (c === 7 || // tests if valuebn is negative
        c === 8 || // tests if valuebn is greater than MAX_MONEY
        c === 10 || // tests if two inputs are equal
        c === 11 || // coinbase
        c === 12 || // coinbase
        c === 13 // null input
      ) {
        return;
      }
      */

      it('should pass tx_invalid vector ' + c, function() {
        var inputs = vector[0];
        var txhex = vector[1];
        var flags = getFlags(vector[2]);

        var map = {};
        inputs.forEach(function(input) {
          var txoutnum = input[1];
          if (txoutnum === -1) {
            txoutnum = 0xffffffff; //bitcoind casts -1 to an unsigned int
          }
          map[input[0] + ':' + txoutnum] = Script.fromBitcoindString(input[2]);
        });

        var tx = Transaction().fromBuffer(new Buffer(txhex, 'hex'));
        if (tx.txins.length > 0) {
          tx.txins.some(function(txin, j) {
            var scriptSig = txin.script;
            var txidhex = BufferReader(txin.txidbuf).readReverse().toString('hex');
            var txoutnum = txin.txoutnum;
            var scriptPubkey = map[txidhex + ':' + txoutnum];
            should.exist(scriptPubkey);
            var interp = ScriptInterpreter();
            var verified = interp.verify(scriptSig, scriptPubkey, tx, j, flags);
            return verified === false;
          }).should.equal(true);
        }
      });
    });

  });

});
