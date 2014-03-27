var imports = require('soop').imports();
var base58 = imports.base58 || require('base58-native').base58;
var coinUtil = imports.coinUtil || require('./util/util');
var Key = imports.Key || require('./Key');
var Point = imports.Point || require('./Point');
var bignum = imports.bignum || require('bignum');
var crypto = require('crypto');
var networks = require('./networks');

var secp256k1_n = new bignum("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", 16);
var secp256k1_Gx = new bignum("79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798", 16);

var BIP32 = function(bytes) {
  if (bytes == 'mainnet' || bytes == 'livenet')
    this.version = networks['livenet'].bip32private;
  else if (bytes == 'testnet')
    this.version = networks['testnet'].bip32private;

  if (bytes == 'mainnet' || bytes == 'livenet' || bytes == 'testnet') {
    this.depth = 0x00;
    this.parent_fingerprint = new Buffer([0, 0, 0, 0]);
    this.child_index = new Buffer([0, 0, 0, 0]);
    this.chain_code = Key.generateSync().private;
    this.eckey = Key.generateSync();
    this.has_private_key = true;
    this.pubKeyHash = coinUtil.sha256ripe160(this.eckey.public);
    this.build_extended_public_key();
    this.build_extended_private_key();
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
    this.init_from_bytes(bytes);
}

BIP32.prototype.init_from_bytes = function(bytes) {
  // Both pub and private extended keys are 78 bytes
  if(bytes.length != 78) throw new Error("not enough data");

  this.version      = u32(bytes.slice(0, 4));
  this.depth        = u8(bytes.slice(4, 5));
  this.parent_fingerprint = bytes.slice(5, 9);
  this.child_index    = u32(bytes.slice(9, 13));
  this.chain_code     = bytes.slice(13, 45);
  
  var key_bytes = bytes.slice(45, 78);

  var is_private = 
    (this.version == networks['livenet'].bip32private  ||
     this.version == networks['testnet'].bip32private  );

  var is_public = 
    (this.version == networks['livenet'].bip32public  ||
     this.version == networks['testnet'].bip32public  );

  if (is_private && key_bytes[0] == 0) {
    this.eckey = new Key();
    this.eckey.private = key_bytes.slice(1, 33);
    this.eckey.compressed = true;
    this.eckey.regenerateSync();
    this.pubKeyHash = coinUtil.sha256ripe160(this.eckey.public);
    this.has_private_key = true;
  } else if (is_public && (key_bytes[0] == 0x02 || key_bytes[0] == 0x03)) {
    this.eckey = new Key();
    this.eckey.public = key_bytes;
    this.pubKeyHash = coinUtil.sha256ripe160(this.eckey.public);
    this.has_private_key = false;
  } else {
    throw new Error("Invalid key");
  }

  this.build_extended_public_key();
  this.build_extended_private_key();
}

BIP32.prototype.build_extended_public_key = function() {
  this.extended_public_key = new Buffer([]);

  var v = null;
  switch(this.version) {
  case networks['livenet'].bip32public:
  case networks['livenet'].bip32private:
    v = networks['livenet'].bip32public;
    break;
  case networks['testnet'].bip32public:
  case networks['testnet'].bip32private:
    v = networks['testnet'].bip32public;
    break;
   default:
    throw new Error("Unknown version");
  }

  // Version
  this.extended_public_key = Buffer.concat([this.extended_public_key, new Buffer([v >> 24])]);
  this.extended_public_key = Buffer.concat([this.extended_public_key, new Buffer([(v >> 16) & 0xff])]);
  this.extended_public_key = Buffer.concat([this.extended_public_key, new Buffer([(v >> 8) & 0xff])]);
  this.extended_public_key = Buffer.concat([this.extended_public_key, new Buffer([v & 0xff])]);

  // Depth
  this.extended_public_key = Buffer.concat([this.extended_public_key, new Buffer([this.depth])]);

  // Parent fingerprint
  this.extended_public_key = Buffer.concat([this.extended_public_key, this.parent_fingerprint]);

  // Child index
  this.extended_public_key = Buffer.concat([this.extended_public_key, new Buffer([this.child_index >>> 24])]);
  this.extended_public_key = Buffer.concat([this.extended_public_key, new Buffer([(this.child_index >>> 16) & 0xff])]);
  this.extended_public_key = Buffer.concat([this.extended_public_key, new Buffer([(this.child_index >>> 8) & 0xff])]);
  this.extended_public_key = Buffer.concat([this.extended_public_key, new Buffer([this.child_index & 0xff])]);

  // Chain code
  this.extended_public_key = Buffer.concat([this.extended_public_key, this.chain_code]);

  // Public key
  this.extended_public_key = Buffer.concat([this.extended_public_key, this.eckey.public]);
}

BIP32.prototype.extended_public_key_string = function(format) {
  if (format === undefined || format === "base58") {
    var hash = coinUtil.sha256(coinUtil.sha256(this.extended_public_key));
    var checksum = hash.slice(0, 4);
    var data = Buffer.concat([this.extended_public_key, checksum]);
    return base58.encode(data);
  } else if (format === "hex") {
    return this.extended_public_key.toString('hex');;
  } else {
    throw new Error("bad format");
  }
}

BIP32.prototype.build_extended_private_key = function() {
  if (!this.has_private_key) return;
  this.extended_private_key = new Buffer([]);

  var v = this.version;

  // Version
  this.extended_private_key = Buffer.concat([this.extended_private_key, new Buffer([v >> 24])]);
  this.extended_private_key = Buffer.concat([this.extended_private_key, new Buffer([(v >> 16) & 0xff])]);
  this.extended_private_key = Buffer.concat([this.extended_private_key, new Buffer([(v >> 8) & 0xff])]);
  this.extended_private_key = Buffer.concat([this.extended_private_key, new Buffer([v & 0xff])]);

  // Depth
  this.extended_private_key = Buffer.concat([this.extended_private_key, new Buffer([this.depth])]);

  // Parent fingerprint
  this.extended_private_key = Buffer.concat([this.extended_private_key, this.parent_fingerprint]);

  // Child index
  this.extended_private_key = Buffer.concat([this.extended_private_key, new Buffer([this.child_index >>> 24])]);
  this.extended_private_key = Buffer.concat([this.extended_private_key, new Buffer([(this.child_index >>> 16) & 0xff])]);
  this.extended_private_key = Buffer.concat([this.extended_private_key, new Buffer([(this.child_index >>> 8) & 0xff])]);
  this.extended_private_key = Buffer.concat([this.extended_private_key, new Buffer([this.child_index & 0xff])]);

  // Chain code
  this.extended_private_key = Buffer.concat([this.extended_private_key, this.chain_code]);

  // Private key
  this.extended_private_key = Buffer.concat([this.extended_private_key, new Buffer([0])]);
  this.extended_private_key = Buffer.concat([this.extended_private_key, this.eckey.private]);
}

BIP32.prototype.extended_private_key_string = function(format) {
  if (format === undefined || format === "base58") {
    var hash = coinUtil.sha256(coinUtil.sha256(this.extended_private_key));
    var checksum = hash.slice(0, 4);
    var data = Buffer.concat([this.extended_private_key, checksum]);
    return base58.encode(data);
  } else if (format === "hex") {
    return this.extended_private_key.toString('hex');
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

    var use_private = (c.length > 1) && (c[c.length-1] == '\'');
    var child_index = parseInt(use_private ? c.slice(0, c.length - 1) : c) & 0x7fffffff;

    if (use_private)
      child_index += 0x80000000;

    bip32 = bip32.derive_child(child_index);
  }

  return bip32;
}

BIP32.prototype.derive_child = function(i) {
  var ib = [];
  ib.push((i >> 24) & 0xff);
  ib.push((i >> 16) & 0xff);
  ib.push((i >>  8) & 0xff);
  ib.push(i & 0xff);
  ib = new Buffer(ib);

  var use_private = (i & 0x80000000) != 0;

  var is_private = 
    (this.version == networks['livenet'].bip32private  ||
     this.version == networks['testnet'].bip32private  );

  if (use_private && (!this.has_private_key || !is_private))
    throw new Error("Cannot do private key derivation without private key");

  var ret = null;
  if (this.has_private_key) {
    var data = null;

    if (use_private) {
      data = Buffer.concat([new Buffer([0]), this.eckey.private, ib]);
    } else {
      data = Buffer.concat([this.eckey.public, ib]);
    }

    var hash = coinUtil.sha512hmac(data, this.chain_code);
    var il = bignum.fromBuffer(hash.slice(0, 32), {size: 32});
    var ir = hash.slice(32, 64);

    // ki = IL + kpar (mod n).
    var priv = bignum.fromBuffer(this.eckey.private, {size: 32});
    var k = il.add(priv).mod(secp256k1_n);

    ret = new BIP32();
    ret.chain_code = ir;

    ret.eckey = new Key();
    ret.eckey.private = k.toBuffer({size: 32});
    ret.eckey.regenerateSync();
    ret.has_private_key = true;

  } else {
    var data = Buffer.concat([this.eckey.public, ib]);
    var hash = coinUtil.sha512hmac(data, this.chain_code);
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
    ret.chain_code = new Buffer(ir);

    var eckey = new Key();
    eckey.public = newpub; 
    ret.eckey = eckey;
    ret.has_private_key = false;
  }

  ret.child_index = i;
  ret.parent_fingerprint = this.pubKeyHash.slice(0,4);
  ret.version = this.version;
  ret.depth = this.depth + 1;

  ret.eckey.compressed = true;
  ret.pubKeyHash = coinUtil.sha256ripe160(ret.eckey.public);

  ret.build_extended_public_key();
  ret.build_extended_private_key();

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
