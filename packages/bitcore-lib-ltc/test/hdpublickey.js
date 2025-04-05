'use strict';

/* jshint unused: false */
var _ = require('lodash');
var assert = require('assert');
var should = require('chai').should();
var expect = require('chai').expect;
var bitcore = require('..');
var errors = bitcore.errors;
var hdErrors = bitcore.errors.HDPublicKey;
var BufferUtil = bitcore.util.buffer;
var HDPrivateKey = bitcore.HDPrivateKey;
var HDPublicKey = bitcore.HDPublicKey;
var Base58Check = bitcore.encoding.Base58Check;
var Networks = bitcore.Networks;

var xprivkey = 'xprv9s21ZrQH143K31tyHAnPm2G7KxguGH32b928eMrkWUPhCXDzVE1sFp51hsVwWBmn6QzHLbcq8NNpD1WH9NNHGR99CyV9rW3Xr6cj2GV4tPV';
var xpubkey = 'xpub661MyMwAqRbcFVySPCKQ8ACqszXPfjksxMwjSkGN4ovg5KZ92mL7ocPVZArbpNm6x1gqZkqdthgdLg1EefyRHU1mQrp1k5NYFmd5hkkJgAw';
var xpubkeyTestnet = 'tpubD6NzVbkrYhZ4XYPZvipwgH4KsgXUDy6YdUCkqjSHxZjWBJkMLxAeAWpsAPExUFSjPiTf6xAGK21hhwCPtTSdHrkkHLQuW8c2mP7tQHJ8zrG';
var json = '{"network":"livenet","depth":0,"fingerPrint":-1457505106,"parentFingerPrint":0,"childIndex":0,"chainCode":"602e52a0b9a7730844e81a7faf6fb0e46514388b3dc7eddefc038165b4d430ad","publicKey":"0391822fb6dc1307a952e723d3deef6aeb38da447dae0eeb5aa272ef76e7f0b572","checksum":1280922356,"xpubkey":"xpub661MyMwAqRbcFVySPCKQ8ACqszXPfjksxMwjSkGN4ovg5KZ92mL7ocPVZArbpNm6x1gqZkqdthgdLg1EefyRHU1mQrp1k5NYFmd5hkkJgAw"}';
var derived_0_1_200000 = 'xpub6DR2ndWe682c9rmUdb4kdvTvbjkMmra9m7HqCwS4254Bgn1UeGQPTVYt9jQh7mA5RyU1f82icedfmxwQLLJZaxGXPfbeAjrM2Y9CbyinXnd';

