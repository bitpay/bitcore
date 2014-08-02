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
    var a = new Address('Lb6wDP2kHGyWC7vrZuZAgV7V4ECyDdH7a6', 'base58', 'ltc');
    should.exist(a);
  });
  it('should be able to transform to string', function() {
    var a = new Address('Lb6wDP2kHGyWC7vrZuZAgV7V4ECyDdH7a6', 'base58', 'ltc');
    a.toString.bind(a).should.not.throw();
    a.toString().should.equal('Lb6wDP2kHGyWC7vrZuZAgV7V4ECyDdH7a6');
    a.isValid().should.equal(true);
  });
  var data = [
    ['Lb6wDP2kHGyWC7vrZuZAgV7V4ECyDdH7a6', true],
    ['L1111111111111111111111111122222234', false], // totally invalid
    ['Lb6wDP2kHGyWC7vrZuZAgV7V4ECyDdH7a7', false]
  ];
  data.forEach(function(datum) {
    var address = datum[0];
    var result = datum[1];
    it('should validate correctly ' + address, function() {
      var a = new Address(address, 'base58', 'ltc');
      var s = a.toString();
      a.isValid().should.equal(result);
      Address.validate(address, 'ltc').should.equal(result);
      s.should.equal(a.toString()); // check that validation doesn't change data
    });
  });
  it('should be able to detect network from an address', function() {
    // livenet
    var a = new Address('Lb6wDP2kHGyWC7vrZuZAgV7V4ECyDdH7a6', 'base58', 'ltc');
    a.network().name.should.equal('livenet');
    //testnet
    a = new Address('mnejBCAnqa5C9geAQWWFiRBuoeMAh5LWWu', 'base58', 'ltc');
    a.network().name.should.equal('testnet');
  });
  it('#isScript should work', function() {
    // invalid
    new Address('LT').isScript().should.equal(false);
    // pubKeyHash livenet 
    new Address('Lb6wDP2kHGyWC7vrZuZAgV7V4ECyDdH7a6', 'base58', 'ltc').isScript().should.equal(false);
    // pubKeyHash testnet
    new Address('mnejBCAnqa5C9geAQWWFiRBuoeMAh5LWWu', 'base58', 'ltc').isScript().should.equal(false);
  });

});
