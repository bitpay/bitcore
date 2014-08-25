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
