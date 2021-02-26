'use strict';

// Relax some linter options:
//   * quote marks so "m/0'/1/2'/" doesn't need to be scaped
//   * too many tests, maxstatements -> 100
//   * store test vectors at the end, latedef: false
//   * should call is never defined
/* jshint quotmark: false */
/* jshint latedef: false */
/* jshint maxstatements: 100 */
/* jshint unused: false */

var _ = require('lodash');
var should = require('chai').should();
var expect = require('chai').expect;
var sinon = require('sinon');
var bitcore = require('..');
var Networks = bitcore.Networks;
var HDPrivateKey = bitcore.HDPrivateKey;
var HDPublicKey = bitcore.HDPublicKey;

describe('HDKeys building with static methods', function() {
  var classes = [HDPublicKey, HDPrivateKey];
  var clazz, index;

  _.each(classes, function(clazz) {
    var expectStaticMethodFail = function(staticMethod, argument, message) {
      expect(clazz[staticMethod].bind(null, argument)).to.throw(message);
    };
    it(clazz.name + ' fromJSON checks that a valid JSON is provided', function() {
      var errorMessage = 'Invalid Argument: No valid argument was provided';
      var method = 'fromObject';
      expectStaticMethodFail(method, undefined, errorMessage);
      expectStaticMethodFail(method, null, errorMessage);
      expectStaticMethodFail(method, 'invalid JSON', errorMessage);
      expectStaticMethodFail(method, '{\'singlequotes\': true}', errorMessage);
    });
    it(clazz.name + ' fromString checks that a string is provided', function() {
      var errorMessage = 'No valid string was provided';
      var method = 'fromString';
      expectStaticMethodFail(method, undefined, errorMessage);
      expectStaticMethodFail(method, null, errorMessage);
      expectStaticMethodFail(method, {}, errorMessage);
    });
    it(clazz.name + ' fromObject checks that an object is provided', function() {
      var errorMessage = 'No valid argument was provided';
      var method = 'fromObject';
      expectStaticMethodFail(method, undefined, errorMessage);
      expectStaticMethodFail(method, null, errorMessage);
      expectStaticMethodFail(method, '', errorMessage);
    });
  });
});

