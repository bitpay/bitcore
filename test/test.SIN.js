'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

var SINModule = bitcore.SIN;
var SIN;

describe('SIN', function() {
  it('should initialze the main object', function() {
    should.exist(SINModule);
  });
  it('should be able to create class', function() {
    SIN = SINModule;
    should.exist(SIN);
  });
  it('should be able to create instance', function() {
    var s = new SIN();
    should.exist(s);
  });
});





