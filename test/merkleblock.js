'use strict';

var bitcore = require('..'),
    BufferUtil = bitcore.util.buffer,
    MerkleBlock = bitcore.MerkleBlock,
    BlockHeader = bitcore.BlockHeader,
    BufferReader = bitcore.encoding.BufferReader,
    BufferWriter = bitcore.encoding.BufferWriter,
    data = require('./data/merkleblocks.js');

describe('MerkleBlock', function() {
  var blockhex  = data.HEX[0];
  var blockbuf  = new Buffer(blockhex,'hex');
  var blockJSON = JSON.stringify(data.JSON[0]);
  var blockObject = JSON.parse(JSON.stringify(data.JSON[0]));

  describe('#constructor', function() {
    it('should make a new merkleblock from buffer', function() {
      var b = MerkleBlock(blockbuf);
      b.toBuffer().toString('hex').should.equal(blockhex);
    });

    it('should make a new merkleblock from object', function() {
      var b = MerkleBlock(blockObject);
      b.toObject().should.deep.equal(blockObject);
    });

    it('should make a new merkleblock from JSON', function() {
      var b = MerkleBlock(blockJSON);
      b.toJSON().should.equal(blockJSON);
    });

    it('should not make an empty block', function() {
      (function() {
        return new MerkleBlock();
      }).should.throw('Unrecognized argument for Block');
    });
  });

  describe('#fromJSON', function() {

    it('should set these known values', function() {
      var block = MerkleBlock.fromJSON(blockJSON);
      should.exist(block.header);
      should.exist(block.numTransactions);
      should.exist(block.hashes);
      should.exist(block.flags);
    });

    it('should set these known values', function() {
      var block = MerkleBlock(blockJSON);
      should.exist(block.header);
      should.exist(block.numTransactions);
      should.exist(block.hashes);
      should.exist(block.flags);
    });

    it('accepts an object as argument', function() {
      var block = MerkleBlock(blockbuf);
      MerkleBlock.fromJSON(block.toObject()).should.exist();
    });

  });

  describe('#toJSON', function() {

    it('should recover these known values', function() {
      var block = MerkleBlock.fromJSON(blockJSON);
      var b = JSON.parse(block.toJSON());
      should.exist(block.header);
      should.exist(block.numTransactions);
      should.exist(block.hashes);
      should.exist(block.flags);
    });

  });

  // TODO
  //describe('#fromString/#toString', function() {

    //it('should output/input a block hex string', function() {
      //var b = MerkleBlock.fromString(blockhex);
      //b.toString().should.equal(blockhex);
    //});

  //});

  describe('#fromBuffer', function() {

    it('should make a block from this known buffer', function() {
      var block = MerkleBlock.fromBuffer(blockbuf);
      block.toBuffer().toString('hex').should.equal(blockhex);
    });

  });

  describe('#fromBufferReader', function() {

    it('should make a block from this known buffer', function() {
      var block = MerkleBlock.fromBufferReader(BufferReader(blockbuf));
      block.toBuffer().toString('hex').should.equal(blockhex);
    });

  });

  describe('#toBuffer', function() {

    it('should recover a block from this known buffer', function() {
      var block = MerkleBlock.fromBuffer(blockbuf);
      block.toBuffer().toString('hex').should.equal(blockhex);
    });

  });

  describe('#toBufferWriter', function() {

    it('should recover a block from this known buffer', function() {
      var block = MerkleBlock.fromBuffer(blockbuf);
      block.toBufferWriter().concat().toString('hex').should.equal(blockhex);
    });

    it('doesn\'t create a bufferWriter if one provided', function() {
      var writer = new BufferWriter();
      var block = MerkleBlock.fromBuffer(blockbuf);
      block.toBufferWriter(writer).should.equal(writer);
    });

  });


});

