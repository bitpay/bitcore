'use strict';

var bitcore = require('../..');
var BN = require('../../lib/crypto/bn');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;

var BlockHeader = bitcore.BlockHeader;
var fs = require('fs');
var should = require('chai').should();

// https://test-insight.bitpay.com/block/000000000b99b16390660d79fcc138d2ad0c89a0d044c4201a02bdf1f61ffa11

const rawBlock = "010000008cc11b2d615d5d4103f7cd78ff1f2bac83ee894c8e848e07bbca1fc39936b17e212f0badef8c9698bf86ac5b23fbf8cdcad1d27757def3705d9207024b14e9519b0c414f6999001ddb9b00800101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff08049b0c414f020d08ffffffff0100f2052a01000000434104319c9899add53596dd3e02ff0e0c4196149fa16eb9316aebf84c78b7b4fc78f85241514b70a2439803d8b707bff97ea2f3b0903e1b080baa92459b740907646dac00000000"

var dataRawId = '7b0285712dc1c736d70150a84749b559a4d80271b79e87c0248265897a8d2372';
var data = require('../data/blk86756-testnet');

describe('BlockHeader', function() {

  var version = data.version;
  var prevblockidbuf = new Buffer(data.prevblockidhex, 'hex');
  var merklerootbuf = new Buffer(data.merkleroothex, 'hex');
  var time = data.time;
  var bits = data.bits;
  var nonce = data.nonce;
  var bh = new BlockHeader({
    version: version,
    prevHash: prevblockidbuf,
    merkleRoot: merklerootbuf,
    time: time,
    bits: bits,
    nonce: nonce
  });
  var b = bitcore.Block.fromString(rawBlock);
  var dataRawBlockBuffer = b.toBuffer();
  var dataRawBlockBinary = dataRawBlockBuffer;
  var bhhex = b.header.toString();
  var bhbuf = new Buffer(bhhex, 'hex');

  it('should make a new blockheader', function() {
    BlockHeader(bhbuf).toBuffer().toString('hex').should.equal(bhhex);
  });

  it('should not make an empty block', function() {
    (function() {
      BlockHeader();
    }).should.throw('Unrecognized argument for BlockHeader');
  });

  describe('#constructor', function() {

    it('should set all the variables', function() {
      var bh = new BlockHeader({
        version: version,
        prevHash: prevblockidbuf,
        merkleRoot: merklerootbuf,
        time: time,
        bits: bits,
        nonce: nonce
      });
      should.exist(bh.version);
      should.exist(bh.prevHash);
      should.exist(bh.merkleRoot);
      should.exist(bh.time);
      should.exist(bh.bits);
      should.exist(bh.nonce);
    });

    it('will throw an error if the argument object hash property doesn\'t match', function() {
      (function() {
        var bh = new BlockHeader({
          hash: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
          version: version,
          prevHash: prevblockidbuf,
          merkleRoot: merklerootbuf,
          time: time,
          bits: bits,
          nonce: nonce
        });
      }).should.throw('Argument object hash property does not match block hash.');
    });

  });

  describe('#fromObject', function() {

    it('should set all the variables', function() {
      var bh = BlockHeader.fromObject({
        version: version,
        prevHash: prevblockidbuf.toString('hex'),
        merkleRoot: merklerootbuf.toString('hex'),
        time: time,
        bits: bits,
        nonce: nonce
      });
      should.exist(bh.version);
      should.exist(bh.prevHash);
      should.exist(bh.merkleRoot);
      should.exist(bh.time);
      should.exist(bh.bits);
      should.exist(bh.nonce);
    });

  });

  describe('#toJSON', function() {

    it('should set all the variables', function() {
      var json = bh.toJSON();
      should.exist(json.version);
      should.exist(json.prevHash);
      should.exist(json.merkleRoot);
      should.exist(json.time);
      should.exist(json.bits);
      should.exist(json.nonce);
    });

  });

  describe('#fromJSON', function() {

    it('should parse this known json string', function() {

      var jsonString = JSON.stringify({
        version: version,
        prevHash: prevblockidbuf,
        merkleRoot: merklerootbuf,
        time: time,
        bits: bits,
        nonce: nonce
      });

      var json = new BlockHeader(JSON.parse(jsonString));
      should.exist(json.version);
      should.exist(json.prevHash);
      should.exist(json.merkleRoot);
      should.exist(json.time);
      should.exist(json.bits);
      should.exist(json.nonce);
    });

  });

  describe('#fromString/#toString', function() {

    it('should output/input a block hex string', function() {
      var b = BlockHeader.fromString(bhhex);
      b.toString().should.equal(bhhex);
    });

  });

  describe('#fromBuffer', function() {

    it('should parse this known buffer', function() {
      BlockHeader.fromBuffer(bhbuf).toBuffer().toString('hex').should.equal(bhhex);
    });

  });

  describe('#fromBufferReader', function() {

    it('should parse this known buffer', function() {
      BlockHeader.fromBufferReader(BufferReader(bhbuf)).toBuffer().toString('hex').should.equal(bhhex);
    });

  });

  describe('#toBuffer', function() {

    it('should output this known buffer', function() {
      BlockHeader.fromBuffer(bhbuf).toBuffer().toString('hex').should.equal(bhhex);
    });

  });

  describe('#toBufferWriter', function() {

    it('should output this known buffer', function() {
      BlockHeader.fromBuffer(bhbuf).toBufferWriter().concat().toString('hex').should.equal(bhhex);
    });

    it('doesn\'t create a bufferWriter if one provided', function() {
      var writer = new BufferWriter();
      var blockHeader = BlockHeader.fromBuffer(bhbuf);
      blockHeader.toBufferWriter(writer).should.equal(writer);
    });

  });

  describe('#inspect', function() {

    it('should return the correct inspect of the genesis block', function() {
      var block = BlockHeader.fromRawBlock(dataRawBlockBinary);
      block.inspect().should.equal('<BlockHeader '+dataRawId+'>');
    });

  });

  describe('#fromRawBlock', function() {

    xit('should instantiate from a raw block binary', function() {
      var x = BlockHeader.fromRawBlock(b.toString());
      console.log(JSON.stringify(x))
      x.version.should.equal(1);
      new BN(x.bits).toString('hex').should.equal('1d009969');
    });

    xit('should instantiate from raw block buffer', function() {
      var x = BlockHeader.fromRawBlock(dataRawBlockBuffer);
      x.version.should.equal(data.version);
      new BN(x.bits).toString('hex').should.equal('1c3fffc0');
    });

  });

  describe('#validTimestamp', function() {

    var x = BlockHeader.fromRawBlock(dataRawBlockBuffer);

    xit('should validate timpstamp as true', function() {
      var valid = x.validTimestamp(x);
      valid.should.equal(true);
    });


    it('should validate timestamp as false', function() {
      x.time = Math.round(new Date().getTime() / 1000) + BlockHeader.Constants.MAX_TIME_OFFSET + 100;
      var valid = x.validTimestamp(x);
      valid.should.equal(false);
    });

  });

  describe('#validProofOfWork', function() {

    xit('should validate proof-of-work as true', function() {
      var x = BlockHeader.fromRawBlock(dataRawBlockBuffer);
      var valid = x.validProofOfWork(x);
      valid.should.equal(true);

    });

    it('should validate proof of work as false because incorrect proof of work', function() {
      var x = BlockHeader.fromRawBlock(dataRawBlockBuffer);
      var nonce = x.nonce;
      x.nonce = 0;
      var valid = x.validProofOfWork(x);
      valid.should.equal(false);
      x.nonce = nonce;
    });

  });

  describe('#getDifficulty', function() {
    xit('should get the correct difficulty for block 86756', function() {
      var x = BlockHeader.fromRawBlock(dataRawBlockBuffer);
      x.bits.should.equal(0x1D009969);
      x.getDifficulty().should.equal(data.difficulty);
    });

    it('should get the correct difficulty for testnet block 552065', function() {
      var x = new BlockHeader({
        bits: 0x1b00c2a8
      });
      x.getDifficulty().should.equal(86187.62562209);
    });

    it('should get the correct difficulty for livenet block 373043', function() {
      var x = new BlockHeader({
        bits: 0x18134dc1
      });
      x.getDifficulty().should.equal(56957648455.01001);
    });

    it('should get the correct difficulty for livenet block 340000', function() {
      var x = new BlockHeader({
        bits: 0x1819012f
      });
      x.getDifficulty().should.equal(43971662056.08958);
    });

    it('should use exponent notation if difficulty is larger than Javascript number', function() {
      var x = new BlockHeader({
        bits: 0x0900c2a8
      });
      x.getDifficulty().should.equal(1.9220482782645836 * 1e48);
    });
  });

  it('coverage: caches the "_id" property', function() {
    var blockHeader = BlockHeader.fromRawBlock(dataRawBlockBuffer);
    blockHeader.id.should.equal(blockHeader.id);
  });

});
