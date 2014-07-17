var bignum = require('bignum');
var Key = function() {}

Key.parseDERsig = function(sig) {
  if (!Buffer.isBuffer(sig))
    throw new Error('DER formatted signature should be a buffer');

  var header = sig[0];

  if (header !== 0x30)
    throw new Error('Header byte should be 0x30');

  var length = sig[1];
  if (length !== sig.slice(2).length)
    throw new Error('Length byte should length of what follows');

  var rheader = sig[2 + 0];
  if (rheader !== 0x02)
    throw new Error('Integer byte for r should be 0x02');

  var rlength = sig[2 + 1];
  var rbuf = sig.slice(2 + 2, 2 + 2 + rlength);
  var r = bignum.fromBuffer(rbuf);
  var rneg = sig[2 + 1 + 1] === 0x00 ? true : false;
  if (rlength !== rbuf.length)
    throw new Error('Length of r incorrect');

  var sheader = sig[2 + 2 + rlength + 0];
  if (sheader !== 0x02)
    throw new Error('Integer byte for s should be 0x02');

  var slength = sig[2 + 2 + rlength + 1];
  var sbuf = sig.slice(2 + 2 + rlength + 2, 2 + 2 + rlength + 2 + slength);
  var s = bignum.fromBuffer(sbuf);
  var sneg = sig[2 + 2 + rlength + 2 + 2] === 0x00 ? true : false;
  if (slength !== sbuf.length)
    throw new Error('Length of s incorrect');

  var sumlength = 2 + 2 + rlength + 2 + slength;
  if (length !== sumlength - 2)
    throw new Error('Length of signature incorrect');


  var obj = {
    header: header,
    length: length,
    rheader: rheader,
    rlength: rlength,
    rneg: rneg,
    rbuf: rbuf,
    r: r,
    sheader: sheader,
    slength: slength,
    sneg: sneg,
    sbuf: sbuf,
    s: s
  };

  return obj;
};

Key.rs2DER = function(r, s) {
  var rnbuf = r.toBuffer();
  var snbuf = s.toBuffer();

  var rneg = rnbuf[0] & 0x80 ? true : false;
  var sneg = snbuf[0] & 0x80 ? true : false;

  var rbuf = rneg ? Buffer.concat([new Buffer([0x00]), rnbuf]) : rnbuf;
  var sbuf = sneg ? Buffer.concat([new Buffer([0x00]), snbuf]) : snbuf;

  var length = 2 + rbuf.length + 2 + sbuf.length;
  var rlength = rbuf.length;
  var slength = sbuf.length;
  var rheader = 0x02;
  var sheader = 0x02;
  var header = 0x30;

  var der = Buffer.concat([new Buffer([header, length, rheader, rlength]), rbuf, new Buffer([sheader, slength]), sbuf]);
  return der;
};

module.exports = Key;
