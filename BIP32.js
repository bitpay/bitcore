var EncodedData = require('./util/EncodedData');
var base58 = imports.base58 || require('base58-native').base58Check;

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

var BIP32 = function(bytes) {
  // decode base58
  if (typeof bytes === "string") {
    var decoded = base58.decode(bytes);
    if (decoded.length != 82)
      throw new Error("Not enough data");
    var checksum = decoded.slice(78, 82);
    bytes = decoded.slice(0, 78);

    var hash = Crypto.SHA256(Crypto.SHA256(bytes, {asBytes: true}), {asBytes: true});

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
    this.eckey = new Bitcoin.ECKey(key_bytes.slice(1, 33));
    this.eckey.setCompressed(true);

    var ecparams = getSECCurveByName("secp256k1");
    var pt = ecparams.getG().multiply(this.eckey.priv);
    this.eckey.pub = pt;
    this.eckey.pubKeyHash = Bitcoin.Util.sha256ripe160(this.eckey.pub.getEncoded(true));
    this.has_private_key = true;
  } else if (is_public && (key_bytes[0] == 0x02 || key_bytes[0] == 0x03)) {
    this.eckey = new Bitcoin.ECKey();
    this.eckey.pub = decompress_pubkey(key_bytes);
    this.eckey.pubKeyHash = Bitcoin.Util.sha256ripe160(this.eckey.pub.getEncoded(true));
    this.eckey.setCompressed(true);
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
  this.extended_public_key.push(v >> 24);
  this.extended_public_key.push((v >> 16) & 0xff);
  this.extended_public_key.push((v >> 8) & 0xff);
  this.extended_public_key.push(v & 0xff);

  // Depth
  this.extended_public_key.push(this.depth);

  // Parent fingerprint
  this.extended_public_key = this.extended_public_key.concat(this.parent_fingerprint);

  // Child index
  this.extended_public_key.push(this.child_index >>> 24);
  this.extended_public_key.push((this.child_index >>> 16) & 0xff);
  this.extended_public_key.push((this.child_index >>> 8) & 0xff);
  this.extended_public_key.push(this.child_index & 0xff);

  // Chain code
  this.extended_public_key = this.extended_public_key.concat(this.chain_code);

  // Public key
  this.extended_public_key = this.extended_public_key.concat(this.eckey.pub.getEncoded(true));
}

BIP32.prototype.extended_public_key_string = function(format) {
  if (format === undefined || format === "base58") {
    var hash = Crypto.SHA256(Crypto.SHA256(this.extended_public_key, {asBytes: true} ), {asBytes: true});
    var checksum = hash.slice(0, 4);
    var data = this.extended_public_key.concat(checksum);
    return Bitcoin.Base58.encode(data);
  } else if (format === "hex") {
    return Crypto.util.bytesToHex(this.extended_public_key);
  } else {
    throw new Error("bad format");
  }
}

BIP32.prototype.build_extended_private_key = function() {
  if (!this.has_private_key) return;
  this.extended_private_key = [];

  var v = this.version;

  // Version
  this.extended_private_key.push(v >> 24);
  this.extended_private_key.push((v >> 16) & 0xff);
  this.extended_private_key.push((v >> 8) & 0xff);
  this.extended_private_key.push(v & 0xff);

  // Depth
  this.extended_private_key.push(this.depth);

  // Parent fingerprint
  this.extended_private_key = this.extended_private_key.concat(this.parent_fingerprint);

  // Child index
  this.extended_private_key.push(this.child_index >>> 24);
  this.extended_private_key.push((this.child_index >>> 16) & 0xff);
  this.extended_private_key.push((this.child_index >>> 8) & 0xff);
  this.extended_private_key.push(this.child_index & 0xff);

  // Chain code
  this.extended_private_key = this.extended_private_key.concat(this.chain_code);

  // Private key
  this.extended_private_key.push(0);
  this.extended_private_key = this.extended_private_key.concat(this.eckey.priv.toByteArrayUnsigned());
}

BIP32.prototype.extended_private_key_string = function(format) {
  if (format === undefined || format === "base58") {
    var hash = Crypto.SHA256(Crypto.SHA256(this.extended_private_key, {asBytes: true}), {asBytes: true});
    var checksum = hash.slice(0, 4);
    var data = this.extended_private_key.concat(checksum);
    return Bitcoin.Base58.encode(data);
  } else if( format === "hex" ) {
    return Crypto.util.bytesToHex(this.extended_private_key);
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

    if( use_private )
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

  var use_private = (i & 0x80000000) != 0;
  var ecparams = getSECCurveByName("secp256k1");

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
      data = [0].concat(this.eckey.priv.toByteArrayUnsigned()).concat(ib);
    } else {
      data = this.eckey.pub.getEncoded(true).concat(ib);
    }

    var j = new jsSHA(Crypto.util.bytesToHex(data), 'HEX');   
    var hash = j.getHMAC(Crypto.util.bytesToHex(this.chain_code), "HEX", "SHA-512", "HEX");
    var il = new BigInteger(hash.slice(0, 64), 16);
    var ir = Crypto.util.hexToBytes(hash.slice(64, 128));

    // ki = IL + kpar (mod n).
    var curve = ecparams.getCurve();
    var k = il.add(this.eckey.priv).mod(ecparams.getN());

    ret = new BIP32();
    ret.chain_code  = ir;

    ret.eckey = new Bitcoin.ECKey(k.toByteArrayUnsigned());
    ret.eckey.pub = ret.eckey.getPubPoint();
    ret.has_private_key = true;

  } else {
    var data = this.eckey.pub.getEncoded(true).concat(ib);
    var j = new jsSHA(Crypto.util.bytesToHex(data), 'HEX');   
    var hash = j.getHMAC(Crypto.util.bytesToHex(this.chain_code), "HEX", "SHA-512", "HEX");
    var il = new BigInteger(hash.slice(0, 64), 16);
    var ir = Crypto.util.hexToBytes(hash.slice(64, 128));

    // Ki = (IL + kpar)*G = IL*G + Kpar
    var k = ecparams.getG().multiply(il).add(this.eckey.pub);

    ret = new BIP32();
    ret.chain_code  = ir;

    ret.eckey = new Bitcoin.ECKey();
    ret.eckey.pub = k;
    ret.has_private_key = false;
  }

  ret.child_index = i;
  ret.parent_fingerprint = this.eckey.pubKeyHash.slice(0,4);
  ret.version = this.version;
  ret.depth   = this.depth + 1;

  ret.eckey.setCompressed(true);
  ret.eckey.pubKeyHash = Bitcoin.Util.sha256ripe160(ret.eckey.pub.getEncoded(true));

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

function decompress_pubkey(key_bytes) {
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
