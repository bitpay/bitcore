'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var util = util || bitcore.util;
var buffertools = require('buffertools');

var should = chai.should();

var Key = bitcore.Key;
describe('Key randomness tests', function() {
  var RUNS = 32;
  it.skip('should pass Frequency (Monobits) Test', function() {
    /*
    Description: The focus of the test is the proportion
    of zeroes and ones for the entire sequence. The purpose
    of this test is to determine whether that number of 
    ones and zeros in a sequence are approximately the same
    as would be expected for a truly random sequence. The
    test assesses the closeness of the fraction of ones to ½,
    that is, the number of ones and zeroes in a sequence 
    should be about the same.
    */
    var count = [0, 0];
    for (var i = 0; i < RUNS; i++) {
      var key = Key.generateSync().private;
      for (var j = 0; j < key.length; j++) {
        var b = key[j];
        for (var k = 0; k < 8; k++) {
          var bitk = (b >> k) & 1;
          count[bitk] += 1;
        }
      }
    }
    var p0 = count[0] / (count[0] + count[1]);
    (p0-0.5).should.be.below(0.01);
  });

  it.skip('should pass Test For Frequency Within A Block', function() {
    /*
    Description: The focus of the test is the proportion
    of zeroes and ones within M-bit blocks. The purpose
    of this test is to determine whether the frequency 
    of ones in an M-bit block is approximately M/2.
    Test for M=8
    */
    var ones = 0;
    var count = 0;
    for (var i = 0; i < RUNS; i++) {
      var key = Key.generateSync().private;
      for (var j = 0; j < key.length; j++) {
        var b = key[j];
        for (var k = 0; k < 8; k++) {
          var bitk = (b >> k) & 1;
          ones += bitk;
        }
        count += 8;
      }
    }
    var p1 = ones/count;
    (p1-0.5).should.be.below(0.01);
  });
  var getBitInByte = function(b, index) {
    return (b >> index) & 1;
  };
  var getBitInKey = function(key, index) {
    var bindex = parseInt(index / 8);
    return getBitInByte(key[bindex], index - bindex * 8);
  };
  var getBitInKeys = function(keys, index) {
    var kindex = parseInt(index / (keys[0].length*8));
    return getBitInKey(keys[kindex], index - (keys[0].length*8) * kindex);
  };
  it.skip('should pass Runs Test', function() {
    var keys = [];
    for (var i = 0; i < RUNS; i++) {
      keys.push(Key.generateSync().private);
    }
    var prev = -1;
    var count = 0;
    var h = {};
    var bits = RUNS * keys[0].length * 8;
    for (i = 0; i < bits; i++) {
      var b = getBitInKeys(keys, i);
      if (prev !== b) {
        h[count] = (h[count] || 0) + 1;
        count = 0;
        prev = b;
      }
      count += 1;
    }
    var ratio = 0;
    count = 0;
    for(i = 1; i < 8; i++) {
      var next = h[i+1];
      var current = h[i];
      if (typeof current === 'undefined' || current === 0) continue;
      if (typeof next === 'undefined') continue;
      var r = next / current;
      ratio += r * current;
      count += 1 * current;
    }
    var p = ratio / count;
    (p-0.5).should.be.below(0.01);

  });
  it.skip('should pass Test For The Longest Run Of Ones In A Block', function() {
  });
  it.skip('should pass Random Binary Matrix Rank Test', function() {
  });
  it.skip('should pass Discrete Fourier Transform (Spectral) Test', function() {
  });
  it.skip('should pass Non-Overlapping (Aperiodic) Template Matching Test', function() {
  });
  it.skip('should pass Overlapping (Periodic) Template Matching Test', function() {
  });
  it.skip('should pass Maurers Universal Statistical Test', function() {
  });
  it.skip('should pass Linear Complexity Test', function() {
  });
  it.skip('should pass Serial Test', function() {
  });
  it.skip('should pass Approximate Entropy Test', function() {
  });
  it.skip('should pass Cumulative Sum (Cusum) Test', function() {
  });
  it.skip('should pass Random Excursions Test', function() {
  });
  it.skip('should pass Random Excursions Variant Test', function() {
  });
});
