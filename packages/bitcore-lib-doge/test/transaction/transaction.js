'use strict';

/* jshint unused: false */
/* jshint latedef: false */
var should = require('chai').should();
var expect = require('chai').expect;
var _ = require('lodash');
var sinon = require('sinon');

var bitcore = require('../..');
var BN = bitcore.crypto.BN;
var Transaction = bitcore.Transaction;
var Input = bitcore.Transaction.Input;
var Output = bitcore.Transaction.Output;
var PrivateKey = bitcore.PrivateKey;
var Script = bitcore.Script;
var Interpreter = bitcore.Script.Interpreter;
var Address = bitcore.Address;
var Networks = bitcore.Networks;
var Opcode = bitcore.Opcode;
var errors = bitcore.errors;

var transactionVector = require('../data/tx_creation');

describe('Transaction', function() {

  it('should serialize and deserialize correctly a given transaction', function() {
    var transaction = new Transaction(tx_1_hex);
    transaction.uncheckedSerialize().should.equal(tx_1_hex);
  });

  it('should parse the version as a signed integer', function () {
    var transaction = Transaction('ffffffff0000ffffffff')
    transaction.version.should.equal(-1);
    transaction.nLockTime.should.equal(0xffffffff);
  });

  it('fails if an invalid parameter is passed to constructor', function() {
    expect(function() {
      return new Transaction(1);
    }).to.throw(errors.InvalidArgument);
  });

  var testScript = 'OP_DUP OP_HASH160 20 0x399e6af986692f116cb67431b10ae6bdf8891eb1 OP_EQUALVERIFY OP_CHECKSIG';
  var testScriptHex = '76a914399e6af986692f116cb67431b10ae6bdf8891eb188ac';
  var testPrevTx = 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458';
  var testAmount = 1020000;
  var testTransaction = new Transaction()
    .from({
      'txId': testPrevTx,
      'outputIndex': 0,
      'script': testScript,
      'satoshis': testAmount
    })
    .to('DGYdw7jC17b9SappjsrAsaghhDTS8sV5Mx', testAmount - 10000);

  it('can serialize to a plain javascript object', function() {
    var object = testTransaction.toObject();
    object.inputs[0].output.satoshis.should.equal(testAmount);
    object.inputs[0].output.script.should.equal(testScriptHex);
    object.inputs[0].prevTxId.should.equal(testPrevTx);
    object.inputs[0].outputIndex.should.equal(0);
    object.outputs[0].satoshis.should.equal(testAmount - 10000);
  });

  it('will not accept NaN as an amount', function() {
    (function() {
      var stringTx = new Transaction().to('DGYdw7jC17b9SappjsrAsaghhDTS8sV5Mx', NaN);
    }).should.throw('Amount is expected to be a positive integer');
  });

  it('returns the fee correctly', function() {
    testTransaction.getFee().should.equal(10000);
  });

  it('will return zero as the fee for a coinbase', function() {
    // block #2: 0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098
    var coinbaseTransaction = new Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0704ffff001d0104ffffffff0100f2052a0100000043410496b538e853519c726a2c91e61ec11600ae1390813a627c66fb8be7947be63c52da7589379515d4e0a604f8141781e62294721166bf621e73a82cbf2342c858eeac00000000');
    coinbaseTransaction.getFee().should.equal(0);
  });

  it('serialize to Object roundtrip', function() {
    var a = testTransaction.toObject();
    var newTransaction = new Transaction(a);
    var b = newTransaction.toObject();
    a.should.deep.equal(b);
  });

  it('toObject/fromObject with signatures and custom fee', function() {
    var tx = new Transaction()
      .from(simpleUtxoWith10DOGE)
      .to([{address: toAddress, satoshis: 5e8}])
      .fee(1.5e8)
      .change(changeAddress)
      .sign(privateKey);

    var txData = JSON.stringify(tx);
    var tx2 = new Transaction(JSON.parse(txData));
    var txData2 = JSON.stringify(tx2);
    txData.should.equal(txData2);
  });

  it('toObject/fromObject with p2sh signatures and custom fee', function() {
    var tx = new Transaction()
      .from(p2shUtxoWith1000DOGE, [p2shPublicKey1, p2shPublicKey2, p2shPublicKey3], 2)
      .to([{address: toAddress, satoshis: 5e8}])
      .fee(1.5e8)
      .change(changeAddress)
      .sign(p2shPrivateKey1)
      .sign(p2shPrivateKey2);

    var txData = JSON.stringify(tx);
    var tx2 = new Transaction(JSON.parse(txData));
    var tx2Data = JSON.stringify(tx2);
    txData.should.equal(tx2Data);
  });

  it('fromObject with pay-to-public-key previous outputs', function() {
    var tx = bitcore.Transaction({
      hash: '132856bf03d6415562a556437d22ac63c37a4595fd986c796eb8e02dc031aa25',
      version: 1,
      inputs: [
        {
          prevTxId: 'e30ac3db24ef28500f023775d8eb06ad8a26241690080260308208a4020012a4',
          outputIndex: 0,
          sequenceNumber: 4294967294,
          script: '473044022024dbcf41ccd4f3fe325bebb7a87d0bf359eefa03826482008e0fe7795586ad440220676f5f211ebbc311cfa631f14a8223a343cbadc6fa97d6d17f8d2531308b533201',
          scriptString: '71 0x3044022024dbcf41ccd4f3fe325bebb7a87d0bf359eefa03826482008e0fe7795586ad440220676f5f211ebbc311cfa631f14a8223a343cbadc6fa97d6d17f8d2531308b533201',
          output: {
            satoshis: 5000000000,
            script: '2103b1c65d65f1ff3fe145a4ede692460ae0606671d04e8449e99dd11c66ab55a7feac'
          }
        }
      ],
      outputs: [
        {
          satoshis: 3999999040,
          script: '76a914fa1e0abfb8d26e494375f47e04b4883c44dd44d988ac'
        },
        {
          satoshis: 1000000000,
          script: '76a9140b2f0a0c31bfe0406b0ccc1381fdbe311946dadc88ac'
        }
      ],
      nLockTime: 139
    });
    tx.inputs[0].should.be.instanceof(bitcore.Transaction.Input.PublicKey);
    tx.inputs[0].output.satoshis.should.equal(5000000000);
    tx.inputs[0].output.script.toHex().should.equal('2103b1c65d65f1ff3fe145a4ede692460ae0606671d04e8449e99dd11c66ab55a7feac');
  });

  it('toObject/fromObject with witness, signatures and custom fee', function() {
    var tx = new Transaction()
      .from(simpleWitnessUtxoWith1000DOGE)
      .to([{address: toAddress, satoshis: 50000}])
      .fee(15000)
      .change(changeAddress)
      .sign(privateKey);

    var txData = JSON.stringify(tx);
    var tx2 = new Transaction(JSON.parse(txData));
    var txData2 = JSON.stringify(tx2);
    txData.should.equal(txData2);
  });

  it('toObject/fromObject with nested witness, signatures and custom fee', function() {
    var tx = new Transaction()
      .from(simpleWrappedWitnessUtxoWith1000DOGE)
      .to([{address: toAddress, satoshis: 50000}])
      .fee(15000)
      .change(changeAddress)
      .sign(privateKey);

    var txData = JSON.stringify(tx);
    var tx2 = new Transaction(JSON.parse(txData));
    var txData2 = JSON.stringify(tx2);
    txData.should.equal(txData2);
  });

  it('constructor returns a shallow copy of another transaction', function() {
    var transaction = new Transaction(tx_1_hex);
    var copy = new Transaction(transaction);
    copy.uncheckedSerialize().should.equal(transaction.uncheckedSerialize());
  });

  it('should display correctly in console', function() {
    var transaction = new Transaction(tx_1_hex);
    transaction.inspect().should.equal('<Transaction: ' + tx_1_hex + '>');
  });

  it('standard hash of transaction should be decoded correctly', function() {
    var transaction = new Transaction(tx_1_hex);
    transaction.id.should.equal(tx_1_id);
  });

  it('serializes an empty transaction', function() {
    var transaction = new Transaction();
    transaction.uncheckedSerialize().should.equal(tx_empty_hex);
  });

  it('serializes and deserializes correctly', function() {
    var transaction = new Transaction(tx_1_hex);
    transaction.uncheckedSerialize().should.equal(tx_1_hex);
  });

  describe('transaction creation test vector', function() {
    this.timeout(5000);
    var index = 0;
    transactionVector.forEach(function(vector) {
      index++;
      it('case ' + index, function() {
        var i = 0;
        var transaction = new Transaction();
        while (i < vector.length) {
          var command = vector[i];
          var args = vector[i + 1];
          if (command === 'serialize') {
            transaction.serialize().should.equal(args);
          } else {
            transaction[command].apply(transaction, args);
          }
          i += 2;
        }
      });
    });
  });

  // TODO: Migrate this into a test for inputs

  var fromAddress = 'DSw2NHz2YfTeFogjeGJvZVVZkjkxSSX3zx';
  var witnessFromAddress = 'bc1qau9yky5ct9q0gfeyc8qrcpzgsj5g59zs4ynlu8';
  var wrappedWitnessFromAddress = 'A6wuuhLY2ctoF4H93aeVx8vLgeGFgE1Wxx';
  var simpleUtxoWith10DOGE = {
    address: fromAddress,
    txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
    outputIndex: 0,
    script: Script.buildPublicKeyHashOut(fromAddress).toString(),
    satoshis: 10e8
  };

  var simpleUtxoWith100DOGE = {
    address: fromAddress,
    txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
    outputIndex: 0,
    script: Script.buildPublicKeyHashOut(fromAddress).toString(),
    satoshis: 100e8
  };
  var anyoneCanSpendUTXO = JSON.parse(JSON.stringify(simpleUtxoWith10DOGE));
  anyoneCanSpendUTXO.script = new Script().add('OP_TRUE');
  var toAddress = 'DE1wEbm9D6JqEhqGtyD52BkHQmQ5N18J84';
  var changeAddress = 'DAPkqFzgrXVsUU7WkSf1GYMmFzEGvuK4SK';
  var changeAddressP2SH = 'A7HRQk3GFCW2QasvdZxXuYj8kkQK5QrYLs';
  var privateKey = 'dd7bdefb163b31eb706ec43589c24cd27fc7878216836468bf216845c7c4aa1c';
  var private1 = 'ba9bb7f48969e94301025313c298916b2913fb7eecefe98b9128ef4d87e40ea40';
  var private2 = '6403e70451390134f2bddbe5ecb33c5b264af292fcbf2cdd97deaac7e1e8f7ba0';
  var public1 = new PrivateKey(private1).publicKey;
  var public2 = new PrivateKey(private2).publicKey;

  var thousandDOGE = 1000e8;

  var simpleUtxoWith1000DOGE = {
    address: fromAddress,
    txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
    outputIndex: 1,
    script: Script.buildPublicKeyHashOut(fromAddress).toString(),
    satoshis: thousandDOGE
  };

  var p2shPrivateKey1 = PrivateKey.fromWIF('cf2NrvygA68y6ZCAkW2ueCuQ1B8qzyWpjGY38qhjvQgZAFLhRWGB');

  var simpleWitnessUtxoWith1000DOGE = {
    address: fromAddress,
    txId: '7e6b603779c8af58284566cf1b655395fffbefaf1c0a080d9aff43f0af05d873',
    outputIndex: 0,
    script: Script.fromAddress(fromAddress).toString(),
    satoshis: thousandDOGE
  };

  var simpleWrappedWitnessUtxoWith1000DOGE = {
    address: fromAddress,
    txId: '825153a4a5d0c7ffd1a89838113a7204e5e4fa79fbac28bab0ea56c575393ed7',
    outputIndex: 0,
    script: Script.fromAddress(fromAddress).toString(),
    satoshis: thousandDOGE
  };

  var tenth = thousandDOGE / 10;
  var fourth = thousandDOGE / 4;
  var half = thousandDOGE / 2;

  var p2shPrivateKey1 = PrivateKey.fromWIF('cf2NrvygA68y6ZCAkW2ueCuQ1B8qzyWpjGY38qhjvQgZAFLhRWGB');
  var p2shPublicKey1 = p2shPrivateKey1.toPublicKey();
  var p2shPrivateKey2 = PrivateKey.fromWIF('ckoubjh1yr1Hyg8NPtGwDz4tx91b6qztxrJZgTtdR4Ed9CqAV5cn');
  var p2shPublicKey2 = p2shPrivateKey2.toPublicKey();
  var p2shPrivateKey3 = PrivateKey.fromWIF('ckrhHfB5k7NzVEqEsksYGvh2xSjZiT71oVGGSysP97bGMCkm3EgK');
  var p2shPublicKey3 = p2shPrivateKey3.toPublicKey();

  var p2shAddress = Address.createMultisig([
    p2shPublicKey1,
    p2shPublicKey2,
    p2shPublicKey3
  ], 2, 'testnet');
  var p2shUtxoWith1000DOGE = {
    address: p2shAddress.toString(),
    txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
    outputIndex: 0,
    script: Script(p2shAddress).toString(),
    satoshis: 100e8
  };


  describe('adding inputs', function() {

    it('adds just once one utxo', function() {
      var tx = new Transaction();
      tx.from(simpleUtxoWith100DOGE);
      tx.from(simpleUtxoWith100DOGE);
      tx.inputs.length.should.equal(1);
    });

    describe('isFullySigned', function() {
      it('works for normal p2pkh', function() {
        var transaction = new Transaction()
          .from(simpleUtxoWith10DOGE)
          .to([{address: toAddress, satoshis: 50000}])
          .change(changeAddress)
          .sign(privateKey);
        transaction.isFullySigned().should.equal(true);
      });
      it('fails when Inputs are not subclassed and isFullySigned is called', function() {
        var tx = new Transaction(tx_1_hex);
        expect(function() {
          return tx.isFullySigned();
        }).to.throw(errors.Transaction.UnableToVerifySignature);
      });
      it('fails when Inputs are not subclassed and verifySignature is called', function() {
        var tx = new Transaction(tx_1_hex);
        expect(function() {
          return tx.isValidSignature({
            inputIndex: 0
          });
        }).to.throw(errors.Transaction.UnableToVerifySignature);
      });
      it('passes result of input.isValidSignature', function() {
        var tx = new Transaction(tx_1_hex);
        tx.from(simpleUtxoWith1000DOGE);
        tx.inputs[0].isValidSignature = sinon.stub().returns(true);
        var sig = {
          inputIndex: 0
        };
        tx.isValidSignature(sig).should.equal(true);
      });
    });
  });

  describe('change address', function() {
    it('can calculate simply the output amount', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100DOGE)
        .to(toAddress, 50e8)
        .change(changeAddress)
        .sign(privateKey);
      transaction.getFee();
      transaction.outputs.length.should.equal(2);
      transaction.outputs[1].satoshis.should.equal(4973500000);
      transaction.outputs[1].script.toString()
        .should.equal(Script.fromAddress(changeAddress).toString());
      var actual = transaction.getChangeOutput().script.toString();
      var expected = Script.fromAddress(changeAddress).toString();
      actual.should.equal(expected);
    });
    it('accepts a P2SH address for change', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100DOGE)
        .to(toAddress, 50e8)
        .change(changeAddressP2SH)
        .sign(privateKey);
      transaction.outputs.length.should.equal(2);
      transaction.outputs[1].script.isScriptHashOut().should.equal(true);
    });
    it('can recalculate the change amount', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith10DOGE)
        .to(toAddress, 5e8)
        .change(changeAddress)
        .fee(0)
        .sign(privateKey);

      transaction.getChangeOutput().satoshis.should.equal(5e8);

      transaction = transaction
        .to(toAddress, 2e8)
        .sign(privateKey);

      transaction.outputs.length.should.equal(3);
      transaction.outputs[2].satoshis.should.equal(3e8);
      transaction.outputs[2].script.toString()
        .should.equal(Script.fromAddress(changeAddress).toString());
    });
    it('adds no fee if no change is available', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith10DOGE)
        .to(toAddress, 99000)
        .sign(privateKey);
      transaction.outputs.length.should.equal(1);
    });
    it('adds no fee if no money is available', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith10DOGE)
        .to(toAddress, 100000)
        .change(changeAddress)
        .sign(privateKey);
      transaction.outputs.length.should.equal(2);
    });
    it('adds no change if fee less than DUST_AMOUNT', function () {
      var transaction = new Transaction()
        .from(simpleUtxoWith10DOGE)
        .to(toAddress, 10*1e8 - Transaction.DUST_AMOUNT)
        .change(changeAddress)
        .sign(privateKey);
      transaction.outputs.length.should.equal(1);
    });
    it('fee can be set up manually', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith10DOGE)
        .to(toAddress, 80000)
        .fee(10000)
        .change(changeAddress)
        .sign(privateKey);
      transaction.outputs.length.should.equal(2);
      transaction.outputs[1].satoshis.should.equal(10e8 - 80000 - 10000);
    });
    it('fee per kb can be set up manually', function() {
      var inputs = _.map(_.range(10), function(i) {
        var utxo = _.clone(simpleUtxoWith10DOGE);
        utxo.outputIndex = i;
        return utxo;
      });
      var transaction = new Transaction()
        .from(inputs)
        .to(toAddress, 950000)
        .feePerKb(8000)
        .change(changeAddress)
        .sign(privateKey);
      transaction._estimateSize().should.be.within(1000, 1999);
      transaction.outputs.length.should.equal(2);
      transaction.outputs[1].satoshis.should.equal(9999037584);
    });
    it('fee per byte (low fee) can be set up manually', function () {
      var inputs = _.map(_.range(10), function (i) {
        var utxo = _.clone(simpleUtxoWith10DOGE);
        utxo.outputIndex = i;
        return utxo;
      });
      var transaction = new Transaction()
        .from(inputs)
        .to(toAddress, 950000)
        .feePerByte(1)
        .change(changeAddress)
        .sign(privateKey);
      transaction._estimateSize().should.be.within(1000, 1999);
      transaction.outputs.length.should.equal(2);
      transaction.outputs[1].satoshis.should.be.within(9999048001, 9999049000);
    });
    it('fee per byte (high fee) can be set up manually', function () {
      var inputs = _.map(_.range(10), function (i) {
        var utxo = _.clone(simpleUtxoWith10DOGE);
        utxo.outputIndex = i;
        return utxo;
      });
      var transaction = new Transaction()
        .from(inputs)
        .to(toAddress, 950000)
        .feePerByte(2)
        .change(changeAddress)
        .sign(privateKey);
      transaction._estimateSize().should.be.within(1000, 1999);
      transaction.outputs.length.should.equal(2);
      transaction.outputs[1].satoshis.should.be.within(9999046002, 9999048000);
    });
    it('fee per byte can be set up manually', function () {
      var inputs = _.map(_.range(10), function (i) {
        var utxo = _.clone(simpleUtxoWith10DOGE);
        utxo.outputIndex = i;
        return utxo;
      });
      var transaction = new Transaction()
        .from(inputs)
        .to(toAddress, 950000)
        .feePerByte(13)
        .change(changeAddress)
        .sign(privateKey);
      transaction._estimateSize().should.be.within(1000, 1999);
      transaction.outputs.length.should.equal(2);
      transaction.outputs[1].satoshis.should.be.within(9999024013, 9999037000);
    });
    it('fee per byte not enough for change', function () {
      var inputs = _.map(_.range(10), function (i) {
        var utxo = _.clone(simpleUtxoWith10DOGE);
        utxo.outputIndex = i;
        return utxo;
      });
      var transaction = new Transaction()
        .from(inputs)
        .to(toAddress, 100e8 - 1)
        .feePerByte(1)
        .change(changeAddress)
        .sign(privateKey);
      transaction._estimateSize().should.be.within(1000, 1999);
      transaction.outputs.length.should.equal(1);
    });
    it('if satoshis are invalid', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100DOGE)
        .to(toAddress, 99999)
        .change(changeAddress)
        .sign(privateKey);
      transaction.outputs[0]._satoshis = 100;
      transaction.outputs[0]._satoshisBN = new BN(101, 10);
      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.InvalidSatoshis);
    });
    it('if fee is too small, fail serialization', function() {
      var transaction = new Transaction({disableDustOutputs: true})
        .from(simpleUtxoWith100DOGE)
        .to(toAddress, 99.99e8)
        .change(changeAddress)
        .sign(privateKey);
      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.FeeError.TooSmall);
    });
    it('on second call to sign, change is not recalculated', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100DOGE)
        .to(toAddress, 100e8)
        .change(changeAddress)
        .sign(privateKey)
        .sign(privateKey);
      transaction.outputs.length.should.equal(1);
    });
    it('getFee() returns the difference between inputs and outputs if no change address set', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100DOGE)
        .to(toAddress, 1e8);
      transaction.getFee().should.equal(99e8);
    });
  });

  describe('serialization', function() {
    it('stores the change address correctly', function() {
      var serialized = new Transaction()
        .change(changeAddress)
        .toObject();
      var deserialized = new Transaction(serialized);
      expect(deserialized._changeScript.toString()).to.equal(Script.fromAddress(changeAddress).toString());
      expect(deserialized.getChangeOutput()).to.equal(null);
    });
    it('can avoid checked serialize', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100DOGE)
        .to(fromAddress, 1);
      expect(function() {
        return transaction.serialize();
      }).to.throw();
      expect(function() {
        return transaction.serialize(true);
      }).to.not.throw();
    });
    it('stores the fee set by the user', function() {
      var fee = 1000000;
      var serialized = new Transaction()
        .fee(fee)
        .toObject();
      var deserialized = new Transaction(serialized);
      expect(deserialized._fee).to.equal(fee);
    });
  });

  describe('checked serialize', function() {
    it('fails if no change address was set', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .to(toAddress, 1);
      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.ChangeAddressMissing);
    });
    it('fails if a high fee was set', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .change(changeAddress)
        .fee(50e8)
        .to(toAddress, 40000000);
      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.FeeError.TooLarge);
    });
    it('fails if a dust output is created', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .to(toAddress, 0.9e8)
        .change(changeAddress)
        .sign(privateKey);
      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.DustOutputs);
    });
    it('doesn\'t fail if a dust output is not dust', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .to(toAddress, 1e8)
        .change(changeAddress)
        .sign(privateKey);
      expect(function() {
        return transaction.serialize();
      }).to.not.throw(errors.Transaction.DustOutputs);
    });
    it('doesn\'t fail if a dust output is an op_return', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .addData('not dust!')
        .change(changeAddress)
        .sign(privateKey);
      expect(function() {
        return transaction.serialize();
      }).to.not.throw(errors.Transaction.DustOutputs);
    });
    it('fails when outputs and fee don\'t add to total input', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .to(toAddress, 99900000)
        .fee(99999)
        .sign(privateKey);
      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.FeeError.Different);
    });
    it('checks output amount before fee errors', function() {
      var transaction = new Transaction();
      transaction.from(simpleUtxoWith1000DOGE);
      transaction
        .to(toAddress, 10000000000000)
        .change(changeAddress)
        .fee(5);

      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.InvalidOutputAmountSum);
    });
    it('will throw fee error with disableMoreOutputThanInput enabled (but not triggered)', function() {
      var transaction = new Transaction();
      transaction.from(simpleUtxoWith1000DOGE);
      transaction
        .to(toAddress, 900e8)
        .change(changeAddress)
        .fee(50e8);

      expect(function() {
        return transaction.serialize({
          disableMoreOutputThanInput: true
        });
      }).to.throw(errors.Transaction.FeeError.TooLarge);
    });
    describe('skipping checks', function() {
      var buildSkipTest = function(builder, check, expectedError) {
        return function() {
          var transaction = new Transaction();
          transaction.from(simpleUtxoWith1000DOGE);
          builder(transaction);

          var options = {};
          options[check] = true;

          expect(function() {
            return transaction.serialize(options);
          }).not.to.throw();
          expect(function() {
            return transaction.serialize();
          }).to.throw(expectedError);
        };
      };
      it('can skip the check for too much fee', buildSkipTest(
        function(transaction) {
          return transaction
            .fee(50e8)
            .change(changeAddress)
            .sign(privateKey);
        }, 'disableLargeFees', errors.Transaction.FeeError.TooLarge
      ));
      it('can skip the check for a fee that is too small', buildSkipTest(
        function(transaction) {
          return transaction
            .fee(1)
            .change(changeAddress)
            .sign(privateKey);
        }, 'disableSmallFees', errors.Transaction.FeeError.TooSmall
      ));
      it('can skip the check that prevents dust outputs', buildSkipTest(
        function(transaction) {
          return transaction
            .to(toAddress, 100)
            .change(changeAddress)
            .sign(privateKey);
        }, 'disableDustOutputs', errors.Transaction.DustOutputs
      ));
      it('can skip the check that prevents unsigned outputs', buildSkipTest(
        function(transaction) {
          return transaction
            .to(toAddress, 1e8)
            .change(changeAddress);
        }, 'disableIsFullySigned', errors.Transaction.MissingSignatures
      ));
      it('can skip the check that avoids spending more bitcoins than the inputs for a transaction', buildSkipTest(
        function(transaction) {
          return transaction
            .to(toAddress, 10000000000000)
            .change(changeAddress)
            .sign(privateKey);
        }, 'disableMoreOutputThanInput', errors.Transaction.InvalidOutputAmountSum
      ));
    });
  });

  describe('#verify', function() {

    it('not if _satoshis and _satoshisBN have different values', function() {
      var tx = new Transaction()
        .from({
          'txId': testPrevTx,
          'outputIndex': 0,
          'script': testScript,
          'satoshis': testAmount
        })
        .to('DGYdw7jC17b9SappjsrAsaghhDTS8sV5Mx', testAmount - 10000);

      tx.outputs[0]._satoshis = 100;
      tx.outputs[0]._satoshisBN = new BN('fffffffffffffff', 16);
      var verify = tx.verify();
      verify.should.equal('transaction txout 0 satoshis is invalid');
    });

    it('not if _satoshis is negative', function() {
      var tx = new Transaction()
        .from({
          'txId': testPrevTx,
          'outputIndex': 0,
          'script': testScript,
          'satoshis': testAmount
        })
        .to('DGYdw7jC17b9SappjsrAsaghhDTS8sV5Mx', testAmount - 10000);

      tx.outputs[0]._satoshis = -100;
      tx.outputs[0]._satoshisBN = new BN(-100, 10);
      var verify = tx.verify();
      verify.should.equal('transaction txout 0 satoshis is invalid');
    });

    it('not if transaction is greater than max block size', function() {

      var tx = new Transaction()
        .from({
          'txId': testPrevTx,
          'outputIndex': 0,
          'script': testScript,
          'satoshis': testAmount
        })
        .to('DGYdw7jC17b9SappjsrAsaghhDTS8sV5Mx', testAmount - 10000);

      tx.toBuffer = sinon.stub().returns({
        length: 10000000
      });

      var verify = tx.verify();
      verify.should.equal('transaction over the maximum block size');

    });

    it('not if has null input (and not coinbase)', function() {

      var tx = new Transaction()
        .from({
          'txId': testPrevTx,
          'outputIndex': 0,
          'script': testScript,
          'satoshis': testAmount
        })
        .to('DGYdw7jC17b9SappjsrAsaghhDTS8sV5Mx', testAmount - 10000);

      tx.isCoinbase = sinon.stub().returns(false);
      tx.inputs[0].isNull = sinon.stub().returns(true);
      var verify = tx.verify();
      verify.should.equal('transaction input 0 has null input');

    });

  });

  describe('to and from JSON', function() {
    it('takes a string that is a valid JSON and deserializes from it', function() {
      var simple = new Transaction();
      expect(new Transaction(simple.toJSON()).uncheckedSerialize()).to.equal(simple.uncheckedSerialize());
      var complex = new Transaction()
      .from(simpleUtxoWith10DOGE)
        .to(toAddress, 5e8)
        .change(changeAddress)
        .sign(privateKey);
      var cj = complex.toJSON();
      var ctx = new Transaction(cj);
      expect(ctx.uncheckedSerialize()).to.equal(complex.uncheckedSerialize());

    });
    it('serializes the `change` information', function() {
      var transaction = new Transaction();
      transaction.change(changeAddress);
      expect(transaction.toJSON().changeScript).to.equal(Script.fromAddress(changeAddress).toString());
      expect(new Transaction(transaction.toJSON()).uncheckedSerialize()).to.equal(transaction.uncheckedSerialize());
    });
    it('serializes correctly p2sh multisig signed tx', function() {
      var t = new Transaction(tx2hex);
      expect(t.toString()).to.equal(tx2hex);
      var r = new Transaction(t);
      expect(r.toString()).to.equal(tx2hex);
      var j = new Transaction(t.toObject());
      expect(j.toString()).to.equal(tx2hex);
    });
  });

  describe('serialization of inputs', function() {
    it('can serialize and deserialize a P2PKH input', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1000DOGE);
      var deserialized = new Transaction(transaction.toObject());
      expect(deserialized.inputs[0] instanceof Transaction.Input.PublicKeyHash).to.equal(true);
    });
    it('can serialize and deserialize a P2SH input', function() {
      var transaction = new Transaction()
        .from({
          txId: '0000', // Not relevant
          outputIndex: 0,
          script: Script.buildMultisigOut([public1, public2], 2).toScriptHashOut(),
          satoshis: 1e8
        }, [public1, public2], 2);
      var deserialized = new Transaction(transaction.toObject());
      expect(deserialized.inputs[0] instanceof Transaction.Input.MultiSigScriptHash).to.equal(true);
    });
    it('can serialize and deserialize a P2PWKH input', function() {
      var transaction = new Transaction()
        .from(simpleWitnessUtxoWith1000DOGE);
      var deserialized = new Transaction(transaction.toObject());
      expect(deserialized.inputs[0] instanceof Transaction.Input.PublicKeyHash).to.equal(true);
    });
    it('can serialize and deserialize a wrapped P2PWKH input', function() {
      var transaction = new Transaction()
        .from(simpleWrappedWitnessUtxoWith1000DOGE);
      var deserialized = new Transaction(transaction.toObject());
      expect(deserialized.inputs[0] instanceof Transaction.Input.PublicKeyHash).to.equal(true);
    });
  });

  describe('checks on adding inputs', function() {
    var transaction = new Transaction();
    it('fails if no output script is provided', function() {
      expect(function() {
        transaction.addInput(new Transaction.Input());
      }).to.throw(errors.Transaction.NeedMoreInfo);
    });
    it('fails if no satoshi amount is provided', function() {
      var input = new Transaction.Input();
      expect(function() {
        transaction.addInput(input);
      }).to.throw(errors.Transaction.NeedMoreInfo);
      expect(function() {
        transaction.addInput(new Transaction.Input(), Script.empty());
      }).to.throw(errors.Transaction.NeedMoreInfo);
    });
    it('allows output and transaction to be feed as arguments', function() {
      expect(function() {
        transaction.addInput(new Transaction.Input(), Script.empty(), 0);
      }).to.not.throw();
    });
    it('does not allow a threshold number greater than the amount of public keys', function() {
      expect(function() {
        transaction = new Transaction();
        return transaction.from({
          txId: '0000000000000000000000000000000000000000000000000000000000000000',
          outputIndex: 0,
          script: Script(),
          satoshis: 1e8
        }, [], 1);
      }).to.throw('Number of required signatures must be greater than the number of public keys');
    });
    it('will add an empty script if not supplied', function() {
      transaction = new Transaction();
      var outputScriptString = 'OP_2 21 0x038282263212c609d9ea2a6e3e172de238d8c39' +
        'cabd5ac1ca10646e23fd5f51508 21 0x038282263212c609d9ea2a6e3e172de23' +
        '8d8c39cabd5ac1ca10646e23fd5f51508 OP_2 OP_CHECKMULTISIG OP_EQUAL';
      transaction.addInput(new Transaction.Input({
        prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
        outputIndex: 0,
        script: new Script()
      }), outputScriptString, 1e8);
      transaction.inputs[0].output.script.should.be.instanceof(bitcore.Script);
      transaction.inputs[0].output.script.toString().should.equal(outputScriptString);
    });
  });

  describe('removeInput and removeOutput', function() {
    it('can remove an input by index', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1000DOGE);
      transaction.inputs.length.should.equal(1);
      transaction.inputAmount.should.equal(simpleUtxoWith1000DOGE.satoshis);
      transaction.removeInput(0);
      transaction.inputs.length.should.equal(0);
      transaction.inputAmount.should.equal(0);
    });
    it('can remove an input by transaction id', function() {
      var transaction = new Transaction()
      .from(simpleUtxoWith1000DOGE);
      transaction.inputs.length.should.equal(1);
      transaction.inputAmount.should.equal(simpleUtxoWith1000DOGE.satoshis);
      transaction.removeInput(simpleUtxoWith1000DOGE.txId, simpleUtxoWith1000DOGE.outputIndex);
      transaction.inputs.length.should.equal(0);
      transaction.inputAmount.should.equal(0);
    });
    it('fails if the index provided is invalid', function() {
      var transaction = new Transaction()
      .from(simpleUtxoWith1000DOGE);
      expect(function() {
        transaction.removeInput(2);
      }).to.throw(errors.Transaction.InvalidIndex);
    });
    it('an output can be removed by index', function() {
      var transaction = new Transaction()
        .to([
          {address: toAddress, satoshis: 40000000},
          {address: toAddress, satoshis: 40000000}
        ])
      transaction.outputs.length.should.equal(2);
      transaction.outputAmount.should.equal(80000000);
      transaction.removeOutput(0);
      transaction.outputs.length.should.equal(1);
      transaction.outputAmount.should.equal(40000000);
    });
  });

  describe('handling the nLockTime', function() {
    var MILLIS_IN_SECOND = 1000;
    var timestamp = 1423504946;
    var blockHeight = 342734;
    var date = new Date(timestamp * MILLIS_IN_SECOND);
    it('handles a null locktime', function() {
      var transaction = new Transaction();
      expect(transaction.getLockTime()).to.equal(null);
    });
    it('handles a simple example', function() {
      var future = new Date(2025, 10, 30); // Sun Nov 30 2025
      var transaction = new Transaction()
        .lockUntilDate(future);
      transaction.nLockTime.should.equal(future.getTime() / 1000);
      transaction.getLockTime().should.deep.equal(future);
    });
    it('accepts a date instance', function() {
      var transaction = new Transaction()
        .lockUntilDate(date);
      transaction.nLockTime.should.equal(timestamp);
      transaction.getLockTime().should.deep.equal(date);
    });
    it('accepts a number instance with a timestamp', function() {
      var transaction = new Transaction()
        .lockUntilDate(timestamp);
      transaction.nLockTime.should.equal(timestamp);
      transaction.getLockTime().should.deep.equal(new Date(timestamp * 1000));
    });
    it('accepts a block height', function() {
      var transaction = new Transaction()
        .lockUntilBlockHeight(blockHeight);
      transaction.nLockTime.should.equal(blockHeight);
      transaction.getLockTime().should.deep.equal(blockHeight);
    });
    it('fails if the block height is too high', function() {
      expect(function() {
        return new Transaction().lockUntilBlockHeight(5e8);
      }).to.throw(errors.Transaction.BlockHeightTooHigh);
    });
    it('fails if the date is too early', function() {
      expect(function() {
        return new Transaction().lockUntilDate(1);
      }).to.throw(errors.Transaction.LockTimeTooEarly);
      expect(function() {
        return new Transaction().lockUntilDate(499999999);
      }).to.throw(errors.Transaction.LockTimeTooEarly);
    });
    it('fails if the block height is negative', function() {
      expect(function() {
        return new Transaction().lockUntilBlockHeight(-1);
      }).to.throw(errors.Transaction.NLockTimeOutOfRange);
    });
    it('has a non-max sequenceNumber for effective date locktime tx', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .lockUntilDate(date);
      transaction.inputs[0].sequenceNumber
        .should.equal(Transaction.Input.DEFAULT_LOCKTIME_SEQNUMBER);
    });
    it('has a non-max sequenceNumber for effective blockheight locktime tx', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .lockUntilBlockHeight(blockHeight);
      transaction.inputs[0].sequenceNumber
        .should.equal(Transaction.Input.DEFAULT_LOCKTIME_SEQNUMBER);
    });
    it('should serialize correctly for date locktime ', function() {
      var transaction= new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .lockUntilDate(date);
      var serialized_tx = transaction.uncheckedSerialize();
      var copy = new Transaction(serialized_tx);
      serialized_tx.should.equal(copy.uncheckedSerialize());
      copy.inputs[0].sequenceNumber
      .should.equal(Transaction.Input.DEFAULT_LOCKTIME_SEQNUMBER)
    });
    it('should serialize correctly for a block height locktime', function() {
      var transaction= new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .lockUntilBlockHeight(blockHeight);
      var serialized_tx = transaction.uncheckedSerialize();
      var copy = new Transaction(serialized_tx);
      serialized_tx.should.equal(copy.uncheckedSerialize());
      copy.inputs[0].sequenceNumber
      .should.equal(Transaction.Input.DEFAULT_LOCKTIME_SEQNUMBER)
    });
  });

  it('handles anyone-can-spend utxo', function() {
    var transaction = new Transaction()
      .from(anyoneCanSpendUTXO)
      .to(toAddress, 5e8);
    should.exist(transaction);
  });

  it('handles unsupported utxo in tx object', function() {
    var transaction = new Transaction();
    transaction.fromObject.bind(transaction, JSON.parse(unsupportedTxObj))
      .should.throw('Unsupported input script type: OP_1 OP_ADD OP_2 OP_EQUAL');
  });

  it('will error if object hash does not match transaction hash', function() {
    var tx = new Transaction(tx_1_hex);
    var txObj = tx.toObject();
    txObj.hash = 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458';
    (function() {
      var tx2 = new Transaction(txObj);
    }).should.throw('Hash in object does not match transaction hash');
  });

  describe('inputAmount + outputAmount', function() {
    it('returns correct values for simple transaction', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .to(toAddress, 40000000);
      transaction.inputAmount.should.equal(1000e8);
      transaction.outputAmount.should.equal(40000000);
    });
    it('returns correct values for transaction with change', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .change(changeAddress)
        .to(toAddress, 1e8);
      transaction.inputAmount.should.equal(1000e8);
      transaction.outputAmount.should.equal(99973500000);
    });
    it('returns correct values for coinjoin transaction', function() {
      // see testnet tx 41245c59aa4f06bc0f13f92ea65e275926591376dffb396a5c0efb7b8c2d0c21
      var transaction = new Transaction(txCoinJoinHex);
      transaction.outputAmount.should.equal(94974700000000);
      expect(function() {
        var ia = transaction.inputAmount;
      }).to.throw('No previous output information');
    });
  });

  describe('output ordering', function() {

    var transaction, out1, out2, out3, out4;

    beforeEach(function() {
      transaction = new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .to([
          {address: toAddress, satoshis: tenth},
          {address: toAddress, satoshis: fourth}
        ])
        .to(toAddress, half)
        .change(changeAddress);
      out1 = transaction.outputs[0];
      out2 = transaction.outputs[1];
      out3 = transaction.outputs[2];
      out4 = transaction.outputs[3];
    });

    it('allows the user to sort outputs according to a criteria', function() {
      var sorting = function(array) {
        return [array[3], array[2], array[1], array[0]];
      };
      transaction.sortOutputs(sorting);
      transaction.outputs[0].should.equal(out4);
      transaction.outputs[1].should.equal(out3);
      transaction.outputs[2].should.equal(out2);
      transaction.outputs[3].should.equal(out1);
    });

    it('allows the user to randomize the output order', function() {
      var shuffle = sinon.stub(_, 'shuffle');
      shuffle.onFirstCall().returns([out2, out1, out4, out3]);

      transaction._changeIndex.should.equal(3);
      transaction.shuffleOutputs();
      transaction.outputs[0].should.equal(out2);
      transaction.outputs[1].should.equal(out1);
      transaction.outputs[2].should.equal(out4);
      transaction.outputs[3].should.equal(out3);
      transaction._changeIndex.should.equal(2);

      _.shuffle.restore();
    });

    it('fails if the provided function does not work as expected', function() {
      var sorting = function(array) {
        return [array[0], array[1], array[2]];
      };
      expect(function() {
        transaction.sortOutputs(sorting);
      }).to.throw(errors.Transaction.InvalidSorting);
    });

    it('shuffle without change', function() {
      var tx = new Transaction(transaction.toObject()).to(toAddress, half);
      expect(tx.getChangeOutput()).to.be.null;
      expect(function() {
        tx.shuffleOutputs();
      }).to.not.throw(errors.Transaction.InvalidSorting);
    })
  });

  describe('clearOutputs', function() {

    it('removes all outputs and maintains the transaction in order', function() {
      var tx = new Transaction()
        .from(simpleUtxoWith1000DOGE)
        .to(toAddress, tenth)
        .to([
          {address: toAddress, satoshis: fourth},
          {address: toAddress, satoshis: half}
        ])
        .change(changeAddress);
      tx.clearOutputs();
      tx.outputs.length.should.equal(1);
      tx.to(toAddress, tenth);
      tx.outputs.length.should.equal(2);
      tx.outputs[0].satoshis.should.equal(tenth);
      tx.outputs[0].script.toAddress().toString().should.equal(toAddress);
      tx.outputs[1].satoshis.should.equal(89973500000);
      tx.outputs[1].script.toAddress().toString().should.equal(changeAddress);
    });

  });

  describe('BIP69 Sorting', function() {

    it('sorts inputs correctly', function() {
      var from1 = {
        txId: '0000000000000000000000000000000000000000000000000000000000000000',
        outputIndex: 0,
        script: Script.buildPublicKeyHashOut(fromAddress).toString(),
        satoshis: 1e8
      };
      var from2 = {
        txId: '0000000000000000000000000000000000000000000000000000000000000001',
        outputIndex: 0,
        script: Script.buildPublicKeyHashOut(fromAddress).toString(),
        satoshis: 1e8
      };
      var from3 = {
        txId: '0000000000000000000000000000000000000000000000000000000000000001',
        outputIndex: 1,
        script: Script.buildPublicKeyHashOut(fromAddress).toString(),
        satoshis: 1e8
      };
      var tx = new Transaction()
        .from(from3)
        .from(from2)
        .from(from1);
      tx.sort();
      tx.inputs[0].prevTxId.toString('hex').should.equal(from1.txId);
      tx.inputs[1].prevTxId.toString('hex').should.equal(from2.txId);
      tx.inputs[2].prevTxId.toString('hex').should.equal(from3.txId);
      tx.inputs[0].outputIndex.should.equal(from1.outputIndex);
      tx.inputs[1].outputIndex.should.equal(from2.outputIndex);
      tx.inputs[2].outputIndex.should.equal(from3.outputIndex);
    });

    it('sorts outputs correctly', function() {
      var tx = new Transaction()
        .addOutput(new Transaction.Output({
          script: new Script().add(Opcode(0)),
          satoshis: 2
        }))
        .addOutput(new Transaction.Output({
          script: new Script().add(Opcode(1)),
          satoshis: 2
        }))
        .addOutput(new Transaction.Output({
          script: new Script().add(Opcode(0)),
          satoshis: 1
        }));
      tx.sort();
      tx.outputs[0].satoshis.should.equal(1);
      tx.outputs[1].satoshis.should.equal(2);
      tx.outputs[2].satoshis.should.equal(2);
      tx.outputs[0].script.toString().should.equal('OP_0');
      tx.outputs[1].script.toString().should.equal('OP_0');
      tx.outputs[2].script.toString().should.equal('0x01');
    });

    describe('bitcoinjs fixtures', function() {

      var fixture = require('../data/bip69.json');

      // returns index-based order of sorted against original
      var getIndexOrder = function(original, sorted) {
        return sorted.map(function (value) {
          return original.indexOf(value);
        });
      };
      fixture.inputs.forEach(function(inputSet) {
        it(inputSet.description, function() {
          var tx = new Transaction();
          inputSet.inputs = inputSet.inputs.map(function(input) {
            var input = new Input({
              prevTxId: input.txId,
              outputIndex: input.vout,
              script: new Script(),
              output: new Output({ script: new Script(), satoshis: 0 })
            });
            input.clearSignatures = function () {};
            return input;
          });
          tx.inputs = inputSet.inputs;
          tx.sort();
          getIndexOrder(inputSet.inputs, tx.inputs).should.deep.equal(inputSet.expected);
        });
      });
      fixture.outputs.forEach(function(outputSet) {
        it(outputSet.description, function() {
          var tx = new Transaction();
          outputSet.outputs = outputSet.outputs.map(function(output) {
            return new Output({
              script: new Script(output.script),
              satoshis: output.value
            });
          });
          tx.outputs = outputSet.outputs;
          tx.sort();
          getIndexOrder(outputSet.outputs, tx.outputs).should.deep.equal(outputSet.expected);
        });
      });

    });
  });
  describe('Replace-by-fee', function() {
    describe('#enableRBF', function() {
      it('only enable inputs not already enabled (0xffffffff)', function() {
        var tx = new Transaction()
          .from(simpleUtxoWith1000DOGE)
          .from(simpleUtxoWith10DOGE)
          .to([{address: toAddress, satoshis: 50000}])
          .fee(15000)
          .change(changeAddress)
          .sign(privateKey);
        tx.inputs[0].sequenceNumber = 0x00000000;
        tx.enableRBF();
        tx.inputs[0].sequenceNumber.should.equal(0x00000000);
        tx.inputs[1].sequenceNumber.should.equal(0xfffffffd);
      });
      it('enable for inputs with 0xffffffff and 0xfffffffe', function() {
        var tx = new Transaction()
          .from(simpleUtxoWith1000DOGE)
          .from(simpleUtxoWith10DOGE)
          .to([{address: toAddress, satoshis: 5e8}])
          .fee(1.5e8)
          .change(changeAddress)
          .sign(privateKey);
        tx.inputs[0].sequenceNumber = 0xffffffff;
        tx.inputs[1].sequenceNumber = 0xfffffffe;
        tx.enableRBF();
        tx.inputs[0].sequenceNumber.should.equal(0xfffffffd);
        tx.inputs[1].sequenceNumber.should.equal(0xfffffffd);
      });
    });
    describe('#isRBF', function() {
      it('enable and determine opt-in', function() {
        var tx = new Transaction()
          .from(simpleUtxoWith10DOGE)
          .to([{address: toAddress, satoshis: 5e8}])
          .fee(1.5e8)
          .change(changeAddress)
          .enableRBF()
          .sign(privateKey);
        tx.isRBF().should.equal(true);
      });
      it('determine opt-out with default sequence number', function() {
        var tx = new Transaction()
          .from(simpleUtxoWith10DOGE)
          .to([{address: toAddress, satoshis: 5e8}])
          .fee(1.5e8)
          .change(changeAddress)
          .sign(privateKey);
        tx.isRBF().should.equal(false);
      });
      it('determine opt-out with 0xfffffffe', function() {
        var tx = new Transaction()
          .from(simpleUtxoWith1000DOGE)
          .from(simpleUtxoWith10DOGE)
          .to([{address: toAddress, satoshis: 5e8 + 1e8}])
          .fee(1.5e8)
          .change(changeAddress)
          .sign(privateKey);
        tx.inputs[0].sequenceNumber = 0xfffffffe;
        tx.inputs[1].sequenceNumber = 0xfffffffe;
        tx.isRBF().should.equal(false);
      });
      it('determine opt-out with 0xffffffff', function() {
        var tx = new Transaction()
          .from(simpleUtxoWith1000DOGE)
          .from(simpleUtxoWith10DOGE)
          .to([{address: toAddress, satoshis: 5e8 + 1e8}])
          .fee(1.5e8)
          .change(changeAddress)
          .sign(privateKey);
        tx.inputs[0].sequenceNumber = 0xffffffff;
        tx.inputs[1].sequenceNumber = 0xffffffff;
        tx.isRBF().should.equal(false);
      });
      it('determine opt-in with 0xfffffffd (first input)', function() {
        var tx = new Transaction()
          .from(simpleUtxoWith1000DOGE)
          .from(simpleUtxoWith10DOGE)
          .to([{address: toAddress, satoshis: 5e8 + 1e8}])
          .fee(1.5e8)
          .change(changeAddress)
          .sign(privateKey);
        tx.inputs[0].sequenceNumber = 0xfffffffd;
        tx.inputs[1].sequenceNumber = 0xffffffff;
        tx.isRBF().should.equal(true);
      });
      it('determine opt-in with 0xfffffffd (second input)', function() {
        var tx = new Transaction()
          .from(simpleUtxoWith1000DOGE)
          .from(simpleUtxoWith10DOGE)
          .to([{address: toAddress, satoshis: 5e8 + 1e8}])
          .fee(1.5e8)
          .change(changeAddress)
          .sign(privateKey);
        tx.inputs[0].sequenceNumber = 0xffffffff;
        tx.inputs[1].sequenceNumber = 0xfffffffd;
        tx.isRBF().should.equal(true);
      });
    });
  });

  describe('Segregated Witness', function() {
    it('identify as segwit transaction', function() {
      // https://github.com/bitcoin/bips/blob/master/bip-0144.mediawiki
      var version = Buffer.from('01000000', 'hex');
      var marker = Buffer.from('00', 'hex'); //always zero
      var flag = Buffer.from('01', 'hex'); //non zero
      var inputCount = Buffer.from('01', 'hex');
      var inputDummy = Buffer.from('2052cda8bc0c2cb743f154881fc85cb675527dcf2f7a5938241020c33341b3f70000000000ffffffff', 'hex');
      var outputCount = Buffer.from('00', 'hex');
      var witness = Buffer.from('01', 'hex');
      var witnessItems = Buffer.from('00', 'hex');
      var locktime = Buffer.from('00000000', 'hex');
      var txBuffer = Buffer.concat([version, marker, flag, inputCount, inputDummy, outputCount, witness,
                                    witnessItems, locktime]);
      var tx = bitcore.Transaction().fromBuffer(txBuffer);
      tx.hasWitnesses().should.equal(true);
    });
    it('correctly calculate hash for segwit transaction', function() {
      var txBuffer = Buffer.from('01000000000101b0e5caa7e37d4b8530c3e1071a36dd5e05d1065cf7224ddff42c69e3387689870000000000ffffffff017b911100000000001600144ff831574da8bef07f8bc97244a1666147b071570247304402203fcbcfddbd6ca3a90252610dd63f1be50b2d926b8d87c912da0a3e42bb03fba002202a90c8aad75da22b0549c72618b754114583e934c0b0d2ccd6c13fcd859ba4ed01210363f3f47f4555779de405eab8d0dc8c2a4f3e09f4171a3fa47c7a77715795319800000000', 'hex');
      var tx = bitcore.Transaction().fromBuffer(txBuffer);
      tx.hash.should.equal('7f1a2d46746f1bfbb22ab797d5aad1fd9723477b417fa34dff73d8a7dbb14570');
      tx.witnessHash.should.equal('3c26fc8b5cfe65f96d955cecfe4d11db2659d052171f9f31af043e9f5073e46b');
    });
    it('round trip nested witness p2sh', function() {
      var txBuffer = Buffer.from('010000000001010894bb2bbfd5249b1c55f7bc64352bb64894938bc6439f43f28a58bfa7c73205000000002322002077b16b966ee6a4b8a0901351221d279afd31d3f90df52a3fc53436ea9abde5b0ffffffff01010000000000000000030047304402200fa23efa9a8d6ae285cfc82f81e6c2196d14167553b10da1845abd2c9fe38dc502207a40a58ee5b739e902b275018dfa1bee0d608736ff4317b028fbc29391f4554f01475221037b8dc5861a0ef7b0a97b41d2d1e27186f019d4834dbc99f24952b6f5080f5cce21027152378182102b68b5fce42f9f365ec272c48afda6b0816e735c1dc4b96dd45a52ae00000000', 'hex');
      var tx = bitcore.Transaction().fromBuffer(txBuffer);
      tx.toBuffer().toString('hex').should.equal(txBuffer.toString('hex'));
    });
    describe('verifying', function() {
      it('will verify these signatures', function() {
        var signedTxBuffer = Buffer.from('0100000000010103752b9d2baadb95480e2571a4854a68ffd8264462168346461b7cdda76beac20000000023220020fde78ea47ae10cc93c6a850d8a86d8575ddacff38ee9b0bc6535dc016a197068ffffffff010100000000000000000400483045022100ea1508225a6d37c0545d22acaee88d29d1675696953f93d657a419613bcee9b802207b8d80ca8176586878f51e001cb9e92f7640b8c9dc530fabf9087142c752de89014830450221008c6f4a9ebdee89968ec00ecc12fda67442b589296e86bf3e9bde19f4ba923406022048c3409831a55bf61f2d5defffd3b91767643b6c5981cb32338dd7e9f02821b1014752210236c8204d62fd70e7ca206a36d39f9674fa832964d787c60d44250624242bada4210266cd5a3507d6df5346aa42bd23d4c44c079aef0d7a59534758a0dabb82345c2052ae00000000', 'hex');
        var unsignedBuffer = Buffer.from('0100000000010103752b9d2baadb95480e2571a4854a68ffd8264462168346461b7cdda76beac20000000023220020fde78ea47ae10cc93c6a850d8a86d8575ddacff38ee9b0bc6535dc016a197068ffffffff010100000000000000000300483045022100ea1508225a6d37c0545d22acaee88d29d1675696953f93d657a419613bcee9b802207b8d80ca8176586878f51e001cb9e92f7640b8c9dc530fabf9087142c752de89014752210236c8204d62fd70e7ca206a36d39f9674fa832964d787c60d44250624242bada4210266cd5a3507d6df5346aa42bd23d4c44c079aef0d7a59534758a0dabb82345c2052ae00000000', 'hex');
        var signedTx = bitcore.Transaction().fromBuffer(signedTxBuffer);

        var signatures = [
          {
            publicKey: '0236c8204d62fd70e7ca206a36d39f9674fa832964d787c60d44250624242bada4',
            prevTxId: 'c2ea6ba7dd7c1b46468316624426d8ff684a85a471250e4895dbaa2b9d2b7503',
            outputIndex: 0,
            inputIndex: 0,
            signature: '3045022100ea1508225a6d37c0545d22acaee88d29d1675696953f93d657a419613bcee9b802207b8d80ca8176586878f51e001cb9e92f7640b8c9dc530fabf9087142c752de89',
            sigtype: bitcore.crypto.Signature.SIGHASH_ALL
          },
          {
            publicKey: '0266cd5a3507d6df5346aa42bd23d4c44c079aef0d7a59534758a0dabb82345c20',
            prevTxId: 'c2ea6ba7dd7c1b46468316624426d8ff684a85a471250e4895dbaa2b9d2b7503',
            outputIndex: 0,
            inputIndex: 0,
            signature: '30450221008c6f4a9ebdee89968ec00ecc12fda67442b589296e86bf3e9bde19f4ba923406022048c3409831a55bf61f2d5defffd3b91767643b6c5981cb32338dd7e9f02821b1',
            sigtype: bitcore.crypto.Signature.SIGHASH_ALL
          }
        ];

        var pubkey1 = bitcore.PublicKey('0236c8204d62fd70e7ca206a36d39f9674fa832964d787c60d44250624242bada4');
        var pubkey3 = bitcore.PublicKey('0266cd5a3507d6df5346aa42bd23d4c44c079aef0d7a59534758a0dabb82345c20');
        var expectedDestScript = bitcore.Script('a914382ead50307554bcdda12e1238368e9f0e10b11787');
        var expectedMultiSigString = '52210236c8204d62fd70e7ca206a36d39f9674fa832964d787c60d44250624242bada4210266cd5a3507d6df5346aa42bd23d4c44c079aef0d7a59534758a0dabb82345c2052ae';
        var expectedMultiSig = bitcore.Script(expectedMultiSigString);
        var multiSig = bitcore.Script.buildMultisigOut([pubkey1, pubkey3], 2, {
          noSorting: true
        });
        multiSig.toBuffer().toString('hex').should.equal(expectedMultiSigString);
        var wits = bitcore.Script.buildWitnessMultisigOutFromScript(multiSig);

        var expectedWits = bitcore.Script('0020fde78ea47ae10cc93c6a850d8a86d8575ddacff38ee9b0bc6535dc016a197068');
        wits.toBuffer().toString('hex').should.equal('0020fde78ea47ae10cc93c6a850d8a86d8575ddacff38ee9b0bc6535dc016a197068');

        var address = Address.payingTo(wits);
        address.hashBuffer.toString('hex').should.equal('382ead50307554bcdda12e1238368e9f0e10b117');

        var destScript = Script.buildScriptHashOut(wits);
        destScript.toBuffer().toString('hex').should.equal('a914382ead50307554bcdda12e1238368e9f0e10b11787');

        var signedamount = 1;
        var input = new Transaction.Input.MultiSigScriptHash({
          output: new Output({
            script: destScript,
            satoshis: signedamount
          }),
          prevTxId: 'c2ea6ba7dd7c1b46468316624426d8ff684a85a471250e4895dbaa2b9d2b7503',
          outputIndex: 0,
          script: Script('220020fde78ea47ae10cc93c6a850d8a86d8575ddacff38ee9b0bc6535dc016a197068')
        }, [pubkey1, pubkey3], 2, signatures);

        signedTx.inputs[0] = input;
        signedTx.inputs[0]._updateScript();
        signedTx.toBuffer().toString('hex').should.equal(signedTxBuffer.toString('hex'));

        var interpreter = new Interpreter();
        var flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;

        var check = interpreter.verify(signedTx.inputs[0].script, destScript, signedTx, 0, flags, input.getWitnesses(), signedamount);
        check.should.equal(true);

        check = interpreter.verify(signedTx.inputs[0].script, destScript, signedTx, 0, flags, input.getWitnesses(), 1999199);
        check.should.equal(false);

        var valid1 = signedTx.inputs[0].isValidSignature(signedTx, signedTx.inputs[0].signatures[1]);
        valid1.should.equal(true);

        var valid = signedTx.inputs[0].isValidSignature(signedTx, signedTx.inputs[0].signatures[0]);
        valid.should.equal(true);
      });
      describe('Bitcoin Core tests', function() {
        // from bitcoin core tests at src/test/transaction_tests.cpp
        it('will verify pay-to-compressed publickey (v0) part 1', function() {
          var check;
          var flags;
          var interpreter;
          var output1 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff01010000000000000016001457d5e8f4701ae218576e4fdbcf702e4716808f5f00000000');
          var input1 = bitcore.Transaction('01000000000101da3ca8fe74ee2f6cc6ed02927a5fc8e9832f4ff6ad10521598f7985dcd5d17740000000000ffffffff010100000000000000000247304402202eee148a880846e3ebf9b61b5875a0c5121428d272a8336d10bae745ec401042022063b65baea1adc0e7a15801922242ab89d103143071680cfd4ba6072f8685a76c0121031fa0febd51842888a36c43873d1520c5b186894c5ac04520b096f8a3b49f8a5b00000000');
          var scriptPubkey = output1.outputs[0].script;
          var scriptSig = input1.inputs[0].script;
          var witnesses = input1.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(true);

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(true);
        });
        it('will verify pay-to-compressed publickey (v0) part 2', function() {
          var flags;
          var check;
          var interpreter;
          var output1 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff01010000000000000016001457d5e8f4701ae218576e4fdbcf702e4716808f5f00000000');
          var input2 = bitcore.Transaction('01000000000101cdc27b7132dc20e463d20458aa9d5c38e664ff114ddab8277af4ed859f2b90e20000000000ffffffff0101000000000000000002483045022100db56d1a70244f478a345478be51891b38b9a46140402cddf85b3024ca1652b4b02202c00aaa41ac941ce426ae358aa8372b63aeba945372002c47dc3725d9dca8343012103585c9f7105e09a0abbc60dc72d9d0a456030d0f10f7c47c0616e71c325085cbd00000000');
          var scriptPubkey = output1.outputs[0].script;
          var scriptSig = input2.inputs[0].script;
          var witnesses = input2.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH;
          check = interpreter.verify(scriptSig, scriptPubkey, input2, 0, flags, witnesses, satoshis);
          check.should.equal(true);

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;
          check = interpreter.verify(scriptSig, scriptPubkey, input2, 0, flags, witnesses, satoshis);
          check.should.equal(false);
        });
        it('will verify p2sh witness pay-to-compressed pubkey (v0) part 1', function() {
          var flags;
          var check;
          var interpreter;
          var output1 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff01010000000000000017a914ca8abcc57aff5ba3fb36f76fe8e260ce6a08e0bf8700000000');
          var input1 = bitcore.Transaction('01000000000101b85d4c861b00d31ac95ae0b2cad8635d8310fb7ca86b44fefcbe2b98c4e905bd000000001716001469f84dbc7f9ae8626aa2d4aee6c73ef726b53ac2ffffffff0101000000000000000002483045022100c0237a5743c684642b26347cf82df0f3b3e91c76aff171f7d065cea305f059a502205c168682630ea4e6bd42627c237207be3d43aeba5c1b8078f3043455bdb6a2270121036240793eedd7e6e53a7c236d069e4d8558f4c6e5950114d7e3d5e1579c93fdf100000000');
          var scriptPubkey = output1.outputs[0].script;
          var scriptSig = input1.inputs[0].script;
          var witnesses = input1.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(true);

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(true);
        });
        it('will verify p2sh witness pay-to-compressed pubkey (v0) part 2', function() {
          var flags;
          var check;
          var interpreter;
          var output1 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff01010000000000000017a9145675f64cbe03b43fb6d9d42debd207e4be3337db8700000000');
          var input2 = bitcore.Transaction('0100000000010104410fc0d228780b20ff790212aef558df008421a110d56d9c9a9b6e5eeb1a680000000017160014b9c556bc9c34cf70d4c253ff86a9eac64e355a25ffffffff0101000000000000000002483045022100dd41426f5eb82ef2b72a0b4e5112022c80045ae4919b2fdef7f438f7ed3c59ee022043494b6f9a9f28d7e5a5c221f92d5325d941722c0ffd00f8be335592015a44d2012103587155d2618b140244799f7a408a85836403f447d51778bdb832088c4a9dd1e300000000');
          var scriptPubkey = output1.outputs[0].script;
          var scriptSig = input2.inputs[0].script;
          var witnesses = input2.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH;
          check = interpreter.verify(scriptSig, scriptPubkey, input2, 0, flags, witnesses, satoshis);
          check.should.equal(true);

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;
          check = interpreter.verify(scriptSig, scriptPubkey, input2, 0, flags, witnesses, satoshis);
          check.should.equal(false);
        });
        it('will verify witness 2-of-2 multisig (part 1)', function() {
          var flags;
          var check;
          var interpreter;
          var output1 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff0101000000000000002200204cd0c4dc1a95d8909396d0c1648793fa673518849e1b25259c581ede30e61b7900000000');
          var input1 = bitcore.Transaction('010000000001010d81757bb9f141a2d002138e86e54e8cb92b72201b38480a50377913e918612f0000000000ffffffff010100000000000000000300483045022100aa92d26d830b7529d906f7e72c1015b96b067664b68abae2d960a501e76f07780220694f4850e0003cb7e0d08bd4c67ee5fcb604c42684eb805540db5723c4383f780147522102f30bb0258f12a3bbf4fe0b5ada99974d6dbdd06876cb2687a59fa2ea7c7268aa2103d74fd4c6f08e3a4d32dde8e1404d00b2a3d323f94f5c43b4edda962b1f4cb55852ae00000000');
          var scriptPubkey = output1.outputs[0].script;
          var scriptSig = input1.inputs[0].script;
          var witnesses = input1.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = 0;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(true);

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(false);
        });
        it('will verify witness 2-of-2 multisig (part 2)', function() {
          var flags;
          var check;
          var interpreter;
          var output2 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff01010000000000000022002067b786a598572a1a0fad2f8f48e90c3f2cc89ef110f029f35323b15ba6e9b2f900000000');
          var input2 = bitcore.Transaction('01000000000101812d39aa60f01c994c43bc160c87420b6b93bf8db2fe658df45f152250fae9100000000000ffffffff010100000000000000000300483045022100ae56c6d646656366601835e6bc2d151a9974cb1b7cbdeba27cc51ef8c59d2e3f022041e95e80d3e068eb278e31b07f984800869115111c647e2ca32718d26d8e8cd401475221032ac79a7160a0af81d59ffeb914537b1d126a3629271ac1393090c6c9a94bc81e2103eb8129ad88864e7702604ae5b36bad74dbb0f5abfd8ee9ee5def3869756b6c4152ae00000000');
          var scriptPubkey = output2.outputs[0].script;
          var scriptSig = input2.inputs[0].script;
          var witnesses = input2.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = 0;
          check = interpreter.verify(scriptSig, scriptPubkey, input2, 0, flags, witnesses, satoshis);
          check.should.equal(true);

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;
          check = interpreter.verify(scriptSig, scriptPubkey, input2, 0, flags, witnesses, satoshis);
          check.should.equal(false);
        });
        it('will verify witness 2-of-2 multisig (part 3)', function() {
          var flags;
          var check;
          var interpreter;
          var output1 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff0101000000000000002200207780f1145ef7ba4e703388c155d94bc399e24345e11c4559e683d5070feeb27400000000');
          var input1 = bitcore.Transaction('01000000000101791890e3effa9d4061a984812a90675418d0eb141655c106cce9b4bbbf9a3be00000000000ffffffff010100000000000000000400483045022100db977a31834033466eb103131b1ef9c57d6cea17f9a7eb3f3bafde1d7c1ddff502205ad84c9ca9c4139dce6e8e7850cc09a49ad57197b266814e79a78527ab4a9f950147304402205bd26da7dab9e379019ffd5e76fa77e161090bf577ed875e8e969f06cd66ba0a0220082cf7315ff7dc7aa8f6cebf7e70af1ffa45e63581c08e6fbc4e964035e6326b0147522102f86e3dc39cf9cd6c0eeb5fe25e3abe34273b8e79cc888dd5512001c7dac31b9921032e16a3c764fb6485345d91b39fb6da52c7026b8819e1e7d2f838a0df1445851a52ae00000000');
          var scriptPubkey = output1.outputs[0].script;
          var scriptSig = input1.inputs[0].script;
          var witnesses = input1.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(true);
        });
        it('will verify p2sh witness 2-of-2 multisig (part 1)', function() {
          var flags;
          var check;
          var interpreter;
          var output1 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff01010000000000000017a914d0e24dc9fac5cfc616b364797de40f100086e9d58700000000');
          var input1 = bitcore.Transaction('010000000001015865ee582f91c2ac646114493c3c39a3b2b08607cd96ba573f4525a01d1f85da000000002322002055423059d7eb9252d1abd6e85a4710c0bb8fabcd48cf9ddd811377557a77fc0dffffffff010100000000000000000300473044022031f9630a8ed776d6cef9ecab58cc9ee384338f4304152d93ac19482ac1ccbc030220616f194c7228484af208433b734b59ec82e21530408ed7a61e896cfefb5c4d6b014752210361424173f5b273fc134ce02a5009b07422b3f4ee63edc82cfd5bba7f72e530732102014ba09ca8cc68720bdf565f55a28b7b845be8ef6a17188b0fddcd55c16d450652ae00000000');
          var scriptPubkey = output1.outputs[0].script;
          var scriptSig = input1.inputs[0].script;
          var witnesses = input1.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = 0;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(true);

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(false);
        });
        it('will verify p2sh witness 2-of-2 multisig (part 2)', function() {
          var flags;
          var check;
          var interpreter;
          var output2 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff01010000000000000017a914294b319a1c23951902e25e0147527c8eac3009c68700000000');
          var input2 = bitcore.Transaction('01000000000101d93fa44db148929eada630dd419142935c75a72d3678291327ab35d0983b37500000000023220020786e2abd1a684f8337c637f54f6ba3da75b5d75ef96cc7e7369cc69d8ca80417ffffffff010100000000000000000300483045022100b36be4297f2e1d115aba5a5fbb19f6882c61016ba9d6fa01ebb517d14109ec6602207de237433c7534d766ec36d9bddf839b961805e336e42fae574e209b1dc8e30701475221029569b67a4c695502aa31c8a7992b975aa591f2d7de61a4def63771213792288c2103ad3b7eeedf4cba17836ff9a29044a782889cd74ca8f426e83112fa199611676652ae00000000');
          var scriptPubkey = output2.outputs[0].script;
          var scriptSig = input2.inputs[0].script;
          var witnesses = input2.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = 0;
          check = interpreter.verify(scriptSig, scriptPubkey, input2, 0, flags, witnesses, satoshis);
          check.should.equal(true);

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;
          check = interpreter.verify(scriptSig, scriptPubkey, input2, 0, flags, witnesses, satoshis);
          check.should.equal(false);
        });
        it('will verify p2sh witness 2-of-2 multisig (part 3)', function() {
          var flags;
          var check;
          var interpreter;
          var output1 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff01010000000000000017a9143f588990832299c654d8032bc6c5d181427a321e8700000000');
          var input1 = bitcore.Transaction('01000000000101ef6f782539d100d563d736339c4a57485b562f9705b28680b08b3efe9dd815870000000023220020a51db581b721c64132415f985ac3086bcf7817f1bbf45be984718b41f4189b39ffffffff01010000000000000000040047304402203202c4c3b40c091a051707421def9adb0d101076672ab220db36a3f87bbecad402205f976ff87af9149e83c87c94ec3b308c1abe4b8c5b3f43c842ebffc22885fc530147304402203c0a50f199774f6393e42ee29d3540cf868441b47efccb11139a357ecd45c5b702205e8442ff34f6f836cd9ad96c158504469db178d63a309d813ba68b86c7293f66014752210334f22ecf25636ba18f8c89e90d38f05036094fe0be48187fb9842374a237b1062102993d85ece51cec8c4d841fce02faa6130f57c811078c5f2a48c204caf12853b552ae00000000');
          var scriptPubkey = output1.outputs[0].script;
          var scriptSig = input1.inputs[0].script;
          var witnesses = input1.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(true);
        });
        it('will verify witness pay-to-uncompressed-pubkey (v1) part 1', function() {
          var flags;
          var check;
          var interpreter;
          var output1 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff01010000000000000016001449ca7f5980799857e4cc236a288b95dc7e647de200000000');
          var input1 = bitcore.Transaction('010000000001014cc98b43a012d8cb56cee7e2011e041c23a622a69a8b97d6f53144e5eb319d1c0000000000ffffffff010100000000000000000248304502210085fb71eecc4b65fd31102bc93f46ec564fce6d22f749ad2d9b4adf4d9477c52602204c4fb00a48bafb4f1c0d7a397d3e0ae12bb8ae394d8b5632e894eafccabf4b160141047dc77183e8fef00c7839a272c4dc2c9b25fb109c0eebe74b27fa98cfd6fa83c76c44a145827bf880162ff7ae48574b5d42595601eee5b8733f1507f028ba401000000000');
          var input2 = bitcore.Transaction('0100000000010170ccaf8888099cee3cb869e768f6f24a85838a936cfda787186b179392144cbc0000000000ffffffff010100000000000000000247304402206667f8681ecdc66ad160ff4916c6f3e2946a1eda9e031535475f834c11d5e07c022064360fce49477fa0898b3928eb4503ca71043c67df9229266316961a6bbcc2ef014104a8288183cc741b814a286414ee5fe81ab189ecae5bb1c42794b270c33ac9702ab279fd97a5ed87437659b45197bbd3a87a449fa5b244a6941303683aa68bd11e00000000');
          var scriptPubkey = output1.outputs[0].script;
          var scriptSig = input1.inputs[0].script;
          var witnesses = input1.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(true);

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(true);
        });
        it('will verify witness pay-to-uncompressed-pubkey (v1) part 2', function() {
          var flags;
          var check;
          var interpreter;
          var output1 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff01010000000000000016001449ca7f5980799857e4cc236a288b95dc7e647de200000000');
          var input2 = bitcore.Transaction('0100000000010170ccaf8888099cee3cb869e768f6f24a85838a936cfda787186b179392144cbc0000000000ffffffff010100000000000000000247304402206667f8681ecdc66ad160ff4916c6f3e2946a1eda9e031535475f834c11d5e07c022064360fce49477fa0898b3928eb4503ca71043c67df9229266316961a6bbcc2ef014104a8288183cc741b814a286414ee5fe81ab189ecae5bb1c42794b270c33ac9702ab279fd97a5ed87437659b45197bbd3a87a449fa5b244a6941303683aa68bd11e00000000');
          var scriptPubkey = output1.outputs[0].script;
          var scriptSig = input2.inputs[0].script;
          var witnesses = input2.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH;
          check = interpreter.verify(scriptSig, scriptPubkey, input2, 0, flags, witnesses, satoshis);
          check.should.equal(true);

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;;
          check = interpreter.verify(scriptSig, scriptPubkey, input2, 0, flags, witnesses, satoshis);
          check.should.equal(false);
        });
        it('will verify p2sh witness pay-to-uncompressed-pubkey (v1) part 1', function() {
          var flags;
          var check;
          var interpreter;
          var output1 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff01010000000000000017a9147b615f35c476c8f3c555b4d52e54760b2873742f8700000000');
          var input1 = bitcore.Transaction('01000000000101160aa337bd325875674904f80d706b4d02cec9888eb2dbae788e18ed01f7712d0000000017160014eff6eebd0dcd3923ca3ab3ea57071fa82ea1faa5ffffffff010100000000000000000247304402205c87348896d3a9de62b1a646c29c4728bec62e384fa16167e302357883c04134022024a98e0fbfde9c24528fbe8f36e05a19a6f37dea16822b80259fcfc8ab2358fb0141048b4e234c057e32d2304697b4d2273679417355bb6bf2d946add731de9719d6801892b6154291ce2cf45c106a6d754c76f81e4316187aa54938af224d9eddb36400000000');
          var scriptPubkey = output1.outputs[0].script;
          var scriptSig = input1.inputs[0].script;
          var witnesses = input1.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(true);

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;;
          check = interpreter.verify(scriptSig, scriptPubkey, input1, 0, flags, witnesses, satoshis);
          check.should.equal(true);
        });
        it('will verify p2sh witness pay-to-uncompressed-pubkey (v1) part 2', function() {
          var flags;
          var check;
          var interpreter;
          var output1 = bitcore.Transaction('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff01010000000000000017a9147b615f35c476c8f3c555b4d52e54760b2873742f8700000000');
          var input2 = bitcore.Transaction('01000000000101eefb67109c118e958d81f3f98638d48bc6c14eae97cedfce7c397eabb92b4e320000000017160014eff6eebd0dcd3923ca3ab3ea57071fa82ea1faa5ffffffff010100000000000000000247304402200ed4fa4bc8fbae2d1e88bbe8691b21233c23770e5eebf9767853de8579f5790a022015cb3f3dc88720199ee1ed5a9f4cf3186a29a0c361512f03b648c9998b3da7b4014104dfaee8168fe5d1ead2e0c8bb12e2d3ba500ade4f6c4983f3dbe5b70ffeaca1551d43c6c962b69fb8d2f4c02faaf1d4571aae7bbd209df5f3b8cd153e60e1627300000000');
          var scriptPubkey = output1.outputs[0].script;
          var scriptSig = input2.inputs[0].script;
          var witnesses = input2.inputs[0].getWitnesses();
          var satoshis = 1;

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH;
          check = interpreter.verify(scriptSig, scriptPubkey, input2, 0, flags, witnesses, satoshis);
          check.should.equal(true);

          interpreter = new Interpreter();
          flags = Interpreter.SCRIPT_VERIFY_P2SH | Interpreter.SCRIPT_VERIFY_WITNESS;;
          check = interpreter.verify(scriptSig, scriptPubkey, input2, 0, flags, witnesses, satoshis);
          check.should.equal(false);
        });
      });
    });
    describe('signing', function() {
      var privateKey1 = PrivateKey.fromWIF('QQWs5STTjnuVVWBsKwaZtc8SCzzKGDf5iZ6qgZyaPqqDEjLmF5tA');
      var publicKey1 = privateKey1.toPublicKey();
      var privateKey2 = PrivateKey.fromWIF('QQWs5STTjnuVVWBsKwaZtc8SCzzKGDf5iZ6qgZyaPqqDEjLmF5tA');
      var publicKey2 = privateKey2.toPublicKey();
      var privateKey3 = PrivateKey.fromWIF('QQWs5STTjnuVVWBsKwaZtc8SCzzKGDf5iZ6qgZyaPqqDEjLmF5tA');
      var publicKey3 = privateKey3.toPublicKey();
      var address = Address.createMultisig([
        publicKey1
      ], 1, 'testnet');
      var utxo = {
        address: address.toString(),
        txId: 'fbc2d0fb7fcca46338f6dc032958c1c0ebb05ffff1a3bac1ad76264be7394fc7',
        outputIndex: 1,
        script: Script.buildScriptHashOut(address).toHex(),
        satoshis: 1e8
      };
      var nestedAddress = Address.createMultisig([
        publicKey1
      ], 1, 'testnet');
      var nestedUtxo = {
        address: nestedAddress.toString(),
        txId: '1d732950d99f821b8a8d11972ea56000b0666e4d31fa71861ffd80a83797dc61',
        outputIndex: 1,
        script: Script.buildScriptHashOut(nestedAddress).toHex(),
        satoshis: 2e8
      };
      var witnessAddress = Address.createMultisig([
        publicKey1
      ], 1, 'testnet', false, Address.PayToWitnessScriptHash);
      var witnessUtxo = {
        address: witnessAddress.toString(),
        txId: '3766d6853e39d2b92cce8bb8e2e11dae33a33b2d352761d05411efb2556320f6',
        outputIndex: 0,
        script: Script.buildWitnessV0Out(witnessAddress).toHex(),
        satoshis: 1e8
      };

      it('will sign with nested p2sh witness program', function() {
        var tx = new Transaction()
          .from(nestedUtxo, [publicKey1], 1)
          .to([{address: 'n3LsXgyStG2CkS2CnWZtDqxTfCnXB8PvD9', satoshis: 50000}])
          .fee(150000)
          .change('mqWDcnW3jMzthB8qdB9SnFam6N96GDqM4W')
          .sign(privateKey1);
        var sighash = tx.inputs[0].getSighash(tx, privateKey1, 0, bitcore.crypto.Signature.SIGHASH_ALL);
        sighash.toString('hex').should.equal('f2b2dace70c98ecfb8b9b8bfd4697275ca683a250a5437956e120fd4e526aa01');
        tx.toBuffer().toString('hex').should.equal('010000000161dc9737a880fd1f8671fa314d6e66b00060a52e97118d8a1b829fd95029731d0100000070004830450221009c709313381b0f53fcb2b197862eb23147eceef3ae6714c3b60e9c6cfc2c720402207872f44bdd4f3668c03fac20a922dac16bebe657c3bcd65c3a77a5917449da99012551210304c1a51134235dc282641432811a26d367d4ea52b4ac5e20c107668b010fdd4b51aeffffffff0250c30000000000001976a914ef6aa14d8f5ba65a12c327a9659681c44cd821b088acc0b4e80b000000001976a9146d8da2015c6d2890896485edd5897b3b2ec9ebb188ac00000000');
      });
    });
  });

});


