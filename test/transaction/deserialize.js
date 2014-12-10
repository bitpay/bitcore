'use strict';

var Transaction = require('../../lib/transaction');

var vectors_valid = require('./tx_valid.json');
var vectors_invalid = require('./tx_invalid.json');

describe('Transaction deserialization', function() {

  describe('valid transaction test case', function() {
    var index = 0;
    vectors_valid.forEach(function(vector) {
      if (vector.length > 1) {
        var hexa = vector[1];
        Transaction(hexa).serialize().should.equal(hexa);
        index++;
      }
    });
  });
  describe('invalid transaction test case', function() {
    var index = 0;
    vectors_invalid.forEach(function(vector) {
      if (vector.length > 1) {
        var hexa = vector[1];
        Transaction(hexa).serialize().should.equal(hexa);
        index++;
      }
    });
  });
});
