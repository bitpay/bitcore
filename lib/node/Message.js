var imports = require('soop');
var crypto = imports.crypto || require('crypto');

var Message = require('../common/Message');

// Encrypt a buffer with a buffer password and buffer iv
Message._encrypt = function(mbuf, pbuf, iv) {
  var cipher = crypto.createCipheriv('aes256', pbuf, iv);
  var encrypted = new Buffer(cipher.update(mbuf));
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  var r = Buffer.concat([iv, encrypted]);
  return r;
};

Message._decrypt = function(ebuf, pbuf) {
  var iv = ebuf.slice(0, 16);
  var cipher = crypto.createDecipheriv('aes256', pbuf, iv);
  var unencrypted = new Buffer(cipher.update(ebuf.slice(16)));
  unencrypted = Buffer.concat([unencrypted, cipher.final()]);

  return unencrypted;
};

module.exports = require('soop')(Message);
