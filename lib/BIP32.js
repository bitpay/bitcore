var imports = require('soop').imports();
var base58 = imports.base58 || require('base58-native').base58;
var coinUtil = imports.coinUtil || require('../util');
var Key = imports.Key || require('./Key');
var Point = imports.Point || require('./Point');
var bignum = imports.bignum || require('bignum');
var crypto = require('crypto');
var networks = require('../networks');

var secp256k1_n = new bignum("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", 16);
var secp256k1_Gx = new bignum("79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798", 16);

var BIP32 = function(bytes) {
  if (typeof bytes == 'undefined' || bytes == 'mainnet' || bytes == 'livenet') {
    bytes = 'livenet';
    this.version = networks['livenet'].bip32privateVersion;
  }
  else if (bytes == 'testnet')
    this.version = networks['testnet'].bip32privateVersion;

  if (bytes == 'livenet' || bytes == 'testnet') {
    this.depth = 0x00;
    this.parentFingerprint = new Buffer([0, 0, 0, 0]);
    this.childIndex = new Buffer([0, 0, 0, 0]);
    this.chainCode = Key.generateSync().private;
    this.eckey = Key.generateSync();
    this.hasPrivateKey = true;
    this.pubKeyHash = coinUtil.sha256ripe160(this.eckey.public);
    this.buildExtendedPublicKey();
    this.buildExtendedPrivateKey();
    return;
  }
  
  // decode base58
  if (typeof bytes === "string") {
    var decoded = base58.decode(bytes);
    if (decoded.length != 82)
      throw new Error("Not enough data");
    var checksum = decoded.slice(78, 82);
    bytes = decoded.slice(0, 78);

    var hash = coinUtil.sha256(coinUtil.sha256(bytes));

    if (hash[0] != checksum[0] || hash[1] != checksum[1] || hash[2] != checksum[2] || hash[3] != checksum[3]) {
      throw new Error("Invalid checksum");
    }
  }

  if (bytes !== undefined) 
    this.initFromBytes(bytes);
}

BIP32.seed = function(bytes, network) {
  if (!network)
    network = 'livenet';

  if (!Buffer.isBuffer(bytes))
    bytes = new Buffer(bytes, 'hex'); //if not buffer, assume hex
  if (bytes.length < 128/8)
    return false; //need more entropy
  var hash = coinUtil.sha512hmac(bytes, new Buffer("Bitcoin seed"));

  var bip32 = new BIP32();
  bip32.depth = 0x00;
  bip32.parentFingerprint = new Buffer([0, 0, 0, 0]);
  bip32.childIndex = new Buffer([0, 0, 0, 0]);
  bip32.chainCode = hash.slice(32, 64);
  bip32.version = networks[network].bip32privateVersion;
  bip32.eckey = new Key();
  bip32.eckey.private = hash.slice(0, 32);
  bip32.eckey.regenerateSync();
  bip32.hasPrivateKey = true;
  bip32.pubKeyHash = coinUtil.sha256ripe160(bip32.eckey.public);

  bip32.buildExtendedPublicKey();
  bip32.buildExtendedPrivateKey();

  return bip32;
};

BIP32.prototype.initFromBytes = function(bytes) {
  // Both pub and private extended keys are 78 bytes
  if(bytes.length != 78) throw new Error("not enough data");

  this.version      = u32(bytes.slice(0, 4));
  this.depth        = u8(bytes.slice(4, 5));
  this.parentFingerprint = bytes.slice(5, 9);
  this.childIndex    = u32(bytes.slice(9, 13));
  this.chainCode     = bytes.slice(13, 45);
  
  var keyBytes = bytes.slice(45, 78);

  var isPrivate = 
    (this.version == networks['livenet'].bip32privateVersion  ||
     this.version == networks['testnet'].bip32privateVersion  );

  var isPublic = 
    (this.version == networks['livenet'].bip32publicVersion  ||
     this.version == networks['testnet'].bip32publicVersion  );

  if (isPrivate && keyBytes[0] == 0) {
    this.eckey = new Key();
    this.eckey.private = keyBytes.slice(1, 33);
    this.eckey.compressed = true;
    this.eckey.regenerateSync();
    this.pubKeyHash = coinUtil.sha256ripe160(this.eckey.public);
    this.hasPrivateKey = true;
  } else if (isPublic && (keyBytes[0] == 0x02 || keyBytes[0] == 0x03)) {
    this.eckey = new Key();
    this.eckey.public = keyBytes;
    this.pubKeyHash = coinUtil.sha256ripe160(this.eckey.public);
    this.hasPrivateKey = false;
  } else {
    throw new Error("Invalid key");
  }

  this.buildExtendedPublicKey();
  this.buildExtendedPrivateKey();
}

