var base58check = require('./base58check');
var constants = require('./constants');
var Hash = require('./hash');
var Pubkey = require('./pubkey');
var Script = require('./script');

function Address(buf) {
  if (!(this instanceof Address))
    return new Address(buf);
  if (Buffer.isBuffer(buf)) {
    this.fromBuffer(buf);
  } else if (typeof buf === 'string') {
    var str = buf;
    this.fromString(str);
  } else if (buf) {
    var obj = buf;
    this.set(obj);
  }
};

Address.prototype.set = function(obj) {
  this.hashbuf = obj.hashbuf || this.hashbuf || null;
  this.networkstr = obj.networkstr || this.networkstr || 'mainnet';
  this.typestr = obj.typestr || this.typestr || 'pubkeyhash';
  return this;
};

Address.prototype.fromBuffer = function(buf) {
  if (buf.length !== 1 + 20)
    throw new Error('Address buffers must be exactly 21 bytes');
  var version = buf[0];
  if (version === constants['mainnet']['pubkeyhash']) {
    this.networkstr = 'mainnet';
    this.typestr = 'pubkeyhash';
  } else if (version === constants['mainnet']['scripthash']) {
    this.networkstr = 'mainnet';
    this.typestr = 'scripthash';
  } else if (version === constants['testnet']['pubkeyhash']) {
    this.networkstr = 'testnet';
    this.typestr = 'pubkeyhash';
  } else if (version === constants['testnet']['scripthash']) {
    this.networkstr = 'testnet';
    this.typestr = 'scripthash';
  } else {
    this.networkstr = 'unknown';
    this.typestr = 'unknown';
  }

  this.hashbuf = buf.slice(1);

  return this;
};

Address.prototype.fromHashbuf = function(hashbuf, networkstr, typestr) {
  if (hashbuf.length !== 20)
    throw new Error('hashbuf must be exactly 20 bytes');
  this.hashbuf = hashbuf;
  this.networkstr = networkstr || 'mainnet';
  this.typestr = typestr || 'pubkeyhash';
  return this;
};

Address.prototype.fromPubkey = function(pubkey, networkstr) {
  this.hashbuf = Hash.sha256ripemd160(pubkey.toBuffer());
  this.networkstr = networkstr || 'mainnet';
  this.typestr = 'pubkeyhash';
  return this;
};

Address.prototype.fromScript = function(script, networkstr) {
  this.hashbuf = Hash.sha256ripemd160(script.toBuffer());
  this.networkstr = networkstr || 'mainnet';
  this.typestr = 'scripthash';
  return this;
};

Address.prototype.fromString = function(str) {
  var buf = base58check.decode(str);
  return this.fromBuffer(buf);
}

Address.isValid = function(addrstr) {
  try {
    var address = new Address().fromString(addrstr);
  } catch (e) {
    return false;
  }
  return address.isValid();
};

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
  if (this.typestr !== 'pubkeyhash' && this.typestr !== 'scripthash')
    throw new Error('typestr must be "pubkeyhash" or "scripthash"');
  return this;
};

module.exports = Address;
