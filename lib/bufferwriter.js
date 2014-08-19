var BufferWriter = function BufferWriter(bufs) {
  if (!(this instanceof BufferWriter))
    return new BufferReader(buf);
  this.bufs = bufs || [];
};

BufferWriter.prototype.concat = function() {
  return Buffer.concat(this.bufs);
};

BufferWriter.prototype.write = function(buf) {
  this.bufs.push(buf);
  return this;
};

BufferWriter.prototype.writeUInt8 = function(n) {
  var buf = new Buffer(1);
  buf.writeUInt8(n, 0);
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeUInt16BE = function(n) {
  var buf = new Buffer(2);
  buf.writeUInt16BE(n, 0);
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeUInt16LE = function(n) {
  var buf = new Buffer(2);
  buf.writeUInt16LE(n, 0);
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeUInt32BE = function(n) {
  var buf = new Buffer(4);
  buf.writeUInt32BE(n, 0);
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeUInt32LE = function(n) {
  var buf = new Buffer(4);
  buf.writeUInt32LE(n, 0);
  this.write(buf);
  return this;
};

//TODO: What if n is so large that it loses precision?
BufferWriter.prototype.writeUInt64BE = function(n) {
  var buf = new Buffer(8);
  buf.writeInt32BE(n & -1, 4);
  buf.writeUInt32BE(Math.floor(n / 0x100000000), 0);
  this.write(buf);
  return this;
};

//TODO: What if n is so large that it loses precision?
BufferWriter.prototype.writeUInt64LE = function(n) {
  var buf = new Buffer(8);
  buf.writeInt32LE(n & -1, 0);
  buf.writeUInt32LE(Math.floor(n / 0x100000000), 4);
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeVarInt = function(n) {
  var buf = BufferWriter.varIntBuf(n);
  this.write(buf);
  return this;
};

//TODO: What if n is so large that it loses precision?
BufferWriter.varIntBuf = function(n) {
  var buf = undefined;
  if (n < 253) {
    buf = new Buffer(1);
    buf.writeUInt8(n, 0);
  } else if (n < 0x10000) {
    buf = new Buffer(1 + 2);
    buf.writeUInt8(253, 0);
    buf.writeUInt16LE(n, 1);
  } else if (n < 0x100000000) {
    buf = new Buffer(1 + 4);
    buf.writeUInt8(254, 0);
    buf.writeUInt32LE(n, 1);
  } else {
    buf = new Buffer(1 + 8);
    buf.writeUInt8(255, 0);
    buf.writeInt32LE(n & -1, 1);
    buf.writeUInt32LE(Math.floor(n / 0x100000000), 5);
  }
  return buf;
};

module.exports = BufferWriter;
