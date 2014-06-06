'use strict';
var imports = require('soop').imports();
var sjcl = require('../sjcl');
var ECIES = require('../common/ECIES');

ECIES.symmetricEncrypt = function(key, iv, message) {
  var skey = sjcl.codec.hex.toBits(key.toString('hex'));
  var siv = sjcl.codec.hex.toBits(iv.toString('hex'));
  var smessage = sjcl.codec.hex.toBits(message.toString('hex'));

  sjcl.beware["CBC mode is dangerous because it doesn't protect message integrity."]();
  var params = {iv: siv, ks: 256, ts: 128, iter: 1000, mode: 'cbc'};
  var encrypted = sjcl.encrypt(skey, smessage, params);
  var enchex = sjcl.codec.hex.fromBits(sjcl.codec.base64.toBits(JSON.parse(encrypted).ct));

  var encbuf = new Buffer(enchex, 'hex');

  var r = Buffer.concat([iv, encbuf]);

  return r;
};

ECIES.symmetricDecrypt = function(key, encrypted) {
  var skey = sjcl.codec.hex.toBits(key.toString('hex'));
  var iv = encrypted.slice(0, 16);
  var todecrypt = encrypted.slice(16, encrypted.length);
  
  var siv = sjcl.codec.base64.fromBits(sjcl.codec.hex.toBits(iv.toString('hex')));
  var sct = sjcl.codec.base64.fromBits(sjcl.codec.hex.toBits(todecrypt.toString('hex')));

  sjcl.beware["CBC mode is dangerous because it doesn't protect message integrity."]();
  var obj = {iv: siv, v: 1, iter: 1000, ks: 256, ts: 128, mode: 'cbc', adata: '', cipher: 'aes', ct: sct};
  var str = JSON.stringify(obj);

  var decrypted = sjcl.decrypt(skey, str);
  var decbuf = new Buffer(decrypted);

  return decbuf;
};

module.exports = require('soop')(ECIES);
