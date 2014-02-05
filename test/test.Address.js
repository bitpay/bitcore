'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

var AddressModule = bitcore.Address;
var Address;

describe.skip('Address', function() {
  it('should initialze the main object', function() {
    should.exist(AddressModule);
  });
  it('should be able to create class', function() {
    Address = AddressModule.class();
  });
  it('should be able to create Address object', function() {
  });
});





