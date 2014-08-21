var BN = require('./bn');

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

BufferWriter.prototype.writeUInt64BEBN = function(bn) {
  var buf = bn.toBuffer({size: 8});
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeUInt64LEBN = function(bn) {
  var buf = bn.toBuffer({size: 8});
  var reversebuf = new Buffer(Array.apply(new Array(), buf).reverse());
  this.write(reversebuf);
  return this;
};

BufferWriter.prototype.writeVarInt = function(n) {
  var buf = BufferWriter.varIntBuf(n);
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeVarIntBN = function(bn) {
  var buf = BufferWriter.varIntBufBN(bn);
  this.write(buf);
  return this;
};

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

BufferWriter.varIntBufBN = function(bn) {
  var buf = undefined;
  var n = bn.toNumber();
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
    var bw = new BufferWriter();
    bw.writeUInt8(255);
    bw.writeUInt64LEBN(bn);
    var buf = bw.concat();
  }
  return buf;
};

module.exports = BufferWriter;
