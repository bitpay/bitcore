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

  describe('#fromString', function() {

    it('should parse these known scripts', function() {
      Script().fromString('OP_0 OP_PUSHDATA4 3 0x010203 OP_0').toString().should.equal('OP_0 OP_PUSHDATA4 3 0x010203 OP_0');
      Script().fromString('OP_0 OP_PUSHDATA2 3 0x010203 OP_0').toString().should.equal('OP_0 OP_PUSHDATA2 3 0x010203 OP_0');
      Script().fromString('OP_0 OP_PUSHDATA1 3 0x010203 OP_0').toString().should.equal('OP_0 OP_PUSHDATA1 3 0x010203 OP_0');
      Script().fromString('OP_0 3 0x010203 OP_0').toString().should.equal('OP_0 3 0x010203 OP_0');
    });

  });

  describe('#toString', function() {

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
      script.toString().toString('hex').should.equal('OP_0 OP_PUSHDATA4 3 0x010203 OP_0');
    });

  });

  describe('#fromJSON', function() {

    it('should parse this known script', function() {
      Script().fromJSON('OP_0 OP_PUSHDATA4 3 0x010203 OP_0').toString().should.equal('OP_0 OP_PUSHDATA4 3 0x010203 OP_0');
    });

  });

  describe('#toJSON', function() {

    it('should output this known script', function() {
      Script().fromString('OP_0 OP_PUSHDATA4 3 0x010203 OP_0').toJSON().should.equal('OP_0 OP_PUSHDATA4 3 0x010203 OP_0');
    });

  });

  describe('#isOpReturn', function() {
    
    it('should know this is a (blank) OP_RETURN script', function() {
      Script('OP_RETURN').isOpReturn().should.equal(true);
    });

    it('should know this is an OP_RETURN script', function() {
      var buf = new Buffer(40);
      buf.fill(0);
      Script('OP_RETURN 40 0x' + buf.toString('hex')).isOpReturn().should.equal(true);
    });

    it('should know this is not an OP_RETURN script', function() {
      var buf = new Buffer(40);
      buf.fill(0);
      Script('OP_CHECKMULTISIG 40 0x' + buf.toString('hex')).isOpReturn().should.equal(false);
    });

  });

  describe('#isPubkeyhashIn', function() {
    
    it('should classify this known pubkeyhashin', function() {
      Script('73 0x3046022100bb3c194a30e460d81d34be0a230179c043a656f67e3c5c8bf47eceae7c4042ee0221008bf54ca11b2985285be0fd7a212873d243e6e73f5fad57e8eb14c4f39728b8c601 65 0x04e365859b3c78a8b7c202412b949ebca58e147dba297be29eee53cd3e1d300a6419bc780cc9aec0dc94ed194e91c8f6433f1b781ee00eac0ead2aae1e8e0712c6').isPubkeyhashIn().should.equal(true);
    });

    it('should classify this known non-pubkeyhashin', function() {
      Script('73 0x3046022100bb3c194a30e460d81d34be0a230179c043a656f67e3c5c8bf47eceae7c4042ee0221008bf54ca11b2985285be0fd7a212873d243e6e73f5fad57e8eb14c4f39728b8c601 65 0x04e365859b3c78a8b7c202412b949ebca58e147dba297be29eee53cd3e1d300a6419bc780cc9aec0dc94ed194e91c8f6433f1b781ee00eac0ead2aae1e8e0712c6 OP_CHECKSIG').isPubkeyhashIn().should.equal(false);
    });

  });

  describe('#isPubkeyhashOut', function() {

    it('should classify this known pubkeyhashout as pubkeyhashout', function() {
      Script('OP_DUP OP_HASH160 20 0000000000000000000000000000000000000000 OP_EQUALVERIFY OP_CHECKSIG').isPubkeyhashOut().should.equal(true);
    });

    it('should classify this known non-pubkeyhashout as not pubkeyhashout', function() {
      Script('OP_DUP OP_HASH160 20 0000000000000000000000000000000000000000').isPubkeyhashOut().should.equal(false)
    });

  });

  describe('#isScripthashIn', function() {
    
    it('should classify this known scripthashin', function() {
      Script('20 0000000000000000000000000000000000000000').isScripthashIn().should.equal(true);
    });

    it('should classify this known non-scripthashin', function() {
      Script('20 0000000000000000000000000000000000000000 OP_CHECKSIG').isScripthashIn().should.equal(false);
    });

  });

  describe('#isScripthashOut', function() {

    it('should classify this known pubkeyhashout as pubkeyhashout', function() {
      Script('OP_HASH160 20 0x0000000000000000000000000000000000000000 OP_EQUAL').isScripthashOut().should.equal(true);
    });

    it('should classify these known non-pubkeyhashout as not pubkeyhashout', function() {
      Script('OP_HASH160 20 0x0000000000000000000000000000000000000000 OP_EQUAL OP_EQUAL').isScripthashOut().should.equal(false);
      Script('OP_HASH160 21 0x000000000000000000000000000000000000000000 OP_EQUAL').isScripthashOut().should.equal(false);
    });

  });

  describe('#writeOp', function() {

    it('should write these ops', function() {
      Script().writeOp('OP_CHECKMULTISIG').toString().should.equal('OP_CHECKMULTISIG');
      Script().writeOp(Opcode.map.OP_CHECKMULTISIG).toString().should.equal('OP_CHECKMULTISIG');
    });

  });

  describe('#writeBuffer', function() {
    
    it('should write these push data', function() {
      var buf = new Buffer(1);
      buf.fill(0);
      Script().writeBuffer(buf).toString().should.equal('1 0x00');
      buf = new Buffer(255);
      buf.fill(0);
      Script().writeBuffer(buf).toString().should.equal('OP_PUSHDATA1 255 0x' + buf.toString('hex'));
      buf = new Buffer(256);
      buf.fill(0);
      Script().writeBuffer(buf).toString().should.equal('OP_PUSHDATA2 256 0x' + buf.toString('hex'));
      buf = new Buffer(Math.pow(2, 16));
      buf.fill(0);
      Script().writeBuffer(buf).toString().should.equal('OP_PUSHDATA4 ' + Math.pow(2, 16) + ' 0x' + buf.toString('hex'));
    });

  });

  describe('#write', function() {

    it('should write both pushdata and non-pushdata chunks', function() {
      Script().write('OP_CHECKMULTISIG').toString().should.equal('OP_CHECKMULTISIG');
      Script().write(Opcode.map.OP_CHECKMULTISIG).toString().should.equal('OP_CHECKMULTISIG');
      var buf = new Buffer(1);
      buf.fill(0);
      Script().write(buf).toString().should.equal('1 0x00');
    });

  });

});
