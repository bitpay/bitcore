'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');
var should = chai.should();

var Address = bitcore.Address.class();
var PrivateKey = bitcore.PrivateKey.class();
var networks = bitcore.networks;
var KeyModule = bitcore.KeyModule;

var test_data = require('../browser/testdata');


function test_encode_priv(b58, payload, isTestnet, isCompressed) {
  var network = isTestnet ? networks.testnet : networks.livenet;
  var version = network.keySecret;

  var buf_pl = new Buffer(payload, 'hex');
  var buf;
  if (isCompressed) {
    buf = new Buffer(buf_pl.length + 1);
    buf_pl.copy(buf);
    buf[buf_pl.length] = 1;
  } else
    buf = buf_pl;

  var key = new KeyModule.Key();
  key.private = buf;
  key.compressed = isCompressed;

  var privkey = new PrivateKey(version, buf);
  privkey.toString().should.equal(b58);
}

function test_encode_pub(b58, payload, isTestnet, addrType) {
  var isScript = (addrType === 'script');
  var network = isTestnet ? networks.testnet : networks.livenet;
  var version = isScript ? network.addressScript : network.addressPubkey;
  var buf = new Buffer(payload, 'hex');
  var addr = new Address(version, buf);
  addr.toString().should.equal(b58);

}

function test_decode_priv(b58, payload, isTestnet, isCompressed) {
  var network = isTestnet ? networks.testnet : networks.livenet;
  var version = network.keySecret;

  var buf_pl = new Buffer(payload, 'hex');
  var buf;
  if (isCompressed) {
    buf = new Buffer(buf_pl.length + 1);
    buf_pl.copy(buf);
    buf[buf_pl.length] = 1;
  } else
    buf = buf_pl;

  var privkey = new PrivateKey(b58);
  version.should.equal(privkey.version());
  buf_pl.toString().should.equal(privkey.payload().toString());
}

function test_decode_pub(b58, payload, isTestnet, addrType) {
  var isScript = (addrType === 'script');
  var network = isTestnet ? networks.testnet : networks.livenet;
  var version = isScript ? network.addressScript : network.addressPubkey;
  var buf = new Buffer(payload, 'hex');
  var addr = new Address(b58);

  version.should.equal(addr.version());
  buf.toString().should.equal(addr.payload().toString());
}

function is_valid(datum) {
  var b58 = datum[0];
  var payload = datum[1];
  var obj = datum[2];
  var isPrivkey = obj.isPrivkey;
  var isTestnet = obj.isTestnet;

  if (isPrivkey) {
    var isCompressed = obj.isCompressed;
    test_encode_priv(b58, payload, isTestnet, isCompressed);
    test_decode_priv(b58, payload, isTestnet, isCompressed);
  } else {
    var addrType = obj.addrType;
    test_encode_pub(b58, payload, isTestnet, addrType);
    test_decode_pub(b58, payload, isTestnet, addrType);
  }
}

function is_invalid(datum) {
  if (datum.length < 1)
    throw new Error('Bad test');

  // ignore succeeding elements, as comments
  var b58 = datum[0];
  var privkey = new PrivateKey(b58);
  var addr = new Address(b58);

  var valid = true;
  try {
    privkey.validate();
    addr.validate();
  } catch (e) {
    valid = false;
  }
  valid.should.equal(false);
}

describe('Valid base58 keys', function() {
  test_data.dataValid.forEach(function(datum) {
    it('valid ' + datum[0], function() {
      is_valid(datum);
    });
  });
});

describe('Invalid base58 keys', function() {
  test_data.dataInvalid.forEach(function(datum) {
    it('invalid ' + datum, function() {
      is_invalid(datum);
    });
  });
});
