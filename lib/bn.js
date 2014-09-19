var _BN = require('bn.js');

var BN = function BN_extended(n) {
  if (!(this instanceof BN_extended)) {
    return new BN(n);
  }
  arguments[0] = n;
  return _BN.apply(this, arguments);
};

module.exports = BN;

BN.prototype = _BN.prototype;

var reversebuf = function(buf, nbuf) {
  for (var i = 0; i < buf.length; i++) {
    nbuf[i] = buf[buf.length-1-i];
  }
};

BN.prototype.toJSON = function() {
  return this.toString();
};

BN.prototype.fromJSON = function(str) {
  var bn = BN(str);
  bn.copy(this);
  return this;
};

BN.prototype.fromString = function(str) {
  var bn = BN(str);
  bn.copy(this);
  return this;
};

BN.fromBuffer = function(buf, opts) {
  if (typeof opts !== 'undefined' && opts.endian === 'little') {
    var nbuf = new Buffer(buf.length);
    reversebuf(buf, nbuf);
    buf = nbuf;
  }
  var hex = buf.toString('hex');
  if (hex.length % 2)
    hex = "0" + hex;
  var bn = new BN(hex, 16);
  return bn;
};

BN.prototype.fromBuffer = function(buf, opts) {
  var bn = BN.fromBuffer(buf, opts);
  bn.copy(this);

  return this;
};

BN.prototype.toBuffer = function(opts) {
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
  BN.prototype['_' + name] = _BN.prototype[name];
  var f = function(b) {
    if (typeof b === 'string')
      b = new _BN(b);
    else if (typeof b === 'number')
      b = new _BN(b.toString());
    return this['_' + name](b);
  };
  BN.prototype[name] = f;
};

_BN.prototype.gt = function(b) {
  return this.cmp(b) > 0;
};

_BN.prototype.lt = function(b) {
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

BN.prototype.toNumber = function() {
  return parseInt(this['toString'](10), 10);
};

module.exports = BN;
