'use strict';

var bitcore = require('..');
var BN = require('../lib/crypto/bn');
var BufferReader = bitcore.encoding.BufferReader;
var BlockHeader = bitcore.BlockHeader;
var Block = bitcore.Block;
var chai = require('chai');
var fs = require('fs');
var should = chai.should();
var Transaction = bitcore.Transaction;
var Varint = bitcore.encoding.Varint;

// https://test-insight.bitpay.com/block/000000000b99b16390660d79fcc138d2ad0c89a0d044c4201a02bdf1f61ffa11
var dataRawBlockBuffer = fs.readFileSync('test/data/blk86756-testnet.dat');
var dataRawBlockBinary = fs.readFileSync('test/data/blk86756-testnet.dat', 'binary');
var dataJson = fs.readFileSync('test/data/blk86756-testnet.json').toString();
var data = require('./data/blk86756-testnet');

describe('Block', function() {

  var magicnum = data.magicnum;
  var blockhex = data.blockhex;
  var blockbuf = new Buffer(blockhex, 'hex');
  var blocksize = data.blocksize;
  var bh = BlockHeader.fromBuffer(new Buffer(data.blockheaderhex, 'hex'));
  var txsvi = Varint().fromNumber(data.txsvi);
  var txs = [];
  JSON.parse(dataJson).txs.forEach(function(tx){
    txs.push(new Transaction().fromJSON(tx));
  });
  var json = dataJson;

  var genesishex = 'f9beb4d91d0100000100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c0101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000';
  var genesisbuf = new Buffer(genesishex, 'hex');
  var genesisidhex = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';

  it('should make a new block', function() {
    var b = Block(blockbuf);
    b.toBuffer().toString('hex').should.equal(blockhex);
  });

  it('should not make an empty block', function() {
    (function() {
      var b = new Block();
    }).should.throw('Unrecognized argument for Block');
  });

  describe('#constructor', function() {

    it('should set these known values', function() {
      var b = new Block({
        magicnum: magicnum,
        blocksize: blocksize,
        blockheader: bh,
        txsvi: txsvi,
        txs: txs
      });
      should.exist(b.magicnum);
      should.exist(b.blocksize);
      should.exist(b.txsvi);
      should.exist(b.blockheader);
      should.exist(b.txs);
    });

  });

  describe('#fromRawBlock', function() {

    it('should instantiate from a raw block binary', function() {
      var x = Block.fromRawBlock(dataRawBlockBinary);
      x.blockheader.version.should.equal(2);
      BN(x.blockheader.bits).toString('hex').should.equal('1c3fffc0');
    });

    it('should instantiate from raw block buffer', function() {
      var x = Block.fromRawBlock(dataRawBlockBuffer);
      x.blockheader.version.should.equal(2);
      BN(x.blockheader.bits).toString('hex').should.equal('1c3fffc0');
    });

  });

  describe('#fromJSON', function() {

    it('should set these known values', function() {
      var block = Block.fromJSON(json);
      should.exist(block.magicnum);
      should.exist(block.blocksize);
      should.exist(block.blockheader);
      should.exist(block.txsvi);
      should.exist(block.txs);
    });

    it('should set these known values', function() {

      var block = Block(json);
      should.exist(block.magicnum);
      should.exist(block.blocksize);
      should.exist(block.blockheader);
      should.exist(block.txsvi);
      should.exist(block.txs);
    });

  });

  describe('#toJSON', function() {

    it('should recover these known values', function() {
      var block = Block(json);
      var b = block.toJSON();
      should.exist(b.magicnum);
      should.exist(b.blocksize);
      should.exist(b.blockheader);
      should.exist(b.txsvi);
      should.exist(b.txs);
    });

  });

  describe('#fromBuffer', function() {

    it('should make a block from this known buffer', function() {
      var block = Block.fromBuffer(blockbuf);
      block.toBuffer().toString('hex').should.equal(blockhex);
    });

  });

  describe('#fromBufferReader', function() {

    it('should make a block from this known buffer', function() {
      var block = Block.fromBufferReader(BufferReader(blockbuf));
      block.toBuffer().toString('hex').should.equal(blockhex);
    });

  });

  describe('#toBuffer', function() {

    it('should recover a block from this known buffer', function() {
      var block = Block.fromBuffer(blockbuf);
      block.toBuffer().toString('hex').should.equal(blockhex);
    });

  });

  describe('#toBufferWriter', function() {

    it('should recover a block from this known buffer', function() {
      var block = Block.fromBuffer(blockbuf);
      block.toBufferWriter().concat().toString('hex').should.equal(blockhex);
    });

  });

  describe('#hash', function() {

    it('should return the correct hash of the genesis block', function() {
      var block = Block.fromBuffer(genesisbuf);
      var blockhash = new Buffer(Array.apply([], new Buffer(genesisidhex, 'hex')).reverse());
      block.hash().toString('hex').should.equal(blockhash.toString('hex'));
    });

  });

  describe('#id', function() {

    it('should return the correct id of the genesis block', function() {
      var block = Block.fromBuffer(genesisbuf);
      block.id().toString('hex').should.equal(genesisidhex);
    });

  });

  describe('#inspect', function() {

    it('should return the correct inspect of the genesis block', function() {
      var block = Block.fromBuffer(genesisbuf);
      block.inspect().should.equal('<Block '+genesisidhex+'>');
    });

  });

  describe('#merkleRoot', function() {

    it('should describe as valid merkle root', function() {
      var x = Block.fromRawBlock(dataRawBlockBinary);
      var valid = x.validMerkleRoot();
      valid.should.equal(true);
    });

    it('should describe as invalid merkle root', function() {
      var x = Block.fromRawBlock(dataRawBlockBinary);
      x.txs.push(new Transaction());
      var valid = x.validMerkleRoot();
      valid.should.equal(false);
    });

    it('should get a null hash merkle root', function() {
      var x = Block.fromRawBlock(dataRawBlockBinary);
      x.txs = []; // empty the txs
      var mr = x.getMerkleRoot();
      mr.should.deep.equal(Block.Values.NULL_HASH);
    });

  });

});
