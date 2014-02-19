'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

var Key = bitcore.Key;

describe.skip('Key', function() {
  it('should initialze the main object', function() {
    should.exist(Key);
  });
  it('should be able to create instance', function() {
    var k = new Key();
    should.exist(k);
  });
});





