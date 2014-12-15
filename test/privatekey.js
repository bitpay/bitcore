'use strict';

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

var bitcore = require('..');
var BN = bitcore.crypto.BN;
var Point = bitcore.crypto.Point;
var PrivateKey = bitcore.PrivateKey;
var Networks = bitcore.Networks;
var base58check = bitcore.encoding.Base58Check;

var validbase58 = require('./data/bitcoind/base58_keys_valid.json');
var invalidbase58 = require('./data/bitcoind/base58_keys_invalid.json');

describe('PrivateKey', function() {
  var hex = '96c132224121b509b7d0a16245e957d9192609c5637c6228311287b1be21627a';
  var buf = new Buffer(hex, 'hex');
  var enctestnet = 'cSdkPxkAjA4HDr5VHgsebAPDEh9Gyub4HK8UJr2DFGGqKKy4K5sG';
  var enctu = '92jJzK4tbURm1C7udQXxeCBvXHoHJstDXRxAMouPG1k1XUaXdsu';
  var enclivenet = 'L2Gkw3kKJ6N24QcDuH4XDqt9cTqsKTVNDGz1CRZhk9cq4auDUbJy';
  var encmu = '5JxgQaFM1FMd38cd14e3mbdxsdSa9iM2BV6DHBYsvGzxkTNQ7Un';

  it('should create a new random private key', function() {
    var a = new PrivateKey();
    should.exist(a);
    should.exist(a.bn);
    var b = PrivateKey();
    should.exist(b);
    should.exist(b.bn);
  });

  it('should create a private key from WIF string', function() {
    var a = new PrivateKey('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
    should.exist(a);
    should.exist(a.bn);
  });

  it('should create a private key from WIF buffer', function() {
    var a = new PrivateKey(base58check.decode('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m'));
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

  it('should not be able to instantiate private key greater than N', function() {
    expect(function() {
      var n = Point.getN();
      var a = new PrivateKey(n);
    }).to.throw('Number must be less than N');
  });

  it('should not be able to instantiate private key because of network mismatch', function() {
    expect(function() {
      var a = new PrivateKey('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m', 'testnet');
    }).to.throw('Private key network mismatch');
  });

  it('should not be able to instantiate private key WIF is too long', function() {
    expect(function() {
      var buf = base58check.decode('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      var buf2 = Buffer.concat([buf, new Buffer(0x01)]);
      var a = new PrivateKey(buf2);
    }).to.throw('Length of buffer must be 33 (uncompressed) or 34 (compressed');
  });

  it('should not be able to instantiate private key WIF because of unknown network byte', function() {
    expect(function() {
      var buf = base58check.decode('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      var buf2 = Buffer.concat([new Buffer(0x01, 'hex'), buf.slice(1, 33)]);
      var a = new PrivateKey(buf2);
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
      var a = new PrivateKey(new Error());
    }).to.throw('First argument is an unrecognized data type.');
  });

  it('should not be able to instantiate with unknown network', function() {
    expect(function() {
      var a = new PrivateKey(BN(2), 'unknown');
    }).to.throw('Must specify the network ("livenet" or "testnet")');
  });

  it('should not create a zero private key', function() {
    expect(function() {
      var bn = BN(0);
      var privkey = new PrivateKey(bn);
     }).to.throw(TypeError);
  });

  it('should create a livenet private key', function() {
    var privkey = new PrivateKey(BN.fromBuffer(buf), 'livenet');
    privkey.toString().should.equal(enclivenet);
  });

  it('should create a default network private key', function() {
    var a = new PrivateKey(BN.fromBuffer(buf));
    a.network.should.equal(Networks.livenet);
    // change the default
    Networks.defaultNetwork = Networks.testnet;
    var b = new PrivateKey(BN.fromBuffer(buf));
    b.network.should.equal(Networks.testnet);
    // restore the default
    Networks.defaultNetwork = Networks.livenet;
  });

  describe('#json', function() {

    it('should input/output json', function() {
      var json = JSON.stringify({
        bn: '96c132224121b509b7d0a16245e957d9192609c5637c6228311287b1be21627a',
        compressed: false,
        network: 'livenet'
      });
      PrivateKey.fromJSON(json).toJSON().should.deep.equal(json);
    });

  });

  describe('#toString', function() {

    it('should output this address correctly', function() {
      var privkey = PrivateKey.fromWIF(encmu);
      privkey.toString().should.equal(encmu);
    });

  });

  describe('#toAddress', function() {
    it('should output this known livenet address correctly', function() {
      var privkey = PrivateKey.fromWIF('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      var address = privkey.toAddress();
      address.toString().should.equal('1A6ut1tWnUq1SEQLMr4ttDh24wcbJ5o9TT');
    });

    it('should output this known testnet address correctly', function() {
      var privkey = PrivateKey.fromWIF('cR4qogdN9UxLZJXCNFNwDRRZNeLRWuds9TTSuLNweFVjiaE4gPaq');
      var address = privkey.toAddress();
      address.toString().should.equal('mtX8nPZZdJ8d3QNLRJ1oJTiEi26Sj6LQXS');
    });

  });

  describe('#inspect', function() {
    it('should output known livenet address for console', function() {
      var privkey = PrivateKey.fromWIF('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      privkey.inspect().should.equal('<PrivateKey: L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m, network: livenet>');
    });

    it('should output known testnet address for console', function() {
      var privkey = PrivateKey.fromWIF('cR4qogdN9UxLZJXCNFNwDRRZNeLRWuds9TTSuLNweFVjiaE4gPaq');
      privkey.inspect().should.equal('<PrivateKey: cR4qogdN9UxLZJXCNFNwDRRZNeLRWuds9TTSuLNweFVjiaE4gPaq, network: testnet>');
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

    it('should validate as true', function() {
      var a = PrivateKey.isValid('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      a.should.equal(true);
    });

  });

  describe('#toBuffer', function() {
    it('should output known buffer', function() {
      var privkey = new PrivateKey(BN.fromBuffer(buf), 'livenet');
      var b = privkey.toBuffer().toString('hex').should.equal(buf.toString('hex'));
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
      privkey.bn.gt(BN(0)).should.equal(true);
      privkey.bn.lt(Point.getN()).should.equal(true);
      privkey.compressed.should.equal(true);
    });

  });

  describe('#fromWIF', function() {

    it('should parse this compressed testnet address correctly', function() {
      var privkey = PrivateKey.fromWIF(enclivenet);
      privkey.toWIF().should.equal(enclivenet);
    });

  });

  describe('#toWIF', function() {

    it('should parse this compressed testnet address correctly', function() {
      var privkey = PrivateKey.fromWIF(enctestnet);
      privkey.toWIF().should.equal(enctestnet);
    });

  });

  describe('#fromString', function() {

    it('should parse this uncompressed testnet address correctly', function() {
      var privkey = PrivateKey.fromString(enctu);
      privkey.toWIF().should.equal(enctu);
    });

  });

  describe('#toString', function() {

    it('should parse this uncompressed livenet address correctly', function() {
      var privkey = PrivateKey.fromString(encmu);
      privkey.toString().should.equal(encmu);
    });

  });

  describe("#toPublicKey", function() {

    it('should convert this known PrivateKey to known PublicKey', function() {
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var pubhex = '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc';
      var privkey = new PrivateKey(BN(new Buffer(privhex, 'hex')));
      var pubkey = privkey.toPublicKey();
      pubkey.toString().should.equal(pubhex);
    });

    it('should have a "publicKey" property', function() {
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var pubhex = '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc';
      var privkey = new PrivateKey(BN(new Buffer(privhex, 'hex')));
      privkey.publicKey.toString().should.equal(pubhex);
    });

    it('should convert this known PrivateKey to known PublicKey and preserve compressed=true', function() {
      var privwif = 'L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m';
      var privkey = new PrivateKey(privwif, 'livenet');
      var pubkey = privkey.toPublicKey();
      pubkey.compressed.should.equal(true);
    });

    it('should convert this known PrivateKey to known PublicKey and preserve compressed=false', function() {
      var privwif = '92jJzK4tbURm1C7udQXxeCBvXHoHJstDXRxAMouPG1k1XUaXdsu';
      var privkey = new PrivateKey(privwif, 'testnet');
      var pubkey = privkey.toPublicKey();
      pubkey.compressed.should.equal(false);
    });

  });

});
