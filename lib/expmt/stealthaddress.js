var Stealthkey = require('./stealthkey');
var Base58check = require('../base58check');
var Pubkey = require('../pubkey');
var KDF = require('../kdf');

var StealthAddress = function StealthAddress(addrstr) {
  if (!(this instanceof StealthAddress))
    return new StealthAddress(addrstr);
  
  if (typeof addrstr === 'string') {
    this.fromString(addrstr)
  }
  else if (Buffer.isBuffer(addrstr)) {
    var buf = addrstr;
    this.fromBuffer(buf);
  }
  else if (addrstr) {
    var obj = addrstr;
    this.set(obj);
  }
};

StealthAddress.prototype.set = function(obj) {
  this.payloadPubkey = obj.payloadPubkey || this.payloadPubkey;
  this.scanPubkey = obj.scanPubkey || this.scanPubkey;
  return this;
};

StealthAddress.prototype.fromJSON = function(json) {
  this.fromString(json);
  return this;
};

StealthAddress.prototype.toJSON = function() {
  return this.toString();
};

StealthAddress.prototype.fromStealthkey = function(stealthkey) {
  this.set({
    payloadPubkey: stealthkey.payloadKeypair.pubkey,
    scanPubkey: stealthkey.scanKeypair.pubkey
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

StealthAddress.prototype.getSharedKeypair = function(senderKeypair) {
  var sharedSecretPoint = this.scanPubkey.point.mul(senderKeypair.privkey.bn);
  var sharedSecretPubkey = Pubkey(sharedSecretPoint);
  var buf = sharedSecretPubkey.toDER(true);
  var sharedKeypair = KDF.sha256hmac2keypair(buf);

  return sharedKeypair;
};

StealthAddress.prototype.getReceivePubkey = function(senderKeypair) {
  var sharedKeypair = this.getSharedKeypair(senderKeypair);
  var pubkey = Pubkey(this.payloadPubkey.point.add(sharedKeypair.pubkey.point));

  return pubkey;
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
