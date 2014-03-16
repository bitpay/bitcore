'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var TransactionModule = bitcore.Transaction;
var Transaction;
var In;
var Out;
var Script = bitcore.Script;
var util = bitcore.util;
var buffertools = require('buffertools');
var testdata = testdata || require('./testdata');

describe('Transaction', function() {
  it('should initialze the main object', function() {
    should.exist(TransactionModule);
  });
  it('should be able to create class', function() {
    Transaction = TransactionModule;
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
    var u = Transaction.selectUnspent(testdata.dataUnspent,1.0, true);
    u.length.should.equal(3);

    should.exist(u[0].amount);
    should.exist(u[0].txid);
    should.exist(u[0].scriptPubKey);
    should.exist(u[0].vout);

    u = Transaction.selectUnspent(testdata.dataUnspent,0.5, true);
    u.length.should.equal(3);

    u = Transaction.selectUnspent(testdata.dataUnspent,0.1, true);
    u.length.should.equal(2);

    u = Transaction.selectUnspent(testdata.dataUnspent,0.05, true);
    u.length.should.equal(2);

    u = Transaction.selectUnspent(testdata.dataUnspent,0.015, true);
    u.length.should.equal(2);

    u = Transaction.selectUnspent(testdata.dataUnspent,0.01, true);
    u.length.should.equal(1);
  });

  it('#selectUnspent should return null if not enough utxos', function() {
    var u = Transaction.selectUnspent(testdata.dataUnspent,1.12);
    should.not.exist(u);
  });


  it('#selectUnspent should check confirmations', function() {
    var u = Transaction.selectUnspent(testdata.dataUnspent,0.9);
    should.not.exist(u);
    var u = Transaction.selectUnspent(testdata.dataUnspent,0.9,true);
    u.length.should.equal(3);

    var u = Transaction.selectUnspent(testdata.dataUnspent,0.11);
    u.length.should.equal(2);
    var u = Transaction.selectUnspent(testdata.dataUnspent,0.111);
    should.not.exist(u);
  });


  var opts = {
    remainderAddress: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd',
    allowUnconfirmed: true,
  };

  it('#create should be able to create instance', function() {
    var utxos =testdata.dataUnspent;
    var outs = [{address:'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE', amount:0.08}];
    var tx = Transaction.create(utxos, outs, null, opts);
    should.exist(tx);

    tx.version.should.equal(1);
    tx.ins.length.should.equal(2);
    tx.outs.length.should.equal(2);

    util.valueToBigInt(tx.outs[0].v).cmp(8000000).should.equal(0);
    // remainder is 0.0299 here because unspent select utxos in order
    util.valueToBigInt(tx.outs[1].v).cmp(2900000).should.equal(0);
    tx.isComplete().should.equal(false);
  });

  it('#create should fail if not enough inputs ', function() {
    var utxos =testdata.dataUnspent;
    var outs = [{address:'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE', amount:80}];
    Transaction
      .create
      .bind(utxos, outs, null, opts)
      .should.throw();
  });


  it('#create should create same output as bitcoind createrawtransaction ', function() {
    var utxos =testdata.dataUnspent;
    var outs = [{address:'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE', amount:0.08}];
    var tx = Transaction.create(utxos, outs, null, opts); 


    // string output generated from: bitcoind createrawtransaction '[{"txid": "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1","vout":1},{"txid":"2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc2","vout":0}  ]' '{"mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE":0.08,"mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd":0.0299}'
    tx.serialize().toString('hex').should.equal('0100000002c1cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0100000000ffffffffc2cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0000000000ffffffff0200127a00000000001976a914774e603bafb717bd3f070e68bbcccfd907c77d1388ac20402c00000000001976a914b00127584485a7cff0949ef0f6bc5575f06ce00d88ac00000000');

    // no remainder
    outs = [{address:'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE', amount:0.08}];
    tx = Transaction.create(utxos, outs, null, {fee:0.03} ); 

    // string output generated from: bitcoind createrawtransaction '[{"txid": "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1","vout":1},{"txid":"2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc2","vout":0}  ]' '{"mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE":0.08}'
    //
    tx.serialize().toString('hex').should.equal('0100000002c1cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0100000000ffffffffc2cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0000000000ffffffff0100127a00000000001976a914774e603bafb717bd3f070e68bbcccfd907c77d1388ac00000000');
  });
 
  it('#sign should sign a tx', function() {
    var utxos =testdata.dataUnspentSign.unspent;
    var outs = [{address:'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE', amount:0.08}];
    var tx = Transaction.create(utxos, outs, testdata.dataUnspentSign.keyStrings, opts); 
    tx.isComplete().should.equal(true);

    var outs2 = [{address:'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE', amount:16}];
    var tx2 = Transaction.create(utxos, outs2, testdata.dataUnspentSign.keyStrings, opts); 
    tx2.isComplete().should.equal(true);
  });

  it('#sign should sign an incomplete tx ', function() {
    var keys = ['cNpW8B7XPAzCdRR9RBWxZeveSNy3meXgHD8GuhcqUyDuy8ptCDzJ'];
    var utxos =testdata.dataUnspentSign.unspent;
    var outs = [{address:'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE', amount:0.08}];
    var tx = Transaction.create(utxos, outs, keys, opts); 
    tx.isComplete().should.equal(false);
  });
  it('#sign should sign a tx in multiple steps', function() {
    var utxos = Transaction.selectUnspent(testdata.dataUnspentSign.unspent,13, true);
    var outs = [{address:'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE', amount:0.08}];

    var tx = Transaction.prepare(utxos, outs, opts); 
    var k1 = testdata.dataUnspentSign.keyStrings.slice(0,1);
    var k23 = testdata.dataUnspentSign.keyStrings.slice(1,3);
    tx.sign(utxos, k1).should.equal(false);
    tx.sign(utxos, k23).should.equal(true);

    var tx2 = Transaction.prepare(utxos, outs, opts); 
    var k1 = testdata.dataUnspentSign.keyStrings.slice(0,1);
    var k2 = testdata.dataUnspentSign.keyStrings.slice(1,2);
    var k3 = testdata.dataUnspentSign.keyStrings.slice(2,3);
    tx2.sign(utxos, k1).should.equal(false);
    tx2.sign(utxos, k2).should.equal(false);
    tx2.sign(utxos, k3).should.equal(true);
 
  });

  // Read tests from test/data/tx_valid.json
  // Format is an array of arrays
  // Inner arrays are either [ "comment" ]
  // or [[[prevout hash, prevout index, prevout scriptPubKey], [input 2], ...],"], serializedTransaction, enforceP2SH
  // ... where all scripts are stringified scripts.
  testdata.dataTxValid.forEach(function(datum) {
    if (datum.length === 3) {
      it.skip('valid tx=' + datum[1], function(done) {
        var inputs = datum[0];
        var map = {};
        inputs.forEach(function(vin) {
          var hash = vin[0];
          var index = vin[1];
          var scriptPubKey = new Script(new Buffer(vin[2]));
          map[[hash, index]] = scriptPubKey; //Script.fromStringContent(scriptPubKey);
          console.log(scriptPubKey.getStringContent());
          console.log('********************************');
          done();

        });
        var raw = new Buffer(datum[1], 'hex');
        var tx = new Transaction();
        tx.parse(raw);

        buffertools.toHex(tx.serialize()).should.equal(buffertools.toHex(raw));

        var i = 0;
        var stx = tx.getStandardizedObject();
        tx.ins.forEach(function(txin) {
          var scriptPubKey = map[[stx. in [i].prev_out.hash, stx. in [i].prev_out.n]];
          i += 1;
        });
      });
    }
  });
});
