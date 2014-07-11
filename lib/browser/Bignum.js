var _bnjs = require('bn.js');

var bnjs = function bnjs_extended(n) {
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

bnjs.prototype._add = _bnjs.prototype.add;

bnjs.prototype.add = function(b) {
  if (typeof b === 'number')
    b = b.toString();
  if (typeof b === 'number' || typeof b === 'string')
    b = new _bnjs(b);
  return this._add(b);
};

bnjs.prototype._sub = _bnjs.prototype.sub;

bnjs.prototype.sub = function(b) {
  if (typeof b === 'number')
    b = b.toString();
  if (typeof b === 'number' || typeof b === 'string')
    b = new _bnjs(b);
  return this._sub(b);
};

bnjs.prototype._mul = _bnjs.prototype.mul;

bnjs.prototype.mul = function(b) {
  if (typeof b === 'number')
    b = b.toString();
  if (typeof b === 'number' || typeof b === 'string')
    b = new _bnjs(b);
  return this._mul(b);
};

bnjs.prototype._mod = _bnjs.prototype.mod;

bnjs.prototype.mod = function(b) {
  if (typeof b === 'number')
    b = b.toString();
  if (typeof b === 'number' || typeof b === 'string')
    b = new _bnjs(b);
  return this._mod(b);
};

bnjs.prototype._div = _bnjs.prototype.div;

bnjs.prototype.div = function(b) {
  if (typeof b === 'number')
    b = b.toString();
  if (typeof b === 'number' || typeof b === 'string')
    b = new _bnjs(b);
  return this._div(b);
};

bnjs.prototype._cmp = _bnjs.prototype.cmp;

bnjs.prototype.cmp = function(b) {
  if (typeof b === 'number')
    b = b.toString();
  if (typeof b === 'number' || typeof b === 'string')
    b = new _bnjs(b);
  return this._cmp(b);
};

bnjs.prototype.gt = function(b) {
  if (typeof b === 'number')
    b = b.toString();
  if (typeof b === 'number' || typeof b === 'string')
    b = new _bnjs(b);
  return this.cmp(b) > 0;
};

bnjs.prototype.lt = function(b) {
  if (typeof b === 'number')
    b = b.toString();
  if (typeof b === 'number' || typeof b === 'string')
    b = new _bnjs(b);
  return this.cmp(b) < 0;
};

bnjs.prototype.toNumber = function() {
  return parseInt(this['toString'](10), 10);
};

module.exports = bnjs;
