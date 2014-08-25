var Random = require('../random');

// http://en.wikipedia.org/wiki/Block_cipher_mode_of_operation#Cipher-block_chaining_.28CBC.29
var CBC = function CBC(blockcipherf, keybuf, ivbuf) {
  if (!(this instanceof CBC))
    return new CBC(blockcipherf, keybuf, ivbuf);

  this.blockcipherf = blockcipherf;
  this.keybuf = keybuf;
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

CBC.encrypt = function(messagebuf, ivbuf, blockcipherf, keybuf) {
  var blocksize = ivbuf.length * 8;
  var blockbufs = CBC.buf2blockbufs(messagebuf, blocksize);
  var encbufs = CBC.encryptblocks(blockbufs, ivbuf, blockcipherf, keybuf);
  var enc = Buffer.concat(encbufs);
  return enc;
};

CBC.encryptblock = function(blockbuf, ivbuf, blockcipherf, keybuf) {
  var xorbuf = CBC.xorbufs(blockbuf, ivbuf);
  var encbuf = blockcipherf(xorbuf, keybuf);
  return encbuf;
};

CBC.encryptblocks = function(blockbufs, ivbuf, blockcipherf, keybuf) {
  var encbufs = [];

  for (var i = 0; i < blockbufs.length; i++) {
    var blockbuf = blockbufs[i];
    var encbuf = CBC.encryptblock(blockbuf, ivbuf, blockcipherf, keybuf);

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
