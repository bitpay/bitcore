var Keypair = require('../keypair');
var Privkey = require('../privkey');
var Pubkey = require('../pubkey');
var Point = require('../point');
var Hash = require('../hash');
var KDF = require('../kdf');
var base58check = require('../base58check');

var Stealthkey = function Stealthkey(payloadKeypair, scanKeypair) {
  if (!(this instanceof Stealthkey))
    return new Stealthkey(payloadKeypair, scanKeypair);

  if (payloadKeypair instanceof Keypair) {
    this.set({
      payloadKeypair: payloadKeypair,
      scanKeypair: scanKeypair
    });
  }
  else if (payloadKeypair) {
    var obj = payloadKeypair;
    this.set(obj);
  }
};

Stealthkey.prototype.set = function(obj) {
  this.payloadKeypair = obj.payloadKeypair || this.payloadKeypair;
  this.scanKeypair = obj.scanKeypair || this.scanKeypair;
  return this;
};

Stealthkey.prototype.fromAddressBuffer = function(buf) {
  if (!Buffer.isBuffer(buf) || buf.length !== 66)
    throw new Error('stealthkey: A stealthkey address must have length 66');

  var pPubBuf = buf.slice(0, 33);
  var sPubBuf = buf.slice(33, 66);
  
  var payloadPubkey = Pubkey().fromDER(pPubBuf);
  this.payloadKeypair = Keypair({pubkey: payloadPubkey});
  var scanPubkey = Pubkey().fromDER(sPubBuf);
  this.scanKeypair = Keypair({pubkey: scanPubkey});

  return this;
};

Stealthkey.prototype.fromAddressString = function(str) {
  var buf = base58check.decode(str);
  this.fromAddressBuffer(buf);

  return this;
};

Stealthkey.prototype.fromRandom = function() {
  this.payloadKeypair = Keypair().fromRandom();
  this.scanKeypair = Keypair().fromRandom();

  return this;
};

Stealthkey.prototype.getSharedKeypairAsReceiver = function(senderPubkey) {
  var sharedSecretPoint = senderPubkey.point.mul(this.scanKeypair.privkey.bn);
  var sharedSecretPubkey = Pubkey({point: sharedSecretPoint});
  var buf = sharedSecretPubkey.toDER(true);
  var sharedKeypair = KDF.sha256hmac2keypair(buf);

  return sharedKeypair;
};

Stealthkey.prototype.getSharedKeypairAsSender = function(senderKeypair) {
  var sharedSecretPoint = this.scanKeypair.pubkey.point.mul(senderKeypair.privkey.bn);
  var sharedSecretPubkey = Pubkey({point: sharedSecretPoint});
  var buf = sharedSecretPubkey.toDER(true);
  var sharedKeypair = KDF.sha256hmac2keypair(buf);

  return sharedKeypair;
};

Stealthkey.prototype.getReceivePubkeyAsReceiver = function(senderPubkey) {
  var sharedKeypair = this.getSharedKeypairAsReceiver(senderPubkey);
  var pubkey = Pubkey({point: this.payloadKeypair.pubkey.point.add(sharedKeypair.pubkey.point)});

  return pubkey;
};

Stealthkey.prototype.getReceivePubkeyAsSender = function(senderKeypair) {
  var sharedKeypair = this.getSharedKeypairAsSender(senderKeypair);
  var pubkey = Pubkey({point: this.payloadKeypair.pubkey.point.add(sharedKeypair.pubkey.point)});

  return pubkey;
};

Stealthkey.prototype.getReceiveKeypair = function(senderPubkey) {
  var sharedKeypair = this.getSharedKeypairAsReceiver(senderPubkey);
  var privkey = Privkey({bn: this.payloadKeypair.privkey.bn.add(sharedKeypair.privkey.bn).mod(Point.getN())});
  var key = Keypair({privkey: privkey});
  key.privkey2pubkey();

  return key;
};

Stealthkey.prototype.isForMe = function(senderPubkey, myPossiblePubkeyhash) {
  var pubkey = this.getReceivePubkeyAsReceiver(senderPubkey);
  var pubkeybuf = pubkey.toDER(true);
  var pubkeyhash = Hash.sha256ripemd160(pubkeybuf);

  if (pubkeyhash.toString('hex') === myPossiblePubkeyhash.toString('hex'))
    return true;
  else
    return false;
};

Stealthkey.prototype.toAddressBuffer = function() {
  var pBuf = this.payloadKeypair.pubkey.toDER(true);
  var sBuf = this.scanKeypair.pubkey.toDER(true);

  return Buffer.concat([pBuf, sBuf]);
};

Stealthkey.prototype.toAddressString = function() {
  var buf = this.toAddressBuffer();
  var b58 = base58check.encode(buf);

  return b58;
};

module.exports = Stealthkey;
