'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

var EncodedData = bitcore.EncodedData;

describe('EncodedData', function() {
  it('should initialze the main object', function() {
    should.exist(EncodedData);
  });
  it('should be able to create class', function() {
    EncodedData = EncodedData;
    should.exist(EncodedData);
  });
  it('should be able to create an instance', function() {
    var ed = new EncodedData('1GMx4HdDmN78xzGvdQYkwrVqkmLDG1aMNT');
    should.exist(ed);
  });
});





