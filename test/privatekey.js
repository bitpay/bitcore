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


  it('should create instance from BN', function() {
    var privkey1 = new PrivateKey();
    var privkey2 = new PrivateKey(privkey1.bn);
    privkey2.bn.should.equal(privkey1.bn);
    privkey2.compressed.should.equal(privkey1.compressed);
  });

  it('should create instance from String', function() {
    var privkey1 = new PrivateKey();
    var privkey2 = new PrivateKey(privkey1.toString());

    privkey2.bn.cmp(privkey2.bn).should.equal(0);
    privkey2.compressed.should.equal(privkey1.compressed);
  });

  it('should create instance from Buffer', function() {
    var privkey1 = new PrivateKey();
    var privkey2 = new PrivateKey(privkey1.toBuffer());

    privkey2.bn.cmp(privkey2.bn).should.equal(0);
    privkey2.compressed.should.equal(privkey1.compressed);
  });

  it('should create instance from JSON', function() {
    var privkey1 = new PrivateKey();
    var privkey2 = new PrivateKey(privkey1.toJSON());

    privkey2.bn.cmp(privkey2.bn).should.equal(0);
    privkey2.compressed.should.equal(privkey1.compressed);
  });

  it('should create instance from WIF', function() {
    var privkey1 = new PrivateKey();
    var privkey2 = new PrivateKey(privkey1.toWIF());

    privkey2.bn.cmp(privkey2.bn).should.equal(0);
    privkey2.compressed.should.equal(privkey1.compressed);
  });

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

  describe('bitcoind compliance', function() {
    validbase58.map(function(d){
      if (d[2].isPrivkey) {
        it('should instantiate WIF private key ' + d[0] + ' with correct properties', function() {
          var network = d[2].isTestnet ? Networks.testnet : Networks.livenet;
          var wif = new PrivateKey.fromWIF(d[0]);
          wif.privateKey.compressed.should.equal(d[2].isCompressed);
          wif.network.should.equal(network);
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

  it('should not be able to instantiate private key WIF is too long', function() {
    expect(function() {
      var buf = base58check.decode('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      var buf2 = Buffer.concat([buf, new Buffer(0x01)]);
      var wif = base58check.encode(buf2);
      var a = new PrivateKey(wif);
    }).to.throw('Length of buffer must be 33 (uncompressed) or 34 (compressed');
  });

  it('should not be able to instantiate private key WIF because of unknown network byte', function() {
    expect(function() {
      var buf = base58check.decode('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      var buf2 = Buffer.concat([new Buffer(0x01, 'hex'), buf.slice(1, 33)]);
      var wif = base58check.encode(buf2);
      var a = new PrivateKey(wif);
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

  it('should not create a zero private key', function() {
    expect(function() {
      var bn = BN(0);
      var privkey = new PrivateKey(bn);
     }).to.throw(TypeError);
  });

  describe('#json', function() {

    it('should input/output json', function() {
      var json = JSON.stringify({
        bn: '96c132224121b509b7d0a16245e957d9192609c5637c6228311287b1be21627a',
        compressed: false,
      });
      PrivateKey.fromJSON(json).toJSON().should.deep.equal(json);
    });

  });

  describe('#toString', function() {

    it('should output this private key correctly', function() {
      var privkey = PrivateKey();
      privkey.toString().should.equal(privkey.bn.toString('hex'));
    });

  });

  describe('#toAddress', function() {
    it('should output this known livenet address correctly', function() {
      var wif = PrivateKey.fromWIF('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m');
      var address = wif.privateKey.toAddress(wif.network);
      address.toString().should.equal('1A6ut1tWnUq1SEQLMr4ttDh24wcbJ5o9TT');
    });

    it('should output this known testnet address correctly', function() {
      var wif = PrivateKey.fromWIF('cR4qogdN9UxLZJXCNFNwDRRZNeLRWuds9TTSuLNweFVjiaE4gPaq');
      var address = wif.privateKey.toAddress(wif.network);
      address.toString().should.equal('mtX8nPZZdJ8d3QNLRJ1oJTiEi26Sj6LQXS');
    });

    it('should chain correctly', function() {
      var privkey = new PrivateKey();

      var liveAddress = privkey.toPublicKey().toAddress('livenet');
      privkey.toAddress('livenet').toString().should.equal(liveAddress.toString());

      var testAddress = privkey.toPublicKey().toAddress('testnet');
      privkey.toAddress('testnet').toString().should.equal(testAddress.toString());
    });

  });

  describe('#inspect', function() {
    it('should output known livenet address for console', function() {
      var privkey = PrivateKey.fromWIF('L3T1s1TYP9oyhHpXgkyLoJFGniEgkv2Jhi138d7R2yJ9F4QdDU2m').privateKey;
      privkey.inspect().should.equal('<PrivateKey: b9de6e778fe92aa7edb69395556f843f1dce0448350112e14906efc2a80fa61a>');
    });

    it('should output known testnet address for console', function() {
      var privkey = PrivateKey.fromWIF('cR4qogdN9UxLZJXCNFNwDRRZNeLRWuds9TTSuLNweFVjiaE4gPaq').privateKey;
      privkey.inspect().should.equal('<PrivateKey: 67fd2209ce4a95f6f1d421ab3fbea47ada13df11b73b30c4d9a9f78cc80651ac>');
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

    it('should parse this compressed livenet address correctly', function() {
      var wif = PrivateKey.fromWIF(enclivenet);
      wif.privateKey.compressed.should.be.true;
      wif.privateKey.toWIF('livenet').should.equal(enclivenet);
      wif.network.toString().should.equal('livenet');
    });

    it('should parse this compressed livenet address correctly', function() {
      var wif = PrivateKey.fromWIF(enctestnet);
      wif.privateKey.compressed.should.be.true;
      wif.privateKey.toWIF('testnet').should.equal(enctestnet);
      wif.network.toString().should.equal('testnet');
    });

    it('should parse this uncompressed livenet address correctly', function() {
      var wif = PrivateKey.fromWIF(encmu);
      wif.privateKey.compressed.should.be.false;
      wif.privateKey.toWIF('livenet').should.equal(encmu);
      wif.network.toString().should.equal('livenet');
    });

    it('should parse this uncompressed testnet address correctly', function() {
      var wif = PrivateKey.fromWIF(enctu);
      wif.privateKey.compressed.should.be.false;
      wif.privateKey.toWIF('testnet').should.equal(enctu);
      wif.network.toString().should.equal('testnet');
    });

  });

  describe('#fromString', function() {

    it('should parse this hex BN correctly', function() {
      var privkey = PrivateKey.fromString(hex);
      privkey.toString().should.equal(hex);
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
