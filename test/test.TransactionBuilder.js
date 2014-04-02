'use strict';

var chai = chai || require('chai');
chai.Assertion.includeStack = true;
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var Transaction = bitcore.Transaction;
var TransactionBuilder = bitcore.TransactionBuilder;
var In;
var Out;
var Script = bitcore.Script;
var WalletKey = bitcore.WalletKey;
var util = bitcore.util;
var networks = bitcore.networks;
var buffertools = require('buffertools');
var testdata = testdata || require('./testdata');

describe('TransactionBuilder', function() {
  it('should initialze the main object', function() {
    should.exist(TransactionBuilder);
  });


  it('should be able to create instance', function() {
    var t = new TransactionBuilder();
    should.exist(t);
  });

  it('should be able to create instance with params', function() {
    var t = new TransactionBuilder({spendUnconfirmed: true, lockTime: 10});
    should.exist(t);
    should.exist(t.txobj.version);
    t.spendUnconfirmed.should.equal(true);
    t.txobj.lock_time.should.equal(10);
  });


  var getBuilder = function (spendUnconfirmed) {
    var t = new TransactionBuilder({spendUnconfirmed: spendUnconfirmed})
      .setUnspent(testdata.dataUnspent);

    return t;
  };

  function f(amount, spendUnconfirmed) {
    spendUnconfirmed = typeof spendUnconfirmed === 'undefined'?true:false;
    return getBuilder(spendUnconfirmed)
      ._selectUnspent(amount * util.COIN).selectedUtxos;
  }

  it('#_selectUnspent should be able to select utxos', function() {
    var u = f(1);
    u.length.should.equal(3);

    should.exist(u[0].amount);
    should.exist(u[0].txid);
    should.exist(u[0].scriptPubKey);
    should.exist(u[0].vout);

    f(0.5).length.should.equal(3);
    f(0.1).length.should.equal(2);
    f(0.05).length.should.equal(2);
    f(0.015).length.should.equal(2);
    f(0.001).length.should.equal(1);
  });

  /*jshint -W068 */
  it('#_selectUnspent should return null if not enough utxos', function() {
    (function() { f(1.12); }).should.throw();
  });


  it('#_selectUnspent should check confirmations', function() {
    (function() { f(0.9,false); }).should.throw();
    f(0.9).length.should.equal(3);

    f(0.11,false).length.should.equal(2);
    (function() { f(0.111,false); }).should.throw();
  });



  it('#_setInputs sets inputs', function() {
    var b = getBuilder()
      .setUnspent(testdata.dataUnspent)
      ._selectUnspent(0.1 * util.COIN)
      ._setInputs();

    should.exist(b.txobj.ins[0].s);
    should.exist(b.txobj.ins[0].q);
    should.exist(b.txobj.ins[0].o);
  });

  it('#_setInputMap set inputMap', function() {
    var b = getBuilder()
      .setUnspent(testdata.dataUnspent)
      ._selectUnspent(0.1 * util.COIN)
      ._setInputs()
      ._setInputMap();

    should.exist(b.inputMap);
    b.inputMap.length.should.equal(2);
  });

  var getBuilder2 = function (fee) {
    var opts = {
      remainderOut: {address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'},
      spendUnconfirmed: true,
    };

    if (fee) opts.fee = fee;

    var outs = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];

   return new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspent)
      .setOutputs(outs);
  };


  it('should fail to create tx', function() {

    (function() {
      getBuilder()
        .setUnspent(testdata.dataUnspent)
        .build();
    }).should.throw();
  });

  it('should fail if not enough inputs ', function() {
    var utxos = testdata.dataUnspent;

    var opts = {
      remainderOut: {address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'},
      spendUnconfirmed: true,
    };
    var outs = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 80
    }];

    (function() {
      new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspent)
      .setOutputs(outs);
      }).should.throw();

    var outs2 = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.5
    }];

    should.exist(
      new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspent)
      .setOutputs(outs2)
    );

    // do not allow unconfirmed
    opts.spendUnconfirmed = false;
    (function() {
      new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspent)
      .setOutputs(outs2);
      }).should.throw();
  });

  it('should be able to create a tx', function() {
    var b = getBuilder2();

    b.isFullySigned().should.equal(false);
    b.getSelectedUnspent().length.should.equal(2);

    var tx = b.build();
    should.exist(tx);

    tx.version.should.equal(1);
    tx.ins.length.should.equal(2);
    tx.outs.length.should.equal(2);

    util.valueToBigInt(tx.outs[0].v).cmp(8000000).should.equal(0);

    // remainder is 0.0299 here because unspent select utxos in order
    util.valueToBigInt(tx.outs[1].v).cmp(2990000).should.equal(0);
  });


  it('should create same output as bitcoind createrawtransaction ', function() {
    var tx = getBuilder2().build();

    // string output generated from: bitcoind createrawtransaction '[{"txid": "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1","vout":1},{"txid":"2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc2","vout":0}  ]' '{"mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE":0.08,"mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd":0.0299}'
    tx.serialize().toString('hex').should.equal('0100000002c1cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0100000000ffffffffc2cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0000000000ffffffff0200127a00000000001976a914774e603bafb717bd3f070e68bbcccfd907c77d1388acb09f2d00000000001976a914b00127584485a7cff0949ef0f6bc5575f06ce00d88ac00000000');

  });

  it('should create same output as bitcoind createrawtransaction wo remainder', function() {

    //no remainder
    var tx = getBuilder2(0.03).build();

    // string output generated from: bitcoind createrawtransaction '[{"txid": "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1","vout":1},{"txid":"2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc2","vout":0}  ]' '{"mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE":0.08}'
    //
    tx.serialize().toString('hex').should.equal('0100000002c1cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0100000000ffffffffc2cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0000000000ffffffff0100127a00000000001976a914774e603bafb717bd3f070e68bbcccfd907c77d1388ac00000000');
  });



  var getBuilder3 = function (outs) {

    var opts = {
      remainderOut: {address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'},
      spendUnconfirmed: true,
    };

    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];

   return new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspent)
      .setOutputs(outs);
  };

  it('should sign a tx (case 1)', function() {
    var b = getBuilder3();
    b.isFullySigned().should.equal(false);
      
    b.sign(testdata.dataUnspentSign.keyStrings);
      
    b.isFullySigned().should.equal(true);

    var tx = b.build();
    tx.isComplete().should.equal(true);
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);
  });

  it('should sign a tx (case 2)', function() {
    var b = getBuilder3([{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 16
    }])
      .sign(testdata.dataUnspentSign.keyStrings);

    b.isFullySigned().should.equal(true);
    var tx = b.build();
    tx.isComplete().should.equal(true);
    tx.ins.length.should.equal(3);
    tx.outs.length.should.equal(2);
  });

  it('should sign an incomplete tx', function() {
    var keys = ['cNpW8B7XPAzCdRR9RBWxZeveSNy3meXgHD8GuhcqUyDuy8ptCDzJ'];
    var outs = [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];

   var b = new TransactionBuilder()
      .setUnspent(testdata.dataUnspentSign.unspent)
      .setOutputs(outs)
      .sign(keys);

    b.isFullySigned().should.equal(false);

    var tx = b.build();
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);
    tx.isComplete().should.equal(false);
  });


  it('should sign a tx in multiple steps (case1)', function() {

    var b = getBuilder3([{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 16
    }]);

    b.isFullySigned().should.equal(false);
    (b.build()).isComplete().should.equal(false);

    var k1 = testdata.dataUnspentSign.keyStrings.slice(0, 1);
    b.sign(k1);
    b.isFullySigned().should.equal(false);
    (b.build()).isComplete().should.equal(false);

    var k23 = testdata.dataUnspentSign.keyStrings.slice(1, 3);
    b.sign(k23);
    b.isFullySigned().should.equal(true);
    (b.build()).isComplete().should.equal(true);
  });

  it('#sign should sign a tx in multiple steps (case2)', function() {
    var b = getBuilder3([{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 16
    }]);

    b.isFullySigned().should.equal(false);
    (b.build()).isComplete().should.equal(false);

    var k1 = testdata.dataUnspentSign.keyStrings.slice(0, 1);
    b.sign(k1);
    b.isFullySigned().should.equal(false);
    (b.build()).isComplete().should.equal(false);

    var k2 = testdata.dataUnspentSign.keyStrings.slice(1, 2);
    b.sign(k2);
    b.isFullySigned().should.equal(false);
    (b.build()).isComplete().should.equal(false);

    var k3 = testdata.dataUnspentSign.keyStrings.slice(2, 3);
    b.sign(k3);
    b.isFullySigned().should.equal(true);
    (b.build()).isComplete().should.equal(true);
  });

  it('should generate dynamic fee and readjust (and not) the selected UTXOs (case1)', function() {
    //this cases exceeds the input by 1mbtc AFTEr calculating the dynamic fee,
    //so, it should trigger adding a new 10BTC utxo
    //

    var outs = [];
    var N = 101;
    for (var i = 0; i < N; i++) {
      outs.push({
        address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
        amount: 0.01
      });
    }
    var b = getBuilder3(outs);
    var tx = b.build();

    tx.getSize().should.equal(3560);

    // ins = 11.0101 BTC (2 inputs: 1.0101 + 10 );
    parseInt(b.valueInSat.toString()).should.equal(11.0101 * util.COIN);
    tx.ins.length.should.equal(2);

    // outs = 101 outs + 1 remainder
    tx.outs.length.should.equal(N+1);


    // 3560 bytes tx -> 0.0004
    b.feeSat.should.equal(0.0004 * util.COIN);

    // 101 * 0.01 = 1.01BTC; + 0.0004 fee = 1.0104btc
    // remainder = 11.0101-1.0104 = 9.9997

    parseInt(b.remainderSat.toString()).should.equal(parseInt(9.9997 * util.COIN));

    util.valueToBigInt(tx.outs[N].v).cmp(999970000).should.equal(0);
    tx.isComplete().should.equal(false);
  });

  it('should generate dynamic fee and readjust (and not) the selected UTXOs(case2)', function() {
    //this is the complementary case, it does not trigger a new utxo
    var outs = [];
    var N = 100;
    for (var i = 0; i < N; i++) {
      outs.push({
        address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
        amount: 0.01
      });
    }
    var b = getBuilder3(outs);
    var tx = b.build();

    tx.getSize().should.equal(3485);

    // ins = 1.0101 BTC (1 inputs: 1.0101 );
    parseInt(b.valueInSat.toString()).should.equal(1.0101 * util.COIN);
    tx.ins.length.should.equal(1);

    // outs = 100 outs:
    // 100 * 0.01 = 1BTC; + 0.0004 fee = 1.0004btc
    // remainder = 1.0101-1.0004 = 0.0097
 
    // outs = 101 outs + 1 remainder
    tx.outs.length.should.equal(N+1);


    // 3560 bytes tx -> 0.0004
    b.feeSat.should.equal(0.0004 * util.COIN);

    // 101 * 0.01 = 1.01BTC; + 0.0004 fee = 1.0104btc
    // remainder = 11.0101-1.0104 = 9.9997
    parseInt(b.remainderSat.toString()).should.equal(parseInt(0.0097 * util.COIN));
    util.valueToBigInt(tx.outs[N].v).cmp(970000).should.equal(0);
    tx.isComplete().should.equal(false);
  });

  it('should sign a p2pubkey tx', function() {
    var opts = {
      remainderOut: {address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'},
    };
    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];

   var b =  new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspentPubKey)
      .setOutputs(outs)
      .sign(testdata.dataUnspentSign.keyStringsPubKey);

    b.isFullySigned().should.equal(true);
    var tx = b.build();
    tx.isComplete().should.equal(true);
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);
  });


  it('should sign a multisig tx', function() {
    var opts = {
      remainderOut: {address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'},
    };
    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
   var b =  new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspentMulti)
      .setOutputs(outs);

    b.sign(testdata.dataUnspentSign.keyStringsMulti);
    b.isFullySigned().should.equal(true);
    var tx = b.build();
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);
    tx.isComplete().should.equal(true);
  });


  it('should sign a multisig tx in steps (3-5)', function() {
    var opts = {
      remainderOut: {address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'},
    };
    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
   var b =  new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspentMulti)
      .setOutputs(outs);

    var k1 = testdata.dataUnspentSign.keyStringsMulti.slice(0,1);
    var k2 = testdata.dataUnspentSign.keyStringsMulti.slice(1,2);
    var k3 = testdata.dataUnspentSign.keyStringsMulti.slice(2,3);

    b.sign(k1);
    b.isFullySigned().should.equal(false);
    b.sign(k2);
    b.isFullySigned().should.equal(false);
    b.sign(k3);
    b.isFullySigned().should.equal(true);

    var tx = b.build();
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);
    tx.isComplete().should.equal(true);
  });


  it('should count multisig signs (3-5)', function() {
    var opts = {
      remainderOut: {address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'},
    };
    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
   var b =  new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspentMulti)
      .setOutputs(outs);

    var k1 = testdata.dataUnspentSign.keyStringsMulti.slice(0,1);
    var k2 = testdata.dataUnspentSign.keyStringsMulti.slice(1,2);
    var k3 = testdata.dataUnspentSign.keyStringsMulti.slice(2,3);

    var tx = b.build();

    b.isFullySigned().should.equal(false);

    // This is cumbersome. Before sign, missing is 1. Need to be changed in the future
    tx.countInputMissingSignatures(0).should.equal(1);
    b.sign(['cSq7yo4fvsbMyWVN945VUGUWMaSazZPWqBVJZyoGsHmNq6W4HVBV']);
    tx.countInputMissingSignatures(0).should.equal(1);

    b.sign(k1);
    tx.countInputMissingSignatures(0).should.equal(2);
    b.isFullySigned().should.equal(false);

    b.sign(k2);
    tx.countInputMissingSignatures(0).should.equal(1);
    b.isFullySigned().should.equal(false);

    b.sign(k3);
    tx.countInputMissingSignatures(0).should.equal(0);
    b.isFullySigned().should.equal(true);
  });


  it('should avoid siging with the same key twice multisig signs (3-5)', function() {
    var opts = {
      remainderOut: {address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'},
    };
    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
   var b =  new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspentMulti)
      .setOutputs(outs);

    var k1 = testdata.dataUnspentSign.keyStringsMulti.slice(0,1);
    var k23 = testdata.dataUnspentSign.keyStringsMulti.slice(1,3);
    var tx = b.build();

    tx.countInputMissingSignatures(0).should.equal(1);
    b.sign(k1);
    b.isFullySigned().should.equal(false);
    tx.countInputMissingSignatures(0).should.equal(2);
    b.sign(k1);
    b.isFullySigned().should.equal(false);
    tx.countInputMissingSignatures(0).should.equal(2);
    b.sign(k1);
    b.isFullySigned().should.equal(false);
    tx.countInputMissingSignatures(0).should.equal(2);
    b.sign(k23);
    b.isFullySigned().should.equal(true);
    tx.countInputMissingSignatures(0).should.equal(0);
  });


  var getInfoForP2sh = function () {
    var privs =  testdata.dataUnspentSign.keyStringsP2sh;
    var pubkeys = [];
    privs.forEach(function(p) {
      var wk = new WalletKey({network: networks.testnet});
      wk.fromObj({priv: p});
      pubkeys.push(bitcore.buffertools.toHex(wk.privKey.public));
    });

    return {
      privkeys: privs,
      pubkeys: pubkeys,
    };
  };

  var getP2shBuilder = function(setMap) {
    var network = 'testnet';
    var opts = {
      remainderOut: {address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'},
    };
    var data = getInfoForP2sh();
    // multisig p2sh
    var p2shOpts = {nreq:3, pubkeys:data.pubkeys, amount:0.05};
    var info = TransactionBuilder.infoForP2sh(p2shOpts, network);

    var outs = outs || [{
      address: info.address,
      amount: 0.08
    }];
   var b =  new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspentP2sh)
      .setOutputs(outs);

    if (setMap) {
      var hashMap = {};
      hashMap[info.address]=info.scriptBufHex;
      b.setHashToScriptMap(hashMap);
    }
    return b;
  };

  it('should fail to sign a p2sh/multisign tx if none script map was given', function() {
    var b = getP2shBuilder();     
    (function() {b.sign(testdata.dataUnspentSign.keyStringsP2sh);}).should.throw();
  });

  it('should sign a p2sh/multisign tx', function() {
    var b = getP2shBuilder(1);     
    b.sign(testdata.dataUnspentSign.keyStringsP2sh);
    b.isFullySigned().should.equal(true);
    var tx = b.build();
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);
    tx.isComplete().should.equal(true);
  });


  it('should sign in steps a p2sh/multisign tx', function() {
    var b = getP2shBuilder(1);     

    var k1 = testdata.dataUnspentSign.keyStringsP2sh.slice(0,1);
    var k2 = testdata.dataUnspentSign.keyStringsP2sh.slice(1,2);
    var k5 = testdata.dataUnspentSign.keyStringsP2sh.slice(4,5);
    b.isFullySigned().should.equal(false);

    b.sign(k1);
    b.isFullySigned().should.equal(false);

    var tx = b.build();
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);
    tx.isComplete().should.equal(false);

    // Sign with the same
    b.sign(k1);
    b.isFullySigned().should.equal(false);
    tx.isComplete().should.equal(false);

    // Sign with k5
    b.sign(k5);
///
    b.isFullySigned().should.equal(false);
    tx.isComplete().should.equal(false);

    // Sign with same
    b.sign(k5);
    b.isFullySigned().should.equal(false);
    tx.isComplete().should.equal(false);


    // Sign k2
    b.sign(k2);
    b.isFullySigned().should.equal(true);
    tx.isComplete().should.equal(true);
  });

  it('should sign in steps a p2sh/p2pubkeyhash tx', function() {
    var priv = 'cMpKwGr5oxEacN95WFKNEq6tTcvi11regFwS3muHvGYVxMPJX8JA';
    var network = 'testnet';
    var opts = {
      remainderOut: {address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'},
    };
    // p2hash/ p2sh
    var p2shOpts = {address:'mgwqzy6pF5BSc72vxHBFSnnhNEBcV4TJzV', amount:0.05};
    var info = TransactionBuilder.infoForP2sh(p2shOpts, network);

    //addr: 2NAwCQ1jPYPrSsyBQvfP6AJ6d6SSxnHsZ4e
    //hash: de09d4a9c7e53e08043efc74d14490dbcf03b0ba
    //
    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
    //info.scriptBufHex,

    var s =  TransactionBuilder.scriptForAddress(info.address)
                            .getBuffer().toString('hex');

    var b =  new TransactionBuilder(opts)
      .setUnspent([{
      "address": info.address,
      "scriptPubKey": s, 
      "txid": "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1",
      "vout": 1,
      "amount": 1,
      "confirmations":7
      }])
      .setOutputs(outs);

    var hashMap = {};
    hashMap[info.address]=info.scriptBufHex;
    b.setHashToScriptMap(hashMap);
    b.sign([priv]);
    b.isFullySigned().should.equal(true);
    var tx = b.build();
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);
    tx.isComplete().should.equal(true);
  });

});
