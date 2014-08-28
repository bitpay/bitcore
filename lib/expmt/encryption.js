var AES = require('./aes');
var CBC = require('./cbc');
var Random = require('../random');
var Hash = require('../hash');

var Encryption = function Encryption() {
};

Encryption.encrypt = function(messagebuf, passwordstr) {
  var cipherkeybuf = Hash.sha256(new Buffer(passwordstr));
  return Encryption.encryptCipherkey(messagebuf, cipherkeybuf);
};

Encryption.decrypt = function(encbuf, passwordstr) {
  var cipherkeybuf = Hash.sha256(new Buffer(passwordstr));
  return Encryption.decryptCipherkey(encbuf, cipherkeybuf);
};

Encryption.encryptCipherkey = function(messagebuf, cipherkeybuf, ivbuf) {
  ivbuf = ivbuf || Random.getRandomBuffer(128 / 8);
  var ctbuf = CBC.encrypt(messagebuf, ivbuf, AES, cipherkeybuf);
  var encbuf = Buffer.concat([ivbuf, ctbuf]);
  return encbuf;
};

Encryption.decryptCipherkey = function(encbuf, cipherkeybuf) {
  var ivbuf = encbuf.slice(0, 128 / 8);
  var ctbuf = encbuf.slice(128 / 8);
  var messagebuf = CBC.decrypt(ctbuf, ivbuf, AES, cipherkeybuf);
  return messagebuf;
};

module.exports = Encryption;
