'use strict';

var _ = require('lodash');
var chai = chai || require('chai');
var sinon = sinon || require('sinon');
var should = chai.should();
var Credentials = require('../lib/credentials');
var TestData = require('./testdata');

describe('Credentials', function() {

  describe('#create', function() {
    it('Should create', function() {
      var c = Credentials.create('livenet');
      should.exist(c.xPrivKey);
      should.exist(c.copayerId);
    });

    it('Should create random credentials', function() {
      var all = {};
      for (var i = 0; i < 10; i++) {
        var c = Credentials.create('livenet');
        var exist = all[c.xPrivKey];
        should.not.exist(exist);
        all[c.xPrivKey] = 1;
      }
    });
  });

  describe('#fromExtendedPrivateKey', function() {
    it('Should create credentials from seed', function() {
      var xPriv = 'xprv9s21ZrQH143K2TjT3rF4m5AJcMvCetfQbVjFEx1Rped8qzcMJwbqxv21k3ftL69z7n3gqvvHthkdzbW14gxEFDYQdrRQMub3XdkJyt3GGGc';
      var c = Credentials.fromExtendedPrivateKey(xPriv);

      c.xPrivKey.should.equal('xprv9s21ZrQH143K2TjT3rF4m5AJcMvCetfQbVjFEx1Rped8qzcMJwbqxv21k3ftL69z7n3gqvvHthkdzbW14gxEFDYQdrRQMub3XdkJyt3GGGc');
      c.xPubKey.should.equal('xpub6DUean44k773kxbUq8QpSmAPFaNCpk5AzrxbFRAMsNCZBGD15XQVnRJCgNd8GtJVmDyDZh89NPZz1XPQeX5w6bAdLGfSTUuPDEQwBgKxfh1');
      c.copayerId.should.equal('bad66ef88ad8dec08e36d576c29b4f091d30197f04e166871e64bf969d08a958');
      c.network.should.equal('livenet');
      c.personalEncryptingKey.should.equal('M4MTmfRZaTtX6izAAxTpJg==');
    });
  });

  describe('#fromMnemonic', function() {
    it('Should create credentials from mnemonic', function() {
      var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      var c = Credentials.fromMnemonic('livenet', words, '', 0);
      c.xPrivKey.should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
      c.network.should.equal('livenet');
      c.account.should.equal(0);
      c.xPubKey.should.equal('xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj');
    });

    it('Should create credentials from mnemonic account 1', function() {
      var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      var c = Credentials.fromMnemonic('livenet', words, '', 1);
      c.xPrivKey.should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
      c.account.should.equal(1);
      c.xPubKey.should.equal('xpub6BosfCnifzxcJJ1wYuntGJfF2zPJkDeG9ELNHcKNjezuea4tumswN9sH1psMdSVqCMoJC21Bv8usSeqSP4Sp1tLzW7aY59fGn9GCYzx5UTo');
    });

    it('Should create credentials from mnemonic with undefined/null passphrase', function() {
      var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      var c = Credentials.fromMnemonic('livenet', words, undefined, 0);
      c.xPrivKey.should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
      c = Credentials.fromMnemonic('livenet', words, null, 0);
      c.xPrivKey.should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
    });

    it('Should create credentials from mnemonic and passphrase', function() {
      var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      var c = Credentials.fromMnemonic('livenet', words, 'húngaro', 0);
      c.xPrivKey.should.equal('xprv9s21ZrQH143K2LkGEPHqW8w5vMJ3giizin94rFpSM5Ys5KhDaP7Hde3rEuzC7VpZDtNX643bJdvhHnkbhKMNmLx3Yi6H8WEsHBBox3qbpqq');
    });

    it('Should create credentials from mnemonic and passphrase for testnet account 2', function() {
      var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      var c = Credentials.fromMnemonic('testnet', words, 'húngaro', 2);
      c.xPrivKey.should.equal('tprv8ZgxMBicQKsPd9yntx9LfnZ5EUiFvEm14L4BigEtq43LrvSJZkT39PRJA69r7sCsbKuJ69fMTzWVkeJLpXhKaQDe5MJanrxvCGwEPnNxN85');
      c.network.should.equal('testnet');
      c.xPubKey.should.equal('tpubDCoAP4Ut9MXK5CakPFPudKAP4yCw6Xr7uzV2129v2LTa3eBoPoUGMqi2y3kmh83oRGX93m7EehB6LWan5GTSVD8yUnV5Jc7Kjzfa3Zsf8nE');
    });

    it('Should create credentials from mnemonic (ES)', function() {
      var words = 'afirmar diseño hielo fideo etapa ogro cambio fideo toalla pomelo número buscar';
      var c = Credentials.fromMnemonic('livenet', words, '', 0);
      c.xPrivKey.should.equal('xprv9s21ZrQH143K4WLsaPQZ5kPMo2WqLPsxcNerMhd291niJmkEHqBRBXKrJpBqcftEMpJWpfXN97aXPqxYJrKjLTxbcDEwXH9mRJM9EvGqVdR');
    });
  });

  describe('#createWithMnemonic', function() {
    it('Should create credentials with mnemonic', function() {
      var c = Credentials.createWithMnemonic('livenet', '', 'en', 0);
      should.exist(c.mnemonic);
      c.mnemonic.split(' ').length.should.equal(12);
      c.network.should.equal('livenet');
      c.account.should.equal(0);
    });

    it('Should create credentials with mnemonic (testnet)', function() {
      var c = Credentials.createWithMnemonic('testnet', '', 'en', 0);
      should.exist(c.mnemonic);
      c.mnemonic.split(' ').length.should.equal(12);
      c.network.should.equal('testnet');
    });

    it('Should lock before storing', function() {
      var c = Credentials.createWithMnemonic('testnet', '', 'en', 0);
      c.setPrivateKeyEncryption('hola');
      c.unlock('hola');
      var o = c.toObj();

      var c2 = Credentials.fromObj(o);
      c2.isPrivKeyEncrypted().should.equal(true);
      should.not.exist(c2.xPrivKey);
    });

    it('Should return and clear mnemonic', function() {
      var c = Credentials.createWithMnemonic('testnet', '', 'en', 0);
      should.exist(c.mnemonic);
      c.getMnemonic().split(' ').length.should.equal(12);
      c.clearMnemonic();
      should.not.exist(c.getMnemonic());
    });
  });

  describe('#createWithMnemonic #fromMnemonic roundtrip', function() {
    _.each(['en', 'es', 'ja', 'zh', 'fr'], function(lang) {
      it('Should verify roundtrip create/from with ' + lang + '/passphrase', function() {
        var c = Credentials.createWithMnemonic('testnet', 'holamundo', lang, 0);
        should.exist(c.mnemonic);
        var words = c.mnemonic;
        var xPriv = c.xPrivKey;

        var c2 = Credentials.fromMnemonic('testnet', words, 'holamundo', 0);
        should.not.exist(c2.mnemonic);
        c2.xPrivKey.should.equal(c.xPrivKey);
        c2.network.should.equal(c.network);
      });
    });

    it('Should fail roundtrip create/from with ES/passphrase with wrong passphrase', function() {
      var c = Credentials.createWithMnemonic('testnet', 'holamundo', 'es', 0);
      should.exist(c.mnemonic);
      var words = c.mnemonic;
      var xPriv = c.xPrivKey;

      var c2 = Credentials.fromMnemonic('testnet', words, 'chaumundo', 0);
      c2.network.should.equal(c.network);
      c2.xPrivKey.should.not.be.equal(c.xPrivKey);
    });
  });
});
