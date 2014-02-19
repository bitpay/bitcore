'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

var WalletKeyModule = bitcore.WalletKey;
var networks = bitcore.networks;
var WalletKey;

describe('WalletKey', function() {
  it('should initialze the main object', function() {
    should.exist(WalletKeyModule);
  });
  it('should be able to create class', function() {
    WalletKey = WalletKeyModule.class();
    should.exist(WalletKey);
  });
  it('should be able to create instance', function() {
    var s = new WalletKey({
      network: networks.livenet
    });
    should.exist(s);
  });
});





