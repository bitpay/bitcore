var BN = require('./bn');
var Point = require('./point');
var Pubkey = require('./pubkey');

var Signature = function Signature(r, s) {
  if (!(this instanceof Signature))
    return new Signature(r, s);
  if (r instanceof BN) {
    this.set({
      r: r,
      s: s
    });
  }
  else if (r) {
    var obj = r;
    this.set(obj);
  }
};

Signature.prototype.set = function(obj) {
  this.r = obj.r || this.r || undefined;
  this.s = obj.s || this.s || undefined;
  this.i = typeof obj.i !== 'undefined' ? obj.i : this.i; //public key recovery parameter in range [0, 3]
  this.compressed = typeof obj.compressed !== 'undefined' ? obj.compressed : this.compressed; //whether the recovered pubkey is compressed
  return this;
};

Signature.prototype.fromCompact = function(buf) {
  var compressed = true;
  if (i < 0) {
    var compressed = false;
    i = i + 4;
  }

  var i = buf.slice(0, 1)[0] - 27 - 4; //TODO: handle uncompressed pubkeys

  var b2 = buf.slice(1, 33);
  var b3 = buf.slice(33, 65);

  if (!(i === 0 || i === 1 || i === 2 || i === 3))
    throw new Error('i must be 0, 1, 2, or 3');
  if (b2.length !== 32)
    throw new Error('r must be 32 bytes');
  if (b3.length !== 32)
    throw new Error('s must be 32 bytes');

  this.compressed = compressed;
  this.i = i;
  this.r = BN().fromBuffer(b2);
  this.s = BN().fromBuffer(b3);

  return this;
};

Signature.prototype.fromDER = function(buf) {
  var obj = Signature.parseDER(buf);
  this.r = obj.r;
  this.s = obj.s;

  return this;
};

Signature.prototype.fromString = function(str) {
  var buf = new Buffer(str, 'hex');
  this.fromDER(buf);

  return this;
};

Signature.parseDER = function(buf) {
  if (!Buffer.isBuffer(buf))
    throw new Error('DER formatted signature should be a buffer');

  var header = buf[0];

  if (header !== 0x30)
    throw new Error('Header byte should be 0x30');

  var length = buf[1];
  if (length !== buf.slice(2).length)
    throw new Error('Length byte should length of what follows');

  var rheader = buf[2 + 0];
  if (rheader !== 0x02)
    throw new Error('Integer byte for r should be 0x02');

  var rlength = buf[2 + 1];
  var rbuf = buf.slice(2 + 2, 2 + 2 + rlength);
  var r = BN().fromBuffer(rbuf);
  var rneg = buf[2 + 1 + 1] === 0x00 ? true : false;
  if (rlength !== rbuf.length)
    throw new Error('Length of r incorrect');

  var sheader = buf[2 + 2 + rlength + 0];
  if (sheader !== 0x02)
    throw new Error('Integer byte for s should be 0x02');

  var slength = buf[2 + 2 + rlength + 1];
  var sbuf = buf.slice(2 + 2 + rlength + 2, 2 + 2 + rlength + 2 + slength);
  var s = BN().fromBuffer(sbuf);
  var sneg = buf[2 + 2 + rlength + 2 + 2] === 0x00 ? true : false;
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

Signature.prototype.toCompact = function(i, compressed) {
  i = typeof i === 'number' ? i : this.i;
  compressed = typeof compressed === 'boolean' ? compressed : this.compressed;

  if (!(i === 0 || i === 1 || i === 2 || i === 3))
    throw new Error('i must be equal to 0, 1, 2, or 3');
  
  var val = i + 27 + 4;
  if (compressed === false)
    val = val - 4;
  var b1 = new Buffer([val]);
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
