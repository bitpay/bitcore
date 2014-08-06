'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

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
    var s = new WalletKey();
    should.exist(s);
  });
  it('should be able to call generate', function() {
    var s = new WalletKey();
    s.generate.bind(s).should.not.throw(Error);
  });
  it('should be able to call storeObj', function() {
    var s = new WalletKey();
    s.generate();
    var o = s.storeObj();
    should.exist(o);
  });
  it('roundtrip for storeObj/fromObj', function() {
    var s = new WalletKey();
    s.generate();
    var obj = s.storeObj();
    var s2 = new WalletKey();
    s2.fromObj(obj);
    s.privKey.private.toString().should.equal(s2.privKey.private.toString());
    s.privKey.public.toString().should.equal(s2.privKey.public.toString());
  });

  it('should import  priv key testnet / compressed', function() {
    var priv = 'cU5NxfpfecLCUWnJyoUF6dCZqCfLSAZnTBPraCPis2if8iHHbNk1';
    var s = new WalletKey({
      network: networks.testnet
    });
    s.fromObj({ priv: priv});
    s.privKey.compressed.should.equal(true);
    var o = s.storeObj();
    o.priv.should.equal(priv);
    o.pub.should.equal('03fd4788dd045c791043d739dd10d5e8b15aa6c9702f26116dde88ebbce6eb7706');
    o.addr.should.equal('mqBsTsnVF2zifoGtm7UsXRfdJUr52Jg5d4');
  });


  it('should import priv key livenet / uncompressed', function() {

    //this is a WIF priv, compress flag = false 
    var priv = '5KMpLZExnGzeU3oC9qZnKBt7yejLUS8boPiWag33TMX2XEK2Ayc';
    var s = new WalletKey();
    s.fromObj({ priv: priv});
    s.privKey.compressed.should.equal(false);
    var o = s.storeObj();
    o.priv.should.equal(priv);
    o.pub.should.equal('04470bbc100896e4df317526efa22f15aac3681ef02d230d00d15b4cba8eea1e88477523d644f20edb6b344f06bba77a9dff81be69d74282866b0b7f3e9d0d910b');
    o.addr.should.equal('1v5GwPNomikEqmMe7h6q1jRw62WKTD6Xo');
  });


  it('should import priv key livenet / compressed', function() {

    //this is a WIF priv, compress flag = true
    var priv = 'L4cEVwoNDeYdCQfFJAGkGKPnE2TmqLEuBn4znQChD2ojjQRJVKpU';
    var s = new WalletKey();
    s.fromObj({ priv: priv});
    s.privKey.compressed.should.equal(true);
    var o = s.storeObj();
    o.priv.should.equal(priv);
    o.pub.should.equal('03d95e184cce34c3cfa58e9a277a09a7c5ed1b2a8134ea1e52887bc66fa3f47071');
    o.addr.should.equal('1JEgFNDmEUdd6FvNhDBqSuw2uZ4yisSr7A');
  });



});





