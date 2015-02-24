'use strict';

/* jshint unused: false */
/* jshint latedef: false */
var should = require('chai').should();
var expect = require('chai').expect;
var _ = require('lodash');

var bitcore = require('../..');
var Transaction = bitcore.Transaction;
var PrivateKey = bitcore.PrivateKey;
var Script = bitcore.Script;
var Address = bitcore.Address;
var Networks = bitcore.Networks;
var errors = bitcore.errors;

var transactionVector = require('../data/tx_creation');

describe('Transaction', function() {

  it('should serialize and deserialize correctly a given transaction', function() {
    var transaction = new Transaction(tx_1_hex);
    transaction.uncheckedSerialize().should.equal(tx_1_hex);
  });

  it('fails if an invalid parameter is passed to constructor', function() {
    expect(function() {
      return new Transaction(1);
    }).to.throw(errors.InvalidArgument);
  });

  var testScript = 'OP_DUP OP_HASH160 20 0x88d9931ea73d60eaf7e5671efc0552b912911f2a OP_EQUALVERIFY OP_CHECKSIG';
  var testPrevTx = 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458';
  var testAmount = 1020000;
  var testTransaction = new Transaction()
    .from({
      'txId': testPrevTx,
      'outputIndex': 0,
      'script': testScript,
      'satoshis': testAmount
    }).to('mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc', testAmount - 10000);

  it('can serialize to a plain javascript object', function() {
    var object = testTransaction.toObject();
    object.inputs[0].output.satoshis.should.equal(testAmount);
    object.inputs[0].output.script.toString().should.equal(testScript);
    object.inputs[0].prevTxId.should.equal(testPrevTx);
    object.inputs[0].outputIndex.should.equal(0);
    object.outputs[0].satoshis.should.equal(testAmount - 10000);
  });

  it('can take a string argument as an amount', function() {
    var stringTx = new Transaction().to('mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc', '10000');
    (stringTx._outputAmount).should.equal(10000);
  });

  it('returns the fee correctly', function() {
    testTransaction.getFee().should.equal(10000);
  });

  it('serialize to Object roundtrip', function() {
    new Transaction(testTransaction.toObject()).uncheckedSerialize()
      .should.equal(testTransaction.uncheckedSerialize());
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
    outputIndex: 0,
    script: Script.buildPublicKeyHashOut(fromAddress).toString(),
    satoshis: 1e8
  };

  describe('adding inputs', function() {

    it('only adds once one utxo', function() {
      var tx = new Transaction();
      tx.from(simpleUtxoWith1BTC);
      tx.from(simpleUtxoWith1BTC);
      tx.inputs.length.should.equal(1);
    });

    describe('isFullySigned', function() {
      it('works for normal p2pkh', function() {
        var transaction = new Transaction()
          .from(simpleUtxoWith100000Satoshis)
          .to(toAddress, 50000)
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
    });
  });

  describe('change address', function() {
    it('can calculate simply the output amount', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100000Satoshis)
        .to(toAddress, 50000)
        .change(changeAddress)
        .sign(privateKey);
      transaction.outputs.length.should.equal(2);
      transaction.outputs[1].satoshis.should.equal(40000);
      transaction.outputs[1].script.toString()
        .should.equal(Script.fromAddress(changeAddress).toString());
      transaction.getChangeOutput().script.should.deep.equal(Script.fromAddress(changeAddress));
    });
    it('accepts a P2SH address for change', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100000Satoshis)
        .to(toAddress, 50000)
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
    it('if fee is too small, fail serialization', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith100000Satoshis)
        .to(toAddress, 99999)
        .change(changeAddress)
        .sign(privateKey);
      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.FeeError);
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
      }).to.throw(errors.Transaction.FeeError);
    });
    it('fails if a dust output is created', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1BTC)
        .to(toAddress, 1)
        .change(changeAddress)
        .sign(privateKey);
      expect(function() {
        return transaction.serialize();
      }).to.throw(errors.Transaction.DustOutputs);
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
    describe('skipping checks', function() {
      it('can skip the check for too much fee', function() {
        var transaction = new Transaction()
          .from(simpleUtxoWith1BTC)
          .fee(50000000)
          .change(changeAddress)
          .sign(privateKey);
        expect(function() {
          return transaction.serialize({disableLargeFees: true});
        }).to.not.throw();
        expect(function() {
          return transaction.serialize();
        }).to.throw();
      });
      it('can skip the check for a fee that is too small', function() {
        var transaction = new Transaction()
          .from(simpleUtxoWith1BTC)
          .fee(1)
          .change(changeAddress)
          .sign(privateKey);
        expect(function() {
          return transaction.serialize({disableSmallFees: true});
        }).to.not.throw();
        expect(function() {
          return transaction.serialize();
        }).to.throw();
      });
      it('can skip the check that prevents dust outputs', function() {
        var transaction = new Transaction()
          .from(simpleUtxoWith1BTC)
          .to(toAddress, 1000)
          .change(changeAddress)
          .sign(privateKey);
        expect(function() {
          return transaction.serialize({disableDustOutputs: true});
        }).to.not.throw();
        expect(function() {
          return transaction.serialize();
        }).to.throw();
      });
      it('can skip the check that prevents unsigned outputs', function() {
        var transaction = new Transaction()
          .from(simpleUtxoWith1BTC)
          .to(toAddress, 10000)
          .change(changeAddress);
        expect(function() {
          return transaction.serialize({disableIsFullySigned: true});
        }).to.not.throw();
        expect(function() {
          return transaction.serialize();
        }).to.throw();
      });
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
      expect(JSON.parse(transaction.toJSON()).changeScript).to.equal(Script.fromAddress(changeAddress).toString());
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
  });

  describe('removeInput and removeOutput', function() {
    it('can remove an input by index', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1BTC);
      transaction.inputs.length.should.equal(1);
      transaction.removeInput(0);
      transaction._inputAmount.should.equal(0);
      transaction.inputs.length.should.equal(0);
    });
    it('can remove an input by transaction id', function() {
      var transaction = new Transaction()
        .from(simpleUtxoWith1BTC);
      transaction.inputs.length.should.equal(1);
      transaction.removeInput(simpleUtxoWith1BTC.txId, simpleUtxoWith1BTC.outputIndex);
      transaction._inputAmount.should.equal(0);
      transaction.inputs.length.should.equal(0);
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
        .to(toAddress, 40000000)
        .to(toAddress, 40000000);
      transaction.outputs.length.should.equal(2);
      transaction.removeOutput(0);
      transaction.outputs.length.should.equal(1);
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
  });

  it('handles anyone-can-spend utxo', function() {
    var transaction = new Transaction()
      .from(anyoneCanSpendUTXO)
      .to(toAddress, 50000);
    should.exist(transaction);
  });

  it('handles unsupported utxo in tx object', function() {
    var transaction = new Transaction();
    transaction.fromJSON.bind(transaction, unsupportedTxObj)
    .should.throw('Unsupported input script type: OP_1 OP_ADD OP_2 OP_EQUAL');
  });

});

