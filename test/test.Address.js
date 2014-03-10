'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('./bitcore');

var should = chai.should();

var AddressModule = bitcore.Address;
var Address;

describe('Address', function() {
  it('should initialze the main object', function() {
    should.exist(AddressModule);
  });
  it('should be able to create class', function() {
    Address = AddressModule;
    should.exist(Address);
  });
  it('should be able to create instance', function() {
    var a = new Address('1KfyjCgBSMsLqiCbakfSdeoBUqMqLUiu3T');
    should.exist(a);
  });
  it('should validate correctly', function() {
    var a = new Address('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    var m = new Address('32QBdjycLwbDTuGafUwaU5p5GxzSLPYoF6');
    var b = new Address('11111111111111111111111111122222234');
    a.validate.bind(a).should.not.throw(Error);
    m.validate.bind(m).should.not.throw(Error);
    b.validate.bind(b).should.throw(Error);
  });
});