describe('BIP32 compliance', function() {

  it('should initialize test vector 1 from the extended public key', function() {
    new HDPublicKey(vector1_m_public).xpubkey.should.equal(vector1_m_public);
  });

  it('should initialize test vector 1 from the extended private key', function() {
    new HDPrivateKey(vector1_m_private).xprivkey.should.equal(vector1_m_private);
  });

  it('can initialize a public key from an extended private key', function() {
    new HDPublicKey(vector1_m_private).xpubkey.should.equal(vector1_m_public);
  });

  it('toString should be equal to the `xpubkey` member', function() {
    var privateKey = new HDPrivateKey(vector1_m_private);
    privateKey.toString().should.equal(privateKey.xprivkey);
  });

  it('toString should be equal to the `xpubkey` member', function() {
    var publicKey = new HDPublicKey(vector1_m_public);
    publicKey.toString().should.equal(publicKey.xpubkey);
  });

  it('should get the extended public key from the extended private key for test vector 1', function() {
    HDPrivateKey(vector1_m_private).xpubkey.should.equal(vector1_m_public);
  });

  it("should get m/0' ext. private key from test vector 1", function() {
    var privateKey = new HDPrivateKey(vector1_m_private).deriveChild("m/0'");
    privateKey.xprivkey.should.equal(vector1_m0h_private);
  });

  it("should get m/0' ext. public key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).deriveChild("m/0'")
      .xpubkey.should.equal(vector1_m0h_public);
  });

  it("should get m/0'/1 ext. private key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).deriveChild("m/0'/1")
      .xprivkey.should.equal(vector1_m0h1_private);
  });

  it("should get m/0'/1 ext. public key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).deriveChild("m/0'/1")
      .xpubkey.should.equal(vector1_m0h1_public);
  });

  it("should get m/0'/1 ext. public key from m/0' public key from test vector 1", function() {
    var derivedPublic = HDPrivateKey(vector1_m_private).deriveChild("m/0'").hdPublicKey.deriveChild("m/1");
    derivedPublic.xpubkey.should.equal(vector1_m0h1_public);
  });

  it("should get m/0'/1/2' ext. private key from test vector 1", function() {
    var privateKey = new HDPrivateKey(vector1_m_private);
    var derived = privateKey.deriveChild("m/0'/1/2'");
    derived.xprivkey.should.equal(vector1_m0h12h_private);
  });

  it("should get m/0'/1/2' ext. public key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).deriveChild("m/0'/1/2'")
      .xpubkey.should.equal(vector1_m0h12h_public);
  });

  it("should get m/0'/1/2'/2 ext. private key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).deriveChild("m/0'/1/2'/2")
      .xprivkey.should.equal(vector1_m0h12h2_private);
  });

  it("should get m/0'/1/2'/2 ext. public key from m/0'/1/2' public key from test vector 1", function() {
    var derived = HDPrivateKey(vector1_m_private).deriveChild("m/0'/1/2'").hdPublicKey;
    derived.deriveChild("m/2").xpubkey.should.equal(vector1_m0h12h2_public);
  });

  it("should get m/0'/1/2h/2 ext. public key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).deriveChild("m/0'/1/2'/2")
      .xpubkey.should.equal(vector1_m0h12h2_public);
  });

  it("should get m/0'/1/2h/2/1000000000 ext. private key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).deriveChild("m/0'/1/2'/2/1000000000")
      .xprivkey.should.equal(vector1_m0h12h21000000000_private);
  });

  it("should get m/0'/1/2h/2/1000000000 ext. public key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).deriveChild("m/0'/1/2'/2/1000000000")
      .xpubkey.should.equal(vector1_m0h12h21000000000_public);
  });

  it("should get m/0'/1/2'/2/1000000000 ext. public key from m/0'/1/2'/2 public key from test vector 1", function() {
    var derived = HDPrivateKey(vector1_m_private).deriveChild("m/0'/1/2'/2").hdPublicKey;
    derived.deriveChild("m/1000000000").xpubkey.should.equal(vector1_m0h12h21000000000_public);
  });

  it('should initialize test vector 2 from the extended public key', function() {
    HDPublicKey(vector2_m_public).xpubkey.should.equal(vector2_m_public);
  });

  it('should initialize test vector 2 from the extended private key', function() {
    HDPrivateKey(vector2_m_private).xprivkey.should.equal(vector2_m_private);
  });

  it('should get the extended public key from the extended private key for test vector 2', function() {
    HDPrivateKey(vector2_m_private).xpubkey.should.equal(vector2_m_public);
  });

  it("should get m/0 ext. private key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).deriveChild(0).xprivkey.should.equal(vector2_m0_private);
  });

  it("should get m/0 ext. public key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).deriveChild(0).xpubkey.should.equal(vector2_m0_public);
  });

  it("should get m/0 ext. public key from m public key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).hdPublicKey.deriveChild(0).xpubkey.should.equal(vector2_m0_public);
  });

  it("should get m/0/2147483647h ext. private key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).deriveChild("m/0/2147483647'")
      .xprivkey.should.equal(vector2_m02147483647h_private);
  });

  it("should get m/0/2147483647h ext. public key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).deriveChild("m/0/2147483647'")
      .xpubkey.should.equal(vector2_m02147483647h_public);
  });

  it("should get m/0/2147483647h/1 ext. private key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).deriveChild("m/0/2147483647'/1")
      .xprivkey.should.equal(vector2_m02147483647h1_private);
  });

  it("should get m/0/2147483647h/1 ext. public key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).deriveChild("m/0/2147483647'/1")
      .xpubkey.should.equal(vector2_m02147483647h1_public);
  });

  it("should get m/0/2147483647h/1 ext. public key from m/0/2147483647h public key from test vector 2", function() {
    var derived = HDPrivateKey(vector2_m_private).deriveChild("m/0/2147483647'").hdPublicKey;
    derived.deriveChild(1).xpubkey.should.equal(vector2_m02147483647h1_public);
  });

  it("should get m/0/2147483647h/1/2147483646h ext. private key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).deriveChild("m/0/2147483647'/1/2147483646'")
      .xprivkey.should.equal(vector2_m02147483647h12147483646h_private);
  });

  it("should get m/0/2147483647h/1/2147483646h ext. public key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).deriveChild("m/0/2147483647'/1/2147483646'")
      .xpubkey.should.equal(vector2_m02147483647h12147483646h_public);
  });

  it("should get m/0/2147483647h/1/2147483646h/2 ext. private key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).deriveChild("m/0/2147483647'/1/2147483646'/2")
      .xprivkey.should.equal(vector2_m02147483647h12147483646h2_private);
  });

  it("should get m/0/2147483647h/1/2147483646h/2 ext. public key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).deriveChild("m/0/2147483647'/1/2147483646'/2")
      .xpubkey.should.equal(vector2_m02147483647h12147483646h2_public);
  });

  it("should get m/0/2147483647h/1/2147483646h/2 ext. public key from m/0/2147483647h/2147483646h public key from test vector 2", function() {
    var derivedPublic = HDPrivateKey(vector2_m_private)
      .deriveChild("m/0/2147483647'/1/2147483646'").hdPublicKey;
    derivedPublic.deriveChild("m/2")
      .xpubkey.should.equal(vector2_m02147483647h12147483646h2_public);
  });

  it('should use full 32 bytes for private key data that is hashed (as per bip32)', function() {
    // https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
    var privateKeyBuffer = new Buffer('00000055378cf5fafb56c711c674143f9b0ee82ab0ba2924f19b64f5ae7cdbfd', 'hex');
    var chainCodeBuffer = new Buffer('9c8a5c863e5941f3d99453e6ba66b328bb17cf0b8dec89ed4fc5ace397a1c089', 'hex');
    var key = HDPrivateKey.fromObject({
      network: 'testnet',
      depth: 0,
      parentFingerPrint: 0,
      childIndex: 0,
      privateKey: privateKeyBuffer,
      chainCode: chainCodeBuffer
    });
    var derived = key.deriveChild("m/44'/0'/0'/0/0'");
    derived.privateKey.toString().should.equal('3348069561d2a0fb925e74bf198762acc47dce7db27372257d2d959a9e6f8aeb');
  });

  describe('edge cases', function() {
    var sandbox = sinon.sandbox.create();
    afterEach(function() {
      sandbox.restore();
    });
    it('will handle edge case that derived private key is invalid', function() {
      var invalid = new Buffer('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
      var privateKeyBuffer = new Buffer('5f72914c48581fc7ddeb944a9616389200a9560177d24f458258e5b04527bcd1', 'hex');
      var chainCodeBuffer = new Buffer('39816057bba9d952fe87fe998b7fd4d690a1bb58c2ff69141469e4d1dffb4b91', 'hex');
      var unstubbed = bitcore.crypto.BN.prototype.toBuffer;
      var count = 0;
      var stub = sandbox.stub(bitcore.crypto.BN.prototype, 'toBuffer').callsFake(function(args) {
        // On the fourth call to the function give back an invalid private key
        // otherwise use the normal behavior.
        count++;
        if (count === 4) {
          return invalid;
        }
        var ret = unstubbed.apply(this, arguments);
        return ret;
      });
      sandbox.spy(bitcore.PrivateKey, 'isValid');
      var key = HDPrivateKey.fromObject({
        network: 'testnet',
        depth: 0,
        parentFingerPrint: 0,
        childIndex: 0,
        privateKey: privateKeyBuffer,
        chainCode: chainCodeBuffer
      });
      var derived = key.deriveChild("m/44'");
      derived.privateKey.toString().should.equal('b15bce3608d607ee3a49069197732c656bca942ee59f3e29b4d56914c1de6825');
      bitcore.PrivateKey.isValid.callCount.should.equal(2);
    });
    it('will handle edge case that a derive public key is invalid', function() {
      var publicKeyBuffer = new Buffer('029e58b241790284ef56502667b15157b3fc58c567f044ddc35653860f9455d099', 'hex');
      var chainCodeBuffer = new Buffer('39816057bba9d952fe87fe998b7fd4d690a1bb58c2ff69141469e4d1dffb4b91', 'hex');
      var key = new HDPublicKey({
        network: 'testnet',
        depth: 0,
        parentFingerPrint: 0,
        childIndex: 0,
        chainCode: chainCodeBuffer,
        publicKey: publicKeyBuffer
      });
      var unstubbed = bitcore.PublicKey.fromPoint;
      bitcore.PublicKey.fromPoint = function() {
        bitcore.PublicKey.fromPoint = unstubbed;
        throw new Error('Point cannot be equal to Infinity');
      };
      sandbox.spy(key, '_deriveWithNumber');
      var derived = key.deriveChild("m/44");
      key._deriveWithNumber.callCount.should.equal(2);
      key.publicKey.toString().should.equal('029e58b241790284ef56502667b15157b3fc58c567f044ddc35653860f9455d099');
    });
  });

  describe('seed', function() {

    it('should initialize a new BIP32 correctly from test vector 1 seed', function() {
      var seededKey = HDPrivateKey.fromSeed(vector1_master, Networks.livenet);
      seededKey.xprivkey.should.equal(vector1_m_private);
      seededKey.xpubkey.should.equal(vector1_m_public);
    });

    it('should initialize a new BIP32 correctly from test vector 2 seed', function() {
      var seededKey = HDPrivateKey.fromSeed(vector2_master, Networks.livenet);
      seededKey.xprivkey.should.equal(vector2_m_private);
      seededKey.xpubkey.should.equal(vector2_m_public);
    });
  });
});

