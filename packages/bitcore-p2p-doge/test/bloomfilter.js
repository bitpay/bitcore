'use strict';

const chai = require('chai');
const assert = require('assert');
const bitcore = require('@bitpay-labs/bitcore-lib-doge');
const Data = require('./data/messages');
const P2P = require('../');

const should = chai.should();
const BloomFilter = P2P.BloomFilter;

function getPayloadBuffer(messageBuffer) {
  return Buffer.from(messageBuffer.slice(48), 'hex');
}

// convert a hex string to a bytes buffer
function ParseHex(str) {
  const result = [];
  while (str.length >= 2) {
    result.push(parseInt(str.substring(0, 2), 16));
    str = str.substring(2, str.length);
  }
  const buf = Buffer.from(result);
  return buf;
}

describe('BloomFilter', function() {

  it('#fromBuffer and #toBuffer round trip', function() {
    const testPayloadBuffer = getPayloadBuffer(Data.filterload.message);
    const filter = new BloomFilter.fromBuffer(testPayloadBuffer);
    filter.toBuffer().should.deep.equal(testPayloadBuffer);
  });

  // test data from: https://github.com/bitcoin/bitcoin/blob/master/src/test/bloom_tests.cpp

  it('serialize filter with public keys added', function() {

    const privateKey = bitcore.PrivateKey.fromWIF('QWgwfQXN1gD4grk6maDyNZm9kqAJoodPniGsdiS7ibCiqd4g9sMq');
    const publicKey = privateKey.toPublicKey();
    const filter = BloomFilter.create(2, 0.001, 0, BloomFilter.BLOOM_UPDATE_ALL);
    filter.insert(publicKey.toBuffer());
    filter.insert(bitcore.crypto.Hash.sha256ripemd160(publicKey.toBuffer()));

    const expectedFilter = BloomFilter.fromBuffer(ParseHex('0382e3b3080000000000000001'));
    filter.toBuffer().should.deep.equal(expectedFilter.toBuffer());

  });

  it('serialize to a buffer', function() {

    const filter = BloomFilter.create(3, 0.01, 0, BloomFilter.BLOOM_UPDATE_ALL);

    filter.insert(ParseHex('99108ad8ed9bb6274d3980bab5a85c048f0950c8'));
    assert(filter.contains(ParseHex('99108ad8ed9bb6274d3980bab5a85c048f0950c8')));
    // one bit different in first byte
    assert(!filter.contains(ParseHex('19108ad8ed9bb6274d3980bab5a85c048f0950c8')));
    filter.insert(ParseHex('b5a2c786d9ef4658287ced5914b37a1b4aa32eee'));
    assert(filter.contains(ParseHex('b5a2c786d9ef4658287ced5914b37a1b4aa32eee')));
    filter.insert(ParseHex('b9300670b4c5366e95b2699e8b18bc75e5f729c5'));
    assert(filter.contains(ParseHex('b9300670b4c5366e95b2699e8b18bc75e5f729c5')));

    const actual = filter.toBuffer();
    const expected = Buffer.from('03614e9b050000000000000001', 'hex');

    actual.should.deep.equal(expected);
  });

  it('deserialize a buffer', function() {

    const buffer = Buffer.from('03614e9b050000000000000001', 'hex');
    const filter = BloomFilter.fromBuffer(buffer);

    assert(filter.contains(ParseHex('99108ad8ed9bb6274d3980bab5a85c048f0950c8')));
    assert(!filter.contains(ParseHex('19108ad8ed9bb6274d3980bab5a85c048f0950c8')));
    assert(filter.contains(ParseHex('b5a2c786d9ef4658287ced5914b37a1b4aa32eee')));
    assert(filter.contains(ParseHex('b9300670b4c5366e95b2699e8b18bc75e5f729c5')));
  });

  it('#toBuffer and #fromBuffer round trip, with a large filter', function() {
    const filter = BloomFilter.create(10000, 0.001);
    const buffer = filter.toBuffer();
    new BloomFilter.fromBuffer(buffer).should.deep.equal(filter);
  });

});
