var AES = require('./aes');
var CBC = require('./cbc');
var Random = require('../random');
var Hash = require('../hash');

var SymEnc = function SymEnc() {
};

SymEnc.encrypt = function(messagebuf, passwordstr) {
  var cipherkeybuf = Hash.sha256(new Buffer(passwordstr));
  return SymEnc.encryptCipherkey(messagebuf, cipherkeybuf);
};

SymEnc.decrypt = function(encbuf, passwordstr) {
  var cipherkeybuf = Hash.sha256(new Buffer(passwordstr));
  return SymEnc.decryptCipherkey(encbuf, cipherkeybuf);
};

SymEnc.encryptCipherkey = function(messagebuf, cipherkeybuf, ivbuf) {
  ivbuf = ivbuf || Random.getRandomBuffer(128 / 8);
  var ctbuf = CBC.encrypt(messagebuf, ivbuf, AES, cipherkeybuf);
  var encbuf = Buffer.concat([ivbuf, ctbuf]);
  return encbuf;
};

SymEnc.decryptCipherkey = function(encbuf, cipherkeybuf) {
  var ivbuf = encbuf.slice(0, 128 / 8);
  var ctbuf = encbuf.slice(128 / 8);
  var messagebuf = CBC.decrypt(ctbuf, ivbuf, AES, cipherkeybuf);
  return messagebuf;
};

module.exports = SymEnc;
