'use strict';

/* jshint unused: false */
/* jshint latedef: false */
const expect = require('chai').expect;

const bitcore = require('../..');

const Transaction = bitcore.Transaction;
const TransactionSignature = bitcore.Transaction.Signature;
const Script = bitcore.Script;
const PrivateKey = bitcore.PrivateKey;
const errors = bitcore.errors;

describe.only('TransactionSignature', function() {

  const fromAddress = 'mszYqVnqKoQx4jcTdJXxwKAissE3Jbrrc1';
  const privateKey = 'cSBnVM4xvxarwGQuAfQFwqDg9k5tErHUHzgWsEfD4zdwUasvqRVY';
  const simpleUtxoWith100000Satoshis = {
    address: fromAddress,
    txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
    outputIndex: 0,
    script: Script.buildPublicKeyHashOut(fromAddress).toString(),
    satoshis: 100000
  };

  const getSignatureFromTransaction = function() {
    const transaction = new Transaction();
    transaction.from(simpleUtxoWith100000Satoshis);
    return transaction.getSignatures(privateKey)[0];
  };

  it('can be created without the `new` keyword', function() {
    const signature = getSignatureFromTransaction();
    const serialized = signature.toObject();
    const nonew = TransactionSignature(serialized);
    expect(nonew.toObject()).to.deep.equal(serialized);
  });

  it('can be retrieved from Transaction#getSignatures', function() {
    const signature = getSignatureFromTransaction();
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
    const signature = getSignatureFromTransaction();
    expect(new TransactionSignature(signature)).to.equal(signature);
  });

  it('gets returned by a P2SH multisig output', function() {
    const private1 = new PrivateKey('6ce7e97e317d2af16c33db0b9270ec047a91bff3eff8558afb5014afb2bb5976');
    const private2 = new PrivateKey('c9b26b0f771a0d2dad88a44de90f05f416b3b385ff1d989343005546a0032890');
    const public1 = private1.publicKey;
    const public2 = private2.publicKey;
    const utxo = {
      txId: '0000000000000000000000000000000000000000000000000000000000000000', // Not relevant
      outputIndex: 0,
      script: Script.buildMultisigOut([public1, public2], 2).toScriptHashOut(),
      satoshis: 100000
    };
    const transaction = new Transaction().from(utxo, [public1, public2], 2);
    let signatures = transaction.getSignatures(private1);
    expect(signatures[0] instanceof TransactionSignature).to.equal(true);
    signatures = transaction.getSignatures(private2);
    expect(signatures[0] instanceof TransactionSignature).to.equal(true);
  });

  it('can be aplied to a Transaction with Transaction#addSignature', function() {
    const transaction = new Transaction();
    transaction.from(simpleUtxoWith100000Satoshis);
    const signature = transaction.getSignatures(privateKey)[0];
    const addSignature = function() {
      return transaction.applySignature(signature);
    };
    expect(signature instanceof TransactionSignature).to.equal(true);
    expect(addSignature).to.not.throw();
  });

  describe('serialization', function() {
    it('serializes to an object and roundtrips correctly', function() {
      const signature = getSignatureFromTransaction();
      const serialized = signature.toObject();
      expect(new TransactionSignature(serialized).toObject()).to.deep.equal(serialized);
    });

    it('can be deserialized with fromObject', function() {
      const signature = getSignatureFromTransaction();
      const serialized = signature.toObject();
      expect(TransactionSignature.fromObject(serialized).toObject()).to.deep.equal(serialized);
    });

    it('can deserialize when signature is a buffer', function() {
      const signature = getSignatureFromTransaction();
      const serialized = signature.toObject();
      serialized.signature = Buffer.from(serialized.signature, 'hex');
      expect(TransactionSignature.fromObject(serialized).toObject()).to.deep.equal(signature.toObject());
    });

    it('can roundtrip to/from json', function() {
      const signature = getSignatureFromTransaction();
      const serialized = signature.toObject();
      const json = JSON.stringify(signature);
      expect(TransactionSignature(JSON.parse(json)).toObject()).to.deep.equal(serialized);
      expect(TransactionSignature.fromObject(JSON.parse(json)).toObject()).to.deep.equal(serialized);
    });

    it('can parse a previously known json string', function() {
      const str = JSON.stringify(TransactionSignature(JSON.parse(testJSON)));
      expect(JSON.parse(str)).to.deep.equal(JSON.parse(testJSON));
    });

    it('can deserialize a previously known object', function() {
      expect(TransactionSignature(testObject).toObject()).to.deep.equal(testObject);
    });
  });

  /* jshint maxlen: 500 */
  const testJSON = '{"publicKey":"0223078d2942df62c45621d209fab84ea9a7a23346201b7727b9b45a29c4e76f5e","prevTxId":"a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458","outputIndex":0,"inputIndex":0,"signature":"3045022100c728eac064154edba15d4f3e6cbd9be6da3498f80a783ab3391f992b4d9d71ca0220729eff4564dc06aa1d80ab73100540fe5ebb6f280b4a87bc32399f861a7b2563","sigtype":1}';
  const testObject = JSON.parse(testJSON);

});
