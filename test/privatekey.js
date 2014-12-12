'use strict';

var should = require('chai').should();
var bitcore = require('..');
var BN = bitcore.crypto.BN;
var Point = bitcore.crypto.Point;
var PrivateKey = bitcore.PrivateKey;
var Networks = bitcore.Networks;
var base58check = bitcore.encoding.Base58Check;

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

  it('should not be able to instantiate private key greater than N', function() {
    (function() {
      var n = Point.getN();
      var a = new PrivateKey(n);
    }).should.throw('Number must be less than N');
  });

  it('should not be able to instantiate private key because of network mismatch', function() {
    (function() {
      var a = new PrivateKey('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m', 'testnet');
    }).should.throw('Private key network mismatch');
  });

  it('should not be able to instantiate private key because of compression mismatch', function() {
    (function() {
      var a = new PrivateKey('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m', 'livenet', false);
    }).should.throw('Private key compression mismatch');
  });

  it('should not be able to instantiate private key WIF is too long', function() {
    (function() {
      var buf = base58check.decode('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      var buf2 = Buffer.concat([buf, new Buffer(0x01)]);
      var a = new PrivateKey(buf2);
    }).should.throw('Length of buffer must be 33 (uncompressed) or 34 (compressed');
  });

  it('should not be able to instantiate private key WIF because of unknown network byte', function() {
    (function() {
      var buf = base58check.decode('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      var buf2 = Buffer.concat([new Buffer(0x01, 'hex'), buf.slice(1, 33)]);
      var a = new PrivateKey(buf2);
    }).should.throw('Invalid network');
  });

  it('can be instantiated from a hex string', function() {
    var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
    var pubhex = '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc';
    var privkey = new PrivateKey(privhex);
    privkey.publicKey.toString().should.equal(pubhex);
  });

  it('should not be able to instantiate because compressed is non-boolean', function() {
    (function() {
      var a = new PrivateKey(null, 'testnet', 'compressed');
    }).should.throw('Must specify whether the corresponding public key is compressed or not (true or false)');
  });

  it('should not be able to instantiate because of unrecognized data', function() {
    (function() {
      var a = new PrivateKey(new Error());
    }).should.throw('First argument is an unrecognized data type.');
  });

  it('should not be able to instantiate with unknown network', function() {
    (function() {
      var a = new PrivateKey(null, 'unknown');
    }).should.throw('Must specify the network ("livenet" or "testnet")');
  });

  it('should create a 0 private key with this convenience method', function() {
    var bn = BN(0);
    var privkey = new PrivateKey(bn);
    privkey.bn.toString().should.equal(bn.toString());
  });

  it('should create a livenet private key', function() {
    var privkey = new PrivateKey(BN.fromBuffer(buf), 'livenet', true);
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

  it('should create an uncompressed testnet private key', function() {
    var privkey = new PrivateKey(BN.fromBuffer(buf), 'testnet', false);
    privkey.toString().should.equal(enctu);
  });

  it('should create an uncompressed livenet private key', function() {
    var privkey = new PrivateKey(BN.fromBuffer(buf), 'livenet', false);
    privkey.toString().should.equal(encmu);
  });

  describe('#json', function() {

    it('should input/output json', function() {
      var json = {
        bn: '96c132224121b509b7d0a16245e957d9192609c5637c6228311287b1be21627a',
        compressed: false,
        network: 'livenet'
      };
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
      privkey.inspect().should.equal('<PrivateKey: L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m, compressed: true, network: livenet>');
    });

    it('should output known testnet address for console', function() {
      var privkey = PrivateKey.fromWIF('cR4qogdN9UxLZJXCNFNwDRRZNeLRWuds9TTSuLNweFVjiaE4gPaq');
      privkey.inspect().should.equal('<PrivateKey: cR4qogdN9UxLZJXCNFNwDRRZNeLRWuds9TTSuLNweFVjiaE4gPaq, compressed: true, network: testnet>');
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
      var privkey = new PrivateKey(BN.fromBuffer(buf), 'livenet', true);
      var b = privkey.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });
  });

  describe('#toBigNumber', function() {
    it('should output known BN', function() {
      var a = BN.fromBuffer(buf);
      var privkey = new PrivateKey(a, 'livenet', true);
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
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var privkey = new PrivateKey(BN(new Buffer(privhex, 'hex')), 'livenet', true);
      var pubkey = privkey.toPublicKey();
      pubkey.compressed.should.equal(true);
    });

    it('should convert this known PrivateKey to known PublicKey and preserve compressed=true', function() {
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var privkey = new PrivateKey(BN(new Buffer(privhex, 'hex')), 'livenet', false);
      var pubkey = privkey.toPublicKey();
      pubkey.compressed.should.equal(false);
    });

  });

});
