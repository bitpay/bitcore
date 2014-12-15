'use strict';

/* jshint unused: false */
/* jshint latedef: false */
var should = require('chai').should();
var _ = require('lodash');

var bitcore = require('..');
var Transaction = bitcore.Transaction;
var Script = bitcore.Script;

var valid = require('./data/bitcoind/tx_valid.json');
var invalid = require('./data/bitcoind/tx_invalid.json');

describe('Transaction', function() {

  describe('bitcoind compliance', function() {
    
    valid.map(function(datum){
      if ( typeof(datum[0]) === 'string' ) {
        return;
      }

      it('should deserialize/serialize '+datum[1].slice(0, 15)+'... transaction', function() {
        var serialized = datum[1];
        var t = new Transaction(serialized);
        t.serialize().should.equal(serialized);
      });

    });

  });

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

  it('should input/output json', function() {
    var transaction = JSON.parse(Transaction().fromJSON(tx_1_json).toJSON());
    transaction.should.deep.equal(JSON.parse(tx_1_json));
  });

  it('should create a sample transaction from an utxo', function() {
    var transaction = new Transaction()
      .from(utxo_1a)
      .to(address_1, amount_1)
      .sign(privkey_1a)
      .serialize()
      .should.equal(tx_1_hex);
  });

  it.skip('should create a transaction with two utxos', function() {
    var transaction = new Transaction()
      .from([utxo_2a, utxo_2b])
      .to(address_2, amount_2)
      .sign([privkey_2a, privkey_2b])
      .serialize()
      .should.equal(tx_2_hex);
  });
});

var tx_empty_hex = '01000000000000000000';

/* jshint maxlen: 1000 */
var tx_1_hex = '01000000015884e5db9de218238671572340b207ee85b628074e7e467096c267266baf77a4000000006a473044022013fa3089327b50263029265572ae1b022a91d10ac80eb4f32f291c914533670b02200d8a5ed5f62634a7e1a0dc9188a3cc460a986267ae4d58faf50c79105431327501210223078d2942df62c45621d209fab84ea9a7a23346201b7727b9b45a29c4e76f5effffffff0150690f00000000001976a9147821c0a3768aa9d1a37e16cf76002aef5373f1a888ac00000000';
var tx_1_id = '779a3e5b3c2c452c85333d8521f804c1a52800e60f4b7c3bbe36f4bab350b72c';
var tx_2_hex = '';

var tx_1_json = JSON.stringify({
  version:1,
  inputs:[{
    prevTxId:"a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458",
    outputIndex:0,
    sequenceNumber:4294967295,
    script:'71 0x3044022013fa3089327b50263029265572ae1b022a91d10ac80eb4f32f291c914533670b02200d8a5ed5f62634a7e1a0dc9188a3cc460a986267ae4d58faf50c79105431327501 33 0x0223078d2942df62c45621d209fab84ea9a7a23346201b7727b9b45a29c4e76f5e'}],
  outputs:[{
    satoshis:1010000,
    script:'OP_DUP OP_HASH160 20 0x7821c0a3768aa9d1a37e16cf76002aef5373f1a8 OP_EQUALVERIFY OP_CHECKSIG'
  }],
  nLockTime:0
});

var utxo_1a_address = 'mszYqVnqKoQx4jcTdJXxwKAissE3Jbrrc1';

var utxo_2a_address = 'mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc';
var utxo_2b_address = 'mrCHmWgn54hJNty2srFF4XLmkey5GnCv5m';

/* A new-format utxo */
var utxo_1a = {
  address: utxo_1a_address,
  txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
  outputIndex: 0,
  script: Script.buildPublicKeyHashOut(utxo_1a_address).toString(),
  satoshis: 1020000
};
/* An old-format utxo */
var utxo_2a = {
  address: utxo_2a_address,
  txid: '779a3e5b3c2c452c85333d8521f804c1a52800e60f4b7c3bbe36f4bab350b72c',
  vout: 0,
  scriptPubKey: Script.buildPublicKeyHashOut(utxo_2a_address).toString(),
  amount: 0.01010000
};
var utxo_2b = {
  address: utxo_2b_address,
  txid: 'e0f44096fcac31c1baede0714997c831123ecb5e258b52617fb093ba487c1d04',
  vout: 0,
  scriptPubKey: Script.buildPublicKeyHashOut(utxo_2b_address).toString(),
  amount: 0.00090000
};

var address_1 = 'mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc';
var address_2 = 'mrCHmWgn54hJNty2srFF4XLmkey5GnCv5m';
var amount_1 = 1010000;
var amount_2 = 1090000;
var privkey_1a = 'cSBnVM4xvxarwGQuAfQFwqDg9k5tErHUHzgWsEfD4zdwUasvqRVY';
var privkey_2a = 'cVLKm6LT1VTpZJVaSYtkYPLP1UP2Ph6NFxGVNLPAKKuSfv8hHreU';
var privkey_2b = 'cVWHj19aJXVAxcKC5xAWQmiyhWyarmcPcuv4dT7nZy1JR37dbWgT';
