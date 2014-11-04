var BN = require('./bn');

var BufferReader = function BufferReader(buf) {
  if (!(this instanceof BufferReader))
    return new BufferReader(buf);
  if (Buffer.isBuffer(buf)) {
    this.set({buf: buf});
  }
  else if (buf) {
    var obj = buf;
    this.set(obj);
  }
};

BufferReader.prototype.set = function(obj) {
  this.buf = obj.buf || this.buf || undefined;
  this.pos = obj.pos || this.pos || 0;
  return this;
};

BufferReader.prototype.eof = function() {
  return this.pos >= this.buf.length;
};

BufferReader.prototype.read = function(len) {
  if (!len)
    var len = this.buf.length;
  var buf = this.buf.slice(this.pos, this.pos + len);
  this.pos = this.pos + len;
  return buf;
};

BufferReader.prototype.readUInt8 = function() {
  var val = this.buf.readUInt8(this.pos);
  this.pos = this.pos + 1;
  return val;
};

BufferReader.prototype.readUInt16BE = function() {
  var val = this.buf.readUInt16BE(this.pos);
  this.pos = this.pos + 2;
  return val;
};

BufferReader.prototype.readUInt16LE = function() {
  var val = this.buf.readUInt16LE(this.pos);
  this.pos = this.pos + 2;
  return val;
};

BufferReader.prototype.readUInt32BE = function() {
  var val = this.buf.readUInt32BE(this.pos);
  this.pos = this.pos + 4;
  return val;
};

BufferReader.prototype.readUInt32LE = function() {
  var val = this.buf.readUInt32LE(this.pos);
  this.pos = this.pos + 4;
  return val;
};

BufferReader.prototype.readUInt64BEBN = function() {
  var buf = this.buf.slice(this.pos, this.pos + 8);
  var bn = BN().fromBuffer(buf);
  this.pos = this.pos + 8;
  return bn;
};

BufferReader.prototype.readUInt64LEBN = function() {
  var buf = this.buf.slice(this.pos, this.pos + 8);
  var reversebuf = BufferReader({buf: buf}).reverse().read();
  var bn = BN().fromBuffer(reversebuf);
  this.pos = this.pos + 8;
  return bn;
};

BufferReader.prototype.readVarintNum = function() {
  var first = this.readUInt8();
  switch (first) {
    case 0xFD:
      return this.readUInt16LE();
    case 0xFE:
      return this.readUInt32LE();
    case 0xFF:
      var bn = this.readUInt64LEBN();
      var n = bn.toNumber();
      if (n <= Math.pow(2, 53))
        return n;
      else
        throw new Error('number too large to retain precision - use readVarintBN');
    default:
      return first;
  }
};

BufferReader.prototype.readVarintBuf = function() {
  var first = this.buf.readUInt8(this.pos);
  switch (first) {
    case 0xFD:
      return this.read(1 + 2);
    case 0xFE:
      return this.read(1 + 4);
    case 0xFF:
      return this.read(1 + 8);
    default:
      return this.read(1);
  }
};

BufferReader.prototype.readVarintBN = function() {
  var first = this.readUInt8();
  switch (first) {
    case 0xFD:
      return BN(this.readUInt16LE());
    case 0xFE:
      return BN(this.readUInt32LE());
    case 0xFF:
      return this.readUInt64LEBN();
    default:
      return BN(first);
  }
};

BufferReader.prototype.reverse = function() {
  var buf = new Buffer(this.buf.length);
  for (var i = 0; i < buf.length; i++)
    buf[i] = this.buf[this.buf.length - 1 - i];
  this.buf = buf;
  return this;
};

module.exports = BufferReader;
