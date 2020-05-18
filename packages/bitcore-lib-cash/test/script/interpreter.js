'use strict';

var should = require('chai').should();
var bitcore = require('../..');
var Interpreter = bitcore.Script.Interpreter;
var Transaction = bitcore.Transaction;
var PrivateKey = bitcore.PrivateKey;
var Script = bitcore.Script;
var BN = bitcore.crypto.BN;
var BufferWriter = bitcore.encoding.BufferWriter;
var Opcode = bitcore.Opcode;
var _ = require('lodash');

var script_tests = require('../data/bitcoind/script_tests');
var tx_valid = require('../data/bitcoind/tx_valid');
var tx_invalid = require('../data/bitcoind/tx_invalid');

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
      bw.write(Buffer.from(hex, 'hex'));
    } else if (token[0] === '\'') {
      var tstr = token.slice(1, token.length - 1);
      var cbuf = Buffer.from(tstr);
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
      var script = Script().add(new BN(token).toScriptNumBuffer());
      tbuf = script.toBuffer();
      bw.write(tbuf);
    } else {
      throw new Error('Could not determine type of script value');
    }
  }
  var buf = bw.concat();
  return this.fromBuffer(buf);
};



describe('Interpreter', function() {

  it('should make a new interp', function() {
    var interp = new Interpreter();
    (interp instanceof Interpreter).should.equal(true);
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
      Interpreter.castToBool(new BN(0).toSM({
        endian: 'little'
      })).should.equal(false);
      Interpreter.castToBool(Buffer.from('0080', 'hex')).should.equal(false); //negative 0
      Interpreter.castToBool(new BN(1).toSM({
        endian: 'little'
      })).should.equal(true);
      Interpreter.castToBool(new BN(-1).toSM({
        endian: 'little'
      })).should.equal(true);

      var buf = Buffer.from('00', 'hex');
      var bool = BN.fromSM(buf, {
        endian: 'little'
      }).cmp(BN.Zero) !== 0;
      Interpreter.castToBool(buf).should.equal(bool);
    });

  });

  describe('#verify', function() {

    it('should verify these trivial scripts', function() {
      var verified;
      var si = Interpreter();
      verified = si.verify(Script('OP_1'), Script('OP_1'));
      verified.should.equal(true);
      verified = Interpreter().verify(Script('OP_1'), Script('OP_0'));
      verified.should.equal(false);
      verified = Interpreter().verify(Script('OP_0'), Script('OP_1'));
      verified.should.equal(true);
      verified = Interpreter().verify(Script('OP_CODESEPARATOR'), Script('OP_1'));
      verified.should.equal(true);
      verified = Interpreter().verify(Script(''), Script('OP_DEPTH OP_0 OP_EQUAL'));
      verified.should.equal(true);
      verified = Interpreter().verify(Script('OP_1 OP_2'), Script('OP_2 OP_EQUALVERIFY OP_1 OP_EQUAL'));
      verified.should.equal(true);
      verified = Interpreter().verify(Script('9 0x000000000000000010'), Script(''));
      verified.should.equal(true);
      verified = Interpreter().verify(Script('OP_1'), Script('OP_15 OP_ADD OP_16 OP_EQUAL'));
      verified.should.equal(true);
      verified = Interpreter().verify(Script('OP_0'), Script('OP_IF OP_VER OP_ELSE OP_1 OP_ENDIF'));
      verified.should.equal(true);
    });

    it('should verify these simple transaction', function() {
      // first we create a transaction
      var privateKey = new PrivateKey('cSBnVM4xvxarwGQuAfQFwqDg9k5tErHUHzgWsEfD4zdwUasvqRVY');
      var publicKey = privateKey.publicKey;
      var fromAddress = publicKey.toAddress();
      var toAddress = 'mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc';
      var scriptPubkey = Script.buildPublicKeyHashOut(fromAddress);
      var utxo = {
        address: fromAddress,
        txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
        outputIndex: 0,
        script: scriptPubkey,
        satoshis: 100000
      };
      var tx = new Transaction()
        .from(utxo)
        .to(toAddress, 100000)
        .sign(privateKey, 1);

      // we then extract the signature from the first input
      var inputIndex = 0;
      var signature = tx.getSignatures(privateKey, 1)[inputIndex].signature;

      var scriptSig = Script.buildPublicKeyHashIn(publicKey, signature);
      var flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_STRICTENC;
      var verified = Interpreter().verify(scriptSig, scriptPubkey, tx, inputIndex, flags);

      verified.should.equal(true);
    });
  });


  var getFlags = function getFlags(flagstr) {
    var flags = 0;
    if (flagstr.indexOf('NONE') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_NONE;
    }
    if (flagstr.indexOf('P2SH') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_P2SH;
    }
    if (flagstr.indexOf('STRICTENC') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_STRICTENC;
    }
    if (flagstr.indexOf('DERSIG') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_DERSIG;
    }
    if (flagstr.indexOf('LOW_S') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_LOW_S;
    }
    if (flagstr.indexOf('NULLDUMMY') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_NULLDUMMY;
    }
    if (flagstr.indexOf('SIGPUSHONLY') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_SIGPUSHONLY;
    }
    if (flagstr.indexOf('MINIMALDATA') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_MINIMALDATA;
    }
    if (flagstr.indexOf('DISCOURAGE_UPGRADABLE_NOPS') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS;
    }
    if (flagstr.indexOf('CHECKLOCKTIMEVERIFY') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY;
    }
    if (flagstr.indexOf('CHECKSEQUENCEVERIFY') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY;
    }
    if (flagstr.indexOf('NULLFAIL') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_NULLFAIL;
    }

    if (flagstr.indexOf('CLEANSTACK') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_CLEANSTACK;
    }

    if(flagstr.indexOf('DISALLOW_SEGWIT_RECOVERY') !== -1) {
      flags = flags | Interpreter.SCRIPT_DISALLOW_SEGWIT_RECOVERY;
    }

    if (flagstr.indexOf('FORKID') !== -1) {
      flags = flags | Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID;
    }

    if (flagstr.indexOf('REPLAY_PROTECTION') !== -1) {
      flags = flags | Interpreter.SCRIPT_ENABLE_REPLAY_PROTECTION;
    }

    if (flagstr.indexOf('CHECKDATASIG') !== -1) {
      flags = flags | Interpreter.SCRIPT_ENABLE_CHECKDATASIG;
    }

    if (flagstr.indexOf('SCHNORR_MULTISIG') !== -1) {
      flags = flags | Interpreter.SCRIPT_ENABLE_SCHNORR_MULTISIG;
    }

    if (flagstr.indexOf('MINIMALIF') !== -1) {
      flags = flags | Interpreter.SCRIPT_VERIFY_MINIMALIF;
    }
    return flags;
  };


  var testToFromString = function(script) {
    var s = script.toString();
    Script.fromString(s).toString().should.equal(s);
  };

  var testFixture = function(vector, expected, extraData) {
  
    var scriptSig = Script.fromBitcoindString(vector[0]);
    var scriptPubkey = Script.fromBitcoindString(vector[1]);
    var flags = getFlags(vector[2]);
    var inputAmount = 0;
    if (extraData) {
      inputAmount = extraData[0] * 1e8;
    }

    var hashbuf = Buffer.alloc(32);
    hashbuf.fill(0);
    var credtx = new Transaction();
    credtx.setVersion(1);
    credtx.uncheckedAddInput(new Transaction.Input({
      prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
      outputIndex: 0xffffffff,
      sequenceNumber: 0xffffffff,
      script: Script('OP_0 OP_0')
    }));
    credtx.addOutput(new Transaction.Output({
      script: scriptPubkey,
      satoshis: inputAmount, 
    }));
    var idbuf = credtx.id;

    var spendtx = new Transaction();
    spendtx.setVersion(1);
    spendtx.uncheckedAddInput(new Transaction.Input({
      prevTxId: idbuf.toString('hex'),
      outputIndex: 0,
      sequenceNumber: 0xffffffff,
      script: scriptSig
    }));
    spendtx.addOutput(new Transaction.Output({
      script: new Script(),
      satoshis: inputAmount,
    }));

    var interp = new Interpreter();
    var verified = interp.verify(scriptSig, scriptPubkey, spendtx, 0, flags, new BN(inputAmount));
    verified.should.equal(expected);
  };
  describe('bitcoind script evaluation fixtures', function() {
    var testAllFixtures = function(set) {
      var c = 0; var l = set.length;
      set.forEach(function(vector) {
        if (vector.length === 1) {
          return;
        }
        c++;

        var extraData;
        if (_.isArray (vector[0])) {
          extraData = vector.shift();
        }

        var fullScriptString = vector[0] + ' ' + vector[1];
        var expected = vector[3] == 'OK';
        var descstr = vector[4];
        var comment = descstr ? (' (' + descstr + ')') : '';
        var txt = 'should ' +( vector[3] == 'OK' ? 'PASS' : 'FAIL') + ' script_tests ' +
            'vector #' + c + '/ ' + l + ': ' + fullScriptString + comment;

        it(txt, function() { testFixture(vector, expected, extraData); });

      });
    };
    testAllFixtures(script_tests);

  });
  describe('bitcoind transaction evaluation fixtures', function() {
    var test_txs = function(set, expected) {
      var c = 0;
      set.forEach(function(vector) {
        if (vector.length === 1) {
          return;
        }
        c++;
        var cc = c; //copy to local
        it('should pass tx_' + (expected ? '' : 'in') + 'valid vector ' + cc, function() {
          var inputs = vector[0];
          var txhex = vector[1];

          var flags = getFlags(vector[2]);
          var map = {};
          inputs.forEach(function(input) {
            var txid = input[0];
            var txoutnum = input[1];
            var scriptPubKeyStr = input[2];
            if (txoutnum === -1) {
              txoutnum = 0xffffffff; //bitcoind casts -1 to an unsigned int
            }
            map[txid + ':' + txoutnum] = Script.fromBitcoindString(scriptPubKeyStr);
          });

          var tx = new Transaction(txhex);
          tx.setVersion(1);
          var allInputsVerified = true;
          tx.inputs.forEach(function(txin, j) {
            if (txin.isNull()) {
              return;
            }
            var scriptSig = txin.script;
            var txidhex = txin.prevTxId.toString('hex');
            var txoutnum = txin.outputIndex;
            var scriptPubkey = map[txidhex + ':' + txoutnum];
            should.exist(scriptPubkey);
            (scriptSig !== undefined).should.equal(true);
            var interp = new Interpreter();
            var verified = interp.verify(scriptSig, scriptPubkey, tx, j, flags);
            if (!verified) {
              allInputsVerified = false;
            }
          });
          var txVerified = tx.verify();
          txVerified = (txVerified === true) ? true : false;
          allInputsVerified = allInputsVerified && txVerified;

          allInputsVerified.should.equal(expected);

        });
      });
    };
    test_txs(tx_valid, true);
    test_txs(tx_invalid, false);

  });

});
