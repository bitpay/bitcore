var Base58Check = require('./base58check');
var Hash = require('./hash');
var Keypair = require('./keypair');
var Pubkey = require('./pubkey');
var Privkey = require('./privkey');
var Point = require('./point');
var Random = require('./random');
var BN = require('./bn');
var constants = require('./constants');

var BIP32 = function BIP32(obj) {
  if (!(this instanceof BIP32))
    return new BIP32(obj);
  if (typeof obj === 'string') {
    var str = obj;
    this.fromString(str);
  } else if (obj ) {
    this.set(obj);
  }
}

BIP32.prototype.set = function(obj) {
  this.version = typeof obj.version !== 'undefined' ? obj.version : this.version;
  this.depth = typeof obj.depth !== 'undefined' ? obj.depth : this.depth;
  this.parentfingerprint = obj.parentfingerprint || this.parentfingerprint;
  this.childindex = obj.childindex || this.childindex;
  this.chaincode = obj.chaincode || this.chaincode;
  this.keypair = obj.keypair || this.keypair;
  this.hasprivkey = typeof obj.hasprivkey !== 'undefined' ? obj.hasprivkey : this.hasprivkey;
  this.pubkeyhash = obj.pubkeyhash || this.pubkeyhash;
  this.xpubkey = obj.xpubkey || this.xpubkey;
  this.xprivkey = obj.xprivkey || this.xprivkey;
  return this;
};

BIP32.prototype.fromRandom = function(networkstr) {
  if (!networkstr)
    networkstr = 'mainnet';
  this.version = constants[networkstr].bip32privkey;
  this.depth = 0x00;
  this.parentfingerprint = new Buffer([0, 0, 0, 0]);
  this.childindex = new Buffer([0, 0, 0, 0]);
  this.chaincode = Random.getRandomBuffer(32);
  this.keypair = (new Keypair()).fromRandom();
  this.hasprivkey = true;
  this.pubkeyhash = Hash.sha256ripemd160(this.keypair.pubkey.toBuffer());
  this.buildxpubkey();
  this.buildxprivkey();
};

BIP32.prototype.fromString = function(str) {
  var bytes = Base58Check.decode(str);
  this.initFromBytes(bytes);
  return this;
};

BIP32.prototype.fromSeed = function(bytes, networkstr) {
  if (!networkstr)
    networkstr = 'mainnet';

  if (!Buffer.isBuffer(bytes))
    throw new Error('bytes must be a buffer');
  if (bytes.length < 128 / 8)
    throw new Error('Need more than 128 bytes of entropy'); 
  if (bytes.length > 512 / 8)
    throw new Error('More than 512 bytes of entropy is nonstandard');
  var hash = Hash.sha512hmac(bytes, new Buffer('Bitcoin seed'));

  this.depth = 0x00;
  this.parentfingerprint = new Buffer([0, 0, 0, 0]);
  this.childindex = new Buffer([0, 0, 0, 0]);
  this.chaincode = hash.slice(32, 64);
  this.version = constants[networkstr].bip32privkey;
  this.keypair = new Keypair();
  this.keypair.privkey = new Privkey({bn: BN().fromBuffer(hash.slice(0, 32))});
  this.keypair.privkey2pubkey();
  this.hasprivkey = true;
  this.pubkeyhash = Hash.sha256ripemd160(this.keypair.pubkey.toBuffer());

  this.buildxpubkey();
  this.buildxprivkey();

  return this;
};

BIP32.prototype.initFromBytes = function(bytes) {
  // Both pub and private extended keys are 78 bytes
  if (bytes.length != 78)
    throw new Error('not enough data');

  this.version = bytes.slice(0, 4).readUInt32BE(0);
  this.depth = bytes.slice(4, 5).readUInt8(0);
  this.parentfingerprint = bytes.slice(5, 9);
  this.childindex = bytes.slice(9, 13).readUInt32BE(0);
  this.chaincode = bytes.slice(13, 45);

  var keyBytes = bytes.slice(45, 78);

  var isPrivate =
    (this.version == constants.mainnet.bip32privkey ||
      this.version == constants.testnet.bip32privkey);

  var isPublic =
    (this.version == constants.mainnet.bip32pubkey ||
      this.version == constants.testnet.bip32pubkey);

  if (isPrivate && keyBytes[0] == 0) {
    this.keypair = new Keypair();
    this.keypair.privkey = new Privkey({bn: BN().fromBuffer(keyBytes.slice(1, 33))});
    this.keypair.privkey2pubkey();
    this.pubkeyhash = Hash.sha256ripemd160(this.keypair.pubkey.toBuffer());
    this.hasprivkey = true;
  } else if (isPublic && (keyBytes[0] == 0x02 || keyBytes[0] == 0x03)) {
    this.keypair = new Keypair();
    this.keypair.pubkey = (new Pubkey()).fromDER(keyBytes);
    this.pubkeyhash = Hash.sha256ripemd160(this.keypair.pubkey.toBuffer());
    this.hasprivkey = false;
  } else {
    throw new Error('Invalid key');
  }

  this.buildxpubkey();
  this.buildxprivkey();
}

