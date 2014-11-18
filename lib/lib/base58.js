var bs58 = require('bs58');

var Base58 = function Base58(obj) {
  if (!(this instanceof Base58))
    return new Base58(obj);
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

Base58.prototype.set = function(obj) {
  this.buf = obj.buf || this.buf || undefined;
  return this;
};

Base58.encode = function(buf) {
  if (!Buffer.isBuffer(buf))
    throw new Error('Input should be a buffer');
  return bs58.encode(buf);
};

Base58.decode = function(str) {
  if (typeof str !== 'string')
    throw new Error('Input should be a string');
  return bs58.decode(str);
};

Base58.prototype.fromBuffer = function(buf) {
  this.buf = buf;
  return this;
};

Base58.prototype.fromString = function(str) {
  var buf = Base58.decode(str);
  this.buf = buf;
  return this;
};

Base58.prototype.toBuffer = function() {
  return this.buf;
};

Base58.prototype.toString = function() {
  return Base58.encode(this.buf);
};

module.exports = Base58;
