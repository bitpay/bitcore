var should = require('chai').should();
var Hash = require('../lib/hash');
var AES = require('../lib/expmt/aes');

describe('AES', function() {
  var m128 = Hash.sha256(new Buffer('test1')).slice(0, 128 / 8);
  
  var k128 = Hash.sha256(new Buffer('test2')).slice(0, 128 / 8);
  var k192 = Hash.sha256(new Buffer('test2')).slice(0, 192 / 8);
  var k256 = Hash.sha256(new Buffer('test2')).slice(0, 256 / 8);

  var e128 = new Buffer('3477e13884125038f4dc24e9d2cfbbc7', 'hex');
  var e192 = new Buffer('b670954c0e2da1aaa5f9063de04eb961', 'hex');
  var e256 = new Buffer('dd2ce24581183a4a7c0b1068f8bc79f0', 'hex');


  describe('@encrypt', function() {
    
    it('should encrypt with a 128 bit key', function() {
      var encbuf = AES.encrypt(m128, k128);
      encbuf.toString('hex').should.equal(e128.toString('hex'));
    });
      
    it('should encrypt with a 192 bit key', function() {
      var encbuf = AES.encrypt(m128, k192);
      encbuf.toString('hex').should.equal(e192.toString('hex'));
    });
      
    it('should encrypt with a 256 bit key', function() {
      var encbuf = AES.encrypt(m128, k256);
      encbuf.toString('hex').should.equal(e256.toString('hex'));
    });
      
  });

  describe('@decrypt', function() {
    
    it('should encrypt/decrypt with a 128 bit key', function() {
      var encbuf = AES.encrypt(m128, k128);
      var m = AES.decrypt(encbuf, k128);
      m.toString('hex').should.equal(m128.toString('hex'));
    });
      
    it('should encrypt/decrypt with a 192 bit key', function() {
      var encbuf = AES.encrypt(m128, k192);
      var m = AES.decrypt(encbuf, k192);
      m.toString('hex').should.equal(m128.toString('hex'));
    });
      
    it('should encrypt/decrypt with a 256 bit key', function() {
      var encbuf = AES.encrypt(m128, k256);
      var m = AES.decrypt(encbuf, k256);
      m.toString('hex').should.equal(m128.toString('hex'));
    });
      
  });

  describe('@buf2words', function() {
    
    it('should convert this 4 length buffer into an array', function() {
      var buf = new Buffer([0, 0, 0, 0]);
      var words = AES.buf2words(buf);
      words.length.should.equal(1);
    });

    it('should throw an error on this 5 length buffer', function() {
      var buf = new Buffer([0, 0, 0, 0, 0]);
      (function() {
        var words = AES.buf2words(buf);
      }).should.throw();
    });

  });

  describe('@words2buf', function() {
    
    it('should convert this array into a buffer', function() {
      var a = [100, 0];
      var buf = AES.words2buf(a);
      buf.length.should.equal(8);
    });

  });

});
