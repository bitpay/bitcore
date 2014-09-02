var Script = require('../lib/script');
var should = require('chai').should();
var Opcode = require('../lib/opcode');
var BufferReader = require('../lib/bufferreader');
var BufferWriter = require('../lib/bufferwriter');

describe('Script', function() {
  
  it('should make a new script', function() {
    var script = new Script();
  });

  describe('#fromBuffer', function() {
    
    it('should parse this buffer containing an OP code', function() {
      var buf = new Buffer(1);
      buf[0] = Opcode('OP_0').toNumber();
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].should.equal(buf[0]);
    });

    it('should parse this buffer containing another OP code', function() {
      var buf = new Buffer(1);
      buf[0] = Opcode('OP_CHECKMULTISIG').toNumber();
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].should.equal(buf[0]);
    });

    it('should parse this buffer containing three bytes of data', function() {
      var buf = new Buffer([3, 1, 2, 3]);
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
    });

    it('should parse this buffer containing OP_PUSHDATA1 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA1').toNumber();
      buf.writeUInt8(3, 1);
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
    });

    it('should parse this buffer containing OP_PUSHDATA2 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA2').toNumber();
      buf.writeUInt16LE(3, 1);
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
    });

    it('should parse this buffer containing OP_PUSHDATA4 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 0, 0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA4').toNumber();
      buf.writeUInt16LE(3, 1);
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
    });

    it('should parse this buffer an OP code, data, and another OP code', function() {
      var buf = new Buffer([0, 0, 0, 0, 0, 0, 1, 2, 3, 0]);
      buf[0] = Opcode('OP_0').toNumber();
      buf[1] = Opcode('OP_PUSHDATA4').toNumber();
      buf.writeUInt16LE(3, 2);
      buf[buf.length - 1] = Opcode('OP_0').toNumber();
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(3);
      script.chunks[0].should.equal(buf[0]);
      script.chunks[1].buf.toString('hex').should.equal('010203');
      script.chunks[2].should.equal(buf[buf.length - 1]);
    });

  });

  describe('#toBuffer', function() {
    
    it('should output this buffer containing an OP code', function() {
      var buf = new Buffer(1);
      buf[0] = Opcode('OP_0').toNumber();
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].should.equal(buf[0]);
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should output this buffer containing another OP code', function() {
      var buf = new Buffer(1);
      buf[0] = Opcode('OP_CHECKMULTISIG').toNumber();
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].should.equal(buf[0]);
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should output this buffer containing three bytes of data', function() {
      var buf = new Buffer([3, 1, 2, 3]);
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should output this buffer containing OP_PUSHDATA1 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA1').toNumber();
      buf.writeUInt8(3, 1);
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should output this buffer containing OP_PUSHDATA2 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA2').toNumber();
      buf.writeUInt16LE(3, 1);
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should output this buffer containing OP_PUSHDATA4 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 0, 0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA4').toNumber();
      buf.writeUInt16LE(3, 1);
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should output this buffer an OP code, data, and another OP code', function() {
      var buf = new Buffer([0, 0, 0, 0, 0, 0, 1, 2, 3, 0]);
      buf[0] = Opcode('OP_0').toNumber();
      buf[1] = Opcode('OP_PUSHDATA4').toNumber();
      buf.writeUInt16LE(3, 2);
      buf[buf.length - 1] = Opcode('OP_0').toNumber();
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(3);
      script.chunks[0].should.equal(buf[0]);
      script.chunks[1].buf.toString('hex').should.equal('010203');
      script.chunks[2].should.equal(buf[buf.length - 1]);
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

  });

});
