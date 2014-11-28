'use strict';

/* jshint unused: false */
var _ = require('lodash');
var assert = require('assert');
var should = require('chai').should();
var expect = require('chai').expect;
var bitcore = require('..');
var buffer = require('buffer');
var util = bitcore.util;
var HDPrivateKey = bitcore.HDPrivateKey;
var HDPublicKey = bitcore.HDPublicKey;
var Base58Check = bitcore.encoding.Base58Check;

var xprivkey = 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi';
var xpubkey = 'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8';
var json = '{"network":"livenet","depth":0,"fingerPrint":876747070,"parentFingerPrint":0,"childIndex":0,"chainCode":"873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508","publicKey":"0339a36013301597daef41fbe593a02cc513d0b55527ec2df1050e2e8ff49c85c2","checksum":-1421395167,"xpubkey":"xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8"}';
var derived_0_1_200000 = 'xpub6BqyndF6rkBNTV6LXwiY8Pco8aqctqq7tGEUdA8fmGDTnDJphn2fmxr3eM8Lm3m8TrNUsLbEjHvpa3adBU18YpEx4tp2Zp6nqax3mQkudhX';

describe('HDPublicKey interface', function() {

  var expectFail = function(argument, error) {
    return function() {
      expect(function() {
        return new HDPublicKey(argument);
      }).to.throw(error);
    };
  };
  describe('creation formats', function() {

    it('returns same argument if already an instance of HDPublicKey', function() {
      var publicKey = new HDPublicKey(xpubkey);
      publicKey.should.equal(new HDPublicKey(publicKey));
    });

    it('returns the correct xpubkey for a xprivkey', function() {
      var publicKey = new HDPublicKey(xprivkey);
      publicKey.xpubkey.should.equal(xpubkey);
    });

    it('allows to call the argument with no "new" keyword', function() {
      HDPublicKey(xpubkey).xpubkey.should.equal(new HDPublicKey(xpubkey).xpubkey);
    });

    it('fails when user doesn\'t supply an argument', function() {
      expect(function() { return new HDPublicKey(); }).to.throw(HDPublicKey.Errors.MustSupplyArgument);
    });

    it('doesn\'t recognize an invalid argument', function() {
      var expectCreationFail = function(argument) {
        expect(function() { return new HDPublicKey(argument); }).to.throw(HDPublicKey.Errors.UnrecognizedArgument);
      };
      expectCreationFail(1);
      expectCreationFail(true);
    });


    describe('xpubkey string serialization errors', function() {
      it('fails on invalid length', expectFail(
        Base58Check.encode(new buffer.Buffer([1, 2, 3])),
        HDPublicKey.Errors.InvalidLength
      ));
      it('fails on invalid base58 encoding', expectFail(
        xpubkey + '1',
        HDPublicKey.Errors.InvalidB58Checksum
      ));
    });

    it('can be generated from a json', function() {
      expect(new HDPublicKey(json).xpubkey).to.equal(xpubkey);
    });

    it('can generate a json that has a particular structure', function() {
      assert(util.shallowEquals(
        JSON.parse(new HDPublicKey(json).toJson()),
        JSON.parse(new HDPublicKey(xpubkey).toJson())
      ));
    });

    it('builds from a buffer object', function() {
      (new HDPublicKey(new HDPublicKey(xpubkey)._buffers)).xpubkey.should.equal(xpubkey);
    });

    it('checks the checksum', function() {
      var buffers = new HDPublicKey(xpubkey)._buffers;
      buffers.checksum = util.integerAsBuffer(1);
      expectFail(buffers, HDPublicKey.Errors.InvalidB58Checksum)();
    });

  });

  describe('error checking on serialization', function() {
    it('throws invalid argument when argument is not a string or buffer', function() {
      HDPublicKey.getSerializedError(1).should.equal(HDPublicKey.Errors.InvalidArgument);
    });
    it('if a network is provided, validates that data corresponds to it', function() {
      HDPublicKey.getSerializedError(xpubkey, 'testnet').should.equal(HDPublicKey.Errors.InvalidNetwork);
    });
    it('recognizes invalid network arguments', function() {
      HDPublicKey.getSerializedError(xpubkey, 'invalid').should.equal(HDPublicKey.Errors.InvalidNetworkArgument);
    });
    it('recognizes a valid network', function() {
      expect(HDPublicKey.getSerializedError(xpubkey, 'livenet')).to.equal(null);
    });
  });

  it('toString() returns the same value as .xpubkey', function() {
    var pubKey = new HDPublicKey(xpubkey);
    pubKey.toString().should.equal(pubKey.xpubkey);
  });

  describe('derivation', function() {
    it('derivation is the same whether deriving with number or string', function() {
      var pubkey = new HDPublicKey(xpubkey);
      var derived1 = pubkey.derive(0).derive(1).derive(200000);
      var derived2 = pubkey.derive('m/0/1/200000');
      derived1.xpubkey.should.equal(derived_0_1_200000);
      derived2.xpubkey.should.equal(derived_0_1_200000);
    });

    it('allows special parameters m, M', function() {
      var expectDerivationSuccess = function(argument) {
        new HDPublicKey(xpubkey).derive(argument).xpubkey.should.equal(xpubkey);
      };
      expectDerivationSuccess('m');
      expectDerivationSuccess('M');
    });

    it('doesn\'t allow object arguments for derivation', function() {
      expect(function() {
        return new HDPublicKey(xpubkey).derive({});
      }).to.throw(HDPublicKey.Errors.InvalidDerivationArgument);
    });

    it('doesn\'t allow other parameters like m\' or M\' or "s"', function() {
      var expectDerivationFail = function(argument) {
        expect(function() {
          return new HDPublicKey(xpubkey).derive(argument);
        }).to.throw(HDPublicKey.Errors.InvalidPath);
      };
      /* jshint quotmark: double */
      expectDerivationFail("m'");
      expectDerivationFail("M'");
      expectDerivationFail("1");
      expectDerivationFail("S");
    });

    it('can\'t derive hardened keys', function() {
      expect(function() { return new HDPublicKey(xpubkey).derive(HDPublicKey.Hardened + 1); })
        .to.throw(HDPublicKey.Errors.InvalidIndexCantDeriveHardened);
    });

    it('should use the cache', function() {
      var pubkey = new HDPublicKey(xpubkey);
      var derived1 = pubkey.derive(0);
      var derived2 = pubkey.derive(0);
      derived1.xpubkey.should.equal(derived2.xpubkey);
    });
  });
});
