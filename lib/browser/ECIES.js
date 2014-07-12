'use strict';
var sjcl = require('../sjcl');
var ECIES = require('../common/ECIES');

ECIES.symmetricEncrypt = function(key, iv, message) {
  var skey = sjcl.codec.hex.toBits(key.toString('hex'));
  var siv = sjcl.codec.hex.toBits(iv.toString('hex'));
  var smessage = sjcl.codec.hex.toBits(message.toString('hex'));

  sjcl.beware["CBC mode is dangerous because it doesn't protect message integrity."]();

  var cipher = new sjcl.cipher.aes(skey);
  var encrypted = sjcl.mode.cbc.encrypt(cipher, smessage, siv);
  var encbuf = new Buffer(sjcl.codec.hex.fromBits(encrypted), 'hex');
  var r = Buffer.concat([iv, encbuf]);

  return r;
};

ECIES.symmetricDecrypt = function(key, encrypted) {
  var skey = sjcl.codec.hex.toBits(key.toString('hex'));
  var iv = encrypted.slice(0, 16);
  var todecrypt = encrypted.slice(16, encrypted.length);

  sjcl.beware["CBC mode is dangerous because it doesn't protect message integrity."]();

  var encbits = sjcl.codec.hex.toBits(todecrypt.toString('hex'));
  var ivbits = sjcl.codec.hex.toBits(iv.toString('hex'));
  var cipher = new sjcl.cipher.aes(skey);
  var decrypted = sjcl.mode.cbc.decrypt(cipher, encbits, ivbits);
  var decbuf = new Buffer(sjcl.codec.hex.fromBits(decrypted), 'hex');

  return decbuf;
};

module.exports = ECIES;
