var bnjs = require('bn.js');

var _bnjs = bnjs;

bnjs = function bnjs_extended(n) {
  if (!(this instanceof bnjs_extended)) {
    return new bnjs(n);
  }
  if (typeof n === 'number')
    n = n.toString();
  arguments[0] = n;
  return _bnjs.apply(this, arguments);
};

bnjs.prototype = _bnjs.prototype;

var reversebuf = function(buf, nbuf) {
    for (var i = 0; i < buf.length; i++) {
      nbuf[i] = buf[buf.length-1-i];
    }
};

bnjs.fromBuffer = function(buf, opts) {
  if (typeof opts !== 'undefined' && opts.endian === 'little') {
    var nbuf = new Buffer(buf.length);
    reversebuf(buf, nbuf);
    buf = nbuf;
  }
  var hex = buf.toString('hex');
  if (hex.length % 2)
    hex = "0" + hex;
  var bn = new bnjs(hex, 16);
  return bn;
};

bnjs.prototype.toBuffer = function(opts) {
  var buf;
  if (opts && opts.size) {
    var hex = this.toString(16);
    if (hex.length % 2)
      hex = "0" + hex;
    var natlen = hex.length/2;
    buf = new Buffer(hex, 'hex');

    if (natlen == opts.size)
      buf = buf;

    else if (natlen > opts.size) {
      buf = buf.slice(natlen - buf.length, buf.length);
    }

    else if (natlen < opts.size) {
      var rbuf = new Buffer(opts.size);
      //rbuf.fill(0);
      for (var i = 0; i < buf.length; i++)
        rbuf[rbuf.length-1-i] = buf[buf.length-1-i];
      for (var i = 0; i < opts.size - natlen; i++)
        rbuf[i] = 0;
      buf = rbuf;
    }
  }
  else {
    var hex = this.toString(16);
    if (hex.length % 2)
      hex = "0" + hex;
    buf = new Buffer(hex, 'hex');
  }

  if (typeof opts !== 'undefined' && opts.endian === 'little') {
    var nbuf = new Buffer(buf.length);
    reversebuf(buf, nbuf);
    buf = nbuf;
  }

  return buf;
};

bnjs.prototype.gt = function(b) {
  if (typeof b === 'number')
    b = new bnjs(b);
  return this.cmp(b) > 0;
};

bnjs.prototype.lt = function(b) {
  if (typeof b === 'number')
    b = new bnjs(b);
  return this.cmp(b) < 0;
};

bnjs.prototype.toNumber = function() {
  return parseInt(this['toString'](10), 10);
};

bnjs.prototype.pow = function ( e ) {

/*
  // e to integer, avoiding NaN or Infinity becoming 0.
  var i = e * 0 == 0 ? e | 0 : e,
      x = new bnjs(this.toString(), 16),
      y = new bnjs(1);

  for (i = i < 0 ? -i : i; ;) {

    if (i & 1) {
      y = y.mul(x);
    }
    i >>= 1;

    if (!i) {
      break;
    }
    x = x.mul(x);
  }

  return e < 0 ? (new bnjs(1)).mul(y) : y;
*/
};

module.exports = bnjs;
