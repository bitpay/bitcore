'use strict';

var should = require('chai').should();
var expect = require('chai').expect;
var _ = require('lodash');

var bitcore = require('../../..');
var errors = bitcore.errors;
var PrivateKey = bitcore.PrivateKey;
var Address = bitcore.Address;
var Script = bitcore.Script;
var Networks = bitcore.Networks;
var Input = bitcore.Transaction.Input;

describe('Transaction.Input', function() {

  var privateKey = new PrivateKey('KwF9LjRraetZuEjR8VqEq539z137LW5anYDUnVK11vM3mNMHTWb4');
  var publicKey = privateKey.publicKey;
  var address = new Address(publicKey, Networks.livenet);
  var output = {
    address: '33zbk2aSZYdNbRsMPPt6jgy6Kq1kQreqeb',
    prevTxId: '66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140',
    outputIndex: 0,
    script: new Script(address),
    satoshis: 1000000
  };
  var coinbase = {
    prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
    outputIndex: 0xFFFFFFFF,
    script: new Script(),
    satoshis: 1000000
  };

  it('has abstract methods: "getSignatures", "isFullySigned", "addSignature", "clearSignatures"', function() {
    var input = new Input(output);
    _.each(['getSignatures', 'isFullySigned', 'addSignature', 'clearSignatures'], function(method) {
      expect(function() {
        return input[method]();
      }).to.throw(errors.AbstractMethodInvoked);
    });
  });
  it('detects coinbase transactions', function() {
    new Input(output).isNull().should.equal(false);
    new Input(coinbase).isNull().should.equal(true);
  });
});
