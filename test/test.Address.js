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
  it('should be able to detect network from an address', function() {
    // livenet
    var a = new Address('1KfyjCgBSMsLqiCbakfSdeoBUqMqLUiu3T');
    a.network().name.should.equal('livenet');
    a = new Address('1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp');
    a.network().name.should.equal('livenet');
    //p2sh
    a = new Address('3QRhucKtEn5P9i7YPxzXCqBtPJTPbRFycn');
    a.network().name.should.equal('livenet');

    //testnet
    a = new Address('mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE');
    a.network().name.should.equal('testnet');
    a = new Address('n2ekxibY5keRiMaoKFGfiNfXQCS4zTUpct');
    a.network().name.should.equal('testnet');

    //p2sh
    a = new Address('2NBSBcf2KfjPEEqVusmrWdmUeNHRiUTS3Li');
    a.network().name.should.equal('testnet');
  });
  it('#isScript should work', function() {
    // invalid
    new Address('1T').isScript().should.equal(false);
    // pubKeyHash livenet 
    new Address('1KfyjCgBSMsLqiCbakfSdeoBUqMqLUiu3T').isScript().should.equal(false);
    // script livenet
    new Address('3QRhucKtEn5P9i7YPxzXCqBtPJTPbRFycn').isScript().should.equal(true);
    // pubKeyHash testnet
    new Address('mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE').isScript().should.equal(false);
    // script testnet
    new Address('2NBSBcf2KfjPEEqVusmrWdmUeNHRiUTS3Li').isScript().should.equal(true);
  });
 
});
