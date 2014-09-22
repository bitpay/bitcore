var BufferReader = require('./bufferreader');
var BufferWriter = require('./bufferwriter');
var Varint = require('./varint');
var Script = require('./script');

var Txin = function Txin(txidbuf, txoutnum, scriptvi, script, seqnum) {
  if (!(this instanceof Txin))
    return new Txin(txidbuf, txoutnum, scriptvi, script, seqnum);
  if (Buffer.isBuffer(txidbuf)) {
    if (txidbuf.length !== 32)
      throw new Error('txidbuf must be 32 bytes');
    this.txidbuf = txidbuf;
    this.txoutnum = txoutnum;
    this.scriptvi = scriptvi;
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
  this.scriptvi = typeof obj.scriptvi !== 'undefined' ? obj.scriptvi : this.scriptvi;
  this.script = obj.script || this.script;
  this.seqnum = typeof obj.seqnum !== 'undefined' ? obj.seqnum : this.seqnum;
  return this;
};

Txin.prototype.fromJSON = function(json) {
  this.set({
    txidbuf: new Buffer(json.txidbuf, 'hex'),
    txoutnum: json.txoutnum,
    scriptvi: Varint().fromJSON(json.scriptvi),
    script: Script().fromJSON(json.script),
    seqnum: json.seqnum
  });
  return this;
};

Txin.prototype.toJSON = function() {
  return {
    txidbuf: this.txidbuf.toString('hex'),
    txoutnum: this.txoutnum,
    scriptvi: this.scriptvi.toJSON(),
    script: this.script.toJSON(),
    seqnum: this.seqnum
  };
};

Txin.prototype.fromBuffer = function(buf) {
  return this.fromBufferReader(BufferReader(buf));
};

Txin.prototype.fromBufferReader = function(br) {
  this.txidbuf = br.read(32);
  this.txoutnum = br.readUInt32LE();
  this.scriptvi = Varint(br.readVarintBuf());
  this.script = Script().fromBuffer(br.read(this.scriptvi.toNumber()));
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
  bw.write(this.scriptvi.buf);
  bw.write(this.script.toBuffer());
  bw.writeUInt32LE(this.seqnum);
  return bw;
};

module.exports = Txin;
