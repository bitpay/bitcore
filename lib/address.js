var base58check = require('./base58check');
var constants = require('./constants');

function Address(str) {
  if (!str) {
    this.buf = undefined;
    return;
  }
  if (typeof str !== 'string')
    throw new Error('address: Input must be a string, or undefined');
  this.fromString(str);
};

Address.prototype.getNetwork = function() {
  if (this.buf[0] === constants.mainnet.pubkeyHash || this.buf[0] === constants.mainnet.p2sh)
    return 'mainnet';
  else if (this.buf[0] === constants.testnet.pubkeyHash || this.buf[0] === constants.testnet.p2sh)
    return 'testnet';
  else
    return 'unknown';
};

Address.prototype.getHash = function() {
  var pubkeyHash = this.buf.slice(1);
  if (pubkeyHash.length === 20)
    return pubkeyHash;
  else
    throw new Error('address: Hash must be exactly 20 bytes');
};

Address.prototype.getType = function() {
  if (this.buf[0] === constants.mainnet.pubkeyHash || this.buf[0] === constants.testnet.pubkeyHash)
    return 'pubkeyHash';
  else if (this.buf[0] === constants.mainnet.p2sh || this.buf[0] === constants.testnet.p2sh)
    return 'p2sh';
  else
    return 'unknown';
};

Address.prototype.isValid = function() {
  if (Buffer.isBuffer(this.buf) && this.buf.length === 1 + 20)
    return true;
  else
    return false;
};

Address.prototype.setBuf = function(buf, network, type) {
  var version;
  if (!Buffer.isBuffer(buf))
    throw new Error('address: buf must be a buffer');
  if (buf.length !== 20)
    throw new Error('address: buf must be 20 bytes');
  if (typeof network === 'undefined')
    throw new Error('address: Must specify network ("mainnet" or "testnet")');
  if (typeof type === 'undefined')
    throw new Error('address: Must specify type ("pubkeyHash" or "p2sh")');
  if (network !== 'mainnet' && network !== 'testnet')
    throw new Error('address: Unknown network');
  if (type !== 'pubkeyHash' && type !== 'p2sh')
    throw new Error('address: Unknown type');

  version = new Buffer([constants[network][type]]);

  this.buf = Buffer.concat([version, buf]);
};

Address.prototype.fromString = function(str) {
  var buf = base58check.decode(str);
  if (buf.length !== 1 + 20)
    throw new Error('address: Addresses must be exactly 21 bytes');
  this.buf = buf;
}

Address.prototype.toString = function() {
  return base58check.encode(this.buf);
};

module.exports = Address;
