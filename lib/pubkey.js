var point = require('./point');
var bn = require('./bn');

var Pubkey = function(p) {
  if (p && !p.getX() && !p.getY())
    throw new Error('pubkey: Invalid point');
  this.p = p;
};

Pubkey.prototype.fromDER = function(buf) {
  if (buf[0] == 0x04) {
    var xbuf = buf.slice(1, 33);
    var ybuf = buf.slice(33, 65);
    if (xbuf.length !== 32 || ybuf.length !== 32 || buf.length !== 65)
      throw new Error('pubkey: Length of x and y must be 32 bytes');
    var x = bn(xbuf);
    var y = bn(ybuf);
    this.p = point(x, y);
  } else if (buf[0] == 0x03) {
    var xbuf = buf.slice(1);
    var x = bn(xbuf);
    this.fromX(true, x);
  } else if (buf[0] == 0x02) {
    var xbuf = buf.slice(1);
    var x = bn(xbuf);
    this.fromX(false, x);
  } else {
    throw new Error('pubkey: Invalid DER format pubkey');
  }
};

Pubkey.prototype.fromString = function(str) {
  this.fromDER(new Buffer(str, 'hex'));
};

Pubkey.prototype.fromX = function(odd, x) {
  if (typeof odd !== 'boolean')
    throw new Error('pubkey: Must specify whether y is odd or not (true or false)');
  this.p = point.fromX(odd, x);
};

Pubkey.prototype.toDER = function(compressed) {
  if (typeof compressed !== 'boolean')
    throw new Error('pubkey: Must specify whether the public key is compressed or not (true or false)');

  var x = this.p.getX();
  var y = this.p.getY();

  var xbuf = x.toBuffer({size: 32});
  var ybuf = y.toBuffer({size: 32});

  if (!compressed) {
    var prefix = new Buffer([0x04]);
    return Buffer.concat([prefix, xbuf, ybuf]);
  } else {
    var odd = ybuf[ybuf.length - 1] % 2;
    if (odd)
      var prefix = new Buffer([0x03]);
    else
      var prefix = new Buffer([0x02]);
    return Buffer.concat([prefix, xbuf]);
  }
};

Pubkey.prototype.toString = function() {
  return this.toDER(true).toString('hex');
};

//https://www.iacr.org/archive/pkc2003/25670211/25670211.pdf
Pubkey.prototype.validate = function() {
  if (this.p.isInfinity())
    throw new Error('point: Point cannot be equal to Infinity');
  if (this.p.eq(point(bn(0), bn(0))))
    throw new Error('point: Point cannot be equal to 0, 0');
  this.p.validate();
  return this;
};

module.exports = Pubkey;
