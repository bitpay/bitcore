var Txin = require('./txin');
var Txout = require('./txout');
var BufferWriter = require('./bufferwriter');
var BufferReader = require('./bufferreader');
var Varint = require('./varint');
var Hash = require('./hash');

var Transaction = function Transaction(version, txinsvi, txins, txoutsvi, txouts, nlocktime) {
  if (!(this instanceof Transaction))
    return new Transaction(version, txinsvi, txins, txoutsvi, txouts, nlocktime);
  if (typeof version === 'number') {
    this.initialize();
    this.set({
      version: version,
      txinsvi: txinsvi,
      txins: txins,
      txoutsvi: txoutsvi,
      txouts: txouts,
      nlocktime: nlocktime
    });
  } else if (Buffer.isBuffer(version)) {
    //not necessary to initialize, since everything should be overwritten
    var txbuf = version;
    this.fromBuffer(txbuf);
  } else if (version) {
    this.initialize();
    var obj = version;
    this.set(obj);
  } else {
    this.initialize();
  }
};

Transaction.prototype.initialize = function() {
  this.version = 1;
  this.txinsvi = Varint(0);
  this.txins = [];
  this.txoutsvi = Varint(0);
  this.txouts = [];
  this.nlocktime = 0xffffffff;
  return this;
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

Transaction.prototype.fromJSON = function(json) {
  var txins = [];
  json.txins.forEach(function(txin) {
    txins.push(Txin().fromJSON(txin));
  });
  var txouts = [];
  json.txouts.forEach(function(txout) {
    txouts.push(Txout().fromJSON(txout));
  });
  this.set({
    version: json.version,
    txinsvi: Varint().fromJSON(json.txinsvi),
    txins: txins,
    txoutsvi: Varint().fromJSON(json.txoutsvi),
    txouts: txouts,
    nlocktime: json.nlocktime
  });
  return this;
};

Transaction.prototype.toJSON = function() {
  var txins = [];
  this.txins.forEach(function(txin) {
    txins.push(txin.toJSON());
  });
  var txouts = [];
  this.txouts.forEach(function(txout) {
    txouts.push(txout.toJSON());
  });
  return {
    version: this.version,
    txinsvi: this.txinsvi.toJSON(),
    txins: txins,
    txoutsvi: this.txoutsvi.toJSON(),
    txouts: txouts,
    nlocktime: this.nlocktime
  };
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

Transaction.prototype.hash = function() {
  return Hash.sha256sha256(this.toBuffer());
};

Transaction.prototype.id = function() {
  return BufferReader(this.hash()).reverse().read();
};

Transaction.prototype.pushin = function(txin) {
  this.txins.push(txin);
  this.txinsvi = Varint(this.txinsvi.toNumber() + 1);
  return this;
};

Transaction.prototype.pushout = function(txout) {
  this.txouts.push(txout);
  this.txoutsvi = Varint(this.txoutsvi.toNumber() + 1);
  return this;
};

module.exports = Transaction;
