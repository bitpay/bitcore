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
var UnspentOutput = bitcore.Transaction.UnspentOutput;

describe('PublicKeyHash / UnspentOutput tests', function() {

  var privateKey = new PrivateKey();
  var pubkey = privateKey.publicKey;
  var address = pubkey.toAddress();

  var utxoObj = {
    address: address.toString(),
    txId: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    outputIndex: 1,
    script: Script.buildPublicKeyHashOut(address),
    satoshis: 500000
  };

  it('UnspentOutput displays nicely on the console', function() {
    var u = new UnspentOutput(utxoObj);
    var s = u.toString(); // should not throw
    s.should.be.a('string');
    s.indexOf(utxoObj.txId.substring(0,8)).should.not.equal(-1);
  });

  it('toString returns txid:vout', function() {
    var u = new UnspentOutput(utxoObj);
    u.toString().should.equal(utxoObj.txId + ':' + utxoObj.outputIndex);
  });

  it('to/from JSON roundtrip', function() {
    var u = new UnspentOutput(utxoObj);
    var json = u.toJSON();
    var round = new UnspentOutput(json);
    round.toString().should.equal(u.toString());
    round.satoshis.should.equal(u.satoshis);
  });

});
