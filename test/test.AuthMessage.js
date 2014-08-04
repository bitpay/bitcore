'use strict';

var chai = chai || require('chai');
var should = chai.should();
var sinon = require('sinon');
var bitcore = bitcore || require('../bitcore');
var AuthMessage = bitcore.AuthMessage;
var Key = bitcore.Key;
var util = bitcore.util;

describe('AuthMessage model', function() {
  var key = new Key();
  key.private = util.sha256(new Buffer('test'));
  key.regenerateSync();

  var key2 = new Key();
  key2.private = util.sha256(new Buffer('test 2'));
  key2.regenerateSync();
  
  var message = 'some message';

  describe('#encode', function() {
    
    it('should encode a message', function() {
      var message = new Buffer('message');
      var encoded = AuthMessage.encode(key2.public, key, message);
      should.exist(encoded.pubkey);
      should.exist(encoded.sig);
      should.exist(encoded.encrypted);
    });

  });

  describe('#decode', function() {

    it('should decode an encoded message', function() {
      var messagehex = message.toString('hex');
      var encoded = AuthMessage.encode(key2.public, key, message);
    
      var decoded = AuthMessage.decode(key2, encoded);
      var payload = decoded.payload;
      payload.toString('hex').should.equal(messagehex);
    });

    it('should decode an encoded message with proper prevnonce', function() {
      var messagehex = message.toString('hex');
      var nonce = new Buffer([0, 0, 0, 0, 0, 0, 0, 2]);
      var opts = {nonce: nonce};
      var encoded = AuthMessage.encode(key2.public, key, message, opts);
    
      var prevnonce = new Buffer([0, 0, 0, 0, 0, 0, 0, 1]);
      opts = {prevnonce: prevnonce};
      var decoded = AuthMessage.decode(key2, encoded, opts);
      var payload = decoded.payload;
      payload.toString('hex').should.equal(messagehex);
    });

    it('should decode an encoded message with proper prevnonce - for first part', function() {
      var messagehex = message.toString('hex');
      var nonce = new Buffer([0, 0, 0, 2, 0, 0, 0, 0]);
      var opts = {nonce: nonce};
      var encoded = AuthMessage.encode(key2.public, key, message, opts);
    
      var prevnonce = new Buffer([0, 0, 0, 1, 0, 0, 0, 0]);
      opts = {prevnonce: prevnonce};
      var decoded = AuthMessage.decode(key2, encoded, opts);
      var payload = decoded.payload;
      payload.toString('hex').should.equal(messagehex);
    });

    it('should fail if prevnonce is too high', function() {
      var messagehex = message.toString('hex');
      var nonce = new Buffer([0, 0, 0, 0, 0, 0, 0, 1]);
      var opts = {nonce: nonce};
      var encoded = AuthMessage.encode(key2.public, key, message, opts);
    
      var prevnonce = new Buffer([0, 0, 0, 0, 0, 0, 0, 1]);
      opts = {prevnonce: prevnonce};
      (function() {AuthMessage.decode(key2, encoded, opts)}).should.throw('Nonce not equal to zero and not greater than the previous nonce');
    });

    it('should fail if prevnonce is too high - for first part', function() {
      var messagehex = message.toString('hex');
      var nonce = new Buffer([0, 0, 0, 1, 0, 0, 0, 0]);
      var opts = {nonce: nonce};
      var encoded = AuthMessage.encode(key2.public, key, message, opts);
    
      var prevnonce = new Buffer([0, 0, 0, 1, 0, 0, 0, 0]);
      opts = {prevnonce: prevnonce};
      (function() {AuthMessage.decode(key2, encoded, opts)}).should.throw('Nonce not equal to zero and not greater than the previous nonce');
    });

    it('should fail if the version number is incorrect', function() {
      var payload = new Buffer('message');
      var fromkey = key;
      var topubkey = key2.public;
      var version1 = new Buffer([2]);
      var version2 = new Buffer([0]);
      var nonce = new Buffer([0, 0, 0, 0, 0, 0, 0, 0]);
      var toencrypt = Buffer.concat([version1, version2, nonce, payload]);
      var toencrypt_workaround = new Buffer(toencrypt.toString('hex'));
      var encrypted = AuthMessage._encrypt(topubkey, toencrypt_workaround);
      var sig = AuthMessage._sign(fromkey, encrypted);
      var encoded = {
        pubkey: fromkey.public.toString('hex'),
        sig: sig.toString('hex'),
        encrypted: encrypted.toString('hex')
      };
    
      (function() {AuthMessage.decode(key2, encoded);}).should.throw('Invalid version number');
    });

  });

  describe('#_encrypt', function() {
    
    it('should encrypt data', function() {
      var payload = new Buffer('payload');
      var encrypted = AuthMessage._encrypt(key.public, payload);
      encrypted.length.should.equal(129);
    });

  });

  describe('#_decrypt', function() {
    var payload = new Buffer('payload');
    var payloadhex = payload.toString('hex');
    
    it('should decrypt encrypted data', function() {
      var encrypted = AuthMessage._encrypt(key.public, payload);
      var decrypted = AuthMessage._decrypt(key.private, encrypted);
      decrypted.toString('hex').should.equal(payloadhex);
    });

  });

  describe('#_sign', function() {
    
    it('should sign data', function() {
      var payload = new Buffer('payload');
      var sig = AuthMessage._sign(key, payload);
      sig.length.should.be.greaterThan(60);
    });

  });

  describe('#_verify', function() {
    var payload = new Buffer('payload');
    var sig = AuthMessage._sign(key, payload);
    
    it('should verify signed data', function() {
      AuthMessage._verify(key.public, sig, payload).should.equal(true);
    });

  });

});
