'use strict';

var chai = chai || require('chai');
var should = chai.should();
var bitcore = bitcore || require('../bitcore');
var BIP32 = bitcore.BIP32;

describe('BIP32', function() {

  //test vectors: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
  var vector1_master = '000102030405060708090a0b0c0d0e0f';
  var vector1_m_public = 'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8'
  var vector1_m_private = 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi';
  var vector1_m0h_public = 'xpub68Gmy5EdvgibQVfPdqkBBCHxA5htiqg55crXYuXoQRKfDBFA1WEjWgP6LHhwBZeNK1VTsfTFUHCdrfp1bgwQ9xv5ski8PX9rL2dZXvgGDnw';
  var vector1_m0h_private = 'xprv9uHRZZhk6KAJC1avXpDAp4MDc3sQKNxDiPvvkX8Br5ngLNv1TxvUxt4cV1rGL5hj6KCesnDYUhd7oWgT11eZG7XnxHrnYeSvkzY7d2bhkJ7';
  var vector1_m0h1_public = 'xpub6ASuArnXKPbfEwhqN6e3mwBcDTgzisQN1wXN9BJcM47sSikHjJf3UFHKkNAWbWMiGj7Wf5uMash7SyYq527Hqck2AxYysAA7xmALppuCkwQ';
  var vector1_m0h1_private = 'xprv9wTYmMFdV23N2TdNG573QoEsfRrWKQgWeibmLntzniatZvR9BmLnvSxqu53Kw1UmYPxLgboyZQaXwTCg8MSY3H2EU4pWcQDnRnrVA1xe8fs';
  var vector1_m0h12h_public = 'xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5';
  var vector1_m0h12h_private = 'xprv9z4pot5VBttmtdRTWfWQmoH1taj2axGVzFqSb8C9xaxKymcFzXBDptWmT7FwuEzG3ryjH4ktypQSAewRiNMjANTtpgP4mLTj34bhnZX7UiM';
  var vector1_m0h12h2_public = 'xpub6FHa3pjLCk84BayeJxFW2SP4XRrFd1JYnxeLeU8EqN3vDfZmbqBqaGJAyiLjTAwm6ZLRQUMv1ZACTj37sR62cfN7fe5JnJ7dh8zL4fiyLHV';
  var vector1_m0h12h2_private = 'xprvA2JDeKCSNNZky6uBCviVfJSKyQ1mDYahRjijr5idH2WwLsEd4Hsb2Tyh8RfQMuPh7f7RtyzTtdrbdqqsunu5Mm3wDvUAKRHSC34sJ7in334';
  var vector1_m0h12h21000000000_public = 'xpub6H1LXWLaKsWFhvm6RVpEL9P4KfRZSW7abD2ttkWP3SSQvnyA8FSVqNTEcYFgJS2UaFcxupHiYkro49S8yGasTvXEYBVPamhGW6cFJodrTHy';
  var vector1_m0h12h21000000000_private = 'xprvA41z7zogVVwxVSgdKUHDy1SKmdb533PjDz7J6N6mV6uS3ze1ai8FHa8kmHScGpWmj4WggLyQjgPie1rFSruoUihUZREPSL39UNdE3BBDu76';


  it('should initialize the class', function() {
    should.exist(BIP32);
  });

  it('should initialize test vector 1 from the extended public key', function() {
    var bip32 = new BIP32(vector1_m_public);
    should.exist(bip32);
  });

  it('should initialize test vector 1 from the extended private key', function() {
    var bip32 = new BIP32(vector1_m_private);
    should.exist(bip32);
  });

  it('should get the extended public key from the extended private key', function() {
    var bip32 = new BIP32(vector1_m_private);
    bip32.extended_public_key_string().should.equal(vector1_m_public);
  });

  it("should get m/0' ext. private key from test vector 1", function() {
    var bip32 = new BIP32(vector1_m_private);
    var child = bip32.derive("m/0'");
    should.exist(child);
    child.extended_private_key_string().should.equal(vector1_m0h_private);
  });

  it("should get m/0' ext. public key from test vector 1", function() {
    var bip32 = new BIP32(vector1_m_private);
    var child = bip32.derive("m/0'");
    should.exist(child);
    child.extended_public_key_string().should.equal(vector1_m0h_public);
  });

  it("should get m/0'/1 ext. private key from test vector 1", function() {
    var bip32 = new BIP32(vector1_m_private);
    var child = bip32.derive("m/0'/1");
    should.exist(child);
    child.extended_private_key_string().should.equal(vector1_m0h1_private);
  });

  it("should get m/0'/1 ext. public key from test vector 1", function() {
    var bip32 = new BIP32(vector1_m_private);
    var child = bip32.derive("m/0'/1");
    should.exist(child);
    child.extended_public_key_string().should.equal(vector1_m0h1_public);
  });

  it("should get m/0'/1/2h ext. private key from test vector 1", function() {
    var bip32 = new BIP32(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'");
    should.exist(child);
    child.extended_private_key_string().should.equal(vector1_m0h12h_private);
  });

  it("should get m/0'/1/2h ext. public key from test vector 1", function() {
    var bip32 = new BIP32(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'");
    should.exist(child);
    child.extended_public_key_string().should.equal(vector1_m0h12h_public);
  });

  it("should get m/0'/1/2h/2 ext. private key from test vector 1", function() {
    var bip32 = new BIP32(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'/2");
    should.exist(child);
    child.extended_private_key_string().should.equal(vector1_m0h12h2_private);
  });

  it("should get m/0'/1/2h/2 ext. public key from test vector 1", function() {
    var bip32 = new BIP32(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'/2");
    should.exist(child);
    child.extended_public_key_string().should.equal(vector1_m0h12h2_public);
  });

  it("should get m/0'/1/2h/2/1000000000 ext. private key from test vector 1", function() {
    var bip32 = new BIP32(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'/2/1000000000");
    should.exist(child);
    child.extended_private_key_string().should.equal(vector1_m0h12h21000000000_private);
  });

  it("should get m/0'/1/2h/2/1000000000 ext. public key from test vector 1", function() {
    var bip32 = new BIP32(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'/2/1000000000");
    should.exist(child);
    child.extended_public_key_string().should.equal(vector1_m0h12h21000000000_public);
  });

});
