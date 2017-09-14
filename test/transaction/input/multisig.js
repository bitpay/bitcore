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
var MultiSigInput = bitcore.Transaction.Input.MultiSig;

describe('MultiSigInput', function() {

  var privateKey1 = new PrivateKey('KwF9LjRraetZuEjR8VqEq539z137LW5anYDUnVK11vM3mNMHTWb4');
  var privateKey2 = new PrivateKey('L4PqnaPTCkYhAqH3YQmefjxQP6zRcF4EJbdGqR8v6adtG9XSsadY');
  var privateKey3 = new PrivateKey('L4CTX79zFeksZTyyoFuPQAySfmP7fL3R41gWKTuepuN7hxuNuJwV');
  var public1 = privateKey1.publicKey;
  var public2 = privateKey2.publicKey;
  var public3 = privateKey3.publicKey;
  var address = new Address('H8piCq1XQrr3DbkPF5YFi5VdMV2mCQEnKW');

  var output = {
    txId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
    outputIndex: 0,
    script: new Script("5221025c95ec627038e85b5688a9b3d84d28c5ebe66e8c8d697d498e20fe96e3b1ab1d2102cdddfc974d41a62f1f80081deee70592feb7d6e6cf6739d6592edbe7946720e72103c95924e02c240b5545089c69c6432447412b58be43fd671918bd184a5009834353ae"),
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
  it('can count missing signatures, signed with key 3 and 1', function() {
    var transaction = new Transaction()
        .from(output, [public1, public2, public3], 2)
        .to(address, 1000000);
    var input = transaction.inputs[0];

    input.countSignatures().should.equal(0);

    transaction.sign(privateKey3);
    input.countSignatures().should.equal(1);
    input.countMissingSignatures().should.equal(1);
    input.isFullySigned().should.equal(false);

    transaction.sign(privateKey1);
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
    input._estimateSize().should.equal(147);
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
    var roundtrip = new MultiSigInput(input.toObject());
    roundtrip.toObject().should.deep.equal(input.toObject());
  });
  it('roundtrips to/from object when not signed', function() {
    var transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000);
    var input = transaction.inputs[0];
    var roundtrip = new MultiSigInput(input.toObject());
    roundtrip.toObject().should.deep.equal(input.toObject());
  });
  it('can parse list of signature buffers, from TX signed with key 1 and 2', function() {
    var transaction = new Transaction("010000000140c1ae9d6933e4a08594f814ba73a4e94d19c8a83f45784b1684b3a3f84ee666000000009200473044022012bd2f15e56ab1b63d5ee23e194ed995ad4b81a21bcb8e0d913e5e791c07f7280220278bdb6b54cdc608193c869affe28dc2f700902218122770faff25c56142102b01483045022100e74e9955e042aca36f4f3ad907a0926c5b85e5d9608b0678a78a9cbc0259c7a2022053ff761e5f9a80558db7023e45c4979ac3c19a423f0184fb0596d3da308cc4b501ffffffff0140420f000000000017a91419438da7d16709643be5abd8df62ca4034a489a78700000000");

    var inputObj = transaction.inputs[0].toObject();
    inputObj.output = output;
    transaction.inputs[0] = new Transaction.Input(inputObj);

    inputObj.signatures = MultiSigInput.normalizeSignatures(
        transaction,
        transaction.inputs[0],
        0,
        transaction.inputs[0].script.chunks.slice(1).map(function(s) { return s.buf; }),
        [public1, public2, public3]
    );

    transaction.inputs[0] = new MultiSigInput(inputObj, [public1, public2, public3], 2);

    transaction.inputs[0].signatures[0].publicKey.should.deep.equal(public1);
    transaction.inputs[0].signatures[1].publicKey.should.deep.equal(public2);
    should.equal(transaction.inputs[0].signatures[2], undefined);
    transaction.inputs[0].isValidSignature(transaction, transaction.inputs[0].signatures[0]).should.be.true;
    transaction.inputs[0].isValidSignature(transaction, transaction.inputs[0].signatures[1]).should.be.true;
  });
  it('can parse list of signature buffers, from TX signed with key 3 and 1', function() {
    var transaction = new Transaction("010000000140c1ae9d6933e4a08594f814ba73a4e94d19c8a83f45784b1684b3a3f84ee666000000009300483045022100fc39ce4f51b2766ec8e978296e0594ea4578a3eb2543722fd4053e92bf16e6b1022030f739868397a881b019508b9c725a5c69a3652cb8928027748e93e67dfaef5501483045022100e74e9955e042aca36f4f3ad907a0926c5b85e5d9608b0678a78a9cbc0259c7a2022053ff761e5f9a80558db7023e45c4979ac3c19a423f0184fb0596d3da308cc4b501ffffffff0140420f000000000017a91419438da7d16709643be5abd8df62ca4034a489a78700000000");

    var inputObj = transaction.inputs[0].toObject();
    inputObj.output = output;
    transaction.inputs[0] = new Transaction.Input(inputObj);

    inputObj.signatures = MultiSigInput.normalizeSignatures(
        transaction,
        transaction.inputs[0],
        0,
        transaction.inputs[0].script.chunks.slice(1).map(function(s) { return s.buf; }),
        [public1, public2, public3]
    );

    transaction.inputs[0] = new MultiSigInput(inputObj, [public1, public2, public3], 2);

    transaction.inputs[0].signatures[0].publicKey.should.deep.equal(public1);
    should.equal(transaction.inputs[0].signatures[1], undefined);
    transaction.inputs[0].signatures[2].publicKey.should.deep.equal(public3);
    transaction.inputs[0].isValidSignature(transaction, transaction.inputs[0].signatures[0]).should.be.true;
    transaction.inputs[0].isValidSignature(transaction, transaction.inputs[0].signatures[2]).should.be.true;
  });
});
