'use strict';
/* jshint unused: false */

require('chai').should();

const bitcore = require('../../..');
const Transaction = bitcore.Transaction;
const PrivateKey = bitcore.PrivateKey;
const Address = bitcore.Address;
const Script = bitcore.Script;
const Networks = bitcore.Networks;

describe('TaprootInput', function() {

  const privateKey = new PrivateKey('KwF9LjRraetZuEjR8VqEq539z137LW5anYDUnVK11vM3mNMHTWb4');
  const publicKey = privateKey.publicKey;
  const address = new Address(publicKey, Networks.livenet);
  const taprootAddress = new Address(publicKey, Networks.livenet, Address.PayToTaproot);

  const output = {
    address: '33zbk2aSZYdNbRsMPPt6jgy6Kq1kQreqeb',
    txId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
    outputIndex: 0,
    script: new Script(address),
    satoshis: 1000000
  };

  const taprootOutput = {
    address: 'bc1pnupe39s4phnjvsta2u0df59ky85mt4rjxjmpp8xnf3mga8dw9r0sptzca0',
    txId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
    outputIndex: 0,
    script: new Script(taprootAddress),
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
    input.isFullySigned().should.equal(true);
    input.clearSignatures();
    input.isFullySigned().should.equal(false);
  });
  it('returns an empty array if private key mismatches', function() {
    const transaction = new Transaction()
      .from(output)
      .to(address, 1000000);
    const input = transaction.inputs[0];
    const signatures = input.getSignatures(transaction, new PrivateKey(), 0);
    Array.isArray(signatures).should.equal(true);
    signatures.length.should.equal(0);
  });

  describe('P2TR', function () {
    it('can count missing signatures', function() {
      const transaction = new Transaction()
        .from(taprootOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];

      input.isFullySigned().should.equal(false);
      transaction._estimateSize();
      transaction.sign(privateKey);
      input.isFullySigned().should.equal(true);
    });
    it('it\'s size can be estimated', function() {
      const transaction = new Transaction()
        .from(taprootOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      input._estimateSize().should.equal(57.5);
    });
    it('it\'s signature can be removed', function() {
      const transaction = new Transaction()
        .from(taprootOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];

      transaction.sign(privateKey);
      input.isFullySigned().should.equal(true);
      input.clearSignatures();
      input.isFullySigned().should.equal(false);
    });
    it('returns an empty array if private key mismatches', function() {
      const transaction = new Transaction()
        .from(taprootOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      const signatures = input.getSignatures(transaction, new PrivateKey(), 0);
      signatures.length.should.equal(0);
    });
    it('will get the scriptCode', function() {
      const transaction = new Transaction()
        .from(taprootOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      const scriptCode = input.getScriptCode(publicKey);
      scriptCode.toString('hex').should.equal('2576a9209f039896150de726417d571ed4d0b621e9b5d47234b6109cd34c768e9dae28df88ac');
    });
    it('will get the satoshis buffer', function() {
      const transaction = new Transaction()
        .from(taprootOutput)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      const satoshisBuffer = input.getSatoshisBuffer();
      satoshisBuffer.toString('hex').should.equal('40420f0000000000');
    });
  });
});
