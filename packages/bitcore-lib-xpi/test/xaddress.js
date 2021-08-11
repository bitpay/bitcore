'use strict';

/* jshint maxstatements: 30 */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

var bitcore = require('..');
var XAddress = bitcore.XAddress;
var Address = bitcore.Address;

var validLotusAddresses = require('./data/lotusd/lotus_addresses_valid.json');

describe('XAddress', function () {
  it('can\'t build without data', function () {
    (function () {
      return new XAddress();
    }).should.throw('First argument is required, please include address data.');
  });

  it('should throw an error because of bad network param', function () {
    (function () {
      return new XAddress(PKHLivenet[0], 'main', 'pubkeyhash');
    }).should.throw('Second argument must be "livenet", "testnet", or "regtest".');
  });

  it('should throw an error because of bad type param', function () {
    (function () {
      return new XAddress(PKHLivenet[0], 'livenet', 'pubkey');
    }).should.throw('Third argument must be "pubkeyhash" or "scripthash"');
  });

  describe('lotusd compliance', function () {
    // Spec: https://givelotus.org/docs/specs/lotus/addresses/
    var token = 'lotus';
    validLotusAddresses.map(function (d) {
      if (!d[2].isPrivkey) {
        it('should describe address ' + d[0] + ' as valid', function () {
          var type;
          if (d[2].addrType === 'script') {
            type = 'scripthash';
          } else if (d[2].addrType === 'pubkey') {
            type = 'pubkeyhash';
          }
          var network = 'livenet';
          return new XAddress(d[0], network, type, token);
        });
      };
    });
  });

  describe('Xaddr', function () {
    var t = [
      ['1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu', 'lotus_16PSJLk9W86KAZp26x3uM176w6N9vUU8YNQQnQTHN', 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a'],
      ['1KXrWXciRDZUpQwQmuM1DbwsKDLYAYsVLR', 'lotus_16PSJPLVnkMvbURPjfPGZqdrUhzwYJSAxJiXVcfKs', 'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy'],
      ['16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb', 'lotus_16PSJH9TW2pmsvYLZYMLuASKMuzHk8p7FYaka2pzR', 'bitcoincash:qqq3728yw0y47sqn6l2na30mcw6zm78dzqre909m2r'],
      ['3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC', 'lotus_1PrQz5R11Ae1YcbvUpGDSvzPP2GsVw6E7mthMV', 'bitcoincash:ppm2qsznhks23z7629mms6s4cwef74vcwvn0h829pq'],
      ['3LDsS579y7sruadqu11beEJoTjdFiFCdX4', 'lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og', 'bitcoincash:pr95sy3j9xwd2ap32xkykttr4cvcu7as4yc93ky28e'],
      ['31nwvkZwyPdgzjBJZXfDmSWsC4ZLKpYyUw', 'lotus_1PrQAo6rZSfDwo8R6V8YnEkyjShiWqMuE6M6GV', 'bitcoincash:pqq3728yw0y47sqn6l2na30mcw6zm78dzq5ucqzc37'],
    ];

    t.forEach(function(value, index) {
      var xaddr = value[1];
      var cashaddr = value[2];
      it('should convert ' + cashaddr, function() {
        var a = new Address(cashaddr);
        a.toXAddress().should.equal(xaddr);
      });
    });

    t.forEach(function(value, index) {
      var xaddr = value[1];
      var legacyaddr = value[0];
      it('should convert ' + legacyaddr, function() {
        var a = new Address(legacyaddr);
        a.toXAddress().should.equal(xaddr);
      });
    });

    t.forEach(function(value, index) {
      var xaddr = value[1];
      var legacyaddr = value[0];
      it('should convert ' + xaddr, function() {
        var x = new Address.fromString(xaddr);
        x.toLegacyAddress().should.equal(legacyaddr);
      });
    });
  })
});


// livenet valid
var PKHLivenet = [
  'lotus_16PSJLU8JZYUeX4zXKZaqgiNydLS7gnMjFqxpSvgh',
  'lotus_16PSJLAnW8mGTjVPD77XqyFerQnfmsnppwRUFLmKi',
  'lotus_16PSJLVL2rbKjpbKxeWbJwCDE5fLq2bQPYsvyMMxM',
  'lotus_16PSJLRch2sEyPjCTnGAhPoBqFSJm33ojztCprQyD',
  '    	lotus_16PSJKhyjfZzUQf1X9N5uA9LWTXW7KNRLwDAku8W1   \t\n'
];

// livenet p2sh
var P2SHLivenet = [
  'lotus_1PrQLfg4ML5C4xiVgiXfNmx8VoqCzjjPTYN2Px',
  '33vt8ViH5jsr115AGkW6cEmEz9MpvJSwDk',
  '37Sp6Rv3y4kVd1nQ1JV5pfqXccHNyZm1x3',
  '3QjYXhTkvuj8qPaXHTTWb5wjXhdsLAAWVy',
  '\t3QjYXhTkvuj8qPaXHTTWb5wjXhdsLAAWVy \n \r'
];

// testnet p2sh
var P2SHTestnet = [
  'validbase58',
  '2NEWDzHWwY5ZZp8CQWbB7ouNMLqCia6YRda',
  '2MxgPqX1iThW3oZVk9KoFcE5M4JpiETssVN',
  '2NB72XtkjpnATMggui83aEtPawyyKvnbX2o'
];