//test vectors: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
var vector1_master = '000102030405060708090a0b0c0d0e0f';
var vector1_m_public = 'dgub8kXBZ7ymNWy2S8Q3jNgVjFUm5ZJ3QLLaSTdAA89ukSv7Q6MSXwE14b7Nv6eDpE9JJXinTKc8LeLVu19uDPrm5uJuhpKNzV2kAgncwo6bNpP';
var vector1_m_private = 'dgpv51eADS3spNJh9Gjth94XcPwAczvQaDJs9rqx11kvxKs6r3Ek8AgERHhjLs6mzXQFHRzQqGwqdeoDkZmr8jQMBfi43b7sT3sx3cCSk5fGeUR';
var vector1_m0h_public = 'dgub8nnbYqHETn61ajXkw8Z8cHasQNrPnQpb85448DY2ie7PmNecxAm6BjTnhNCvZY3qJk1MKZ9Z5HQasQ83ARb99nmduT7dunvxgcvBFVHuvrq';
var vector1_m0h_private = 'dgpv53uaD9MLudRgHssbttwAVS3GwpUkxHnsqUGqy793vX4PDKXvYQDKYS4988T7QEnCzUt7CaGi21e6UKoZnKgXyjna7To1h1aqkcqJBDM65ur';
var vector1_m0h1_public = 'dgub8pxikcq7rUy5RBaCfPT1D2UXTkqVnSYt4PitiVJqfGubzv9kfyBQ9JN27SfVyUmBGTdQ6ybfBsu4Thrrdkm2qSbaCexVPRwEKMSxYLP2A41';
var vector1_m0h1_private = 'dgpv565hQvuEJLJk8Kv3d9q36Avw1CTrxKXAmnwgZNurs9rbSs34GCddVzxNYBeB1AZFSZdo1Ps96ibWcGKnufUWkuH1dEkjkmMhRR9fi7Po6B2';
var vector1_m0h12h_public = 'dgub8sZzo9eyZMpVHMNHuyrNa2Wfgui23z8sPvxZxpbzq9H3QmLsUj1q3juwfTrLRMCVcyj8iMaGZpU2v319LrJZttkQnYvdUNzv33N6dcqeZ8X';
var vector1_m0h12h_private = 'dgpv58gyTTj61DA9zVi8skEQTAy5EMLPDs7A7LBMoiD232E2riEB4xU4QSWJ6DrnyQ4jx2fBbrp4X8RQqU4YVgPhszifyrKHuhbe2gttLnRB4a6';
var vector1_m0h12h2_public = 'dgub8uoPdamvjqVUMpr1cF4TTXfymizkgaT4qQqsDn8U9aqemryEYViCFKNsLnqiq9ME6HrJrN4DcZN9UTM9S9jmcVDfhLUpJZtk3jGwnGkhd8u';
var vector1_m0h12h2_private = 'dgpv5AvNHtr3Bgq94yBra1SVLg8PKAd7rTRMYp4f4fjVMTneDorY8jARc1yDmYGFS4UB1pntDn3dRwsaJexzh6w45PJiP6QPTnRMBfN3rDUiyyH';
var vector1_m0h12h21000000000_public = 'dgub8wXA7GPArxsftAdTindBmEfyZxa4W5G6dfERU4WcMfE9UzNd4uxrWRXvyckfgQRwZz8rMhz29m4k4skAY1EcTkNnZstu73UNrgts2MA5evC';
var vector1_m0h12h21000000000_private = 'dgpv5Ce8maTHJpDLbJyJgZ1DeP8P7QCRfxEPM4TDJx7dZYB8vwFvf9R5s88HQQ3TLybFdEC9192aGzQhJpyNEAwnCLxFibAcahB4TzvQbJyp2im';
var vector2_master = 'fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542';
var vector2_m_public = 'dgub8kXBZ7ymNWy2RjuNqXknBTCXKkSU5xbQ83QtT4tjiq2yh5Ndi5zwVVGyGCjCXUWGD5xaMzGHjiqkcnt8LamvDpJrZkWqpyXQV4TjDhfyo9Q';
var vector2_m_private = 'dgpv51eADS3spNJh8tFDoJ8p4bevsC4qFqZgqSdgHxVkvhyy92FwJKTArBsKgvsqB2xLXUjqaZQHukqQr6VxB9o3o32pW1C7bPngcrpg75LUw8V';
var vector2_m0_public = 'dgub8onvpqfirXo6x1VfyK8fFFc3giBinw5ggDAFcsvBoEtwP3pcHMM1eKrDqfh6KZWhRQSkEDG38ogimxJpDjULZQy8qoFWjKfncYaPesrSURc';
var vector2_m0_private = 'dgpv54uuV9jqJP8mf9qWw5Wh8Q4TE9p5xp3yPcP3TmXD17qvpzhusaoF12SaGS9dp6oAw8yfUZp2LvFYCc8mjSJ6jGCDWBcAysxRkGjEUK7pYvw';
var vector2_m02147483647h_public = 'dgub8pwz5ShFERyD7shrPm8JibHc5TQdLRFNmNEnYGpxSyfKqM44uEmKrPdpT3wD5J7oCvNHt47eS27KSdB9zdxTHZRmNssa63voUvqzVgkMK7p';
var vector2_m02147483647h_private = 'dgpv564xjkmMgHJsq23hMXWLbjk1cu2zWJDfUmTaPARyercKHHwNVUDZD6EAsndcYMXeqNJZFb1fPvkedqsYTouEJZdmvuqWkPggY44mEn4uizf';
var vector2_m02147483647h1_public = 'dgub8skxVTgBQ5GQDVNzTRGsgYDqQzH8ScAe5ojePLVHks1mWAvECkJ2kJ2CHr8LsAp5o6pqihCt59R9XRSAuYPQYttfyA5RJbN1QhWwkCcvPdA';
var vector2_m02147483647h1_private = 'dgpv58sw9mkHqvc4vdiqRBeuZggExRuVcV8voCxSEE6Jxjxkx7oXnykG6zcYiaqEa4jM9KfFzt63oURrxYehWhRcK3T54gNKbVf51rVViRSkahZ';
var vector2_m02147483647h12147483646h_public = 'dgub8tvzQRcY1UE7WScbBu6R43v2KikVVao97WTXv4BhbdH1xXFAJRE3GpPHvWFr4YLXkYUUXCGb7kk1B4bZbRVvGFb8F4PurtTRGvbXH6bMPN3';
var vector2_m02147483647h12147483646h_private = 'dgpv5A3y4jgeTKZnDaxS9fUSwCNRsANrfTmRpugKkwnioWE1QU8TtegGdWyeMHZdCV7dgtwxJhs3Br1Smfk52eL6zt8EtcudjhghMSW1nDNfmHP';
var vector2_m02147483647h12147483646h2_public = 'dgub8vJ2Mrq3XeYMFhoUuyE72oHzinHbjuiDmg5RKqYCER8c2iajU49oTPLHzuL8C7hEGbgho7n11TkzfVf4RXBpaWShtEDzoFk9xDnhwhVSxT7';
var vector2_m02147483647h12147483646h2_private = 'dgpv5BR12Au9yVt1xr9Ksjc8uwkQGDuxungWV5JDAj9DSJ5bUfU34Hc2p5veRhEdMWChjCogbTVrdwr8pDdakxhL3rrxhUR8o7pR3oqZrnPNxDt';
