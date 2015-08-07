'use strict';

var _ = require('lodash');
var chai = chai || require('chai');
var sinon = sinon || require('sinon');
var should = chai.should();
var Credentials = require('../lib/credentials');
var TestData = require('./testdata');

describe('Credentials', function() {

  it('Should create', function() {
    var c = Credentials.create();
    should.exist(c.xPrivKey);
    should.exist(c.copayerId);
  });

  it('Should create random credentials', function() {
    var all = {};
    for (var i = 0; i < 10; i++) {
      var c = Credentials.create();
      var exist = all[c.xPrivKey];
      should.not.exist(exist);
      all[c.xPrivKey] = 1;
    }
  });


  it('Should create credentials from seed', function() {
    var xPriv = 'xprv9s21ZrQH143K2TjT3rF4m5AJcMvCetfQbVjFEx1Rped8qzcMJwbqxv21k3ftL69z7n3gqvvHthkdzbW14gxEFDYQdrRQMub3XdkJyt3GGGc';
    var c = Credentials.fromExtendedPrivateKey(xPriv);

    c.xPrivKey.should.equal('xprv9s21ZrQH143K2TjT3rF4m5AJcMvCetfQbVjFEx1Rped8qzcMJwbqxv21k3ftL69z7n3gqvvHthkdzbW14gxEFDYQdrRQMub3XdkJyt3GGGc');
    c.copayerId.should.equal('e17289a6edd957b66958e4c36d5e76508c5a23a2c03a6d3f21c32cd4717340e7');
    c.network.should.equal('livenet');
    c.personalEncryptingKey.should.equal('TkNPNltJfXqPoB1y47Kocg==');
  });

  it('Should create credentials from mnemonic', function() {
    var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    var c = Credentials.fromMnemonic(words);
    c.xPrivKey.should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
    c.network.should.equal('livenet');
  });

  it('Should create credentials from mnemonic and passphrase', function() {
    var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    var c = Credentials.fromMnemonic(words, 'húngaro');
    c.xPrivKey.should.equal('xprv9s21ZrQH143K2MSHxwg5emTKPXS5ctxi2vyf4biurUnv6ZXxukvjrygxfwYTiPwboQq21EALpRrsGQmZBVkTjvR3ZasBhyfVtHgW4T6h5QH');
    c.network.should.equal('livenet');
  });

  it('Should create credentials from mnemonic and passphrase for testnet', function() {
    var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    var c = Credentials.fromMnemonic(words, 'húngaro', 'testnet');
    c.xPrivKey.should.equal('tprv8ZgxMBicQKsPdAfpdWXapR5JherHrQziNUtmw29NLTHPtAH3u8GVNj4Qb7i7imKvArMo1Kn6ynSfjGKJJi6QYyge6E5VNLPYoPRvWBk5CAg');
    c.network.should.equal('testnet');
  });


  it('Should create credentials from mnemonic (ES)', function() {
    var words = 'afirmar diseño hielo fideo etapa ogro cambio fideo toalla pomelo número buscar';
    var c = Credentials.fromMnemonic(words);

    c.xPrivKey.should.equal('xprv9s21ZrQH143K2gfNyfJ9DWySezxYZkMZjKXNELmahFmSWXgfkkRtBKY5k3UwqHmoHDSpPBYh5mvts9ymZwq9DQre2C5yQe4SZVf14Fakdet');
    c.network.should.equal('livenet');
  });

  it('Should create credentials with mnemonic', function() {
    var c = Credentials.createWithMnemonic();
    should.exist(c.mnemonic);
    c.mnemonic.split(' ').length.should.equal(12);
    c.network.should.equal('livenet');
  });


  it('Should create credentials with mnemonic (testnet)', function() {
    var c = Credentials.createWithMnemonic('testnet');
    should.exist(c.mnemonic);
    c.mnemonic.split(' ').length.should.equal(12);
    c.network.should.equal('testnet');
  });

  it('Should return and clear mnemonic', function() {
    var c = Credentials.createWithMnemonic('testnet');
    should.exist(c.mnemonic);
    c.getMnemonic().split(' ').length.should.equal(12);
    c.clearMnemonic();
    should.not.exist(c.getMnemonic());
  });

  it('Should verify roundtrip create/from with es/passphrase', function() {
    var c = Credentials.createWithMnemonic('testnet', 'holamundo', 'es');
    should.exist(c.mnemonic);
    var words = c.mnemonic;
    var xPriv = c.xPrivKey;
  
    var c2 = Credentials.fromMnemonic(words, 'holamundo', 'testnet');
    should.not.exist(c2.mnemonic);
    c2.xPrivKey.should.equal(c.xPrivKey);
    c2.network.should.equal(c.network);
  });


  _.each(['en', 'es', 'jp', 'zh'], function(lang) {
    it('Should verify roundtrip create/from with ' + lang + '/passphrase', function() {
      var c = Credentials.createWithMnemonic('testnet', 'holamundo', 'es');
      should.exist(c.mnemonic);
      var words = c.mnemonic;
      var xPriv = c.xPrivKey;

      var c2 = Credentials.fromMnemonic(words, 'holamundo', 'testnet');
      should.not.exist(c2.mnemonic);
      c2.xPrivKey.should.equal(c.xPrivKey);
      c2.network.should.equal(c.network);
    });
  });

  it('Should fail roundtrip create/from with ES/passphrase with wrong passphrase', function() {
    var c = Credentials.createWithMnemonic('testnet', 'holamundo', 'es');
    should.exist(c.mnemonic);
    var words = c.mnemonic;
    var xPriv = c.xPrivKey;
  
    var c2 = Credentials.fromMnemonic(words, 'chaumundo', 'testnet');
    c2.network.should.equal(c.network);
    c2.xPrivKey.should.not.be.equal(c.xPrivKey);
  });
});
