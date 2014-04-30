'use strict';
var imports = require('soop').imports();
var coinUtil = imports.coinUtil || require('../../util');
var SecureRandom = imports.SecureRandom || require('../SecureRandom');
var Key = imports.Key || require('../Key');

var Message = function() {
};

// Encrypt a string with a string password
Message.encrypt = function(message, password) {
  if (typeof message != 'string')
    throw new Error('Message must be a string');
  if (typeof password != 'string')
    throw new Error('Password must be a string');

  var iv = SecureRandom.getRandomBuffer(16);
  var passbuf = coinUtil.sha256(new Buffer(password));
  var mbuf = new Buffer(message);

  var encrypted = Message._encrypt(mbuf, passbuf, iv);

  return encrypted;
};

Message.decrypt = function(encrypted, password) {
  if (!Buffer.isBuffer(encrypted) || encrypted.length < 32)
    throw new Error('Encrypted data must be a buffer of length >= 32')
  if (typeof password != 'string')
    throw new Error('Password must be a string');

  var passbuf = coinUtil.sha256(new Buffer(password));

  var decrypted = Message._decrypt(new Buffer(encrypted), passbuf);
  var str = decrypted.toString();

  return str;
};

Message.sign = function(str, key) {
  var hash = Message.magicHash(str);
  var sig = key.signSync(hash);
  return sig;
};

Message.verifyWithPubKey = function(pubkey, message, sig) {
  var hash = Message.magicHash(message);
  var key = new Key();
  if (pubkey.length == 65)
    key.compressed = false;
  key.public = pubkey;

  return key.verifySignatureSync(hash, sig);
};

//TODO: Message.verify ... with address, not pubkey

Message.magicBytes = new Buffer('Bitcoin Signed Message:\n');

Message.magicHash = function(str) {
  var magicBytes = Message.magicBytes;
  var prefix1 = coinUtil.varIntBuf(magicBytes.length);
  var message = new Buffer(str);
  var prefix2 = coinUtil.varIntBuf(message.length);

  var buf = Buffer.concat([prefix1, magicBytes, prefix2, message]);

  var hash = coinUtil.twoSha256(buf);

  return hash;
};

module.exports = require('soop')(Message);
