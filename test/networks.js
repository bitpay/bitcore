'use strict';

var should = require('chai').should();
var bitcore = require('..');
var networks = bitcore.networks;

describe('networks', function() {

  it('should contain all networks', function() {
    should.exist(networks.livenet);
    should.exist(networks.testnet);
    should.exist(networks.mainnet);
  });
  describe('contain all constants for livenet and testnet', function() {
    for (var key in networks.livenet) {
      if (networks.livenet.hasOwnProperty(key)) {
        it('all should contain '+key, function() {
          networks.testnet.hasOwnProperty(key).should.equal(true);
        });
      }
    }
  });

});
