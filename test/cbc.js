var AES = require('../lib/expmt/aes');
var should = require('chai').should();
var CBC = require('../lib/expmt/cbc');

describe('CBC', function() {

  it('should return a new CBC', function() {
    var cbc = new CBC();
    should.exist(cbc);
  })

  it('should return a new CBC when called without "new"', function() {
    var cbc = new CBC();
    should.exist(cbc);
  });

  describe('@buf2blockbufs', function() {

    it('should convert this buffer into one block', function() {
      var buf = new Buffer(16 - 1);
      buf.fill(0);
      var blockbufs = CBC.buf2blockbufs(buf, 16 * 8);
      blockbufs.length.should.equal(1);
      blockbufs[0].toString('hex').should.equal('00000000000000000000000000000001');
    });

    it('should convert this buffer into two blocks', function() {
      var buf = new Buffer(16);
      buf.fill(0);
      var blockbufs = CBC.buf2blockbufs(buf, 16 * 8);
      blockbufs.length.should.equal(2);
      blockbufs[0].toString('hex').should.equal('00000000000000000000000000000000');
      blockbufs[1].toString('hex').should.equal('10101010101010101010101010101010');
    });

  });
  
  describe('@buf2blockbufs', function() {

    it('should convert this buffer into one block and back into the same buffer', function() {
      var buf = new Buffer(16 - 1);
      buf.fill(0);
      var blockbufs = CBC.buf2blockbufs(buf, 16 * 8);
      var buf2 = CBC.blockbufs2buf(blockbufs, 16 * 8);
      buf2.toString('hex').should.equal(buf.toString('hex'));
    });

    it('should convert this buffer into two blocks and back into the same buffer', function() {
      var buf = new Buffer(16);
      buf.fill(0);
      var blockbufs = CBC.buf2blockbufs(buf, 16 * 8);
      var buf2 = CBC.blockbufs2buf(blockbufs, 16 * 8);
      buf2.toString('hex').should.equal(buf.toString('hex'));
    });

  });
  
  describe('@encrypt', function() {

    it('should return this known value', function() {
      var messagebuf1 = new Buffer(128 / 8);
      messagebuf1.fill(0);
      var messagebuf2 = new Buffer(128 / 8);
      messagebuf2.fill(0x10);
      var messagebuf = Buffer.concat([messagebuf1, messagebuf2]);
      var ivbuf = new Buffer(128 / 8);
      ivbuf.fill(0x10);
      var cipherkeybuf = new Buffer(128 / 8);
      cipherkeybuf.fill(0);
      var blockcipher = {};
      blockcipher.encrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      blockcipher.decrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      var encbuf = CBC.encrypt(messagebuf, ivbuf, blockcipher, cipherkeybuf);
      var buf2 = CBC.decrypt(encbuf, ivbuf, blockcipher, cipherkeybuf);
    });

    it('should return this shorter known value', function() {
      var messagebuf1 = new Buffer(128 / 8);
      messagebuf1.fill(0);
      var messagebuf2 = new Buffer(120 / 8);
      messagebuf2.fill(0x10);
      var messagebuf = Buffer.concat([messagebuf1, messagebuf2]);
      var ivbuf = new Buffer(128 / 8);
      ivbuf.fill(0x10);
      var cipherkeybuf = new Buffer(128 / 8);
      cipherkeybuf.fill(0);
      var blockcipher = {};
      blockcipher.encrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      blockcipher.decrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      var encbuf = CBC.encrypt(messagebuf, ivbuf, blockcipher, cipherkeybuf);
      var buf2 = CBC.decrypt(encbuf, ivbuf, blockcipher, cipherkeybuf);
    });

    it('should return this shorter known value', function() {
      var messagebuf1 = new Buffer(128 / 8);
      messagebuf1.fill(0);
      var messagebuf2 = new Buffer(136 / 8);
      messagebuf2.fill(0x10);
      var messagebuf = Buffer.concat([messagebuf1, messagebuf2]);
      var ivbuf = new Buffer(128 / 8);
      ivbuf.fill(0x10);
      var cipherkeybuf = new Buffer(128 / 8);
      cipherkeybuf.fill(0);
      var blockcipher = {};
      blockcipher.encrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      blockcipher.decrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      var encbuf = CBC.encrypt(messagebuf, ivbuf, blockcipher, cipherkeybuf);
      var buf2 = CBC.decrypt(encbuf, ivbuf, blockcipher, cipherkeybuf);
    });

    it('should encrypt something with AES', function() {
      var messagebuf1 = new Buffer(128 / 8);
      messagebuf1.fill(0);
      var messagebuf2 = new Buffer(128 / 8);
      messagebuf2.fill(0x10);
      var messagebuf = Buffer.concat([messagebuf1, messagebuf2]);
      var ivbuf = new Buffer(128 / 8);
      ivbuf.fill(0x10);
      var cipherkeybuf = new Buffer(128 / 8);
      cipherkeybuf.fill(0);
      var blockcipher = AES;
      var encbuf = CBC.encrypt(messagebuf, ivbuf, blockcipher, cipherkeybuf);
      var buf2 = CBC.decrypt(encbuf, ivbuf, blockcipher, cipherkeybuf);
      buf2.toString('hex').should.equal(messagebuf.toString('hex'));
    });

  });
  
  describe('@decrypt', function() {

    it('should properly decrypt an encrypted message', function() {
      var messagebuf1 = new Buffer(128 / 8);
      messagebuf1.fill(0);
      var messagebuf2 = new Buffer(128 / 8);
      messagebuf2.fill(0x10);
      var messagebuf = Buffer.concat([messagebuf1, messagebuf2]);
      var ivbuf = new Buffer(128 / 8);
      ivbuf.fill(0x10);
      var cipherkeybuf = new Buffer(128 / 8);
      cipherkeybuf.fill(0);
      var blockcipher = {};
      blockcipher.encrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      blockcipher.decrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      var encbuf = CBC.encrypt(messagebuf, ivbuf, blockcipher, cipherkeybuf);
      var messagebuf2 = CBC.decrypt(encbuf, ivbuf, blockcipher, cipherkeybuf);
      messagebuf2.toString('hex').should.equal(messagebuf.toString('hex'));
    });

  });
  
  describe('@encryptblock', function() {

    it('should return this known value', function() {
      var messagebuf = new Buffer(128 / 8);
      messagebuf.fill(0);
      var ivbuf = new Buffer(128 / 8);
      ivbuf.fill(0x10);
      var cipherkeybuf = new Buffer(128 / 8);
      cipherkeybuf.fill(0);
      var blockcipher = {};
      blockcipher.encrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      var enc = CBC.encryptblock(messagebuf, ivbuf, blockcipher, cipherkeybuf);
      enc.toString('hex').should.equal(ivbuf.toString('hex'));
    });

    it('should return this other known value', function() {
      var messagebuf = new Buffer(128 / 8);
      messagebuf.fill(0x10);
      var ivbuf = new Buffer(128 / 8);
      ivbuf.fill(0x10);
      var cipherkeybuf = new Buffer(128 / 8);
      cipherkeybuf.fill(0);
      var blockcipher = {};
      blockcipher.encrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      var enc = CBC.encryptblock(messagebuf, ivbuf, blockcipher, cipherkeybuf);
      enc.toString('hex').should.equal('00000000000000000000000000000000');
    });

  });
  
  describe('@decryptblock', function() {

    it('should decrypt an encrypted block', function() {
      var messagebuf = new Buffer(128 / 8);
      messagebuf.fill(0);
      var ivbuf = new Buffer(128 / 8);
      ivbuf.fill(0x10);
      var cipherkeybuf = new Buffer(128 / 8);
      cipherkeybuf.fill(0);
      var blockcipher = {};
      blockcipher.encrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      blockcipher.decrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      var encbuf = CBC.encryptblock(messagebuf, ivbuf, blockcipher, cipherkeybuf);
      var buf = CBC.decryptblock(encbuf, ivbuf, blockcipher, cipherkeybuf);
      buf.toString('hex').should.equal(messagebuf.toString('hex'));
    });

  });
  
  describe('@encryptblocks', function() {

    it('should return this known value', function() {
      var messagebuf1 = new Buffer(128 / 8);
      messagebuf1.fill(0);
      var messagebuf2 = new Buffer(128 / 8);
      messagebuf2.fill(0x10);
      var ivbuf = new Buffer(128 / 8);
      ivbuf.fill(0x10);
      var cipherkeybuf = new Buffer(128 / 8);
      cipherkeybuf.fill(0);
      var blockcipher = {}
      blockcipher.encrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      var encbufs = CBC.encryptblocks([messagebuf1, messagebuf2], ivbuf, blockcipher, cipherkeybuf);
      encbufs[0].toString('hex').should.equal('10101010101010101010101010101010');
      encbufs[1].toString('hex').should.equal('00000000000000000000000000000000');
    });

  });
  
  describe('@decryptblocks', function() {

    it('should decrypt encrypted blocks', function() {
      var messagebuf1 = new Buffer(128 / 8);
      messagebuf1.fill(0);
      var messagebuf2 = new Buffer(128 / 8);
      messagebuf2.fill(0x10);
      var ivbuf = new Buffer(128 / 8);
      ivbuf.fill(0x10);
      var cipherkeybuf = new Buffer(128 / 8);
      cipherkeybuf.fill(0);
      var blockcipher = {}
      blockcipher.encrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      blockcipher.decrypt = function(messagebuf, cipherkeybuf) {
        return messagebuf;
      };
      var encbufs = CBC.encryptblocks([messagebuf1, messagebuf2], ivbuf, blockcipher, cipherkeybuf);
      var bufs = CBC.decryptblocks(encbufs, ivbuf, blockcipher, cipherkeybuf);
      bufs[0].toString('hex').should.equal(messagebuf1.toString('hex'));
      bufs[1].toString('hex').should.equal(messagebuf2.toString('hex'));
    });

  });
  
  describe('@pkcs7pad', function() {
    
    it('should pad this 32 bit buffer to 128 bits with the number 128/8 - 32/8', function() {
      var buf = new Buffer(32 / 8);
      buf.fill(0);
      var padbuf = CBC.pkcs7pad(buf, 128);
      padbuf.length.should.equal(128 / 8);
      padbuf[32 / 8].should.equal(128 / 8 - 32 / 8);
      padbuf[32 / 8 + 1].should.equal(128 / 8 - 32 / 8);
      // ...
      padbuf[32 / 8 + 128 / 8 - 32 / 8 - 1].should.equal(128 / 8 - 32 / 8);
    });

  });

  describe('@pkcs7unpad', function() {
    
    it('should unpad this padded 32 bit buffer', function() {
      var buf = new Buffer(32 / 8);
      buf.fill(0);
      var paddedbuf = CBC.pkcs7pad(buf, 128);
      var unpaddedbuf = CBC.pkcs7unpad(paddedbuf, 128);
      unpaddedbuf.toString('hex').should.equal(buf.toString('hex'));
    });

  });

  describe('@xorbufs', function() {
    
    it('should xor 1 and 0', function() {
      var buf1 = new Buffer([1]);
      var buf2 = new Buffer([0]);
      var buf = CBC.xorbufs(buf1, buf2);
      buf[0].should.equal(1);
    });

    it('should xor 1 and 1', function() {
      var buf1 = new Buffer([1]);
      var buf2 = new Buffer([1]);
      var buf = CBC.xorbufs(buf1, buf2);
      buf[0].should.equal(0);
    });

  });

});
