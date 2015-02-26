'use strict';

var bitcore = require('bitcore');
var _ = bitcore.deps._;

var pbkdf2 = require('./pbkdf2');
var errors = require('./errors');

var Hash = bitcore.crypto.Hash;
var Random = bitcore.crypto.Random;

/**
 * This is an immutable class that represents a BIP39 Mnemonic code.
 * See BIP39 specification for more info: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
 * A Mnemonic code is a a group of easy to remember words used for the generation
 * of deterministic wallets. A Mnemonic can be used to generate a seed using 
 * an optional passphrase, for later generate a HDPrivateKey.
 * 
 * @example
 * // generate a random mnemonic
 * var mnemonic = new Mnemonic();
 * var phrase = mnemonic.phrase;
 *
 * // use a different language
 * var mnemonic = new Mnemonic(Mnemonic.Words.SPANISH);
 * var xprivkey = mnemonic.toHDPrivateKey();
 *
 * @param {*} data - The encoded data in various formats
 * @param {Network|String|number} [network] - The network: 'livenet' or 'testnet'
 * @param {String} [type] - The type of address: 'script' or 'pubkey'
 * @returns {Address} A new valid and frozen instance of an Address
 * @constructor
 */
var Mnemonic = function(data, wordlist) {
  if (!(this instanceof Mnemonic)) {
    return new Mnemonic(data, wordlist);
  }

  if (_.isArray(data)) {
    wordlist = data;
    data = null;
  }

  // handle data overloading
  var ent, phrase;
  if (_.isString(data)) {
    phrase = data;
  } else if (_.isNumber(data)) {
    ent = data;
  } else if (data) {
    throw new bitcore.errors.InvalidArgument('data', 'Must be an string or an integer');
  }
  ent = ent || 128;

  // check and detect wordlist
  wordlist = wordlist || Mnemonic._getDictionary(phrase);
  if (phrase && !wordlist) {
    throw new errors.UnknownWordlist(phrase);
  }
  wordlist = wordlist || Mnemonic.Words.ENGLISH;

  // validate phrase and ent
  if (phrase && !Mnemonic.isValid(phrase, wordlist)) {
    throw new errors.InvalidMnemonic(phrase);
  }
  if (ent % 32 !== 0 || ent < 128) {
    throw new bitcore.errors.InvalidArgument('ENT', 'Values must be ENT > 128 and ENT % 32 == 0');
  }

  phrase = phrase || Mnemonic._mnemonic(ent, wordlist);

  Object.defineProperty(this, 'wordlist', {
    configurable: false,
    value: wordlist
  });

  Object.defineProperty(this, 'phrase', {
    configurable: false,
    value: phrase
  });
};

Mnemonic.Words = require('./words');

/**
 * Will return a boolean if the mnemonic is valid
 *
 * @example
 *
 * var valid = Mnemonic.isValid('lab rescue lunch elbow recall phrase perfect donkey biology guess moment husband');
 * // true
 *
 * @param {String} mnemonic - The mnemonic string
 * @param {String} [wordlist] - The wordlist used
 * @returns {boolean}
 */
Mnemonic.isValid = function(mnemonic, wordlist) {
  wordlist = wordlist || Mnemonic._getDictionary(mnemonic);
  
  if (!wordlist) {
    return false;
  };

  var words = mnemonic.split(' ');
  var bin = "";
  for (var i = 0; i < words.length; i++) {
      var ind = wordlist.indexOf(words[i]);
      if (ind < 0) return false;
      bin = bin + ("00000000000" + ind.toString(2)).slice(-11);
  }

  var cs = bin.length / 33;
  var hash_bits = bin.slice(-cs);
  var nonhash_bits = bin.slice(0, bin.length - cs);
  var buf = new Buffer(nonhash_bits.length / 8);
  for (var i = 0; i < nonhash_bits.length / 8; i++) {
    buf.writeUInt8(parseInt(bin.slice(i * 8, (i + 1) * 8), 2), i);
  }
  var expected_hash_bits = Mnemonic._entropyChecksum(buf);
  return expected_hash_bits === hash_bits;
};

