'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

describe('Miscelaneous stuff', function() {
  it('should initialze the config object', function() {
    should.exist(bitcore.config);
  });
  it('should initialze the log object', function() {
    should.exist(bitcore.log);
  });
  it('should initialze the util object', function() {
    should.exist(bitcore.util);
  });

});





