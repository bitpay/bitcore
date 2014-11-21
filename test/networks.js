'use strict';

var should = require('chai').should();
var bitcore = require('..');
var Networks = bitcore.Networks;

describe('Networks', function() {

  it('should contain all Networks', function() {
    should.exist(Networks.livenet);
    should.exist(Networks.testnet);
    should.exist(Networks.mainnet);
  });
  describe('contain all constants for livenet and testnet', function() {
    for (var key in Networks.livenet) {
      if (Networks.livenet.hasOwnProperty(key)) {
        it('all should contain '+key, function() {
          Networks.testnet.hasOwnProperty(key).should.equal(true);
        });
      }
    }
  });

});
