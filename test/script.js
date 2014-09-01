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
      script.chunks[0].toString('hex').should.equal('010203');
    });

    it('should parse this buffer containing OP_PUSHDATA1 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA1').toNumber();
      buf.writeUInt8(3, 1);
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].toString('hex').should.equal('010203');
    });

    it('should parse this buffer containing OP_PUSHDATA2 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA2').toNumber();
      buf.writeUInt16LE(3, 1);
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].toString('hex').should.equal('010203');
    });

    it('should parse this buffer containing OP_PUSHDATA4 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 0, 0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA4').toNumber();
      buf.writeUInt16LE(3, 1);
      var script = Script().fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].toString('hex').should.equal('010203');
    });

  });

});
