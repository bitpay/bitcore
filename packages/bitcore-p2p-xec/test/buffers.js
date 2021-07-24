'use strict';

var chai = require('chai');
var should = chai.should();
var Buffers = require('../lib/buffers');

describe('Buffers', function() {

  var buffs = function buffs() {
    var b = new Buffers();
    b.push(new Buffer('0123', 'hex'));
    b.push(new Buffer('4567', 'hex'));
    b.push(new Buffer('89ab', 'hex'));
    b.push(new Buffer('cdef', 'hex'));
    return b;
  };

  it('set buffers to empty if "i" is greater than the total length', function() {
    var b = buffs();
    b.length.should.equal(8);
    b.skip(100);
    b.buffers.should.deep.equal([]);
    b.length.should.equal(0);
  });

  it('set buffers to empty if "i" is equal than the total length', function() {
    var b = buffs();
    b.length.should.equal(8);
    b.skip(8);
    b.buffers.should.deep.equal([]);
    b.length.should.equal(0);
  });

  it('do not skip if "i" is zero', function() {
    var b = buffs();
    b.skip(0);
    b.length.should.equal(8);
  });

  it('remove part of the first buffer', function() {
    var b = buffs();
    b.skip(1);
    b.length.should.equal(7);
    b.buffers[0].should.deep.equal(new Buffer('23', 'hex'));
  });

  it('remove the first three buffers', function() {
    var b = buffs();
    b.skip(6);
    b.length.should.equal(2);
    should.not.exist(b.buffers[1]);
    should.not.exist(b.buffers[2]);
    should.not.exist(b.buffers[3]);
  });

  it('remove part of the fourth buffer', function() {
    var b = buffs();
    b.skip(7);
    b.length.should.equal(1);
    b.buffers[0].should.deep.equal(new Buffer('ef', 'hex'));
  });

});
