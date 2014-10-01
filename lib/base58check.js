var base58 = require('./base58');
var sha256sha256 = require('./hash').sha256sha256;

var Base58Check = function Base58Check(obj) {
  if (!(this instanceof Base58Check))
    return new Base58Check(obj);
  if (Buffer.isBuffer(obj)) {
    var buf = obj;
    this.fromBuffer(buf);
  } else if (typeof obj === 'string') {
    var str = obj;
    this.fromString(str);
  } else if (obj) {
    this.set(obj);
  }
};

Base58Check.prototype.set = function(obj) {
  this.buf = obj.buf || this.buf || undefined;
  return this;
};

Base58Check.decode = function(s) {
  if (typeof s !== 'string')
    throw new Error('Input must be a string');

  var buf = base58.decode(s);

  if (buf.length < 4)
    throw new Error("Input string too short");

  var data = buf.slice(0, -4);
  var csum = buf.slice(-4);

  var hash = sha256sha256(data);
  var hash4 = hash.slice(0, 4);

  if (csum.toString('hex') !== hash4.toString('hex'))
    throw new Error("Checksum mismatch");

  return data;
};

Base58Check.encode = function(buf) {
  if (!Buffer.isBuffer(buf))
    throw new Error('Input must be a buffer');
  var checkedBuf = new Buffer(buf.length + 4);
  var hash = sha256sha256(buf);
  buf.copy(checkedBuf);
  hash.copy(checkedBuf, buf.length);
  return base58.encode(checkedBuf);
};

Base58Check.prototype.fromBuffer = function(buf) {
  this.buf = buf;
  return this;
};

Base58Check.prototype.fromString = function(str) {
  var buf = Base58Check.decode(str);
  this.buf = buf;
  return this;
};

Base58Check.prototype.toBuffer = function() {
  return this.buf;
};

Base58Check.prototype.toString = function() {
  return Base58Check.encode(this.buf);
};

module.exports = Base58Check;
