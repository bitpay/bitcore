'use strict';

var bitcore = require('../..');
var BN = require('../../lib/crypto/bn');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;

var BlockHeader = bitcore.BlockHeader;
var fs = require('fs');
var should = require('chai').should();

// https://test-insight.bitpay.com/block/000000000b99b16390660d79fcc138d2ad0c89a0d044c4201a02bdf1f61ffa11
var dataRawBlockBuffer = fs.readFileSync('test/data/blk15290-testnet.dat');
var dataRawBlockBinary = fs.readFileSync('test/data/blk15290-testnet.dat', 'binary');
var dataRawId = '0000000000388126659ce43a6933bf0a10e63847489df8be552ec77b8f229839';
var data = require('../data/blk15290-testnet');

describe('BlockHeader', function() {
  var version;
  var prevblockidbuf;
  var epochblockbuf;
  var merklerootbuf;
  var extendedMetadatabuf;
  var time;
  var bits;
  var nonce;
  var size;
  var height;
  var bh;
  var bhhex;
  var bhbuf;

  before(function () {
    version = data.version;
    prevblockidbuf =  Buffer.from(data.prevblockidhex, 'hex');
    merklerootbuf = Buffer.from(data.merkleroothex, 'hex');
    extendedMetadatabuf = Buffer.from(data.extendedMetadatahex, 'hex');
    epochblockbuf = Buffer.from(data.epochblockhex, 'hex');
    time = data.time;
    bits = data.bits;
    nonce = data.nonce;
    size = data.size;
    height = data.height;
    bh = new BlockHeader({
      prevHash: prevblockidbuf,
      bits: bits,
      time: time,
      nonce: BN.fromString(nonce),
      version: version,
      size: BN.fromNumber(size),
      height: height,
      epochBlock: epochblockbuf,
      merkleRoot: merklerootbuf,
      extendedMetadata: extendedMetadatabuf
    });
    bhhex = data.blockheaderhex;
    bhbuf = Buffer.from(bhhex, 'hex');
  });

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
        prevHash: prevblockidbuf,
        bits: bits,
        time: time,
        nonce: BN.fromString(nonce),
        version: version,
        size: BN.fromNumber(size),
        height: height,
        epochBlock: epochblockbuf,
        merkleRoot: merklerootbuf,
        extendedMetadata: extendedMetadatabuf
      });
      should.exist(bh.prevHash);
      should.exist(bh.bits);
      should.exist(bh.nonce);
      should.exist(bh.version);
      should.exist(bh.size);
      should.exist(bh.height);
      should.exist(bh.epochBlock);
      should.exist(bh.merkleRoot);
      should.exist(bh.extendedMetadata);
    });

    it('will throw an error if the argument object hash property doesn\'t match', function() {
      (function() {
        var bh = new BlockHeader({
          hash: '0000000000388126659ce43a6933bf0a10e63847489df8be552ec77b8f229839',
          prevHash: prevblockidbuf,
          bits: bits,
          time: time,
          nonce: BN.fromString(nonce),
          version: version,
          size: new BN.fromNumber(size),
          height: height,
          epochBlock: epochblockbuf,
          merkleRoot: merklerootbuf,
          extendedMetadata: extendedMetadatabuf
        });
      }).should.throw('Argument object hash property does not match block hash.');
    });

  });

  describe('version', function() {
    it('is interpreted as an uint8', function() {
      var hex = '4f0bfafc3e3ab70f3e8741c7b74d068298f0ed33c86d9b7dd0b039000000000020223e1b2218dc6000000000183422810c648bcb01a5030000000000ba3b000063a3214bb079b14a6a30e47febaa0ecbe4ee557aa8992980ee370100000000007bc0e12a069b62f53acc37c9b911dddfb0860cf8af11fe0aa7c859e1fd05d88f1406e05881e299367766d313e26c05564ec91bf721d31726bd6e46e60689539a';
      var header = BlockHeader.fromBuffer(Buffer.from(hex, 'hex'));
      header.version.should.equal(1);
    });
  });


  describe('#fromObject', function() {

    it('should set all the variables', function() {
      var bh = BlockHeader.fromObject({
        prevHash: prevblockidbuf,
          bits: bits,
          time: time,
          nonce: BN.fromString(nonce),
          version: version,
          size: BN.fromNumber(size),
          height: height,
          epochBlock: epochblockbuf,
          merkleRoot: merklerootbuf,
          extendedMetadata: extendedMetadatabuf
      });
      should.exist(bh.prevHash);
      should.exist(bh.bits);
      should.exist(bh.nonce);
      should.exist(bh.version);
      should.exist(bh.size);
      should.exist(bh.height);
      should.exist(bh.epochBlock);
      should.exist(bh.merkleRoot);
      should.exist(bh.extendedMetadata);
    });

  });

  describe('#toJSON', function() {

    it('should set all the variables', function() {
      var json = bh.toJSON();
      should.exist(json.prevHash);
      should.exist(json.bits);
      should.exist(json.nonce);
      should.exist(json.version);
      should.exist(json.size);
      should.exist(json.height);
      should.exist(json.epochBlock);
      should.exist(json.merkleRoot);
      should.exist(json.extendedMetadata);
    });

  });

  describe('#fromJSON', function() {

    it('should parse this known json string', function() {

      var jsonString = JSON.stringify({
        prevHash: prevblockidbuf,
        bits: bits,
        time: time,
        nonce: nonce,
        version: version,
        size: size,
        height: height,
        epochBlock: epochblockbuf,
        merkleRoot: merklerootbuf,
        extendedMetadata: extendedMetadatabuf
      });

      var json = new BlockHeader(JSON.parse(jsonString));
      should.exist(json.prevHash);
      should.exist(json.bits);
      should.exist(json.nonce);
      should.exist(json.version);
      should.exist(json.size);
      should.exist(json.height);
      should.exist(json.epochBlock);
      should.exist(json.merkleRoot);
      should.exist(json.extendedMetadata);
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

    it('should instantiate from a raw block binary', function() {
      var x = BlockHeader.fromRawBlock(dataRawBlockBinary);
      x.version.should.equal(1);
      new BN(x.bits).toString('hex').should.equal('1b3e2220');
    });

    it('should instantiate from raw block buffer', function() {
      var x = BlockHeader.fromRawBlock(dataRawBlockBuffer);
      x.version.should.equal(1);
      new BN(x.bits).toString('hex').should.equal('1b3e2220');
    });
  });

  describe('#validTimestamp', function() {

    var x = BlockHeader.fromRawBlock(dataRawBlockBuffer);

    it('should validate timpstamp as true', function() {
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

    it('should validate proof-of-work as true', function() {
      var x = BlockHeader.fromRawBlock(dataRawBlockBuffer);
      var valid = x.validProofOfWork(x);
      valid.should.equal(true);

    });

    it('should validate proof of work as false because incorrect proof of work', function() {
      var x = BlockHeader.fromRawBlock(dataRawBlockBuffer);
      var nonce = x.nonce;
      x.nonce = new BN.fromNumber(0);
      var valid = x.validProofOfWork(x);
      valid.should.equal(false);
      x.nonce = nonce;
    });

  });

  describe('#getDifficulty', function() {
    it('should get the correct difficulty for block 15290', function() {
      var x = BlockHeader.fromRawBlock(dataRawBlockBuffer);
      x.bits.should.equal(0x1b3e2220);
      x.getDifficulty().should.equal(1054.74840666);
    });

    it('should get the correct difficulty for testnet block 5520', function() {
      var x = new BlockHeader({
        bits: 0x1c02e9ac
      });
      x.getDifficulty().should.equal(87.88718228);
    });

    it('should get the correct difficulty for livenet block 3730', function() {
      var x = new BlockHeader({
        bits: 0x1c04bb64
      });
      x.getDifficulty().should.equal(54.09898231);
    });

    it('should get the correct difficulty for livenet block 18000', function() {
      var x = new BlockHeader({
        bits: 0x1b2acda0
      });
      x.getDifficulty().should.equal(1531.07630531);
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
