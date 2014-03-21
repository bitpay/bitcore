'use strict';

var chai = chai || require('chai');
chai.Assertion.includeStack = true;
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var Transaction = bitcore.Transaction;
var In;
var Out;
var Script = bitcore.Script;
var util = bitcore.util;
var buffertools = require('buffertools');
var testdata = testdata || require('./testdata');

// Read tests from test/data/tx_valid.json and tx_invalid.json
// Format is an array of arrays
// Inner arrays are either [ "comment" ]
// or [[[prevout hash, prevout index, prevout scriptPubKey], [input 2], ...],"], serializedTransaction, enforceP2SH
// ... where all scripts are stringified scripts.
// Returns an object with the Transaction object, and an array of input objects
function parse_test_transaction(entry) {
  // Ignore comments
  if (entry.length !== 3) return;

  var inputs = {};
  entry[0].forEach(function(vin) {
    var hash = (vin[0]);
    var index = vin[1];
    var scriptPubKey = Script.fromHumanReadable(vin[2]);

    var mapKey = [hash, index];
    inputs[mapKey] = scriptPubKey;

  });

  var raw = new Buffer(entry[1], 'hex');
  var tx = new Transaction();
  tx.parse(raw);

  // Sanity check transaction has been parsed correctly
  buffertools.toHex(tx.serialize()).should.equal(buffertools.toHex(raw));
  return {
    'transaction': tx,
    'inputs': inputs
  };
}

