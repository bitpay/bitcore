//var base58 = imports.base58 || require('base58-native').base58Check;
var base58 = imports.base58 || require('base58-native').base58;
var coinUtil = imports.coinUtil || require('./util/util');
var Key = imports.Key || require('./Key');
var bignum = require('bignum');

var BITCOIN_MAINNET_PUBLIC = 0x0488b21e;
var BITCOIN_MAINNET_PRIVATE = 0x0488ade4;
var BITCOIN_TESTNET_PUBLIC = 0x043587cf;
var BITCOIN_TESTNET_PRIVATE = 0x04358394;
var DOGECOIN_MAINNET_PUBLIC = 0x02facafd;
var DOGECOIN_MAINNET_PRIVATE = 0x02fac398;
var DOGECOIN_TESTNET_PUBLIC = 0x0432a9a8;
var DOGECOIN_TESTNET_PRIVATE = 0x0432a243;
var LITECOIN_MAINNET_PUBLIC = 0x019da462;
var LITECOIN_MAINNET_PRIVATE = 0x019d9cfe;
var LITECOIN_TESTNET_PUBLIC = 0x0436f6e1;
var LITECOIN_TESTNET_PRIVATE = 0x0436ef7d;
var SECP256K1_N = new bignum("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", 16);

var BIP32 = function(bytes) {
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
    (this.version == BITCOIN_MAINNET_PRIVATE  ||
     this.version == BITCOIN_TESTNET_PRIVATE  ||
     this.version == DOGECOIN_MAINNET_PRIVATE ||
     this.version == DOGECOIN_TESTNET_PRIVATE ||
     this.version == LITECOIN_MAINNET_PRIVATE ||
     this.version == LITECOIN_TESTNET_PRIVATE );

  var is_public = 
    (this.version == BITCOIN_MAINNET_PUBLIC  ||
     this.version == BITCOIN_TESTNET_PUBLIC  ||
     this.version == DOGECOIN_MAINNET_PUBLIC ||
     this.version == DOGECOIN_TESTNET_PUBLIC ||
     this.version == LITECOIN_MAINNET_PUBLIC ||
     this.version == LITECOIN_TESTNET_PUBLIC );

  if (is_private && key_bytes[0] == 0) {
    /*
    this.eckey = new Bitcoin.ECKey(key_bytes.slice(1, 33));
    this.eckey.setCompressed(true);

    var ecparams = getSECCurveByName("secp256k1");
    var pt = ecparams.getG().multiply(this.eckey.priv);
    this.eckey.pub = pt;
    this.eckey.pubKeyHash = Bitcoin.Util.sha256ripe160(this.eckey.pub.getEncoded(true));
    this.has_private_key = true;
    */
    this.eckey = new Key();
    this.eckey.private = key_bytes.slice(1, 33);
    this.eckey.compressed = true;
    this.eckey.regenerateSync();
    this.pubKeyHash = coinUtil.sha256ripe160(this.eckey.public); //not compressed ... seems to conflict with below
    this.has_private_key = true;
  } else if (is_public && (key_bytes[0] == 0x02 || key_bytes[0] == 0x03)) {
    /* 
    this.eckey = new Bitcoin.ECKey();
    this.eckey.pub = decompress_pubkey(key_bytes);
    this.eckey.pubKeyHash = Bitcoin.Util.sha256ripe160(this.eckey.pub.getEncoded(true));
    //TODO: why compute hash of uncompressed, then compress again?
    this.eckey.setCompressed(true);
    this.has_private_key = false;
    */
    this.eckey = new Key();
    this.eckey.public = key_bytes; //assume compressed
    this.pubKeyHash = coinUtil.sha256ripe160(this.eckey.public); //not compressed ... seems to conflict with above
    this.has_private_key = false;
  } else {
    throw new Error("Invalid key");
  }

  this.build_extended_public_key();
  this.build_extended_private_key();
}

