'use strict';
/* jshint unused: false */
const _ = require('lodash');

const bitcore = require('../../..');

const Transaction = bitcore.Transaction;
const PrivateKey = bitcore.PrivateKey;
const Address = bitcore.Address;
const Script = bitcore.Script;
const Networks = bitcore.Networks;
const Signature = bitcore.crypto.Signature;

describe('PublicKeyHashInput', function() {

  const privateKey = new PrivateKey('KwF9LjRraetZuEjR8VqEq539z137LW5anYDUnVK11vM3mNMHTWb4');
  const publicKey = privateKey.publicKey;
  const address = new Address(publicKey, Networks.livenet);
  const witnessAddress = new Address(publicKey, Networks.livenet, Address.PayToWitnessPublicKeyHash);
  const wrappedAddress = new Address(publicKey, Networks.livenet, Address.PayToScriptHash);

  const output = {
    address: '33zbk2aSZYdNbRsMPPt6jgy6Kq1kQreqeb',
    txId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
    outputIndex: 0,
    script: new Script(address),
    satoshis: 1000000
  };

  const witnessOutput = {
    address: 'bc1q4fyv6yjgj6kjgv5ccnfhqcv0ydft2z6h9xf0xw',
    txId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
    outputIndex: 0,
    script: new Script(witnessAddress),
    satoshis: 1000000
  };

  const wrappedOutput = {
    address: '3PgH5AzNZpoEsdhCpwufpo6xDDHqXsAjAR',
    txId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
    outputIndex: 0,
    script: new Script(wrappedAddress),
    satoshis: 1000000
  };

  it('can count missing signatures', function() {
    const transaction = new Transaction()
      .from(output)
      .to(address, 1000000);
    const input = transaction.inputs[0];

    input.isFullySigned().should.equal(false);
    transaction.sign(privateKey);
    input.isFullySigned().should.equal(true);
  });
  it('it\'s size can be estimated', function() {
    const transaction = new Transaction()
      .from(output)
      .to(address, 1000000);
    const input = transaction.inputs[0];
    input._estimateSize().should.equal(148);
  });
  it('it\'s signature can be removed', function() {
    const transaction = new Transaction()
      .from(output)
      .to(address, 1000000);
    const input = transaction.inputs[0];

    transaction.sign(privateKey);
    input.clearSignatures();
    input.isFullySigned().should.equal(false);
  });
  it('returns an empty array if private key mismatches', function() {
    const transaction = new Transaction()
      .from(output)
      .to(address, 1000000);
    const input = transaction.inputs[0];
    const signatures = input.getSignatures(transaction, new PrivateKey(), 0);
    signatures.length.should.equal(0);
  });

  describe('P2WPKH', function () {
    it('can count missing signatures', function() {
      const transaction = new Transaction()
        .from(witnessOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];

      input.isFullySigned().should.equal(false);
      transaction.sign(privateKey);
      input.isFullySigned().should.equal(true);
    });
    it('it\'s size can be estimated', function() {
      const transaction = new Transaction()
        .from(witnessOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      input._estimateSize().should.equal(67.75);
    });
    it('it\'s signature can be removed', function() {
      const transaction = new Transaction()
        .from(witnessOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];

      transaction.sign(privateKey);
      input.clearSignatures();
      input.isFullySigned().should.equal(false);
    });
    it('returns an empty array if private key mismatches', function() {
      const transaction = new Transaction()
        .from(witnessOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      const signatures = input.getSignatures(transaction, new PrivateKey(), 0);
      signatures.length.should.equal(0);
    });
    it('will get the scriptCode', function() {
      const transaction = new Transaction()
        .from(wrappedOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      const scriptCode = input.getScriptCode(publicKey);
      scriptCode.toString('hex').should.equal('1976a914aa48cd124896ad243298c4d370618f2352b50b5788ac');
    });
    it('will get the satoshis buffer', function() {
      const transaction = new Transaction()
        .from(wrappedOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      const satoshisBuffer = input.getSatoshisBuffer();
      satoshisBuffer.toString('hex').should.equal('40420f0000000000');
    });
  });

  describe('P2SH-wrapped-P2WPKH', function () {
    it('can count missing signatures', function() {
      const transaction = new Transaction()
        .from(wrappedOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];

      input.isFullySigned().should.equal(false);
      transaction.sign(privateKey);
      input.isFullySigned().should.equal(true);
    });
    it('it\'s size can be estimated', function() {
      const transaction = new Transaction()
        .from(wrappedOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      input._estimateSize().should.equal(90.75);
    });
    it('it\'s signature can be removed', function() {
      const transaction = new Transaction()
        .from(wrappedOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];

      transaction.sign(privateKey);
      input.clearSignatures();
      input.isFullySigned().should.equal(false);
    });
    it('returns an empty array if private key mismatches', function() {
      const transaction = new Transaction()
        .from(wrappedOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      const signatures = input.getSignatures(transaction, new PrivateKey(), 0);
      signatures.length.should.equal(0);
    });
    it('will get the scriptCode', function() {
      const transaction = new Transaction()
        .from(wrappedOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      const scriptCode = input.getScriptCode(publicKey);
      scriptCode.toString('hex').should.equal('1976a914aa48cd124896ad243298c4d370618f2352b50b5788ac');
    });
    it('will get the satoshis buffer', function() {
      const transaction = new Transaction()
        .from(wrappedOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      const satoshisBuffer = input.getSatoshisBuffer();
      satoshisBuffer.toString('hex').should.equal('40420f0000000000');
    });
  });
});
