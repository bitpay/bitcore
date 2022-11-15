'use strict';
/* jshint unused: false */

var should = require('chai').should();
var expect = require('chai').expect;
var _ = require('lodash');

var bitcore = require('../../..');
var Transaction = bitcore.Transaction;
var PrivateKey = bitcore.PrivateKey;
var Address = bitcore.Address;
var Script = bitcore.Script;
var Signature = bitcore.crypto.Signature;
var MultiSigScriptHashInput = bitcore.Transaction.Input.MultiSigScriptHash;

describe('MultiSigScriptHashInput', function() {

  var privateKey1 = new PrivateKey('KwF9LjRraetZuEjR8VqEq539z137LW5anYDUnVK11vM3mNMHTWb4');
  var privateKey2 = new PrivateKey('L4PqnaPTCkYhAqH3YQmefjxQP6zRcF4EJbdGqR8v6adtG9XSsadY');
  var privateKey3 = new PrivateKey('L4CTX79zFeksZTyyoFuPQAySfmP7fL3R41gWKTuepuN7hxuNuJwV');
  var public1 = privateKey1.publicKey;
  var public2 = privateKey2.publicKey;
  var public3 = privateKey3.publicKey;
  var address = new Address('H8piCq1XQrr3DbkPF5YFi5VdMV2mCQEnKW');

  var output = {
    address: 'H8piCq1XQrr3DbkPF5YFi5VdMV2mCQEnKW',
    txId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
    outputIndex: 0,
    script: new Script(address),
    satoshis: 1000000
  };
  it('can count missing signatures', function() {
    var transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000);
    var input = transaction.inputs[0];

    input.countSignatures().should.equal(0);

    transaction.sign(privateKey1);
    input.countSignatures().should.equal(1);
    input.countMissingSignatures().should.equal(1);
    input.isFullySigned().should.equal(false);

    transaction.sign(privateKey2);
    input.countSignatures().should.equal(2);
    input.countMissingSignatures().should.equal(0);
    input.isFullySigned().should.equal(true);
  });
  it('returns a list of public keys with missing signatures', function() {
    var transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000);
    var input = transaction.inputs[0];

    _.every(input.publicKeysWithoutSignature(), function(publicKeyMissing) {
      var serialized = publicKeyMissing.toString();
      return serialized === public1.toString() ||
              serialized === public2.toString() ||
              serialized === public3.toString();
    }).should.equal(true);
    transaction.sign(privateKey1);
    _.every(input.publicKeysWithoutSignature(), function(publicKeyMissing) {
      var serialized = publicKeyMissing.toString();
      return serialized === public2.toString() ||
              serialized === public3.toString();
    }).should.equal(true);
  });
  it('can clear all signatures', function() {
    var transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000)
      .sign(privateKey1)
      .sign(privateKey2);

    var input = transaction.inputs[0];
    input.isFullySigned().should.equal(true);
    input.clearSignatures();
    input.isFullySigned().should.equal(false);
  });
  it('can estimate how heavy is the output going to be', function() {
    var transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000);
    var input = transaction.inputs[0];
    input._estimateSize().should.equal(257);
  });
  it('uses SIGHASH_ALL|FORKID by default', function() {
    var transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000);
    var input = transaction.inputs[0];
    var sigs = input.getSignatures(transaction, privateKey1, 0);
    sigs[0].sigtype.should.equal(Signature.SIGHASH_ALL|Signature.SIGHASH_FORKID);
  });
  it('roundtrips to/from object', function() {
    var transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000)
      .sign(privateKey1);
    var input = transaction.inputs[0];
    var roundtrip = new MultiSigScriptHashInput(input.toObject());
    roundtrip.toObject().should.deep.equal(input.toObject());
  });
  it('roundtrips to/from object when not signed', function() {
    var transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000);
    var input = transaction.inputs[0];
    var roundtrip = new MultiSigScriptHashInput(input.toObject());
    roundtrip.toObject().should.deep.equal(input.toObject());
  });
  it('can build a redeem script from non-sorted public keys with a noSorting option', function() {
    var nonSortedPublicKeys = [public1, public2, public3];
    var threshold = 2;
    var opts = { noSorting: true };
    var nonSortedRedeemScript = Script.buildMultisigOut(nonSortedPublicKeys, threshold, opts);
    var nonSortedAddress = Address.payingTo(nonSortedRedeemScript);

    nonSortedAddress.toLegacyAddress().should.equal('HLEAcJ3iYF5sRGR4oSowZx5fuqigfD5Ah7');

    var nonSortedOutput = Object.assign({}, output, {
      address: nonSortedAddress.toLegacyAddress(),
      script: new Script(nonSortedAddress)
    });
    var transaction = new Transaction()
      .from(nonSortedOutput, nonSortedPublicKeys, threshold, opts)
      .to(address, 1000000);
    var input = transaction.inputs[0];

    input.redeemScript.equals(nonSortedRedeemScript).should.equal(true);
  });
});
