var Bn = require('./bn');
var point = require('./point');
var constants = require('./constants');
var base58check = require('./base58check');

var Privkey = function Privkey(bn, network, compressed) {
  if (!(this instanceof Privkey))
    return new Privkey(bn, network, compressed);
  this.bn = bn;
  this.network = network;
  this.compressed = compressed;
};

Privkey.prototype.validate = function() {
  if (!this.bn.lt(point.getN()))
    throw new Error('Number must be less than N');
  if (typeof constants[this.network] === undefined)
    throw new Error('Must specify the network ("mainnet" or "testnet")');
  if (typeof this.compressed !== 'boolean')
    throw new Error('Must specify whether the corresponding public key is compressed or not (true or false)');
};

Privkey.prototype.toWIF = function() {
  var network = this.network;
  var compressed = this.compressed;

  if (typeof this.network === 'undefined')
    network = 'mainnet';
  if (typeof this.compressed === 'undefined')
    compressed = true;

  var privbuf = this.bn.toBuffer({size: 32});
  var buf;
  if (compressed)
    buf = Buffer.concat([new Buffer([constants[network].privkey]), this.bn.toBuffer({size: 32}), new Buffer([0x01])]);
  else
    buf = Buffer.concat([new Buffer([constants[network].privkey]), this.bn.toBuffer({size: 32})]);

  return base58check.encode(buf);
};

Privkey.prototype.fromWIF = function(str) {
  var buf = base58check.decode(str);

  if (buf.length === 1 + 32 + 1 && buf[1 + 32 + 1 - 1] == 1)
    this.compressed = true;
  else if (buf.length === 1 + 32)
    this.compressed = false;
  else
    throw new Error('Length of buffer must be 33 (uncompressed) or 34 (compressed)');

  if (buf[0] === constants.mainnet.privkey)
    this.network = 'mainnet';
  else if (buf[0] === constants.testnet.privkey)
    this.network = 'testnet';
  else
    throw new Error('Invalid network');

  this.bn = Bn.fromBuffer(buf.slice(1, 32 + 1));
};

Privkey.prototype.toString = function() {
  return this.toWIF();
};

Privkey.prototype.fromString = function(str) {
  this.fromWIF(str);
};

module.exports = Privkey;
