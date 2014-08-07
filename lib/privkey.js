var bn = require('./bn');
var point = require('./point');
var constants = require('./constants');
var base58check = require('./base58check');

var Privkey = function(n, network, compressed) {
  if (typeof n === 'undefined')
    return;
  this.setNumber(n);
  this.setNetwork(network);
  this.setCompressed(compressed);
};

Privkey.prototype.setNumber = function(n) {
  if (!n.lt(point.getN()))
    throw new Error('privkey: Number must be less than N');
  this.n = n;
};

Privkey.prototype.setNetwork = function(network) {
  if (typeof constants[network] === undefined)
    throw new Error('privkey: Must specify the network ("mainnet" or "testnet")');
  this.network = network;
};

Privkey.prototype.setCompressed = function(compressed) {
  if (typeof compressed !== 'boolean')
    throw new Error('privkey: Must specify whether the corresponding public key is compressed or not (true or false)');
  this.compressed = compressed;
};

Privkey.prototype.toWIF = function() {
  this.setNetwork(this.network);
  this.setCompressed(this.compressed);

  var network = this.network;
  var compressed = this.compressed;

  var privbuf = this.n.toBuffer({size: 32});
  var buf;
  if (compressed)
    buf = Buffer.concat([new Buffer([constants[network].privkey]), this.n.toBuffer({size: 32}), new Buffer([0x01])]);
  else
    buf = Buffer.concat([new Buffer([constants[network].privkey]), this.n.toBuffer({size: 32})]);

  return base58check.encode(buf);
};

Privkey.prototype.fromWIF = function(str) {
  var buf = base58check.decode(str);

  if (buf.length === 1 + 32 + 1 && buf[1 + 32 + 1 - 1] == 1)
    this.compressed = true;
  else if (buf.length === 1 + 32)
    this.compressed = false;
  else
    throw new Error('privkey: Length of buffer must be 33 (uncompressed) or 34 (compressed)');

  if (buf[0] === constants.mainnet.privkey)
    this.network = 'mainnet';
  else if (buf[0] === constants.testnet.privkey)
    this.network = 'testnet';
  else
    throw new Error('privkey: Invalid network');

  this.n = bn.fromBuffer(buf.slice(1, 32 + 1));
};

Privkey.prototype.toString = function() {
  return this.toWIF();
};

Privkey.prototype.fromString = function(str) {
  this.fromWIF(str);
};

module.exports = Privkey;
