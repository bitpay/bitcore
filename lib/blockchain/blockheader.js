var BufferReader = require('./bufferreader');
var BufferWriter = require('./bufferwriter');

var Blockheader = function Blockheader(version, prevblockidbuf, merklerootbuf, time, bits, nonce) {
  if (!(this instanceof Blockheader))
    return new Blockheader(version, prevblockidbuf, merklerootbuf, time, bits, nonce);
  if (typeof version === 'number') {
    this.set({
      version: version,
      prevblockidbuf: prevblockidbuf,
      merklerootbuf: merklerootbuf,
      time: time,
      bits: bits,
      nonce: nonce
    });
  } else if (Buffer.isBuffer(version)) {
    var bhbuf = version;
    this.fromBuffer(bhbuf);
  } else if (version) {
    var obj = version;
    this.set(obj);
  }
}

Blockheader.prototype.set = function(obj) {
  this.version = typeof obj.version !== 'undefined' ? obj.version : this.version;
  this.prevblockidbuf = obj.prevblockidbuf || this.prevblockidbuf;
  this.merklerootbuf = obj.merklerootbuf || this.merklerootbuf;
  this.time = typeof obj.time !== 'undefined' ? obj.time : this.time;
  this.bits = typeof obj.bits !== 'undefined' ? obj.bits : this.bits;
  this.nonce = typeof obj.nonce !== 'undefined' ? obj.nonce : this.nonce;
  return this;
};

Blockheader.prototype.fromJSON = function(json) {
  this.set({
    version: json.version,
    prevblockidbuf: new Buffer(json.prevblockidbuf, 'hex'),
    merklerootbuf: new Buffer(json.merklerootbuf, 'hex'),
    time: json.time,
    bits: json.bits,
    nonce: json.nonce
  });
  return this;
};

Blockheader.prototype.toJSON = function() {
  return {
    version: this.version,
    prevblockidbuf: this.prevblockidbuf.toString('hex'),
    merklerootbuf: this.merklerootbuf.toString('hex'),
    time: this.time,
    bits: this.bits,
    nonce: this.nonce
  };
};

Blockheader.prototype.fromBuffer = function(buf) {
  return this.fromBufferReader(BufferReader(buf));
};

Blockheader.prototype.fromBufferReader = function(br) {
  this.version = br.readUInt32LE();
  this.prevblockidbuf = br.read(32);
  this.merklerootbuf = br.read(32);
  this.time = br.readUInt32LE();
  this.bits = br.readUInt32LE();
  this.nonce = br.readUInt32LE();
  return this;
};

Blockheader.prototype.toBuffer = function() {
  return this.toBufferWriter().concat();
};

Blockheader.prototype.toBufferWriter = function(bw) {
  if (!bw)
    bw = new BufferWriter();
  bw.writeUInt32LE(this.version);
  bw.write(this.prevblockidbuf);
  bw.write(this.merklerootbuf);
  bw.writeUInt32LE(this.time);
  bw.writeUInt32LE(this.bits);
  bw.writeUInt32LE(this.nonce);
  return bw;
};

module.exports = Blockheader;
