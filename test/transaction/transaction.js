'use strict';

/* jshint unused: false */
/* jshint latedef: false */
var should = require('chai').should();
var _ = require('lodash');

var bitcore = require('../..');
var Transaction = bitcore.Transaction;
var PrivateKey = bitcore.PrivateKey;
var Script = bitcore.Script;
var Address = bitcore.Address;
var Networks = bitcore.Networks;

var transactionVector = require('./creation');

describe('Transaction', function() {

  it('should serialize and deserialize correctly a given transaction', function() {
    var transaction = new Transaction(tx_1_hex);
    transaction.serialize().should.equal(tx_1_hex);
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
    transaction.serialize().should.equal(tx_empty_hex);
  });

  it('serializes and deserializes correctly', function() {
    var transaction = new Transaction(tx_1_hex);
    transaction.serialize().should.equal(tx_1_hex);
  });

  describe('transaction creation test vector', function() {
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
  describe('MultiSigScriptHashInput', function() {
    var MultiSigScriptHashInput = Transaction.Input.MultiSigScriptHash;

    var privateKey1 = new PrivateKey('KwF9LjRraetZuEjR8VqEq539z137LW5anYDUnVK11vM3mNMHTWb4');
    var privateKey2 = new PrivateKey('L4PqnaPTCkYhAqH3YQmefjxQP6zRcF4EJbdGqR8v6adtG9XSsadY');
    var privateKey3 = new PrivateKey('L4CTX79zFeksZTyyoFuPQAySfmP7fL3R41gWKTuepuN7hxuNuJwV');
    var public1 = privateKey1.publicKey;
    var public2 = privateKey2.publicKey;
    var public3 = privateKey3.publicKey;
    var address = new Address('33zbk2aSZYdNbRsMPPt6jgy6Kq1kQreqeb');

    var output = {
      address: '33zbk2aSZYdNbRsMPPt6jgy6Kq1kQreqeb',
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

      _.all(input.publicKeysWithoutSignature(), function(publicKeyMissing) {
        var serialized = publicKeyMissing.toString();
        return serialized === public1.toString() ||
               serialized === public2.toString() ||
               serialized === public3.toString();
      }).should.equal(true);
      transaction.sign(privateKey1);
      _.all(input.publicKeysWithoutSignature(), function(publicKeyMissing) {
        var serialized = publicKeyMissing.toString();
        return serialized === public2.toString() ||
               serialized === public3.toString();
      }).should.equal(true);
    });
  });
});

var tx_empty_hex = '01000000000000000000';

/* jshint maxlen: 1000 */
var tx_1_hex = '01000000015884e5db9de218238671572340b207ee85b628074e7e467096c267266baf77a4000000006a473044022013fa3089327b50263029265572ae1b022a91d10ac80eb4f32f291c914533670b02200d8a5ed5f62634a7e1a0dc9188a3cc460a986267ae4d58faf50c79105431327501210223078d2942df62c45621d209fab84ea9a7a23346201b7727b9b45a29c4e76f5effffffff0150690f00000000001976a9147821c0a3768aa9d1a37e16cf76002aef5373f1a888ac00000000';
var tx_1_id = '779a3e5b3c2c452c85333d8521f804c1a52800e60f4b7c3bbe36f4bab350b72c';
