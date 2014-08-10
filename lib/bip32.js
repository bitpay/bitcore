var base58 = require('./base58');
var Hash = require('./hash');
var Key = require('./key');
var Pubkey = require('./pubkey');
var Privkey = require('./privkey');
var Point = require('./point');
var Random = require('./random');
var bn = require('./bn');
var constants = require('./constants');

var BIP32 = function(str) {
  if (str === 'testnet' || str === 'mainnet') {
    this.version = constants[str].bip32privkey;
    this.fromRandom();
  }
  else if (str)
    this.fromString(str);
}

BIP32.prototype.fromRandom = function(network) {
  if (!network)
    network = 'mainnet';
  this.version = constants[network].bip32privkey;
  this.depth = 0x00;
  this.parentFingerprint = new Buffer([0, 0, 0, 0]);
  this.childIndex = new Buffer([0, 0, 0, 0]);
  this.chainCode = Random.getRandomBuffer(32);
  this.key = (new Key()).fromRandom();
  this.hasPrivateKey = true;
  this.pubKeyHash = Hash.sha256ripemd160(this.key.pubkey.toBuffer());
  this.buildExtendedPublicKey();
  this.buildExtendedPrivateKey();
};

BIP32.prototype.fromString = function(str) {
  var decoded = base58.decode(str);
  if (decoded.length != 82)
    throw new Error('bip32: Not enough data, expected 82 and received ' + decoded.length);
  var checksum = decoded.slice(78, 82);
  var bytes = decoded.slice(0, 78);

  var hash = Hash.sha256sha256(bytes);

  if (hash[0] != checksum[0] || hash[1] != checksum[1] || hash[2] != checksum[2] || hash[3] != checksum[3])
    throw new Error('bip32: Invalid checksum');

  if (bytes !== undefined && bytes !== null)
    this.initFromBytes(bytes);
};

BIP32.prototype.fromSeed = function(bytes, network) {
  if (!network)
    network = 'mainnet';

  if (!Buffer.isBuffer(bytes))
    throw new Error('bip32: bytes must be a buffer');
  if (bytes.length < 128 / 8)
    throw new Error('bip32: Need more than 128 bytes of entropy'); 
  if (bytes.length > 512 / 8)
    throw new Error('bip32: More than 512 bytes of entropy is nonstandard');
  var hash = Hash.sha512hmac(bytes, new Buffer('Bitcoin seed'));

  this.depth = 0x00;
  this.parentFingerprint = new Buffer([0, 0, 0, 0]);
  this.childIndex = new Buffer([0, 0, 0, 0]);
  this.chainCode = hash.slice(32, 64);
  this.version = constants[network].bip32privkey;
  this.key = new Key();
  this.key.privkey = new Privkey(bn.fromBuffer(hash.slice(0, 32)));
  this.key.privkey2pubkey();
  this.hasPrivateKey = true;
  this.pubKeyHash = Hash.sha256ripemd160(this.key.pubkey.toBuffer());

  this.buildExtendedPublicKey();
  this.buildExtendedPrivateKey();

  return this;
};

BIP32.prototype.initFromBytes = function(bytes) {
  // Both pub and private extended keys are 78 bytes
  if (bytes.length != 78)
    throw new Error('bip32: not enough data');

  this.version = u32(bytes.slice(0, 4));
  this.depth = u8(bytes.slice(4, 5));
  this.parentFingerprint = bytes.slice(5, 9);
  this.childIndex = u32(bytes.slice(9, 13));
  this.chainCode = bytes.slice(13, 45);

  var keyBytes = bytes.slice(45, 78);

  var isPrivate =
    (this.version == constants.mainnet.bip32privkey ||
      this.version == constants.testnet.bip32privkey);

  var isPublic =
    (this.version == constants.mainnet.bip32pubkey ||
      this.version == constants.testnet.bip32pubkey);

  if (isPrivate && keyBytes[0] == 0) {
    this.key = new Key();
    this.key.privkey = new Privkey(bn.fromBuffer(keyBytes.slice(1, 33)));
    this.key.privkey2pubkey();
    this.pubKeyHash = Hash.sha256ripemd160(this.key.pubkey.toBuffer());
    this.hasPrivateKey = true;
  } else if (isPublic && (keyBytes[0] == 0x02 || keyBytes[0] == 0x03)) {
    this.key = new Key();
    this.key.pubkey = (new Pubkey()).fromDER(keyBytes);
    this.pubKeyHash = Hash.sha256ripemd160(this.key.pubkey.toBuffer());
    this.hasPrivateKey = false;
  } else {
    throw new Error('bip32: Invalid key');
  }

  this.buildExtendedPublicKey();
  this.buildExtendedPrivateKey();
}

BIP32.prototype.buildExtendedPublicKey = function() {
  this.extendedPublicKey = new Buffer([]);

  var v = null;
  switch (this.version) {
    case constants.mainnet.bip32pubkey:
    case constants.mainnet.bip32privkey:
      v = constants.mainnet.bip32pubkey;
      break;
    case constants.testnet.bip32pubkey:
    case constants.testnet.bip32privkey:
      v = constants.testnet.bip32pubkey;
      break;
    default:
      throw new Error('bip32: Unknown version');
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
    this.key.pubkey.toBuffer()
  ]);
}

