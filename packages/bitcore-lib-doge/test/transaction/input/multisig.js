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
  var privateKey1 = new PrivateKey('4d03b7d1f48393ab7bdd233cb595c522396f1234a32ca96ac8e2cc560470196b');
  var privateKey2 = new PrivateKey('e99d840de3a46c50b2f85afa5bcb3277fa2c9f32697eeefe1cf5ecf2a6cbd3a7');
  var privateKey3 = new PrivateKey('8d85bb60979e350e4fe2f59787c73431637a2dbda0d62f8fb9c0bd816e399157');
  var public1 = privateKey1.publicKey;
  var public2 = privateKey2.publicKey;
  var public3 = privateKey3.publicKey;
  var address = new Address('ADR2xGCbcDu7Akak7udRGR4ugbZF78Fogy');

  var output = {
    txId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
    outputIndex: 0,
    script: new Script("5221022f4e6d26550bdedb5a88de58e2a4d63e36e9e3ffdfa244b5491009e70f47901e2103305b98db06454adefa8e9eff42b4cbc7ce302b5255b0e01774800594eddadb7b2103f88a27019d8e80619076ada9bda728301337008d89563589660e1dc9c23b438153ae"),
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
  it('uses SIGHASH_ALL by default', function() {
    var transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000);
    var input = transaction.inputs[0];
    var sigs = input.getSignatures(transaction, privateKey1, 0);
    sigs[0].sigtype.should.equal(Signature.SIGHASH_ALL);
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
    var transaction = new Transaction("010000000140c1ae9d6933e4a08594f814ba73a4e94d19c8a83f45784b1684b3a3f84ee666000000009200473044022001d776dcb0d45129e2a0260f9a0bbda9c2b17f302e8b286a5c5555a1b1c7a071022009f7418111ee494718f575a2bac3b0f5a1714d6deb87701fe13f8ea672e2004c014830450221008d996e079164e4f9ffadd553b718620d0c34c7852db0a124f0a269a47a16e4fb02207b0324c658db5aec1f9ce2209d033c93cbd5fcde7ede564972d58a90e11b50fb01ffffffff0140420f000000000017a914e61ec81f81d1fef89ea3bc8ee38224fa079b759e8700000000");

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
    var transaction = new Transaction("010000000140c1ae9d6933e4a08594f814ba73a4e94d19c8a83f45784b1684b3a3f84ee666000000009300483045022100b02f9f495127c4ccdd5b5aa20a5535250758424b769066666fb0f424570986090220717185e1486c2c194f39e65a5886a7e986e942c6cea4ece80ddbe723c47bc03f014830450221008d996e079164e4f9ffadd553b718620d0c34c7852db0a124f0a269a47a16e4fb02207b0324c658db5aec1f9ce2209d033c93cbd5fcde7ede564972d58a90e11b50fb01ffffffff0140420f000000000017a914e61ec81f81d1fef89ea3bc8ee38224fa079b759e8700000000");

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
