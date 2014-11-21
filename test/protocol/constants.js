'use strict';

var should = require('chai').should();
var bitcore = require('../../');
var constants = bitcore.Constants;

describe('Constants', function() {

  it('should contain all constants for livenet and testnet', function() {
    for (var key in constants.livenet) {
      if (constants.livenet.hasOwnProperty(key)) {
        constants.testnet.hasOwnProperty(key).should.equal(true);
      }
    }

  });

});
