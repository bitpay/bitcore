'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var AddressModule = bitcore.Address;
var Address;

describe('Address', function() {
  it('should initialze the main object', function() {
    should.exist(AddressModule);
  });
  it('should be able to create class', function() {
    Address = AddressModule;
    should.exist(Address);
  });
  it('should be able to create instance', function() {
    var a = new Address('1KfyjCgBSMsLqiCbakfSdeoBUqMqLUiu3T');
    should.exist(a);
  });
  var data = [
    ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', true],
    ['11111111111111111111111111122222234', false], // totally invalid
    ['32QBdjycLwbDTuGafUwaU5p5GxzSLPYoF6', true],
    ['1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9', true],
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62i', true],
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW600', false],  // bad checksum
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW620', false],  // bad checksum
    ['1ANNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62i', false],  // data changed, original checksum.
    ['1A Na15ZQXAZUgFiqJ2i7Z2DPU2J6hW62i', false],  // invalid chars
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62j', false],  // checksums don't match.
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62!', false],  // bad char (!)
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62iz', false], // too long Bitcoin address
    ['1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62izz', false],// too long Bitcoin address
    ['2cFupjhnEsSn59qHXstmK2ffpLv2', false],        // valid base58 invalid data
    ['dB7cwYdcPSgiyAwKWL3JwCVwSk6epU2txw', false],  // valid base58, valid length, invalid network
    ['2MnmgiRH4eGLyLc9eAqStzk7dFgBjFtUCtu', false],  // valid base58, valid length, invalid network
    ['32QBdjycLwbDTuGafUwaU5p5GxzSLPYoF6', true],  // valid base58, valid length, valid network
  ];
  data.forEach(function(datum) {
    var address = datum[0];
    var result = datum[1];
    it('should validate correctly ' + address, function() {
      var a = new Address(address);
      var s = a.toString();

      a.isValid().should.equal(result);
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

  describe('#fromPubKey', function() {
    it('should make this pubkeyhash address from uncompressed this public key', function() {
      var pubkey = new Buffer('04fa05ce8b25010cb6e17a30e0b66668bf083c40687547748ec330ee77adf53a42abd3d26148cbacfcf79c907ddefeb2c37f8bebc0a695ba79d634449d871de218', 'hex');
      var hash = bitcore.util.sha256ripe160(pubkey);
      var addr = new Address(0, hash);
      addr.toString().should.equal(Address.fromPubKey(pubkey).toString());
    });
  });

  describe('#fromPubKeys', function() {
    it('should make this p2sh multisig address from these pubkeys', function() {
      var pubkey1 = new Buffer('03e0973263b4e0d5f5f56d25d430e777ab3838ff644db972c0bf32c31da5686c27', 'hex');
      var pubkey2 = new Buffer('0371f94c57cc013507101e30794161f4e6b9efd58a9ea68838daf429b7feac8cb2', 'hex');
      var pubkey3 = new Buffer('032c0d2e394541e2efdc7ac3500e16e7e69df541f38670402e95aa477202fa06bb', 'hex');
      var sortedPubKeys = [pubkey3, pubkey2, pubkey1];
      var mReq = 2;
      var script = bitcore.Script.createMultisig(mReq, sortedPubKeys, {noSorting: true});
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
    });
  });
 
});
