'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var should = chai.should();
var assert = chai.assert;
var ECIES = bitcore.ECIES;
var Point = bitcore.Point;

describe('ECIES', function() {

  describe('#rand', function() {

    it('should set r and R', function() {
      var ecies = new ECIES();
      ecies.rand();
      ecies.r.length.should.equal(32);
      ecies.R.toUncompressedPubKey().length.should.equal(65);
    });

    it('should not set the same r twice in a row', function() {
      var ecies = new ECIES();
      ecies.rand();
      var ecies2 = new ECIES();
      ecies2.rand();
      ecies.r.toString('hex').should.not.equal(ecies2.r.toString('hex'));
    });

  });

  describe('#encryptObj', function() {
    
    it('should not fail', function() {
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test');
      key.regenerateSync();

      var message = new Buffer('this is my message');
      var ecies = ECIES.encryptObj(key.public, message);

      should.exist(ecies.R);
      should.exist(ecies.c);
      should.exist(ecies.d);
    });

  });

  describe('#encrypt', function() {
    
    it('should not fail', function() {
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test');
      key.regenerateSync();

      var message = new Buffer('this is my message');
      var encrypted = ECIES.encrypt(key.public, message);

      should.exist(encrypted);
    });

  });

  describe('#decrypt', function() {

    it('should not fail', function() {
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test');
      key.regenerateSync();

      var message = new Buffer('this is my message');
      var encrypted = ECIES.encrypt(key.public, message);
      
      var decrypted = ECIES.decrypt(key.private, encrypted);

      decrypted.toString().should.equal('this is my message');
    });

    it('should not fail for long messages', function() {
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test');
      key.regenerateSync();

      var message = new Buffer('this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message ');

      var encrypted = ECIES.encrypt(key.public, message);
      
      var decrypted = ECIES.decrypt(key.private, encrypted);

      decrypted.toString().should.equal(message.toString());
    });

  });

  describe('#symmetricEncrypt', function() {
    
    it('should not fail', function() {
      var data = new Buffer([1, 2, 3, 4, 5]);
      var key = bitcore.util.sha256('test');
      var iv = bitcore.util.sha256('test').slice(0, 16);
      var encrypted = ECIES.symmetricEncrypt(key, iv, data);
      encrypted.length.should.equal(16 + 16);
    });

  });

  describe('#symmetricDecrypt', function() {

    it('should decrypt that which was encrypted', function() {
      var data = new Buffer([1, 2, 3, 4, 5]);
      var key = bitcore.util.sha256('test');
      var iv = bitcore.util.sha256('test').slice(0, 16);
      var encrypted = ECIES.symmetricEncrypt(key, iv, data);
      var decrypted = ECIES.symmetricDecrypt(key, encrypted);
      decrypted[0].should.equal(1);
      decrypted[4].should.equal(5);
    });

  });

  describe('#getSfromPubkey', function() {
    
    it('should find S correctly', function() {
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test');
      key.regenerateSync();
      var ecies = new ECIES();
      ecies.r = bitcore.util.sha256('test test');
      ecies.KB = key.public;
      var S = ecies.getSfromPubkey();
      S.toString('hex').should.equal('9de4c42c4190fa987d84ce735a0370f7bb42f8646cec6274c5420f5af8fbfdbc');
    });

  });

  describe('#getSfromPrivkey', function() {

    it('should find S the same as getSfromPubkey', function() {
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test');
      key.regenerateSync();

      var r = bitcore.util.sha256('test test');
      var key2 = new bitcore.Key();
      key2.private = r;
      key2.regenerateSync();
      key2.compressed = false;
      var R = Point.fromUncompressedPubKey(key2.public);

      var ecies = new ECIES();
      ecies.r = r;
      ecies.KB = key.public;
      var S = ecies.getSfromPubkey();

      var ecies2 = new ECIES();
      ecies2.R = R;
      ecies2.kB = key.private;
      var S2 = ecies2.getSfromPrivkey();
      
      S.toString('hex').should.equal(S2.toString('hex'));
    });
    
  });

  describe('#kdf', function() {
    
    it('should be sha512', function() {
      var data = new Buffer([0, 1, 2, 3, 4, 5, 6]);
      ECIES.kdf(data).toString('hex').should.equal(bitcore.util.sha512(data).toString('hex'));
    });
  });

});
