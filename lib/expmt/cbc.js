var Random = require('../random');

var CBC = function CBC(blockcipherf, keybuf, ivbuf) {
  if (!(this instanceof CBC))
    return new CBC(blockcipherf, keybuf, ivbuf);
  this.blockcipherf = blockcipherf;
  this.keybuf = keybuf;
  this.ivbuf = ivbuf;
};

CBC.pkcs7pad = function(buf, blocksize) {
  var bytesize = blocksize / 8;
  var padbytesize = bytesize - buf.length;
  var pad = new Buffer(padbytesize);
  pad.fill(padbytesize);
  return Buffer.concat([buf, pad]);
};

CBC.xorbufs = function(buf1, buf2) {
  if (buf1.length !== buf2.length)
    throw new Error('bufs must have the same length');

  var buf = new Buffer(buf1.length);

  for (var i = 0; i < buf1.length; i++) {
    buf[i] = buf1[i] ^ buf2[i];
  }

  return buf;
};

module.exports = CBC;
