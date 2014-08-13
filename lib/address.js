var base58check = require('./base58check');
var constants = require('./constants');
var Hash = require('./hash');
var Pubkey = require('./pubkey');

function Address(hash, network, type) {
  this.hash = hash;
  this.network = network;
  this.type = type;
};

Address.prototype.fromPubkey = function(pubkey, network, compressed) {
  if (typeof compressed === 'undefined')
    compressed = true;
  this.hash = Hash.sha256ripemd160(pubkey.toDER(compressed));
  this.network = network || 'mainnet';
  this.type = 'pubkeyhash';
  return this;
};

Address.prototype.fromString = function(str) {
  var buf = base58check.decode(str);
  if (buf.length !== 1 + 20)
    throw new Error('address: Address buffers must be exactly 21 bytes');
  var version = buf[0];
  if (version === constants['mainnet']['pubkeyhash']) {
    this.network = 'mainnet';
    this.type = 'pubkeyhash';
  } else if (version === constants['mainnet']['p2sh']) {
    this.network = 'mainnet';
    this.type = 'p2sh';
  } else if (version === constants['testnet']['pubkeyhash']) {
    this.network = 'testnet';
    this.type = 'pubkeyhash';
  } else if (version === constants['testnet']['p2sh']) {
    this.network = 'testnet';
    this.type = 'p2sh';
  } else {
    this.network = 'unknown';
    this.type = 'unknown';
  }

  this.hash = buf.slice(1);
}

Address.prototype.isValid = function() {
  try {
    this.validate();
    return true;
  } catch (e) {
    return false;
  }
};

Address.prototype.toBuffer = function() {
  version = new Buffer([constants[this.network][this.type]]);
  var buf = Buffer.concat([version, this.hash]);
  return buf;
};

Address.prototype.toString = function() {
  return base58check.encode(this.toBuffer());
};

Address.prototype.validate = function() {
  if (!Buffer.isBuffer(this.hash) || this.hash.length !== 20)
    throw new Error('address: hash must be a buffer of 20 bytes');
  if (this.network !== 'mainnet' && this.network !== 'testnet')
    throw new Error('address: network must be "mainnet" or "testnet"');
  if (this.type !== 'pubkeyhash' && this.type !== 'p2sh')
    throw new Error('address: type must be "pubkeyhash" or "p2sh"');
  return this;
};

module.exports = Address;
