var imports = require('soop').imports();
var coinUtil = imports.coinUtil || require('../util');
var cryptox = imports.cryptox || require('./cryptox');
var crypto = require('crypto');
var BIP39 = {};

BIP39.mnemonic = function(wordlist, bits) {
  if (!bits)
    bits = 128;
  if (bits % 32 != 0)
    throw new Error("bits must be multiple of 32");
  var bytes = crypto.randomBytes(bits / 8);
  return BIP39.to_mnemonic(wordlist, bytes);
}

BIP39.to_mnemonic = function(wordlist, bytes) {
  var hash = coinUtil.sha256(new Buffer(bytes));
  var bin = "";
  var bits = bytes.length * 8;
  for (var i = 0 ; i < bytes.length ; i++) {
    bin = bin + ("00000000" + bytes[i].toString(2)).slice(-8);
  }
  var hashbits = hash[0].toString(2);
  hashbits = ("00000000" + hashbits).slice(-8).slice(0, bits/32);
  bin = bin + hashbits;
  if (bin.length % 11 != 0)
    throw new Error("interal error - entropy not an even multiple of 11 bits - " + bin.length);
  var mnemonic = "";
  for (var i = 0 ; i < bin.length / 11 ; i++) {
    if (mnemonic != "")
      mnemonic = mnemonic + " ";
    var wi = parseInt(bin.slice(i*11, (i+1)*11), 2);
    mnemonic = mnemonic + wordlist[wi];
  }
  return mnemonic;
}

BIP39.mnemonic_to_seed = function(mnemonic, passphrase) {
  return cryptox.pbkdf2Sync_sha512(mnemonic, "mnemonic" + passphrase, 2048, 64);
}

module.exports = require('soop')(BIP39);
