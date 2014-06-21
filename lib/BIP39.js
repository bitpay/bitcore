var imports = require('soop').imports();
var coinUtil = imports.coinUtil || require('../util');
var sjcl = imports.sjcl || require('./sjcl');
var SecureRandom = require('./SecureRandom');

var hmacSHA512 = function (key) {
  var hasher = new sjcl.misc.hmac(key, sjcl.hash.sha512);
  this.encrypt = function () {
      return hasher.encrypt.apply(hasher, arguments);
  };
};

var pbkdf2Sync_sha512 = function(password, salt, iterations, keylen) {
  var derivedKey = sjcl.misc.pbkdf2(password, salt, iterations, 512, hmacSHA512);
  return sjcl.codec.hex.fromBits(derivedKey)
};

var BIP39 = function() {
};

BIP39.mnemonic = function(wordlist, bits) {
  if (!bits)
    bits = 128;
  if (bits % 32 != 0)
    throw new Error("bits must be multiple of 32");
  var buf = SecureRandom.getRandomBuffer(bits / 8);
  return BIP39.entropy2mnemonic(wordlist, buf);
}

BIP39.entropy2mnemonic = function(wordlist, buf) {
  var hash = coinUtil.sha256(buf);
  var bin = "";
  var bits = buf.length * 8;
  for (var i = 0 ; i < buf.length ; i++) {
    bin = bin + ("00000000" + buf[i].toString(2)).slice(-8);
  }
  var hashbits = hash[0].toString(2);
  hashbits = ("00000000" + hashbits).slice(-8).slice(0, bits/32);
  bin = bin + hashbits;
  if (bin.length % 11 != 0)
    throw new Error("internal error - entropy not an even multiple of 11 bits - " + bin.length);
  var mnemonic = "";
  for (var i = 0; i < bin.length / 11; i++) {
    if (mnemonic != "")
      mnemonic = mnemonic + " ";
    var wi = parseInt(bin.slice(i*11, (i+1)*11), 2);
    mnemonic = mnemonic + wordlist[wi];
  }
  return mnemonic;
}

BIP39.mnemonic2seed = function(mnemonic, passphrase) {
  if (!passphrase)
    passphrase = "";
  var hex = pbkdf2Sync_sha512(mnemonic, "mnemonic" + passphrase, 2048, 64);
  var buf = new Buffer(hex, 'hex');
  return buf;
}

module.exports = require('soop')(BIP39);