BIP32.prototype.build_extended_public_key = function() {
  this.extended_public_key = [];

  var v = null;
  switch(this.version) {
  case BITCOIN_MAINNET_PUBLIC:
  case BITCOIN_MAINNET_PRIVATE:
    v = BITCOIN_MAINNET_PUBLIC;
    break;
  case BITCOIN_TESTNET_PUBLIC:
  case BITCOIN_TESTNET_PRIVATE:
    v = BITCOIN_TESTNET_PUBLIC;
    break;
  case DOGECOIN_MAINNET_PUBLIC:
  case DOGECOIN_MAINNET_PRIVATE:
    v = DOGECOIN_MAINNET_PUBLIC;
    break;
  case DOGECOIN_TESTNET_PUBLIC:
  case DOGECOIN_TESTNET_PRIVATE:
    v = DOGECOIN_TESTNET_PUBLIC;
    break;
  case LITECOIN_MAINNET_PUBLIC:
  case LITECOIN_MAINNET_PRIVATE:
    v = LITECOIN_MAINNET_PUBLIC;
    break;
  case LITECOIN_TESTNET_PUBLIC:
  case LITECOIN_TESTNET_PRIVATE:
    v = LITECOIN_TESTNET_PUBLIC;
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
  this.extended_public_key = Buffer.concat([this.extended_public_key, this.eckey.pub]);
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
  this.extended_private_key = new Buffer();

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
  this.extended_private_key.push(0);
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
  ib.push(i & 0xff );
  ib = new Buffer(ib);

  var use_private = (i & 0x80000000) != 0;
  //var ecparams = getSECCurveByName("secp256k1");

  var is_private = 
    (this.version == BITCOIN_MAINNET_PRIVATE  ||
     this.version == BITCOIN_TESTNET_PRIVATE  ||
     this.version == DOGECOIN_MAINNET_PRIVATE ||
     this.version == DOGECOIN_TESTNET_PRIVATE ||
     this.version == LITECOIN_MAINNET_PRIVATE ||
     this.version == LITECOIN_TESTNET_PRIVATE);

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

    /*
    var j = new jsSHA(Crypto.util.bytesToHex(data), 'HEX');   
    var hash = j.getHMAC(Crypto.util.bytesToHex(this.chain_code), "HEX", "SHA-512", "HEX");
    var il = new BigInteger(hash.slice(0, 64), 16);
    var ir = Crypto.util.hexToBytes(hash.slice(64, 128));
    */
    var hmac = crypto.createHmac('sha512', this.chain_code);
    var hash = hmac.update(data).digest();
    var il = bignum.fromBufer(hash.slice(0, 64), {size: 32});
    var ir = hash.slice(64, 128);

    // ki = IL + kpar (mod n).
    //TODO: Fix this somehow
    var priv = bignum.fromBuffer(this.eckey.priv, {size: 32});
    var k = il.add(priv).mod(SECP256K1_N);

    ret = new BIP32();
    ret.chain_code = ir;

    ret.eckey = new bitcore.Key();
    ret.eckey.private = k.toBuffer({size: 32});
    ret.eckey.regenerateSync();
    ret.has_private_key = true;

  } else {
  /*
    var data = this.eckey.public.getEncoded(true).concat(ib);
    var data = Buffer.concat([this.eckey.public, new Buffer(ib]);
    var j = new jsSHA(Crypto.util.bytesToHex(data), 'HEX');   
    var hash = j.getHMAC(Crypto.util.bytesToHex(this.chain_code), "HEX", "SHA-512", "HEX");
    var il = new BigInteger(hash.slice(0, 64), 16);
    var ir = Crypto.util.hexToBytes(hash.slice(64, 128));
    */
    var data = Buffer.concat([this.eckey.public, ib]);
    var hash = coinUtil.sha512(this.chain_code); //TODO: replace with HMAC
    var il = bignum.fromBuffer(hash.slice(0, 64).toString('hex'), 16);
    var ir = hash.slice(64, 128);

    // Ki = (IL + kpar)*G = IL*G + Kpar
    //TODO: Fix this somehow
    var key = new bitcore.Key();
    key.private = il;
    key.regenerateSync();
    var k = key.public;
    //TODO: now add this.eckey.pub
    //var k = ecparams.getG().multiply(il).add(this.eckey.pub);

    ret = new BIP32();
    ret.chain_code  = new Buffer(ir);

    ret.eckey = new bitcore.key();
    ret.eckey.pub = k;
    ret.has_private_key = false;
  }

  ret.child_index = i;
  ret.parent_fingerprint = this.pubKeyHash.slice(0,4);
  ret.version = this.version;
  ret.depth = this.depth + 1;

  ret.eckey.setCompressed(true);
  ret.pubKeyHash = coinUtil.sha256ripe160(ret.eckey.pub.getEncoded(true));

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

/*
//This function is not actually necessary

function decompress_pubkey(key_bytes) {
  //TODO: Fix this whole function
  var y_bit = u8(key_bytes.slice(0, 1)) & 0x01;
  var ecparams = getSECCurveByName("secp256k1");

  // build X
  var x = BigInteger.ZERO.clone();
  x.fromString(Crypto.util.bytesToHex(key_bytes.slice(1, 33)), 16);
  
  // get curve
  var curve = ecparams.getCurve();
  var a = curve.getA().toBigInteger();
  var b = curve.getB().toBigInteger();
  var p = curve.getQ();
  
  // compute y^2 = x^3 + a*x + b
  var tmp = x.multiply(x).multiply(x).add(a.multiply(x)).add(b).mod(p);
  
  // compute modular square root of y (mod p)
  var y = tmp.modSqrt(p);
  
  // flip sign if we need to
  if ((y[0] & 0x01) != y_bit) {
    y = y.multiply(new BigInteger("-1")).mod(p);
  }
  
  return new ECPointFp(curve, curve.fromBigInteger(x), curve.fromBigInteger(y));
}
*/
