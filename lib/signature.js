var bn = require('./bn');

var Signature = function(r, s) {
  this.r = r;
  this.s = s;
};

Signature.prototype.fromCompressed = function(buf) {
  var b1 = buf.slice(0, 1)[0];
  var b2 = buf.slice(1, 33);
  var b3 = buf.slice(33, 65);

  if (!(b1 === 0 || b1 === 1 || b1 === 2 || b1 === 3))
    throw new Error('signature: i must be 0, 1, 2, or 3');
  if (b2.length !== 32)
    throw new Error('signature: r must be 32 bytes');
  if (b3.length !== 32)
    throw new Error('signature: s must be 32 bytes');

  this.r = bn.fromBuffer(b2);
  this.s = bn.fromBuffer(b3);
};

Signature.prototype.fromDER = function(buf) {
  var obj = Signature.parseDER(buf);
  this.r = obj.r;
  this.s = obj.s;
};

Signature.prototype.fromString = function(str) {
  var buf = new Buffer(str, 'hex');
  this.fromDER(buf);
};

Signature.parseDER = function(buf) {
  if (!Buffer.isBuffer(buf))
    throw new Error('signature: DER formatted signature should be a buffer');

  var header = buf[0];

  if (header !== 0x30)
    throw new Error('signature: Header byte should be 0x30');

  var length = buf[1];
  if (length !== buf.slice(2).length)
    throw new Error('signature: Length byte should length of what follows');

  var rheader = buf[2 + 0];
  if (rheader !== 0x02)
    throw new Error('signature: Integer byte for r should be 0x02');

  var rlength = buf[2 + 1];
  var rbuf = buf.slice(2 + 2, 2 + 2 + rlength);
  var r = bn.fromBuffer(rbuf);
  var rneg = buf[2 + 1 + 1] === 0x00 ? true : false;
  if (rlength !== rbuf.length)
    throw new Error('signature: Length of r incorrect');

  var sheader = buf[2 + 2 + rlength + 0];
  if (sheader !== 0x02)
    throw new Error('signature: Integer byte for s should be 0x02');

  var slength = buf[2 + 2 + rlength + 1];
  var sbuf = buf.slice(2 + 2 + rlength + 2, 2 + 2 + rlength + 2 + slength);
  var s = bn.fromBuffer(sbuf);
  var sneg = buf[2 + 2 + rlength + 2 + 2] === 0x00 ? true : false;
  if (slength !== sbuf.length)
    throw new Error('signature: Length of s incorrect');

  var sumlength = 2 + 2 + rlength + 2 + slength;
  if (length !== sumlength - 2)
    throw new Error('signature: Length of signature incorrect');

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

Signature.prototype.toCompressed = function(i) {
  if (!(i === 0 || i === 1 || i ===2 || i ===3))
    throw new Error('signature: i must be equal to 0, 1, 2, or 3');
  
  var b1 = new Buffer([i]);
  var b2 = this.r.toBuffer({size: 32});
  var b3 = this.s.toBuffer({size: 32});
  return Buffer.concat([b1, b2, b3]);
};

Signature.prototype.toDER = function() {
  var rnbuf = this.r.toBuffer();
  var snbuf = this.s.toBuffer();

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

Signature.prototype.toString = function() {
  var buf = this.toDER();
  return buf.toString('hex');
};
module.exports = Signature;