/**
 * Internal function to check if a mnemonic belongs to a wordlist.
 *
 * @param {String} mnemonic - The mnemonic string
 * @param {String} wordlist - The wordlist
 * @returns {boolean}
 */
Mnemonic._belongsToWordlist = function(mnemonic, wordlist) {
  var word = mnemonic.split(' ')[0];
  return wordlist.indexOf(word) !== -1; // only checks for a word
};

/**
 * Internal function to detect the wordlist used to generate the mnemonic.
 *
 * @param {String} mnemonic - The mnemonic string
 * @returns {Array} the wordlist or null
 */
Mnemonic._getDictionary = function(mnemonic) {
  if (!mnemonic) return null;

  var dicts = Object.keys(Mnemonic.Words);
  for (var i = 0; i < dicts.length; i++) {
    var key = dicts[i];
    if (Mnemonic._belongsToWordlist(mnemonic, Mnemonic.Words[key])) {
      return Mnemonic.Words[key];    
    }
  }
  return null;
};

/**
 * Will generated a seed based on the mnemonic and and and optional passphrase.
 *
 * @param {String} [passphrase]
 * @returns {Buffer}
 */
Mnemonic.prototype.toSeed = function(passphrase) {
  passphrase = passphrase || "";
  return pbkdf2(this.phrase, "mnemonic" + passphrase, 2048, 64);
};

/**
 * Will generated a seed based on the mnemonic and and and optional passphrase.
 *
 * @param {String} [passphrase]
 * @returns {Buffer}
 */
Mnemonic.prototype.toHDPrivateKey = function(passphrase, network) {
  var seed = this.toSeed(passphrase);
  return bitcore.HDPrivateKey.fromSeed(seed, network);
};

/**
 * Will return a the string representation of the mnemonic
 *
 * @returns {String} Mnemonic
 */
Mnemonic.prototype.toString = function() {
  return this.phrase;
};

/**
 * Will return a string formatted for the console
 *
 * @returns {String} Mnemonic
 */
Mnemonic.prototype.inspect = function() {
  return '<Mnemonic: ' + this.toString() + ' >';
};

/**
 * Internal function to generate a random mnemonic
 *
 * @param {Number} ENT - Entropy size, defaults to 128
 * @param {Array} wordlist - Array of words to generate the mnemonic
 * @returns {String} Mnemonic string
 */
Mnemonic._mnemonic = function(ENT, wordlist) {
  var buf = Random.getRandomBuffer(ENT / 8);
  return Mnemonic._entropy2mnemonic(buf, wordlist);
};

/**
 * Internal function to generate mnemonic based on entropy
 *
 * @param {Number} entropy - Entropy buffer
 * @param {Array} wordlist - Array of words to generate the mnemonic
 * @returns {String} Mnemonic string
 */
Mnemonic._entropy2mnemonic = function(entropy, wordlist) {
  var bin = "";
  for (var i = 0; i < entropy.length; i++) {
    bin = bin + ("00000000" + entropy[i].toString(2)).slice(-8);
  }

  bin = bin + Mnemonic._entropyChecksum(entropy);
  if (bin.length % 11 != 0) {
    throw new errors.InvalidEntropy(bin);
  }
  var mnemonic = [];
  for (var i = 0; i < bin.length / 11; i++) {
    var wi = parseInt(bin.slice(i * 11, (i + 1) * 11), 2);
    mnemonic.push(wordlist[wi]);
  }
  return mnemonic.join(" ");
};

/**
 * Internal function to create checksum of entropy
 *
 * @param entropy
 * @returns {string} Checksum of entropy length / 32
 * @private
 */
Mnemonic._entropyChecksum = function(entropy) {
  var hash = Hash.sha256(entropy);
  var bits = entropy.length * 8;
  var cs = bits / 32;

  var hashbits = parseInt(hash.toString('hex'), 16).toString(2);
  // zero pad the hash bits
  hashbits = (new Array(256).join("0") + hashbits).slice(-256).slice(0, cs);

  return hashbits;
};

module.exports = Mnemonic;
