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
    WalletKey = WalletKeyModule;
    should.exist(WalletKey);
  });
  it('should be able to create instance', function() {
    var s = new WalletKey({
      network: networks.livenet
    });
    should.exist(s);
  });
  it('should be able to call generate', function() {
    var s = new WalletKey({
      network: networks.livenet
    });
    s.generate.bind(s).should.not.throw(Error);
  });
  it('should be able to call storeObj', function() {
    var s = new WalletKey({
      network: networks.livenet
    });
    s.generate();
    var o = s.storeObj();
    should.exist(o);
  });
  it('roundtrip for storeObj/fromObj', function() {
    var s = new WalletKey({
      network: networks.livenet
    });
    s.generate();
    var obj = s.storeObj();
    var s2 = new WalletKey({
      network: networks.livenet
    });
    s2.fromObj(obj);
    s.privKey.private.toString().should.equal(s2.privKey.private.toString());
    s.privKey.public.toString().should.equal(s2.privKey.public.toString());
  });
});





