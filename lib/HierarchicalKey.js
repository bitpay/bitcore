var base58 = require('./Base58').base58;
var coinUtil = require('../util');
var Key = require('./Key');
var Point = require('./Point');
var SecureRandom = require('./SecureRandom');
var bignum = require('bignum');
var networks = require('../networks');

var secp256k1_n = new bignum('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141', 16);
var secp256k1_Gx = new bignum('79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798', 16);

/*
random new HierarchicalKey: new HierarchicalKey();
from extended public or private key: new HierarchicalKey(str);
new blank HierarchicalKey: new HierarchicalKey(null);
*/
var HierarchicalKey = function(bytes) {
  if (typeof bytes == 'undefined' || bytes == 'mainnet' || bytes == 'livenet') {
    bytes = 'livenet';
    this.version = networks['livenet'].hkeyPrivateVersion;
  } else if (bytes == 'testnet') {
    this.version = networks['testnet'].hkeyPrivateVersion;
  }
  if (bytes == 'livenet' || bytes == 'testnet') {
    this.depth = 0x00;
    this.parentFingerprint = new Buffer([0, 0, 0, 0]);
    this.childIndex = new Buffer([0, 0, 0, 0]);
    this.chainCode = SecureRandom.getRandomBuffer(32);
    this.eckey = Key.generateSync();
    this.hasPrivateKey = true;
    this.pubKeyHash = coinUtil.sha256ripe160(this.eckey.public);
    this.buildExtendedPublicKey();
    this.buildExtendedPrivateKey();
    return;
  }

  // decode base58
  if (typeof bytes === 'string') {
    var decoded = base58.decode(bytes);
    if (decoded.length != 82)
      throw new Error('Not enough data, expected 82 and received ' + decoded.length);
    var checksum = decoded.slice(78, 82);
    bytes = decoded.slice(0, 78);

    var hash = coinUtil.sha256(coinUtil.sha256(bytes));

    if (hash[0] != checksum[0] || hash[1] != checksum[1] || hash[2] != checksum[2] || hash[3] != checksum[3]) {
      throw new Error('Invalid checksum');
    }
  }

  if (bytes !== undefined && bytes !== null)
    this.initFromBytes(bytes);
}

HierarchicalKey.seed = function(bytes, network) {
  if (!network)
    network = 'livenet';

  if (!Buffer.isBuffer(bytes))
    bytes = new Buffer(bytes, 'hex'); //if not buffer, assume hex
  if (bytes.length < 128 / 8)
    return false; //need more entropy
  if (bytes.length > 512 / 8)
    return false;
  var hash = coinUtil.sha512hmac(bytes, new Buffer('Bitcoin seed'));

  var hkey = new HierarchicalKey(null);
  hkey.depth = 0x00;
  hkey.parentFingerprint = new Buffer([0, 0, 0, 0]);
  hkey.childIndex = new Buffer([0, 0, 0, 0]);
  hkey.chainCode = hash.slice(32, 64);
  hkey.version = networks[network].hkeyPrivateVersion;
  hkey.eckey = new Key();
  hkey.eckey.private = hash.slice(0, 32);
  hkey.eckey.regenerateSync();
  hkey.hasPrivateKey = true;
  hkey.pubKeyHash = coinUtil.sha256ripe160(hkey.eckey.public);

  hkey.buildExtendedPublicKey();
  hkey.buildExtendedPrivateKey();

  return hkey;
};

HierarchicalKey.prototype.initFromBytes = function(bytes) {
  // Both pub and private extended keys are 78 bytes
  if (bytes.length != 78) throw new Error('not enough data');

  this.version = u32(bytes.slice(0, 4));
  this.depth = u8(bytes.slice(4, 5));
  this.parentFingerprint = bytes.slice(5, 9);
  this.childIndex = u32(bytes.slice(9, 13));
  this.chainCode = bytes.slice(13, 45);

  var keyBytes = bytes.slice(45, 78);

  var isPrivate =
    (this.version == networks['livenet'].hkeyPrivateVersion ||
      this.version == networks['testnet'].hkeyPrivateVersion);

  var isPublic =
    (this.version == networks['livenet'].hkeyPublicVersion ||
      this.version == networks['testnet'].hkeyPublicVersion);

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
    throw new Error('Invalid key');
  }

  this.buildExtendedPublicKey();
  this.buildExtendedPrivateKey();
}

HierarchicalKey.prototype.buildExtendedPublicKey = function() {
  this.extendedPublicKey = new Buffer([]);

  var v = null;
  switch (this.version) {
    case networks['livenet'].hkeyPublicVersion:
    case networks['livenet'].hkeyPrivateVersion:
      v = networks['livenet'].hkeyPublicVersion;
      break;
    case networks['testnet'].hkeyPublicVersion:
    case networks['testnet'].hkeyPrivateVersion:
      v = networks['testnet'].hkeyPublicVersion;
      break;
    default:
      throw new Error('Unknown version');
  }

  // Version
  this.extendedPublicKey = Buffer.concat([
    new Buffer([v >> 24]),
    new Buffer([(v >> 16) & 0xff]),
    new Buffer([(v >> 8) & 0xff]),
    new Buffer([v & 0xff]),
    new Buffer([this.depth]),
    this.parentFingerprint,
    new Buffer([this.childIndex >>> 24]),
    new Buffer([(this.childIndex >>> 16) & 0xff]),
    new Buffer([(this.childIndex >>> 8) & 0xff]),
    new Buffer([this.childIndex & 0xff]),
    this.chainCode,
    this.eckey.public
  ]);
}

