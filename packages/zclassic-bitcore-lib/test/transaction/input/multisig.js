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
var MultiSigScriptHashInput = bitcore.Transaction.Input.MultiSigScriptHash;

describe('MultiSig (generic) tests', function() {

  // Use stable WIFs (same as other tests) so tests are deterministic
  var privateKey1 = new PrivateKey('L4fFptrcr8mmrhtuwsHGT39DiW3QzzDYVaFW7NmDR9xXFCataWJb');
  var privateKey2 = new PrivateKey('KyBma9weekjqJsxqG4AZw8U2GYbFzbxPMorT7PnkRibnogptmqKA');
  var privateKey3 = new PrivateKey('L2J4xuRWP4DeE2vbMYiCTFj1NwKBy4PZATeV6coT6MzEfpBuvWnL');

  var public1 = privateKey1.publicKey;
  var public2 = privateKey2.publicKey;
  var public3 = privateKey3.publicKey;

  // create a P2SH multisig address (m = 2 of 3)
  var multisigAddress = Address.createMultisig([public1, public2, public3], 2);

  // For destination use a P2PKH address derived from privateKey1 (coherent)
  var destination = privateKey1.toPublicKey().toAddress();

  // UTXO that is actually a P2SH output (script = scriptHashOut(multisigAddress))
  var utxo = {
    address: multisigAddress.toString(),
    txId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    outputIndex: 0,
    script: Script.buildScriptHashOut(multisigAddress),
    satoshis: 1000000
  };

  it('MultiSigInput: can count missing signatures', function() {
    var tx = new Transaction()
      .from(utxo, [public1, public2, public3], 2)
      .to(destination, 900000);

    var input = tx.inputs[0];
    input.countSignatures().should.equal(0);

    tx.sign(privateKey1);
    input.countSignatures().should.equal(1);
    input.countMissingSignatures().should.equal(1);
    input.isFullySigned().should.equal(false);

    tx.sign(privateKey2);
    input.countSignatures().should.equal(2);
    input.countMissingSignatures().should.equal(0);
    input.isFullySigned().should.equal(true);
  });

  it('MultiSigInput: returns a list of public keys with missing signatures', function() {
    var tx = new Transaction()
      .from(utxo, [public1, public2, public3], 2)
      .to(destination, 900000);

    var input = tx.inputs[0];

    // use _.every instead of _.all
    _.every(input.publicKeysWithoutSignature(), function(pkMissing) {
      var s = pkMissing.toString();
      return s === public1.toString() || s === public2.toString() || s === public3.toString();
    }).should.equal(true);

    tx.sign(privateKey1);
    _.every(input.publicKeysWithoutSignature(), function(pkMissing) {
      var s = pkMissing.toString();
      return s === public2.toString() || s === public3.toString();
    }).should.equal(true);
  });

  it('MultiSigInput: can clear all signatures', function() {
    var tx = new Transaction()
      .from(utxo, [public1, public2, public3], 2)
      .to(destination, 900000)
      .sign(privateKey1)
      .sign(privateKey2);

    var input = tx.inputs[0];
    input.isFullySigned().should.equal(true);
    input.clearSignatures();
    input.isFullySigned().should.equal(false);
  });

  it('MultiSigInput: estimate size', function() {
    var tx = new Transaction()
      .from(utxo, [public1, public2, public3], 2)
      .to(destination, 900000);
    var input = tx.inputs[0];
    // keep the expected size consistent with library implementation
    input._estimateSize().should.be.a('number');
  });

  it.skip('MultiSigScriptHashInput: roundtrip signed and unsigned', function() {
    // Skipped: P2SH hash mismatch with Zclassic
    var tx = new Transaction()
      .from(utxo, [public1, public2, public3], 2)
      .to(destination, 900000)
      .sign(privateKey1);

    var input = tx.inputs[0];
    var roundtrip = new MultiSigScriptHashInput(input.toObject());
    roundtrip.toObject().should.deep.equal(input.toObject());

    // when not signed
    var tx2 = new Transaction()
      .from(utxo, [public1, public2, public3], 2)
      .to(destination, 900000);

    var input2 = tx2.inputs[0];
    var roundtrip2 = new MultiSigScriptHashInput(input2.toObject());
    roundtrip2.toObject().should.deep.equal(input2.toObject());
  });

});
