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

  var testScript = 'OP_DUP OP_HASH160 20 0x88d9931ea73d60eaf7e5671efc0552b912911f2a OP_EQUALVERIFY OP_CHECKSIG';
  var testScriptHex = '76a91488d9931ea73d60eaf7e5671efc0552b912911f2a88ac';
  var testPrevTx = 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458';
  var testAmount = 1020000;
  var testTransaction = new Transaction()
    .from({
      'txId': testPrevTx,
      'outputIndex': 0,
      'script': testScript,
      'satoshis': testAmount
    })
    .to('mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc', testAmount - 10000);

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
      var stringTx = new Transaction().to('mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc', NaN);
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
      .from(simpleUtxoWith100000Satoshis)
      .to([{address: toAddress, satoshis: 50000}])
      .fee(15000)
      .change(changeAddress)
      .sign(privateKey);

    var txData = JSON.stringify(tx);
    var tx2 = new Transaction(JSON.parse(txData));
    var txData2 = JSON.stringify(tx2);
    txData.should.equal(txData2);
  });

  it('toObject/fromObject with p2sh signatures and custom fee', function() {
    var tx = new Transaction()
      .from(p2shUtxoWith1BTC, [p2shPublicKey1, p2shPublicKey2, p2shPublicKey3], 2)
      .to([{address: toAddress, satoshis: 50000}])
      .fee(15000)
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

  var fromAddress = 'mszYqVnqKoQx4jcTdJXxwKAissE3Jbrrc1';
  var simpleUtxoWith100000Satoshis = {
    address: fromAddress,
    txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
    outputIndex: 0,
    script: Script.buildPublicKeyHashOut(fromAddress).toString(),
    satoshis: 100000
  };

  var simpleUtxoWith1000000Satoshis = {
    address: fromAddress,
    txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
    outputIndex: 0,
    script: Script.buildPublicKeyHashOut(fromAddress).toString(),
    satoshis: 1000000
  };
  var anyoneCanSpendUTXO = JSON.parse(JSON.stringify(simpleUtxoWith100000Satoshis));
  anyoneCanSpendUTXO.script = new Script().add('OP_TRUE');
  var toAddress = 'mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc';
  var changeAddress = 'mgBCJAsvzgT2qNNeXsoECg2uPKrUsZ76up';
  var changeAddressP2SH = '2N7T3TAetJrSCruQ39aNrJvYLhG1LJosujf';
  var privateKey = 'cSBnVM4xvxarwGQuAfQFwqDg9k5tErHUHzgWsEfD4zdwUasvqRVY';
  var private1 = '6ce7e97e317d2af16c33db0b9270ec047a91bff3eff8558afb5014afb2bb5976';
  var private2 = 'c9b26b0f771a0d2dad88a44de90f05f416b3b385ff1d989343005546a0032890';
  var public1 = new PrivateKey(private1).publicKey;
  var public2 = new PrivateKey(private2).publicKey;

  var simpleUtxoWith1BTC = {
    address: fromAddress,
    txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
    outputIndex: 1,
    script: Script.buildPublicKeyHashOut(fromAddress).toString(),
    satoshis: 1e8
  };

  var tenth = 1e7;
  var fourth = 25e6;
  var half = 5e7;

  var p2shPrivateKey1 = PrivateKey.fromWIF('cNuW8LX2oeQXfKKCGxajGvqwhCgBtacwTQqiCGHzzKfmpHGY4TE9');
  var p2shPublicKey1 = p2shPrivateKey1.toPublicKey();
  var p2shPrivateKey2 = PrivateKey.fromWIF('cTtLHt4mv6zuJytSnM7Vd6NLxyNauYLMxD818sBC8PJ1UPiVTRSs');
  var p2shPublicKey2 = p2shPrivateKey2.toPublicKey();
  var p2shPrivateKey3 = PrivateKey.fromWIF('cQFMZ5gP9CJtUZPc9X3yFae89qaiQLspnftyxxLGvVNvM6tS6mYY');
  var p2shPublicKey3 = p2shPrivateKey3.toPublicKey();

  var p2shAddress = Address.createMultisig([
    p2shPublicKey1,
    p2shPublicKey2,
    p2shPublicKey3
  ], 2, 'testnet');
  var p2shUtxoWith1BTC = {
    address: p2shAddress.toString(),
    txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
    outputIndex: 0,
    script: Script(p2shAddress).toString(),
    satoshis: 1e8
  };

  describe('adding inputs', function() {

    it('adds just once one utxo', function() {
      var tx = new Transaction();
      tx.from(simpleUtxoWith1BTC);
      tx.from(simpleUtxoWith1BTC);
      tx.inputs.length.should.equal(1);
    });

    describe('isFullySigned', function() {
      it('works for normal p2pkh', function() {
        var transaction = new Transaction()
          .from(simpleUtxoWith100000Satoshis)
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
        tx.from(simpleUtxoWith1BTC);
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
        .from(simpleUtxoWith1000000Satoshis)
        .to(toAddress, 500000)
        .change(changeAddress)
        .sign(privateKey);
      transaction.outputs.length.should.equal(2);
      transaction.outputs[1].satoshis.should.equal(400000);
      transaction.outputs[1].script.toString()
        .should.equal(Script.fromAddress(changeAddress).toString());
      var actual = transaction.getChangeOutput().script.toString();
      var expected = Script.fromAddress(changeAddress).toString();
      actual.should.equal(expected);
    });
    it('accepts a P2SH address for change', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1000000Satoshis)
        .to(toAddress, 500000)
        .change(changeAddressP2SH)
        .sign(privateKey);
      transaction.outputs.length.should.equal(2);
      transaction.outputs[1].script.isScriptHashOut().should.equal(true);
    });
    it('can recalculate the change amount', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100000Satoshis)
        .to(toAddress, 50000)
        .change(changeAddress)
        .fee(0)
        .sign(privateKey);

      transaction.getChangeOutput().satoshis.should.equal(50000);

      transaction = transaction
        .to(toAddress, 20000)
        .sign(privateKey);

      transaction.outputs.length.should.equal(3);
      transaction.outputs[2].satoshis.should.equal(30000);
      transaction.outputs[2].script.toString()
        .should.equal(Script.fromAddress(changeAddress).toString());
    });
    it('adds no fee if no change is available', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100000Satoshis)
        .to(toAddress, 99000)
        .sign(privateKey);
      transaction.outputs.length.should.equal(1);
    });
    it('adds no fee if no money is available', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100000Satoshis)
        .to(toAddress, 100000)
        .change(changeAddress)
        .sign(privateKey);
      transaction.outputs.length.should.equal(1);
    });
    it('fee can be set up manually', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100000Satoshis)
        .to(toAddress, 80000)
        .fee(10000)
        .change(changeAddress)
        .sign(privateKey);
      transaction.outputs.length.should.equal(2);
      transaction.outputs[1].satoshis.should.equal(10000);
    });
    it('fee per kb can be set up manually', function() {
      var inputs = _.map(_.range(10), function(i) {
        var utxo = _.clone(simpleUtxoWith100000Satoshis);
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
      transaction.outputs[1].satoshis.should.equal(34000);
    });
    it('if satoshis are invalid', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100000Satoshis)
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
      var transaction = new Transaction()
        .from(simpleUtxoWith100000Satoshis)
        .to(toAddress, 99999)
        .change(changeAddress)
        .sign(privateKey);
      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.FeeError.TooSmall);
    });
    it('on second call to sign, change is not recalculated', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100000Satoshis)
        .to(toAddress, 100000)
        .change(changeAddress)
        .sign(privateKey)
        .sign(privateKey);
      transaction.outputs.length.should.equal(1);
    });
    it('getFee() returns the difference between inputs and outputs if no change address set', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100000Satoshis)
        .to(toAddress, 1000);
      transaction.getFee().should.equal(99000);
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
        .from(simpleUtxoWith1BTC)
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
        .from(simpleUtxoWith1BTC)
        .to(toAddress, 1);
      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.ChangeAddressMissing);
    });
    it('fails if a high fee was set', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1BTC)
        .change(changeAddress)
        .fee(50000000)
        .to(toAddress, 40000000);
      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.FeeError.TooLarge);
    });
    it('fails if a dust output is created', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1BTC)
        .to(toAddress, 545)
        .change(changeAddress)
        .sign(privateKey);
      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.DustOutputs);
    });
    it('doesn\'t fail if a dust output is not dust', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1BTC)
        .to(toAddress, 546)
        .change(changeAddress)
        .sign(privateKey);
      expect(function() {
        return transaction.serialize();
      }).to.not.throw(errors.Transaction.DustOutputs);
    });
    it('doesn\'t fail if a dust output is an op_return', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1BTC)
        .addData('not dust!')
        .change(changeAddress)
        .sign(privateKey);
      expect(function() {
        return transaction.serialize();
      }).to.not.throw(errors.Transaction.DustOutputs);
    });
    it('fails when outputs and fee don\'t add to total input', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1BTC)
        .to(toAddress, 99900000)
        .fee(99999)
        .sign(privateKey);
      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.FeeError.Different);
    });
    it('checks output amount before fee errors', function() {
      var transaction = new Transaction();
      transaction.from(simpleUtxoWith1BTC);
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
      transaction.from(simpleUtxoWith1BTC);
      transaction
        .to(toAddress, 84000000)
        .change(changeAddress)
        .fee(16000000);

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
          transaction.from(simpleUtxoWith1BTC);
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
            .fee(50000000)
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
            .to(toAddress, 10000)
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
        .to('mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc', testAmount - 10000);

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
        .to('mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc', testAmount - 10000);

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
        .to('mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc', testAmount - 10000);

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
        .to('mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc', testAmount - 10000);

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
        .from(simpleUtxoWith100000Satoshis)
        .to(toAddress, 50000)
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
        .from(simpleUtxoWith1BTC);
      var deserialized = new Transaction(transaction.toObject());
      expect(deserialized.inputs[0] instanceof Transaction.Input.PublicKeyHash).to.equal(true);
    });
    it('can serialize and deserialize a P2SH input', function() {
      var transaction = new Transaction()
        .from({
          txId: '0000', // Not relevant
          outputIndex: 0,
          script: Script.buildMultisigOut([public1, public2], 2).toScriptHashOut(),
          satoshis: 10000
        }, [public1, public2], 2);
      var deserialized = new Transaction(transaction.toObject());
      expect(deserialized.inputs[0] instanceof Transaction.Input.MultiSigScriptHash).to.equal(true);
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
          satoshis: 10000
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
      }), outputScriptString, 10000);
      transaction.inputs[0].output.script.should.be.instanceof(bitcore.Script);
      transaction.inputs[0].output.script.toString().should.equal(outputScriptString);
    });
  });

  describe('removeInput and removeOutput', function() {
    it('can remove an input by index', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1BTC);
      transaction.inputs.length.should.equal(1);
      transaction.inputAmount.should.equal(simpleUtxoWith1BTC.satoshis);
      transaction.removeInput(0);
      transaction.inputs.length.should.equal(0);
      transaction.inputAmount.should.equal(0);
    });
    it('can remove an input by transaction id', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1BTC);
      transaction.inputs.length.should.equal(1);
      transaction.inputAmount.should.equal(simpleUtxoWith1BTC.satoshis);
      transaction.removeInput(simpleUtxoWith1BTC.txId, simpleUtxoWith1BTC.outputIndex);
      transaction.inputs.length.should.equal(0);
      transaction.inputAmount.should.equal(0);
    });
    it('fails if the index provided is invalid', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1BTC);
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
        .from(simpleUtxoWith1BTC)
        .lockUntilDate(date);
      transaction.inputs[0].sequenceNumber
        .should.equal(Transaction.Input.DEFAULT_LOCKTIME_SEQNUMBER);
    });
    it('has a non-max sequenceNumber for effective blockheight locktime tx', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1BTC)
        .lockUntilBlockHeight(blockHeight);
      transaction.inputs[0].sequenceNumber
        .should.equal(Transaction.Input.DEFAULT_LOCKTIME_SEQNUMBER);
    });
    it('should serialize correctly for date locktime ', function() {
      var transaction= new Transaction()
        .from(simpleUtxoWith1BTC)
        .lockUntilDate(date);
      var serialized_tx = transaction.uncheckedSerialize();
      var copy = new Transaction(serialized_tx);
      serialized_tx.should.equal(copy.uncheckedSerialize());
      copy.inputs[0].sequenceNumber
      .should.equal(Transaction.Input.DEFAULT_LOCKTIME_SEQNUMBER)
    });
    it('should serialize correctly for a block height locktime', function() {
      var transaction= new Transaction()
        .from(simpleUtxoWith1BTC)
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
      .to(toAddress, 50000);
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
        .from(simpleUtxoWith1BTC)
        .to(toAddress, 40000000);
      transaction.inputAmount.should.equal(100000000);
      transaction.outputAmount.should.equal(40000000);
    });
    it('returns correct values for transaction with change', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1BTC)
        .change(changeAddress)
        .to(toAddress, 1000);
      transaction.inputAmount.should.equal(100000000);
      transaction.outputAmount.should.equal(99900000);
    });
    it('returns correct values for coinjoin transaction', function() {
      // see livenet tx c16467eea05f1f30d50ed6dbc06a38539d9bb15110e4b7dc6653046a3678a718
      var transaction = new Transaction(txCoinJoinHex);
      transaction.outputAmount.should.equal(4191290961);
      expect(function() {
        var ia = transaction.inputAmount;
      }).to.throw('No previous output information');
    });
  });

  describe('output ordering', function() {

    var transaction, out1, out2, out3, out4;

    beforeEach(function() {
      transaction = new Transaction()
        .from(simpleUtxoWith1BTC)
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
        .from(simpleUtxoWith1BTC)
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
      tx.outputs[0].satoshis.should.equal(10000000);
      tx.outputs[0].script.toAddress().toString().should.equal(toAddress);
      tx.outputs[1].satoshis.should.equal(89900000);
      tx.outputs[1].script.toAddress().toString().should.equal(changeAddress);
    });

  });

  describe('BIP69 Sorting', function() {

    it('sorts inputs correctly', function() {
      var from1 = {
        txId: '0000000000000000000000000000000000000000000000000000000000000000',
        outputIndex: 0,
        script: Script.buildPublicKeyHashOut(fromAddress).toString(),
        satoshis: 100000
      };
      var from2 = {
        txId: '0000000000000000000000000000000000000000000000000000000000000001',
        outputIndex: 0,
        script: Script.buildPublicKeyHashOut(fromAddress).toString(),
        satoshis: 100000
      };
      var from3 = {
        txId: '0000000000000000000000000000000000000000000000000000000000000001',
        outputIndex: 1,
        script: Script.buildPublicKeyHashOut(fromAddress).toString(),
        satoshis: 100000
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
          .from(simpleUtxoWith1BTC)
          .from(simpleUtxoWith100000Satoshis)
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
          .from(simpleUtxoWith1BTC)
          .from(simpleUtxoWith100000Satoshis)
          .to([{address: toAddress, satoshis: 50000}])
          .fee(15000)
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
          .from(simpleUtxoWith100000Satoshis)
          .to([{address: toAddress, satoshis: 50000}])
          .fee(15000)
          .change(changeAddress)
          .enableRBF()
          .sign(privateKey);
        tx.isRBF().should.equal(true);
      });
      it('determine opt-out with default sequence number', function() {
        var tx = new Transaction()
          .from(simpleUtxoWith100000Satoshis)
          .to([{address: toAddress, satoshis: 50000}])
          .fee(15000)
          .change(changeAddress)
          .sign(privateKey);
        tx.isRBF().should.equal(false);
      });
      it('determine opt-out with 0xfffffffe', function() {
        var tx = new Transaction()
          .from(simpleUtxoWith1BTC)
          .from(simpleUtxoWith100000Satoshis)
          .to([{address: toAddress, satoshis: 50000 + 1e8}])
          .fee(15000)
          .change(changeAddress)
          .sign(privateKey);
        tx.inputs[0].sequenceNumber = 0xfffffffe;
        tx.inputs[1].sequenceNumber = 0xfffffffe;
        tx.isRBF().should.equal(false);
      });
      it('determine opt-out with 0xffffffff', function() {
        var tx = new Transaction()
          .from(simpleUtxoWith1BTC)
          .from(simpleUtxoWith100000Satoshis)
          .to([{address: toAddress, satoshis: 50000 + 1e8}])
          .fee(15000)
          .change(changeAddress)
          .sign(privateKey);
        tx.inputs[0].sequenceNumber = 0xffffffff;
        tx.inputs[1].sequenceNumber = 0xffffffff;
        tx.isRBF().should.equal(false);
      });
      it('determine opt-in with 0xfffffffd (first input)', function() {
        var tx = new Transaction()
          .from(simpleUtxoWith1BTC)
          .from(simpleUtxoWith100000Satoshis)
          .to([{address: toAddress, satoshis: 50000 + 1e8}])
          .fee(15000)
          .change(changeAddress)
          .sign(privateKey);
        tx.inputs[0].sequenceNumber = 0xfffffffd;
        tx.inputs[1].sequenceNumber = 0xffffffff;
        tx.isRBF().should.equal(true);
      });
      it('determine opt-in with 0xfffffffd (second input)', function() {
        var tx = new Transaction()
          .from(simpleUtxoWith1BTC)
          .from(simpleUtxoWith100000Satoshis)
          .to([{address: toAddress, satoshis: 50000 + 1e8}])
          .fee(15000)
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
      var version = new Buffer('01000000', 'hex');
      var marker = new Buffer('00', 'hex'); //always zero
      var flag = new Buffer('01', 'hex'); //non zero
      var inputCount = new Buffer('01', 'hex');
      var inputDummy = new Buffer('2052cda8bc0c2cb743f154881fc85cb675527dcf2f7a5938241020c33341b3f70000000000ffffffff', 'hex');
      var outputCount = new Buffer('00', 'hex');
      var witness = new Buffer('01', 'hex');
      var witnessItems = new Buffer('00', 'hex');
      var locktime = new Buffer('00000000', 'hex');
      var txBuffer = Buffer.concat([version, marker, flag, inputCount, inputDummy, outputCount, witness,
                                    witnessItems, locktime]);
      var tx = bitcore.Transaction().fromBuffer(txBuffer);
      tx.hasWitnesses().should.equal(true);
    });
    it('correctly calculate hash for segwit transaction', function() {
      var txBuffer = new Buffer('01000000000101b0e5caa7e37d4b8530c3e1071a36dd5e05d1065cf7224ddff42c69e3387689870000000000ffffffff017b911100000000001600144ff831574da8bef07f8bc97244a1666147b071570247304402203fcbcfddbd6ca3a90252610dd63f1be50b2d926b8d87c912da0a3e42bb03fba002202a90c8aad75da22b0549c72618b754114583e934c0b0d2ccd6c13fcd859ba4ed01210363f3f47f4555779de405eab8d0dc8c2a4f3e09f4171a3fa47c7a77715795319800000000', 'hex');
      var tx = bitcore.Transaction().fromBuffer(txBuffer);
      tx.hash.should.equal('7f1a2d46746f1bfbb22ab797d5aad1fd9723477b417fa34dff73d8a7dbb14570');
      tx.witnessHash.should.equal('3c26fc8b5cfe65f96d955cecfe4d11db2659d052171f9f31af043e9f5073e46b');
    });
    it('round trip nested witness p2sh', function() {
      var txBuffer = new Buffer('010000000001010894bb2bbfd5249b1c55f7bc64352bb64894938bc6439f43f28a58bfa7c73205000000002322002077b16b966ee6a4b8a0901351221d279afd31d3f90df52a3fc53436ea9abde5b0ffffffff01010000000000000000030047304402200fa23efa9a8d6ae285cfc82f81e6c2196d14167553b10da1845abd2c9fe38dc502207a40a58ee5b739e902b275018dfa1bee0d608736ff4317b028fbc29391f4554f01475221037b8dc5861a0ef7b0a97b41d2d1e27186f019d4834dbc99f24952b6f5080f5cce21027152378182102b68b5fce42f9f365ec272c48afda6b0816e735c1dc4b96dd45a52ae00000000', 'hex');
      var tx = bitcore.Transaction().fromBuffer(txBuffer);
      tx.toBuffer().toString('hex').should.equal(txBuffer.toString('hex'));
    });
    describe('verifying', function() {
      it('will verify these signatures', function() {
        var signedTxBuffer = new Buffer('0100000000010103752b9d2baadb95480e2571a4854a68ffd8264462168346461b7cdda76beac20000000023220020fde78ea47ae10cc93c6a850d8a86d8575ddacff38ee9b0bc6535dc016a197068ffffffff010100000000000000000400483045022100ea1508225a6d37c0545d22acaee88d29d1675696953f93d657a419613bcee9b802207b8d80ca8176586878f51e001cb9e92f7640b8c9dc530fabf9087142c752de89014830450221008c6f4a9ebdee89968ec00ecc12fda67442b589296e86bf3e9bde19f4ba923406022048c3409831a55bf61f2d5defffd3b91767643b6c5981cb32338dd7e9f02821b1014752210236c8204d62fd70e7ca206a36d39f9674fa832964d787c60d44250624242bada4210266cd5a3507d6df5346aa42bd23d4c44c079aef0d7a59534758a0dabb82345c2052ae00000000', 'hex');
        var unsignedBuffer = new Buffer('0100000000010103752b9d2baadb95480e2571a4854a68ffd8264462168346461b7cdda76beac20000000023220020fde78ea47ae10cc93c6a850d8a86d8575ddacff38ee9b0bc6535dc016a197068ffffffff010100000000000000000300483045022100ea1508225a6d37c0545d22acaee88d29d1675696953f93d657a419613bcee9b802207b8d80ca8176586878f51e001cb9e92f7640b8c9dc530fabf9087142c752de89014752210236c8204d62fd70e7ca206a36d39f9674fa832964d787c60d44250624242bada4210266cd5a3507d6df5346aa42bd23d4c44c079aef0d7a59534758a0dabb82345c2052ae00000000', 'hex');
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
        }, [pubkey1, pubkey3], 2, signatures, true);

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
      var privateKey1 = PrivateKey.fromWIF('cNuW8LX2oeQXfKKCGxajGvqwhCgBtacwTQqiCGHzzKfmpHGY4TE9');
      var publicKey1 = p2shPrivateKey1.toPublicKey();
      var privateKey2 = PrivateKey.fromWIF('cTtLHt4mv6zuJytSnM7Vd6NLxyNauYLMxD818sBC8PJ1UPiVTRSs');
      var publicKey2 = p2shPrivateKey2.toPublicKey();
      var privateKey3 = PrivateKey.fromWIF('cQFMZ5gP9CJtUZPc9X3yFae89qaiQLspnftyxxLGvVNvM6tS6mYY');
      var publicKey3 = p2shPrivateKey3.toPublicKey();
      var address = Address.createMultisig([
        publicKey1
      ], 1, 'testnet', true);
      var utxo = {
        address: address.toString(),
        txId: '1d732950d99f821b8a8d11972ea56000b0666e4d31fa71861ffd80a83797dc61',
        outputIndex: 1,
        script: Script.buildScriptHashOut(address).toHex(),
        satoshis: 1e8
      };
      it('will sign with nested p2sh witness program', function() {
        var tx = new Transaction()
          .from(utxo, [publicKey1], 1, true)
          .to([{address: 'n3LsXgyStG2CkS2CnWZtDqxTfCnXB8PvD9', satoshis: 50000}])
          .fee(150000)
          .change('mqWDcnW3jMzthB8qdB9SnFam6N96GDqM4W')
          .sign(privateKey1);
        var sighash = tx.inputs[0].getSighash(tx, privateKey1, 0, bitcore.crypto.Signature.SIGHASH_ALL);
        sighash.toString('hex').should.equal('51b7c5271ae04071a6d3d4c4cde28003d8e9a09e51931ebae4003539767a4955');
        tx.toBuffer().toString('hex').should.equal('0100000000010161dc9737a880fd1f8671fa314d6e66b00060a52e97118d8a1b829fd95029731d010000002322002028ba8620c84df12e3283de37d02cfa7bcae3894e118388d6b3ae50f9aeb38798ffffffff0250c30000000000001976a914ef6aa14d8f5ba65a12c327a9659681c44cd821b088acc0d3f205000000001976a9146d8da2015c6d2890896485edd5897b3b2ec9ebb188ac030047304402203fdbd6604939ed9b46bd07bea993b102336a6fbc0a0c987f05b8522a2079037f022064466db4b0c6cc6697a28e0ba9b28c9738ecba56033a60aab7f04d5da2a8241e0125512102feab7deafbdb39885ef92a285dfa0f4ada0feefce43685e6551c95e71496d98051ae00000000');
      });
    });
  });

});


