'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();
var expect = chai.expect;

var Address = bitcore.Address;
var Key = bitcore.Key;

describe('Address', function() {
  it('should be able to create class', function() {
    should.exist(Address);
  });
  it('should be able to create instance', function() {
    var a = new Address('DUAzhYFx5P13eAVxSdL6Dgg4EKV6pkzXFD', 'base58', 'doge');
    should.exist(a);
  });
  it('should be able to transform to string', function() {
    var a = new Address('DUAzhYFx5P13eAVxSdL6Dgg4EKV6pkzXFD', 'base58', 'doge');
    a.toString.bind(a).should.not.throw();
    a.toString().should.equal('DUAzhYFx5P13eAVxSdL6Dgg4EKV6pkzXFD');
    a.isValid().should.equal(true);
  });
  var data = [
    ['DUAzhYFx5P13eAVxSdL6Dgg4EKV6pkzXFD', true],
    ['D1111111111111111111111111122222234', false], // totally invalid
    ['DUAzhYFx5P13eAVxSdL6Dgg4EKV6pkzXFF', false]
  ];
  data.forEach(function(datum) {
    var address = datum[0];
    var result = datum[1];
    it('should validate correctly ' + address, function() {
      var a = new Address(address, 'base58', 'doge');
      var s = a.toString();
      a.isValid().should.equal(result);
      Address.validate(address, 'doge').should.equal(result);
      s.should.equal(a.toString()); // check that validation doesn't change data
    });
  });
  it('should be able to detect network from an address', function() {
    // livenet
    var a = new Address('DUAzhYFx5P13eAVxSdL6Dgg4EKV6pkzXFD', 'base58', 'doge');
    a.network().name.should.equal('livenet');
    //testnet
    a = new Address('nn1EAEJtjLaHRJqn4smeASuhcUWbx71rwx', 'base58', 'doge');
    a.network().name.should.equal('testnet');
  });
  it('#isScript should work', function() {
    // invalid
    new Address('DT').isScript().should.equal(false);
    // pubKeyHash livenet 
    new Address('DUAzhYFx5P13eAVxSdL6Dgg4EKV6pkzXFD', 'base58', 'doge').isScript().should.equal(false);
    // pubKeyHash testnet
    new Address('nn1EAEJtjLaHRJqn4smeASuhcUWbx71rwx', 'base58', 'doge').isScript().should.equal(false);
  });

});
