var Stealthkey = require('./stealthkey');
var Base58check = require('../base58check');
var Pubkey = require('../pubkey');

var StealthAddress = function StealthAddress(obj) {
  if (!(this instanceof StealthAddress))
    return new StealthAddress(obj);

  if (obj)
    this.set(obj);
};

StealthAddress.prototype.set = function(obj) {
  this.payloadPubkey = obj.payloadPubkey || this.payloadPubkey;
  this.scanPubkey = obj.scanPubkey || this.scanPubkey;
  return this;
};

StealthAddress.prototype.fromStealthkey = function(stealthkey) {
  this.set({
    payloadPubkey: stealthkey.payloadPubkey,
    scanPubkey: stealthkey.scanPubkey
  });
  return this;
};

StealthAddress.prototype.fromBuffer = function(buf) {
  if (!Buffer.isBuffer(buf) || buf.length !== 66)
    throw new Error('stealthkey: A stealth address must have length 66');

  var pPubBuf = buf.slice(0, 33);
  var sPubBuf = buf.slice(33, 66);
  
  this.payloadPubkey = Pubkey().fromDER(pPubBuf);
  this.scanPubkey = Pubkey().fromDER(sPubBuf);

  return this;
};

StealthAddress.prototype.fromString = function(str) {
  var buf = Base58check.decode(str);
  this.fromBuffer(buf);

  return this;
};

StealthAddress.prototype.toBuffer = function() {
  var pBuf = this.payloadPubkey.toDER(true);
  var sBuf = this.scanPubkey.toDER(true);

  return Buffer.concat([pBuf, sBuf]);
};

StealthAddress.prototype.toString = function() {
  var buf = this.toBuffer();
  var b58 = Base58check.encode(buf);

  return b58;
};

module.exports = StealthAddress;
