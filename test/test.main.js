'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var expect = chai.expect;
var should = chai.should();

describe('Initialization of bitcore', function() {
  it('should initialze the main object', function() {
    should.exist(bitcore);
  });
});
