'use strict';

var _ = require('lodash');
var chai = chai || require('chai');
var sinon = sinon || require('sinon');
var should = chai.should();

var Constants = require('../lib/common/constants');
var Credentials = require('../lib/credentials');
var TestData = require('./testdata');

describe('Credentials', function() {



  describe('#fromMnemonic', function() {
    it('Should create credentials from mnemonic BIP44', function() {
      var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      var c = Credentials.fromMnemonic('btc', 'livenet', words, '', 0, 'BIP44');
      c.xPrivKey.should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
      c.network.should.equal('livenet');
      c.account.should.equal(0);
      c.derivationStrategy.should.equal('BIP44');
      c.xPubKey.should.equal('xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj');
      c.getBaseAddressDerivationPath().should.equal("m/44'/0'/0'");
    });

    it('Should create credentials from mnemonic BIP44 BCH', function() {
      var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      var c = Credentials.fromMnemonic('bch', 'livenet', words, '', 0, 'BIP44');
      c.xPrivKey.should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
      c.network.should.equal('livenet');
      c.account.should.equal(0);
      c.derivationStrategy.should.equal('BIP44');
      c.getBaseAddressDerivationPath().should.equal("m/44'/145'/0'");
      c.xPubKey.should.equal('xpub6ByHsPNSQXTWZ7PLESMY2FufyYWtLXagSUpMQq7Un96SiThZH2iJB1X7pwviH1WtKVeDP6K8d6xxFzzoaFzF3s8BKCZx8oEDdDkNnp4owAZ');
    });

    it('Should create credentials from mnemonic BIP44 BCH, coin =0 ', function() {
      var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      var c = Credentials.fromMnemonic('bch', 'livenet', words, '', 0, 'BIP44', 
        { useLegacyCoinType: true}
      );
      c.xPrivKey.should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
      c.network.should.equal('livenet');
      c.account.should.equal(0);
      c.derivationStrategy.should.equal('BIP44');
      c.xPubKey.should.equal('xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj');
      c.getBaseAddressDerivationPath().should.equal("m/44'/0'/0'");
    });



    it('Should create credentials from mnemonic BIP48', function() {
      var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      var c = Credentials.fromMnemonic('btc', 'livenet', words, '', 0, 'BIP48');
      c.xPrivKey.should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
      c.network.should.equal('livenet');
      c.account.should.equal(0);
      c.derivationStrategy.should.equal('BIP48');
      c.xPubKey.should.equal('xpub6CKZtUaK1YHpQbg6CLaGRmsMKLQB1iKzsvmxtyHD6X7gzLqCB2VNZYd1XCxrccQnE8hhDxtYbR1Sakkvisy2J4CcTxWeeGjmkasCoNS9vZm');
      c.getBaseAddressDerivationPath().should.equal("m/48'/0'/0'");
    });

    it('Should create credentials from mnemonic account 1', function() {
      var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      var c = Credentials.fromMnemonic('btc', 'livenet', words, '', 1, 'BIP44');
      c.xPrivKey.should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
      c.account.should.equal(1);
      c.xPubKey.should.equal('xpub6BosfCnifzxcJJ1wYuntGJfF2zPJkDeG9ELNHcKNjezuea4tumswN9sH1psMdSVqCMoJC21Bv8usSeqSP4Sp1tLzW7aY59fGn9GCYzx5UTo');
      c.getBaseAddressDerivationPath().should.equal("m/44'/0'/1'");
    });

    it('Should create credentials from mnemonic with undefined/null passphrase', function() {
      var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      var c = Credentials.fromMnemonic('btc', 'livenet', words, undefined, 0, 'BIP44');
      c.xPrivKey.should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
      c = Credentials.fromMnemonic('btc', 'livenet', words, null, 0, 'BIP44');
      c.xPrivKey.should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
    });

    it('Should create credentials from mnemonic and passphrase', function() {
      var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      var c = Credentials.fromMnemonic('btc', 'livenet', words, 'húngaro', 0, 'BIP44');
      c.xPrivKey.should.equal('xprv9s21ZrQH143K2LkGEPHqW8w5vMJ3giizin94rFpSM5Ys5KhDaP7Hde3rEuzC7VpZDtNX643bJdvhHnkbhKMNmLx3Yi6H8WEsHBBox3qbpqq');
    });

    it('Should create credentials from mnemonic and passphrase for testnet account 2', function() {
      var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      var c = Credentials.fromMnemonic('btc', 'testnet', words, 'húngaro', 2, 'BIP44');
      c.xPrivKey.should.equal('tprv8ZgxMBicQKsPd9yntx9LfnZ5EUiFvEm14L4BigEtq43LrvSJZkT39PRJA69r7sCsbKuJ69fMTzWVkeJLpXhKaQDe5MJanrxvCGwEPnNxN85');
      c.network.should.equal('testnet');
      c.xPubKey.should.equal('tpubDCoAP4Ut9MXK5CakPFPudKAP4yCw6Xr7uzV2129v2LTa3eBoPoUGMqi2y3kmh83oRGX93m7EehB6LWan5GTSVD8yUnV5Jc7Kjzfa3Zsf8nE');
      c.getBaseAddressDerivationPath().should.equal("m/44'/1'/2'");
    });

    it('Should create credentials from mnemonic (ES)', function() {
      var words = 'afirmar diseño hielo fideo etapa ogro cambio fideo toalla pomelo número buscar';
      var c = Credentials.fromMnemonic('btc', 'livenet', words, '', 0, 'BIP44');
      c.xPrivKey.should.equal('xprv9s21ZrQH143K3H3WtXCn9nHtpi7Fz1ZE9VJErWErhrGL4hV1cApFVo3t4aANoPF7ufcLLWqN168izu3xGQdLaGxXG2qYZF8wWQGNWnuSSon');
      c.network.should.equal('livenet');
    });

    describe('Compliant derivation', function() {
      it('Should create compliant base address derivation key from mnemonic', function() {
        var words = "shoulder sphere pull seven top much black copy labor dress depth unit";
        var c = Credentials.fromMnemonic('btc', 'livenet', words, '', 0, 'BIP44');
        c.xPrivKey.should.equal('xprv9s21ZrQH143K3WoNK8dVjQJpcXhqfwyuBTpuZdc1ZVa9yWW2i7TmM4TLyfPrSKXctQuLgbg3U1WJmodK9yWM26JWeuh2vhT6bmsPPie688n');
        c.xPubKey.should.equal('xpub6DVMaW3r1CcZcsUazSHspjRfZZJzZG3N7GRL4DciY54Z8M4KmRSDrq2hd75VzxKZDXPu4EKiAwCGwiXMxec2pq6oVgtZYxQHSrgtxksWehx');
      });

      it('Should create compliant request key from mnemonic', function() {
        var words = "pool stomach bridge series powder mammal betray slogan pass roast neglect reunion";
        var c = Credentials.fromMnemonic('btc', 'livenet', words, '', 0, 'BIP44');
        c.xPrivKey.should.equal('xprv9s21ZrQH143K3ZMudFRXpEwftifDuJkjLKnCtk26pXhxQuK8bCnytJuUTGkfvaibnCxPQQ9xToUtDAZkJqjm3W62GBXXr7JwhiAz1XWgTUJ');
        c.requestPrivKey.should.equal('7582efa9b71aefa831823592d753704cba9648b810b14b77ee078dfe8b730157');
      });
      it('should accept non-compliant derivation as a parameter when importing', function() {
        var c = Credentials.fromMnemonic('btc', 'testnet', 'level unusual burger hole call main basic flee drama diary argue legal', '', 0, 'BIP44', {
          nonCompliantDerivation: true
        });
        c.xPrivKey.should.equal('tprv8ZgxMBicQKsPd8U9aBBJ5J2v8XMwKwZvf8qcu2gLK5FRrsrPeSgkEcNHqKx4zwv6cP536m68q2UD7wVM24zdSCpaJRmpowaeJTeVMXL5v5k');
        c.compliantDerivation.should.be.false;
        c.xPubKey.should.equal('tpubDD919WKKqmh2CqKnSsfUAJWB9bnLbcry6r61tBuY8YEaTBBpvXSpwdXXBGAB1n4JRFDC7ebo7if3psUAMpvQJUBe3LcjuMNA6Y4nP8U9SNg');
        c.getDerivedXPrivKey().toString().should.equal("tprv8gSy16H5hQ1MKNHzZDzsktr4aaGQSHg4XYVEbfsEiGSBcgw4J8dEm8uf19FH4L9h6W47VBKtc3bbYyjb6HAm6QdyRLpB6fsA7bW19RZnby2");
      });
    });
  });

  describe('#createWithMnemonic', function() {
    it('Should create credentials with mnemonic', function() {
      var c = Credentials.createWithMnemonic('btc', 'livenet', '', 'en', 0);
      should.exist(c.mnemonic);
      c.mnemonic.split(' ').length.should.equal(12);
      c.network.should.equal('livenet');
      c.account.should.equal(0);
    });

    it('should assume derivation compliance on new credentials', function() {
      var c = Credentials.createWithMnemonic('btc', 'livenet', '', 'en', 0);
      c.compliantDerivation.should.be.true;
      var xPrivKey = c.getDerivedXPrivKey();
      should.exist(xPrivKey);
    });

    it('Should create credentials with mnemonic (testnet)', function() {
      var c = Credentials.createWithMnemonic('btc', 'testnet', '', 'en', 0);
      should.exist(c.mnemonic);
      c.mnemonic.split(' ').length.should.equal(12);
      c.network.should.equal('testnet');
    });

    it('Should return and clear mnemonic', function() {
      var c = Credentials.createWithMnemonic('btc', 'testnet', '', 'en', 0);
      should.exist(c.mnemonic);
      c.getMnemonic().split(' ').length.should.equal(12);
      c.clearMnemonic();
      should.not.exist(c.getMnemonic());
    });
  });

  describe('#createWithMnemonic #fromMnemonic roundtrip', function() {
    _.each(['en', 'es', 'ja', 'zh', 'fr'], function(lang) {
      it('Should verify roundtrip create/from with ' + lang + '/passphrase', function() {
        var c = Credentials.createWithMnemonic('btc', 'testnet', 'holamundo', lang, 0);
        should.exist(c.mnemonic);
        var words = c.mnemonic;
        var xPriv = c.xPrivKey;
        var path = c.getBaseAddressDerivationPath();

        var c2 = Credentials.fromMnemonic('btc', 'testnet', words, 'holamundo', 0, 'BIP44');
        should.exist(c2.mnemonic);
        words.should.be.equal(c2.mnemonic);
        c2.xPrivKey.should.equal(c.xPrivKey);
        c2.network.should.equal(c.network);
        c2.getBaseAddressDerivationPath().should.equal(path);
      });
    });

    it('Should fail roundtrip create/from with ES/passphrase with wrong passphrase', function() {
      var c = Credentials.createWithMnemonic('btc', 'testnet', 'holamundo', 'es', 0);
      should.exist(c.mnemonic);
      var words = c.mnemonic;
      var xPriv = c.xPrivKey;
      var path = c.getBaseAddressDerivationPath();

      var c2 = Credentials.fromMnemonic('btc', 'testnet', words, 'chaumundo', 0, 'BIP44');
      c2.network.should.equal(c.network);
      c2.getBaseAddressDerivationPath().should.equal(path);
      c2.xPrivKey.should.not.equal(c.xPrivKey);
    });
  });
});