HierarchicalKey.prototype.extendedPublicKeyString = function(format) {
  if (format === undefined || format === 'base58') {
    var hash = coinUtil.sha256(coinUtil.sha256(this.extendedPublicKey));
    var checksum = hash.slice(0, 4);
    var data = Buffer.concat([this.extendedPublicKey, checksum]);
    return base58.encode(data);
  } else if (format === 'hex') {
    return this.extendedPublicKey.toString('hex');;
  } else {
    throw new Error('bad format');
  }
}

HierarchicalKey.prototype.buildExtendedPrivateKey = function() {
  if (!this.hasPrivateKey) return;
  this.extendedPrivateKey = new Buffer([]);

  var v = this.version;

  this.extendedPrivateKey = Buffer.concat([
    new Buffer([v >> 24]),
    new Buffer([(v >> 16) & 0xff]),
    new Buffer([(v >> 8) & 0xff]),
    new Buffer([v & 0xff]),
    new Buffer([this.depth]),
    this.parentFingerprint,
    new Buffer([this.childIndex >>> 24]),
    new Buffer([(this.childIndex >>> 16) & 0xff]),
    new Buffer([(this.childIndex >>> 8) & 0xff]),
    new Buffer([this.childIndex & 0xff]),
    this.chainCode,
    new Buffer([0]),
    this.eckey.private
  ]);
}

HierarchicalKey.prototype.extendedPrivateKeyString = function(format) {
  if (format === undefined || format === 'base58') {
    var hash = coinUtil.sha256(coinUtil.sha256(this.extendedPrivateKey));
    var checksum = hash.slice(0, 4);
    var data = Buffer.concat([this.extendedPrivateKey, checksum]);
    return base58.encode(data);
  } else if (format === 'hex') {
    return this.extendedPrivateKey.toString('hex');
  } else {
    throw new Error('bad format');
  }
}


HierarchicalKey.prototype.derive = function(path) {
  var e = path.split('/');

  // Special cases:
  if (path == 'm' || path == 'M' || path == 'm\'' || path == 'M\'')
    return this;

  var hkey = this;
  for (var i in e) {
    var c = e[i];

    if (i == 0) {
      if (c != 'm') throw new Error('invalid path');
      continue;
    }

    var usePrivate = (c.length > 1) && (c[c.length - 1] == '\'');
    var childIndex = parseInt(usePrivate ? c.slice(0, c.length - 1) : c) & 0x7fffffff;

    if (usePrivate)
      childIndex += 0x80000000;

    hkey = hkey.deriveChild(childIndex);
  }

  return hkey;
}

HierarchicalKey.prototype.deriveChild = function(i) {
  var ib = [];
  ib.push((i >> 24) & 0xff);
  ib.push((i >> 16) & 0xff);
  ib.push((i >> 8) & 0xff);
  ib.push(i & 0xff);
  ib = new Buffer(ib);

  var usePrivate = (i & 0x80000000) != 0;

  var isPrivate =
    (this.version == networks['livenet'].hkeyPrivateVersion ||
      this.version == networks['testnet'].hkeyPrivateVersion);

  if (usePrivate && (!this.hasPrivateKey || !isPrivate))
    throw new Error('Cannot do private key derivation without private key');

  var ret = null;
  if (this.hasPrivateKey) {
    var data = null;

    if (usePrivate) {
      data = Buffer.concat([new Buffer([0]), this.eckey.private, ib]);
    } else {
      data = Buffer.concat([this.eckey.public, ib]);
    }

    var hash = coinUtil.sha512hmac(data, this.chainCode);
    var il = bignum.fromBuffer(hash.slice(0, 32), {
      size: 32
    });
    var ir = hash.slice(32, 64);

    // ki = IL + kpar (mod n).
    var priv = bignum.fromBuffer(this.eckey.private, {
      size: 32
    });
    var k = il.add(priv).mod(secp256k1_n);

    ret = new HierarchicalKey(null);
    ret.chainCode = ir;

    ret.eckey = new Key();
    ret.eckey.private = k.toBuffer({
      size: 32
    });
    ret.eckey.regenerateSync();
    ret.hasPrivateKey = true;

  } else {
    var data = Buffer.concat([this.eckey.public, ib]);
    var hash = coinUtil.sha512hmac(data, this.chainCode);
    var il = hash.slice(0, 32);
    var ir = hash.slice(32, 64);

    // Ki = (IL + kpar)*G = IL*G + Kpar
    var ilGkey = new Key();
    ilGkey.private = il;
    ilGkey.regenerateSync();
    ilGkey.compressed = false;
    var ilG = Point.fromUncompressedPubKey(ilGkey.public);
    var oldkey = new Key();
    oldkey.public = this.eckey.public;
    oldkey.compressed = false;
    var Kpar = Point.fromUncompressedPubKey(oldkey.public);
    var newpub = Point.add(ilG, Kpar).toUncompressedPubKey();

    ret = new HierarchicalKey(null);
    ret.chainCode = new Buffer(ir);

    var eckey = new Key();
    eckey.public = newpub;
    eckey.compressed = true;
    ret.eckey = eckey;
    ret.hasPrivateKey = false;
  }

  ret.childIndex = i;
  ret.parentFingerprint = this.pubKeyHash.slice(0, 4);
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
    throw new Error('not enough data');
  var n = 0;
  for (var i = 0; i < size; i++) {
    n *= 256;
    n += f[i];
  }
  return n;
}

function u8(f) {
  return uint(f, 1);
}

function u16(f) {
  return uint(f, 2);
}

function u32(f) {
  return uint(f, 4);
}

function u64(f) {
  return uint(f, 8);
}

module.exports = HierarchicalKey;
