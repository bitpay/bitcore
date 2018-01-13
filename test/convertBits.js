'use strict';

var expect = require('chai').expect;
var should = require('chai').should();
var bitcore = require('..');
var convertBits = bitcore.util.convertBits;

describe('convertBits', function() {

  it('should convert 1', function() {
    var a = convertBits([1], 16, 10);
    a.should.deep.equal([0,16]);
  });

  it('should convert 1,2', function() {
    var a = convertBits([1,2], 16, 10);
    a.should.deep.equal([0,16,0,512]);
  });


  it('should fail to convert 16', function() {
    (function() { convertBits([16], 2, 10); }).should.throw('Invalid Argument: value 16');
  });



});

