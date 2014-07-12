'use strict';
var coinUtil = require('../../util');
var Point = require('../Point');
var SecureRandom = require('../SecureRandom');
var Key = require('../Key');

// http://en.wikipedia.org/wiki/Integrated_Encryption_Scheme
var ECIES = function() {};

ECIES.encryptObj = function(pubkey, message, r, iv) {
  var ecies = new ECIES();
  ecies.KB = pubkey;
  ecies.message = message;
  r = ecies.getRandomSeed(r);
  var R = ecies.R;
  var S = ecies.S = ecies.getSfromPubkey();
  var buf = ECIES.kdf(S);
  var kE = ecies.kE = buf.slice(0, 32);
  var kM = ecies.kM = buf.slice(32, 64);
  iv = iv || SecureRandom.getRandomBuffer(16);
  var c = ecies.c = ECIES.symmetricEncrypt(kE, iv, message);
  var d = ecies.d = ECIES.mac(kM, c);
  return ecies;
};

ECIES.encrypt = function(pubkey, message, r, iv) {
  var ecies = ECIES.encryptObj(pubkey, message, r, iv);
  var key = new Key();
  key.compressed = false;
  key.public = ecies.R.toUncompressedPubKey();
  key.compressed = true;
  var Rbuf = key.public;
  var buf = Buffer.concat([Rbuf, ecies.c, ecies.d]);
  return buf;
};

ECIES.decryptObj = function(ecies) {
  var kB = ecies.kB;
  var R = ecies.R;
  var c = ecies.c;
  var d = ecies.d;
  var P = Point.multiply(R, kB);
  var S = P.x.toBuffer({
    size: 32
  });
  var buf = ECIES.kdf(S);
  var kE = ecies.kE = buf.slice(0, 32);
  var kM = ecies.kM = buf.slice(32, 64);
  var d2 = ECIES.mac(kM, c);
  if (d.toString('hex') !== d2.toString('hex'))
    throw new Error('MAC check incorrect. Data is invalid.');
  var decrypted = ECIES.symmetricDecrypt(kE, c);
  return decrypted;
};

ECIES.decrypt = function(privkey, buf) {
  if (buf.length < 33 + 0 + 64)
    throw new Error('invalid length of encrypted data');
  var ecies = new ECIES();
  ecies.kB = privkey;
  var Rbuf = buf.slice(0, 33);
  var key = new Key();
  key.public = Rbuf;
  key.compressed = false;
  ecies.R = Point.fromUncompressedPubKey(key.public);
  ecies.c = buf.slice(33, buf.length - 64);
  ecies.d = buf.slice(buf.length - 64, buf.length);
  return ECIES.decryptObj(ecies);
};

ECIES.kdf = function(S) {
  var buf = coinUtil.sha512(S);
  return buf;
};

ECIES.mac = function(data, key) {
  var buf = coinUtil.sha512hmac(data, key);
  return buf;
};

ECIES.prototype.getRandomSeed = function(r) {
  if (r) {
    this.key = new Key();
    this.key.private = r;
    this.key.regenerateSync();
  } else {
    this.key = Key.generateSync();
  };
  this.r = this.key.private;
  this.key.compressed = false;
  this.R = Point.fromUncompressedPubKey(this.key.public);
  return this.r;
};

ECIES.prototype.getSfromPubkey = function() {
  var key2 = new Key();
  key2.public = this.KB;
  key2.compressed = false;
  var KBP = Point.fromUncompressedPubKey(key2.public);
  this.P = Point.multiply(KBP, this.r);
  this.S = this.P.x.toBuffer({
    size: 32
  });
  return this.S;
};

ECIES.prototype.getSfromPrivkey = function() {
  var R = this.R;
  var kB = this.kB;
  var SP = Point.multiply(R, kB);
  var S = SP.x.toBuffer({
    size: 32
  });
  return S;
};

module.exports = ECIES;
