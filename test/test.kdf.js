var should = require('chai').should();
var KDF = require('../lib/kdf');
var Hash = require('../lib/hash');

describe('KDF', function() {
  
  describe('#buf2key', function() {

    it('should compute these known values', function() {
      var buf = Hash.sha256(new Buffer('test'));
      var key = KDF.buf2key(buf);
      key.privkey.toString().should.equal('KxxVszVMFLGzmxpxR7sMSaWDmqMKLVhKebX5vZbGHyuR8spreQ7V');
      key.pubkey.toString().should.equal('03774f761ae89a0d2fda0d532bad62286ae8fcda9bc38c060036296085592a97c1');
    });

  });

  describe('#sha256hmac2key', function() {

    it('should compute these known values', function() {
      var buf = Hash.sha256(new Buffer('test'));
      var key = KDF.sha256hmac2key(buf);
      key.privkey.toString().should.equal('KxxVszVMFLGzmxpxR7sMSaWDmqMKLVhKebX5vZbGHyuR8spreQ7V');
      key.pubkey.toString().should.equal('03774f761ae89a0d2fda0d532bad62286ae8fcda9bc38c060036296085592a97c1');
    });

  });

  describe('#sha256hmac2privkey', function() {

    it('should compute this known privkey', function() {
      var buf = Hash.sha256(new Buffer('test'));
      var privkey = KDF.sha256hmac2privkey(buf);
      privkey.toString().should.equal('KxxVszVMFLGzmxpxR7sMSaWDmqMKLVhKebX5vZbGHyuR8spreQ7V');
    });

  });

});
