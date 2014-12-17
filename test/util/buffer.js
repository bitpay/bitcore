'use strict';
/* jshint unused: false */

var should = require('chai').should();
var expect = require('chai').expect;

var bitcore = require('../..');
var errors = bitcore.errors;
var BufferUtil = bitcore.util.buffer;

describe('buffer utils', function() {

  describe('equals', function() {
    it('recognizes these two equal buffers', function() {
      var bufferA = new Buffer([1, 2, 3]);
      var bufferB = new Buffer('010203', 'hex');
      BufferUtil.equal(bufferA, bufferB).should.equal(true);
    });
    it('no false positive: returns false with two different buffers', function() {
      var bufferA = new Buffer([1, 2, 3]);
      var bufferB = new Buffer('010204', 'hex');
      BufferUtil.equal(bufferA, bufferB).should.equal(false);
    });
    it('coverage: quickly realizes a difference in size and returns false', function() {
      var bufferA = new Buffer([1, 2, 3]);
      var bufferB = new Buffer([]);
      BufferUtil.equal(bufferA, bufferB).should.equal(false);
    });
    it('"equals" is an an alias for "equal"', function() {
      var bufferA = new Buffer([1, 2, 3]);
      var bufferB = new Buffer([1, 2, 3]);
      BufferUtil.equal(bufferA, bufferB).should.equal(true);
      BufferUtil.equals(bufferA, bufferB).should.equal(true);
    });
  });

  describe('fill', function() {
    it('checks arguments', function() {
      expect(function() {
        BufferUtil.fill('something');
      }).to.throw(errors.InvalidArgumentType);
      expect(function() {
        BufferUtil.fill(new Buffer([0, 0, 0]), 'invalid');
      }).to.throw(errors.InvalidArgumentType);
    });
    it('works correctly for a small buffer', function() {
      var buffer = BufferUtil.fill(new Buffer(10), 6);
      for (var i = 0; i < 10; i++) {
        buffer[i].should.equal(6);
      }
    });
  });

  describe('isBuffer', function() {
    it('has no false positive', function() {
      expect(BufferUtil.isBuffer(1)).to.equal(false);
    });
    it('has no false negative', function() {
      expect(BufferUtil.isBuffer(new Buffer(0))).to.equal(true);
    });
  });

  describe('emptyBuffer', function() {
    it('creates a buffer filled with zeros', function() {
      var buffer = BufferUtil.emptyBuffer(10);
      expect(buffer.length).to.equal(10);
      for (var i = 0; i < 10; i++) {
        expect(buffer[i]).to.equal(0);
      }
    });
    it('checks arguments', function() {
      expect(function() {
        BufferUtil.emptyBuffer('invalid');
      }).to.throw(errors.InvalidArgumentType);
    });
  });

  describe('single byte buffer <=> integer', function() {
    it('integerAsSingleByteBuffer should return a buffer of length 1', function() {
      expect(BufferUtil.integerAsSingleByteBuffer(100)[0]).to.equal(100);
    });
    it('should check the type', function() {
      expect(function() {
        BufferUtil.integerAsSingleByteBuffer('invalid');
      }).to.throw(errors.InvalidArgumentType);
      expect(function() {
        BufferUtil.integerFromSingleByteBuffer('invalid');
      }).to.throw(errors.InvalidArgumentType);
    });
    it('works correctly for edge cases', function() {
      expect(BufferUtil.integerAsSingleByteBuffer(255)[0]).to.equal(255);
      expect(BufferUtil.integerAsSingleByteBuffer(-1)[0]).to.equal(255);
    });
    it('does a round trip', function() {
      expect(BufferUtil.integerAsSingleByteBuffer(
        BufferUtil.integerFromSingleByteBuffer(new Buffer([255]))
      )[0]).to.equal(255);
    });
  });

  describe('4byte buffer integer <=> integer', function() {
    it('integerAsBuffer should return a buffer of length 4', function() {
      expect(BufferUtil.integerAsBuffer(100).length).to.equal(4);
    });
    it('is little endian', function() {
      expect(BufferUtil.integerAsBuffer(100)[3]).to.equal(100);
    });
    it('should check the type', function() {
      expect(function() {
        BufferUtil.integerAsBuffer('invalid');
      }).to.throw(errors.InvalidArgumentType);
      expect(function() {
        BufferUtil.integerFromBuffer('invalid');
      }).to.throw(errors.InvalidArgumentType);
    });
    it('works correctly for edge cases', function() {
      expect(BufferUtil.integerAsBuffer(4294967295)[0]).to.equal(255);
      expect(BufferUtil.integerAsBuffer(4294967295)[3]).to.equal(255);
      expect(BufferUtil.integerAsBuffer(-1)[0]).to.equal(255);
      expect(BufferUtil.integerAsBuffer(-1)[3]).to.equal(255);
    });
    it('does a round trip', function() {
      expect(BufferUtil.integerFromBuffer(
        BufferUtil.integerAsBuffer(10000)
      )).to.equal(10000);
    });
  });

  describe('buffer to hex', function() {
    it('returns an expected value in hexa', function() {
      expect(BufferUtil.bufferToHex(new Buffer([255, 0, 128]))).to.equal('ff0080');
    });
    it('checks the argument type', function() {
      expect(function() {
        BufferUtil.bufferToHex('invalid');
      }).to.throw(errors.InvalidArgumentType);
    });
    it('round trips', function() {
      var original = new Buffer([255, 0, 128]);
      var hexa = BufferUtil.bufferToHex(original);
      var back = BufferUtil.hexToBuffer(hexa);
      expect(BufferUtil.equal(original, back)).to.equal(true);
    });
  });

  describe('reverse', function() {
    it('reverses a buffer', function() {
      // http://bit.ly/1J2Ai4x
      var original = new Buffer([255, 0, 128]);
      var reversed = BufferUtil.reverse(original);
      original[0].should.equal(reversed[2]);
      original[1].should.equal(reversed[1]);
      original[2].should.equal(reversed[0]);
    });
    it('checks the argument type', function() {
      expect(function() {
        BufferUtil.reverse('invalid');
      }).to.throw(errors.InvalidArgumentType);
    });
  });
});
