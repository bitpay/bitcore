'use strict';

var should = require('chai').should();
var sinon = require('sinon');
var bitcore = require('../..');
var Interpreter = bitcore.Script.Interpreter;
var Transaction = bitcore.Transaction;
var PrivateKey = bitcore.PrivateKey;
var Script = bitcore.Script;
var BN = bitcore.crypto.BN;
var BufferWriter = bitcore.encoding.BufferWriter;
var BufferReader = bitcore.encoding.BufferReader;
var Opcode = bitcore.Opcode;
var _ = require('lodash');

var script_tests = require('../data/bitcoind/script_tests');
const script_asset_tests = require('../data/bitcoind/script_assets_test.json');
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

  describe('#verifyWitnessProgram', function() {
    it('will return true if witness program greater than 0', function() {
      var si = Interpreter();
      var version = 1;
      var program = Buffer.from('bcbd1db07ce89d1f4050645c26c90ce78b67eff78460002a4d5c10410958e064', 'hex');
      var witness = [Buffer.from('bda0eeeb166c8bfeaee88dedc8efa82d3bea35aac5be253902f59d52908bfe25', 'hex')];
      var satoshis = 1;
      var flags = 0;
      si.verifyWitnessProgram(version, program, witness, satoshis, flags).should.equal(true);
    });
    it('will return false with error if witness length is 0', function() {
      var si = Interpreter();
      var version = 0;
      var program = Buffer.from('bcbd1db07ce89d1f4050645c26c90ce78b67eff78460002a4d5c10410958e064', 'hex');
      var witness = [];
      var satoshis = 1;
      var flags = 0;
      si.verifyWitnessProgram(version, program, witness, satoshis, flags).should.equal(false);
      si.errstr.should.equal('SCRIPT_ERR_WITNESS_PROGRAM_WITNESS_EMPTY');
    });
    it('will return false if program hash mismatch (version 0, 32 byte program)', function() {
      var si = Interpreter();
      var version = 0;
      var program = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
      var witness = [
         Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
      ];
      var satoshis = 1;
      var flags = 0;
      si.verifyWitnessProgram(version, program, witness, satoshis, flags).should.equal(false);
      si.errstr.should.equal('SCRIPT_ERR_WITNESS_PROGRAM_MISMATCH');
    });
    it('will return false if witness stack doesn\'t have two items (version 0, 20 byte program)', function() {
      var si = Interpreter();
      var version = 0;
      var program = Buffer.from('b8bcb07f6344b42ab04250c86a6e8b75d3fdbbc6', 'hex');
      var witness = [
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
      ];
      var satoshis = 1;
      var flags = 0;
      si.verifyWitnessProgram(version, program, witness, satoshis, flags).should.equal(false);
      si.errstr.should.equal('SCRIPT_ERR_WITNESS_PROGRAM_MISMATCH');
    });
    it('will return false if program wrong length for version 0', function() {
      var si = Interpreter();
      var version = 0;
      var program = Buffer.from('b8bcb07f6344b42ab04250c86a6e8b75d3', 'hex');
      var witness = [
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
      ];
      var satoshis = 1;
      var flags = 0;
      si.verifyWitnessProgram(version, program, witness, satoshis, flags).should.equal(false);
      si.errstr.should.equal('SCRIPT_ERR_WITNESS_PROGRAM_WRONG_LENGTH');
    });
    it('will return false with discourage upgradable witness program', function() {
      var si = Interpreter();
      var version = 1;
      var program = Buffer.from('b8bcb07f6344b42ab04250c86a6e8b75d3fdbbc6', 'hex');
      var witness = [
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
      ];
      var satoshis = 1;
      var flags = Interpreter.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_WITNESS_PROGRAM;
      si.verifyWitnessProgram(version, program, witness, satoshis, flags).should.equal(false);
      si.errstr.should.equal('SCRIPT_ERR_DISCOURAGE_UPGRADABLE_WITNESS_PROGRAM');
    });
    it('will return false with error if stack doesn\'t have exactly one item', function() {
      var si = Interpreter();
      si.evaluate = sinon.stub().returns(true);
      var version = 0;
      var program = Buffer.from('b8bcb07f6344b42ab04250c86a6e8b75d3fdbbc6', 'hex');
      var witness = [
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
      ];
      var satoshis = 1;
      var flags = 0;
      si.verifyWitnessProgram(version, program, witness, satoshis, flags).should.equal(false);
      si.errstr.should.equal('SCRIPT_ERR_EVAL_FALSE');
    });
    it('will return false if last item in stack casts to false', function() {
      var si = Interpreter();
      si.evaluate = function() {
        si.stack = [Buffer.from('00', 'hex')];
        return true;
      };
      var version = 0;
      var program = Buffer.from('b8bcb07f6344b42ab04250c86a6e8b75d3fdbbc6', 'hex');
      var witness = [
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
      ];
      var satoshis = 1;
      var flags = 0;
      si.verifyWitnessProgram(version, program, witness, satoshis, flags).should.equal(false);
      si.errstr.should.equal('SCRIPT_ERR_EVAL_FALSE_IN_STACK');
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
        .sign(privateKey);

      // we then extract the signature from the first input
      var inputIndex = 0;
      var signature = tx.getSignatures(privateKey)[inputIndex].signature;

      var scriptSig = Script.buildPublicKeyHashIn(publicKey, signature);
      var flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_STRICTENC;
      var verified = Interpreter().verify(scriptSig, scriptPubkey, tx, inputIndex, flags);
      verified.should.equal(true);
    });
  });

  const FLAG_MAP = {
    NONE: Interpreter.SCRIPT_VERIFY_NONE,
    P2SH: Interpreter.SCRIPT_VERIFY_P2SH,
    STRICTENC: Interpreter.SCRIPT_VERIFY_STRICTENC,
    DERSIG: Interpreter.SCRIPT_VERIFY_DERSIG,
    LOW_S: Interpreter.SCRIPT_VERIFY_LOW_S,
    SIGPUSHONLY: Interpreter.SCRIPT_VERIFY_SIGPUSHONLY,
    MINIMALDATA: Interpreter.SCRIPT_VERIFY_MINIMALDATA,
    NULLDUMMY: Interpreter.SCRIPT_VERIFY_NULLDUMMY,
    DISCOURAGE_UPGRADABLE_NOPS: Interpreter.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS,
    CLEANSTACK: Interpreter.SCRIPT_VERIFY_CLEANSTACK,
    MINIMALIF: Interpreter.SCRIPT_VERIFY_MINIMALIF,
    NULLFAIL: Interpreter.SCRIPT_VERIFY_NULLFAIL,
    CHECKLOCKTIMEVERIFY: Interpreter.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY,
    CHECKSEQUENCEVERIFY: Interpreter.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY,
    WITNESS: Interpreter.SCRIPT_VERIFY_WITNESS,
    DISCOURAGE_UPGRADABLE_WITNESS_PROGRAM: Interpreter.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_WITNESS_PROGRAM,
    // DISCOURAGE_UPGRADABLE_WITNESS: Interpreter.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_WITNESS_PROGRAM,
    WITNESS_PUBKEYTYPE: Interpreter.SCRIPT_VERIFY_WITNESS_PUBKEYTYPE,
    CONST_SCRIPTCODE: Interpreter.SCRIPT_VERIFY_CONST_SCRIPTCODE,
    TAPROOT: Interpreter.SCRIPT_VERIFY_TAPROOT,
    DISCOURAGE_UPGRADABLE_PUBKEYTYPE: Interpreter.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_PUBKEYTYPE,
    DISCOURAGE_OP_SUCCESS: Interpreter.SCRIPT_VERIFY_DISCOURAGE_OP_SUCCESS,
    DISCOURAGE_UPGRADABLE_TAPROOT_VERSION: Interpreter.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_TAPROOT_VERSION,
  };

  var getFlags = function getFlags(flagstr) {
    var flags = 0;
    
    for (let flag of flagstr.split(',')) {
      flag = flag.trim();
      if (FLAG_MAP[flag] === undefined) {
        throw new Error('Unknown flag: ' + flag);
      }
      flags |= FLAG_MAP[flag];
    }
    return flags;
  };

  var testFixture = function(vector, expected, witness, amount) {
    var amount = amount || 0;
    var scriptSig = Script.fromBitcoindString(vector[0]);
    var scriptPubkey = Script.fromBitcoindString(vector[1]);
    var flags = getFlags(vector[2]);

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
      satoshis: amount,
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
      satoshis: amount,
    }));


    var interp = new Interpreter();
    var verified = interp.verify(scriptSig, scriptPubkey, spendtx, 0, flags, witness, amount);
    verified.should.equal(expected);
  };
  describe('bitcoind script evaluation fixtures', function() {

    var testAllFixtures = function(set) {
      var c = 0;
      set.forEach(function(vector) {
        if (vector.length === 1) {
          return;
        }
        c++;

        var witness, amount;
        if (_.isArray(vector[0])) {
          var extra = vector.shift();
          amount = extra.pop()  * 1e8;
          witness = extra.map(function(x) { 
            return Buffer.from(x,'hex');
          });
        } else {
          return;
        }

        var fullScriptString = vector[0] + ' ' + vector[1];
        var expected = vector[3] == 'OK';
        var descstr = vector[4];

        var comment = descstr ? (' (' + descstr + ')') : '';
        it('should ' + vector[3] + ' script_tests ' +
          'vector #' + c + ': ' + fullScriptString + comment,
          function() {
            testFixture(vector, expected, witness, amount);
          });
      });
    };
    testAllFixtures(script_tests);

  });
  describe('bitcoind transaction evaluation fixtures', function() {
    var test_txs = function(set, expected) {
      var c = 0;
      for (const vector of set) {
        if (vector.length === 1) {
          continue;
        }
        c++;
        var cc = c; //copy to local
        it('should pass tx_' + (expected ? '' : 'in') + 'valid vector ' + cc, function() {
          var inputs = vector[0];
          var txhex = vector[1];

          var flags = getFlags(vector[2]);
          var map = {};
          for (let input of inputs) {
            var txid = input[0];
            var txoutnum = input[1];
            var scriptPubKeyStr = input[2];
            if (txoutnum === -1) {
              txoutnum = 0xffffffff; //bitcoind casts -1 to an unsigned int
            }
            map[txid + ':' + txoutnum] = Script.fromBitcoindString(scriptPubKeyStr);
          };

          var tx = new Transaction(txhex);
          var allInputsVerified = true;
          for (let j in tx.inputs) {
            const txin = tx.inputs[j];
            if (txin.isNull()) {
              continue;
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
          }
          var txVerified = tx.verify();
          txVerified = (txVerified === true) ? true : false;
          allInputsVerified = allInputsVerified && txVerified;
          allInputsVerified.should.equal(expected);
        });
      }
    };
    test_txs(tx_valid, true);
    test_txs(tx_invalid, false);

  });


  const allConsensusFlags = function() {
    const ret = [];
    for (let i = 0; i < 128; ++i) {
      let flag = 0;
      if (i & 1) flag |= Interpreter.SCRIPT_VERIFY_P2SH;
      if (i & 2) flag |= Interpreter.SCRIPT_VERIFY_DERSIG;
      if (i & 4) flag |= Interpreter.SCRIPT_VERIFY_NULLDUMMY;
      if (i & 8) flag |= Interpreter.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY;
      if (i & 16) flag |= Interpreter.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY;
      if (i & 32) flag |= Interpreter.SCRIPT_VERIFY_WITNESS;
      if (i & 64) flag |= Interpreter.SCRIPT_VERIFY_TAPROOT;

      // SCRIPT_VERIFY_WITNESS requires SCRIPT_VERIFY_P2SH
      if (flag & Interpreter.SCRIPT_VERIFY_WITNESS && !(flag & Interpreter.SCRIPT_VERIFY_P2SH)) continue;
      // SCRIPT_VERIFY_TAPROOT requires SCRIPT_VERIFY_WITNESS
      if (flag & Interpreter.SCRIPT_VERIFY_TAPROOT && !(flag & Interpreter.SCRIPT_VERIFY_WITNESS)) continue;

      ret.push(flag);
    }

    return ret;
  }

  describe('bitcoind script asset tests', function() {
    this.timeout(60000); // Some tests run a little long

    for (let i = 0; i < script_asset_tests.length; i++) {
      let test = script_asset_tests[i];
      it(`script asset test vector ${i}: ${test.comment}`, function() {
        const tx =  new Transaction(test.tx);
        const prevOuts = [];
        for (let j in test.prevouts) {
          let prevout = test.prevouts[j];
          const poBuffReader = new BufferReader(Buffer.from(prevout,'hex'));
          prevout = Transaction.Output.fromBufferReader(poBuffReader);
          
          const utxo = new Transaction.UnspentOutput({
            satoshis: prevout.satoshis,
            address: prevout.script.toAddress(),
            txid: tx.inputs[j].prevTxId.toString('hex'),
            outputIndex: tx.inputs[j].outputIndex,
            scriptPubKey: prevout.script,
            sequenceNumber: tx.inputs[j].sequenceNumber
          });
          prevOuts.push(utxo);
        }
        tx.inputs.length.should.equal(prevOuts.length);
        tx.associateInputs(prevOuts);
        const idx = test.index;
        const testFlags = getFlags(test.flags);
        const fin = !!test.final;

        if (test.success) {
          tx.inputs[idx].setScript(test.success.scriptSig);
          tx.inputs[idx].setWitnesses(test.success.witness);
          for (let flags of [testFlags]) { // allConsensusFlags() takes too long for the javascript implementation. Keeping the logic here for anyone who wants to run with allConsensusFlags
            if (fin || (flags & testFlags) == flags) {
              const witness = tx.inputs[idx].witnesses.map(w => Buffer.from(w, 'hex'));
              const interp = new Interpreter();
              const ret = interp.verify(tx.inputs[idx].script, prevOuts[idx].script, tx, idx, flags, witness, tx.inputs[idx].satoshis);
              ret.should.be.true;
            }
          }
        }

        if (test.failure) {
          tx.inputs[idx].setScript(test.failure.scriptSig);
          tx.inputs[idx].setWitnesses(test.failure.witness);

          for (let flags of allConsensusFlags()) {
            // If a test is supposed to fail with testFlags, it should also fail with any superset thereof.
            if ((flags & testFlags) === testFlags) {
              const witness = tx.inputs[idx].witnesses.map(w => Buffer.from(w, 'hex'));
              const interp = new Interpreter();
              const ret = interp.verify(tx.inputs[idx].script, prevOuts[idx].script, tx, idx, flags, witness, tx.inputs[idx].satoshis);
              ret.should.be.false;
            }
          }
        }
      });
    }
  });
});
