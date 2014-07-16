var _bnjs = require('bn.js');

var bnjs = function bnjs_extended(n) {
  if (!(this instanceof bnjs_extended)) {
    return new bnjs(n);
  }
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

function decorate(name) {
  bnjs.prototype['_' + name] = _bnjs.prototype[name];
  var f = function(b) {
    if (typeof b === 'string')
      b = new _bnjs(b);
    else if (typeof b === 'number')
      b = new _bnjs(b.toString());
    return this['_' + name](b);
  };
  bnjs.prototype[name] = f;
};

_bnjs.prototype.gt = function(b) {
  return this.cmp(b) > 0;
};

_bnjs.prototype.lt = function(b) {
  return this.cmp(b) < 0;
};

decorate('add');
decorate('sub');
decorate('mul');
decorate('mod');
decorate('div');
decorate('cmp');
decorate('gt');
decorate('lt');

bnjs.prototype.toNumber = function() {
  return parseInt(this['toString'](10), 10);
};

module.exports = bnjs;
