'use strict';
var crypto = require('crypto');
var ECIES = require('./common/ECIES');

ECIES.symmetricEncrypt = function(key, iv, message) {
  var cipheriv = crypto.createCipheriv('AES-256-CBC', key, iv);
  var a = cipheriv.update(message);
  var b = cipheriv.final();
  var r = Buffer.concat([iv, a, b]);
  return r;
};

ECIES.symmetricDecrypt = function(key, encrypted) {
  var iv = encrypted.slice(0, 16);
  var decipheriv = crypto.createDecipheriv('AES-256-CBC', key, iv);
  var todecrypt = encrypted.slice(16, encrypted.length);
  var a = decipheriv.update(todecrypt);
  var b = decipheriv.final();
  var r = Buffer.concat([a, b]);
  return r;
};

module.exports = ECIES;
