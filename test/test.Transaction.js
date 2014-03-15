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


  it('#_selectUnspent should be able to select utxos', function() {
    var u = Transaction._selectUnspent(testdata.dataUnspends,1.0);
    u.length.should.equal(3);
    u = Transaction._selectUnspent(testdata.dataUnspends,0.5);
    u.length.should.equal(3);
    u = Transaction._selectUnspent(testdata.dataUnspends,0.1);
    u.length.should.equal(2);
    u = Transaction._selectUnspent(testdata.dataUnspends,0.05);
    u.length.should.equal(2);
    u = Transaction._selectUnspent(testdata.dataUnspends,0.015);
    u.length.should.equal(2);
    u = Transaction._selectUnspent(testdata.dataUnspends,0.01);
    u.length.should.equal(1);
    should.exist(u[0].amount);
    should.exist(u[0].txid);
    should.exist(u[0].scriptPubKey);
    should.exist(u[0].vout);
  });

  it('#selectUnspent should return null if not enough utxos', function() {
    var u = Transaction.selectUnspent(testdata.dataUnspends,1.12);
    u.length.should.equal(0);
  });


  it('#selectUnspent should check confirmations', function() {
    var u = Transaction.selectUnspent(testdata.dataUnspends,0.9);
    u.length.should.equal(0);
    var u = Transaction.selectUnspent(testdata.dataUnspends,0.9,true);
    u.length.should.equal(3);

    var u = Transaction.selectUnspent(testdata.dataUnspends,0.11);
    u.length.should.equal(2);
    var u = Transaction.selectUnspent(testdata.dataUnspends,0.111);
    u.length.should.equal(0);
  });


  var opts = {remainderAddress: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'};
  it('#create should be able to create instance', function() {
    var utxos = Transaction.selectUnspent(testdata.dataUnspends,0.1);
    var outs = [{address:'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE', amount:0.08}];
    var tx = Transaction.create(utxos, outs, opts);
    should.exist(tx);

    tx.version.should.equal(1);
    tx.ins.length.should.equal(2);
    tx.outs.length.should.equal(2);
    util.valueToBigInt(tx.outs[0].v).cmp(8000000).should.equal(0);
    // remainder is 0.0299 here because unspend select utxos in order
    util.valueToBigInt(tx.outs[1].v).cmp(2990000).should.equal(0);
  });


  it('#create should fail if not enough inputs ', function() {
    var utxos = Transaction.selectUnspent(testdata.dataUnspends,1);
    var outs = [{address:'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE', amount:0.08}];
    Transaction
      .create
      .bind(utxos, outs, opts)
      .should.throw();
  });


  it('#create should create same output as bitcoind createrawtransaction ', function() {
    var utxos = Transaction.selectUnspent(testdata.dataUnspends,0.1);
    var outs = [{address:'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE', amount:0.08}];
    var tx = Transaction.create(utxos, outs, opts); 
    tx.serialize().toString('hex').should.equal('0100000002c1cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0100000000ffffffffc2cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0000000000ffffffff0200127a00000000001976a914774e603bafb717bd3f070e68bbcccfd907c77d1388acb09f2d00000000001976a914b00127584485a7cff0949ef0f6bc5575f06ce00d88ac00000000');

    outs = [{address:'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE', amount:0.08}];
    tx = Transaction.create(utxos, outs, {fee:0.03} ); 
    tx.serialize().toString('hex').should.equal('0100000002c1cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0100000000ffffffffc2cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0000000000ffffffff0100127a00000000001976a914774e603bafb717bd3f070e68bbcccfd907c77d1388ac00000000');

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