var tx_empty_hex = '01000000000000000000';

/* jshint maxlen: 1000 */
var tx_1_hex = '01000000015884e5db9de218238671572340b207ee85b628074e7e467096c267266baf77a4000000006a473044022013fa3089327b50263029265572ae1b022a91d10ac80eb4f32f291c914533670b02200d8a5ed5f62634a7e1a0dc9188a3cc460a986267ae4d58faf50c79105431327501210223078d2942df62c45621d209fab84ea9a7a23346201b7727b9b45a29c4e76f5effffffff0150690f00000000001976a9147821c0a3768aa9d1a37e16cf76002aef5373f1a888ac00000000';
var tx_1_id = '779a3e5b3c2c452c85333d8521f804c1a52800e60f4b7c3bbe36f4bab350b72c';


var tx2hex = '0100000001e07d8090f4d4e6fcba6a2819e805805517eb19e669e9d2f856b41d4277953d640000000091004730440220248bc60bb309dd0215fbde830b6371e3fdc55685d11daa9a3c43828892e26ce202205f10cd4011f3a43657260a211f6c4d1fa81b6b6bdd6577263ed097cc22f4e5b50147522102fa38420cec94843ba963684b771ba3ca7ce1728dc2c7e7cade0bf298324d6b942103f948a83c20b2e7228ca9f3b71a96c2f079d9c32164cd07f08fbfdb483427d2ee52aeffffffff01180fe200000000001976a914ccee7ce8e8b91ec0bc23e1cfb6324461429e6b0488ac00000000';

