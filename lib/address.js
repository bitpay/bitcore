var base58check = require('./base58check');
var constants = require('./constants');
var Hash = require('./hash');
var Pubkey = require('./pubkey');

function Address(obj) {
  if (!(this instanceof Address))
    return new Address(obj);
  if (obj)
    this.set(obj);
};

Address.isValid = function(addrstr) {
  try {
    var address = new Address().fromString(addrstr);
  } catch (e) {
    return false;
  }
  return address.isValid();
};

Address.prototype.set = function(obj) {
  this.hashbuf = obj.hashbuf || this.hashbuf || null;
  this.networkstr = obj.networkstr || this.networkstr || 'mainnet';
  this.typestr = obj.typestr || this.typestr || 'pubkeyhash';
  return this;
};

Address.prototype.fromPubkey = function(pubkey, networkstr) {
  this.hashbuf = Hash.sha256ripemd160(pubkey.toBuffer());
  this.networkstr = networkstr || 'mainnet';
  this.typestr = 'pubkeyhash';
  return this;
};

Address.prototype.fromString = function(str) {
  var buf = base58check.decode(str);
  if (buf.length !== 1 + 20)
    throw new Error('Address buffers must be exactly 21 bytes');
  var version = buf[0];
  if (version === constants['mainnet']['pubkeyhash']) {
    this.networkstr = 'mainnet';
    this.typestr = 'pubkeyhash';
  } else if (version === constants['mainnet']['p2sh']) {
    this.networkstr = 'mainnet';
    this.typestr = 'p2sh';
  } else if (version === constants['testnet']['pubkeyhash']) {
    this.networkstr = 'testnet';
    this.typestr = 'pubkeyhash';
  } else if (version === constants['testnet']['p2sh']) {
    this.networkstr = 'testnet';
    this.typestr = 'p2sh';
  } else {
    this.networkstr = 'unknown';
    this.typestr = 'unknown';
  }

  this.hashbuf = buf.slice(1);

  return this;
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
  version = new Buffer([constants[this.networkstr][this.typestr]]);
  var buf = Buffer.concat([version, this.hashbuf]);
  return buf;
};

Address.prototype.toString = function() {
  return base58check.encode(this.toBuffer());
};

Address.prototype.validate = function() {
  if (!Buffer.isBuffer(this.hashbuf) || this.hashbuf.length !== 20)
    throw new Error('hash must be a buffer of 20 bytes');
  if (this.networkstr !== 'mainnet' && this.networkstr !== 'testnet')
    throw new Error('networkstr must be "mainnet" or "testnet"');
  if (this.typestr !== 'pubkeyhash' && this.typestr !== 'p2sh')
    throw new Error('typestr must be "pubkeyhash" or "p2sh"');
  return this;
};

module.exports = Address;