describe('Transaction', function() {
  it('should initialze the main object', function() {
    should.exist(Transaction);
    In = Transaction.In;
    Out = Transaction.Out;
    should.exist(In);
    should.exist(Out);
  });


  it('should be able to create instance', function() {
    var t = new Transaction();
    should.exist(t);
  });


  it('#selectUnspent should be able to select utxos', function() {
    var u = Transaction.selectUnspent(testdata.dataUnspent, 1.0, true);
    u.length.should.equal(3);

    should.exist(u[0].amount);
    should.exist(u[0].txid);
    should.exist(u[0].scriptPubKey);
    should.exist(u[0].vout);

    u = Transaction.selectUnspent(testdata.dataUnspent, 0.5, true);
    u.length.should.equal(3);

    u = Transaction.selectUnspent(testdata.dataUnspent, 0.1, true);
    u.length.should.equal(2);

    u = Transaction.selectUnspent(testdata.dataUnspent, 0.05, true);
    u.length.should.equal(2);

    u = Transaction.selectUnspent(testdata.dataUnspent, 0.015, true);
    u.length.should.equal(2);

    u = Transaction.selectUnspent(testdata.dataUnspent, 0.01, true);
    u.length.should.equal(1);
  });

  it('#selectUnspent should return null if not enough utxos', function() {
    var u = Transaction.selectUnspent(testdata.dataUnspent, 1.12);
    should.not.exist(u);
  });


  it('#selectUnspent should check confirmations', function() {
    var u = Transaction.selectUnspent(testdata.dataUnspent, 0.9);
    should.not.exist(u);
    u = Transaction.selectUnspent(testdata.dataUnspent, 0.9, true);
    u.length.should.equal(3);

    u = Transaction.selectUnspent(testdata.dataUnspent, 0.11);
    u.length.should.equal(2);
    u = Transaction.selectUnspent(testdata.dataUnspent, 0.111);
    should.not.exist(u);
  });


  var opts = {
    remainderAddress: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd',
    allowUnconfirmed: true,
  };

  it('#create should be able to create instance', function() {
    var utxos = testdata.dataUnspent;
    var outs = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];

    var ret = Transaction.create(utxos, outs, opts);
    should.exist(ret.tx);
    should.exist(ret.selectedUtxos);
    ret.selectedUtxos.length.should.equal(2);

    var tx = ret.tx;

    tx.version.should.equal(1);
    tx.ins.length.should.equal(2);
    tx.outs.length.should.equal(2);

    util.valueToBigInt(tx.outs[0].v).cmp(8000000).should.equal(0);

    // remainder is 0.0299 here because unspent select utxos in order
    util.valueToBigInt(tx.outs[1].v).cmp(2990000).should.equal(0);
    tx.isComplete().should.equal(false);
  });

  it('#create should fail if not enough inputs ', function() {
    var utxos = testdata.dataUnspent;
    var outs = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 80
    }];
    Transaction
      .create
      .bind(utxos, outs, opts)
      .should.
    throw ();

    var outs2 = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.5
    }];
    should.exist(Transaction.create(utxos, outs2, opts));

    // do not allow unconfirmed
    Transaction.create.bind(utxos, outs2).should.
    throw ();
  });


  it('#create should create same output as bitcoind createrawtransaction ', function() {
    var utxos = testdata.dataUnspent;
    var outs = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
    var ret = Transaction.create(utxos, outs, opts);
    var tx = ret.tx;

    // string output generated from: bitcoind createrawtransaction '[{"txid": "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1","vout":1},{"txid":"2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc2","vout":0}  ]' '{"mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE":0.08,"mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd":0.0299}'
    tx.serialize().toString('hex').should.equal('0100000002c1cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0100000000ffffffffc2cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0000000000ffffffff0200127a00000000001976a914774e603bafb717bd3f070e68bbcccfd907c77d1388acb09f2d00000000001976a914b00127584485a7cff0949ef0f6bc5575f06ce00d88ac00000000');

  });

  it('#create should create same output as bitcoind createrawtransaction wo remainder', function() {
    var utxos = testdata.dataUnspent;
    // no remainder
    var outs = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
    var ret = Transaction.create(utxos, outs, {
      fee: 0.03
    });
    var tx = ret.tx;

    // string output generated from: bitcoind createrawtransaction '[{"txid": "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1","vout":1},{"txid":"2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc2","vout":0}  ]' '{"mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE":0.08}'
    //
    tx.serialize().toString('hex').should.equal('0100000002c1cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0100000000ffffffffc2cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0000000000ffffffff0100127a00000000001976a914774e603bafb717bd3f070e68bbcccfd907c77d1388ac00000000');
  });

  it('#createAndSign should sign a tx', function() {
    var utxos = testdata.dataUnspentSign.unspent;
    var outs = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
    var ret = Transaction.createAndSign(utxos, outs, testdata.dataUnspentSign.keyStrings, opts);
    var tx = ret.tx;
    tx.isComplete().should.equal(true);
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);

    var outs2 = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 16
    }];
    var ret2 = Transaction.createAndSign(utxos, outs2, testdata.dataUnspentSign.keyStrings, opts);
    var tx2 = ret2.tx;
    tx2.isComplete().should.equal(true);
    tx2.ins.length.should.equal(3);
    tx2.outs.length.should.equal(2);
  });

  it('#createAndSign should sign an incomplete tx ', function() {
    var keys = ['cNpW8B7XPAzCdRR9RBWxZeveSNy3meXgHD8GuhcqUyDuy8ptCDzJ'];
    var utxos = testdata.dataUnspentSign.unspent;
    var outs = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
    var ret = Transaction.createAndSign(utxos, outs, keys, opts);
    var tx = ret.tx;
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);
  });
  it('#isComplete should return TX signature status', function() {
    var keys = ['cNpW8B7XPAzCdRR9RBWxZeveSNy3meXgHD8GuhcqUyDuy8ptCDzJ'];
    var utxos = testdata.dataUnspentSign.unspent;
    var outs = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
    var ret = Transaction.createAndSign(utxos, outs, keys, opts);
    var tx = ret.tx;
    tx.isComplete().should.equal(false);
    tx.sign(ret.selectedUtxos, testdata.dataUnspentSign.keyStrings);
    tx.isComplete().should.equal(true);
  });

  it('#sign should sign a tx in multiple steps (case1)', function() {
    var outs = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 1.08
    }];
    var ret = Transaction.create(testdata.dataUnspentSign.unspent, outs, opts);
    var tx = ret.tx;
    var selectedUtxos = ret.selectedUtxos;

    var k1 = testdata.dataUnspentSign.keyStrings.slice(0, 1);

    tx.isComplete().should.equal(false);

    tx.sign(selectedUtxos, k1).should.equal(false);

    var k23 = testdata.dataUnspentSign.keyStrings.slice(1, 3);
    tx.sign(selectedUtxos, k23).should.equal(true);
    tx.isComplete().should.equal(true);
  });

  it('#sign should sign a tx in multiple steps (case2)', function() {
    var outs = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 16
    }];
    var ret = Transaction.create(testdata.dataUnspentSign.unspent, outs, opts);
    var tx = ret.tx;
    var selectedUtxos = ret.selectedUtxos;

    var k1 = testdata.dataUnspentSign.keyStrings.slice(0, 1);
    var k2 = testdata.dataUnspentSign.keyStrings.slice(1, 2);
    var k3 = testdata.dataUnspentSign.keyStrings.slice(2, 3);
    tx.sign(selectedUtxos, k1).should.equal(false);
    tx.sign(selectedUtxos, k2).should.equal(false);
    tx.sign(selectedUtxos, k3).should.equal(true);

  });

  it('#createAndSign: should generate dynamic fee and readjust (and not) the selected UTXOs', function() {
    //this cases exceeds the input by 1mbtc AFTEr calculating the dynamic fee,
    //so, it should trigger adding a new 10BTC utxo
    var utxos = testdata.dataUnspentSign.unspent;
    var outs = [];
    var n = 101;
    for (var i = 0; i < n; i++) {
      outs.push({
        address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
        amount: 0.01
      });
    }

    var ret = Transaction.createAndSign(utxos, outs, testdata.dataUnspentSign.keyStrings, opts);
    var tx = ret.tx;
    tx.getSize().should.equal(3560);

    // ins = 11.0101 BTC (2 inputs: 1.0101 + 10 );
    tx.ins.length.should.equal(2);
    // outs = 101 outs:
    // 101 * 0.01 = 1.01BTC; + 0.0004 fee = 1.0104btc
    // remainder = 11.0101-1.0104 = 9.9997
    tx.outs.length.should.equal(102);
    util.valueToBigInt(tx.outs[n].v).cmp(999970000).should.equal(0);
    tx.isComplete().should.equal(true);


    //this is the complementary case, it does not trigger a new utxo
    utxos = testdata.dataUnspentSign.unspent;
    outs = [];
    n = 100;
    for (i = 0; i < n; i++) {
      outs.push({
        address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
        amount: 0.01
      });
    }

    ret = Transaction.createAndSign(utxos, outs, testdata.dataUnspentSign.keyStrings, opts);
    tx = ret.tx;
    tx.getSize().should.equal(3485);

    // ins = 1.0101 BTC (1 inputs: 1.0101);
    tx.ins.length.should.equal(1);
    // outs = 100 outs:
    // 100 * 0.01 = 1BTC; + 0.0004 fee = 1.0004btc
    // remainder = 1.0101-1.0004 = 0.0097
    tx.outs.length.should.equal(101);
    util.valueToBigInt(tx.outs[n].v).cmp(970000).should.equal(0);
    tx.isComplete().should.equal(true);
  });




  /*
   * Bitcoin core transaction tests
   */
  // Verify that known valid transactions are intepretted correctly
  var coreTest = function(data, valid) {
    data.forEach(function(datum) {
      if (datum.length < 3) return;
      var raw = datum[1];
      var verifyP2SH = datum[2];

      it.skip((valid ? '' : 'in') + 'valid tx=' + raw, function(done) {
        var cb = function(err, results) {
          should.not.exist(err);
          should.exist(results);
          results.should.equal(valid);
          done();
        };

        var testTx = parse_test_transaction(datum);
        buffertools.toHex(testTx.transaction.serialize()).should.equal(raw);
        var inputs = testTx.transaction.inputs();
        for (var i = 0; i < inputs.length; i++) {
          var input = inputs[i];
          buffertools.reverse(input[0]);
          input[0] = buffertools.toHex(input[0]);
          var mapKey = [input];
          var scriptPubKey = testTx.inputs[mapKey];
          if (!scriptPubKey) throw new Error('Bad test: '+datum);
          testTx.transaction.verifyInput(
            i,
            scriptPubKey, {
              verifyP2SH: verifyP2SH,
              dontVerifyStrictEnc: true
            },
            cb);
        }
      });
    });
  };

  coreTest(testdata.dataTxValid, true);
  coreTest(testdata.dataTxInvalid, false);

});