BIP32.prototype.extendedPublicKeyString = function(format) {
  if (format === undefined || format === 'base58') {
    if (!Buffer.isBuffer(this.extendedPublicKey))
      console.log('extendedPublicKey: ' + this.extendedPublicKey);
    var hash = Hash.sha256sha256(this.extendedPublicKey);
    var checksum = hash.slice(0, 4);
    var data = Buffer.concat([this.extendedPublicKey, checksum]);
    return base58.encode(data);
  } else if (format === 'hex') {
    return this.extendedPublicKey.toString('hex');;
  } else {
    throw new Error('bip32: bad format');
  }
}

BIP32.prototype.buildExtendedPrivateKey = function() {
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
    this.key.privkey.n.toBuffer({size: 32})
  ]);
}

BIP32.prototype.extendedPrivateKeyString = function(format) {
  if (format === undefined || format === 'base58') {
    var hash = Hash.sha256sha256(this.extendedPrivateKey);
    var checksum = hash.slice(0, 4);
    var data = Buffer.concat([this.extendedPrivateKey, checksum]);
    return base58.encode(data);
  } else if (format === 'hex') {
    return this.extendedPrivateKey.toString('hex');
  } else {
    throw new Error('bip32: bad format');
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

    if (i == 0) {
      if (c != 'm') throw new Error('bip32: invalid path');
      continue;
    }

    if (parseInt(c.replace("'", "")).toString() !== c.replace("'", ""))
      throw new Error('bip32: invalid path');

    var usePrivate = (c.length > 1) && (c[c.length - 1] == '\'');
    var childIndex = parseInt(usePrivate ? c.slice(0, c.length - 1) : c) & 0x7fffffff;

    if (usePrivate)
      childIndex += 0x80000000;

    bip32 = bip32.deriveChild(childIndex);
  }

  return bip32;
}

BIP32.prototype.deriveChild = function(i) {
  if (typeof i !== 'number')
    throw new Error('bip32: i must be a number');

  var ib = [];
  ib.push((i >> 24) & 0xff);
  ib.push((i >> 16) & 0xff);
  ib.push((i >> 8) & 0xff);
  ib.push(i & 0xff);
  ib = new Buffer(ib);

  var usePrivate = (i & 0x80000000) != 0;

  var isPrivate =
    (this.version == constants.mainnet.bip32privkey ||
      this.version == constants.testnet.bip32privkey);

  if (usePrivate && (!this.hasPrivateKey || !isPrivate))
    throw new Error('bip32: Cannot do private key derivation without private key');

  var ret = null;
  if (this.hasPrivateKey) {
    var data = null;

    if (usePrivate) {
      data = Buffer.concat([new Buffer([0]), this.key.privkey.n.toBuffer({size: 32}), ib]);
    } else {
      data = Buffer.concat([this.key.pubkey.toBuffer({size: 32}), ib]);
    }

    var hash = Hash.sha512hmac(data, this.chainCode);
    var il = bn.fromBuffer(hash.slice(0, 32), {size: 32});
    var ir = hash.slice(32, 64);

    // ki = IL + kpar (mod n).
    var k = il.add(this.key.privkey.n).mod(Point.getN());

    ret = new BIP32();
    ret.chainCode = ir;

    ret.key = new Key();
    ret.key.privkey = new Privkey(k);
    ret.key.privkey2pubkey();
    ret.hasPrivateKey = true;

  } else {
    var data = Buffer.concat([this.key.pubkey.toBuffer(), ib]);
    var hash = Hash.sha512hmac(data, this.chainCode);
    var il = bn(hash.slice(0, 32));
    var ir = hash.slice(32, 64);

    // Ki = (IL + kpar)*G = IL*G + Kpar
    var ilG = Point.getG().mul(il);
    var Kpar = this.key.pubkey.p;
    var Ki = ilG.add(Kpar);
    var newpub = new Pubkey();
    newpub.p = Ki;

    ret = new BIP32();
    ret.chainCode = ir;

    var key = new Key();
    key.pubkey = newpub;
    ret.key = key;
    ret.hasPrivateKey = false;
  }

  ret.childIndex = i;
  ret.parentFingerprint = this.pubKeyHash.slice(0, 4);
  ret.version = this.version;
  ret.depth = this.depth + 1;

  ret.pubKeyHash = Hash.sha256ripemd160(ret.key.pubkey.toBuffer());

  ret.buildExtendedPublicKey();
  ret.buildExtendedPrivateKey();

  return ret;
}

BIP32.prototype.toString = function() {
  var isPrivate =
    (this.version == constants.mainnet.bip32privkey ||
      this.version == constants.testnet.bip32privkey);

  if (isPrivate)
    return this.extendedPrivateKeyString();
  else
    return this.extendedPublicKeyString();
};

function uint(f, size) {
  if (f.length < size)
    throw new Error('bip32: not enough data');
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

module.exports = BIP32;
