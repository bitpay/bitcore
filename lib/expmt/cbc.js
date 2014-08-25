var Random = require('../random');

// http://en.wikipedia.org/wiki/Block_cipher_mode_of_operation#Cipher-block_chaining_.28CBC.29
var CBC = function CBC(blockcipher, cipherkeybuf, ivbuf) {
  if (!(this instanceof CBC))
    return new CBC(blockcipher, cipherkeybuf, ivbuf);

  this.blockcipher = blockcipher;
  this.cipherkeybuf = cipherkeybuf;
  this.ivbuf = ivbuf;
};

CBC.buf2blockbufs = function(buf, blocksize) {
  var bytesize = blocksize / 8;
  var blockbufs = [];

  for (var i = 0; i <= buf.length / bytesize; i++) {
    var blockbuf = buf.slice(i * bytesize, i * bytesize + bytesize);

    if (blockbuf.length < blocksize)
      blockbuf = CBC.pkcs7pad(blockbuf, blocksize);

    blockbufs.push(blockbuf);
  }

  return blockbufs;
};

CBC.encrypt = function(messagebuf, ivbuf, blockcipher, cipherkeybuf) {
  var blocksize = ivbuf.length * 8;
  var blockbufs = CBC.buf2blockbufs(messagebuf, blocksize);
  var encbufs = CBC.encryptblocks(blockbufs, ivbuf, blockcipher, cipherkeybuf);
  var enc = Buffer.concat(encbufs);
  return enc;
};

CBC.encryptblock = function(blockbuf, ivbuf, blockcipher, cipherkeybuf) {
  var xorbuf = CBC.xorbufs(blockbuf, ivbuf);
  var encbuf = blockcipher.encrypt(xorbuf, cipherkeybuf);
  return encbuf;
};

CBC.encryptblocks = function(blockbufs, ivbuf, blockcipher, cipherkeybuf) {
  var encbufs = [];

  for (var i = 0; i < blockbufs.length; i++) {
    var blockbuf = blockbufs[i];
    var encbuf = CBC.encryptblock(blockbuf, ivbuf, blockcipher, cipherkeybuf);

    encbufs.push(encbuf);

    ivbuf = encbuf;
  }

  return encbufs;
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
