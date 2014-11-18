var BN = require('./bn');
var Point = require('./point');
var constants = require('./constants');
var base58check = require('./base58check');
var Random = require('./random');

var Privkey = function Privkey(bn) {
  if (!(this instanceof Privkey))
    return new Privkey(bn);
  if (bn instanceof BN)
    this.bn = bn;
  else if (bn) {
    var obj = bn;
    this.set(obj);
  }
};

Privkey.prototype.set = function(obj) {
  this.bn = obj.bn || this.bn;
  this.networkstr = obj.networkstr || this.networkstr;
  this.compressed = typeof obj.compressed !== 'undefined' ? obj.compressed : this.compressed;
  return this;
};

Privkey.prototype.fromJSON = function(json) {
  this.fromString(json);
  return this;
};

Privkey.prototype.toJSON = function() {
  return this.toString();
};

Privkey.prototype.fromRandom = function() {
  do {
    var privbuf = Random.getRandomBuffer(32);
    var bn = BN().fromBuffer(privbuf);
    var condition = bn.lt(Point.getN());
  } while (!condition);
  this.set({
    bn: bn,
    networkstr: 'mainnet',
    compressed: true
  });
  return this;
};

Privkey.prototype.validate = function() {
  if (!this.bn.lt(Point.getN()))
    throw new Error('Number must be less than N');
  if (typeof constants[this.networkstr] === undefined)
    throw new Error('Must specify the networkstr ("mainnet" or "testnet")');
  if (typeof this.compressed !== 'boolean')
    throw new Error('Must specify whether the corresponding public key is compressed or not (true or false)');
};

Privkey.prototype.toWIF = function() {
  var networkstr = this.networkstr;
  var compressed = this.compressed;

  if (typeof this.networkstr === 'undefined')
    networkstr = 'mainnet';
  if (typeof this.compressed === 'undefined')
    compressed = true;

  var privbuf = this.bn.toBuffer({size: 32});
  var buf;
  if (compressed)
    buf = Buffer.concat([new Buffer([constants[networkstr].privkey]), this.bn.toBuffer({size: 32}), new Buffer([0x01])]);
  else
    buf = Buffer.concat([new Buffer([constants[networkstr].privkey]), this.bn.toBuffer({size: 32})]);

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
    this.networkstr = 'mainnet';
  else if (buf[0] === constants.testnet.privkey)
    this.networkstr = 'testnet';
  else
    throw new Error('Invalid networkstr');

  this.bn = BN.fromBuffer(buf.slice(1, 32 + 1));
};

Privkey.prototype.toString = function() {
  return this.toWIF();
};

Privkey.prototype.fromString = function(str) {
  this.fromWIF(str);
};

module.exports = Privkey;
