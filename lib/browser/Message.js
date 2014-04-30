var imports = require('soop');
var CryptoJS = require('crypto-js');

var Message = require('../common/Message');

// Encrypt a buffer with a buffer password and buffer iv
Message._encrypt = function(mbuf, pbuf, iv) {
  var cmbuf = CryptoJS.enc.Hex.parse(mbuf.toString('hex'));
  var cpbuf = CryptoJS.enc.Hex.parse(pbuf.toString('hex'));
  var civ = CryptoJS.enc.Hex.parse(iv.toString('hex'));
  var encrypted = CryptoJS.AES.encrypt(cmbuf, cpbuf, { iv: civ });

  var cipherhex = String(encrypted.ciphertext);
  var cipherbuf = new Buffer(cipherhex, 'hex');
  var encrypted = Buffer.concat([iv, cipherbuf]);

  return encrypted;
};

Message._decrypt = function(ebuf, pbuf) {
  var iv = ebuf.slice(0, 16);
  var encrypted = ebuf.slice(16);

  var cencrypted = CryptoJS.enc.Hex.parse(encrypted.toString('hex'));
  var cpbuf = CryptoJS.enc.Hex.parse(pbuf.toString('hex'));
  var civ = CryptoJS.enc.Hex.parse(iv.toString('hex'));
  
  var aesDecryptor = CryptoJS.algo.AES.createDecryptor(cpbuf, { iv: civ });

  var t1 = aesDecryptor.process(cencrypted);
  var t2 = aesDecryptor.finalize();

  var hex = String(t1) + String(t2);

  var unencrypted = new Buffer(hex, 'hex');

  return unencrypted;
};

module.exports = require('soop')(Message);
