var BufferWriter = require('../lib/bufferwriter');
var BufferReader = require('../lib/bufferreader');
var should = require('chai').should();
var BN = require('../lib/bn');

describe('BufferReader', function() {
  
  it('should make a new BufferReader', function() {
    var br = new BufferReader();
    should.exist(br);
    br = BufferReader();
    should.exist(br);
  });

  it('should create a new bufferreader with a buffer', function() {
    var buf = new Buffer(0);
    var br = new BufferReader(buf);
    should.exist(br);
    Buffer.isBuffer(br.buf).should.equal(true);
  });

  describe('#set', function() {

    it('should set pos', function() {
      should.exist(BufferReader().set({pos: 1}).pos);
    });

  });

  describe('#eof', function() {

    it('should return true for a blank br', function() {
      var br = new BufferReader({buf: new Buffer([])});
      br.eof().should.equal(true);
    });

  });

  describe('read', function() {
    
    it('should return the same buffer', function() {
      var buf = new Buffer([0]);
      var br = new BufferReader({buf: buf});
      br.read().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should return a buffer of this length', function() {
      var buf = new Buffer(10);
      buf.fill(0);
      var br = new BufferReader(buf);
      var buf2 = br.read(2);
      buf2.length.should.equal(2);
      br.eof().should.equal(false);
      br.pos.should.equal(2);
    });

  });

  describe('#readUInt8', function() {

    it('should return 1', function() {
      var buf = new Buffer(1);
      buf.writeUInt8(1, 0);
      var br = new BufferReader({buf: buf});
      br.readUInt8().should.equal(1);
    });

  });

  describe('#readUInt16BE', function() {

    it('should return 1', function() {
      var buf = new Buffer(2);
      buf.writeUInt16BE(1, 0);
      var br = new BufferReader({buf: buf});
      br.readUInt16BE().should.equal(1);
    });

  });

  describe('#readUInt16LE', function() {

    it('should return 1', function() {
      var buf = new Buffer(2);
      buf.writeUInt16LE(1, 0);
      var br = new BufferReader({buf: buf});
      br.readUInt16LE().should.equal(1);
    });

  });

  describe('#readUInt32BE', function() {

    it('should return 1', function() {
      var buf = new Buffer(4);
      buf.writeUInt32BE(1, 0);
      var br = new BufferReader({buf: buf});
      br.readUInt32BE().should.equal(1);
    });

  });

  describe('#readUInt32LE', function() {

    it('should return 1', function() {
      var buf = new Buffer(4);
      buf.writeUInt32LE(1, 0);
      var br = new BufferReader({buf: buf});
      br.readUInt32LE().should.equal(1);
    });

  });

  describe('#readUInt64BEBN', function() {

    it('should return 1', function() {
      var buf = new Buffer(8);
      buf.fill(0);
      buf.writeUInt32BE(1, 4);
      var br = new BufferReader({buf: buf});
      br.readUInt64BEBN().toNumber().should.equal(1);
    });

    it('should return 2^64', function() {
      var buf = new Buffer(8);
      buf.fill(0xff);
      var br = new BufferReader({buf: buf});
      br.readUInt64BEBN().toNumber().should.equal(Math.pow(2, 64));
    });

  });

  describe('#readUInt64LEBN', function() {

    it('should return 1', function() {
      var buf = new Buffer(8);
      buf.fill(0);
      buf.writeUInt32LE(1, 0);
      var br = new BufferReader({buf: buf});
      br.readUInt64LEBN().toNumber().should.equal(1);
    });

    it('should return 2^30', function() {
      var buf = new Buffer(8);
      buf.fill(0);
      buf.writeUInt32LE(Math.pow(2, 30), 0);
      var br = new BufferReader({buf: buf});
      br.readUInt64LEBN().toNumber().should.equal(Math.pow(2, 30));
    });

    it('should return 0', function() {
      var buf = new Buffer(8);
      buf.fill(0);
      var br = new BufferReader({buf: buf});
      br.readUInt64LEBN().toNumber().should.equal(0);
    });

    it('should return 2^64', function() {
      var buf = new Buffer(8);
      buf.fill(0xff);
      var br = new BufferReader({buf: buf});
      br.readUInt64LEBN().toNumber().should.equal(Math.pow(2, 64));
    });

  });

  describe('#readVarintBuf', function() {

    it('should read a 1 byte varint', function() {
      var buf = new Buffer([50]);
      var br = new BufferReader({buf: buf});
      br.readVarintBuf().length.should.equal(1);
    });

    it('should read a 3 byte varint', function() {
      var buf = new Buffer([253, 253, 0]);
      var br = new BufferReader({buf: buf});
      br.readVarintBuf().length.should.equal(3);
    });

    it('should read a 5 byte varint', function() {
      var buf = new Buffer([254, 0, 0, 0, 0]);
      buf.writeUInt32LE(50000, 1);
      var br = new BufferReader({buf: buf});
      br.readVarintBuf().length.should.equal(5);
    });

    it('should read a 9 byte varint', function() {
      var buf = BufferWriter().writeVarintBN(BN(Math.pow(2, 54).toString())).concat();
      var br = new BufferReader({buf: buf});
      br.readVarintBuf().length.should.equal(9);
    });

  });

  describe('#readVarintNum', function() {

    it('should read a 1 byte varint', function() {
      var buf = new Buffer([50]);
      var br = new BufferReader({buf: buf});
      br.readVarintNum().should.equal(50);
    });

    it('should read a 3 byte varint', function() {
      var buf = new Buffer([253, 253, 0]);
      var br = new BufferReader({buf: buf});
      br.readVarintNum().should.equal(253);
    });

    it('should read a 5 byte varint', function() {
      var buf = new Buffer([254, 0, 0, 0, 0]);
      buf.writeUInt32LE(50000, 1);
      var br = new BufferReader({buf: buf});
      br.readVarintNum().should.equal(50000);
    });

    it('should throw an error on a 9 byte varint over the javascript uint precision limit', function() {
      var buf = BufferWriter().writeVarintBN(BN(Math.pow(2, 54).toString())).concat();
      var br = new BufferReader({buf: buf});
      (function() {
        br.readVarintNum();
      }).should.throw('number too large to retain precision - use readVarintBN');
    });

    it('should not throw an error on a 9 byte varint not over the javascript uint precision limit', function() {
      var buf = BufferWriter().writeVarintBN(BN(Math.pow(2, 53).toString())).concat();
      var br = new BufferReader({buf: buf});
      (function() {
        br.readVarintNum();
      }).should.not.throw('number too large to retain precision - use readVarintBN');
    });

  });

  describe('#readVarintBN', function() {

    it('should read a 1 byte varint', function() {
      var buf = new Buffer([50]);
      var br = new BufferReader({buf: buf});
      br.readVarintBN().toNumber().should.equal(50);
    });

    it('should read a 3 byte varint', function() {
      var buf = new Buffer([253, 253, 0]);
      var br = new BufferReader({buf: buf});
      br.readVarintBN().toNumber().should.equal(253);
    });

    it('should read a 5 byte varint', function() {
      var buf = new Buffer([254, 0, 0, 0, 0]);
      buf.writeUInt32LE(50000, 1);
      var br = new BufferReader({buf: buf});
      br.readVarintBN().toNumber().should.equal(50000);
    });

    it('should read a 9 byte varint', function() {
      var buf = Buffer.concat([new Buffer([255]), new Buffer('ffffffffffffffff', 'hex')]);
      var br = new BufferReader({buf: buf});
      br.readVarintBN().toNumber().should.equal(Math.pow(2, 64));
    });

  });

  describe('#reverse', function() {
    
    it('should reverse this [0, 1]', function() {
      var buf = new Buffer([0, 1]);
      var br = new BufferReader({buf: buf});
      br.reverse().read().toString('hex').should.equal('0100');
    });

  });

});
