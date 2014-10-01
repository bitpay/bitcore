var Random = require('../random');

// Cipher Block Chaining
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

CBC.blockbufs2buf = function(blockbufs, blocksize) {
  var bytesize = blocksize / 8;

  var last = blockbufs[blockbufs.length - 1];
  last = CBC.pkcs7unpad(last);
  blockbufs[blockbufs.length - 1] = last;

  var buf = Buffer.concat(blockbufs);

  return buf;
};

CBC.encrypt = function(messagebuf, ivbuf, blockcipher, cipherkeybuf) {
  var blocksize = ivbuf.length * 8;
  var blockbufs = CBC.buf2blockbufs(messagebuf, blocksize);
  var encbufs = CBC.encryptblocks(blockbufs, ivbuf, blockcipher, cipherkeybuf);
  var encbuf = Buffer.concat(encbufs);
  return encbuf;
};

CBC.decrypt = function(encbuf, ivbuf, blockcipher, cipherkeybuf) {
  var blocksize = ivbuf.length * 8;
  var bytesize = ivbuf.length;
  var encbufs = [];
  for (var i = 0; i < encbuf.length / bytesize; i++) {
    encbufs.push(encbuf.slice(i * bytesize, i * bytesize + bytesize));
  }
  var blockbufs = CBC.decryptblocks(encbufs, ivbuf, blockcipher, cipherkeybuf);
  var buf = CBC.blockbufs2buf(blockbufs, blocksize);
  return buf;
};

CBC.encryptblock = function(blockbuf, ivbuf, blockcipher, cipherkeybuf) {
  var xorbuf = CBC.xorbufs(blockbuf, ivbuf);
  var encbuf = blockcipher.encrypt(xorbuf, cipherkeybuf);
  return encbuf;
};

CBC.decryptblock = function(encbuf, ivbuf, blockcipher, cipherkeybuf) {
  var xorbuf = blockcipher.decrypt(encbuf, cipherkeybuf);
  var blockbuf = CBC.xorbufs(xorbuf, ivbuf);
  return blockbuf;
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

CBC.decryptblocks = function(encbufs, ivbuf, blockcipher, cipherkeybuf) {
  var blockbufs = [];

  for (var i = 0; i < encbufs.length; i++) {
    var encbuf = encbufs[i];
    var blockbuf = CBC.decryptblock(encbuf, ivbuf, blockcipher, cipherkeybuf);

    blockbufs.push(blockbuf);

    ivbuf = encbuf;
  }

  return blockbufs;
};

CBC.pkcs7pad = function(buf, blocksize) {
  var bytesize = blocksize / 8;
  var padbytesize = bytesize - buf.length;
  var pad = new Buffer(padbytesize);
  pad.fill(padbytesize);
  var paddedbuf = Buffer.concat([buf, pad]);
  return paddedbuf;
};

CBC.pkcs7unpad = function(paddedbuf, blocksize) {
  var bytesize = blocksize / 8;
  var padbytesize = bytesize - paddedbuf.length;
  var padlength = paddedbuf[paddedbuf.length - 1];
  var padbuf = paddedbuf.slice(paddedbuf.length - padlength, paddedbuf.length);
  var padbuf2 = new Buffer(padlength);
  padbuf2.fill(padlength);
  if (padbuf.toString('hex') !== padbuf2.toString('hex'))
    throw new Error('invalid padding');
  return paddedbuf.slice(0, paddedbuf.length - padlength);
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
