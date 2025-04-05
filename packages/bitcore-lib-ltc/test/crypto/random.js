'use strict';

var bitcore = require('../..');
var Random = bitcore.crypto.Random;

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
      for (var i = 0; i < 100; i++) {
        hexs[i] = Random.getRandomBuffer(8).toString('hex');
      }
      for (i = 0; i < 100; i++) {
        for (var j = i + 1; j < 100; j++) {
          hexs[i].should.not.equal(hexs[j]);
        }
      }
    });

  });

});
