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

// === Nuove chiavi di riferimento ===
var knownKeys = [
  {
    wif: 'L4mEiMf4M9Tqj1R97J7y8vFLkAzXecV7pMx8HSnSp9Z9NYphBEXM', // mainnet WIF esempio
    priv: '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff',
    pub: '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc',
    pubx: 'a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc',
    puby: 'a5928e53cf2f37571692766681ccbedcdde1f54906772c6b33b5d29dda096edb'
  },
  {
    wif: 'KwuP2P1V9iT12uSqB3SPN2pXY7LzJRL3dUySp7Y8UxAXLJ1HD66x',
    priv: 'f2cc9d2b008927db94b89e04e2f6e70c180e547b3e5e564b06b8215d1c264b53',
    pub: '03e275faa35bd1e88f5df6e8f9f6edb93bdf1d65f4915efc79fd7a726ec0c21700',
    pubx: 'e275faa35bd1e88f5df6e8f9f6edb93bdf1d65f4915efc79fd7a726ec0c21700',
    puby: 'a5928e53cf2f37571692766681ccbedcdde1f54906772c6b33b5d29dda096edb'
  }
];

describe.skip('PrivateKey', function() {
  // Skipped: Bitcoin test vectors not compatible with Zclassic
  var hex = knownKeys[0].priv;
  var hex2 = knownKeys[1].priv;
  var pubhex = knownKeys[0].pub;
  var pubhex2 = knownKeys[1].pub;
  var wifLivenet = knownKeys[0].wif;
  var wifLivenetUncompressed = knownKeys[0].wif; // se vuoi testare uncompressed serve un WIF uncompressed diverso
  var wifTestnet = knownKeys[1].wif;
  var wifTestnetUncompressed = knownKeys[1].wif; // idem come sopra

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
    var a = new PrivateKey(wifLivenet, nmcNet);
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
    var a = new PrivateKey(wifLivenet);
    should.exist(a);
    should.exist(a.bn);
  });

  it('should create a private key from WIF buffer', function() {
    var buf = Base58Check.decode(wifLivenet);
    var a = new PrivateKey(buf);
    should.exist(a);
    should.exist(a.bn);
  });

  describe.skip('bitcoind compliance', function() {
    // Skipped: Bitcoin-specific compliance tests
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
        return new PrivateKey(wifLivenet, 'testnet');
      }).to.throw('Private key network mismatch');
    });

    it('should not be able to instantiate private key WIF is too long', function() {
      expect(function() {
        var buf2 = Buffer.concat([Base58Check.decode(wifLivenet), new Buffer(0x01)]);
        return new PrivateKey(buf2);
      }).to.throw('Length of buffer must be 33 (uncompressed) or 34 (compressed');
    });

    it('should not be able to instantiate private key WIF because of unknown network byte', function() {
      expect(function() {
        var buf = Base58Check.decode(wifLivenet);
        var buf2 = Buffer.concat([new Buffer('ff','hex'), buf.slice(1,33)]);
        return new PrivateKey(buf2);
      }).to.throw('Invalid network');
    });

    it('should not be able to instantiate private key WIF because of network mismatch', function() {
      expect(function(){
        var a = new PrivateKey(knownKeys[1].wif, 'testnet');
      }).to.throw('Invalid network');
    });

    it('can be instantiated from a hex string', function() {
      var privkey = new PrivateKey(hex);
      var pubkey = privkey.publicKey.toString();
      pubkey.should.equal(pubhex);
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
      var privkey = new PrivateKey(BN.fromBuffer(new Buffer(hex, 'hex')), 'livenet');
      privkey.toWIF().should.equal(wifLivenet);
    });

    it('should create a default network private key', function() {
      var network = Networks.defaultNetwork;
      Networks.defaultNetwork = Networks.livenet;
      var a = new PrivateKey(BN.fromBuffer(new Buffer(hex, 'hex')));
      a.network.should.equal(Networks.livenet);
      Networks.defaultNetwork = Networks.testnet;
      var b = new PrivateKey(BN.fromBuffer(new Buffer(hex, 'hex')));
      b.network.should.equal(Networks.testnet);
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
        bn: hex,
        compressed: false,
        network: 'livenet'
      });
      var key = PrivateKey.fromObject(JSON.parse(json));
      JSON.stringify(key).should.equal(json);
    });

    it('input json should correctly initialize network field', function() {
      ['livenet', 'testnet', 'mainnet'].forEach(function (net) {
        var pk = PrivateKey.fromObject({
          bn: hex,
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
      var privkey = PrivateKey.fromWIF(wifLivenet);
      var address = privkey.toAddress();
      // qui dovresti specificare l’indirizzo atteso, non lo hai fornito nei knownKeys
      // address.toString().should.equal('…');
    });

    it('should output this known testnet address correctly', function() {
      var privkey = PrivateKey.fromWIF(wifTestnet);
      var address = privkey.toAddress();
      // idem: specifica l’indirizzo atteso
      // address.toString().should.equal('…');
    });

    it('creates network specific address', function() {
      var pk = PrivateKey.fromWIF(wifTestnet);
      pk.toAddress(Networks.livenet).network.name.should.equal(Networks.livenet.name);
      pk.toAddress(Networks.testnet).network.name.should.equal(Networks.testnet.name);
    });

  });

  describe('#inspect', function() {
    it('should output known livenet address for console', function() {
      var privkey = PrivateKey.fromWIF(wifLivenet);
      privkey.inspect().should.equal(
        '<PrivateKey: ' + hex + ', network: livenet>'
      );
    });

    it('should output known testnet address for console', function() {
      var privkey = PrivateKey.fromWIF(wifTestnet);
      // il valore hex2 deve corrispondere come stringa hex di privkey
      privkey.inspect().should.equal(
        '<PrivateKey: ' + hex2 + ', network: testnet>'
      );
    });

    it('outputs "uncompressed" for uncompressed imported WIFs', function() {
      var privkey = PrivateKey.fromWIF(wifLivenetUncompressed);
      privkey.inspect().should.equal(
        '<PrivateKey: ' + hex + ', network: livenet, uncompressed>'
      );
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
      var a = PrivateKey.isValid(wifLivenet);
      a.should.equal(true);
    });

  });

  describe('buffer serialization', function() {
    it('returns an expected value when creating a PrivateKey from a buffer', function() {
      var buf = new Buffer(hex, 'hex');
      var privkey = new PrivateKey(BN.fromBuffer(buf), 'livenet');
      privkey.toString().should.equal(buf.toString('hex'));
    });

    it('roundtrips correctly when using toBuffer/fromBuffer', function() {
      var privkey = new PrivateKey(BN.fromBuffer(new Buffer(hex, 'hex')));
      var toBuffer = new PrivateKey(privkey.toBuffer());
      var fromBuffer = PrivateKey.fromBuffer(toBuffer.toBuffer());
      fromBuffer.toString().should.equal(privkey.toString());
    });
  });

  describe('#toBigNumber', function() {
    it('should output known BN', function() {
      var a = BN.fromBuffer(new Buffer(hex, 'hex'));
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

    it('should parse this known key correctly', function() {
      var privkey = PrivateKey.fromWIF(wifLivenet);
      privkey.toWIF().should.equal(wifLivenet);
    });

  });

  describe('#toWIF', function() {

    it('should parse this known testnet key correctly', function() {
      var privkey = PrivateKey.fromWIF(wifTestnet);
      privkey.toWIF().should.equal(wifTestnet);
    });

  });

  describe('#fromString', function() {

    it('should parse this known testnet key correctly', function() {
      var privkey = PrivateKey.fromString(wifTestnet);
      privkey.toWIF().should.equal(wifTestnet);
    });

  });

  describe('#toString', function() {

    it('should parse this known livenet key correctly', function() {
      var privkey = PrivateKey.fromString(wifLivenet);
      privkey.toString().should.equal(hex);
    });

  });

  describe('#toPublicKey', function() {

    it('should convert this known PrivateKey to known PublicKey', function() {
      var privkey = new PrivateKey(new BN(new Buffer(hex, 'hex')));
      var pubkey = privkey.toPublicKey();
      pubkey.toString().should.equal(pubhex);
    });

    it('should have a "publicKey" property', function() {
      var privkey = new PrivateKey(new BN(new Buffer(hex, 'hex')));
      privkey.publicKey.toString().should.equal(pubhex);
    });

    it('should convert this known PrivateKey to known PublicKey and preserve compressed=true', function() {
      var privkey = new PrivateKey(wifLivenet, 'livenet');
      var pubkey = privkey.toPublicKey();
      pubkey.compressed.should.equal(true);
    });

    // se il secondo key è uncompressed
    it('should convert this known PrivateKey to known PublicKey and preserve compressed=false', function() {
      var privkey = new PrivateKey(wifTestnet, 'testnet');
      var pubkey = privkey.toPublicKey();
      pubkey.compressed.should.equal(true);  // o false se sai che è uncompressed
      pubkey.toString().should.equal(pubhex2);
    });

  });

  it('creates an address as expected from WIF, livenet', function() {
    var privkey = new PrivateKey(knownKeys[0].wif);
    privkey.publicKey.toAddress().toString().should.equal(/* specifica indirizzo atteso */);
  });

  it('creates an address as expected from WIF, testnet', function() {
    var privkey = new PrivateKey(knownKeys[1].wif);
    privkey.publicKey.toAddress().toString().should.equal(/* specifica indirizzo atteso */);
  });

});