var tx_empty_hex = '01000000000000000000';

/* jshint maxlen: 1000 */
var tx_1_hex = '01000000018594c5bdcaec8f06b78b596f31cd292a294fd031e24eec716f43dac91ea7494d000000008b48304502210096a75056c9e2cc62b7214777b3d2a592cfda7092520126d4ebfcd6d590c99bd8022051bb746359cf98c0603f3004477eac68701132380db8facba19c89dc5ab5c5e201410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8ffffffff01a0860100000000001976a9145834479edbbe0539b31ffd3a8f8ebadc2165ed0188ac00000000';
var tx_1_id = '977e7cd286cb72cd470d539ba6cb48400f8f387d97451d45cdb8819437a303af';


var tx2hex = '01000000018594c5bdcaec8f06b78b596f31cd292a294fd031e24eec716f43dac91ea7494d000000008b48304502210096a75056c9e2cc62b7214777b3d2a592cfda7092520126d4ebfcd6d590c99bd8022051bb746359cf98c0603f3004477eac68701132380db8facba19c89dc5ab5c5e201410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8ffffffff01a0860100000000001976a9145834479edbbe0539b31ffd3a8f8ebadc2165ed0188ac00000000';

var unsupportedTxObj = '{"version":1,"inputs":[{"prevTxId":"a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458","outputIndex":0,"sequenceNumber":4294967295,"script":"OP_1","output":{"satoshis":1020000,"script":"OP_1 OP_ADD OP_2 OP_EQUAL"}}],"outputs":[{"satoshis":1010000,"script":"OP_DUP OP_HASH160 20 0x7821c0a3768aa9d1a37e16cf76002aef5373f1a8 OP_EQUALVERIFY OP_CHECKSIG"}],"nLockTime":0}';

