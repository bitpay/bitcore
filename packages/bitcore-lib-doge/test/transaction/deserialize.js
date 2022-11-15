'use strict';

var Transaction = require('../../lib/transaction');

var vectors_valid = require('../data/bitcoind/tx_valid.json');
var vectors_invalid = require('../data/bitcoind/tx_invalid.json');

describe('Transaction deserialization', function() {

  describe('valid transaction test case', function() {
    var index = 0;
    var runIdx = 0;
    var label = '';
    vectors_valid.forEach(function(vector, vIndex) {
      if (vector.length > 1) {
        if (vectors_valid[vIndex - 1].length === 1) {
          label = vectors_valid[vIndex - 1][0];
        };
        
        it('vector #' + index + ' -- ' + label, function() {
          var hexa = vector[1];
          Transaction(hexa).serialize(true).should.equal(hexa);
          runIdx++;
        });
        index++;
      }
    });
  });
  describe('invalid transaction test case', function() {
    var index = 0;
    var runIdx = 0;
    var label = '';
    vectors_invalid.forEach(function(vector, vIndex) {
      if (vector.length > 1) {
        if (vectors_invalid[vIndex - 1].length === 1) {
          label = vectors_invalid[vIndex - 1][0];
        };
        it('vector #' + index + ' -- ' + label, function() {
          var hexa = vector[1];
          Transaction(hexa).serialize(true).should.equal(hexa);
          runIdx++;
        });
        index++;
      }
    });
  });
});
