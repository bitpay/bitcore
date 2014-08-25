var should = require('chai').should();
var CBC = require('../lib/expmt/cbc');

describe('CBC', function() {
  
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

});
