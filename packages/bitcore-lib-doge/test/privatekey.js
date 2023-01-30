'use strict';

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

var bitcore = require('..');
var BN = bitcore.crypto.BN;
var Point = bitcore.crypto.Point;
var PrivateKey = bitcore.PrivateKey;
var Networks = bitcore.Networks;
var Base58Check = bitcore.encoding.Base58Check;

var validbase58 = require('./data/bitcoind/base58_keys_valid.json');
var invalidbase58 = require('./data/bitcoind/base58_keys_invalid.json');

describe('PrivateKey', function() {
  var hex = '96c132224121b509b7d0a16245e957d9192609c5637c6228311287b1be21627a';
  var hex2 = '8080808080808080808080808080808080808080808080808080808080808080';
  var buf = new Buffer(hex, 'hex');
  var wifTestnet = 'ckrhHfB5k7NzVEqEsksYGvh2xSjZiT71oVGGSysP97bGMCkm3EgK';
  var wifTestnetUncompressed = '95cdHztwpWKgA4dgw8chw9hjR4yjxNFZrPr9otqgPL5mH9PGesJ';
  var wifLivenet = 'QTfg5tZJYhr9Hw1GVYuK74im5VsSN1dB6Xfuz3xYUWEBWWqNZfPx';
  var wifLivenetUncompressed = '6KWRvmWB1YXTp54zTKBPS4QUHbag7aP2CKkJ5eN7YqFcfFRjFaM';
  var wifNamecoin = '74pxNKNpByQ2kMow4d9kF6Z77BYeKztQNLq3dSyU4ES1K5KLNiz';

  it('should create a new random private key', function() {
    var a = new PrivateKey();
    should.exist(a);
    should.exist(a.bn);
    var b = PrivateKey();
    should.exist(b);
    should.exist(b.bn);
  });

  it('should create a privatekey from hexa string', function() {
    var a = new PrivateKey(hex2);
    should.exist(a);
    should.exist(a.bn);
  });

  it('should create a new random testnet private key with only one argument', function() {
    var a = new PrivateKey(Networks.testnet);
    should.exist(a);
    should.exist(a.bn);
  });

  it('should create a private key from a custom network WIF string', function() {
    var nmc = {
      name: 'namecoin',
      alias: 'namecoin',
      pubkeyhash: 0x34,
      privatekey: 0xB4,
      // these below aren't the real NMC version numbers
      scripthash: 0x08,
      xpubkey: 0x0278b20e,
      xprivkey: 0x0278ade4,
      networkMagic: 0xf9beb4fe,
      port: 20001,
      dnsSeeds: [
        'localhost',
        'mynet.localhost'
      ]
    };
    Networks.add(nmc);
    var nmcNet = Networks.get('namecoin');
    var a = new PrivateKey(wifNamecoin, nmcNet);
    should.exist(a);
    should.exist(a.bn);
    Networks.remove(nmcNet);
  });

  it('should create a new random testnet private key with empty data', function() {
    var a = new PrivateKey(null, Networks.testnet);
    should.exist(a);
    should.exist(a.bn);
  });

  it('should create a private key from WIF string', function() {
    var a = new PrivateKey('QPn542uVdzBgCfV6nEViShboFTpDd1at8mQpQugEQHgpuLbsgcZe');
    should.exist(a);
    should.exist(a.bn);
  });

  it('should create a private key from WIF buffer', function() {
    var a = new PrivateKey(Base58Check.decode('QPn542uVdzBgCfV6nEViShboFTpDd1at8mQpQugEQHgpuLbsgcZe'));
    should.exist(a);
    should.exist(a.bn);
  });

  describe('bitcoind compliance', function() {
    validbase58.map(function(d){
      if (d[2].isPrivkey) {
        it('should instantiate WIF private key ' + d[0] + ' with correct properties', function() {
          var network = Networks.livenet;
          if (d[2].isTestnet) {
            network = Networks.testnet;
          }
          var key = new PrivateKey(d[0]);
          key.compressed.should.equal(d[2].isCompressed);
          key.network.should.equal(network);
        });
      }
    });
    invalidbase58.map(function(d){
      it('should describe input ' + d[0].slice(0,10) + '... as invalid', function() {
        expect(function() {
          return new PrivateKey(d[0]);
        }).to.throw(Error);
      });
    });
  });

  describe('instantiation', function() {
    it('should not be able to instantiate private key greater than N', function() {
      expect(function() {
        return new PrivateKey(Point.getN());
      }).to.throw('Number must be less than N');
    });

    it('should not be able to instantiate private key because of network mismatch', function() {
      expect(function() {
        return new PrivateKey('QPn542uVdzBgCfV6nEViShboFTpDd1at8mQpQugEQHgpuLbsgcZe', 'testnet');
      }).to.throw('Private key network mismatch');
    });

    it('should not be able to instantiate private key WIF is too long', function() {
      expect(function() {
        var buf = Base58Check.decode('QPn542uVdzBgCfV6nEViShboFTpDd1at8mQpQugEQHgpuLbsgcZe');
        var buf2 = Buffer.concat([buf, new Buffer(0x01)]);
        return new PrivateKey(buf2);
      }).to.throw('Length of buffer must be 33 (uncompressed) or 34 (compressed');
    });

    it('should not be able to instantiate private key WIF because of unknown network byte', function() {
      expect(function() {
        var buf = Base58Check.decode('QPn542uVdzBgCfV6nEViShboFTpDd1at8mQpQugEQHgpuLbsgcZe');
        var buf2 = Buffer.concat([new Buffer('ff', 'hex'), buf.slice(1, 33)]);
        return new PrivateKey(buf2);
      }).to.throw('Invalid network');
    });

    it('should not be able to instantiate private key WIF because of network mismatch', function() {
      expect(function(){
        var a = new PrivateKey(wifNamecoin, 'testnet');
      }).to.throw('Invalid network');
    });

    it('can be instantiated from a hex string', function() {
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var pubhex = '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc';
      var privkey = new PrivateKey(privhex);
      privkey.publicKey.toString().should.equal(pubhex);
    });

    it('should not be able to instantiate because of unrecognized data', function() {
      expect(function() {
        return new PrivateKey(new Error());
      }).to.throw('First argument is an unrecognized data type.');
    });

    it('should not be able to instantiate with unknown network', function() {
      expect(function() {
        return new PrivateKey(new BN(2), 'unknown');
      }).to.throw('Must specify the network ("livenet" or "testnet")');
    });

    it('should not create a zero private key', function() {
      expect(function() {
        var bn = new BN(0);
        return new PrivateKey(bn);
       }).to.throw(TypeError);
    });

    it('should create a livenet private key', function() {
      var privkey = new PrivateKey(BN.fromBuffer(buf), 'livenet');
      privkey.toWIF().should.equal(wifLivenet);
    });

    it('should create a default network private key', function() {
      // keep the original
      var network = Networks.defaultNetwork;
      Networks.defaultNetwork = Networks.livenet;
      var a = new PrivateKey(BN.fromBuffer(buf));
      a.network.should.equal(Networks.livenet);
      // change the default
      Networks.defaultNetwork = Networks.testnet;
      var b = new PrivateKey(BN.fromBuffer(buf));
      b.network.should.equal(Networks.testnet);
      // restore the default
      Networks.defaultNetwork = network;
    });

    it('returns the same instance if a PrivateKey is provided (immutable)', function() {
      var privkey = new PrivateKey();
      new PrivateKey(privkey).should.equal(privkey);
    });

  });

  describe('#json/object', function() {

    it('should input/output json', function() {
      var json = JSON.stringify({
        bn: '96c132224121b509b7d0a16245e957d9192609c5637c6228311287b1be21627a',
        compressed: false,
        network: 'livenet'
      });
      var key = PrivateKey.fromObject(JSON.parse(json));
      JSON.stringify(key).should.equal(json);
    });

    it('input json should correctly initialize network field', function() {
      ['livenet', 'testnet', 'mainnet'].forEach(function (net) {
        var pk = PrivateKey.fromObject({
          bn: '96c132224121b509b7d0a16245e957d9192609c5637c6228311287b1be21627a',
          compressed: false,
          network: net
        });
        pk.network.should.be.deep.equal(Networks.get(net));
      });
    });

    it('fails on invalid argument', function() {
      expect(function() {
        return PrivateKey.fromJSON('¹');
      }).to.throw();
    });

    it('also accepts an object as argument', function() {
      expect(function() {
        return PrivateKey.fromObject(new PrivateKey().toObject());
      }).to.not.throw();
    });
  });

  it('coverage: public key cache', function() {
    expect(function() {
      var privateKey = new PrivateKey();
      /* jshint unused: false */
      var publicKey = privateKey.publicKey;
      return privateKey.publicKey;
    }).to.not.throw();
  });

  describe('#toString', function() {

    it('should output this address correctly', function() {
      var privkey = PrivateKey.fromWIF(wifLivenetUncompressed);
      privkey.toWIF().should.equal(wifLivenetUncompressed);
    });

  });

  describe('#toAddress', function() {
    it('should output this known livenet address correctly', function() {
      var privkey = PrivateKey.fromWIF('QPn542uVdzBgCfV6nEViShboFTpDd1at8mQpQugEQHgpuLbsgcZe');
      var address = privkey.toAddress();
      address.toString().should.equal('DCx29gXPAwmivW6Jqew8TexRCea8nm3sn9');
    });

    it('should output this known testnet address correctly', function() {
      var privkey = PrivateKey.fromWIF('ckoubjh1yr1Hyg8NPtGwDz4tx91b6qztxrJZgTtdR4Ed9CqAV5cn');
      var address = privkey.toAddress();
      address.toString().should.equal('nhJN2PNne26sCwnLG5KjniqztzaGybs5Nz');
    });

    it('creates network specific address', function() {
      var pk = PrivateKey.fromWIF('ckoubjh1yr1Hyg8NPtGwDz4tx91b6qztxrJZgTtdR4Ed9CqAV5cn');
      pk.toAddress(Networks.livenet).network.name.should.equal(Networks.livenet.name);
      pk.toAddress(Networks.testnet).network.name.should.equal(Networks.testnet.name);
    });
  });

  describe('#inspect', function() {
    it('should output known livenet address for console', function() {
      var privkey = PrivateKey.fromWIF('QPn542uVdzBgCfV6nEViShboFTpDd1at8mQpQugEQHgpuLbsgcZe');
      privkey.inspect().should.equal(
        '<PrivateKey: 22b207aa76eb058876c667dc64ab8eeaa0a073bc018561c2463d438a0444b705, network: livenet>'
      );
    });

    it('should output known testnet address for console', function() {
      var privkey = PrivateKey.fromWIF('ckoubjh1yr1Hyg8NPtGwDz4tx91b6qztxrJZgTtdR4Ed9CqAV5cn');
      privkey.inspect().should.equal(
        '<PrivateKey: b50dc6e116f4f4ae8b05fa6cb197cdfd27bd0c61e1c53c1ca83fcb9b56d59a83, network: testnet>'
      );
    });

    it('outputs "uncompressed" for uncompressed imported WIFs', function() {
      var privkey = PrivateKey.fromWIF(wifLivenetUncompressed);
      privkey.inspect().should.equal('<PrivateKey: b538a4cc390ca5c29bf2cb06d5b851418aa2eef0e175e0b655dadcfd6b9f0284, network: livenet, uncompressed>');
    });
  });

  describe('#getValidationError', function(){
    it('should get an error because private key greater than N', function() {
      var n = Point.getN();
      var a = PrivateKey.getValidationError(n);
      a.message.should.equal('Number must be less than N');
    });

    it('should validate as false because private key greater than N', function() {
      var n = Point.getN();
      var a = PrivateKey.isValid(n);
      a.should.equal(false);
    });

    it('should recognize that undefined is an invalid private key', function() {
      PrivateKey.isValid().should.equal(false);
    });

    it('should validate as true', function() {
      var a = PrivateKey.isValid('QPn542uVdzBgCfV6nEViShboFTpDd1at8mQpQugEQHgpuLbsgcZe');
      a.should.equal(true);
    });

  });

  describe('buffer serialization', function() {
    it('returns an expected value when creating a PrivateKey from a buffer', function() {
      var privkey = new PrivateKey(BN.fromBuffer(buf), 'livenet');
      privkey.toString().should.equal(buf.toString('hex'));
    });

    it('roundtrips correctly when using toBuffer/fromBuffer', function() {
      var privkey = new PrivateKey(BN.fromBuffer(buf));
      var toBuffer = new PrivateKey(privkey.toBuffer());
      var fromBuffer = PrivateKey.fromBuffer(toBuffer.toBuffer());
      fromBuffer.toString().should.equal(privkey.toString());
    });

    it('should return buffer with length equal 32', function() {
      var bn = BN.fromBuffer(buf.slice(0, 31));
      var privkey = new PrivateKey(bn, 'livenet');
      var expected = Buffer.concat([ new Buffer([0]), buf.slice(0, 31) ]);
      privkey.toBuffer().toString('hex').should.equal(expected.toString('hex'));
    });
  });

  describe('#toBigNumber', function() {
    it('should output known BN', function() {
      var a = BN.fromBuffer(buf);
      var privkey = new PrivateKey(a, 'livenet');
      var b = privkey.toBigNumber();
      b.toString('hex').should.equal(a.toString('hex'));
    });
  });

  describe('#fromRandom', function() {

    it('should set bn gt 0 and lt n, and should be compressed', function() {
      var privkey = PrivateKey.fromRandom();
      privkey.bn.gt(new BN(0)).should.equal(true);
      privkey.bn.lt(Point.getN()).should.equal(true);
      privkey.compressed.should.equal(true);
    });

  });

  describe('#fromWIF', function() {

    it('should parse this compressed testnet address correctly', function() {
      var privkey = PrivateKey.fromWIF(wifLivenet);
      privkey.toWIF().should.equal(wifLivenet);
    });

  });

  describe('#toWIF', function() {

    it('should parse this compressed testnet address correctly', function() {
      var privkey = PrivateKey.fromWIF(wifTestnet);
      privkey.toWIF().should.equal(wifTestnet);
    });

  });

  describe('#fromString', function() {

    it('should parse this uncompressed testnet address correctly', function() {
      var privkey = PrivateKey.fromString(wifTestnetUncompressed);
      privkey.toWIF().should.equal(wifTestnetUncompressed);
    });

  });

  describe('#toString', function() {

    it('should parse this uncompressed livenet address correctly', function() {
      var privkey = PrivateKey.fromString(wifLivenetUncompressed);
      privkey.toString().should.equal("b538a4cc390ca5c29bf2cb06d5b851418aa2eef0e175e0b655dadcfd6b9f0284");
    });

  });

  describe('#toPublicKey', function() {

    it('should convert this known PrivateKey to known PublicKey', function() {
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var pubhex = '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc';
      var privkey = new PrivateKey(new BN(new Buffer(privhex, 'hex')));
      var pubkey = privkey.toPublicKey();
      pubkey.toString().should.equal(pubhex);
    });

    it('should have a "publicKey" property', function() {
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var pubhex = '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc';
      var privkey = new PrivateKey(new BN(new Buffer(privhex, 'hex')));
      privkey.publicKey.toString().should.equal(pubhex);
    });

    it('should convert this known PrivateKey to known PublicKey and preserve compressed=true', function() {
      var privwif = 'QPn542uVdzBgCfV6nEViShboFTpDd1at8mQpQugEQHgpuLbsgcZe';
      var privkey = new PrivateKey(privwif, 'livenet');
      var pubkey = privkey.toPublicKey();
      pubkey.compressed.should.equal(true);
    });

    it('should convert this known PrivateKey to known PublicKey and preserve compressed=false', function() {
      var privwif = '96fTvLn3vYVp3ztgSEJdH4LfUNUvNdGav8SGD1hzpuupXVQuEWm';
      var privkey = new PrivateKey(privwif, 'testnet');
      var pubkey = privkey.toPublicKey();
      pubkey.compressed.should.equal(false);
    });

  });

  it('creates an address as expected from WIF, livenet', function() {
    var privkey = new PrivateKey('QPn542uVdzBgCfV6nEViShboFTpDd1at8mQpQugEQHgpuLbsgcZe');
    privkey.publicKey.toAddress().toString().should.equal('DCx29gXPAwmivW6Jqew8TexRCea8nm3sn9');
  });

  it('creates an address as expected from WIF, testnet', function() {
    var privkey = new PrivateKey('ckrhHfB5k7NzVEqEsksYGvh2xSjZiT71oVGGSysP97bGMCkm3EgK');
    privkey.publicKey.toAddress().toString().should.equal('nZrAuK7RiTTwxxEAcik5BjyeJQy37xGUVE');
  });

});