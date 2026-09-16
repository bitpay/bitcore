'use strict';
/* jshint unused: false */
const bitcore = require('../../..');
 
const Transaction = bitcore.Transaction;
const PrivateKey = bitcore.PrivateKey;
const Address = bitcore.Address;
const Script = bitcore.Script;
const Signature = bitcore.crypto.Signature;
const MultiSigScriptHashInput = bitcore.Transaction.Input.MultiSigScriptHash;

describe('MultiSigScriptHashInput', function() {

  const privateKey1 = new PrivateKey('KwF9LjRraetZuEjR8VqEq539z137LW5anYDUnVK11vM3mNMHTWb4');
  const privateKey2 = new PrivateKey('L4PqnaPTCkYhAqH3YQmefjxQP6zRcF4EJbdGqR8v6adtG9XSsadY');
  const privateKey3 = new PrivateKey('L4CTX79zFeksZTyyoFuPQAySfmP7fL3R41gWKTuepuN7hxuNuJwV');
  const public1 = privateKey1.publicKey;
  const public2 = privateKey2.publicKey;
  const public3 = privateKey3.publicKey;
  const address = new Address('33zbk2aSZYdNbRsMPPt6jgy6Kq1kQreqeb');
  const witnessAddress = new Address([public1, public2, public3], 2, null, Address.PayToWitnessScriptHash);

  const output = {
    address: '33zbk2aSZYdNbRsMPPt6jgy6Kq1kQreqeb',
    txId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
    outputIndex: 0,
    script: new Script(address),
    satoshis: 1000000
  };

  const witnessOutput = {
    address: 'bc1qd2kqrwpmz5m6lc42jmgn5vum3ggfkp0kateh6kzqle0jyldwmtxq7ghwrv',
    txId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
    outputIndex: 0,
    script: new Script(witnessAddress),
    satoshis: 1000000
  };

  it('can count missing signatures', function() {
    const transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000);
    const input = transaction.inputs[0];

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
    const transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000);
    const input = transaction.inputs[0];

    const missingPublicKeys = input.publicKeysWithoutSignature().map(function(publicKey) {
      return publicKey.toString();
    });
    missingPublicKeys.should.have.members([
      public1.toString(),
      public2.toString(),
      public3.toString()
    ]);
    missingPublicKeys.should.have.length(3);

    transaction.sign(privateKey1);
    const missingAfterSign = input.publicKeysWithoutSignature().map(function(publicKey) {
      return publicKey.toString();
    });
    missingAfterSign.should.have.members([
      public2.toString(),
      public3.toString()
    ]);
    missingAfterSign.should.have.length(2);
  });
  it('can clear all signatures', function() {
    const transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000)
      .sign(privateKey1)
      .sign(privateKey2);

    const input = transaction.inputs[0];
    input.isFullySigned().should.equal(true);
    input.clearSignatures();
    input.isFullySigned().should.equal(false);
  });
  it('can estimate how heavy is the output going to be', function() {
    const transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000);
    const input = transaction.inputs[0];
    input._estimateSize().should.equal(298);
  });
  it('uses SIGHASH_ALL by default', function() {
    const transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000);
    const input = transaction.inputs[0];
    const sigs = input.getSignatures(transaction, privateKey1, 0);
    sigs[0].sigtype.should.equal(Signature.SIGHASH_ALL);
  });
  it('roundtrips to/from object', function() {
    const transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000)
      .sign(privateKey1);
    const input = transaction.inputs[0];
    const roundtrip = new MultiSigScriptHashInput(input.toObject());
    roundtrip.toObject().should.deep.equal(input.toObject());
  });
  it('roundtrips to/from object when not signed', function() {
    const transaction = new Transaction()
      .from(output, [public1, public2, public3], 2)
      .to(address, 1000000);
    const input = transaction.inputs[0];
    const roundtrip = new MultiSigScriptHashInput(input.toObject());
    roundtrip.toObject().should.deep.equal(input.toObject());
  });
  it('will get the scriptCode for nested witness', function() {
    const address = Address.createMultisig([public1, public2, public3], 2, 'testnet', true);
    const utxo = {
      address: address.toString(),
      txId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
      outputIndex: 0,
      script: new Script(address),
      satoshis: 1000000
    };
    const transaction = new Transaction()
      .from(utxo, [public1, public2, public3], 2, true)
      .to(address, 1000000);
    const input = transaction.inputs[0];
    const scriptCode = input.getScriptCode();
    scriptCode.toString('hex').should.equal('695221025c95ec627038e85b5688a9b3d84d28c5ebe66e8c8d697d498e20fe96e3b1ab1d2102cdddfc974d41a62f1f80081deee70592feb7d6e6cf6739d6592edbe7946720e72103c95924e02c240b5545089c69c6432447412b58be43fd671918bd184a5009834353ae');
  });
  it('will get the satoshis buffer for nested witness', function() {
    const address = Address.createMultisig([public1, public2, public3], 2, 'testnet', true);
    const utxo = {
      address: address.toString(),
      txId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
      outputIndex: 0,
      script: new Script(address),
      satoshis: 1000000
    };
    const transaction = new Transaction()
      .from(utxo, [public1, public2, public3], 2, true)
      .to(address, 1000000);
    const input = transaction.inputs[0];
    const satoshisBuffer = input.getSatoshisBuffer();
    satoshisBuffer.toString('hex').should.equal('40420f0000000000');
  });

  describe('P2WSH', function() {
    it('can count missing signatures', function() {
      const transaction = new Transaction()
        .from(witnessOutput, [public1, public2, public3], 2)
        .to(address, 1000000);
      const input = transaction.inputs[0];

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
      const transaction = new Transaction()
        .from(witnessOutput, [public1, public2, public3], 2)
        .to(address, 1000000);
      const input = transaction.inputs[0];

      const missingPublicKeys = input.publicKeysWithoutSignature().map(function(publicKey) {
        return publicKey.toString();
      });
      missingPublicKeys.should.have.members([
        public1.toString(),
        public2.toString(),
        public3.toString()
      ]);
      missingPublicKeys.should.have.length(3);

      transaction.sign(privateKey1);
      const missingAfterSign = input.publicKeysWithoutSignature().map(function(publicKey) {
        return publicKey.toString();
      });
      missingAfterSign.should.have.members([
        public2.toString(),
        public3.toString()
      ]);
      missingAfterSign.should.have.length(2);
    });
    it('can clear all signatures', function() {
      const transaction = new Transaction()
        .from(witnessOutput, [public1, public2, public3], 2)
        .to(address, 1000000)
        .sign(privateKey1)
        .sign(privateKey2);

      const input = transaction.inputs[0];
      input.isFullySigned().should.equal(true);
      input.clearSignatures();
      input.isFullySigned().should.equal(false);
    });
    it('can estimate how heavy is the output going to be', function() {
      const transaction = new Transaction()
        .from(witnessOutput, [public1, public2, public3], 2)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      input._estimateSize().should.equal(104.5);
    });
    it('uses SIGHASH_ALL by default', function() {
      const transaction = new Transaction()
        .from(witnessOutput, [public1, public2, public3], 2)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      const sigs = input.getSignatures(transaction, privateKey1, 0);
      sigs[0].sigtype.should.equal(Signature.SIGHASH_ALL);
    });
    it('roundtrips to/from object', function() {
      const transaction = new Transaction()
        .from(witnessOutput, [public1, public2, public3], 2)
        .to(address, 1000000)
        .sign(privateKey1);
      const input = transaction.inputs[0];
      const roundtrip = new MultiSigScriptHashInput(input.toObject());
      roundtrip.toObject().should.deep.equal(input.toObject());
    });
    it('roundtrips to/from object when not signed', function() {
      const transaction = new Transaction()
        .from(witnessOutput, [public1, public2, public3], 2)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      const roundtrip = new MultiSigScriptHashInput(input.toObject());
      roundtrip.toObject().should.deep.equal(input.toObject());
    });
    it('will get the scriptCode', function() {
      const transaction = new Transaction()
        .from(witnessOutput, [public1, public2, public3], 2, true)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      const scriptCode = input.getScriptCode();
      scriptCode.toString('hex').should.equal('695221025c95ec627038e85b5688a9b3d84d28c5ebe66e8c8d697d498e20fe96e3b1ab1d2102cdddfc974d41a62f1f80081deee70592feb7d6e6cf6739d6592edbe7946720e72103c95924e02c240b5545089c69c6432447412b58be43fd671918bd184a5009834353ae');
    });
    it('will get the satoshis buffer', function() {
      const transaction = new Transaction()
        .from(witnessOutput, [public1, public2, public3], 2, true)
        .to(address, 1000000);
      const input = transaction.inputs[0];
      const satoshisBuffer = input.getSatoshisBuffer();
      satoshisBuffer.toString('hex').should.equal('40420f0000000000');
    });
  });

});