var tx_empty_hex = '01000000000000000000';

/* jshint maxlen: 1000 */
var tx_1_hex = '01000000015884e5db9de218238671572340b207ee85b628074e7e467096c267266baf77a4000000006a473044022013fa3089327b50263029265572ae1b022a91d10ac80eb4f32f291c914533670b02200d8a5ed5f62634a7e1a0dc9188a3cc460a986267ae4d58faf50c79105431327501210223078d2942df62c45621d209fab84ea9a7a23346201b7727b9b45a29c4e76f5effffffff0150690f00000000001976a9147821c0a3768aa9d1a37e16cf76002aef5373f1a888ac00000000';
var tx_1_id = '779a3e5b3c2c452c85333d8521f804c1a52800e60f4b7c3bbe36f4bab350b72c';


var tx2hex = '0100000001e07d8090f4d4e6fcba6a2819e805805517eb19e669e9d2f856b41d4277953d640000000091004730440220248bc60bb309dd0215fbde830b6371e3fdc55685d11daa9a3c43828892e26ce202205f10cd4011f3a43657260a211f6c4d1fa81b6b6bdd6577263ed097cc22f4e5b50147522102fa38420cec94843ba963684b771ba3ca7ce1728dc2c7e7cade0bf298324d6b942103f948a83c20b2e7228ca9f3b71a96c2f079d9c32164cd07f08fbfdb483427d2ee52aeffffffff01180fe200000000001976a914ccee7ce8e8b91ec0bc23e1cfb6324461429e6b0488ac00000000';

var unsupportedTxObj = '{"version":1,"inputs":[{"prevTxId":"a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458","outputIndex":0,"sequenceNumber":4294967295,"script":"OP_1","output":{"satoshis":1020000,"script":"OP_1 OP_ADD OP_2 OP_EQUAL"}}],"outputs":[{"satoshis":1010000,"script":"OP_DUP OP_HASH160 20 0x7821c0a3768aa9d1a37e16cf76002aef5373f1a8 OP_EQUALVERIFY OP_CHECKSIG"}],"nLockTime":0}';
