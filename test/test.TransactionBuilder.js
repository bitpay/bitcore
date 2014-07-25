'use strict';

var chai = chai || require('chai');
chai.config.includeStack = true;
var bitcore = bitcore || require('../bitcore');
var bignum = bitcore.Bignum;

var should = chai.should();

var TransactionBuilder = bitcore.TransactionBuilder;
var Address = bitcore.Address;
var WalletKey = bitcore.WalletKey;
var Script = bitcore.Script;
var util = bitcore.util;
var networks = bitcore.networks;
var testdata = testdata || require('./testdata');


var vopts = {
  verifyP2SH: true,
  dontVerifyStrictEnc: true
};

describe('TransactionBuilder', function() {
  it('should initialze the main object', function() {
    should.exist(TransactionBuilder);
  });


  it('should be able to create instance', function() {
    var t = new TransactionBuilder();
    should.exist(t);
  });

  it('should be able to create instance with params', function() {
    var t = new TransactionBuilder({
      spendUnconfirmed: true,
      lockTime: 10
    });
    should.exist(t);
    should.exist(t.lockTime);
    t.spendUnconfirmed.should.equal(true);
    t.lockTime.should.equal(10);
  });

  it('should be a fee in satoshi', function() {
    var satoshi = TransactionBuilder.FEE_PER_1000B_SAT;
    satoshi.should.equal(10000);
  });

  var getBuilder = function(spendUnconfirmed) {
    var t = new TransactionBuilder({
        spendUnconfirmed: spendUnconfirmed
      })
      .setUnspent(testdata.dataUnspent);

    return t;
  };

  function f(amount, spendUnconfirmed) {
    spendUnconfirmed = typeof spendUnconfirmed === 'undefined' ? true : false;
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

  it('#_selectUnspent should return null if not enough utxos', function() {
    (function() {
      f(1.12);
    }).should.throw();
  });


  it('#_selectUnspent should check confirmations', function() {
    (function() {
      f(0.9, false);
    }).should.throw();
    f(0.9).length.should.equal(3);

    f(0.11, false).length.should.equal(2);
    (function() {
      f(0.111, false);
    }).should.throw();
  });



  it('#_setInputs sets inputs', function() {
    var txobj = {};
    var b = getBuilder()
      .setUnspent(testdata.dataUnspent)
      ._selectUnspent(0.1 * util.COIN)
      ._setInputs(txobj);

    should.exist(txobj.ins[0].s);
    should.exist(txobj.ins[0].q);
    should.exist(txobj.ins[0].o);
  });

  it('#_setInputMap set inputMap', function() {
    var txobj = {};
    var b = getBuilder()
      .setUnspent(testdata.dataUnspent)
      ._selectUnspent(0.1 * util.COIN)
      ._setInputs(txobj)
      ._setInputMap(txobj);

    should.exist(b.inputMap);
    b.inputMap.length.should.equal(2);
  });

  var getBuilder2 = function(fee) {
    var opts = {
      remainderOut: {
        address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'
      },
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
      remainderOut: {
        address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'
      },
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



  var getBuilder3 = function(outs, signhash) {

    var opts = {
      remainderOut: {
        address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'
      },
      spendUnconfirmed: true,
      signhash: signhash,
    };

    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];

    return new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspent)
      .setOutputs(outs);
  };

  it('should sign a tx (case 1)', function(done) {
    var b = getBuilder3();
    b.isFullySigned().should.equal(false);

    b.sign(testdata.dataUnspentSign.keyStrings);

    b.isFullySigned().should.equal(true);

    var tx = b.build();
    tx.isComplete().should.equal(true);
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);

    var shex = testdata.dataUnspentSign.unspent[0].scriptPubKey;
    var s = new Script(new Buffer(shex, 'hex'));
    tx.verifyInput(0, s, vopts, function(err, results) {
      should.not.exist(err);
      should.exist(results);
      results.should.equal(true);
      done();
    });
  });

  it('should sign a tx (case 2)', function(done) {
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

    var shex = testdata.dataUnspentSign.unspent[0].scriptPubKey;
    var s = new Script(new Buffer(shex, 'hex'));
    tx.verifyInput(0, s, vopts, function(err, results) {
      should.not.exist(err);
      should.exist(results);
      results.should.equal(true);
      done();
    });

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


  it('should sign a tx in multiple steps (case1)', function(done) {

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

    var tx = b.build();
    var shex = testdata.dataUnspentSign.unspent[0].scriptPubKey;
    var s = new Script(new Buffer(shex, 'hex'));
    tx.verifyInput(0, s, vopts, function(err, results) {
      should.not.exist(err);
      should.exist(results);
      results.should.equal(true);
      done();
    });

  });

  it('#sign should sign a tx in multiple steps (case2)', function(done) {
    var b = getBuilder3([{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 16
    }]);

    b.isFullySigned().should.equal(false);
    (b.build()).isComplete().should.equal(false);

    var k1 = testdata.dataUnspentSign.keyStrings.slice(0, 1);
    var k2 = testdata.dataUnspentSign.keyStrings.slice(1, 2);
    var k3 = testdata.dataUnspentSign.keyStrings.slice(2, 3);
    b.sign(k1);
    b.isFullySigned().should.equal(false);
    (b.build()).isComplete().should.equal(false);

    b.sign(k2);
    b.isFullySigned().should.equal(false);
    (b.build()).isComplete().should.equal(false);

    b.sign(k3);
    b.isFullySigned().should.equal(true);
    (b.build()).isComplete().should.equal(true);

    var tx = b.build();
    var shex = testdata.dataUnspentSign.unspent[0].scriptPubKey;
    var s = new Script(new Buffer(shex, 'hex'));
    tx.verifyInput(0, s, vopts, function(err, results) {
      should.not.exist(err);
      should.exist(results);
      results.should.equal(true);
      done();
    });
  });

  it('#sign should sign a tx in multiple steps (case2) / diff order', function(done) {
    var b = getBuilder3([{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 16
    }]);

    b.isFullySigned().should.equal(false);
    (b.build()).isComplete().should.equal(false);

    var k2 = testdata.dataUnspentSign.keyStrings.slice(0, 1);
    var k3 = testdata.dataUnspentSign.keyStrings.slice(1, 2);
    var k1 = testdata.dataUnspentSign.keyStrings.slice(2, 3);
    b.sign(k1);
    b.isFullySigned().should.equal(false);
    (b.build()).isComplete().should.equal(false);

    b.sign(k2);
    b.isFullySigned().should.equal(false);
    (b.build()).isComplete().should.equal(false);

    b.sign(k3);
    b.isFullySigned().should.equal(true);
    (b.build()).isComplete().should.equal(true);

    var tx = b.build();
    var shex = testdata.dataUnspentSign.unspent[0].scriptPubKey;
    var s = new Script(new Buffer(shex, 'hex'));
    tx.verifyInput(0, s, vopts, function(err, results) {
      should.not.exist(err);
      should.exist(results);
      results.should.equal(true);
      done();
    });
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
    tx.outs.length.should.equal(N + 1);


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
    tx.outs.length.should.equal(N + 1);


    // 3560 bytes tx -> 0.0004
    b.feeSat.should.equal(0.0004 * util.COIN);

    // 101 * 0.01 = 1.01BTC; + 0.0004 fee = 1.0104btc
    // remainder = 11.0101-1.0104 = 9.9997
    parseInt(b.remainderSat.toString()).should.equal(parseInt(0.0097 * util.COIN));
    util.valueToBigInt(tx.outs[N].v).cmp(970000).should.equal(0);
    tx.isComplete().should.equal(false);
  });

  it('should sign a p2pubkey tx', function(done) {
    var opts = {
      remainderOut: {
        address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'
      },
    };
    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];

    var b = new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspentPubKey)
      .setOutputs(outs)
      .sign(testdata.dataUnspentSign.keyStringsPubKey);

    b.isFullySigned().should.equal(true);
    var tx = b.build();
    tx.isComplete().should.equal(true);
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);

    var tx = b.build();
    var shex = testdata.dataUnspentSign.unspentPubKey[0].scriptPubKey;
    var s = new Script(new Buffer(shex, 'hex'));
    tx.verifyInput(0, s, vopts, function(err, results) {
      should.not.exist(err);
      should.exist(results);
      results.should.equal(true);
      done();
    });

  });


  it('should sign a multisig tx', function(done) {
    var opts = {
      remainderOut: {
        address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'
      },
    };
    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
    var b = new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspentMulti)
      .setOutputs(outs);

    b.sign(testdata.dataUnspentSign.keyStringsMulti);
    b.isFullySigned().should.equal(true);
    var tx = b.build();
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);
    tx.isComplete().should.equal(true);

    var tx = b.build();
    var shex = testdata.dataUnspentSign.unspentMulti[0].scriptPubKey;
    var s = new Script(new Buffer(shex, 'hex'));
    tx.verifyInput(0, s, vopts, function(err, results) {
      should.not.exist(err);
      should.exist(results);
      results.should.equal(true);
      done();
    });
  });


  it('should sign a multisig tx in steps (3-5)', function(done) {
    var opts = {
      remainderOut: {
        address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'
      },
    };
    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
    var b = new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspentMulti)
      .setOutputs(outs);

    var k1 = testdata.dataUnspentSign.keyStringsMulti.slice(0, 1);
    var k2 = testdata.dataUnspentSign.keyStringsMulti.slice(1, 2);
    var k3 = testdata.dataUnspentSign.keyStringsMulti.slice(2, 3);

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

    var tx = b.build();
    var shex = testdata.dataUnspentSign.unspentMulti[0].scriptPubKey;
    var s = new Script(new Buffer(shex, 'hex'));
    tx.verifyInput(0, s, vopts, function(err, results) {
      should.not.exist(err);
      should.exist(results);
      results.should.equal(true);
      done();
    });

  });


  it('should count multisig signs (3-5)', function() {
    var opts = {
      remainderOut: {
        address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'
      },
    };
    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
    var b = new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspentMulti)
      .setOutputs(outs);

    var k1 = testdata.dataUnspentSign.keyStringsMulti.slice(0, 1);
    var k2 = testdata.dataUnspentSign.keyStringsMulti.slice(1, 2);
    var k3 = testdata.dataUnspentSign.keyStringsMulti.slice(2, 3);

    var tx = b.build();
    b.isFullySigned().should.equal(false);

    tx.countInputSignatures(0).should.equal(0);

    b.sign(['cSq7yo4fvsbMyWVN945VUGUWMaSazZPWqBVJZyoGsHmNq6W4HVBV']);

    tx.countInputSignatures(0).should.equal(0);
    b.sign(k1);
    tx.countInputSignatures(0).should.equal(1);
    b.isFullySigned().should.equal(false);

    b.sign(k2);
    tx.countInputSignatures(0).should.equal(2);
    b.isFullySigned().should.equal(false);

    b.sign(k3);
    tx.countInputSignatures(0).should.equal(3);
    b.isFullySigned().should.equal(true);
  });


  it('should avoid siging with the same key twice multisig signs (3-5)', function(done) {
    var opts = {
      remainderOut: {
        address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'
      },
    };
    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
    var b = new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspentMulti)
      .setOutputs(outs);

    var k1 = testdata.dataUnspentSign.keyStringsMulti.slice(0, 1);
    var k23 = testdata.dataUnspentSign.keyStringsMulti.slice(1, 3);
    var tx = b.build();

    tx.countInputSignatures(0).should.equal(0);
    b.sign(k1);
    b.isFullySigned().should.equal(false);
    tx.countInputSignatures(0).should.equal(1);
    b.sign(k1);
    b.isFullySigned().should.equal(false);
    tx.countInputSignatures(0).should.equal(1);
    b.sign(k1);
    b.isFullySigned().should.equal(false);
    tx.countInputSignatures(0).should.equal(1);
    b.sign(k23);
    b.isFullySigned().should.equal(true);
    tx.countInputSignatures(0).should.equal(3);

    var tx = b.build();
    var shex = testdata.dataUnspentSign.unspentMulti[0].scriptPubKey;
    var s = new Script(new Buffer(shex, 'hex'));
    tx.verifyInput(0, s, vopts, function(err, results) {
      should.not.exist(err);
      should.exist(results);
      results.should.equal(true);
      done();
    });


  });


  var getInfoForP2sh = function() {
    var privs = testdata.dataUnspentSign.keyStringsP2sh;
    var pubkeys = [];
    privs.forEach(function(p) {
      var wk = new WalletKey({
        network: networks.testnet
      });
      wk.fromObj({
        priv: p
      });
      pubkeys.push(bitcore.buffertools.toHex(wk.privKey.public));
    });

    return {
      privkeys: privs,
      pubkeys: pubkeys,
    };
  };

  //
  // bitcoind  createmultisig 3 '["03197599f6e209cefef07da2fddc6fe47715a70162c531ffff8e611cef23dfb70d" ,  "0380a29968851f93af55e581c43d9ef9294577a439a3ca9fc2bc47d1ca2b3e9127"  ,  "0392dccb2ed470a45984811d6402fdca613c175f8f3e4eb8e2306e8ccd7d0aed03",     "03a94351fecc4328bb683bf93a1aa67378374904eac5980c7966723a51897c56e3"  ,  "03e085eb6fa1f20b2722c16161144314070a2c316a9cae2489fd52ce5f63fff6e4" ]'
  //
  // =>
  //
  // {
  //     "address" : "2NDJbzwzsmRgD2o5HHXPhuq5g6tkKTjYkd6",
  //     "redeemScript" : "532103197599f6e209cefef07da2fddc6fe47715a70162c531ffff8e611cef23dfb70d210380a29968851f93af55e581c43d9ef9294577a439a3ca9fc2bc47d1ca2b3e9127210392dccb2ed470a45984811d6402fdca613c175f8f3e4eb8e2306e8ccd7d0aed032103a94351fecc4328bb683bf93a1aa67378374904eac5980c7966723a51897c56e32103e085eb6fa1f20b2722c16161144314070a2c316a9cae2489fd52ce5f63fff6e455ae"
  // }
  //
  var getP2shBuilder = function(setMap, opts) {
    var network = 'testnet';
    opts = opts || {};
    opts.remainderOut = opts.remainderOut || {
      address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'
    };

    var data = getInfoForP2sh();
    // multisig p2sh
    var p2shOpts = {
      nreq: 3,
      pubkeys: data.pubkeys
    };
    var info = TransactionBuilder.infoForP2sh(p2shOpts, network);

    var outs = outs || [{
      address: 'mon1Hqs3jqKTtRSnRwJ3pRYMFos9WYfKb5',
      amount: 0.08
    }];
    var b = new TransactionBuilder(opts)
      .setUnspent(testdata.dataUnspentSign.unspentP2sh)
      .setOutputs(outs);

    if (setMap) {
      var hashMap = {};
      hashMap[info.address] = info.scriptBufHex;
      b.setHashToScriptMap(hashMap);
    }
    return b;
  };

  it('should fail to sign a p2sh/multisign tx if none script map was given', function() {
    var b = getP2shBuilder();
    (function() {
      b.sign(testdata.dataUnspentSign.keyStringsP2sh);
    }).should.throw();
  });


  var _checkOK = function(b, done) {
    b.isFullySigned().should.equal(true);
    var tx = b.build();
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);
    tx.isComplete().should.equal(true);

    var shex = testdata.dataUnspentSign.unspentP2sh[0].scriptPubKey;
    var s = new Script(new Buffer(shex, 'hex'));
    tx.verifyInput(0, s, vopts, function(err, results) {
      should.exist(results);
      results.should.equal(true);
      should.not.exist(err);
      done();
    });

  };

  [
    [1, 2, 3],
    [1, 3, 2],
    [2, 1, 3],
    [2, 3, 1],
    [3, 2, 1],
    [3, 1, 2]
  ].forEach(function(order) {
    it('should sign a p2sh/multisig tx in order ' + order.join(','), function(done) {
      var b = getP2shBuilder(1);
      b.sign([testdata.dataUnspentSign.keyStringsP2sh[3]]);
      b.sign([testdata.dataUnspentSign.keyStringsP2sh[1]]);
      b.sign([testdata.dataUnspentSign.keyStringsP2sh[2]]);
      _checkOK(b, done);
    });
  });

  it('should sign in steps a p2sh/multisign tx', function() {
    var b = getP2shBuilder(1);

    var k1 = testdata.dataUnspentSign.keyStringsP2sh.slice(0, 1);
    var k2 = testdata.dataUnspentSign.keyStringsP2sh.slice(1, 2);
    var k5 = testdata.dataUnspentSign.keyStringsP2sh.slice(4, 5);
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

  it('should sign a p2sh/p2pubkeyhash tx', function() {
    var priv = 'cMpKwGr5oxEacN95WFKNEq6tTcvi11regFwS3muHvGYVxMPJX8JA';
    var network = 'testnet';
    var opts = {
      remainderOut: {
        address: 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'
      },
    };
    // p2hash/ p2sh
    var p2shOpts = {
      address: 'mgwqzy6pF5BSc72vxHBFSnnhNEBcV4TJzV'
    };
    var info = TransactionBuilder.infoForP2sh(p2shOpts, network);

    //addr: 2NAwCQ1jPYPrSsyBQvfP6AJ6d6SSxnHsZ4e
    //hash: de09d4a9c7e53e08043efc74d14490dbcf03b0ba
    //
    var outs = outs || [{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 0.08
    }];
    //info.scriptBufHex,

    var s = new Address(info.address).getScriptPubKey()
      .getBuffer().toString('hex');

    var b = new TransactionBuilder(opts)
      .setUnspent([{
        "address": info.address,
        "scriptPubKey": s,
        "txid": "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1",
        "vout": 1,
        "amount": 1,
        "confirmations": 7
      }])
      .setOutputs(outs);

    var hashMap = {};
    hashMap[info.address] = info.scriptBufHex;
    b.setHashToScriptMap(hashMap);
    b.sign([priv]);
    b.isFullySigned().should.equal(true);

    var tx = b.build();
    tx.ins.length.should.equal(1);
    tx.outs.length.should.equal(2);
    tx.isComplete().should.equal(true);
  });


  it('should check sign parameters', function() {
    var b = getP2shBuilder(1);
    (function() {
      b.sign(testdata.dataUnspentSign.keyStringsP2sh[0])
    }).should.throw('array');
  });


  describe('serizalization', function() {

    it('#toObj #fromObj roundtrip', function() {
      var b = getBuilder2();

      b.isFullySigned().should.equal(false);
      b.getSelectedUnspent().length.should.equal(2);

      var data = b.toObj();

      var b2 = TransactionBuilder.fromObj(data);
      var tx = b2.build();
      should.exist(tx);
      tx.version.should.equal(1);
      tx.ins.length.should.equal(2);
      tx.outs.length.should.equal(2);

      util.valueToBigInt(tx.outs[0].v).cmp(8000000).should.equal(0);

      // remainder is 0.0299 here because unspent select utxos in order
      util.valueToBigInt(tx.outs[1].v).cmp(2990000).should.equal(0);
    });

    it('#clone roundtrip, signed', function() {
      var b = getBuilder3();
      b.sign(testdata.dataUnspentSign.keyStrings);
      b.isFullySigned().should.equal(true);

      var b2 = b.clone().clone().clone();
      b2.isFullySigned().should.equal(true);
    });

    it('#toObj #fromObj roundtrip, step signatures p2sh/p2pubkeyhash', function() {
      var b = getP2shBuilder(1);

      var keys = JSON.parse(JSON.stringify(testdata.dataUnspentSign.keyStringsP2sh));

      var k1 = keys.slice(0, 1);
      var k2 = keys.slice(1, 2);
      var k5 = keys.slice(4, 5);
      b.isFullySigned().should.equal(false);

      var b2 = TransactionBuilder.fromObj(b.toObj());

      b2.sign(k1);
      b2.isFullySigned().should.equal(false);

      var tx = b2.build();
      tx.ins.length.should.equal(1);
      tx.outs.length.should.equal(2);
      tx.isComplete().should.equal(false);

      // Sign with the same
      var b3 = TransactionBuilder.fromObj(b2.toObj());

      b3.sign(k1);
      b3.isFullySigned().should.equal(false);

      // Sign with k5
      var b4 = TransactionBuilder.fromObj(b3.toObj());
      b4.sign(k5);
      b4.isFullySigned().should.equal(false);

      var b5 = TransactionBuilder.fromObj(b4.toObj());
      // Sign k2
      b5.sign(k2);
      b5.isFullySigned().should.equal(true);
      var tx2 = b5.build();
      tx2.isComplete().should.equal(true);
    });


    it('should keep signatures after clone', function() {
      var k1 = testdata.dataUnspentSign.keyStringsP2sh[0];
      var k2 = testdata.dataUnspentSign.keyStringsP2sh[1];

      var b = getP2shBuilder(1);
      var b2 = getP2shBuilder(1);

      b.sign([k1]);
      b2.sign([k2]);
      b2.merge(b);
      var tx2 = b2.build();
      tx2.countInputSignatures(0).should.equal(2, 'before clone');
      tx2 = b2.clone().build();
      tx2.countInputSignatures(0).should.equal(2, 'after clone');

    });
  });


  describe('#merge', function() {
    it('with self', function() {
      var b = getBuilder3([{
          address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
          amount: 16
        }])
        .sign(testdata.dataUnspentSign.keyStrings);
      b.merge(b);

      b.isFullySigned().should.equal(true);
      var tx = b.build();
      tx.isComplete().should.equal(true);
      tx.ins.length.should.equal(3);
      tx.outs.length.should.equal(2);
    });

    it('#merge simple', function() {
      var b = getBuilder3([{
          address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
          amount: 16
        }])
        .sign(testdata.dataUnspentSign.keyStrings);

      // merge simple
      var b2 = getBuilder3([{
        address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
        amount: 16
      }]);
      b2.isFullySigned().should.equal(false);
      b2.merge(b);

      b2.isFullySigned().should.equal(true);
      var tx = b.build();
      tx.isComplete().should.equal(true);
      tx.ins.length.should.equal(3);
      tx.outs.length.should.equal(2);
    });


    var b = getBuilder3([{
      address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
      amount: 16
    }]);

    it('should check amount', function() {
      // bad amount
      var b2 = getBuilder3([{
        address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
        amount: 15
      }]);
      (function() {
        b2.merge(b);
      }).should.throw('incompatible');
    });
    it('should check addresses', function() {
      // bad out
      var b2 = getBuilder3([{
        address: 'muHct3YZ9Nd5Pq7uLYYhXRAxeW4EnpcaLz',
        amount: 16
      }]);
      (function() {
        b2.merge(b);
      }).should.throw('incompatible');
    });


    it('should check signhash in p2pubkeyhash', function() {
      // bad amount
      var b = getBuilder3([{
        address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
        amount: 15
      }]);
      b.sign(testdata.dataUnspentSign.keyStrings);

      var b2 = getBuilder3([{
        address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
        amount: 15
      }], bitcore.Transaction.SIGHASH_NONE);
      b2.sign(testdata.dataUnspentSign.keyStrings);

      (function() {
        b2.merge(b);
      }).should.throw('incompatible');
    });


    it('should merge signed signed txs', function() {
      // same signature 
      //  -> keep first signature
      var b = getBuilder3([{
          address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
          amount: 16
        }])
        .sign(testdata.dataUnspentSign.keyStrings);
      // merge simple
      var b2 = getBuilder3([{
          address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE',
          amount: 16
        }])
        .sign(testdata.dataUnspentSign.keyStrings);
      b2.isFullySigned().should.equal(true);
      b2.merge(b);
      b2.isFullySigned().should.equal(true);
    });


    it('#merge p2sh in 2 steps', function() {
      var b = getP2shBuilder(1);
      var b2 = getP2shBuilder(1);
      var k1 = testdata.dataUnspentSign.keyStringsP2sh[0];
      var k2 = testdata.dataUnspentSign.keyStringsP2sh[1];
      b.sign([k1]);
      b2.sign([k2]);
      b.merge(b2);
      var tx = b.build();
      tx.countInputSignatures(0).should.equal(2);
    });

    it('#merge p2sh in 2 steps, case 2', function() {
      var b = getP2shBuilder(1);
      var b2 = getP2shBuilder(1);
      var k1 = testdata.dataUnspentSign.keyStringsP2sh[0];
      var k2 = testdata.dataUnspentSign.keyStringsP2sh[1];
      var k3 = testdata.dataUnspentSign.keyStringsP2sh[2];
      b.sign([k1, k2]);
      b2.sign([k3]);
      b.merge(b2);
      var tx = b.build();
      tx.countInputSignatures(0).should.equal(3);
    });


    it('#merge p2sh sign twice', function() {
      var k1 = testdata.dataUnspentSign.keyStringsP2sh[0];
      var k2 = testdata.dataUnspentSign.keyStringsP2sh[1];

      var b = getP2shBuilder(1);
      var b2 = getP2shBuilder(1);

      b.sign([k1]);
      b2.sign([k1, k2]);
      b2.merge(b);
      var tx = b2.build();
      tx.countInputSignatures(0).should.equal(2);
    });


    it('#merge p2sh sign twice, case2', function() {
      var k1 = testdata.dataUnspentSign.keyStringsP2sh[0];
      var k2 = testdata.dataUnspentSign.keyStringsP2sh[1];

      var b = getP2shBuilder(1);
      var b2 = getP2shBuilder(1);

      b.sign([k1]);
      b2.sign([k1]);
      b2.merge(b);
      var tx = b2.build();
      tx.countInputSignatures(0).should.equal(1);
    });





    it('#merge p2sh in 3 steps', function() {
      var k1 = testdata.dataUnspentSign.keyStringsP2sh[0];
      var k2 = testdata.dataUnspentSign.keyStringsP2sh[1];
      var k3 = testdata.dataUnspentSign.keyStringsP2sh[2];

      var b = getP2shBuilder(1);
      var b2 = getP2shBuilder(1);
      var b3 = getP2shBuilder(1);

      b.sign([k1]);
      b2.sign([k2]);
      b2.merge(b);
      var tx = b2.clone().build();
      tx.countInputSignatures(0).should.equal(2);

      b3.sign([k3]);
      b3.merge(b2);
      tx = b3.build();
      tx.countInputSignatures(0).should.equal(3);
    });


    it('should check signhash in p2sh/merge', function() {
      var b = getP2shBuilder(1);
      var k1 = testdata.dataUnspentSign.keyStringsP2sh.slice(0, 1);
      var k2 = testdata.dataUnspentSign.keyStringsP2sh.slice(1, 2);
      b.isFullySigned().should.equal(false);
      b.sign(k1);
      var tx = b.build();
      tx.isComplete().should.equal(false);

      var b2 = getP2shBuilder(1, {
        signhash: bitcore.Transaction.SIGHASH_NONE
      });
      b2.sign(k2);
      (function() {
        b2.merge(b)
      }).should.throw();
    });

    it('#merge p2sh/steps change return address', function() {
      var b = getP2shBuilder(1);
      var k1 = testdata.dataUnspentSign.keyStringsP2sh.slice(0, 1);
      var k2 = testdata.dataUnspentSign.keyStringsP2sh.slice(1, 2);
      var k3 = testdata.dataUnspentSign.keyStringsP2sh.slice(2, 3);
      b.isFullySigned().should.equal(false);
      b.sign(k1);
      var tx = b.build();
      tx.isComplete().should.equal(false);
      b = TransactionBuilder.fromObj(b.toObj());

      var b2 = getP2shBuilder(1, {
        remainderOut: {
          address: 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE'
        }
      });
      b2.sign(k2);
      (function() {
        b2.merge(b)
      }).should.throw('incompatible');
    });
  });
});