BIP32.prototype.buildExtendedPublicKey = function() {
  this.extendedPublicKey = new Buffer([]);

  var v = null;
  switch(this.version) {
  case networks['livenet'].bip32publicVersion:
  case networks['livenet'].bip32privateVersion:
    v = networks['livenet'].bip32publicVersion;
    break;
  case networks['testnet'].bip32publicVersion:
  case networks['testnet'].bip32privateVersion:
    v = networks['testnet'].bip32publicVersion;
    break;
   default:
    throw new Error("Unknown version");
  }

  // Version
  this.extendedPublicKey = Buffer.concat([this.extendedPublicKey, new Buffer([v >> 24])]);
  this.extendedPublicKey = Buffer.concat([this.extendedPublicKey, new Buffer([(v >> 16) & 0xff])]);
  this.extendedPublicKey = Buffer.concat([this.extendedPublicKey, new Buffer([(v >> 8) & 0xff])]);
  this.extendedPublicKey = Buffer.concat([this.extendedPublicKey, new Buffer([v & 0xff])]);

  // Depth
  this.extendedPublicKey = Buffer.concat([this.extendedPublicKey, new Buffer([this.depth])]);

  // Parent fingerprint
  this.extendedPublicKey = Buffer.concat([this.extendedPublicKey, this.parentFingerprint]);

  // Child index
  this.extendedPublicKey = Buffer.concat([this.extendedPublicKey, new Buffer([this.childIndex >>> 24])]);
  this.extendedPublicKey = Buffer.concat([this.extendedPublicKey, new Buffer([(this.childIndex >>> 16) & 0xff])]);
  this.extendedPublicKey = Buffer.concat([this.extendedPublicKey, new Buffer([(this.childIndex >>> 8) & 0xff])]);
  this.extendedPublicKey = Buffer.concat([this.extendedPublicKey, new Buffer([this.childIndex & 0xff])]);

  // Chain code
  this.extendedPublicKey = Buffer.concat([this.extendedPublicKey, this.chainCode]);

  // Public key
  this.extendedPublicKey = Buffer.concat([this.extendedPublicKey, this.eckey.public]);
}

BIP32.prototype.extendedPublicKeyString = function(format) {
  if (format === undefined || format === "base58") {
    var hash = coinUtil.sha256(coinUtil.sha256(this.extendedPublicKey));
    var checksum = hash.slice(0, 4);
    var data = Buffer.concat([this.extendedPublicKey, checksum]);
    return base58.encode(data);
  } else if (format === "hex") {
    return this.extendedPublicKey.toString('hex');;
  } else {
    throw new Error("bad format");
  }
}

BIP32.prototype.buildExtendedPrivateKey = function() {
  if (!this.hasPrivateKey) return;
  this.extendedPrivateKey = new Buffer([]);

  var v = this.version;

  // Version
  this.extendedPrivateKey = Buffer.concat([this.extendedPrivateKey, new Buffer([v >> 24])]);
  this.extendedPrivateKey = Buffer.concat([this.extendedPrivateKey, new Buffer([(v >> 16) & 0xff])]);
  this.extendedPrivateKey = Buffer.concat([this.extendedPrivateKey, new Buffer([(v >> 8) & 0xff])]);
  this.extendedPrivateKey = Buffer.concat([this.extendedPrivateKey, new Buffer([v & 0xff])]);

  // Depth
  this.extendedPrivateKey = Buffer.concat([this.extendedPrivateKey, new Buffer([this.depth])]);

  // Parent fingerprint
  this.extendedPrivateKey = Buffer.concat([this.extendedPrivateKey, this.parentFingerprint]);

  // Child index
  this.extendedPrivateKey = Buffer.concat([this.extendedPrivateKey, new Buffer([this.childIndex >>> 24])]);
  this.extendedPrivateKey = Buffer.concat([this.extendedPrivateKey, new Buffer([(this.childIndex >>> 16) & 0xff])]);
  this.extendedPrivateKey = Buffer.concat([this.extendedPrivateKey, new Buffer([(this.childIndex >>> 8) & 0xff])]);
  this.extendedPrivateKey = Buffer.concat([this.extendedPrivateKey, new Buffer([this.childIndex & 0xff])]);

  // Chain code
  this.extendedPrivateKey = Buffer.concat([this.extendedPrivateKey, this.chainCode]);

  // Private key
  this.extendedPrivateKey = Buffer.concat([this.extendedPrivateKey, new Buffer([0])]);
  this.extendedPrivateKey = Buffer.concat([this.extendedPrivateKey, this.eckey.private]);
}

