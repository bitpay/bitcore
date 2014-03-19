'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var buffertools = require('buffertools');

var should = chai.should();

var testdata = testdata || require('./testdata');

var bignum = bitcore.bignum;
var base58 = bitcore.base58;
var base58Check = base58.base58Check;

var Address = bitcore.Address;
var networks = bitcore.networks;
var WalletKey = bitcore.WalletKey;

describe('Miscelaneous stuff', function() {
  it('should initialze the config object', function() {
    should.exist(bitcore.config);
  });
  it('should initialze the log object', function() {
    should.exist(bitcore.log);
  });
  it('should initialze the const object', function() {
    should.exist(bitcore.const);
  });
  it('should initialze the Deserialize object', function() {
    should.exist(bitcore.Deserialize);
    should.exist(bitcore.Deserialize.intFromCompact);
  });


  // bignum
  it('should initialze the bignum object', function() {
    should.exist(bitcore.bignum);
  });
  it('should create a bignum from string', function() {
    var n = bignum('9832087987979879879879879879879879879879879879');
    should.exist(n);
  });
  it('should perform basic math operations for bignum', function() {
    var b = bignum('782910138827292261791972728324982')
      .sub('182373273283402171237474774728373')
      .div(13);
    b.toNumber().should.equal(46195143503376160811884457968969);
  });

  // base58
  it('should initialze the base58 object', function() {
    should.exist(bitcore.base58);
  });
  it('should obtain the same string in base58 roundtrip', function() {
    var m = 'mqqa8xSMVDyf9QxihGnPtap6Mh6qemUkcu';
    base58.encode(base58.decode(m)).should.equal(m);
  });
  it('should obtain the same string in base58Check roundtrip', function() {
    var m = '1QCJj1gPZKx2EwzGo9Ri8mMBs39STvDYcv';
    base58Check.encode(base58Check.decode(m)).should.equal(m);
  });
  testdata.dataEncodeDecode.forEach(function(datum) {
    it('base58 encode/decode checks ' + datum, function() {
      // from bitcoin/bitcoin tests:
      // Goal: test low-level base58 encoding functionality
      base58.encode(new Buffer(datum[0], 'hex')).should.equal(datum[1]);
      buffertools.toHex(base58.decode(datum[1])).should.equal(datum[0]);
    });
  });
  testdata.dataBase58KeysValid.forEach(function(datum) {
    var b58 = datum[0];
    var hexPayload = datum[1];
    var meta = datum[2];
    var network = meta.isTestnet ? networks.testnet : networks.livenet;
    if (meta.isPrivkey) {
      describe('base58 private key valid ' + b58, function() {
        var k;
        var opts = {
          network: network
        };
        before(function() {
          k = new WalletKey(opts);
        });
        it('should generate correctly from WIF', function() {
          k.fromObj({
            priv: b58
          });
          should.exist(k.privKey);
        });
        it('should have compressed state', function() {
          k.privKey.compressed.should.equal(meta.isCompressed);
        });
        it('private key should have correct payload', function() {
          buffertools.toHex(k.privKey.private).should.equal(hexPayload);
        });
        it('should not be an Address', function() {
          new Address(b58).isValid().should.equal(false);
        });
        it('should generate correctly from hex', function() {
          var k2 = new WalletKey(opts);
          k2.fromObj({
            priv: hexPayload,
            compressed: meta.isCompressed
          });
          k2.storeObj().priv.should.equal(b58);
        });
      });
    } else {
      describe('base58 address valid ' + b58, function() {
        var a;
        var shouldBeScript = meta.addrType === 'script';
        before(function() {
          a = new Address(b58);
        });
        it('should be valid', function() {
          a.isValid().should.equal(true);
        });
        it('should be of correct type', function() {
          a.isScript().should.equal(shouldBeScript);
        });
        it('should get correct network', function() {
          a.network().should.equal(network);
        });
        it('should generate correctly from hex', function() {
          var version = shouldBeScript? network.addressScript: network.addressPubkey;
          var b = new Address(version, new Buffer(hexPayload, 'hex'));
          b.toString().should.equal(b58);
        });
      });
    }
  });

});
