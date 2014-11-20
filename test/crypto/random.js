var should = require('chai').should();
var Random = require('../lib/random');

describe('Random', function() {

  describe('@getRandomBuffer', function() {

    it('should return a buffer', function() {
      var bytes = Random.getRandomBuffer(8);
      bytes.length.should.equal(8);
      Buffer.isBuffer(bytes).should.equal(true);
    });

    it('should not equate two 256 bit random buffers', function() {
      var bytes1 = Random.getRandomBuffer(32);
      var bytes2 = Random.getRandomBuffer(32);
      bytes1.toString('hex').should.not.equal(bytes2.toString('hex'));
    });

    it('should generate 100 8 byte buffers in a row that are not equal', function() {
      var hexs = [];
      for (var i = 0; i < 100; i++)
        hexs[i] = Random.getRandomBuffer(8).toString('hex');
      for (var i = 0; i < 100; i++)
        for (var j = i + 1; j < 100; j++)
          hexs[i].should.not.equal(hexs[j]);
    });

  });

  describe('@getPseudoRandomBuffer', function() {

    it('should generate 7 random bytes', function() {
      var buf = Random.getPseudoRandomBuffer(7);
      buf.length.should.equal(7);
    });

    it('should generate 8 random bytes', function() {
      var buf = Random.getPseudoRandomBuffer(8);
      buf.length.should.equal(8);
    });

    it('should generate 9 random bytes', function() {
      var buf = Random.getPseudoRandomBuffer(9);
      buf.length.should.equal(9);
    });

    it('should generate 90 random bytes', function() {
      var buf = Random.getPseudoRandomBuffer(90);
      buf.length.should.equal(90);
    });

    it('should generate two 8 byte buffers that are not equal', function() {
      var buf1 = Random.getPseudoRandomBuffer(8);
      var buf2 = Random.getPseudoRandomBuffer(8);
      buf1.toString('hex').should.not.equal(buf2.toString('hex'));
    });

  });

});
