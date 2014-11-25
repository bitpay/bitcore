'use strict';

var should = require('chai').should();

var bitcore = require('..');
var PublicKey = bitcore.PublicKey;
var Address = bitcore.Address;
var Script = bitcore.Script;

describe('Address', function() {

  var pubkeyhash = new Buffer('3c3fa3d4adcaf8f52d5b1843975e122548269937', 'hex');
  var buf = Buffer.concat([new Buffer([0]), pubkeyhash]);
  var str = '16VZnHwRhwrExfeHFHGjwrgEMq8VcYPs9r';
  var strTest = 'n28S35tqEMbt6vNad7A5K3mZ7vdn8dZ86X';

  it('should throw an error because of missing data', function() {
    (function() {
      var a = new Address();
    }).should.throw('First argument is required, please include address data.');
  });

  it('should throw an error because of bad network param', function() {
    (function(){
      var a = new Address(validAddresses[0], 'main', 'pubkeyhash');
    }).should.throw('Second argument must be "mainnet" or "testnet".');
  });

  it('should throw an error because of bad type param', function() {
    (function() {
      var a = new Address(validAddresses[0], 'mainnet', 'pubkey');
    }).should.throw('Third argument must be "pubkeyhash" or "scripthash"');
  });


  // mainnet valid
  var validAddresses = [
    '15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2',
    '1A6ut1tWnUq1SEQLMr4ttDh24wcbJ5o9TT',
    '1BpbpfLdY7oBS9gK7aDXgvMgr1DPvNhEB2',
    '1Jz2yCRd5ST1p2gUqFB5wsSQfdm3jaFfg7'
  ];

  // mainnet p2sh
  var validp2shAddresses = [
    '342ftSRCvFHfCeFFBuz4xwbeqnDw6BGUey',
    '33vt8ViH5jsr115AGkW6cEmEz9MpvJSwDk',
    '37Sp6Rv3y4kVd1nQ1JV5pfqXccHNyZm1x3',
    '3QjYXhTkvuj8qPaXHTTWb5wjXhdsLAAWVy'
  ];

  // testnet p2sh
  var testValidp2shAddresses = [
    '2N7FuwuUuoTBrDFdrAZ9KxBmtqMLxce9i1C',
    '2NEWDzHWwY5ZZp8CQWbB7ouNMLqCia6YRda',
    '2MxgPqX1iThW3oZVk9KoFcE5M4JpiETssVN',
    '2NB72XtkjpnATMggui83aEtPawyyKvnbX2o'
  ];

  //mainnet bad checksums
  var badChecksums = [
    '15vkcKf7gB23wLAnZLmbVuMiiVDc3nq4a2',
    '1A6ut1tWnUq1SEQLMr4ttDh24wcbj4w2TT',
    '1BpbpfLdY7oBS9gK7aDXgvMgr1DpvNH3B2',
    '1Jz2yCRd5ST1p2gUqFB5wsSQfdmEJaffg7'
  ];

  //mainnet non-base58
  var nonBase58 = [
    '15vkcKf7g#23wLAnZLmb$uMiiVDc3nq4a2',
    '1A601ttWnUq1SEQLMr4ttDh24wcbj4w2TT',
    '1BpbpfLdY7oBS9gK7aIXgvMgr1DpvNH3B2',
    '1Jz2yCRdOST1p2gUqFB5wsSQfdmEJaffg7'
  ];

  //testnet valid
  var testValidAddresses = [
    'n28S35tqEMbt6vNad7A5K3mZ7vdn8dZ86X',
    'n45x3R2w2jaSC62BMa9MeJCd3TXxgvDEmm',
    'mursDVxqNQmmwWHACpM9VHwVVSfTddGsEM',
    'mtX8nPZZdJ8d3QNLRJ1oJTiEi26Sj6LQXS'
  ];

  describe('validation', function() {

    it('should describe this mainnet address as an invalid testnet address', function() {
      var error = Address.getValidationError('37BahqRsFrAd3qLiNNwLNV3AWMRD7itxTo', 'testnet');
      should.exist(error);
    });

    it('should should return a true boolean', function(){
      var valid = Address.isValid('37BahqRsFrAd3qLiNNwLNV3AWMRD7itxTo', 'mainnet');
      valid.should.equal(true);
    });

    it('should should return a false boolean', function(){
      var valid = Address.isValid('37BahqRsFrAd3qLiNNwLNV3AWMRD7itxTo', 'testnet');
      valid.should.equal(false);
    });

    it('should validate addresses', function() {
      for(var i=0;i<validAddresses.length;i++){
        var error = Address.getValidationError(validAddresses[i]);
        should.not.exist(error);
      }
    });

    it('should validate p2sh addresses', function() {
      for(var i=0;i<validp2shAddresses.length;i++){
        var error = Address.getValidationError(validp2shAddresses[i]);
        should.not.exist(error);
      }
    });

    it('should validate testnet p2sh addresses', function() {
      for(var i=0;i<testValidp2shAddresses.length;i++){
        var error = Address.getValidationError(testValidp2shAddresses[i], 'testnet');
        should.not.exist(error);
      }
    });

    it('should not validate addresses with params', function() {
      for(var i=0;i<validAddresses.length;i++){
        var error = Address.getValidationError(validAddresses[i], 'testnet');
        should.exist(error);
      }
    });

    it('should validate addresses with params', function() {
      for(var i=0;i<validAddresses.length;i++){
        var error = Address.getValidationError(validAddresses[i], 'mainnet');
        should.not.exist(error);
      }
    });

    it('should not validate because of an invalid checksum', function() {
      for(var i=0;i<badChecksums.length;i++){
        var error = Address.getValidationError(badChecksums[i], 'mainnet', 'pubkeyhash');
        should.exist(error);
        error.message.should.equal('Checksum mismatch');
      }
    });

    it('should not validate because of mismatched network', function() {
      for(var i=0;i<validAddresses.length;i++){
        var error = Address.getValidationError(validAddresses[i], 'testnet', 'pubkeyhash');
        should.exist(error);
        error.message.should.equal('Address has mismatched network type.');
      }

    });

    it('should not validate because of a mismatched type', function() {
      for(var i=0;i<validAddresses.length;i++){
        var error = Address.getValidationError(validAddresses[i], 'mainnet', 'scripthash');
        should.exist(error);
        error.message.should.equal('Address has mismatched type.');
      }
    });

    it('should not validate because of non-base58 characters', function() {
      for(var i=0;i<nonBase58.length;i++){
        var error = Address.getValidationError(nonBase58[i], 'mainnet', 'pubkeyhash');
        should.exist(error);
        error.message.should.equal('Non-base58 character');
      }
    });

    it('should not validate addresses', function() {
      for(var i=0;i<badChecksums.length;i++){
        var error = Address.getValidationError(badChecksums[i]);
        should.exist(error);
      }
    });

    it('should validate testnet addresses', function() {
      for(var i=0;i<testValidAddresses.length;i++){
        var error = Address.getValidationError(testValidAddresses[i], 'testnet');
        should.not.exist(error);
      }
    });

    it('should not validate testnet addresses because of mismatched network', function() {
      for(var i=0;i<testValidAddresses.length;i++){
        var error = Address.getValidationError(testValidAddresses[i], 'mainnet', 'pubkeyhash');
        should.exist(error);
        error.message.should.equal('Address has mismatched network type.');
      }
    });

  });

  describe('encodings', function() {

    it('should make an address from a buffer', function() {
      var a = Address.fromBuffer(buf).toString().should.equal(str);
      var b = new Address(buf).toString().should.equal(str);
      var c = Address(buf).toString().should.equal(str);
    });

    it('should make an address from a string', function() {
      var a = Address.fromString(str).toString().should.equal(str);
      var b = new Address(str).toString().should.equal(str);
    });

    it('should error because of unrecognized data format', function() {
      (function() {
        var a = new Address(new Error());
      }).should.throw('First argument is an unrecognized data format.');
    });

    it('should error because of incorrect format for pubkey hash', function() {
      (function() {
        var a = new Address.fromPublicKeyHash('notahash');
      }).should.throw('Address supplied is not a buffer.');
    });

    it('should error because of incorrect format for script hash', function() {
      (function() {
        var a = new Address.fromScriptHash('notascript');
      }).should.throw('Address supplied is not a buffer.');
    });

    it('should error because of incorrect type for transform buffer', function() {
      (function() {
        var info = Address._transformBuffer('notabuffer');
      }).should.throw('Address supplied is not a buffer.');
    });

    it('should error because of incorrect length buffer for transform buffer', function() {
      (function() {
        var info = Address._transformBuffer(new Buffer(20));
      }).should.throw('Address buffers must be exactly 21 bytes.');
    });

    it('should error because of incorrect type for pubkey transform', function() {
      (function() {
        var info = Address._transformPublicKey(new Buffer(20));
      }).should.throw('Address must be an instance of PublicKey.');
    });

    it('should error because of incorrect type for script transform', function() {
      (function() {
        var info = Address._transformScript(new Buffer(20));
      }).should.throw('Address must be an instance of Script.');
    });

    it('should error because of incorrect type for string transform', function() {
      (function() {
        var info = Address._transformString(new Buffer(20));
      }).should.throw('Address supplied is not a string.');
    });

    it('should make an address from a pubkey hash buffer', function() {
      var hash = pubkeyhash; //use the same hash
      var a = Address.fromPublicKeyHash(hash).toString().should.equal(str);
      var b = Address.fromPublicKeyHash(hash, 'testnet');
      b.network.should.equal('testnet');
      b.type.should.equal('pubkeyhash');
      var c = new Address(hash).toString().should.equal(str);
    });

    it('should throw an error for invalid length hashBuffer', function() {
      (function() {
        var a = Address.fromPublicKeyHash(buf);
      }).should.throw('Address hashbuffers must be exactly 20 bytes.');
    });

    it('should make this address from a compressed pubkey', function() {
      var pubkey = PublicKey.fromDER(new Buffer('0285e9737a74c30a873f74df05124f2aa6f53042c2fc0a130d6cbd7d16b944b004', 'hex'));
      var address = Address.fromPublicKey(pubkey);
      address.toString().should.equal('19gH5uhqY6DKrtkU66PsZPUZdzTd11Y7ke');
    });

    it('should make this address from an uncompressed pubkey', function() {
      var pubkey = PublicKey.fromDER(new Buffer('0485e9737a74c30a873f74df05124f2aa6f53042c2fc0a130d6cbd7d16b944b004833fef26c8be4c4823754869ff4e46755b85d851077771c220e2610496a29d98', 'hex'));
      var a = Address.fromPublicKey(pubkey, 'mainnet');
      a.toString().should.equal('16JXnhxjJUhxfyx4y6H4sFcxrgt8kQ8ewX');
      var b = new Address(pubkey, 'mainnet', 'pubkeyhash');
      b.toString().should.equal('16JXnhxjJUhxfyx4y6H4sFcxrgt8kQ8ewX');
    });

    it('should make this address from a script', function() {
      var s = Script().fromString("OP_CHECKMULTISIG");
      var buf = s.toBuffer();
      var a = Address.fromScript(s);
      a.toString().should.equal('3BYmEwgV2vANrmfRymr1mFnHXgLjD6gAWm');
      var b = new Address(s);
      b.toString().should.equal('3BYmEwgV2vANrmfRymr1mFnHXgLjD6gAWm');
      var c = Address.fromScriptHash(bitcore.crypto.Hash.sha256ripemd160(buf));
      c.toString().should.equal('3BYmEwgV2vANrmfRymr1mFnHXgLjD6gAWm');
    });

    it('should make this address from other script', function() {
      var s = Script().fromString("OP_CHECKSIG OP_HASH160");
      var a = Address.fromScript(s);
      a.toString().should.equal('347iRqVwks5r493N1rsLN4k9J7Ljg488W7');
      var b = new Address(s);
      b.toString().should.equal('347iRqVwks5r493N1rsLN4k9J7Ljg488W7');
    });

    it('should derive from this known address string mainnet', function() {
      var address = new Address(str);
      var buffer = address.toBuffer();
      var slice = buffer.slice(1);
      var sliceString = slice.toString('hex');
      sliceString.should.equal(pubkeyhash.toString('hex'));
    });

    it('should derive from this known address string testnet', function() {
      var a = new Address(testValidAddresses[0], 'testnet');
      var b = new Address(a.toString());
      b.toString().should.equal(testValidAddresses[0]);
      b.network.should.equal('testnet');
    });

    it('should derive from this known address string mainnet scripthash', function() {
      var a = new Address(validp2shAddresses[0], 'mainnet', 'scripthash');
      var b = new Address(a.toString());
      b.toString().should.equal(validp2shAddresses[0]);
    });

    it('should derive from this known address string testnet scripthash', function() {
      var address = new Address(testValidp2shAddresses[0], 'testnet', 'scripthash');
      address = new Address(address.toString());
      address.toString().should.equal(testValidp2shAddresses[0]);
    });

  });

  describe('#toBuffer', function() {

    it('should output this known hash', function() {
      var address = new Address(str);
      address.toBuffer().slice(1).toString('hex').should.equal(pubkeyhash.toString('hex'));
    });

  });

  describe('#toString', function() {

    it('should output a mainnet pubkeyhash address', function() {
      var address = new Address(str);
      address.toString().should.equal(str);
    });

    it('should output a scripthash address', function() {
      var address = new Address(validp2shAddresses[0]);
      address.toString().should.equal(validp2shAddresses[0]);
    });

    it('should output a testnet scripthash address', function() {
      var address = new Address(testValidp2shAddresses[0]);
      address.toString().should.equal(testValidp2shAddresses[0]);
    });

    it('should output a testnet pubkeyhash address', function() {
      var address = new Address(testValidAddresses[0]);
      address.toString().should.equal(testValidAddresses[0]);
    });

  });

  describe('#inspect', function() {

    it('should output formatted output correctly', function() {
      var address = new Address(str);
      var output = '<Address: 16VZnHwRhwrExfeHFHGjwrgEMq8VcYPs9r, type: pubkeyhash, network: mainnet>';
      address.inspect().should.equal(output);
    });

  });

});
