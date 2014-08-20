'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();
var expect = chai.expect;

var Address = bitcore.Address;
var Key = bitcore.Key;

describe('AddressCrypto', function() {

  var data = [
    ['Lb6wDP2kHGyWC7vrZuZAgV7V4ECyDdH7a6', 'ltc', 'livenet', true],
    ['L1111111111111111111111111122222234', 'ltc', 'livenet',false],
    ['Lb6wDP2kHGyWC7vrZuZAgV7V4ECyDdH7a7', 'ltc', 'livenet', false],
    ['mnejBCAnqa5C9geAQWWFiRBuoeMAh5LWWu', 'ltc', 'testnet', true],
    ['DUAzhYFx5P13eAVxSdL6Dgg4EKV6pkzXFD', 'doge', 'livenet', true],
    ['D1111111111111111111111111122222234', 'doge', 'livenet', false],
    ['DUAzhYFx5P13eAVxSdL6Dgg4EKV6pkzXFF', 'doge', 'livenet', false],
    ['nn1EAEJtjLaHRJqn4smeASuhcUWbx71rwx', 'doge', 'testnet', true],
    ['Xca1cBHBeaH1LqRw4p5kqsDK65BjPuTDAH', 'drk', 'livenet', true],
    ['Xca1cBHBeaH1LqRw4p5kqsDK65BjPuTDAG', 'drk', 'livenet', false],
    ['mpKHtj2SjAxKBLwZwyDi9UcuVbfgV1gQhD', 'drk', 'testnet', true]
  ];
  data.forEach(function(datum) {
    var address = datum[0];
    var currency = datum[1];
    var network = datum[2];
    var result = datum[3];
    it('should validate correctly ' + address, function() {
      var a = new Address(address, 'base58', currency);
      should.exist(a);
      var s = a.toString();
      a.isValid().should.equal(result);
      a.toString().should.equal(address);
      Address.validate(address, currency).should.equal(result);
      s.should.equal(a.toString()); // check that validation doesn't change data
      if(result){
        a.network().name.should.equal(network);
        new Address(address, currency, currency).isScript().should.equal(false);
      }
    });
  });
});