describe('HDPublicKey interface', function() {

  var expectFail = function(func, errorType) {
    (function() {
      func();
    }).should.throw(errorType);
  };

  var expectDerivationFail = function(argument, error) {
    (function() {
      var pubkey = new HDPublicKey(xpubkey);
      pubkey.deriveChild(argument);
    }).should.throw(error);
  };

  var expectFailBuilding = function(argument, error) {
    (function() {
      return new HDPublicKey(argument);
    }).should.throw(error);
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
      expectFailBuilding(null, hdErrors.MustSupplyArgument);
    });

    it('should not be able to change read-only properties', function() {
      var publicKey = new HDPublicKey(xprivkey);
      expect(function() {
        publicKey.fingerPrint = 'notafingerprint';
      }).to.throw(TypeError);
    });

    it('doesn\'t recognize an invalid argument', function() {
      expectFailBuilding(1, hdErrors.UnrecognizedArgument);
      expectFailBuilding(true, hdErrors.UnrecognizedArgument);
    });


    describe('xpubkey string serialization errors', function() {
      it('fails on invalid length', function() {
        expectFailBuilding(
          Base58Check.encode(Buffer.from([1, 2, 3])),
          hdErrors.InvalidLength
        );
      });
      it('fails on invalid base58 encoding', function() {
        expectFailBuilding(
          xpubkey + '1',
          errors.InvalidB58Checksum
        );
      });
      it('user can ask if a string is valid', function() {
        (HDPublicKey.isValidSerialized(xpubkey)).should.equal(true);
      });
    });

    it('can be generated from a json', function() {
      expect(new HDPublicKey(JSON.parse(json)).xpubkey).to.equal(xpubkey);
    });

    it('can generate a json that has a particular structure', function() {
      assert(_.isEqual(
        new HDPublicKey(JSON.parse(json)).toJSON(),
        new HDPublicKey(xpubkey).toJSON()
      ));
    });

    it('builds from a buffer object', function() {
      (new HDPublicKey(new HDPublicKey(xpubkey)._buffers)).xpubkey.should.equal(xpubkey);
    });

    it('checks the checksum', function() {
      var buffers = new HDPublicKey(xpubkey)._buffers;
      buffers.checksum = BufferUtil.integerAsBuffer(1);
      expectFail(function() {
        return new HDPublicKey(buffers);
      }, errors.InvalidB58Checksum);
    });
  });

  describe('error checking on serialization', function() {
    var compareType = function(a, b) {
      expect(a instanceof b).to.equal(true);
    };
    it('throws invalid argument when argument is not a string or buffer', function() {
      compareType(HDPublicKey.getSerializedError(1), hdErrors.UnrecognizedArgument);
    });
    it('if a network is provided, validates that data corresponds to it', function() {
      compareType(HDPublicKey.getSerializedError(xpubkey, 'testnet'), errors.InvalidNetwork);
    });
    it('recognizes invalid network arguments', function() {
      compareType(HDPublicKey.getSerializedError(xpubkey, 'invalid'), errors.InvalidNetworkArgument);
    });
    it('recognizes a valid network', function() {
      expect(HDPublicKey.getSerializedError(xpubkey, 'livenet')).to.equal(null);
    });
  });

  it('toString() returns the same value as .xpubkey', function() {
    var pubKey = new HDPublicKey(xpubkey);
    pubKey.toString().should.equal(pubKey.xpubkey);
  });

  it('publicKey property matches network', function() {
    var livenet = new HDPublicKey(xpubkey);
    var testnet = new HDPublicKey(xpubkeyTestnet);

    livenet.publicKey.network.should.equal(Networks.livenet);
    testnet.publicKey.network.should.equal(Networks.testnet);
  });

  it('inspect() displays correctly', function() {
    var pubKey = new HDPublicKey(xpubkey);
    pubKey.inspect().should.equal('<HDPublicKey: ' + pubKey.xpubkey + '>');
  });

  describe('conversion to/from buffer', function() {

    it('should roundtrip to an equivalent object', function() {
      var pubKey = new HDPublicKey(xpubkey);
      var toBuffer = pubKey.toBuffer();
      var fromBuffer = HDPublicKey.fromBuffer(toBuffer);
      var roundTrip = new HDPublicKey(fromBuffer.toBuffer());
      roundTrip.xpubkey.should.equal(xpubkey);
    });
  });

  describe('conversion to different formats', function() {
    var plainObject = {
      network: 'livenet',
      depth: 0,
      fingerPrint: 2837462190, //unsigned (-1457505106 >>> 0)
      parentFingerPrint: 0,
      childIndex: 0,
      chainCode: '602e52a0b9a7730844e81a7faf6fb0e46514388b3dc7eddefc038165b4d430ad',
      publicKey: '0391822fb6dc1307a952e723d3deef6aeb38da447dae0eeb5aa272ef76e7f0b572',
      checksum: 1280922356,
      xpubkey: 'xpub661MyMwAqRbcFVySPCKQ8ACqszXPfjksxMwjSkGN4ovg5KZ92mL7ocPVZArbpNm6x1gqZkqdthgdLg1EefyRHU1mQrp1k5NYFmd5hkkJgAw'
    }
    it('roundtrips to JSON and to Object', function() {
      var pubkey = new HDPublicKey(xpubkey);
      expect(HDPublicKey.fromObject(pubkey.toJSON()).xpubkey).to.equal(xpubkey);
    });
    it('recovers state from Object', function() {
      new HDPublicKey(plainObject).xpubkey.should.equal(xpubkey);
    });
  });

  describe('derivation', function() {
    it('derivation is the same whether deriving with number or string', function() {
      var pubkey = new HDPublicKey(xpubkey);
      var derived1 = pubkey.deriveChild(0).deriveChild(1).deriveChild(200000);
      var derived2 = pubkey.deriveChild('m/0/1/200000');
      derived1.xpubkey.should.equal(derived_0_1_200000);
      derived2.xpubkey.should.equal(derived_0_1_200000);
    });

    it('allows special parameters m, M', function() {
      var expectDerivationSuccess = function(argument) {
        new HDPublicKey(xpubkey).deriveChild(argument).xpubkey.should.equal(xpubkey);
      };
      expectDerivationSuccess('m');
      expectDerivationSuccess('M');
    });

    it('doesn\'t allow object arguments for derivation', function() {
      expectFail(function() {
        return new HDPublicKey(xpubkey).deriveChild({});
      }, hdErrors.InvalidDerivationArgument);
    });

    it('needs first argument for derivation', function() {
      expectFail(function() {
        return new HDPublicKey(xpubkey).deriveChild('s');
      }, hdErrors.InvalidPath);
    });

    it('doesn\'t allow other parameters like m\' or M\' or "s"', function() {
      /* jshint quotmark: double */
      expectDerivationFail("m'", hdErrors.InvalidIndexCantDeriveHardened);
      expectDerivationFail("M'", hdErrors.InvalidIndexCantDeriveHardened);
      expectDerivationFail("1", hdErrors.InvalidPath);
      expectDerivationFail("S", hdErrors.InvalidPath);
    });

    it('can\'t derive hardened keys', function() {
      expectFail(function() {
        return new HDPublicKey(xpubkey).deriveChild(HDPublicKey.Hardened);
      }, hdErrors.InvalidIndexCantDeriveHardened);
    });

    it('can\'t derive hardened keys via second argument', function() {
      expectFail(function() {
        return new HDPublicKey(xpubkey).deriveChild(5, true);
      }, hdErrors.InvalidIndexCantDeriveHardened);
    });

    it('validates correct paths', function() {
      var valid;

      valid = HDPublicKey.isValidPath('m/123/12');
      valid.should.equal(true);

      valid = HDPublicKey.isValidPath('m');
      valid.should.equal(true);

      valid = HDPublicKey.isValidPath(123);
      valid.should.equal(true);
    });

    it('rejects illegal paths', function() {
      var valid;

      valid = HDPublicKey.isValidPath('m/-1/12');
      valid.should.equal(false);

      valid = HDPublicKey.isValidPath("m/0'/12");
      valid.should.equal(false);

      valid = HDPublicKey.isValidPath("m/8000000000/12");
      valid.should.equal(false);

      valid = HDPublicKey.isValidPath('bad path');
      valid.should.equal(false);

      valid = HDPublicKey.isValidPath(-1);
      valid.should.equal(false);

      valid = HDPublicKey.isValidPath(8000000000);
      valid.should.equal(false);

      valid = HDPublicKey.isValidPath(HDPublicKey.Hardened);
      valid.should.equal(false);
    });
  });
});
