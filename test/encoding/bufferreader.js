'use strict';

var should = require('chai').should();
var bitcore = require('../..');
var BufferWriter = bitcore.encoding.BufferWriter;
var BufferReader = bitcore.encoding.BufferReader;
var BN = bitcore.crypto.BN;

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
    it('should fail for invalid object', function() {
      var fail = function() {
        return new BufferReader(5);
      };
      fail.should.throw('Unrecognized argument for BufferReader');
    });

  describe('#set', function() {

    it('should set pos', function() {
      should.exist(BufferReader().set({
        pos: 1
      }).pos);
    });

  });

  describe('#eof', function() {

    it('should return true for a blank br', function() {
      var br = new BufferReader(new Buffer([]));
      br.finished().should.equal(true);
    });

  });

  describe('read', function() {

    it('should return the same buffer', function() {
      var buf = new Buffer([0]);
      var br = new BufferReader(buf);
      br.readAll().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should return a buffer of this length', function() {
      var buf = new Buffer(10);
      buf.fill(0);
      var br = new BufferReader(buf);
      var buf2 = br.read(2);
      buf2.length.should.equal(2);
      br.finished().should.equal(false);
      br.pos.should.equal(2);
    });

    it('should work with 0 length', function() {
      var buf = new Buffer(10);
      buf.fill(1);
      var br = new BufferReader(buf);
      var buf2 = br.read(0);
      buf2.length.should.equal(0);
      br.finished().should.equal(false);
      buf2.toString('hex').should.equal('');
    });

  });

  describe('readVarLengthBuffer', function() {

    it('returns correct buffer', function() {
      var buf = new Buffer('73010000003766404f00000000b305434f00000000f203' +
        '0000f1030000001027000048ee00000064000000004653656520626974636f696' +
        'e2e6f72672f666562323020696620796f7520686176652074726f75626c652063' +
        '6f6e6e656374696e6720616674657220323020466562727561727900473045022' +
        '1008389df45f0703f39ec8c1cc42c13810ffcae14995bb648340219e353b63b53' +
        'eb022009ec65e1c1aaeec1fd334c6b684bde2b3f573060d5b70c3a46723326e4e' +
        '8a4f1', 'hex');
      var br = new BufferReader(buf);
      var b1 = br.readVarLengthBuffer();
      b1.toString('hex').should.equal('010000003766404f00000000b305434f000' +
        '00000f2030000f1030000001027000048ee000000640000000046536565206269' +
        '74636f696e2e6f72672f666562323020696620796f7520686176652074726f756' +
        '26c6520636f6e6e656374696e6720616674657220323020466562727561727900');
      var b2 = br.readVarLengthBuffer();
      b2.toString('hex').should.equal('30450221008389df45f0703f39ec8c1cc42' +
        'c13810ffcae14995bb648340219e353b63b53eb022009ec65e1c1aaeec1fd334c' +
        '6b684bde2b3f573060d5b70c3a46723326e4e8a4f1');
    });
    it('fails on length too big', function() {
      var buf = new Buffer('0a00', 'hex');
      var br = new BufferReader(buf);
      br.readVarLengthBuffer.bind(br).should.throw('Invalid length while reading varlength buffer');
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

  describe('#readVarintBuf', function() {

    it('should read a 1 byte varint', function() {
      var buf = new Buffer([50]);
      var br = new BufferReader(buf);
      br.readVarintBuf().length.should.equal(1);
    });

    it('should read a 3 byte varint', function() {
      var buf = new Buffer([253, 253, 0]);
      var br = new BufferReader(buf);
      br.readVarintBuf().length.should.equal(3);
    });

    it('should read a 5 byte varint', function() {
      var buf = new Buffer([254, 0, 0, 0, 0]);
      buf.writeUInt32LE(50000, 1);
      var br = new BufferReader(buf);
      br.readVarintBuf().length.should.equal(5);
    });

    it('should read a 9 byte varint', function() {
      var buf = BufferWriter().writeVarintBN(new BN(Math.pow(2, 54).toString())).concat();
      var br = new BufferReader(buf);
      br.readVarintBuf().length.should.equal(9);
    });

  });

  describe('#readVarintNum', function() {

    it('should read a 1 byte varint', function() {
      var buf = new Buffer([50]);
      var br = new BufferReader(buf);
      br.readVarintNum().should.equal(50);
    });

    it('should read a 3 byte varint', function() {
      var buf = new Buffer([253, 253, 0]);
      var br = new BufferReader(buf);
      br.readVarintNum().should.equal(253);
    });

    it('should read a 5 byte varint', function() {
      var buf = new Buffer([254, 0, 0, 0, 0]);
      buf.writeUInt32LE(50000, 1);
      var br = new BufferReader(buf);
      br.readVarintNum().should.equal(50000);
    });

    it('should throw an error on a 9 byte varint over the javascript uint precision limit', function() {
      var buf = BufferWriter().writeVarintBN(new BN(Math.pow(2, 54).toString())).concat();
      var br = new BufferReader(buf);
      (function() {
        br.readVarintNum();
      }).should.throw('number too large to retain precision - use readVarintBN');
    });

    it('should not throw an error on a 9 byte varint not over the javascript uint precision limit', function() {
      var buf = BufferWriter().writeVarintBN(new BN(Math.pow(2, 53).toString())).concat();
      var br = new BufferReader(buf);
      (function() {
        br.readVarintNum();
      }).should.not.throw('number too large to retain precision - use readVarintBN');
    });

  });

  describe('#readVarintBN', function() {

    it('should read a 1 byte varint', function() {
      var buf = new Buffer([50]);
      var br = new BufferReader(buf);
      br.readVarintBN().toNumber().should.equal(50);
    });

    it('should read a 3 byte varint', function() {
      var buf = new Buffer([253, 253, 0]);
      var br = new BufferReader(buf);
      br.readVarintBN().toNumber().should.equal(253);
    });

    it('should read a 5 byte varint', function() {
      var buf = new Buffer([254, 0, 0, 0, 0]);
      buf.writeUInt32LE(50000, 1);
      var br = new BufferReader(buf);
      br.readVarintBN().toNumber().should.equal(50000);
    });

    it('should read a 9 byte varint', function() {
      var buf = Buffer.concat([new Buffer([255]), new Buffer('ffffffffffffffff', 'hex')]);
      var br = new BufferReader(buf);
      br.readVarintBN().toNumber().should.equal(Math.pow(2, 64));
    });

  });

  describe('#reverse', function() {

    it('should reverse this [0, 1]', function() {
      var buf = new Buffer([0, 1]);
      var br = new BufferReader(buf);
      br.reverse().readAll().toString('hex').should.equal('0100');
    });

  });

});
