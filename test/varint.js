var should = require('chai').should();
var BufferReader = require('../lib/bufferreader');
var BufferWriter = require('../lib/bufferwriter');
var Varint = require('../lib/varint');

describe('Varint', function() {

  it('should make a new varint', function() {
    var buf = new Buffer('00', 'hex');
    var varint = new Varint(buf);
    should.exist(varint);
    varint.buf.toString('hex').should.equal('00');
    varint = Varint(buf);
    should.exist(varint);
    varint.buf.toString('hex').should.equal('00');
  });

  describe('#set', function() {
    
    it('should set a buffer', function() {
      var buf = new Buffer('00', 'hex');
      var varint = Varint().set({buf: buf});
      varint.buf.toString('hex').should.equal('00');
      varint.set({});
      varint.buf.toString('hex').should.equal('00');
    });

  });

  describe('#fromBuffer', function() {
    
    it('should set a buffer', function() {
      var buf = BufferWriter().writeVarintNum(5).concat();
      var varint = Varint().fromBuffer(buf);
      varint.toNumber().should.equal(5);
    });

  });

  describe('#fromBufferReader', function() {
    
    it('should set a buffer reader', function() {
      var buf = BufferWriter().writeVarintNum(5).concat();
      var br = BufferReader(buf);
      var varint = Varint().fromBufferReader(br);
      varint.toNumber().should.equal(5);
    });

  });

  describe('#fromNumber', function() {
    
    it('should set a number', function() {
      var varint = Varint().fromNumber(5);
      varint.toNumber().should.equal(5);
    });

  });

  describe('#toBuffer', function() {
    
    it('should return a buffer', function() {
      buf = BufferWriter().writeVarintNum(5).concat();
      var varint = Varint(buf);
      varint.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

  });

  describe('#toNumber', function() {
    
    it('should return a buffer', function() {
      var varint = Varint(5);
      varint.toNumber().should.equal(5);
    });

  });

});
