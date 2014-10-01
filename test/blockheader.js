var Blockheader = require('../lib/blockheader');
var BufferWriter = require('../lib/bufferwriter');
var BufferReader = require('../lib/bufferreader');
var should = require('chai').should();

describe('Blockheader', function() {
  
  var bh = new Blockheader();
  var version = 1;
  var prevblockidbuf = new Buffer(32);
  prevblockidbuf.fill(5);
  var merklerootbuf = new Buffer(32);
  merklerootbuf.fill(9);
  var time = 2;
  var bits = 3;
  var nonce = 4;
  bh.set({
    version: version,
    prevblockidbuf: prevblockidbuf,
    merklerootbuf: merklerootbuf,
    time: time,
    bits: bits,
    nonce: nonce
  });
  bhhex = '0100000005050505050505050505050505050505050505050505050505050505050505050909090909090909090909090909090909090909090909090909090909090909020000000300000004000000';
  bhbuf = new Buffer(bhhex, 'hex');

  it('should make a new blockheader', function() {
    var blockheader = new Blockheader();
    should.exist(blockheader);
    blockheader = Blockheader();
    should.exist(blockheader);
    Blockheader(bhbuf).toBuffer().toString('hex').should.equal(bhhex);
  });

  describe('#set', function() {

    it('should set all the variables', function() {
      bh.set({
        version: version,
        prevblockidbuf: prevblockidbuf,
        merklerootbuf: merklerootbuf,
        time: time,
        bits: bits,
        nonce: nonce
      });
      should.exist(bh.version);
      should.exist(bh.prevblockidbuf);
      should.exist(bh.merklerootbuf);
      should.exist(bh.time);
      should.exist(bh.bits);
      should.exist(bh.nonce);
    });

  });

  describe('#fromJSON', function() {

    it('should set all the variables', function() {
      var bh = Blockheader().fromJSON({
        version: version,
        prevblockidbuf: prevblockidbuf.toString('hex'),
        merklerootbuf: merklerootbuf.toString('hex'),
        time: time,
        bits: bits,
        nonce: nonce
      });
      should.exist(bh.version);
      should.exist(bh.prevblockidbuf);
      should.exist(bh.merklerootbuf);
      should.exist(bh.time);
      should.exist(bh.bits);
      should.exist(bh.nonce);
    });

  });

  describe('#toJSON', function() {

    it('should set all the variables', function() {
      var json = bh.toJSON();
      should.exist(json.version);
      should.exist(json.prevblockidbuf);
      should.exist(json.merklerootbuf);
      should.exist(json.time);
      should.exist(json.bits);
      should.exist(json.nonce);
    });

  });

  describe('#fromBuffer', function() {

    it('should parse this known buffer', function() {
      Blockheader().fromBuffer(bhbuf).toBuffer().toString('hex').should.equal(bhhex);
    });

  });

  describe('#fromBufferReader', function() {

    it('should parse this known buffer', function() {
      Blockheader().fromBufferReader(BufferReader(bhbuf)).toBuffer().toString('hex').should.equal(bhhex);
    });

  });

  describe('#toBuffer', function() {

    it('should output this known buffer', function() {
      Blockheader().fromBuffer(bhbuf).toBuffer().toString('hex').should.equal(bhhex);
    });

  });

  describe('#toBufferWriter', function() {

    it('should output this known buffer', function() {
      Blockheader().fromBuffer(bhbuf).toBufferWriter().concat().toString('hex').should.equal(bhhex);
    });

  });

});
