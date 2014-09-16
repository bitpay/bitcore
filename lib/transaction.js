var Txin = require('./txin');
var Txout = require('./txout');
var BufferWriter = require('./bufferwriter');
var BufferReader = require('./bufferreader');
var Varint = require('./varint');

var Transaction = function Transaction(version, txinsvarint, txins, txoutsvarint, txouts, nlocktime) {
  if (!(this instanceof Transaction))
    return new Transaction(version, txinsvarint, txins, txoutsvarint, txouts, nlocktime);
  if (typeof version === 'number') {
    this.set({
      version: version,
      txinsvarint: txinsvarint,
      txins: txins,
      txoutsvarint: txoutsvarint,
      txouts: txouts,
      nlocktime: nlocktime
    });
  } else if (version) {
    var obj = version;
    this.set(obj);
  }
};

Transaction.prototype.set = function(obj) {
  this.version = typeof obj.version !== 'undefined' ? obj.version : this.version;
  this.txinsvarint = obj.txinsvarint || this.txinsvarint;
  this.txins = obj.txins || this.txins;
  this.txoutsvarint = obj.txoutsvarint || this.txoutsvarint;
  this.txouts = obj.txouts || this.txouts;
  this.nlocktime = typeof obj.nlocktime !== 'undefined' ? obj.nlocktime : this.nlocktime;
  return this;
};

Transaction.prototype.fromBuffer = function(buf) {
  return this.fromBufferReader(BufferReader(buf));
};

Transaction.prototype.fromBufferReader = function(br) {
  this.version = br.readUInt32LE();
  this.txinsvarint = Varint(br.readVarintBuf());
  var txinsnum = this.txinsvarint.toNumber();
  this.txins = [];
  for (var i = 0; i < txinsnum; i++) {
    this.txins.push(Txin().fromBufferReader(br));
  }
  this.txoutsvarint = Varint(br.readVarintBuf());
  var txoutsnum = this.txoutsvarint.toNumber();
  this.txouts = [];
  for (var i = 0; i < txoutsnum; i++) {
    this.txouts.push(Txout().fromBufferReader(br));
  }
  this.nlocktime = br.readUInt32LE();
  return this;
};

Transaction.prototype.toBuffer = function() {
  return this.toBufferWriter().concat();
};

Transaction.prototype.toBufferWriter = function(bw) {
  if (!bw)
    bw = new BufferWriter();
  bw.writeUInt32LE(this.version);
  bw.write(this.txinsvarint.buf);
  for (var i = 0; i < this.txins.length; i++) {
    this.txins[i].toBufferWriter(bw);
  }
  bw.write(this.txoutsvarint.buf)
  for (var i = 0; i < this.txouts.length; i++) {
    this.txouts[i].toBufferWriter(bw);
  }
  bw.writeUInt32LE(this.nlocktime);
  return bw;
};

module.exports = Transaction;
