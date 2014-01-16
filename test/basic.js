var assert = require('assert');
var fs = require('fs');

var Address = require('../Address').class();
var PrivateKey = require('../PrivateKey').class();
var networks = require('../networks');
var KeyModule = require('../Key');

suite('basic');

function test_encode_priv(b58, payload, isTestnet, isCompressed)
{
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
  assert.equal(privkey.toString(), b58);
}

function test_encode_pub(b58, payload, isTestnet, addrType)
{
  var isScript = (addrType == 'script');
  var network = isTestnet ? networks.testnet : networks.livenet;
  var version = isScript ? network.addressScript : network.addressPubkey;
  var buf = new Buffer(payload, 'hex');
  var addr = new Address(version, buf);
  assert.equal(addr.toString(), b58);
}

function test_decode_priv(b58, payload, isTestnet, isCompressed)
{
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
  assert.equal(version, privkey.version());
  assert.equal(buf_pl.toString(), privkey.payload().toString());
}

function test_decode_pub(b58, payload, isTestnet, addrType)
{
  var isScript = (addrType == 'script');
  var network = isTestnet ? networks.testnet : networks.livenet;
  var version = isScript ? network.addressScript : network.addressPubkey;
  var buf = new Buffer(payload, 'hex');
  var addr = new Address(b58);

  assert.equal(version, addr.version());
  assert.equal(buf.toString(), addr.payload().toString());
}

function is_valid(datum)
{
  var b58 = datum[0];
  var payload = datum[1];
  var obj = datum[2];
  var isPrivkey = obj['isPrivkey'];
  var isTestnet = obj['isTestnet'];

  if (isPrivkey) {
    var isCompressed = obj['isCompressed'];
    test_encode_priv(b58, payload, isTestnet, isCompressed);
    test_decode_priv(b58, payload, isTestnet, isCompressed);
  } else {
    var addrType = obj['addrType'];
    test_encode_pub(b58, payload, isTestnet, addrType);
    test_decode_pub(b58, payload, isTestnet, addrType);
  }
}

function is_invalid(datum)
{
  if (datum.length < 1)
    throw new Error("Bad test");
  
  // ignore succeeding elements, as comments
  var b58 = datum[0];
  var privkey = new PrivateKey(b58);
  var addr = new Address(b58);

  var valid = true;
  try {
    privkey.validate();
    addr.validate();
  } catch(e) {
    valid = false;
  }
  assert.equal(valid, false);
}

var dataValid = JSON.parse(fs.readFileSync('test/base58_keys_valid.json'));
var dataInvalid = JSON.parse(fs.readFileSync('test/base58_keys_invalid.json'));
var dataValues = JSON.parse(fs.readFileSync('test/values.json'));

describe('valid base58 keys', function(){
  test('valid', function() {
    dataValid.forEach(function(datum) { is_valid(datum); });
  });
});

describe('invalid base58 keys', function(){
  test('invalid', function() {
    dataInvalid.forEach(function(datum) { is_invalid(datum); });
  });
});


