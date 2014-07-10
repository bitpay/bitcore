var coinUtil = require('../util');
var sjcl = require('./sjcl');
var SecureRandom = require('./SecureRandom');

var hmacSHA512 = function(key) {
  var hasher = new sjcl.misc.hmac(key, sjcl.hash.sha512);
  this.encrypt = function() {
    return hasher.encrypt.apply(hasher, arguments);
  };
};

var pbkdf2Sync_sha512 = function(password, salt, iterations, keylen) {
  var derivedKey = sjcl.misc.pbkdf2(password, salt, iterations, 512, hmacSHA512);
  return sjcl.codec.hex.fromBits(derivedKey)
};

var BIP39 = function() {};

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
  for (var i = 0; i < buf.length; i++) {
    bin = bin + ("00000000" + buf[i].toString(2)).slice(-8);
  }
  var hashbits = hash[0].toString(2);
  hashbits = ("00000000" + hashbits).slice(-8).slice(0, bits / 32);
  bin = bin + hashbits;
  if (bin.length % 11 != 0)
    throw new Error("internal error - entropy not an even multiple of 11 bits - " + bin.length);
  var mnemonic = "";
  for (var i = 0; i < bin.length / 11; i++) {
    if (mnemonic != "")
      mnemonic = mnemonic + " ";
    var wi = parseInt(bin.slice(i * 11, (i + 1) * 11), 2);
    mnemonic = mnemonic + wordlist[wi];
  }
  return mnemonic;
}

BIP39.check = function(wordlist, mnemonic) {
    var words = mnemonic.split(' ');
    var bin = "";
    for (var i = 0; i < words.length; i++) {
        var ind = wordlist.indexOf(words[i]);
        if (ind < 0)
            return false;
        bin = bin + ("00000000000" + ind.toString(2)).slice(-11);
    }

    if (bin.length % 11 != 0) {
        throw new Error("internal error - entropy not an even multiple of 11 bits - " + bin.length);
    }
    var cs = bin.length / 33;
    var hash_bits = bin.slice(-cs);
    var nonhash_bits = bin.slice(0, bin.length - cs);
    var buf = new Buffer(nonhash_bits.length / 8);
    for (var i = 0; i < nonhash_bits.length / 8; i++) {
        buf.writeUInt8(parseInt(bin.slice(i * 8, (i + 1) * 8), 2), i);
    }
    var hash = coinUtil.sha256(buf);
    var expected_hash_bits = hash[0].toString(2);
    expected_hash_bits = ("00000000" + expected_hash_bits).slice(-8).slice(0, cs);
    return expected_hash_bits == hash_bits;
}

BIP39.mnemonic2seed = function(mnemonic, passphrase) {
  if (!passphrase)
    passphrase = "";
  var hex = pbkdf2Sync_sha512(mnemonic, "mnemonic" + passphrase, 2048, 64);
  var buf = new Buffer(hex, 'hex');
  return buf;
}

module.exports = BIP39;