var txCoinJoinHex = '0100000038034f3b58eac99c11f28b08e1ff6d76ed7e97d5bd6d63c32cbaf080320bfb791500000000da0047304402200cc00b163656afd4b648ee04641fa8803e2186ff379bf7658a4177162a8dbfcd02207f8d59e5429dfe276021461978a846dc4baff3949a4b7393bf5aae6733f56ba901483045022100b3f31a1aeef06e5133ab7ce046c3fd08639c515c5bb4c7a8bb4f9aeec1c88d18022059e19906b661c4d3e437e346673ce53a8fd967f351f8b00d5af6f9c7b66d9e8d0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffd3b35cc023fcc5d069a07ebae23a7d889d358490181ad453ebd277f8de22bba600000000da0047304402203268d253ff96cb3a21fc7231380bc2876381c35453de015f69e81ab8d84f5ce9022051eadc516f374a7c7d1d15293ee15cda223f23f066c6c0e140bed48e37110a9501483045022100c68d1636ec30a5b03e05d0af517a26a90a0e280a9a6987240fd6d17375605c8f022040da028d9171300bd6a95f8455ccaccc18b9e2ea141f32616b9935127aaf5dce0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff41c3b00781b5fc8c41ca25ede0940fa7431aaee19f3e36b8147224ac09c3010801000000d900473044022001171841291220d064325f1f1e25416845887550304dd5d3772e2cafc03d221c022004d7abefcf3207d4c030a9a8c7683d45ef7d0bd4a0a1558d52ebdf8696e340bb0147304402203b2cfb16ede232229f63006b512fdd9197f36de5cd9404c7923655744bf4699502205c86905727264aad52da299e18321d471415062c91465b7493fa1576300f5b000147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffa06112e276fd05e55ce5dd8c0aefd6e931a057a1e854134933bbdc29b1629cd201000000db00483045022100ddaa81ce0f640a5af98f0497860aa0be67ee18ec754e61e73dc959ae504239570220272e69982a3e1e8bbe786ecedf5b360c0583bf8772407d44ba62c887b295859801483045022100fe83604c2a189918d3cfb949b435d6cf7960d28f0171522326760bee841987e102201247e308d83209c95d0a6a3051f60215f6c5e1549dfaf6cfabf1aeea0f170c3c0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffed3c3e263bc968c9b3bd4bf041c84470c1dfb6f49ae5dd8a9df40effd80ac43d01000000db00483045022100d214e17995dbae1cc5a17c526cb0743fa74d10a35be00a3c8464e3a133699cdb022049ce73fadea49dc0baf6101a7d3217d856005d8c59945d98f601c3c686e0d0b101483045022100ad69e2af1d6019875e9b4f483becb89fcefa60e4a88f01673bc099b4369deba8022062fe71ef3eb22d7faef563a7a6a92bcf2ae61150a42db8ddbdd488851a961c610147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffed8e2fe9a0b33cf9c0f637e7762672cbefec3662a0f55806bd83dd2321a2b91101000000da0047304402206bcb96c3125420f92db5c01ad1facaef433064abe91d4e1f6091109b6915d6510220450bb39b1e385dedd969d953d09903e4ea02a2a47dc42a5086a373aeec488a14014830450221009ad7ea5e5e921e3934c1f954dc7c26b642f138db556b0176d8e8bd8f1ee63b2102200ccadab85c6c6b39eac849dce696924bdcf72a59af5d7558449ac711491366e20147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff40052a3a37cac756fe0566794d3e5c7649ff65e4657b39e96788512ba4640ceb00000000db004830450221009df3dd3b0f424abf3fa30ab0c41340318755f7ae37fd438ccd8e6a7f551645e402200ceb35d4b7687f97d9439d597e74009b06504934624070a14dfa783efcb79f0a01483045022100930fc7d1d841882bc0857cda50045cd88e01667c58bcf4546281faaf657bc1d902203808d8f940bd63ac9fdccbacf426492a5cd6f92823a1b439426f81e2edc390f80147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff7d6ca157b8b84e0117283885c0e118ea9ce374fc44331c4bef56140f53e0337201000000da0047304402200208a49a233fbed55ab6358bd7992b53cfc2b4392d3d6fe21d021194e7d21ceb02206f335c0f79abfe7cf2cf63c1704e3706d170e3595b10f4f78f0249fcf3f7e67501483045022100bba4a09737baed06a5a4fd99a7d4877c29128bbfba6e01b0fac665bd8d0051d002202f8d78f31096129023845f0380dafd5a314cabacffd7a0e74bbe77853b3149880147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffdb43dbd722ce2ee800ef4d5780dab1d459ca47cf451efb36e025dfb19787359501000000da00473044022028610b40bcea56601c7c800985b4cf3376703b92feb21ca9388b1f8da8a80f03022048f4880b0bafebc77dd1f88f206fc74681bc27ce1159349a796dd5ac86390e1b01483045022100de34139e6214d900404abf5eec24ede622c8af91c21cbceb88e3d223ce841ec702200b442c54d3fd896a5c514e2f25705890e52fc08ad06b0c329de096814934b9820147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff005a9666e8d4042eb69cea007795df7b878f0cf62ac23f97af0d883da2652d6600000000db00483045022100985093425302eb5c12692f354c17bd66e77f4c752e8ebdd398db59627b03a8cd02206ca5859c537550321c641b143a9510dc5bc5aaa6aff7ba6bed03fd0ac8976099014830450221009d92c2ea8f04e5ec11f579cdb24bc2506dbdc110bb26dfb7557ebad97d5dcf3e0220194da1eebf91e0163c4cf806fc14071e34e83bce4134bba65738fd578073b2cc0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff88b5173430806fa1f943b2f1219243952cda1a176e61787e8d8e38a44a599feb00000000d90047304402205182b95108341b6d9f5ec19153d44f1d8443102fdb0ba04c8fce05a2dd49b8de0220053172239b46c31ffa62f1f6b2a564cf199b623f32a9fed1a943f3d3e3304e390147304402207f9a14b13f87a5452dc52a0df240486ad492853ea4b6d0a25f7ae7bf10083907022041a71d0be73b641676310fe0b9b66a22f0898510f3ed19ba4df5e16a65d1e4850147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff972db7427eeeba3cc5e350cb0eda7b5e8b1a24502ae9d8710d5d81b6ced2478d00000000db00483045022100878923da25ce669a6a9d04be0c2053f275cf689b16799bc60972283c9f32ef2c02203ff85d7d3136e879150ec075361383ab01847667b11a715bcf4a610631085fef01483045022100888a14b9d37f2cfe5b7dae80f268e02061e82501fc0d514584b2c8496f1f9e14022029005456e5157c8d45727c7e0f59e2915a4722847e1dddfc36db722202318e700147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff51dad14aa18fc2c1141b1ad8bc65035b1223e682ae2f3d5e6609caea14500d3600000000d90047304402203156295528bd951d93940dc0c4a8f3479dd9ff519cfc6816185aa180b59adf4702202aee7d55b805cb69917ca74d91b18a2864136ba6874f096f9f65f1cc34def956014730440220752152505cc76c8649796bcf3de214590b3056f6d8a6b1529c3217c43876bf43022008cc6bc94667bf25fc28c4025d7b58399548352e0c95ea8d53fc6b7062b7c8620147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff9fe4aa198165c54f3ccfeb2e252f1e54b6df826b6ab841c1ab12eae4147c0db100000000da00473044022003b7d96336be30d5a12d0e94c57821e235bfa321fe109a930dd345bed3eaeebd02204bccd021c21c268a206204c0bcc8e2a48034cccd91f370cb9958ef7b0e494c6001483045022100e95bda20ad9d633baba664a5dae523598f7ba346c3c8709a64f68715e0542ace022058fa255aca4571d2cfa9f773036d5c3d47620fadede6f735cfb6ae1f6efe9d790147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffb6d3ae464efeaca087eeb594024cc46b2c04bd1fc46ae4028587bdaa669d10e901000000d90047304402204ce39e1951824eb73fcfd487aaa5ecf06bffc0f8e976941434b0bc80c93572c2022037b454c2e41d9ac568950f501e677575387f967f8c46efcf62f4ac72e763616001473044022041e7b62afaf548eea50d815fcc00576d4c4acdb20d55d52c01af1ebb045a888d02207060df68798b66a456b2544e4c78b308974d8a1e4e37ca340a1656f750f1c79d0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffdff342d0561002a5d1328f50d7f677e7f9057da988f46009083ab4b02242ff1701000000da00483045022100960c2b5335a2c5e4b188749fbf35a2fe2067e21d7441f03fbac571c45ee0069e0220735c8637d5b0283d64349f46dccf3525cdf81a8e95bfb599503af8d9d68b7a5d014730440220753ab5730248f3d63892af501963554849701bdb957f5469c221ed7a5d646b2202204e32ae6c1a84430698828644be557c4002d1927a984d5b47e824a91a90d44eb20147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffc3b44ae7c73a10425d9198be1c601228aa4e3724360edb893f966950afa9660f00000000d900463043021f5fd7e8a62d1f7a690abb2b7e2d9790f970a82fa9cb14b1dc18342fbd6feba102203d9fe4a36172db0e94096619c5a16644b26fbbb73607db3e65b9d12b663da54e01483045022100c6ce909c549a3b04cee36c00a0f8f3e2db56684f6dcd6fde7cb8c682123c56d3022016aea4f3dc638a6cf55f1a62e1ba194547f4cb10dd61bdd7338e3db5bde14ab10147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffd44cd763c6b5aa043eccc076ddcfb4aa64235c94e2e5da36b702117744dadd1101000000da0048304502210099dc35dd5367c97dd31138f925259a4bd59a4c872352cdc52e3fdcdf844140e20220546fe4e054188dc776ac65251a451daa91b6fa33e9e79cfac0dba22f2de6808b01473044022029f56f9c2b0cdc7c674a6a28e976d44fb713cb98c77a28f6c1862bc71f8afac80220777ffa8a551ade1c44a1463aabccb5de92acf3071a4cfc60904ddd30ffb0e0010147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff7b28e393b64c8a416ba539e4745ec0264b57ee7f133e0d896dbfecb8ad2ae51001000000da00483045022100e07e79197d9fc904db7e753bfa5252532905a57a59966530661a721ea0ea4d0102202007a5dfb29a6b3d5d12b0ea9c41cf5a88cd183f7b65b810e3eac23e51b457710147304402204f5b25fd097492ede0813de666d1562a78b73b92123eb98c66933a9449d2540a0220382ba36d521f79939b11a1c34f1b8a61dffd7f0c41c87cc142eb13278fb5a2790147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffdb22784b66bd1c9782a259432305f7a179c3bc8a0008dd33f5214509ce69fd7700000000d90047304402207cedef7a\
13d94f8da19da082ec50290f55b470f367238a9341c277e46620f54c022069ec82ae60b89bbd37b505540b46837e6f5c94b4b762e13200ae6209933997cd0147304402200fc1faf7cfc153a2830c247ac35c6f5dea5c4753a079e1d5c9b2f9e8b351c9ef022061ba178632a54232e7f7bf676534bdc5f33de0e73dfe838bcf0853df7d3826c50147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffbf9e90a0ad4342c3b0fbfe29e8e0a2e71d1a4793fbdf9bbebf8e8b82f1d0cca901000000da0047304402205ceb5c060a7b689936b36eefdc7274e8a9c280fbb99d1fbc2e618d95b67c12ba02203ea47b944453fae4e9b2a75825718275804f338a09f2b11146d34979dd325da1014830450221009d6387852a723e1357b24cfd71fbcbc71b45ddecffe3fa6642a673919dd18b8d022025905ae22beda79fab4a4722ba69912ce4e70eda312a0a987e6754b81d32f7e20147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff7e4d07af11178f7e364f1df3fc7767df71e271f445fd8cc1ae299ebeb4ed93e901000000da0047304402200f6a54fe9f637029659151301ca3c0cc10a9e64a4f806aa03da8db3e7c6cee31022059e4f870f742bc4346e1c458bb3d160a4a91e10124c886a6698cd1edd6f315bf01483045022100a4d671b3f1f4b155b63bcccc417c44caf099fce0b11012bab8da872194f61b8502206f5b9ace45544119637d9273e466551d9ae6e83f100beb4b6a48bbb5121b252d0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff5bf485bac99791577e9819ccfc84cfb7225b74334190e7304938e9a0c44c16a300000000d9004730440220764cbd687f6daeb6ebba9b5792f3946905db0cf2e1cc6fb048d5dabc27f0c6d802203f6bcdfb324836165efd6f158521a53b9716ab848419722dfaf3304a9bd2c3a60147304402201587589473dcae931558ae8fd3c75c086ca21b09ec1c6153709c0e1fe941b18f02204cc2c9aee3d4c9a9fae815b20a765421a1014b1bcaa4c143a92a45ba059ca9670147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff22b650a695399bc000106b9c3c7ca47f0a2c0978a454e800ff375c235c27bffa00000000da00483045022100bf3a98c481e4a3ae17651617977cbff937136ef9cb6cfe0c926fe9a538a0e58b02201b90b62d86fd8d8310ccfc30c01a0f39d8a742d7cf7f26ded2b2b3ed3ca170c901473044022070a850185118ed8de2c9b3d0a8fd511692f5e903a4a9c4e7792126c326651ecd02201975724e9fe059c0c02e3acc03a5afc9c53f8e47cfeffe488faa41bbc995f8e00147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff54816c065bdaf3b595c95d3e566e31c0454eb1d94e994939cccd9dea4c716f3c01000000d9004730440220370f3b98da750bd55911b341e4ccc6d0c3fb412f2d9d78497fdd71b2a0c89d8a02201764a6dbc606260cc1e9572dbe6868454206065387c7ed61e8914e4c784b238e0147304402202db1ef4883e2f16dd8eb612eaef2c3620b66bc6346f450c1199c26e35523aae8022049dd5aae566e9b5221cb13c734b483c5591806d5a7a8f9a91bd343c9b8d980590147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffa85e5746d1494410b2f4f92944f88fb2dbab6532410479d177a3c257aaaa265a01000000d90047304402205457c02894a1ca431c421397d7b9e12360a272fce271f4201225881f09f1af7e0220739d05fda222633c335ce2ad1fe097e7a429bed3f5819b182fc7cd909c1eade8014730440220386e69163a992355f379a17fb765496a3feb8d7358301c9c96deb340b9b039f302207a17be43acdc3e3b80aad2f637a1d29596a6ff80200caf788a710a88f09418fb0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffdabef0a8e7f64ce511f9ef2ea989675901c72d45640dc920a924ddce6cb0a93501000000da0047304402206921690417c46277310b67af1382d7d551fe85b0ae1e9b3aad27a5e23de51f110220307c7a28394d80adcaa85f7ced79e60e5be001980ede84efae3eb925a41bdfcc01483045022100f048988461df6a2fa4210fcca07f73020acddfcc5b0fbc57b4e84cba0008c95f022061af31703bd82fb8057b3ef1b39de096cc27daad11e3b7bec374e9aeb38bd9d20147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffb174ebd2442691ee56718c72b5bf9445b8c4174898ee36fcddd280c420a1486c00000000db0048304502210095adf5c2f6fe3abcd238f90dedd76a1681248ac00253b1e616dbb1fca222610e0220269962859bc72daff4f0d3395d1a05cd034f9ddbcf8fb0326f463c43d1eccf7a01483045022100b70154edaabbdd6d8060d03b3d2ad5608c458a5eb872cabbb05fdbf60a7d3fa1022073a2beda249c494fa56705fe9e529c09f9e5a5d5285917e433f302a802b8dc880147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffa8fec2d5ca45205466928ff85515f3ca82e26051c04864ba520070e06fa4240800000000db00483045022100de0e22ef334ad2a2589c94d42e528fa3064f01bad40ca614333927828a36ea1502201cdb688606ecde7b69f188cc22145616a89b84c274d2f1da97b2924144743b2b01483045022100c22911ed056ba78ceeb6982b761bd245f07f62e08355fc69a232368c532e759c02204ec9b62c57c0ddc0e90a3d87417219b6234aca1ad837dec6938111774c348c290147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffbda31f1de5738fa4eb3d783236ffded0d2ac862362e8679f85f281bcdc6225f401000000da00483045022100ad59de39e2c048fb92710e74ee3a6e3f6d5ddc1fe2ba280d427ccc185c07c4e302205e325300b14834cc2ab8929b98da782a074cca93524c47770fbc003d2d32551c014730440220624dc463c44960bb3741001ab34c481433c12ca1e6e3c8e40cdfd0b19a198a1402207963256ded52d59b9fca89092fe19d1833ddeea4264c884a13a1d3ca136c28660147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff40bf2d1a0c12de1123d80c26593099d87e161dd5a900f1908b3938f630760b5301000000da004730440220289232f0499032b148fbd11bd374b461ec3cfca202c763fe2d866114c232767e02204231ef75ad9d0f5321ffacaa984070729943b2d9f9e365dcf126f07895c7e16d01483045022100d76f5c142357fa45c363c26e94d57d00fe143f20aabec9427ad4d0e05d95e2c002200e4017376a112b97a957cc91a330540ab179eef429ceb4975d9ff2bde474c50c0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffce3a9215c0275aa59767262fae1eaa9d12816c4e7ee66ca524277b48ceeb53dc01000000d90047304402201917afb3f97be72d26330106baa11b265d2e319a0972c463f4f6491a5175431a02206e964047fed16a1f0e833bf58806b1db8995e132213fd1eb26c4eebd97ce208e0147304402202bf516cac2b07b7dd5a4de45f721fc7172f16e8eb49ff33a2147f660f5465eae02203e395fdaa51101b95a5385a2f076bbd33ad15d09bac029e2316fed818eb425540147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff4a80ece18545d0cc5888a41fe70e774532981ff4d4dc4dfe5551f0e920fba9c201000000d90047304402206d3028b10dba921b8ff24eef2210323d83475a057de33349baa1f0e9b0e56bf302206b36444a1fd928c60d1680c0b24c2b7c659310e63a073c6bb19340c19c48ee9f0147304402201bdfc002d39bb2910b09cc1f8ee47f73c8dc49e353dc3bcbbb423ad8a168fcb9022061668499fed20d2645991ebd46ccfccc7905c3f1c3ca25fc95d9b596966dca630147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aefffffffff7bf6e61002f7cf959b6e3dae5ddb32005f60c4732f96026bc6723832ed7b93d00000000da00483045022100fef9edf72bd94b7ec159c8e7a613102f595acf43a4134ac8cbf170bb09421ddb022072b05e61be6a1fa33ca3842090bf9199c13193bb59bc9525f412c6a7d8b71b4e0147304402207b23c23688830909b7bdd451dcc05d23db2bb4af420bab6456315d2e8349c9180220066602794602018e3141af6aa85813b61f0bab9b5d711a92bf3d5ba44b4855f00147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff7f9a197fa42896ec552bc02d0d923ae2ec3fb87161f0349951af842a5b85b53600000000d9004730440220743490aa726386bfe9e0681beaac7f7eb9b87d23b82303ff30e69ec7d38763d502203e09f606bcd888ad539e2e5c8269bf3a2fd674902221c998270b28b2ab33c96101473044022036b5b983ad37b51ada8fbcdd9f2b94e713bbfa25471b379d0c8794d26713b42602207b4b073855c374698b7d0a6bf2bca7b20ebed3974003ed371e6f685aecc7fefd0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff423dee21fcdde5839789ca26b89a014d18e2a162d1234ded3c4c0d8ac91a37e400000000da00483045022100bc76f7445ab74c4d16d03be480368b2be33755d0ea6307207544362c03f8a80a02202393b0c291f60b5c6c21daa538844e15c559d760be4be4a90968b190542921da01473044022021f2ec111b12643c9973c092f1079d94f94943ba8ee6ded495d3bca68a49c6de02207ed3d3ac872675ee8a9e88b3ce35b4ff98ce9bcd29f4d780ac47db6c0b8ffd4c0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff17c74008ef15a9db44026393c2aa97f5b9faaef9b2317dd4c9c8b823ba5bfa3d01000000da0047304402204af5afb002cb834e908115028670490b7860e823b1001e88c72b91c27a0f109102206d656d9d1d34e0c3284d3b2438f6430109310d6f2f1c6f14f4cb6df7c356015c01483045022100d5b4e3f39adaf147bcd56123792af1692b0fa2a4506dfcc2f0d1fd23488442bd022043745092bad9163284ce3862b3fb1d4134982a2e6993bdb1771af8f2083adf110147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff973a82c20d403eb8048580b5ebb17b79d5a99d524e6d208e9ec9948f570f897201000000da00483045022100d772a8ad7fbd8d743ceb61161682d39e3772a2f78f826181b39ae6d2fbbe05a402200fdaef6a80e92df97dd3d842425d806fcd3a5c6bf4e99de249c08b865c68eb9501473044022075f20e4c6bfe3c973c488368a4af369c3ee72793c77b38e296407900bd81e363022003c36e74c26d14d2ebc541f1c97bee974ab3191e5d5b15b8ff7fb377767750e70147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffa51a59acd49eed251570bb6b5c7b0107c243c44d989eb8d828eda252e7f6089a00000000db004830450221008568eb026b67cf9b20f894a72542bd83dea81c91046e7d6d1994ea561ff9c71b022041790b4a90a17780513d1afa0ffd65bb12ed5401d1595f33730c57ce830a2a910148304502\
2100a7c72060540d52b2ef23f337a3e3ad7a13ae6259ded1960c56d8f6cd66b599a402207c8c3f20a8fa47723c7c78f7326d1db132549388ea1024ea247e0c3149d2d6a80147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff1eacaa2643021e41ab3bc1f563c89af256fdc9f646c4398cf4bdb011c34c170100000000da00473044022025df0ccbf1dac5a0a729e9eee286251cdac4e64d2befe3c1c660b83651c94d5202202cf7f28ea493774c26b8969d06e3cee2687c7ff760beeba4755bdc0b96b6347001483045022100b180ee70a75b4d3855d527dffe34aa1393ebe3d9f33f02958fba2529014166ab0220231b553ccf7dfac69c3db0bddc575d8eb82409158048dcc5a3dd3b048da533c70147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff68596a5caefeec85d3515d3a7f7b769d5360ce276869b8bc1aad9704386f8f8401000000da00483045022100cf450ec1061736d77ed7e2747eb1f0485591caf42593017dd32caecad6a4474c022015ba8405eeff2758377c5b0aa7a613a859dca50bcb64994dbd86b67de7e544710147304402203a3e73032b591eddd8187a461246132254f8c3b4dd50f20e44aa18392478abe402202f39668856b167d209f8ea5da093c15236df32e61913d70ae4c2ca63fea14a9c0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff669a0c52bb11a6cb12fb8e164b7282b12d244bc03d76c88a51ea28e5acf45a8501000000da00483045022100936d54241bcf1a2f355e6092009f476fd06cf6213a6e58ea1454bd037347229f0220153cbbb9e0d0d0a2ec8188e847d563837b3a17b69c14059820325104e8fc2b030147304402202d825d99122aedc03f182c8a5cfbde576ce351ed39ecd37cca70abc8ee79ce3002205c7655d87b4cd11430ff9a53236e7caa8b0451c44ad5a219cf3794ddd59278560147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff25e984a24b4b8b6a2ffc35595459d44e989e8fd96479441892501b7cbbf711bb01000000da00483045022100fd095530781a629024479d03ce9909a4e5321df9a223972d4cf857c1bb05e0d60220491af56cadf4fb5cfd39f64c4e9b8e9dff0977f668ca96e2397fda5bf277a0460147304402207f0617b2cd5c7ceb090c486f647feedeb4e2688c78ce8c04f2e8f4ed5a51095e02203a5e91af580242977115fc386e8e2094a9fb7891247956f0bba8a8903254dd060147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff0f059e895e180f4ad78c63e49340dae33b61c81d8554d5ad7d7eba049934103500000000da00483045022100ef1a57f18f1546b2b28da295adc6493b78415ffbe84af727a50ee40715a68a9c022032d15491e119e7fa8e231e95cbd4945237f2f441301baea93a27a316aba47f2d01473044022015682812067f321931b2b0c8b895e0804df0da90987f80a312f4be53dfc8f6b7022035b775277d03d585b04a8ca5b82ca120a5fd3779c1c8d939e9fd9a975974e8060147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff37838d57d6afd3f3128f27f9d2171d799c5001c7868b2874759b95448e51364c00000000da00483045022100c1e9bf273b3e3524e5c22f1b1735a860dfbdfebe2aae07fe38cac21e17e4bbcf022033813ffcf7f8099afd69bdec22e5d8d2fe87ba79eb5c7e03c9f4c876cdd42a630147304402205e3720404b9ac3daa0ad52bf18e4d37907a80040621cf3f4b2d1703dc7ca686e0220523ccd10d0ceb4d603cdefacd5fd263fa30c72e59445abfdc16f84233ab2ac6f0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffc1eb338264a28f7b8522249034ba7e4211276da6cafc0e57c2c2d5e0dab1d7c000000000da00483045022100cd2a6f0eb86a0a70bfe3c2cef2f7100138911df19bc304fff606f6dc7faa0aba022061b7a6f3a18080dd43dde647ca68d446fa1e2adc5b429aa8020085384d729b1b0147304402202a93b74c5b80f2428be18b8716591c9477818e92ad66507e1ebf0771df5d6b5d0220085e14993f55858f3347cddbdd886f3dc3ac5fd999206875ce04d8bd251372030147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffe4555395bf41b0aa9186b75f558b06bee687992f3da44115334a7784c3d312a501000000db00483045022100e9846a5bf1a2d126321e6b4a04f2465ea4ffaa819bf3569a25d5779eabaeec65022061d7ac75fd178bb9617299253c4be3ed243d99010e83e3b67995440e1511713b01483045022100934b87dfea556875b9c1f1df455a83a4ca9bfee850ef5026182bf087fc4e9d5902204addde9ea31c0044cb41b851c2f685a56079fb3c32b646710eaed90144bbac060147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffb95f29afb4a4af054c3b759b79a87dcd7e69cba5d3f63d35fbbe36b3c3eab71500000000db00483045022100a8a1b631b5edc7c75e6fd2fecd29e56f7187a8e1c3cc83f4cbf60d028f13646602206965fcbba35d7dd634aa39a2640ab9468aae4b7ee871595f9cf3add2a8f74bff01483045022100b087adf8d105a7243d5b282485acee1df85598d7ea195f9a4ad07efd8af4ff6d0220182ba619ad823f480758fef66ea9e853c2bf2098e3775de603673b53feb16cb50147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff8934e42603d683f1d5378542ab74c295b13ef676dfc58d477ff0efba0d38311d00000000d90047304402207b2dcfdf87529d466e55de4938bf0bd0add15af90b3206d324544acc40de986a02202df24fc9558e66a9837ee2751ef86ae4399037098c665d7165cdd0fefef8b04b01473044022007eee5464dfa2adaecfbee0522009caa483e611c72291f80b3cd4ccaefc483d602205c6b96914017f6588102982808f0a01ea55984d2fb616b44359b7bfb464636e50147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffc192cdf66e99fd83f171d5d6d8d3034ac924fbd70cead421d5e99e55b175d2b600000000da0047304402200e04be64b469cf3c6de886c060dfd00136f4834bec4b8802958c07d6bd4de84f02207b3d5fcbe67c9cbf599362932f8ebc510f490bccf09964cbfa91bfac6a1f3d5a01483045022100d2806d4dc7360b6dad6b1ffc76fa751e7ae13be847fbe21ba8d7bd11cec50158022004c339d44e515c9f8a929529ece29497524fabee9fe74b4cd5f063eb96e6648a0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff9d55377009eadd763c543eb704ad0ca34e669d8684a27af5a59972e51eb4da6101000000d900473044022037367d51b2a65110eade57d76bdded478f4999532700e632555ce1bb7e16e0ff02202cde055a62f40b2341edfda7c7e722c3a041c1dba7e891f78d945b9f2a80ae550147304402205f0567d064435bfbb2fe79938538dd4b48ef4c4c4af23a5e8f6fe7cb5722f957022042e4ab10f1617c016fb2714b6bfff9e3e76ee3f30e4bd9e3e3d1e113b55ed9ca0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff3864e5b2b847c03e67ae4bb8d20e9c3a9d930a9f17a6fe76084a9762cee0e78000000000da004830450221009cfd7d6c8cff99146e1458b9fe2402efac6829f4d68fb1126c103360dc0ebd4702205d78db470a557de9d99d3a3658b6574e3995b0218a62fbe4163393eee080428801473044022037670cd4172c26fe048daafc9102a142984a6dda541760858c1771a78151d8470220699437b6709f2cb6fbfc2ad1fdf8bc70b6d00e37addaa0879ec033d43612fe490147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff12795de98bc62f4273a5a04bb15ec1677e12dfeb714b02a530f4e8a1334f229b00000000d80047304402201c2f5d59c58179a1e3c9d1661f8cdbf073a04d16cb67c54beaa6ef2cd3fe22b602203424dce1e458e1505a8bf1cca37793481acc5b89b9081cb7d2e959f9b4b1dca60146304302203cb53e1e5e6c2701ac9775837df82ed20b53d4ef243d948c52dc3a63cab0eee8021f6cd0b34f229b75e2d9aa96214f164c03a4281cd1f4149fee86d53498a2e1360147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff30614a59ef7937cf9ffd0ad38ff38634cf8b75bc7119481068cdadcbbd8b495000000000da00483045022100d516d0b29aaebcd98c3e5b666b6be6309722828795dbaf7ce6d6b06640e37fda022020b4fcb9d0df6cdc9cd53eb3c61d010922a1ea48366240e5402f9a25b99375d3014730440220353e8640f2b7a963fc5da408c27fc3989b16e5956840d46c9d4413fb314c959d02205d10f7d5d6adec4ef69076663e45f0e4c0c779ce2da3e6c8a1622e8012f26ced0147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffff3d48887d799a318e3a7a907e3a4a699a2589d38a4c5e436d8889d7d8d6e735a800000000db00483045022100918965396e7be810add914578b6befc8e5ed1523b597dbad112ae5ab2b47dd1502200088a7f5b8f0c4288bdb919ac377f1bbacd0f454a3a0d9dfc1bde2cef2b3420b01483045022100eaf4f5b5f9d2acffe8dd3584c3fe095454c063ef78ab13b57c9bf7d8037d063302204fae3980ae427dd1da633edb5a14713a60f7c5fb151517c4480a9bff04d2d2e30147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffb50f8d00f9de410f0c117948b108763849470e475eb79312664ce2f6190ebf0003000000da00483045022100e4b08ccfe1b8b82d067d77ddc2911bb5fff5eb597575d5db97b4572086d2d7ce02205f8d06d3289269b6a6d66d168ee4589aac7d680985b120536eb64eeb13bbfafd014730440220616fe970f425e5af3e95354411b7d47d1662bbc1855ad22811845648e26f68230220520d8389df590d7bb4addb557ae760a75b1c2d0820e8ad50757a77a02076cb510147522102cbfc2fd76cbcc09aa90c0fdd65690391b965fdd682b938868da998f3048931b321029a4b8c607096ea03e1cc984a9552e6c974b702b12002ec3450ac1327defb631b52aeffffffffc900ca9a3b000000001976a914a796534e84f376e475c0d4093a64ed4c4c62ce4788ac00ca9a3b000000001976a9141ce00e600ab9d370a37b9681ad80e5e7223d2f7988ac00ca9a3b000000001976a914f22581e9da8a25927b35a49adbe2a10d27ffe2cc88ac00ca9a3b000000001976a914d976a27ffb75429736213b56d76c21746f04ab8588ac00ca9a3b000000001976a9143ba59c4196b534f52b17edeb9d51f8590d9f533088ac00ca9a3b000000001976a9143b27324db408e686d1edd8dd9dabe7ead876beef88ac00ca9a3b000000001976a914dd4094695c8e0ffed68907d9de64a0c285e20f2788ac00ca9a3b000000001976a91477596ced178087316c6069f1552e6b12fb56cd2688ac00ca9a3b000000001976a914010e95eafde57d38d9ef3218bd27a948aaafd2e488ac00ca9a3b000000001976a914ddfde121269c2d1f6dbebc9bb0d6635fa1e4ffe488ac00ca9a3b000000001976a91484a128b5d75845568aebaa3fecae51c2fa478eb088ac00ca9a3b000000001976a9148cdba2af15073fe6bb8afb6bceed1df6e302cd3788ac00ca9a3b000000001976a9145ba854ab7df08b72460feb38224b95c26\
2037c0188ac00ca9a3b000000001976a914a6739009d3698ac6026f5d09c34a4ddb8b5fbe2e88ac00ca9a3b000000001976a9141c4864b337717f1876ef13b7d36b0a253181692588ac00ca9a3b000000001976a914b442a4f0dc79aa4b66cf5c92e87c8f21fc05cfce88ac00ca9a3b000000001976a914208915a7587cf0ca45de7e091722f1343a76c35b88ac00ca9a3b000000001976a914ac4215512e4ce2292c0949ab7a9a3c070db10a1288ac00ca9a3b000000001976a914d52bf6de8eec4dcda08e6b363b3a66873d5ab46e88ac00ca9a3b000000001976a914155711fca78a0deff29859885bc3f059f2e535b088ac00ca9a3b000000001976a9142f4c42f79bef719f27c65e22b100c964d3eb54d888ac00ca9a3b000000001976a9144fd839e463b838fe7bc50a91eecfa4b47d1fa7af88ac00ca9a3b000000001976a914301e9ccd32e54a31013ea3f3f4e6f5037c037b3d88ac00ca9a3b000000001976a91464991db52d2fa2af1144e97e2c2303eecae2e0a988ac00ca9a3b000000001976a914b8210b38bafc42a039e72a53c51191b69c8f4e4288ac00ca9a3b000000001976a9147f00d15e455b7f84d7eaa587d57e3e4e9991d82388ac00ca9a3b000000001976a9142e27953ae4fb421d45b2bfe8877a1e9fe33f589688ac00ca9a3b000000001976a914a7559e59ce938b17b8cf0e913ac3ae306c42561088ac00ca9a3b000000001976a9144dba3a8ca9f371fce49fd8fc99482a88730b3c3588ac00ca9a3b000000001976a914fa989e12f1c04fad1f9daa12a796c1f44f2d5a3f88ac00ca9a3b000000001976a914fcbc85d42d39049ffe03cb1af473092612755fcc88ac00ca9a3b000000001976a9140bc883595883a801d823e279d89bce091ba3b91988ac00ca9a3b000000001976a914bbad558bad14699e887a7ef9ecef681fe830af3888ac00ca9a3b000000001976a9144288f600de05e9f17a0baee006b4421ba4630d3088ac00ca9a3b000000001976a914e0d2bcb35302f18520e15a23c5fa75c273e824c988ac00ca9a3b000000001976a914669db967bc2e4f4bc4ec22b503e3e42d695f32fd88ac00ca9a3b000000001976a914d38f157fa075a131a52140514a629ae3bed2792188ac00ca9a3b000000001976a914051fa880f130c73e72c850fe201b87371ed0b67188ac00ca9a3b000000001976a914851009834dfefcf2b65365239684857b2af61f9688ac00ca9a3b000000001976a9142c38bd5455cf08428d43ef7e35faa591306ccd3188ac00ca9a3b000000001976a914bbbc545c53bbe767c60c88926c88e750fbf088d188ac00ca9a3b000000001976a9149d8d4d30b73798bac2839020bbd9b0f3686eafc888ac00ca9a3b000000001976a9144234ae4b9ec0d2957b9c721ccb1c7209deeec35d88ac00ca9a3b000000001976a914456ae89beee2612721196c8e78304e8e7f8972f688ac00ca9a3b000000001976a91462f16f55cf6610b5da2b488549328ff0ea09860488ac00ca9a3b000000001976a914e803462b3c79ffdae766033c813d98bcaf969acd88ac00ca9a3b000000001976a91457579a02381046de6835b0adf8de59866e3fb88988ac00ca9a3b000000001976a9141a25bf19ec77d83708049903aa6802305fe9640a88ac00ca9a3b000000001976a914520100679ca431e34bdabd59dab66acea2d8739d88ac00ca9a3b000000001976a914b1fd58d35d29536206e36b0163624921ed1547d388ac00ca9a3b000000001976a9146d2a54a0d4622a52e138ba7dd830682c7ace2acd88ac00ca9a3b000000001976a9142533d00c6998085dc9cb3a4d2ef62dfdd43ee14988ac00ca9a3b000000001976a914c7046ede041e1f91bc9dc20983f6e65f97fa54ab88ac00ca9a3b000000001976a9146d293b5fd30bad1a3cd3325e0ca43f7a6dd3bfe788ac00ca9a3b000000001976a9149bd49d34606596be5f77f6da9fab8fd9ef99b29888ac00ca9a3b000000001976a9146e57a603a01191987575b0609ae25b946807b37288ac00ca9a3b000000001976a91403925ad672c658df06da12f8a6b8fff8e31e06fb88ac00ca9a3b000000001976a91414e1fa5c52012d3c4d682eebf86e87ffe15a3fcf88ac00ca9a3b000000001976a91497705a02f410a65a9cf087a23f4e471ce66c6bee88ac00ca9a3b000000001976a9143e012dad19a1c8d5d7e3d8e47436c254fa80513388ac00ca9a3b000000001976a914c4dbc744e457a0d020e3247fe1b3eb8c8b5e322c88ac00ca9a3b000000001976a9148773c9a004e9c5e272fc611d1d5fcd0069bb860c88ac00ca9a3b000000001976a9140512099df691b9a4dc155f1461c92afac3d500f888ac00ca9a3b000000001976a914658120ccd00bc00a3d02e9ae8cd4048850b485c388ac00ca9a3b000000001976a91457a2595ddfd77854f77db58022738c9606fc921288ac00ca9a3b000000001976a9148992e5b73d5746c57fc5929fb82bee4874ae883688ac00ca9a3b000000001976a914e47bcccdee21cd078001908bd565b25dc0fec6a888ac00ca9a3b000000001976a914dee5452a2da9aededb022f11fab05e05ca58178a88ac00ca9a3b000000001976a9140d4a3838b92da22bfbb95f14df0e43f9e4b5ed3988ac00ca9a3b000000001976a9140ad4b993ab101e5dfac9d0e07b9cbd67f95a478c88ac00ca9a3b000000001976a914c759da456750406e2ad92129def13a1d5c72d3c088ac00ca9a3b000000001976a91484fcc778724d6c166b2cdbdd182e3436f22eee1d88ac00ca9a3b000000001976a914cc4a08a1dc61b4bb50bd48dbe62c94c93321ec2088ac00ca9a3b000000001976a9148d59183741f58dcc5da5bb608dccecc439dec83b88ac00ca9a3b000000001976a91493f0cb4a79382ec1997329470e07968984961a7688ac00ca9a3b000000001976a914f4a677fa274d2c9f142ba4d31846885a572de88d88ac00ca9a3b000000001976a914be24116cc4ba09555169869bf7f1c56f8090bb9b88ac00ca9a3b000000001976a91406daec0d3fcaeb8f6713d38cf79503b60be9731e88ac00ca9a3b000000001976a91450a4146185474ab5bcee8b81970f4c8eef9e155c88ac00ca9a3b000000001976a91464d7f4052dede282ee33f40189bfcb36fcb8e0df88ac00ca9a3b000000001976a914a016dfd94afe166ded9f8820436309241f99a8d188ac00ca9a3b000000001976a91460edbe1f6343d67e613a4b674082dd3ce82920cd88ac00ca9a3b000000001976a914b469f0ca3c6feacb524d8bca659c42bce808486b88ac00ca9a3b000000001976a91420cc4a655f2834402e2d8110bf0340a1746e55fe88ac00ca9a3b000000001976a914308524c4b8e97cb62f5f7df08e0afa41fc4fc98788ac00ca9a3b000000001976a9148f43805c2db32136b976f12c08113ae493d469cb88ac00ca9a3b000000001976a9148be0ceb365038c3ce2f485164f40d926fa63e53a88ac00ca9a3b000000001976a9146ef8e43c59dbd6fd43a11f440a934aef9333e92d88ac00ca9a3b000000001976a91493335e329c7419091b2ea1f98f298ec5e1c599ad88ac00ca9a3b000000001976a914198e8762f051cc35c2ed14bbaa8cd5af16b3917388ac00ca9a3b000000001976a91440aea68c50555cc1b094e3a20dd0145c9d3e227c88ac00ca9a3b000000001976a9147a0656bb4e983bfb21f20929225e97a178009ce388ac00ca9a3b000000001976a914824a843ff1f61925bde653730b1b5fbfcc38b0f388ac00ca9a3b000000001976a9149e28b2f0f45d9afa6146036dcd64c07b9f3f50c488ac00ca9a3b000000001976a91471037618b95bfe8a06f0a2b7a3ebd15187689b7488ac00ca9a3b000000001976a914c9bc079adaea0171f501fc5ad978489193a15eef88ac00ca9a3b000000001976a914b32467e4b72f8406fefbf91c58ee2b30e69fc51288ac00ca9a3b000000001976a91419ede180c3eebff9d657d8896ccc67f4f4e9b3c688ac00ca9a3b000000001976a9145d7f1bc1dd8944533b46f8cfa665a5ec488f913588ac00ca9a3b000000001976a914ac126b7a5ee3c3b4eda421c2802fe446845fcc0c88ac00ca9a3b000000001976a91420241ba87f9fd7c57a0dd334287133315d6a1be488ac00ca9a3b000000001976a9149c401417b8c342d690b3e080bdd660332f38947288ac00ca9a3b000000001976a914a5aa88c5e6da4e96c972906207cfdb6cc65d3e6188ac00ca9a3b000000001976a914785583f29748ec0047c3a9b66f574dbbdb4e844688ac00ca9a3b000000001976a9141fdf29a192ee88ced09fa61a77830f0332f7114a88ac00ca9a3b000000001976a914b0b7472e29d44e4602d5ab415a5378008a4fa9ae88ac00ca9a3b000000001976a9143798af14a87ec9afd16ba0aebf48fd383aec391088ac00ca9a3b000000001976a914b4dff33c068f4736acf63511fb02eab13443033e88ac00ca9a3b000000001976a9145883decc64ae4caf6aa7dd6b0f56574ec060c8d888ac00ca9a3b000000001976a91483f85fffe4c8c4ca709d357965060da89859c79788ac00ca9a3b000000001976a9146760e0e1d7b92bea81e4145e99fe4eb3b1f10e7e88ac00ca9a3b000000001976a914cdd5070cac3bd9ed3762400ecb492fb0afde852b88ac00ca9a3b000000001976a9143ff2a01f154c11d1bdc0d3b8ed315038816078f988ac00ca9a3b000000001976a914e0308a8ed3ddb48272c1596076e648c7dfb55fe088ac00ca9a3b000000001976a914927bb8fb5b5b01867ebf13ad22962128e68d968a88ac00ca9a3b000000001976a914fe9ff7b95121882f288fbf52fc6b6c93cfde40a288ac00ca9a3b000000001976a9149b92b981b4542a258d770f13af295208db9dbcc588ac00ca9a3b000000001976a914a8d1256916120e35c35a21aaa0ddfb4c01c2b01c88ac00ca9a3b000000001976a9147b07115259a7a6f81cb2750cb24d36462948254f88ac00ca9a3b000000001976a91422c30bcd8ed838409ef28df0d5a31008dc98ce2088ac00ca9a3b000000001976a9146790c1a1d08924186be87bd82c8e39cf0c22546688ac00ca9a3b000000001976a9142bd534ff51ed1bc1d8ff17c226734f66b79cfe2b88ac00ca9a3b000000001976a914dfd8c405821a1b9b20d37e5befb3b903a45e190988ac00ca9a3b000000001976a914f054736c18fda737211d63353cd8a2854897b18288ac00ca9a3b000000001976a9147eb5183fcbcd61f5382f8edef6e2c45cdaaa78e688ac00ca9a3b000000001976a9149290e28158b4eef1049fb144581354998885452288ac00ca9a3b000000001976a91410c8d9ad42734bc59ad6338bf9bc06ed9c677ec888ac00ca9a3b000000001976a9142948e81b5e843ac08604106d6c94118b1073c2fa88ac00ca9a3b000000001976a914fb106615920fa8f796307a27c4537c487f11544688ac00ca9a3b000000001976a9142b3a07f762088482cb2b53d7ac9aa7a0c9af16b888ac00ca9a3b000000001976a914cd3878e5f3cc57037309027e2b2bb4c7fe30a09988ac00ca9a3b000000001976a91480c7ba95b3cd863cdf7f3b6c43d999c8e1e8c20288ac00ca9a3b000000001976a9144bf7194ffd25cdc0349c0c191574783dc9dc3de288ac00ca9a3b000000001976a914829a2527d210c1f83cabf1e26fcafe092182a42a88ac00ca9a3b000000001976a91490b413400b5a0053690f64dd0ade1e8df1058f9188ac00ca9a3b000000001976a914c64e48d6f3dfb75d0e22b375f8f01c0126deb42d88ac00ca9a3b000000001976a914eed5014b8c5bc2d4e1d587ac3ba054f7d5d5c1c788ac00ca9a3b000000001976a914c27f0e92c6bef2f138c4af09fe64c013267bb62688ac00ca9a3b000000001976a9141003123f86fc9b9ad1bdb47b8041d7979b07dc3c88ac00ca9a3b000000001976a9145030801eb80a1a63f7426d59960ed8f846b0c25e88ac00ca9a3b000000001976a91416381b394c98fd646ec772125daf84657f7acb4888ac00ca9a3b000000001976a91425afc09c61b4355ca6504970d759fe65eb9bc8c988ac00ca9a3b000000001976a914a9b4827036c649162bc552bcdc4ad2530f0adb0088ac00ca9a3b000000001976a914a20f3a91fc6bc28d15ccf609869dc7aa2df6d4c588ac00ca9a3b000000001976a914343f5de6fd5124e35fbf93734ccbe833aefa90d988ac00ca9a3b000000001976a9143306beee740d50b46b01b41e2a7ec5e392ceef6788ac00ca9a3b000000001976a91468477836af57c75815ec847f9ae636c72a872d3688ac00ca9a3b000000001976a914af5f5f15bf1baa2519a38aa936c078d0b3bf10f788ac00ca9a3b000000001976a91407f71e4c835937952fd2867e9e6137852bb0d6cd88ac00ca9a3b000000001976a9140efb0aba068a11337ff42f49b877d001a05e6f2d88ac00ca9a3b000000001976a91422329777fffa35f02c630bbb9892784294ec58b788ac00ca9a3b000000001976a914c78a475d3708a2fc069c3429f560236d0f41eddf88ac00ca9a3b000000001976a91452b86186786ef46079f9b8b4beb62fa0be911a8588ac00ca9a3b000000001976a9149810c3ddafec6a157baa45fb6446f4647bfe39e588ac00ca9a3b000000001976a9143d3460c2bf8e41711127baf367cf9c1de01a012088ac00ca9a3b000000001976a914aa73d57d69389e56de773b0d94003644866e63db88ac00ca9a3b000000001976a9142ee9910f013f7b0ed82c9f1895c460ed3d3b32f788ac00ca9a3b000000001976a9142b0ad1d82789ddb332af74e2aa8c1911556c8ffc88ac00ca9a3b000000001976a9147edbdea517ac814969b1234e44863a9aa1af09ab88ac00ca9a3b000000001976a914034e49a\
e258d3e66779c870757afe75a4026452c88ac00ca9a3b000000001976a9147477be5e433352c1d5d278c99eb68ab6a794eeb688ac00ca9a3b000000001976a914ff8cce709504bd0a52d492cff031cbf822ad3c8788ac00ca9a3b000000001976a914617fc7f6296e44789767da8cc4cdc872dfc0365c88ac00ca9a3b000000001976a914983ea0c1fcf0fb90985bdfb3d918a8656b7320db88ac00ca9a3b000000001976a914b4b8d8871bbfaaee9280a78e7007065f8f6651d288ac00ca9a3b000000001976a914ec04e5b5b881f9f9c04d6b9df7fea00f1bddd47b88ac00ca9a3b000000001976a91479658d3b03cc1e52275dd4ff448f46b1ba923e3d88ac00ca9a3b000000001976a914215f1f95586cfa322e35d94943166e67621e558088ac00ca9a3b000000001976a91461b8aba7fdf515867851b4710b2ff500bf0207b988ac00ca9a3b000000001976a91405f796dc38a0a1c216a2cb312b9360192e2914e288ac00ca9a3b000000001976a9144f7e8879849fe105cf862fe23626e2598985fe4488ac00ca9a3b000000001976a914dae9c75df4e4e6c3878e04b6ae073cc3a135de9188ac00ca9a3b000000001976a914832de07afe3aab5373d6bf624673a6c2d9d1f39188ac00ca9a3b000000001976a91477bf4d1c4ed7330acd389aec470f6071321ef11e88ac00ca9a3b000000001976a91451819219dbefd33eafdc2f95494ffd0590d787a288ac00ca9a3b000000001976a914b32e4a1e8198b323ca0ae69b8b0a89df36909cea88ac00ca9a3b000000001976a914948a50c8eb9095ee48e43c5c306e9e48cbc4e81c88ac00ca9a3b000000001976a91417b6d1cc0987c971eca6ed68fef10c04e734f7e188ac00ca9a3b000000001976a9141f79fdb77cc0d716c7d7d566e3a6106ce6ac296488ac00ca9a3b000000001976a9149c20bec924f5d96306a21b9205d19ba1cfb2fd8788ac00ca9a3b000000001976a914e93dbd29b9e83ab2b2ae1d7bec4101d11067853188ac00ca9a3b000000001976a9144b8a6b525aa347e2362a709e846568ceab94e3e688ac00ca9a3b000000001976a914987d4b853cd7fc30d1295da2bd4f9f91988f5f5d88ac00ca9a3b000000001976a914489bb96fd9e9332a60835df0b1dad1472da0e7c988ac00ca9a3b000000001976a914c7adb4dc5929944c1707a7cb343468458b26316988ac00ca9a3b000000001976a91438b5b54ca85333d235706fcdecb7f168c1b40b3588ac00ca9a3b000000001976a9144f7caccb9d89fab5eadb62cde554eae5cd962c2988ac00ca9a3b000000001976a91401f5bc68b29d3716a8fc10ad2bebf6b08eabf9b488ac00ca9a3b000000001976a914f131e11094cd60bbf654a046bf644a187c5861c188ac00ca9a3b000000001976a914d86674327abaab4c81474c6aa2c1dea99bf9e1a088ac00ca9a3b000000001976a91443425f414bc4ebbbefce77eb21a5dfcde04303af88ac00ca9a3b000000001976a914d064da84d40cfa9fa058102fbe785a9497325db288ac00ca9a3b000000001976a914ce3523474b6a0d86aee8f76869f38dabbddcf96488ac00ca9a3b000000001976a91419dd44038dce0101fee04cb45cca3ed20aa12e1688ac00ca9a3b000000001976a9148c93ea78b6a66a91d39ce422aba25681e706885888ac00ca9a3b000000001976a914bae209ab5cf40f14cc8d0260cf7b3843ff112bf488ac00ca9a3b000000001976a914d0529c402aa27d86dba797e05e19c1fe3c965f0088ac00ca9a3b000000001976a914edbec980a0f4697db88e1f2810fa4be3d019420788ac00ca9a3b000000001976a914ab0c5fbb1ce59ee5c771a694acb32d9f897a24ce88ac00ca9a3b000000001976a914e43d92822c35834060ccf4e474c65fc242adcf3788ac00c353743256000017a9142abbf6436f1efcebd88e842bed1c9b1deece6bda8700000000'
// var txCoinJoinHex = '0100000013440a4e2471a0afd66c9db54db7d414507981eb3db35970dadf722453f08bdc8d0c0000006a47304402200098a7f838ff267969971f5d9d4b2c1db11b8e39c81eebf3c8fe22dd7bf0018302203fa16f0aa3559752462c20ddd8a601620eb176b4511507d11a361a7bb595c57c01210343ead2c0e2303d880bf72dfc04fc9c20d921fc53949c471e22b3c68c0690b828ffffffff0295eef5ad85c9b6b91a3d77bce015065dc64dab526b2f27fbe56f51149bb67f100000006b483045022100c46d6226167e6023e5a058b1ae541c5ca4baf4a69afb65adbfce2cc276535a6a022006320fdc8a438009bbfebfe4ab63e415ee231456a0137d167ee2113677f8e3130121032e38a3e15bee5ef272eaf71033a054637f7b74a51882e659b0eacb8db3e417a9ffffffffee0a35737ab56a0fdb84172c985f1597cffeb33c1d8e4adf3b3b4cc6d430d9b50a0000006b483045022100d02737479b676a35a5572bfd027ef9713b2ef34c87aabe2a2939a448d06c0569022018b262f34191dd2dcf5cbf1ecae8126b35aeb4afcb0426922e1d3dfc86e4dc970121022056d76bd198504c05350c415a80900aaf1174ad95ef42105c2c7976c7094425ffffffffee0a35737ab56a0fdb84172c985f1597cffeb33c1d8e4adf3b3b4cc6d430d9b5100000006a47304402207f541994740dd1aff3dbf633b7d7681c5251f2aa1f48735370dd4694ebdb049802205f4c92f3c9d8e3e758b462a5e0487c471cf7e58757815200c869801403c5ed57012102778e7fe0fc66a2746a058bbe25029ee32bfbed75a6853455ffab7c2bf764f1aeffffffff0295eef5ad85c9b6b91a3d77bce015065dc64dab526b2f27fbe56f51149bb67f050000006a473044022050304b69e695bdba599379c52d872410ae5d78804d3f3c60fb887fd0d95f617b02205f0e27fd566849f7be7d1965219cd63484cc0f37b77b62be6fdbf48f5887ae01012103c8ac0d519ba794b2e3fe7b85717d48b8b47f0e6f94015d0cb8b2ca84bce93e22ffffffff490673d994be7c9be1a39c2d45b3c3738fde5e4b54af91740a442e1cde947114110000006b48304502210085f6b6285d30a5ea3ee6b6f0e73c39e5919d5254bc09ff57b11a7909a9f3f6b7022023ffc24406384c3ee574b836f57446980d5e79c1cd795136a2160782544037a9012103152a37a23618dcc6c41dbb0d003c027215c4ce467bffc29821e067d97fa052e7ffffffffc1365292b95156f7d68ad6dfa031910f3284d9d2e9c267670c5cfa7d97bae482010000006b483045022100e59095f9bbb1daeb04c8105f6f0cf123fcf59c80d319a0e2012326d12bb0e02702206d67b31b24ed60b3f3866755ce122abb09200f9bb331d7be214edfd74733bb830121026db18f5b27ce4e60417364ce35571096927339c6e1e9d0a9f489be6a4bc03252ffffffff0295eef5ad85c9b6b91a3d77bce015065dc64dab526b2f27fbe56f51149bb67f0d0000006b483045022100ec5f0ef35f931fa047bb0ada3f23476fded62d8f114fa547093d3b5fbabf6dbe0220127d6d28388ffeaf2a282ec5f6a7b1b7cc2cb8e35778c2f7c3be834f160f1ff8012102b38aca3954870b28403cae22139004e0756ae325208b3e692200e9ddc6e33b54ffffffff73675af13a01c64ee60339613debf81b9e1dd8d9a3515a25f947353459d3af3c0c0000006b483045022100ff17593d4bff4874aa556c5f8f649d4135ea26b37baf355e793f30303d7bfb9102200f51704d8faccbaa22f58488cb2bebe523e00a436ce4d58179d0570e55785daa0121022a0c75b75739d182076c16d3525e83b1bc7362bfa855959c0cd48e5005140166ffffffff73675af13a01c64ee60339613debf81b9e1dd8d9a3515a25f947353459d3af3c0e0000006b483045022100c7d5a379e2870d03a0f3a5bdd4054a653b29804913f8720380a448f4e1f19865022051501eae29ba44a13ddd3780bc97ac5ec86e881462d0e08d9cc4bd2b29bcc815012103abe21a9dc0e9f995e3c58d6c60971e6d54559afe222bca04c2b331f42b38c0f3ffffffff6f70aeaa54516863e16fa2082cb5471e0f66b4c7dac25d9da4969e70532f6da00d0000006b483045022100afbeaf9fe032fd77c4e46442b178bdc37c7d6409985caad2463b7ab28befccfd0220779783a9b898d94827ff210c9183ff66bfb56223b0e0118cbba66c48090a4f700121036385f64e18f00d6e56417aa33ad3243356cc5879342865ee06f3b2c17552fe7efffffffffae31df57ccb4216853c0f3cc5af1f8ad7a99fc8de6bc6d80e7b1c81f4baf1e4140000006a473044022076c7bb674a88d9c6581e9c26eac236f6dd9cb38b5ffa2a3860d8083a1751302e022033297ccaaab0a6425c2afbfb6525b75e6f27cd0c9f23202bea28f8fa8a7996b40121031066fb64bd605b8f9d07c45d0d5c42485325b9289213921736bf7b048dec1df3ffffffff909d6efb9e08780c8b8e0fccff74f3e21c5dd12d86dcf5cbea494e18bbb9995c120000006a47304402205c945293257a266f8d575020fa409c1ba28742ff3c6d66f33059675bd6ba676a02204ca582141345a161726bd4ec5f53a6d50b2afbb1aa811acbad44fd295d01948501210316a04c4b9dc5035bc9fc3ec386896dcba281366e8a8a67b4904e4e4307820f56ffffffff90ac0c55af47a073de7c3f98ac5a59cd10409a8069806c8afb9ebbbf0c232436020000006a47304402200e05f3a9db10a3936ede2f64844ebcbdeeef069f4fd7e34b18d66b185217d5e30220479b734d591ea6412ded39665463f0ae90b0b21028905dd8586f74b4eaa9d6980121030e9ba4601ae3c95ce90e01aaa33b2d0426d39940f278325023d9383350923477ffffffff3e2f391615f885e626f70940bc7daf71bcdc0a7c6bf5a5eaece5b2e08d10317c000000006b4830450221009b675247b064079c32b8e632e9ee8bd62b11b5c89f1e0b37068fe9be16ae9653022044bff9be38966d3eae77eb9adb46c20758bc106f91cd022400999226b3cd6064012103239b99cadf5350746d675d267966e9597b7f5dd5a6f0f829b7bc6e5802152abcffffffffe1ce8f7faf221c2bcab3aa74e6b1c77a73d1a5399a9d401ddb4b45dc1bdc4636090000006b483045022100a891ee2286649763b1ff45b5a3ef66ce037e86e11b559d15270e8a61cfa0365302200c1e7aa62080af45ba18c8345b5f37a94e661f6fb1d62fd2f3917aa2897ae4af012102fa6980f47e0fdc80fb94bed1afebec70eb5734308cd30f850042cd9ddf01aebcffffffffe1ce8f7faf221c2bcab3aa74e6b1c77a73d1a5399a9d401ddb4b45dc1bdc4636010000006a4730440220296dbfacd2d3f3bd4224a40b7685dad8d60292a38be994a0804bdd1d1e84edef022000f30139285e6da863bf6821d46b8799a582d453e696589233769ad9810c9f6a01210314936e7118052ac5c4ba2b44cb5b7b577346a5e6377b97291e1207cf5dae47afffffffff0295eef5ad85c9b6b91a3d77bce015065dc64dab526b2f27fbe56f51149bb67f120000006b483045022100b21b2413eb7de91cab6416efd2504b15a12b34c11e6906f44649827f9c343b4702205691ab43b72862ea0ef60279f03b77d364aa843cb8fcb16d736368e432d44698012103f520fb1a59111b3d294861d3ac498537216d4a71d25391d1b3538ccbd8b023f6ffffffff5a7eaeadd2570dd5b9189eb825d6b1876266940789ebb05deeeac954ab520d060c0000006b483045022100949c7c91ae9addf549d828ed51e0ef42255149e29293a34fb8f81dc194c2f4b902202612d2d6251ef13ed936597f979a26b38916ed844a1c3fded0b3b0ea18b54380012103eda1fa3051306238c35d83e8ff8f97aa724d175dede4c0783926c98f106fb194ffffffff15620f5723000000001976a91406595e074efdd41ef65b0c3dba3d69dd3c6e494b88ac58a3fb03000000001976a914b037b0650a691c56c1f98e274e9752e2157d970288ac18c0f702000000001976a914b68642906bca6bb6c883772f35caaeed9f7a1b7888ac83bd5723000000001976a9148729016d0c88ac01d110e7d75006811f283f119788ace41f3823000000001976a9147acd2478d13395a64a0b8eadb62d501c2b41a90c88ac31d50000000000001976a91400d2a28bc7a4486248fab573d72ef6db46f777ea88aca09c0306000000001976a914d43c27ffb4a76590c245cd55447550ffe99f346a88ac80412005000000001976a914997efabe5dce8a24d4a1f3c0f9236bf2f6a2087588ac99bb0000000000001976a914593f550a3f8afe8e90b7bae14f0f0b2c31c4826688ace2c71500000000001976a914ee85450df9ca44a4e330fd0b7d681ec6fbad6fb488acb0eb4a00000000001976a914e7a48c6f7079d95e1505b45f8307197e6191f13888acea015723000000001976a9149537e8f15a7f8ef2d9ff9c674da57a376cf4369b88ac2002c504000000001976a9141821265cd111aafae46ac62f60eed21d1544128388acb0c94f0e000000001976a914a7aef50f0868fe30389b02af4fae7dda0ec5e2e988ac40b3d509000000001976a9140f9ac28f8890318c50cffe1ec77c05afe5bb036888ac9f9d1f00000000001976a914e70288cab4379092b2d694809d555c79ae59223688ac52e85623000000001976a914a947ce2aca9c6e654e213376d8d35db9e36398d788ac21ae0000000000001976a914ff3bc00eac7ec252cd5fb3318a87ac2a86d229e188ace0737a09000000001976a9146189be3daa18cb1b1fa86859f7ed79cc5c8f2b3388acf051a707000000001976a914453b1289f3f8a0248d8d914d7ad3200c6be0d28888acc0189708000000001976a914a5e2e6e7b740cef68eb374313d53a7fab1a8a3cd88ac00000000';
