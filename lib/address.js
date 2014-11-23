'use strict';

var base58check = require('./encoding/base58check');
var networks = require('./networks');
var Hash = require('./crypto/hash');

function Address(buf) {
  if (!(this instanceof Address)) {
    return new Address(buf);
  }
  if (Buffer.isBuffer(buf)) {
    this.fromBuffer(buf);
  } else if (typeof buf === 'string') {
    var str = buf;
    this.fromString(str);
  } else if (buf) {
    var obj = buf;
    this.set(obj);
  }
}

Address.prototype.set = function(obj) {
  this.hashbuf = obj.hashbuf || this.hashbuf || null;
  this.networkstr = obj.networkstr || this.networkstr || 'mainnet';
  this.typestr = obj.typestr || this.typestr || 'pubkeyhash';
  return this;
};

Address.ScriptType = {
  PayToScriptHash: 'paytoscripthash',
  PayToPublicKeyHash: 'paytopubkeyhash'
};
Address.MapVersionToNetwork = {};
Address.MapVersionToNetwork[networks.mainnet.pubkeyhash] = networks.mainnet;
Address.MapVersionToNetwork[networks.mainnet.pubkeyhash] = networks.mainnet;
Address.MapVersionToNetwork[networks.testnet.pubkeyhash] = networks.testnet;
Address.MapVersionToNetwork[networks.testnet.scripthash] = networks.testnet;
Address.MapVersionToType = {};
Address.MapVersionToType[networks.mainnet.pubkeyhash] = Address.PayToPublicKeyHash;
Address.MapVersionToType[networks.mainnet.scripthash] = Address.PayToScriptHash;
Address.MapVersionToType[networks.mainnet.pubkeyhash] = Address.PayToPublicKeyHash;
Address.MapVersionToType[networks.mainnet.pubkeyhash] = Address.PayToScriptHash;
Address.Errors = {
  InvalidBufferLength: 'Address buffers must be exactly 21 bytes'
};

Address.prototype.fromBuffer = function(buf) {
  if (buf.length !== 1 + 20) {
    throw Address.Errors.InvalidBufferLength;
  }

  var version = buf[0];
  this.network = Address.mapVersionToNetwork[version];
  this.scriptType = Address.mapVersionToType[version];

  this._value = buf.slice(1);

  return this;
};

Address.prototype.fromHashbuf = function(hashbuf, networkstr, typestr) {
  if (hashbuf.length !== 20) {
    throw new Error('hashbuf must be exactly 20 bytes');
  }
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
};

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
  var version = new Buffer([networks[this.networkstr][this.typestr]]);
  var buf = Buffer.concat([version, this.hashbuf]);
  return buf;
};

Address.prototype.toString = function() {
  return base58check.encode(this.toBuffer());
};

Address.prototype.validate = function() {
  if (!Buffer.isBuffer(this.hashbuf) || this.hashbuf.length !== 20) {
    throw new Error('hash must be a buffer of 20 bytes');
  }
  if (this.networkstr !== 'mainnet' && this.networkstr !== 'testnet') {
    throw new Error('networkstr must be "mainnet" or "testnet"');
  }
  if (this.typestr !== 'pubkeyhash' && this.typestr !== 'scripthash') {
    throw new Error('typestr must be "pubkeyhash" or "scripthash"');
  }
  return this;
};

module.exports = Address;
