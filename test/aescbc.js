var should = require('chai').should();
var AESCBC = require('../lib/expmt/aescbc');

describe('AESCBC', function() {

  describe('@encrypt', function() {

    it('should return encrypt one block', function() {
      var password = "password";
      var messagebuf = new Buffer(128 / 8 - 1);
      messagebuf.fill(0);
      var encbuf = AESCBC.encrypt(messagebuf, password);
      encbuf.length.should.equal(128 / 8 + 128 / 8);
    });

  });

  describe('@decrypt', function() {

    it('should decrypt that which was encrypted', function() {
      var password = "password";
      var messagebuf = new Buffer(128 / 8 - 1);
      messagebuf.fill(0);
      var encbuf = AESCBC.encrypt(messagebuf, password);
      var messagebuf2 = AESCBC.decrypt(encbuf, password);
      messagebuf2.toString('hex').should.equal(messagebuf.toString('hex'));
    });

  });

  describe('@encryptCipherkey', function() {

    it('should return encrypt one block', function() {
      var cipherkeybuf = new Buffer(256 / 8);
      cipherkeybuf.fill(0x10);
      var ivbuf = new Buffer(128 / 8);
      ivbuf.fill(0);
      var messagebuf = new Buffer(128 / 8 - 1);
      messagebuf.fill(0);
      var encbuf = AESCBC.encryptCipherkey(messagebuf, cipherkeybuf, ivbuf);
      encbuf.length.should.equal(128 / 8 + 128 / 8);
    });

    it('should return encrypt two blocks', function() {
      var cipherkeybuf = new Buffer(256 / 8);
      cipherkeybuf.fill(0x10);
      var ivbuf = new Buffer(128 / 8);
      ivbuf.fill(0);
      var messagebuf = new Buffer(128 / 8);
      messagebuf.fill(0);
      var encbuf = AESCBC.encryptCipherkey(messagebuf, cipherkeybuf, ivbuf);
      encbuf.length.should.equal(128 / 8 + 128 / 8 + 128 / 8);
    });

  });

  describe('@decryptCipherkey', function() {
    
    it('should decrypt that which was encrypted', function() {
      var cipherkeybuf = new Buffer(256 / 8);
      cipherkeybuf.fill(0x10);
      var ivbuf = new Buffer(128 / 8);
      ivbuf.fill(0);
      var messagebuf = new Buffer(128 / 8);
      messagebuf.fill(0);
      var encbuf = AESCBC.encryptCipherkey(messagebuf, cipherkeybuf, ivbuf);
      var messagebuf2 = AESCBC.decryptCipherkey(encbuf, cipherkeybuf);
      messagebuf2.toString('hex').should.equal(messagebuf.toString('hex'));
    });

  });

});
