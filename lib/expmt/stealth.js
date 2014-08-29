var Key = require('../key');
var Privkey = require('../privkey');
var Pubkey = require('../pubkey');
var Point = require('../point');
var Hash = require('../hash');
var KDF = require('../kdf');
var base58check = require('../base58check');

var Stealth = function Stealth(obj) {
  if (!(this instanceof Stealth))
    return new Stealth(obj);
  if (obj)
    this.set(obj);
};

Stealth.prototype.set = function(obj) {
  this.payloadKey = obj.payloadKey || this.payloadKey;
  this.scanKey = obj.scanKey || this.scanKey;
  return this;
};

Stealth.prototype.fromAddressBuffer = function(buf) {
  if (!Buffer.isBuffer(buf) || buf.length !== 66)
    throw new Error('stealth: A stealth address must have length 66');

  var pPubBuf = buf.slice(0, 33);
  var sPubBuf = buf.slice(33, 66);
  
  var payloadPubkey = Pubkey().fromDER(pPubBuf);
  this.payloadKey = Key({pubkey: payloadPubkey});
  var scanPubkey = Pubkey().fromDER(sPubBuf);
  this.scanKey = Key({pubkey: scanPubkey});

  return this;
};

Stealth.prototype.fromAddressString = function(str) {
  var buf = base58check.decode(str);
  this.fromAddressBuffer(buf);

  return this;
};

Stealth.prototype.fromRandom = function() {
  this.payloadKey = Key().fromRandom();
  this.scanKey = Key().fromRandom();

  return this;
};

Stealth.prototype.getSharedKeyAsReceiver = function(senderPubkey) {
  var sharedSecretPoint = senderPubkey.point.mul(this.scanKey.privkey.bn);
  var sharedSecretPubkey = Pubkey({point: sharedSecretPoint});
  var buf = sharedSecretPubkey.toDER(true);
  var sharedKey = KDF.sha256hmac2key(buf);

  return sharedKey;
};

Stealth.prototype.getSharedKeyAsSender = function(senderKey) {
  var sharedSecretPoint = this.scanKey.pubkey.point.mul(senderKey.privkey.bn);
  var sharedSecretPubkey = Pubkey({point: sharedSecretPoint});
  var buf = sharedSecretPubkey.toDER(true);
  var sharedKey = KDF.sha256hmac2key(buf);

  return sharedKey;
};

Stealth.prototype.getReceivePubkeyAsReceiver = function(senderPubkey) {
  var sharedKey = this.getSharedKeyAsReceiver(senderPubkey);
  var pubkey = Pubkey({point: this.payloadKey.pubkey.point.add(sharedKey.pubkey.point)});

  return pubkey;
};

Stealth.prototype.getReceivePubkeyAsSender = function(senderKey) {
  var sharedKey = this.getSharedKeyAsSender(senderKey);
  var pubkey = Pubkey({point: this.payloadKey.pubkey.point.add(sharedKey.pubkey.point)});

  return pubkey;
};

Stealth.prototype.getReceiveKey = function(senderPubkey) {
  var sharedKey = this.getSharedKeyAsReceiver(senderPubkey);
  var privkey = Privkey({bn: this.payloadKey.privkey.bn.add(sharedKey.privkey.bn).mod(Point.getN())});
  var key = Key({privkey: privkey});
  key.privkey2pubkey();

  return key;
};

Stealth.prototype.isForMe = function(senderPubkey, myPossiblePubkeyhash) {
  var pubkey = this.getReceivePubkeyAsReceiver(senderPubkey);
  var pubkeybuf = pubkey.toDER(true);
  var pubkeyhash = Hash.sha256ripemd160(pubkeybuf);

  if (pubkeyhash.toString('hex') === myPossiblePubkeyhash.toString('hex'))
    return true;
  else
    return false;
};

Stealth.prototype.toAddressBuffer = function() {
  var pBuf = this.payloadKey.pubkey.toDER(true);
  var sBuf = this.scanKey.pubkey.toDER(true);

  return Buffer.concat([pBuf, sBuf]);
};

Stealth.prototype.toAddressString = function() {
  var buf = this.toAddressBuffer();
  var b58 = base58check.encode(buf);

  return b58;
};

module.exports = Stealth;
