var Txin = require('./txin');
var Txout = require('./txout');
var BufferWriter = require('./bufferwriter');
var BufferReader = require('./bufferreader');
var Varint = require('./varint');

var Transaction = function Transaction(version, txinsvi, txins, txoutsvi, txouts, nlocktime) {
  if (!(this instanceof Transaction))
    return new Transaction(version, txinsvi, txins, txoutsvi, txouts, nlocktime);
  if (typeof version === 'number') {
    this.set({
      version: version,
      txinsvi: txinsvi,
      txins: txins,
      txoutsvi: txoutsvi,
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
  this.txinsvi = obj.txinsvi || this.txinsvi;
  this.txins = obj.txins || this.txins;
  this.txoutsvi = obj.txoutsvi || this.txoutsvi;
  this.txouts = obj.txouts || this.txouts;
  this.nlocktime = typeof obj.nlocktime !== 'undefined' ? obj.nlocktime : this.nlocktime;
  return this;
};

Transaction.prototype.fromBuffer = function(buf) {
  return this.fromBufferReader(BufferReader(buf));
};

Transaction.prototype.fromBufferReader = function(br) {
  this.version = br.readUInt32LE();
  this.txinsvi = Varint(br.readVarintBuf());
  var txinsnum = this.txinsvi.toNumber();
  this.txins = [];
  for (var i = 0; i < txinsnum; i++) {
    this.txins.push(Txin().fromBufferReader(br));
  }
  this.txoutsvi = Varint(br.readVarintBuf());
  var txoutsnum = this.txoutsvi.toNumber();
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
  bw.write(this.txinsvi.buf);
  for (var i = 0; i < this.txins.length; i++) {
    this.txins[i].toBufferWriter(bw);
  }
  bw.write(this.txoutsvi.buf)
  for (var i = 0; i < this.txouts.length; i++) {
    this.txouts[i].toBufferWriter(bw);
  }
  bw.writeUInt32LE(this.nlocktime);
  return bw;
};

module.exports = Transaction;
