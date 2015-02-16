'use strict';

var chai = require('chai');

var Data = require('./data/messages');
var P2P = require('../');
var BloomFilter = P2P.BloomFilter;


describe('BloomFilter', function() {
  it('BloomFilter#fromBuffer and toBuffer methods work', function() {
    var testPayload = Data.FILTERLOAD.payload;
    var filter = new BloomFilter.fromBuffer(new Buffer(testPayload, 'hex'));
    filter.toBuffer().toString('hex').should.equal(testPayload);
  });

});
