'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();
var expect = chai.expect;

var Address = bitcore.Address;
var Key = bitcore.Key;

describe('Address', function() {
  it('should be able to create class', function() {
    should.exist(Address);
  });
  it('should be able to create instance', function() {
    var a = new Address('1KfyjCgBSMsLqiCbakfSdeoBUqMqLUiu3T');
    should.exist(a);
  });
  it('should be able to transform to string', function() {
    var a = new Address('1GfGL3iLTfX43KSCd95WhMi4bgU36qjzC1');
    a.toString.bind(a).should.not.throw();
    a.toString().should.equal('1GfGL3iLTfX43KSCd95WhMi4bgU36qjzC1');
  });
  var data = [
    ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', true],
    ['11111111111111111111111111122222234', false], // totally invalid
    ['32QBdjycLwbDTuGafUwaU5p5GxzSLPYoF6', true],
    ['1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9', true],
    ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb', false], //bad checksum ... thanks @wtogami
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62i', true],
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW600', false], // bad checksum
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW620', false], // bad checksum
    ['1ANNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62i', false], // data changed, original checksum.
    ['1A Na15ZQXAZUgFiqJ2i7Z2DPU2J6hW62i', false], // invalid chars
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62j', false], // checksums don't match.
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62!', false], // bad char (!)
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62iz', false], // too long Bitcoin address
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62izz', false], // too long Bitcoin address
    ['2cFupjhnEsSn59qHXstmK2ffpLv2', false], // valid base58 invalid data
    ['dB7cwYdcPSgiyAwKWL3JwCVwSk6epU2txw', false], // valid base58, valid length, invalid network
    ['2MnmgiRH4eGLyLc9eAqStzk7dFgBjFtUCtu', false], // valid base58, valid length, invalid network
    ['32QBdjycLwbDTuGafUwaU5p5GxzSLPYoF6', true], // valid base58, valid length, valid network
  ];
  data.forEach(function(datum) {
    var address = datum[0];
    var result = datum[1];
    it('should validate correctly ' + address, function() {
      var a = new Address(address);
      var s = a.toString();

      a.isValid().should.equal(result);
      Address.validate(address).should.equal(result);
      s.should.equal(a.toString()); // check that validation doesn't change data
    });
  });
  it('should be able to detect network from an address', function() {
    // livenet
    var a = new Address('1KfyjCgBSMsLqiCbakfSdeoBUqMqLUiu3T');
    a.network().name.should.equal('livenet');
    a = new Address('1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp');
    a.network().name.should.equal('livenet');
    //p2sh
    a = new Address('3QRhucKtEn5P9i7YPxzXCqBtPJTPbRFycn');
    a.network().name.should.equal('livenet');

    //testnet
    a = new Address('mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE');
    a.network().name.should.equal('testnet');
    a = new Address('n2ekxibY5keRiMaoKFGfiNfXQCS4zTUpct');
    a.network().name.should.equal('testnet');

    //p2sh
    a = new Address('2NBSBcf2KfjPEEqVusmrWdmUeNHRiUTS3Li');
    a.network().name.should.equal('testnet');
  });
  it('#isScript should work', function() {
    // invalid
    new Address('1T').isScript().should.equal(false);
    // pubKeyHash livenet 
    new Address('1KfyjCgBSMsLqiCbakfSdeoBUqMqLUiu3T').isScript().should.equal(false);
    // script livenet
    new Address('3QRhucKtEn5P9i7YPxzXCqBtPJTPbRFycn').isScript().should.equal(true);
    // pubKeyHash testnet
    new Address('mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE').isScript().should.equal(false);
    // script testnet
    new Address('2NBSBcf2KfjPEEqVusmrWdmUeNHRiUTS3Li').isScript().should.equal(true);
  });

  describe('#Address constructor', function() {
    it('should produce a valid address from a hash', function() {
      var privkey = bitcore.util.sha256('test');
      var key = new bitcore.Key();
      key.private = privkey;
      key.regenerateSync();
      var hash = bitcore.util.sha256ripe160(key.public);
      var addr = new bitcore.Address(0, hash);
      addr.isValid().should.equal(true);
    });

    it('should throw an error if you try to use a public key instead of a hash', function() {
      var privkey = bitcore.util.sha256('test');
      var key = new bitcore.Key();
      key.private = privkey;
      key.regenerateSync();
      var f = function() {
        new bitcore.Address(0, key.public);
      };
      expect(f).to.throw(Error);
    });
  });

  describe('constructor, 2 params', function() {
    it('should make an address from a version, hash', function() {
      var hash = new Buffer('1ab59a0fd1d5fc446d38746ee033c8af57ed6bc0', 'hex');
      var addr = new Address(0, hash);
      addr.toString().should.equal('13SE7uKmnQwGA8X1A8WcZnX2ceQRDEzsAd');
    });
    it('should fail with param version, string', function() {
      var hash = '1ab59a0fd1d5fc446d38746ee033c8af57ed6bc0';
      (function() {
        var addr = new Address(0, hash);
      }).should.throw();
    });
  });


  describe('#fromPubKey', function() {
    it('should make pubkeyhash address from an uncompressed public key', function() {
      var pubkey = new Buffer('04fa05ce8b25010cb6e17a30e0b66668bf083c40687547748ec330ee77adf53a42abd3d26148cbacfcf79c907ddefeb2c37f8bebc0a695ba79d634449d871de218', 'hex');
      var hash = bitcore.util.sha256ripe160(pubkey);
      var addr = new Address(0, hash);
      addr.toString().should.equal(Address.fromPubKey(pubkey).toString());
    });
  });
  describe('#fromKey', function() {
    it('should make this pubkeyhash address from uncompressed this public key', function() {
      var k = new Key();
      k.private = new Buffer('43532455C88590A594D552F76DDB70EC1CFD7746F05C10CBB70B1EA9552EDF87', 'hex');
      k.compressed = true;
      k.regenerateSync();
      var a = Address.fromKey(k);
      a.toString().should.equal('1L8k7WpWHMNkqVPTaZhzFU5VaWyjZEK7mD');
    });
  });


  describe('#fromPubKeys', function() {
    it('should make this p2sh multisig address from these pubkeys', function() {
      var pubkey1 = new Buffer('03e0973263b4e0d5f5f56d25d430e777ab3838ff644db972c0bf32c31da5686c27', 'hex');
      var pubkey2 = new Buffer('0371f94c57cc013507101e30794161f4e6b9efd58a9ea68838daf429b7feac8cb2', 'hex');
      var pubkey3 = new Buffer('032c0d2e394541e2efdc7ac3500e16e7e69df541f38670402e95aa477202fa06bb', 'hex');
      var sortedPubKeys = [pubkey3, pubkey2, pubkey1];
      var mReq = 2;
      var script = bitcore.Script.createMultisig(mReq, sortedPubKeys, {
        noSorting: true
      });
      var hash = bitcore.util.sha256ripe160(script.getBuffer());
      var version = bitcore.networks['livenet'].P2SHVersion;
      var addr = new Address(version, hash);
      var addr2 = Address.fromPubKeys(mReq, sortedPubKeys);
      addr.toString().should.equal(addr2.toString());
    });
  });

  describe('#fromScript', function() {
    it('should make this p2sh multisig address from these pubkeys', function() {
      var pubkey1 = new Buffer('03e0973263b4e0d5f5f56d25d430e777ab3838ff644db972c0bf32c31da5686c27', 'hex');
      var pubkey2 = new Buffer('0371f94c57cc013507101e30794161f4e6b9efd58a9ea68838daf429b7feac8cb2', 'hex');
      var pubkey3 = new Buffer('032c0d2e394541e2efdc7ac3500e16e7e69df541f38670402e95aa477202fa06bb', 'hex');
      var pubKeys = [pubkey1, pubkey2, pubkey3];
      var mReq = 2;
      var script = bitcore.Script.createMultisig(mReq, pubKeys);
      var addr = Address.fromScript(script);
      var addr2 = Address.fromPubKeys(mReq, pubKeys);
      addr.toString().should.equal(addr2.toString());

      // Same case, using HEX
      var scriptHex = bitcore.Script.createMultisig(mReq, pubKeys).getBuffer().toString('hex');
      var addrB = Address.fromScript(scriptHex);
      var addr2B = Address.fromPubKeys(mReq, pubKeys);
      addrB.toString().should.equal(addr2B.toString());

    });

    it('it should make this hand-crafted address', function() {
      var pubkey1 = new Buffer('03e0973263b4e0d5f5f56d25d430e777ab3838ff644db972c0bf32c31da5686c27', 'hex');
      var pubkey2 = new Buffer('0371f94c57cc013507101e30794161f4e6b9efd58a9ea68838daf429b7feac8cb2', 'hex');
      var pubkey3 = new Buffer('032c0d2e394541e2efdc7ac3500e16e7e69df541f38670402e95aa477202fa06bb', 'hex');
      var pubKeys = [pubkey1, pubkey2, pubkey3];
      var mReq = 2;
      var script = bitcore.Script.createMultisig(mReq, pubKeys);
      var addr = Address.fromScript(script);

      var hash = bitcore.util.sha256ripe160(script.getBuffer());
      var version = bitcore.networks['livenet'].P2SHVersion;
      var addr2 = new Address(version, hash);

      addr.toString().should.equal(addr2.toString());
    });
  });

  describe('#getScriptPubKey', function() {
    var data = [
      ['76a91423b7530a00dd7951e11791c529389421c0b8d83b88ac', 'mimoZNLcP2rrMRgdeX5PSnR7AjCqQveZZ4'],
      ['a9147049be48e74a660157da3ed64569981592f7fa0587', '2N3Ux1YTnt1ixofYvJfaabqZSj2MBF3jsmv'],
      ['76a914774e603bafb717bd3f070e68bbcccfd907c77d1388ac', 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE'],
      ['76a914b00127584485a7cff0949ef0f6bc5575f06ce00d88ac', 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd']
    ];

    it('validate scriptPubKey for a given address', function() {
      for (var i in data) {
        var d = data[i];
        var b = new Address(d[1]).getScriptPubKey().getBuffer();
        b.toString('hex').should.equal(d[0]);
        Address.getScriptPubKeyFor(d[1]).getBuffer().toString('hex').should.equal(d[0]);
      }
    });
  });

  describe('#fromScriptPubKey', function() {

    // All examples checked againt bitcoind decodescript
    var cases = [
      ['76a91423b7530a00dd7951e11791c529389421c0b8d83b88ac', 'mimoZNLcP2rrMRgdeX5PSnR7AjCqQveZZ4'],
      ['a9147049be48e74a660157da3ed64569981592f7fa0587', '2N3Ux1YTnt1ixofYvJfaabqZSj2MBF3jsmv'],
      ['76a914774e603bafb717bd3f070e68bbcccfd907c77d1388ac', 'mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE'],
      ['76a914b00127584485a7cff0949ef0f6bc5575f06ce00d88ac', 'mwZabyZXg8JzUtFX1pkGygsMJjnuqiNhgd'],
      ['532103bf025eb410407aec5a67c975ce222e363bb88c69bb1acce45d20d85602df2ec52103d76dd6d99127f4b733e772f0c0a09c573ac7e4d69b8bf50272292da2e093de2c2103dd9acd8dd1816c825d6b0739339c171ae2cb10efb53699680537865b07086e9b2102371cabbaf466c3a536034b4bda64ad515807bffd87488f44f93c2373d4d189c9210264cd444358f8d57f8637a7309f9736806f4883aebc4fe7da4bad1e4b37f2d12c55ae', [
        "n4JAZc4cJimQbky5wxZUEDeAFZtGaZrjWK",
        "msge5muNmBSRDn5nsaRcHCU6dg2zimA8wQ",
        "mvz9MjocpyXdgXqRcZYazsdE8iThdvjdhk",
        "miQGZ2gybQe7UvUQDBYsgcctUteij5pTpm",
        "mu9kmhGrzREKsWaXUEUrsRLLMG4UMPy1LF"
      ]]
    ];

    for (var i in cases) {
      var c = cases[i];
      it('it should generate the right address', function() {
        if (typeof c[1] === 'string') {
          (new Address.fromScriptPubKey(c[0], 'testnet')).toString().should.equal(c[1]);
          var s = new bitcore.Script(new Buffer(c[0], 'hex'));
          (new Address.fromScriptPubKey(s, 'testnet')).toString().should.equal(c[1]);
        } else {
          var as = new Address.fromScriptPubKey(c[0], 'testnet');
          for (var j in as) {
            as[j].toString().should.equal(c[1][j]);
          }
        }
      });
    }
  });

});
