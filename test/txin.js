var should = require('chai').should();
var Script = require('../lib/script');
var Txin = require('../lib/txin');
var Varint = require('../lib/varint');
var BufferReader = require('../lib/bufferreader');

describe('Txin', function() {
  
  it('should make a new txin', function() {
    var txin = new Txin();
    should.exist(txin);
    txin = Txin();
    should.exist(txin);
  });

  var txidbuf = new Buffer(32);
  txidbuf.fill(0);
  var txoutnum = 0;
  var script = Script().fromString("OP_CHECKMULTISIG");
  var varint = Varint(script.toBuffer().length);
  var seqnum = 0;
  var txin = Txin().set({
    txidbuf: txidbuf,
    txoutnum: txoutnum,
    varint: varint,
    script: script,
    seqnum: seqnum
  });

  describe('#set', function() {
    
    it('should set these vars', function() {
      var txin = Txin().set({
        txidbuf: txidbuf,
        txoutnum: txoutnum,
        varint: varint,
        script: script,
        seqnum: seqnum
      });
      should.exist(txin.txidbuf);
      should.exist(txin.txoutnum);
      should.exist(txin.varint);
      should.exist(txin.script);
      should.exist(txin.seqnum);
    });

  });

  describe('#fromBuffer', function() {
    
    it('should convert this known buffer', function() {
      var hex = '00000000000000000000000000000000000000000000000000000000000000000000000001ae00000000';
      var buf = new Buffer(hex, 'hex');
      var txin = Txin().fromBuffer(buf);
      txin.varint.toNumber().should.equal(1);
      txin.script.toString().should.equal('OP_CHECKMULTISIG');
    });

  });

  describe('#fromBufferReader', function() {
    
    it('should convert this known buffer', function() {
      var hex = '00000000000000000000000000000000000000000000000000000000000000000000000001ae00000000';
      var buf = new Buffer(hex, 'hex');
      var br = BufferReader(buf);
      var txin = Txin().fromBufferReader(br);
      txin.varint.toNumber().should.equal(1);
      txin.script.toString().should.equal('OP_CHECKMULTISIG');
    });

  });

  describe('#toBuffer', function() {
    
    it('should convert this known buffer', function() {
      txin.toBuffer().toString('hex').should.equal('00000000000000000000000000000000000000000000000000000000000000000000000001ae00000000');
    });

  });

  describe('#toBufferWriter', function() {
    
    it('should convert this known buffer', function() {
      txin.toBufferWriter().concat().toString('hex').should.equal('00000000000000000000000000000000000000000000000000000000000000000000000001ae00000000');
    });

  });

});
