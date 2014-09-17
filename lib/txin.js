var BufferReader = require('./bufferreader');
var BufferWriter = require('./bufferwriter');
var Varint = require('./varint');
var Script = require('./script');

var Txin = function Txin(txidbuf, txoutnum, varint, script, seqnum) {
  if (!(this instanceof Txin))
    return new Txin(txidbuf, txoutnum, varint, script, seqnum);
  if (Buffer.isBuffer(txidbuf)) {
    this.txidbuf = txidbuf;
    this.txoutnum = txoutnum;
    this.varint = varint;
    this.script = script;
    this.seqnum = seqnum;
  } else if (txidbuf) {
    var obj = txidbuf;
    this.set(obj);
  }
};

Txin.prototype.set = function(obj) {
  this.txidbuf = obj.txidbuf || this.txidbuf;
  this.txoutnum = typeof obj.txoutnum !== 'undefined' ? obj.txoutnum : this.txoutnum;
  this.varint = typeof obj.varint !== 'undefined' ? obj.varint : this.varint;
  this.script = obj.script || this.script;
  this.seqnum = typeof obj.seqnum !== 'undefined' ? obj.seqnum : this.seqnum;
  return this;
};

Txin.prototype.fromBuffer = function(buf) {
  return this.fromBufferReader(BufferReader(buf));
};

Txin.prototype.fromBufferReader = function(br) {
  this.txidbuf = br.read(32);
  this.txoutnum = br.readUInt32LE();
  this.varint = Varint(br.readVarintBuf());
  this.script = Script().fromBuffer(br.read(this.varint.toNumber()));
  this.seqnum = br.readUInt32LE();
  return this;
};

Txin.prototype.toBuffer = function() {
  return this.toBufferWriter().concat();
};

Txin.prototype.toBufferWriter = function(bw) {
  if (!bw)
    bw = new BufferWriter();
  bw.write(this.txidbuf);
  bw.writeUInt32LE(this.txoutnum);
  bw.write(this.varint.buf);
  bw.write(this.script.toBuffer());
  bw.writeUInt32LE(this.seqnum);
  return bw;
};

module.exports = Txin;
