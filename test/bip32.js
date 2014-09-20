var should = require('chai').should();
var constants = require('../lib/constants');
var BIP32 = require('../lib/bip32');

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
  var vector2_master = 'fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542';
  var vector2_m_public = 'xpub661MyMwAqRbcFW31YEwpkMuc5THy2PSt5bDMsktWQcFF8syAmRUapSCGu8ED9W6oDMSgv6Zz8idoc4a6mr8BDzTJY47LJhkJ8UB7WEGuduB';
  var vector2_m_private = 'xprv9s21ZrQH143K31xYSDQpPDxsXRTUcvj2iNHm5NUtrGiGG5e2DtALGdso3pGz6ssrdK4PFmM8NSpSBHNqPqm55Qn3LqFtT2emdEXVYsCzC2U';
  var vector2_m0_public = 'xpub69H7F5d8KSRgmmdJg2KhpAK8SR3DjMwAdkxj3ZuxV27CprR9LgpeyGmXUbC6wb7ERfvrnKZjXoUmmDznezpbZb7ap6r1D3tgFxHmwMkQTPH';
  var vector2_m0_private = 'xprv9vHkqa6EV4sPZHYqZznhT2NPtPCjKuDKGY38FBWLvgaDx45zo9WQRUT3dKYnjwih2yJD9mkrocEZXo1ex8G81dwSM1fwqWpWkeS3v86pgKt';
  var vector2_m02147483647h_public = 'xpub6ASAVgeehLbnwdqV6UKMHVzgqAG8Gr6riv3Fxxpj8ksbH9ebxaEyBLZ85ySDhKiLDBrQSARLq1uNRts8RuJiHjaDMBU4Zn9h8LZNnBC5y4a';
  var vector2_m02147483647h_private = 'xprv9wSp6B7kry3Vj9m1zSnLvN3xH8RdsPP1Mh7fAaR7aRLcQMKTR2vidYEeEg2mUCTAwCd6vnxVrcjfy2kRgVsFawNzmjuHc2YmYRmagcEPdU9';
  var vector2_m02147483647h1_public = 'xpub6DF8uhdarytz3FWdA8TvFSvvAh8dP3283MY7p2V4SeE2wyWmG5mg5EwVvmdMVCQcoNJxGoWaU9DCWh89LojfZ537wTfunKau47EL2dhHKon';
  var vector2_m02147483647h1_private = 'xprv9zFnWC6h2cLgpmSA46vutJzBcfJ8yaJGg8cX1e5StJh45BBciYTRXSd25UEPVuesF9yog62tGAQtHjXajPPdbRCHuWS6T8XA2ECKADdw4Ef';
  var vector2_m02147483647h12147483646h_public = 'xpub6ERApfZwUNrhLCkDtcHTcxd75RbzS1ed54G1LkBUHQVHQKqhMkhgbmJbZRkrgZw4koxb5JaHWkY4ALHY2grBGRjaDMzQLcgJvLJuZZvRcEL';
  var vector2_m02147483647h12147483646h_private = 'xprvA1RpRA33e1JQ7ifknakTFpgNXPmW2YvmhqLQYMmrj4xJXXWYpDPS3xz7iAxn8L39njGVyuoseXzU6rcxFLJ8HFsTjSyQbLYnMpCqE2VbFWc';
  var vector2_m02147483647h12147483646h2_public = 'xpub6FnCn6nSzZAw5Tw7cgR9bi15UV96gLZhjDstkXXxvCLsUXBGXPdSnLFbdpq8p9HmGsApME5hQTZ3emM2rnY5agb9rXpVGyy3bdW6EEgAtqt';
  var vector2_m02147483647h12147483646h2_private = 'xprvA2nrNbFZABcdryreWet9Ea4LvTJcGsqrMzxHx98MMrotbir7yrKCEXw7nadnHM8Dq38EGfSh6dqA9QWTyefMLEcBYJUuekgW4BYPJcr9E7j';

  it('should make a new a bip32', function() {
    var bip32;
    bip32 = new BIP32();
    should.exist(bip32);
    bip32 = BIP32();
    should.exist(bip32);
    new BIP32(vector1_m_private).toString().should.equal(vector1_m_private);
    BIP32(vector1_m_private).toString().should.equal(vector1_m_private);
    BIP32(BIP32(vector1_m_private)).toString().should.equal(vector1_m_private);
  });

  it('should initialize test vector 1 from the extended public key', function() {
    var bip32 = new BIP32().fromString(vector1_m_public);
    should.exist(bip32);
  });

  it('should initialize test vector 1 from the extended private key', function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    should.exist(bip32);
  });

  it('should get the extended public key from the extended private key for test vector 1', function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    bip32.xpubkeyString().should.equal(vector1_m_public);
  });

  it("should get m/0' ext. private key from test vector 1", function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    var child = bip32.derive("m/0'");
    should.exist(child);
    child.xprivkeyString().should.equal(vector1_m0h_private);
  });

  it("should get m/0' ext. public key from test vector 1", function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    var child = bip32.derive("m/0'");
    should.exist(child);
    child.xpubkeyString().should.equal(vector1_m0h_public);
  });

  it("should get m/0'/1 ext. private key from test vector 1", function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    var child = bip32.derive("m/0'/1");
    should.exist(child);
    child.xprivkeyString().should.equal(vector1_m0h1_private);
  });

  it("should get m/0'/1 ext. public key from test vector 1", function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    var child = bip32.derive("m/0'/1");
    should.exist(child);
    child.xpubkeyString().should.equal(vector1_m0h1_public);
  });

  it("should get m/0'/1 ext. public key from m/0' public key from test vector 1", function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    var child = bip32.derive("m/0'");
    var child_pub = new BIP32().fromString(child.xpubkeyString());
    var child2 = child_pub.derive("m/1");
    should.exist(child2);
    child2.xpubkeyString().should.equal(vector1_m0h1_public);
  });

  it("should get m/0'/1/2h ext. private key from test vector 1", function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'");
    should.exist(child);
    child.xprivkeyString().should.equal(vector1_m0h12h_private);
  });

  it("should get m/0'/1/2h ext. public key from test vector 1", function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'");
    should.exist(child);
    child.xpubkeyString().should.equal(vector1_m0h12h_public);
  });

  it("should get m/0'/1/2h/2 ext. private key from test vector 1", function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'/2");
    should.exist(child);
    child.xprivkeyString().should.equal(vector1_m0h12h2_private);
  });

  it("should get m/0'/1/2'/2 ext. public key from m/0'/1/2' public key from test vector 1", function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'");
    var child_pub = new BIP32().fromString(child.xpubkeyString());
    var child2 = child_pub.derive("m/2");
    should.exist(child2);
    child2.xpubkeyString().should.equal(vector1_m0h12h2_public);
  });

  it("should get m/0'/1/2h/2 ext. public key from test vector 1", function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'/2");
    should.exist(child);
    child.xpubkeyString().should.equal(vector1_m0h12h2_public);
  });

  it("should get m/0'/1/2h/2/1000000000 ext. private key from test vector 1", function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'/2/1000000000");
    should.exist(child);
    child.xprivkeyString().should.equal(vector1_m0h12h21000000000_private);
  });

  it("should get m/0'/1/2h/2/1000000000 ext. public key from test vector 1", function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'/2/1000000000");
    should.exist(child);
    child.xpubkeyString().should.equal(vector1_m0h12h21000000000_public);
  });

  it("should get m/0'/1/2'/2/1000000000 ext. public key from m/0'/1/2'/2 public key from test vector 1", function() {
    var bip32 = new BIP32().fromString(vector1_m_private);
    var child = bip32.derive("m/0'/1/2'/2");
    var child_pub = new BIP32().fromString(child.xpubkeyString());
    var child2 = child_pub.derive("m/1000000000");
    should.exist(child2);
    child2.xpubkeyString().should.equal(vector1_m0h12h21000000000_public);
  });

  it('should initialize test vector 2 from the extended public key', function() {
    var bip32 = new BIP32().fromString(vector2_m_public);
    should.exist(bip32);
  });

  it('should initialize test vector 2 from the extended private key', function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    should.exist(bip32);
  });

  it('should get the extended public key from the extended private key for test vector 2', function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    bip32.xpubkeyString().should.equal(vector2_m_public);
  });

  it("should get m/0 ext. private key from test vector 2", function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    var child = bip32.derive("m/0");
    should.exist(child);
    child.xprivkeyString().should.equal(vector2_m0_private);
  });

  it("should get m/0 ext. public key from test vector 2", function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    var child = bip32.derive("m/0");
    should.exist(child);
    child.xpubkeyString().should.equal(vector2_m0_public);
  });

  it("should get m/0 ext. public key from m public key from test vector 2", function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    var child = bip32.derive("m");
    var child_pub = new BIP32().fromString(child.xpubkeyString());
    var child2 = child_pub.derive("m/0");
    should.exist(child2);
    child2.xpubkeyString().should.equal(vector2_m0_public);
  });

  it("should get m/0/2147483647h ext. private key from test vector 2", function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    var child = bip32.derive("m/0/2147483647'");
    should.exist(child);
    child.xprivkeyString().should.equal(vector2_m02147483647h_private);
  });

  it("should get m/0/2147483647h ext. public key from test vector 2", function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    var child = bip32.derive("m/0/2147483647'");
    should.exist(child);
    child.xpubkeyString().should.equal(vector2_m02147483647h_public);
  });

  it("should get m/0/2147483647h/1 ext. private key from test vector 2", function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    var child = bip32.derive("m/0/2147483647'/1");
    should.exist(child);
    child.xprivkeyString().should.equal(vector2_m02147483647h1_private);
  });

  it("should get m/0/2147483647h/1 ext. public key from test vector 2", function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    var child = bip32.derive("m/0/2147483647'/1");
    should.exist(child);
    child.xpubkeyString().should.equal(vector2_m02147483647h1_public);
  });

  it("should get m/0/2147483647h/1 ext. public key from m/0/2147483647h public key from test vector 2", function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    var child = bip32.derive("m/0/2147483647'");
    var child_pub = new BIP32().fromString(child.xpubkeyString());
    var child2 = child_pub.derive("m/1");
    should.exist(child2);
    child2.xpubkeyString().should.equal(vector2_m02147483647h1_public);
  });

  it("should get m/0/2147483647h/1/2147483646h ext. private key from test vector 2", function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    var child = bip32.derive("m/0/2147483647'/1/2147483646'");
    should.exist(child);
    child.xprivkeyString().should.equal(vector2_m02147483647h12147483646h_private);
  });

  it("should get m/0/2147483647h/1/2147483646h ext. public key from test vector 2", function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    var child = bip32.derive("m/0/2147483647'/1/2147483646'");
    should.exist(child);
    child.xpubkeyString().should.equal(vector2_m02147483647h12147483646h_public);
  });

  it("should get m/0/2147483647h/1/2147483646h/2 ext. private key from test vector 2", function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    var child = bip32.derive("m/0/2147483647'/1/2147483646'/2");
    should.exist(child);
    child.xprivkeyString().should.equal(vector2_m02147483647h12147483646h2_private);
  });

  it("should get m/0/2147483647h/1/2147483646h/2 ext. public key from test vector 2", function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    var child = bip32.derive("m/0/2147483647'/1/2147483646'/2");
    should.exist(child);
    child.xpubkeyString().should.equal(vector2_m02147483647h12147483646h2_public);
  });

  it("should get m/0/2147483647h/1/2147483646h/2 ext. public key from m/0/2147483647h/2147483646h public key from test vector 2", function() {
    var bip32 = new BIP32().fromString(vector2_m_private);
    var child = bip32.derive("m/0/2147483647'/1/2147483646'");
    var child_pub = new BIP32().fromString(child.xpubkeyString());
    var child2 = child_pub.derive("m/2");
    should.exist(child2);
    child2.xpubkeyString().should.equal(vector2_m02147483647h12147483646h2_public);
  });

  describe('testnet', function() {
    it('should initialize a new BIP32 correctly from a random BIP32', function() {
      var b1 = new BIP32();
      b1.fromRandom('testnet');
      var b2 = new BIP32().fromString(b1.xpubkeyString());
      b2.xpubkeyString().should.equal(b1.xpubkeyString());
    });

    it('should generate valid ext pub key for testnet', function() {
      var b = new BIP32();
      b.fromRandom('testnet');
      b.xpubkeyString().substring(0,4).should.equal('tpub');
    });
  });

  describe('#set', function() {
    var bip32 = BIP32(vector1_m_private);
    var bip322 = BIP32().set({
      version: bip32.version,
      depth: bip32.depth,
      parentfingerprint: bip32.parentfingerprint,
      childindex: bip32.childindex,
      chaincode: bip32.chaincode,
      key: bip32.key,
      hasprivkey: bip32.hasprivkey,
      pubkeyhash: bip32.pubKeyhash,
      xpubkey: bip32.xpubkey,
      xprivkey: bip32.xprivkey
    });
    bip322.toString().should.equal(bip32.toString());
    bip322.set({}).toString().should.equal(bip32.toString());
  });

  describe('#seed', function() {

    it('should initialize a new BIP32 correctly from test vector 1 seed', function() {
      var hex = vector1_master;
      var bip32 = (new BIP32()).fromSeed(new Buffer(hex, 'hex'), 'mainnet');
      should.exist(bip32);
      bip32.xprivkeyString().should.equal(vector1_m_private);
      bip32.xpubkeyString().should.equal(vector1_m_public);
    });

    it('should initialize a new BIP32 correctly from test vector 2 seed', function() {
      var hex = vector2_master;
      var bip32 = (new BIP32()).fromSeed(new Buffer(hex, 'hex'), 'mainnet');
      should.exist(bip32);
      bip32.xprivkeyString().should.equal(vector2_m_private);
      bip32.xpubkeyString().should.equal(vector2_m_public);
    });
  });

  describe('#fromString', function() {
    
    it('should make a bip32 from a string', function() {
      var str = 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi';
      var bip32 = new BIP32().fromString(str);
      should.exist(bip32);
      bip32.toString().should.equal(str);
    });

  });

  describe('#toString', function() {
    var bip32 = new BIP32();
    bip32.fromRandom('mainnet');
    var tip32 = new BIP32();
    tip32.fromRandom('testnet');

    it('should return an xprv string', function() {
      bip32.toString().slice(0, 4).should.equal('xprv');
    });

    it('should return an xpub string', function() {
      var bip32b = new BIP32().fromString(bip32.xpubkeyString());
      bip32b.toString().slice(0, 4).should.equal('xpub');
    });

    it('should return a tprv string', function() {
      tip32.toString().slice(0, 4).should.equal('tprv');
    });

    it('should return a tpub string', function() {
      var tip32b = new BIP32().fromString(tip32.xpubkeyString());
      tip32b.toString().slice(0, 4).should.equal('tpub');
    });

  });

});
