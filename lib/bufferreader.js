var BN = require('./bn');

var BufferReader = function BufferReader(buf, pos) {
  if (!(this instanceof BufferReader))
    return new BufferReader(buf);
  this.buf = buf;
  this.pos = pos || 0;
};

BufferReader.prototype.eof = function eof() {
  return this.pos >= this.buf.length;
};

BufferReader.prototype.read = function() {
  var buf = this.buf.slice(this.pos);
  this.pos = this.buf.length;
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
  var reversebuf = BufferReader(buf).reverse().read();
  var bn = BN().fromBuffer(reversebuf);
  this.pos = this.pos + 8;
  return bn;
};

BufferReader.prototype.readVarInt = function() {
  var first = this.readUInt8();
  switch (first) {
    case 0xFD:
      return this.readUInt16LE();
    case 0xFE:
      return this.readUInt32LE();
    case 0xFF:
      return this.readUInt64LEBN().toNumber();
    default:
      return first;
  }
};

BufferReader.prototype.readVarIntBN = function() {
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
    buf[i] = this.buf[this.buf.length - 1 - i]
  this.buf = buf;
  return this;
};

module.exports = BufferReader;
