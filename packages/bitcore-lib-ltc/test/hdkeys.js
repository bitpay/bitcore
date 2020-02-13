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
    var privateKey = new HDPrivateKey(vector1_m_private).derive("m/0'");
    privateKey.xprivkey.should.equal(vector1_m0h_private);
  });

  it("should get m/0' ext. public key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).derive("m/0'")
      .xpubkey.should.equal(vector1_m0h_public);
  });

  it("should get m/0'/1 ext. private key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).derive("m/0'/1")
      .xprivkey.should.equal(vector1_m0h1_private);
  });

  it("should get m/0'/1 ext. public key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).derive("m/0'/1")
      .xpubkey.should.equal(vector1_m0h1_public);
  });

  it("should get m/0'/1 ext. public key from m/0' public key from test vector 1", function() {
    var derivedPublic = HDPrivateKey(vector1_m_private).derive("m/0'").hdPublicKey.derive("m/1");
    derivedPublic.xpubkey.should.equal(vector1_m0h1_public);
  });

  it("should get m/0'/1/2' ext. private key from test vector 1", function() {
    var privateKey = new HDPrivateKey(vector1_m_private);
    var derived = privateKey.derive("m/0'/1/2'");
    derived.xprivkey.should.equal(vector1_m0h12h_private);
  });

  it("should get m/0'/1/2' ext. public key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).derive("m/0'/1/2'")
      .xpubkey.should.equal(vector1_m0h12h_public);
  });

  it("should get m/0'/1/2'/2 ext. private key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).derive("m/0'/1/2'/2")
      .xprivkey.should.equal(vector1_m0h12h2_private);
  });

  it("should get m/0'/1/2'/2 ext. public key from m/0'/1/2' public key from test vector 1", function() {
    var derived = HDPrivateKey(vector1_m_private).derive("m/0'/1/2'").hdPublicKey;
    derived.derive("m/2").xpubkey.should.equal(vector1_m0h12h2_public);
  });

  it("should get m/0'/1/2h/2 ext. public key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).derive("m/0'/1/2'/2")
      .xpubkey.should.equal(vector1_m0h12h2_public);
  });

  it("should get m/0'/1/2h/2/1000000000 ext. private key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).derive("m/0'/1/2'/2/1000000000")
      .xprivkey.should.equal(vector1_m0h12h21000000000_private);
  });

  it("should get m/0'/1/2h/2/1000000000 ext. public key from test vector 1", function() {
    HDPrivateKey(vector1_m_private).derive("m/0'/1/2'/2/1000000000")
      .xpubkey.should.equal(vector1_m0h12h21000000000_public);
  });

  it("should get m/0'/1/2'/2/1000000000 ext. public key from m/0'/1/2'/2 public key from test vector 1", function() {
    var derived = HDPrivateKey(vector1_m_private).derive("m/0'/1/2'/2").hdPublicKey;
    derived.derive("m/1000000000").xpubkey.should.equal(vector1_m0h12h21000000000_public);
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
    HDPrivateKey(vector2_m_private).derive(0).xprivkey.should.equal(vector2_m0_private);
  });

  it("should get m/0 ext. public key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).derive(0).xpubkey.should.equal(vector2_m0_public);
  });

  it("should get m/0 ext. public key from m public key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).hdPublicKey.derive(0).xpubkey.should.equal(vector2_m0_public);
  });

  it("should get m/0/2147483647h ext. private key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).derive("m/0/2147483647'")
      .xprivkey.should.equal(vector2_m02147483647h_private);
  });

  it("should get m/0/2147483647h ext. public key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).derive("m/0/2147483647'")
      .xpubkey.should.equal(vector2_m02147483647h_public);
  });

  it("should get m/0/2147483647h/1 ext. private key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).derive("m/0/2147483647'/1")
      .xprivkey.should.equal(vector2_m02147483647h1_private);
  });

  it("should get m/0/2147483647h/1 ext. public key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).derive("m/0/2147483647'/1")
      .xpubkey.should.equal(vector2_m02147483647h1_public);
  });

  it("should get m/0/2147483647h/1 ext. public key from m/0/2147483647h public key from test vector 2", function() {
    var derived = HDPrivateKey(vector2_m_private).derive("m/0/2147483647'").hdPublicKey;
    derived.derive(1).xpubkey.should.equal(vector2_m02147483647h1_public);
  });

  it("should get m/0/2147483647h/1/2147483646h ext. private key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).derive("m/0/2147483647'/1/2147483646'")
      .xprivkey.should.equal(vector2_m02147483647h12147483646h_private);
  });

  it("should get m/0/2147483647h/1/2147483646h ext. public key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).derive("m/0/2147483647'/1/2147483646'")
      .xpubkey.should.equal(vector2_m02147483647h12147483646h_public);
  });

  it("should get m/0/2147483647h/1/2147483646h/2 ext. private key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).derive("m/0/2147483647'/1/2147483646'/2")
      .xprivkey.should.equal(vector2_m02147483647h12147483646h2_private);
  });

  it("should get m/0/2147483647h/1/2147483646h/2 ext. public key from test vector 2", function() {
    HDPrivateKey(vector2_m_private).derive("m/0/2147483647'/1/2147483646'/2")
      .xpubkey.should.equal(vector2_m02147483647h12147483646h2_public);
  });

  it("should get m/0/2147483647h/1/2147483646h/2 ext. public key from m/0/2147483647h/2147483646h public key from test vector 2", function() {
    var derivedPublic = HDPrivateKey(vector2_m_private)
      .derive("m/0/2147483647'/1/2147483646'").hdPublicKey;
    derivedPublic.derive("m/2")
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
    var derived = key.derive("m/44'/0'/0'/0/0'");
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
      var derived = key.derive("m/44'");
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
      var derived = key.derive("m/44");
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
var vector1_m_public = 'Ltub2SSUS19CirucWFod2ZsYA2J4v4U76YiCXHdcQttnoiy5aGanFHCPDBX7utfG6f95u1cUbZJNafmvzNCzZZJTw1EmyFoL8u1gJbGM8ipu491';
var vector1_m_private = 'Ltpv71G8qDifUiNetP6nmxPA5STrUVmv2J9YSmXajv8VsYBUyuPhvN9xCaQrfX2wo5xxJNtEazYCFRUu5FmokYMM79pcqz8pcdo4rNXAFPgyB4k';
var vector1_m0h_public = 'Ltub2UhtRiSfp82berwLEKkB34QBEt2TUdCDCu4WNzGumvAMwYsxfWjULKsXhADxqy3cuDu3TnqoKJr1xmB8Wb2qzthWAtbb4CutpXPuSU1YMgG';
var vector1_m0h_private = 'Ltpv73XYpw28ZyVe2zEVyiFnxUZxoKLGQNdZ8NxUi1WcqjNmMBgtLbh3KimGSnPHCoLv1RmvxHs4dnKmo1oXQ8dXuDu8uroxrbVxZPA1gXboYvx';
var vector1_m0h1_public = 'Ltub2Wt1dVzZCpufVJymxae3doHqJG1ZUevW9DjLyG3iiYxaB6P6PK9nHtmm7EgYFukxrwX6FDHuRuLVZ4uwyvCjgYXSU6SSXqvATFvgjLDteZ8';
var vector1_m0h1_private = 'Ltpv75hg2ia1xgNhsSGwhy9fZDTcrhKNQQMr4hdKJHHRnNAyajC24Q7MHHfVrqaLoj7xTWXcm7TViVHBvxKkXURWgPPaRdmgvMGpEBUPDQomMoz';
var vector1_m0h12h_public = 'Ltub2ZVHg2pQuhm5MUmsDB3QzoKyXQt5kCWVUky2DbLstRL1awaDC4zDCLKgfFsNhnCHDTcprbGWoquU1Q4Eh1kGjzgH3zQacnyrAwqppbnDPZ9';
var vector1_m0h12h_private = 'Ltpv78Jx5FPsfZE7jc52xZZ2vDVm5rBtfwwqQErzYcaaxEYQzaP8s9wnBjDRQsnxmxdSxyZ1MaQR8u76AA4W7VLhoUqEnFLF5HWkqTDbr5DovYB';
var vector1_m0h12h2_public = 'Ltub2bigWTwN6BS4RxFauSFVtJVHcEApNnpgvErKUYsMCrtcx3CaFqgaPuncLarm7aM1gmjzzbkTraoaZpQEnKBUTb9XxmxmSysgBdkfyFbascs';
var vector1_m0h12h2_private = 'Ltpv7AYLugWpr2u6p5Ykepm7oif5AfUdJYG2qikHoa74Gg72Mg1Vvve9PJgM6CCREd2t2mghyVdz3iZFdLxxJut3zsRHBVRLdNLTzRgmMZtMHv7';
var vector1_m0h12h21000000000_public = 'Ltub2dSSz9YcDJpFxJ331ypEC1VHQTk8CHdiiVEsiqFVQwH7fAbxnFwEf1wfyQmhxqRjAU2YVwgGPnWBAEoFtAgKJrJeqKNrFTTJzbNbDMUZjYL';
var vector1_m0h12h21000000000_private = 'Ltpv7CG7PN84yAHJLRLCmNKr7Rf4xu3w8354dy8r3rVCUkVX4oQtTLtoeQqQj3yd9Y9xeB5xkrcvtm6NdWyKqytn7q4pWzBZkH6BGmF86hsLPtJ';
var vector2_master = 'fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542';
var vector2_m_public = 'Ltub2SSUS19CirucVsJx8iwpcE1qAFcXnAy2CsRLhqdcn75wsFbyRRyKe5giFzkEouW3oZrGWDxXykHBi9wDgkDd4vEiqBznyPWLcxwTQjJTyxX';
var vector2_m_private = 'Ltpv71G8qDifUiNeszc7t7TSXeBcigvLhvQN8MKK2rsKqvJMGtQu6WvtdUaT1aozybX3YRdfLGzeXXX6AnVunxk3iX9PJQD4kyhoRd9PcKyWKRK';
var vector2_m0_public = 'Ltub2ViDhiqACsjh28uFGWKhg2RMXDMnV9TJm3Ahsef4rWwuZE3wzhKPnvFxqTi8bzWV1tLSNSxHNq89sKMuZtv3QWu17EjTsjeikT47quponTX';
var vector2_m0_private = 'Ltpv74Xt6wQcxjCjQGCR1tqKbSb95efbQttegX4gCftmvLAJxrrsfnGxnK9hb65ocfMsx5sVEHQNxgwDXJ8jMFF6ekJnJad89TsYZ33wyaWm4kk';
var vector2_m02147483647h_public = 'Ltub2WsGxKrgamuoC17RgxKM9N6uuxah2dczrCFEo3ZqWFiJ1XHQcajhzz3ZSqxFMj7aoQFz2Hotg3YkXzEFLoQA8fMdeKMXETujcqKigf4Rx1P';
var vector2_m02147483647h_private = 'Ltpv75gwMYS9LdNqa8QbSLpy4nGhUPtVxP4Lmg9D84oYa4vhRA6LHfhGzNwJCSZnLv6MrKCP1Jc21hSKxXsW5crEE3kLjJrTuyboLpPUjzJreuq';
var vector2_m02147483647h1_public = 'Ltub2ZgFNLqckRCzHcnZkcTv7K39FVTC8pYGAdk6e7EAp94jgM9Zv6GQttRwHe9P9bosPaiXrvu8KAracnVGFhq7PzpYEbZNT1LwYbzfw9HojQB';
var vector2_m02147483647h1_private = 'Ltpv78VumZR5WGg2fk5jVzyY2jCvovm14Zyc67e4y8TssxH95yxVbBDytHKg3EmQNdJ4AGZ5kbgQRF7YHEef8WNcEXZds5PGm5aBpcpDDiG4cb2';
var vector2_m02147483647h12147483646h_public = 'Ltub2arHHJmyMpAhaa2AV6HTUpjLADvZBoAmCLTzApvaeuKz8hUW1mCRRQo2vJGtLyLKM2NAfRxqMnBSGReewawd7MWzWVss1JSMQq5FU6xuG3b';
var vector2_m02147483647h12147483646h_private = 'Ltpv79fwgXMS7fdjxhKLEUo5QEu7ifEN7Yc77pMxVrAHiiYPYLHRgr9zQogmfwVo13gLhqqn4RTPoch86Mk2eTH6vNEoh1vauHbpACpjHV4yMM7';
var vector2_m02147483647h12147483646h2_public = 'Ltub2cDKEjzUszUwKqD4DAR9Ta7JZHTfS85qrW5sacH5HhBaCtp5BQ8Bbyk2zhMAUYh1s5aPwMUFFVCRkri9mgdXRcNa9fhwwfj668GS8jig9Sj';
var vector2_m02147483647h12147483646h2_private = 'Ltpv7B2ydxZwdqwyhxWDxYvmNzH67imUMsXBmyyqudWnMWPycXczrV5kbNdmkMAoA4mQk9hWMB6DFiXp8udYNmeKyLyXVsS5xhjXraAHN6qF1PS';
