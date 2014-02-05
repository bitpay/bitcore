'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

var EncodedDataModule = bitcore.EncodedData;
var EncodedData;

describe('EncodedData', function() {
  it('should initialze the main object', function() {
    should.exist(EncodedDataModule);
  });
  it('should be able to create class', function() {
    EncodedData = EncodedDataModule.class();
    should.exist(EncodedData);
  });
  it('should be able to create EncodedData object', function() {
    var ed = new EncodedData();
    should.exist(ed);
  });
});





