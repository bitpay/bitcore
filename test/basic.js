var assert = require('assert');
var fs = require('fs');

var Address = require('../Address').class();
var networks = require('../networks');

suite('basic');

function test_encode_priv(b58, payload, isTestnet)
{
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

function test_decode_priv(b58, payload, isTestnet)
{
}

function test_decode_pub(b58, payload, isTestnet, addrType)
{
	var isScript = (addrType == 'script');
	var network = isTestnet ? networks.testnet : networks.livenet;
	var version = isScript ? network.addressScript : network.addressPubkey;
	var buf = new Buffer(payload, 'hex');
	var addr = new Address(b58);

	assert.equal(version, addr.version());
	assert.equal(buf.toString(), addr.hash().toString());
}

function is_valid(datum)
{
	var b58 = datum[0];
	var payload = datum[1];
	var obj = datum[2];
	var isPrivkey = obj['isPrivkey'];
	var isTestnet = obj['isTestnet'];

	if (isPrivkey) {
		test_encode_priv(b58, payload, isTestnet);
		test_decode_priv(b58, payload, isTestnet);
	} else {
		var addrType = obj['addrType'];
		test_encode_pub(b58, payload, isTestnet, addrType);
		test_decode_pub(b58, payload, isTestnet, addrType);
	}
}

function is_invalid(datum)
{
}

var dataValid = JSON.parse(fs.readFileSync('test/base58_keys_valid.json'));
var dataInvalid = JSON.parse(fs.readFileSync('test/base58_keys_invalid.json'));

test('valid', function() {
	dataValid.forEach(function(datum) { is_valid(datum); });
});

test('invalid', function() {
	dataInvalid.forEach(function(datum) { is_invalid(datum); });
});