BIP32.prototype.extendedPrivateKeyString = function(format) {
  if (format === undefined || format === "base58") {
    var hash = coinUtil.sha256(coinUtil.sha256(this.extendedPrivateKey));
    var checksum = hash.slice(0, 4);
    var data = Buffer.concat([this.extendedPrivateKey, checksum]);
    return base58.encode(data);
  } else if (format === "hex") {
    return this.extendedPrivateKey.toString('hex');
  } else {
    throw new Error("bad format");
  }
}


BIP32.prototype.derive = function(path) {
  var e = path.split('/');

  // Special cases:
  if (path == 'm' || path == 'M' || path == 'm\'' || path == 'M\'')
    return this;

  var bip32 = this;
  for (var i in e) {
    var c = e[i];

    if (i == 0 ) {
      if (c != 'm') throw new Error("invalid path");
      continue;
    }

    var usePrivate = (c.length > 1) && (c[c.length-1] == '\'');
    var childIndex = parseInt(usePrivate ? c.slice(0, c.length - 1) : c) & 0x7fffffff;

    if (usePrivate)
      childIndex += 0x80000000;

    bip32 = bip32.deriveChild(childIndex);
  }

  return bip32;
}

BIP32.prototype.deriveChild = function(i) {
  var ib = [];
  ib.push((i >> 24) & 0xff);
  ib.push((i >> 16) & 0xff);
  ib.push((i >>  8) & 0xff);
  ib.push(i & 0xff);
  ib = new Buffer(ib);

  var usePrivate = (i & 0x80000000) != 0;

  var isPrivate = 
    (this.version == networks['livenet'].bip32privateVersion  ||
     this.version == networks['testnet'].bip32privateVersion  );

  if (usePrivate && (!this.hasPrivateKey || !isPrivate))
    throw new Error("Cannot do private key derivation without private key");

  var ret = null;
  if (this.hasPrivateKey) {
    var data = null;

    if (usePrivate) {
      data = Buffer.concat([new Buffer([0]), this.eckey.private, ib]);
    } else {
      data = Buffer.concat([this.eckey.public, ib]);
    }

    var hash = coinUtil.sha512hmac(data, this.chainCode);
    var il = bignum.fromBuffer(hash.slice(0, 32), {size: 32});
    var ir = hash.slice(32, 64);

    // ki = IL + kpar (mod n).
    var priv = bignum.fromBuffer(this.eckey.private, {size: 32});
    var k = il.add(priv).mod(secp256k1_n);

    ret = new BIP32();
    ret.chainCode = ir;

    ret.eckey = new Key();
    ret.eckey.private = k.toBuffer({size: 32});
    ret.eckey.regenerateSync();
    ret.hasPrivateKey = true;

  } else {
    var data = Buffer.concat([this.eckey.public, ib]);
    var hash = coinUtil.sha512hmac(data, this.chainCode);
    var il = bignum.fromBuffer(hash.slice(0, 32), {size: 32});
    var ir = hash.slice(32, 64);

    // Ki = (IL + kpar)*G = IL*G + Kpar
    var ilGkey = new Key();
    ilGkey.private = il.toBuffer({size: 32});
    ilGkey.regenerateSync();
    var ilG = Point.fromKey(ilGkey);
    var oldkey = new Key();
    oldkey.public = this.eckey.public;
    var Kpar = Point.fromKey(oldkey);
    var newpub = Point.add(ilG, Kpar).toKey().public;

    ret = new BIP32();
    ret.chainCode = new Buffer(ir);

    var eckey = new Key();
    eckey.public = newpub; 
    ret.eckey = eckey;
    ret.hasPrivateKey = false;
  }

  ret.childIndex = i;
  ret.parentFingerprint = this.pubKeyHash.slice(0,4);
  ret.version = this.version;
  ret.depth = this.depth + 1;

  ret.eckey.compressed = true;
  ret.pubKeyHash = coinUtil.sha256ripe160(ret.eckey.public);

  ret.buildExtendedPublicKey();
  ret.buildExtendedPrivateKey();

  return ret;
}


function uint(f, size) {
  if (f.length < size)
    throw new Error("not enough data");
  var n = 0;
  for (var i = 0; i < size; i++) {
    n *= 256;
    n += f[i];
  }
  return n;
}

function u8(f)  {return uint(f,1);}
function u16(f) {return uint(f,2);}
function u32(f) {return uint(f,4);}
function u64(f) {return uint(f,8);}

module.exports = require('soop')(BIP32);