var unsupportedTxObj = '{"version":1,"inputs":[{"prevTxId":"a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458","outputIndex":0,"sequenceNumber":4294967295,"script":"OP_1","output":{"satoshis":1020000,"script":"OP_1 OP_ADD OP_2 OP_EQUAL"}}],"outputs":[{"satoshis":1010000,"script":"OP_DUP OP_HASH160 20 0x7821c0a3768aa9d1a37e16cf76002aef5373f1a8 OP_EQUALVERIFY OP_CHECKSIG"}],"nLockTime":0}';

var txCoinJoinHex = '0100000013440a4e2471a0afd66c9db54db7d414507981eb3db35970dadf722453f08bdc8d0c0000006a47304402200098a7f838ff267969971f5d9d4b2c1db11b8e39c81eebf3c8fe22dd7bf0018302203fa16f0aa3559752462c20ddd8a601620eb176b4511507d11a361a7bb595c57c01210343ead2c0e2303d880bf72dfc04fc9c20d921fc53949c471e22b3c68c0690b828ffffffff0295eef5ad85c9b6b91a3d77bce015065dc64dab526b2f27fbe56f51149bb67f100000006b483045022100c46d6226167e6023e5a058b1ae541c5ca4baf4a69afb65adbfce2cc276535a6a022006320fdc8a438009bbfebfe4ab63e415ee231456a0137d167ee2113677f8e3130121032e38a3e15bee5ef272eaf71033a054637f7b74a51882e659b0eacb8db3e417a9ffffffffee0a35737ab56a0fdb84172c985f1597cffeb33c1d8e4adf3b3b4cc6d430d9b50a0000006b483045022100d02737479b676a35a5572bfd027ef9713b2ef34c87aabe2a2939a448d06c0569022018b262f34191dd2dcf5cbf1ecae8126b35aeb4afcb0426922e1d3dfc86e4dc970121022056d76bd198504c05350c415a80900aaf1174ad95ef42105c2c7976c7094425ffffffffee0a35737ab56a0fdb84172c985f1597cffeb33c1d8e4adf3b3b4cc6d430d9b5100000006a47304402207f541994740dd1aff3dbf633b7d7681c5251f2aa1f48735370dd4694ebdb049802205f4c92f3c9d8e3e758b462a5e0487c471cf7e58757815200c869801403c5ed57012102778e7fe0fc66a2746a058bbe25029ee32bfbed75a6853455ffab7c2bf764f1aeffffffff0295eef5ad85c9b6b91a3d77bce015065dc64dab526b2f27fbe56f51149bb67f050000006a473044022050304b69e695bdba599379c52d872410ae5d78804d3f3c60fb887fd0d95f617b02205f0e27fd566849f7be7d1965219cd63484cc0f37b77b62be6fdbf48f5887ae01012103c8ac0d519ba794b2e3fe7b85717d48b8b47f0e6f94015d0cb8b2ca84bce93e22ffffffff490673d994be7c9be1a39c2d45b3c3738fde5e4b54af91740a442e1cde947114110000006b48304502210085f6b6285d30a5ea3ee6b6f0e73c39e5919d5254bc09ff57b11a7909a9f3f6b7022023ffc24406384c3ee574b836f57446980d5e79c1cd795136a2160782544037a9012103152a37a23618dcc6c41dbb0d003c027215c4ce467bffc29821e067d97fa052e7ffffffffc1365292b95156f7d68ad6dfa031910f3284d9d2e9c267670c5cfa7d97bae482010000006b483045022100e59095f9bbb1daeb04c8105f6f0cf123fcf59c80d319a0e2012326d12bb0e02702206d67b31b24ed60b3f3866755ce122abb09200f9bb331d7be214edfd74733bb830121026db18f5b27ce4e60417364ce35571096927339c6e1e9d0a9f489be6a4bc03252ffffffff0295eef5ad85c9b6b91a3d77bce015065dc64dab526b2f27fbe56f51149bb67f0d0000006b483045022100ec5f0ef35f931fa047bb0ada3f23476fded62d8f114fa547093d3b5fbabf6dbe0220127d6d28388ffeaf2a282ec5f6a7b1b7cc2cb8e35778c2f7c3be834f160f1ff8012102b38aca3954870b28403cae22139004e0756ae325208b3e692200e9ddc6e33b54ffffffff73675af13a01c64ee60339613debf81b9e1dd8d9a3515a25f947353459d3af3c0c0000006b483045022100ff17593d4bff4874aa556c5f8f649d4135ea26b37baf355e793f30303d7bfb9102200f51704d8faccbaa22f58488cb2bebe523e00a436ce4d58179d0570e55785daa0121022a0c75b75739d182076c16d3525e83b1bc7362bfa855959c0cd48e5005140166ffffffff73675af13a01c64ee60339613debf81b9e1dd8d9a3515a25f947353459d3af3c0e0000006b483045022100c7d5a379e2870d03a0f3a5bdd4054a653b29804913f8720380a448f4e1f19865022051501eae29ba44a13ddd3780bc97ac5ec86e881462d0e08d9cc4bd2b29bcc815012103abe21a9dc0e9f995e3c58d6c60971e6d54559afe222bca04c2b331f42b38c0f3ffffffff6f70aeaa54516863e16fa2082cb5471e0f66b4c7dac25d9da4969e70532f6da00d0000006b483045022100afbeaf9fe032fd77c4e46442b178bdc37c7d6409985caad2463b7ab28befccfd0220779783a9b898d94827ff210c9183ff66bfb56223b0e0118cbba66c48090a4f700121036385f64e18f00d6e56417aa33ad3243356cc5879342865ee06f3b2c17552fe7efffffffffae31df57ccb4216853c0f3cc5af1f8ad7a99fc8de6bc6d80e7b1c81f4baf1e4140000006a473044022076c7bb674a88d9c6581e9c26eac236f6dd9cb38b5ffa2a3860d8083a1751302e022033297ccaaab0a6425c2afbfb6525b75e6f27cd0c9f23202bea28f8fa8a7996b40121031066fb64bd605b8f9d07c45d0d5c42485325b9289213921736bf7b048dec1df3ffffffff909d6efb9e08780c8b8e0fccff74f3e21c5dd12d86dcf5cbea494e18bbb9995c120000006a47304402205c945293257a266f8d575020fa409c1ba28742ff3c6d66f33059675bd6ba676a02204ca582141345a161726bd4ec5f53a6d50b2afbb1aa811acbad44fd295d01948501210316a04c4b9dc5035bc9fc3ec386896dcba281366e8a8a67b4904e4e4307820f56ffffffff90ac0c55af47a073de7c3f98ac5a59cd10409a8069806c8afb9ebbbf0c232436020000006a47304402200e05f3a9db10a3936ede2f64844ebcbdeeef069f4fd7e34b18d66b185217d5e30220479b734d591ea6412ded39665463f0ae90b0b21028905dd8586f74b4eaa9d6980121030e9ba4601ae3c95ce90e01aaa33b2d0426d39940f278325023d9383350923477ffffffff3e2f391615f885e626f70940bc7daf71bcdc0a7c6bf5a5eaece5b2e08d10317c000000006b4830450221009b675247b064079c32b8e632e9ee8bd62b11b5c89f1e0b37068fe9be16ae9653022044bff9be38966d3eae77eb9adb46c20758bc106f91cd022400999226b3cd6064012103239b99cadf5350746d675d267966e9597b7f5dd5a6f0f829b7bc6e5802152abcffffffffe1ce8f7faf221c2bcab3aa74e6b1c77a73d1a5399a9d401ddb4b45dc1bdc4636090000006b483045022100a891ee2286649763b1ff45b5a3ef66ce037e86e11b559d15270e8a61cfa0365302200c1e7aa62080af45ba18c8345b5f37a94e661f6fb1d62fd2f3917aa2897ae4af012102fa6980f47e0fdc80fb94bed1afebec70eb5734308cd30f850042cd9ddf01aebcffffffffe1ce8f7faf221c2bcab3aa74e6b1c77a73d1a5399a9d401ddb4b45dc1bdc4636010000006a4730440220296dbfacd2d3f3bd4224a40b7685dad8d60292a38be994a0804bdd1d1e84edef022000f30139285e6da863bf6821d46b8799a582d453e696589233769ad9810c9f6a01210314936e7118052ac5c4ba2b44cb5b7b577346a5e6377b97291e1207cf5dae47afffffffff0295eef5ad85c9b6b91a3d77bce015065dc64dab526b2f27fbe56f51149bb67f120000006b483045022100b21b2413eb7de91cab6416efd2504b15a12b34c11e6906f44649827f9c343b4702205691ab43b72862ea0ef60279f03b77d364aa843cb8fcb16d736368e432d44698012103f520fb1a59111b3d294861d3ac498537216d4a71d25391d1b3538ccbd8b023f6ffffffff5a7eaeadd2570dd5b9189eb825d6b1876266940789ebb05deeeac954ab520d060c0000006b483045022100949c7c91ae9addf549d828ed51e0ef42255149e29293a34fb8f81dc194c2f4b902202612d2d6251ef13ed936597f979a26b38916ed844a1c3fded0b3b0ea18b54380012103eda1fa3051306238c35d83e8ff8f97aa724d175dede4c0783926c98f106fb194ffffffff15620f5723000000001976a91406595e074efdd41ef65b0c3dba3d69dd3c6e494b88ac58a3fb03000000001976a914b037b0650a691c56c1f98e274e9752e2157d970288ac18c0f702000000001976a914b68642906bca6bb6c883772f35caaeed9f7a1b7888ac83bd5723000000001976a9148729016d0c88ac01d110e7d75006811f283f119788ace41f3823000000001976a9147acd2478d13395a64a0b8eadb62d501c2b41a90c88ac31d50000000000001976a91400d2a28bc7a4486248fab573d72ef6db46f777ea88aca09c0306000000001976a914d43c27ffb4a76590c245cd55447550ffe99f346a88ac80412005000000001976a914997efabe5dce8a24d4a1f3c0f9236bf2f6a2087588ac99bb0000000000001976a914593f550a3f8afe8e90b7bae14f0f0b2c31c4826688ace2c71500000000001976a914ee85450df9ca44a4e330fd0b7d681ec6fbad6fb488acb0eb4a00000000001976a914e7a48c6f7079d95e1505b45f8307197e6191f13888acea015723000000001976a9149537e8f15a7f8ef2d9ff9c674da57a376cf4369b88ac2002c504000000001976a9141821265cd111aafae46ac62f60eed21d1544128388acb0c94f0e000000001976a914a7aef50f0868fe30389b02af4fae7dda0ec5e2e988ac40b3d509000000001976a9140f9ac28f8890318c50cffe1ec77c05afe5bb036888ac9f9d1f00000000001976a914e70288cab4379092b2d694809d555c79ae59223688ac52e85623000000001976a914a947ce2aca9c6e654e213376d8d35db9e36398d788ac21ae0000000000001976a914ff3bc00eac7ec252cd5fb3318a87ac2a86d229e188ace0737a09000000001976a9146189be3daa18cb1b1fa86859f7ed79cc5c8f2b3388acf051a707000000001976a914453b1289f3f8a0248d8d914d7ad3200c6be0d28888acc0189708000000001976a914a5e2e6e7b740cef68eb374313d53a7fab1a8a3cd88ac00000000';
