'use strict';

/* jshint unused: false */
/* jshint latedef: false */
var should = require('chai').should();
var expect = require('chai').expect;
var _ = require('lodash');

var bitcore = require('../..');
var Transaction = bitcore.Transaction;
var TransactionSignature = bitcore.Transaction.Signature;
var Script = bitcore.Script;
var PrivateKey = bitcore.PrivateKey;
var errors = bitcore.errors;

describe.skip('TransactionSignature', function() {
  // Skipped: Bitcoin test vectors with invalid points

  // Coppia Zclassic testnet coerente
  var ZclassicMainnet = bitcore.Networks.mainnet;

  var privateKeyObj = new PrivateKey("9629a8beaa82be7176eb95b1b5a5ece0e2c796cd83ec478840db831a5c9f962f",ZclassicMainnet);
  var wif = privateKeyObj.toWIF();
  var fromAddress = "t1J5votR1LQ19dBPckCbVtDo48EVPaTBYYg";

  
  var simpleUtxoWith100000Satoshis = {
    address: fromAddress,
    txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
    outputIndex: 0,
    script: Script.buildPublicKeyHashOut(fromAddress).toString(),
    satoshis: 100000
  };

  var privateKey = privateKeyObj;
  
  var getSignatureFromTransaction = function() {
    var transaction = new Transaction();
    transaction.from(simpleUtxoWith100000Satoshis);
    return transaction.getSignatures(privateKey)[0];
  };

  it('can be created without the `new` keyword', function() {
    var signature = getSignatureFromTransaction();
    var serialized = signature.toObject();
    var nonew = TransactionSignature(serialized);
    expect(nonew.toObject()).to.deep.equal(serialized);
  });

  it('can be retrieved from Transaction#getSignatures', function() {
    var signature = getSignatureFromTransaction();
    expect(signature instanceof TransactionSignature).to.equal(true);
  });

  it('fails when trying to create from invalid arguments', function() {
    expect(function() {
      return new TransactionSignature();
    }).to.throw(errors.InvalidArgument);
    expect(function() {
      return new TransactionSignature(1);
    }).to.throw(errors.InvalidArgument);
    expect(function() {
      return new TransactionSignature('hello world');
    }).to.throw(errors.InvalidArgument);
  });

  it('returns the same object if called with a TransactionSignature', function() {
    var signature = getSignatureFromTransaction();
    expect(new TransactionSignature(signature)).to.equal(signature);
  });

  it('gets returned by a P2SH multisig output', function() {
    var private1 = new PrivateKey();
    var private2 = new PrivateKey();
    var public1 = private1.publicKey;
    var public2 = private2.publicKey;

    var utxo = {
      txId: '0000000000000000000000000000000000000000000000000000000000000000',
      outputIndex: 0,
      script: Script.buildMultisigOut([public1, public2], 2).toScriptHashOut(),
      satoshis: 100000
    };

    var transaction = new Transaction().from(utxo, [public1, public2], 2);
    var signatures1 = transaction.getSignatures(private1);
    expect(signatures1[0] instanceof TransactionSignature).to.equal(true);

    var signatures2 = transaction.getSignatures(private2);
    expect(signatures2[0] instanceof TransactionSignature).to.equal(true);
  });

  it('can be applied to a Transaction with Transaction#addSignature', function() {
    var transaction = new Transaction();
    transaction.from(simpleUtxoWith100000Satoshis);
    var signature = transaction.getSignatures(privateKey)[0];
    var addSignature = function() {
      return transaction.applySignature(signature);
    };
    expect(signature instanceof TransactionSignature).to.equal(true);
    expect(addSignature).to.not.throw();
  });

  describe('serialization', function() {

    it('serializes to an object and roundtrips correctly', function() {
      var signature = getSignatureFromTransaction();
      var serialized = signature.toObject();
      expect(new TransactionSignature(serialized).toObject()).to.deep.equal(serialized);
    });

    it('can be deserialized with fromObject', function() {
      var signature = getSignatureFromTransaction();
      var serialized = signature.toObject();
      expect(TransactionSignature.fromObject(serialized).toObject()).to.deep.equal(serialized);
    });

    it('can deserialize when signature is a buffer', function() {
      var signature = getSignatureFromTransaction();
      var serialized = signature.toObject();
      serialized.signature = Buffer.from(serialized.signature, 'hex');
      expect(TransactionSignature.fromObject(serialized).toObject()).to.deep.equal(signature.toObject());
    });

    it('can roundtrip to/from json', function() {
      var signature = getSignatureFromTransaction();
      var serialized = signature.toObject();
      var json = JSON.stringify(signature);
      expect(TransactionSignature(JSON.parse(json)).toObject()).to.deep.equal(serialized);
      expect(TransactionSignature.fromObject(JSON.parse(json)).toObject()).to.deep.equal(serialized);
    });

    it('can parse a previously known json string', function() {
      var str = JSON.stringify(TransactionSignature(JSON.parse(testJSON)));
      expect(JSON.parse(str)).to.deep.equal(JSON.parse(testJSON));
    });

    it('can deserialize a previously known object', function() {
      expect(TransactionSignature(testObject).toObject()).to.deep.equal(testObject);
    });

  });

  /* jshint maxlen: 500 */
  var testJSON = '{"publicKey":"0223078d2942df62c45621d209fab84ea9a7a23346201b7727b9b45a29c4e76f5e","prevTxId":"a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458","outputIndex":0,"inputIndex":0,"signature":"3045022100c728eac064154edba15d4f3e6cbd9be6da3498f80a783ab3391f992b4d9d71ca0220729eff4564dc06aa1d80ab73100540fe5ebb6f280b4a87bc32399f861a7b2563","sigtype":1}';
  var testObject = JSON.parse(testJSON);

});

