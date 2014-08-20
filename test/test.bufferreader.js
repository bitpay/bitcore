var BufferReader = require('../lib/bufferreader');
var should = require('chai').should();

describe('BufferReader', function() {
  
  it('should make a new BufferReader', function() {
    var br = new BufferReader();
    should.exist(br);
  });

  describe('#eof', function() {

    it('should return true for a blank br', function() {
      var br = new BufferReader(new Buffer([]));
      br.eof().should.equal(true);
    });

  });

  describe('read', function() {
    
    it('should return the same buffer', function() {
      var buf = new Buffer([0]);
      var br = new BufferReader(buf);
      br.read().toString('hex').should.equal(buf.toString('hex'));
    });

  });

  describe('#readUInt8', function() {

    it('should return 1', function() {
      var buf = new Buffer(1);
      buf.writeUInt8(1, 0);
      var br = new BufferReader(buf);
      br.readUInt8().should.equal(1);
    });

  });

  describe('#readUInt16BE', function() {

    it('should return 1', function() {
      var buf = new Buffer(2);
      buf.writeUInt16BE(1, 0);
      var br = new BufferReader(buf);
      br.readUInt16BE().should.equal(1);
    });

  });

  describe('#readUInt16LE', function() {

    it('should return 1', function() {
      var buf = new Buffer(2);
      buf.writeUInt16LE(1, 0);
      var br = new BufferReader(buf);
      br.readUInt16LE().should.equal(1);
    });

  });

  describe('#readUInt32BE', function() {

    it('should return 1', function() {
      var buf = new Buffer(4);
      buf.writeUInt32BE(1, 0);
      var br = new BufferReader(buf);
      br.readUInt32BE().should.equal(1);
    });

  });

  describe('#readUInt32LE', function() {

    it('should return 1', function() {
      var buf = new Buffer(4);
      buf.writeUInt32LE(1, 0);
      var br = new BufferReader(buf);
      br.readUInt32LE().should.equal(1);
    });

  });

  describe('#readUInt64BEBN', function() {

    it('should return 1', function() {
      var buf = new Buffer(8);
      buf.fill(0);
      buf.writeUInt32BE(1, 4);
      var br = new BufferReader(buf);
      br.readUInt64BEBN().toNumber().should.equal(1);
    });

    it('should return 2^64', function() {
      var buf = new Buffer(8);
      buf.fill(0xff);
      var br = new BufferReader(buf);
      br.readUInt64BEBN().toNumber().should.equal(Math.pow(2, 64));
    });

  });

  describe('#readUInt64LEBN', function() {

    it('should return 1', function() {
      var buf = new Buffer(8);
      buf.fill(0);
      buf.writeUInt32LE(1, 0);
      var br = new BufferReader(buf);
      br.readUInt64LEBN().toNumber().should.equal(1);
    });

    it('should return 2^30', function() {
      var buf = new Buffer(8);
      buf.fill(0);
      buf.writeUInt32LE(Math.pow(2, 30), 0);
      var br = new BufferReader(buf);
      br.readUInt64LEBN().toNumber().should.equal(Math.pow(2, 30));
    });

    it('should return 0', function() {
      var buf = new Buffer(8);
      buf.fill(0);
      var br = new BufferReader(buf);
      br.readUInt64LEBN().toNumber().should.equal(0);
    });

    it('should return 2^64', function() {
      var buf = new Buffer(8);
      buf.fill(0xff);
      var br = new BufferReader(buf);
      br.readUInt64LEBN().toNumber().should.equal(Math.pow(2, 64));
    });

  });

  describe('#readVarInt', function() {

    it('should read a 1 byte varint', function() {
      var buf = new Buffer([50]);
      var br = new BufferReader(buf);
      br.readVarInt().should.equal(50);
    });

    it('should read a 3 byte varint', function() {
      var buf = new Buffer([253, 253, 0]);
      var br = new BufferReader(buf);
      br.readVarInt().should.equal(253);
    });

    it('should read a 5 byte varint', function() {
      var buf = new Buffer([254, 0, 0, 0, 0]);
      buf.writeUInt32LE(50000, 1);
      var br = new BufferReader(buf);
      br.readVarInt().should.equal(50000);
    });

    it('should read a 9 byte varint', function() {
      var buf = Buffer.concat([new Buffer([255]), new Buffer('ffffffffffffffff', 'hex')]);
      var br = new BufferReader(buf);
      br.readVarInt().should.equal(Math.pow(2, 64));
    });

  });

  describe('#readVarIntBN', function() {

    it('should read a 1 byte varint', function() {
      var buf = new Buffer([50]);
      var br = new BufferReader(buf);
      br.readVarIntBN().toNumber().should.equal(50);
    });

    it('should read a 3 byte varint', function() {
      var buf = new Buffer([253, 253, 0]);
      var br = new BufferReader(buf);
      br.readVarIntBN().toNumber().should.equal(253);
    });

    it('should read a 5 byte varint', function() {
      var buf = new Buffer([254, 0, 0, 0, 0]);
      buf.writeUInt32LE(50000, 1);
      var br = new BufferReader(buf);
      br.readVarIntBN().toNumber().should.equal(50000);
    });

    it('should read a 9 byte varint', function() {
      var buf = Buffer.concat([new Buffer([255]), new Buffer('ffffffffffffffff', 'hex')]);
      var br = new BufferReader(buf);
      br.readVarIntBN().toNumber().should.equal(Math.pow(2, 64));
    });

  });

  describe('#reverse', function() {
    
    it('should reverse this [0, 1]', function() {
      var buf = new Buffer([0, 1]);
      var br = new BufferReader(buf);
      br.reverse().read().toString('hex').should.equal('0100');
    });

  });

});