BIP32.prototype.buildxpubkey = function() {
  this.xpubkey = new Buffer([]);

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
      throw new Error('Unknown version');
  }

  // Version
  this.xpubkey = Buffer.concat([
    new Buffer([v >> 24]),
    new Buffer([(v >> 16) & 0xff]),
    new Buffer([(v >> 8) & 0xff]),
    new Buffer([v & 0xff]),
    new Buffer([this.depth]),
    this.parentfingerprint,
    new Buffer([this.childindex >>> 24]),
    new Buffer([(this.childindex >>> 16) & 0xff]),
    new Buffer([(this.childindex >>> 8) & 0xff]),
    new Buffer([this.childindex & 0xff]),
    this.chaincode,
    this.keypair.pubkey.toBuffer()
  ]);
}

BIP32.prototype.xpubkeyString = function(format) {
  if (format === undefined || format === 'base58') {
    return Base58Check.encode(this.xpubkey);
  } else if (format === 'hex') {
    return this.xpubkey.toString('hex');
  } else {
    throw new Error('bad format');
  }
}

BIP32.prototype.buildxprivkey = function() {
  if (!this.hasprivkey) return;
  this.xprivkey = new Buffer([]);

  var v = this.version;

  this.xprivkey = Buffer.concat([
    new Buffer([v >> 24]),
    new Buffer([(v >> 16) & 0xff]),
    new Buffer([(v >> 8) & 0xff]),
    new Buffer([v & 0xff]),
    new Buffer([this.depth]),
    this.parentfingerprint,
    new Buffer([this.childindex >>> 24]),
    new Buffer([(this.childindex >>> 16) & 0xff]),
    new Buffer([(this.childindex >>> 8) & 0xff]),
    new Buffer([this.childindex & 0xff]),
    this.chaincode,
    new Buffer([0]),
    this.keypair.privkey.bn.toBuffer({size: 32})
  ]);
}

BIP32.prototype.xprivkeyString = function(format) {
  if (format === undefined || format === 'base58') {
    return Base58Check.encode(this.xprivkey);
  } else if (format === 'hex') {
    return this.xprivkey.toString('hex');
  } else {
    throw new Error('bad format');
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
      if (c != 'm') throw new Error('invalid path');
      continue;
    }

    if (parseInt(c.replace("'", "")).toString() !== c.replace("'", ""))
      throw new Error('invalid path');

    var usePrivate = (c.length > 1) && (c[c.length - 1] == '\'');
    var childindex = parseInt(usePrivate ? c.slice(0, c.length - 1) : c) & 0x7fffffff;

    if (usePrivate)
      childindex += 0x80000000;

    bip32 = bip32.deriveChild(childindex);
  }

  return bip32;
}

BIP32.prototype.deriveChild = function(i) {
  if (typeof i !== 'number')
    throw new Error('i must be a number');

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

  if (usePrivate && (!this.hasprivkey || !isPrivate))
    throw new Error('Cannot do private key derivation without private key');

  var ret = null;
  if (this.hasprivkey) {
    var data = null;

    if (usePrivate) {
      data = Buffer.concat([new Buffer([0]), this.keypair.privkey.bn.toBuffer({size: 32}), ib]);
    } else {
      data = Buffer.concat([this.keypair.pubkey.toBuffer({size: 32}), ib]);
    }

    var hash = Hash.sha512hmac(data, this.chaincode);
    var il = BN().fromBuffer(hash.slice(0, 32), {size: 32});
    var ir = hash.slice(32, 64);

    // ki = IL + kpar (mod n).
    var k = il.add(this.keypair.privkey.bn).mod(Point.getN());

    ret = new BIP32();
    ret.chaincode = ir;

    ret.keypair = new Keypair();
    ret.keypair.privkey = new Privkey({bn: k});
    ret.keypair.privkey2pubkey();
    ret.hasprivkey = true;

  } else {
    var data = Buffer.concat([this.keypair.pubkey.toBuffer(), ib]);
    var hash = Hash.sha512hmac(data, this.chaincode);
    var il = BN().fromBuffer(hash.slice(0, 32));
    var ir = hash.slice(32, 64);

    // Ki = (IL + kpar)*G = IL*G + Kpar
    var ilG = Point.getG().mul(il);
    var Kpar = this.keypair.pubkey.point;
    var Ki = ilG.add(Kpar);
    var newpub = new Pubkey();
    newpub.point = Ki;

    ret = new BIP32();
    ret.chaincode = ir;

    var keypair = new Keypair();
    keypair.pubkey = newpub;
    ret.keypair = keypair;
    ret.hasprivkey = false;
  }

  ret.childindex = i;
  ret.parentfingerprint = this.pubkeyhash.slice(0, 4);
  ret.version = this.version;
  ret.depth = this.depth + 1;

  ret.pubkeyhash = Hash.sha256ripemd160(ret.keypair.pubkey.toBuffer());

  ret.buildxpubkey();
  ret.buildxprivkey();

  return ret;
}

BIP32.prototype.toString = function() {
  var isPrivate =
    (this.version == constants.mainnet.bip32privkey ||
      this.version == constants.testnet.bip32privkey);

  if (isPrivate)
    return this.xprivkeyString();
  else
    return this.xpubkeyString();
};

module.exports = BIP32;
