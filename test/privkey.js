'use strict';

var should = require('chai').should();
var bitcore = require('..');
var BN = bitcore.crypto.BN;
var Point = bitcore.crypto.Point;
var Privkey = bitcore.Privkey;
var base58check = bitcore.encoding.Base58Check;

describe('Privkey', function() {
  var hex = '96c132224121b509b7d0a16245e957d9192609c5637c6228311287b1be21627a';
  var buf = new Buffer(hex, 'hex');
  var enctestnet = 'cSdkPxkAjA4HDr5VHgsebAPDEh9Gyub4HK8UJr2DFGGqKKy4K5sG';
  var enctu = '92jJzK4tbURm1C7udQXxeCBvXHoHJstDXRxAMouPG1k1XUaXdsu';
  var encmainnet = 'L2Gkw3kKJ6N24QcDuH4XDqt9cTqsKTVNDGz1CRZhk9cq4auDUbJy';
  var encmu = '5JxgQaFM1FMd38cd14e3mbdxsdSa9iM2BV6DHBYsvGzxkTNQ7Un';

  it('should create a new random private key', function() {
    var a = new Privkey();
    should.exist(a);
    should.exist(a.bn);
    var b = Privkey();
    should.exist(b);
    should.exist(b.bn);
  });

  it('should create a private key from WIF string', function() {
    var a = new Privkey('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
    should.exist(a);
    should.exist(a.bn);
  });

  it('should create a private key from WIF buffer', function() {
    var a = new Privkey(base58check.decode('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m'));
    should.exist(a);
    should.exist(a.bn);
  });

  it('should not be able to instantiate private key greater than N', function() {
    (function() {
      var n = Point.getN();
      var a = new Privkey(n);
    }).should.throw('Number must be less than N');
  });

  it('should not be able to instantiate private key because of network mismatch', function() {
    (function() {
      var a = new Privkey('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m', 'testnet');
    }).should.throw('Private key network mismatch');
  });

  it('should not be able to instantiate private key because of compression mismatch', function() {
    (function() {
      var a = new Privkey('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m', 'mainnet', false);
    }).should.throw('Private key compression mismatch');
  });

  it('should not be able to instantiate private key WIF is too long', function() {
    (function() {
      var buf = base58check.decode('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      var buf2 = Buffer.concat([buf, new Buffer(0x01)]);
      var a = new Privkey(buf2);
    }).should.throw('Length of buffer must be 33 (uncompressed) or 34 (compressed');
  });

  it('should not be able to instantiate private key WIF because of unknown network byte', function() {
    (function() {
      var buf = base58check.decode('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      var buf2 = Buffer.concat([new Buffer(0x01, 'hex'), buf.slice(1, 33)]);
      var a = new Privkey(buf2);
    }).should.throw('Invalid network');
  });

  it('should not be able to instantiate because compressed is non-boolean', function() {
    (function() {
      var a = new Privkey(null, 'testnet', 'compressed');
    }).should.throw('Must specify whether the corresponding public key is compressed or not (true or false)');
  });

  it('should not be able to instantiate because of unrecognized data', function() {
    (function() {
      var a = new Privkey(new Error());
    }).should.throw('First argument is an unrecognized data type.');
  });

  it('should not be able to instantiate with unknown network', function() {
    (function() {
      var a = new Privkey(null, 'unknown');
    }).should.throw('Must specify the network ("mainnet" or "testnet")');
  });

  it('should create a 0 private key with this convenience method', function() {
    var bn = BN(0);
    var privkey = new Privkey(bn);
    privkey.bn.toString().should.equal(bn.toString());
  });

  it('should create a mainnet private key', function() {
    var privkey = new Privkey(BN.fromBuffer(buf), 'mainnet', true);
    privkey.toString().should.equal(encmainnet);
  });

  it('should create an uncompressed testnet private key', function() {
    var privkey = new Privkey(BN.fromBuffer(buf), 'testnet', false);
    privkey.toString().should.equal(enctu);
  });

  it('should create an uncompressed mainnet private key', function() {
    var privkey = new Privkey(BN.fromBuffer(buf), 'mainnet', false);
    privkey.toString().should.equal(encmu);
  });

  describe('#fromJSON', function() {

    it('should input this address correctly', function() {
      var privkey = Privkey.fromJSON(encmu);
      privkey.toWIF().should.equal(encmu);
    });

  });

  describe('#toString', function() {

    it('should output this address correctly', function() {
      var privkey = Privkey.fromJSON(encmu);
      privkey.toJSON().should.equal(encmu);
    });

  });

  describe('#toAddress', function() {
    it('should output this known mainnet address correctly', function() {
      var privkey = Privkey.fromWIF('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      var address = privkey.toAddress();
      address.toString().should.equal('1A6ut1tWnUq1SEQLMr4ttDh24wcbJ5o9TT');
    });

    it('should output this known testnet address correctly', function() {
      var privkey = Privkey.fromWIF('cR4qogdN9UxLZJXCNFNwDRRZNeLRWuds9TTSuLNweFVjiaE4gPaq');
      var address = privkey.toAddress();
      address.toString().should.equal('mtX8nPZZdJ8d3QNLRJ1oJTiEi26Sj6LQXS');
    });

  });

  describe('#inspect', function() {
    it('should output known mainnet address for console', function() {
      var privkey = Privkey.fromWIF('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      privkey.inspect().should.equal('<Privkey: L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m, compressed: true, network: mainnet>');
    });

    it('should output known testnet address for console', function() {
      var privkey = Privkey.fromWIF('cR4qogdN9UxLZJXCNFNwDRRZNeLRWuds9TTSuLNweFVjiaE4gPaq');
      privkey.inspect().should.equal('<Privkey: cR4qogdN9UxLZJXCNFNwDRRZNeLRWuds9TTSuLNweFVjiaE4gPaq, compressed: true, network: testnet>');
    });

  });

  describe('#getValidationError', function(){
    it('should get an error because private key greater than N', function() {
      var n = Point.getN();
      var a = Privkey.getValidationError(n);
      a.message.should.equal('Number must be less than N');
    });

    it('should validate as false because private key greater than N', function() {
      var n = Point.getN();
      var a = Privkey.isValid(n);
      a.should.equal(false);
    });

    it('should validate as true', function() {
      var a = Privkey.isValid('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      a.should.equal(true);
    });

  });

  describe('#toBuffer', function() {
    it('should output known buffer', function() {
      var privkey = new Privkey(BN.fromBuffer(buf), 'mainnet', true);
      var b = privkey.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });
  });

  describe('#toBigNumber', function() {
    it('should output known BN', function() {
      var a = BN.fromBuffer(buf);
      var privkey = new Privkey(a, 'mainnet', true);
      var b = privkey.toBigNumber();
      b.toString('hex').should.equal(a.toString('hex'));
    });
  });

  describe('#fromRandom', function() {

    it('should set bn gt 0 and lt n, and should be compressed', function() {
      var privkey = Privkey.fromRandom();
      privkey.bn.gt(BN(0)).should.equal(true);
      privkey.bn.lt(Point.getN()).should.equal(true);
      privkey.compressed.should.equal(true);
    });

  });

  describe('#fromWIF', function() {

    it('should parse this compressed testnet address correctly', function() {
      var privkey = Privkey.fromWIF(encmainnet);
      privkey.toWIF().should.equal(encmainnet);
    });

  });

  describe('#toWIF', function() {

    it('should parse this compressed testnet address correctly', function() {
      var privkey = Privkey.fromWIF(enctestnet);
      privkey.toWIF().should.equal(enctestnet);
    });

  });

  describe('#fromString', function() {

    it('should parse this uncompressed testnet address correctly', function() {
      var privkey = Privkey.fromString(enctu);
      privkey.toWIF().should.equal(enctu);
    });

  });

  describe('#toString', function() {

    it('should parse this uncompressed mainnet address correctly', function() {
      var privkey = Privkey.fromString(encmu);
      privkey.toString().should.equal(encmu);
    });

  });

  describe("#toPubkey", function() {

    it('should convert this known Privkey to known Pubkey', function() {
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var pubhex = '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc';
      var privkey = new Privkey(BN(new Buffer(privhex, 'hex')));
      var pubkey = privkey.toPubkey();
      pubkey.toString().should.equal(pubhex);
    });

    it('should convert this known Privkey to known Pubkey and preserve compressed=true', function() {
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var privkey = new Privkey(BN(new Buffer(privhex, 'hex')));
      privkey.compressed = true;
      var pubkey = privkey.toPubkey();
      pubkey.compressed.should.equal(true);
    });

    it('should convert this known Privkey to known Pubkey and preserve compressed=true', function() {
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var privkey = new Privkey(BN(new Buffer(privhex, 'hex')));
      privkey.compressed = false;
      var pubkey = privkey.toPubkey();
      pubkey.compressed.should.equal(false);
    });

  });

});
