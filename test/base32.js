'use strict';

var expect = require('chai').expect;
var should = require('chai').should();
var bitcore = require('..');
var base32 = bitcore.util.base32;

describe('base32', function() {

  it('should encode 0-5', function() {
    var a = base32.encode([0,1,2,3,4,5]);
    a.should.equal('qpzry9');
  });


  it('should encode 0-31', function() {
    var all=[];
    for(var i = 0; i<32; i++) {
      all.push(i);
    }
    var a = base32.encode(all);
    a.should.equal('qpzry9x8gf2tvdw0s3jn54khce6mua7l');
  });

  it('should fail to encode 35', function() {
    (function() {base32.encode([35]);}).should.throw('Invalid Argument: value 35');
  });

  it('should decode 0-31', function() {
    var a=  'qpzry9x8gf2tvdw0s3jn54khce6mua7lqpzry9x8gf2tvdw0s3jn54khce6mua7l';
    var all=[];
    for(var i = 0; i<32; i++) {
      all.push(i);
    }
    all=all.concat(all);
    base32.decode(a).should.deep.equal(all);
  });

  it('should fail decode abc', function() {
    var a=  'abc';
    (function() {base32.decode(a);}).should.throw('Invalid Argument: value b');
  });

  it('should fail decode Q', function() {
    var a=  'aqQ';
    (function() {base32.decode(a);}).should.throw('Invalid Argument: value Q');
  });

});

