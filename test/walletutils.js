'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var WalletUtils = require('../lib/walletutils');

var aText = 'hola';
var aPubKey = '03bec86ad4a8a91fe7c11ec06af27246ec55094db3d86098b7d8b2f12afe47627f';
var aPrivKey = '09458c090a69a38368975fb68115df2f4b0ab7d1bc463fc60c67aa1730641d6c';
var aSignature = '3045022100d6186930e4cd9984e3168e15535e2297988555838ad10126d6c20d4ac0e74eb502201095a6319ea0a0de1f1e5fb50f7bf10b8069de10e0083e23dbbf8de9b8e02785';

var otherPubKey = '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16';

describe('WalletUtils', function() {

  describe('#hashMessage', function() {
    it('Should create a hash', function() {
      var res = WalletUtils.hashMessage(aText);
      res.toString('hex').should.equal('4102b8a140ec642feaa1c645345f714bc7132d4fd2f7f6202db8db305a96172f');
    });
  });

  describe('#signMessage', function() {
    it('Should sign a message', function() {
      var sig = WalletUtils.signMessage(aText, aPrivKey);
      should.exist(sig);
      sig.should.equal(aSignature);
    });
    it('Should fail to sign with wrong args', function() {
      (function() {
        WalletUtils.signMessage(aText, aPubKey);
      }).should.throw('Number');
    });
  });

  describe('#verifyMessage', function() {
    it('Should fail to verify a malformed signature', function() {
      var res = WalletUtils.verifyMessage(aText, 'badsignature', otherPubKey);
      should.exist(res);
      res.should.equal(false);
    });
    it('Should fail to verify a null signature', function() {
      var res = WalletUtils.verifyMessage(aText, null, otherPubKey);
      should.exist(res);
      res.should.equal(false);
    });
    it('Should fail to verify with wrong pubkey', function() {
      var res = WalletUtils.verifyMessage(aText, aSignature, otherPubKey);
      should.exist(res);
      res.should.equal(false);
    });
    it('Should verify', function() {
      var res = WalletUtils.verifyMessage(aText, aSignature, aPubKey);
      should.exist(res);
      res.should.equal(true);
    });
  });

  describe('#signMessage #verifyMessage round trip', function() {
    it('Should sign and verify', function() {
      var aLongerText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
      var sig = WalletUtils.signMessage(aLongerText, aPrivKey);
      WalletUtils.verifyMessage(aLongerText, sig, aPubKey).should.equal(true);
    });
  });

  describe('#encryptMessage #decryptMessage round trip', function() {
    it('should encrypt and decrypt', function() {
      var pwd = '0dea92f1df6675085b5cdd965487bb862f84f2755bcb56fa45dbf5b387a6c4a0';
      var ct = WalletUtils.encryptMessage('hello world', pwd);
      var msg = WalletUtils.decryptMessage(ct, pwd);
      msg.should.equal('hello world');
    });
  });

  describe('#parseAmount', function() {
    it('should successfully parse amounts', function() {
      var texts = {
        '1': 1,
        '0': 0,
        '000000.0000': 0,
        '123': 123,
        '123sat': 123,
        '123 sat': 123,
        '00123 sat': 123,
        '1.23bit': 123,
        '1.23 bit': 123,
        '0 bit': 0,
        '.45bit': 45,
        '1btc': 100000000,
        '  1btc': 100000000,
        '9999btc': 999900000000,
        '0.00000001btc': 1,
        '00000.00000001BTC': 1,
        '0.00000001 BTC': 1,
        '0.123btc': 12300000,
        '0.123   bTc': 12300000,
      };
      _.each(texts, function(satoshi, text) {
        var amount = WalletUtils.parseAmount(text);
        amount.should.equal(satoshi);
      });
    });
    it('should fail to parse incorrect amounts', function() {
      var texts = [
        '',
        '  ',
        'btc',
        '1satoshi',
        'no-number',
        '-3',
        '1 b t c',
        'btc1',
        '1,234',
        '0.000000001btc',
      ];
      _.each(texts, function(text) {
        var valid = true;
        try {
          var amount = WalletUtils.parseAmount(text);
        } catch (e) {
          valid = false;
        }
        valid.should.be.false;
      });
    });
  });

});
