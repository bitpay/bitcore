'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

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
  var data = [
    ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', true],
    ['11111111111111111111111111122222234', false], // totally invalid
    ['32QBdjycLwbDTuGafUwaU5p5GxzSLPYoF6', true],
    ['1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9', true],
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62i', true],
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW600', false],  // bad checksum
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW620', false],  // bad checksum
    ['1ANNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62i', false],  // data changed, original checksum.
    ['1A Na15ZQXAZUgFiqJ2i7Z2DPU2J6hW62i', false],  // invalid chars
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62j', false],  // checksums don't match.
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62!', false],  // bad char (!)
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62iz', false], // too long Bitcoin address
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62izz', false],// too long Bitcoin address
    ['2cFupjhnEsSn59qHXstmK2ffpLv2', false],        // valid base58 invalid data
  ];
  data.forEach(function(datum) {
    var address = datum[0];
    var result = datum[1];
    it('should validate correctly ' + address, function() {
      var a = new Address(address);
      var s = a.toString();

      a.isValid().should.equal(result);
      s.should.equal(a.toString()); // check that validation doesn't change data
    });
  });
});
