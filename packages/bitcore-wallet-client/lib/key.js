'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');

var Bitcore = require('bitcore-lib');
var Mnemonic = require('bitcore-mnemonic');
var sjcl = require('sjcl');

var Common = require('./common');
var Constants = Common.Constants;
var Utils = Common.Utils;

var FIELDS = [
  'xPrivKey',             // obsolte
  'xPrivKeyEncrypted',   // obsolte
  'mnemonic',
  'mnemonicEncrypted',
  'mnemonicHasPassphrase',

  // data for derived credentials.
  'use145forBCH',          // use the appropiate coin' path element in BIP44 for BCH 
  'version',
];

function Key() {
  this.version = '1.0.0';
  this.use145forBCH = true;
  this.compliantDerivation = true;
};

const wordsForLang = {
  'en': Mnemonic.Words.ENGLISH,
  'es': Mnemonic.Words.SPANISH,
  'ja': Mnemonic.Words.JAPANESE,
  'zh': Mnemonic.Words.CHINESE,
  'fr': Mnemonic.Words.FRENCH,
  'it': Mnemonic.Words.ITALIAN,
};

// we always set 'livenet' for xprivs. it has not consecuences
// other than the serialization
const NETWORK = 'livenet';

Key.create = function(passphrase, language,  opts) {
  language = language || 'en';

  if (!wordsForLang[language]) throw new Error('Unsupported language');
  opts = opts || {};

  var m = new Mnemonic(wordsForLang[language]);
  while (!Mnemonic.isValid(m.toString())) {
    m = new Mnemonic(wordsForLang[language])
  };
  var x = new Key();
  x.xPrivKey = m.toHDPrivateKey(passphrase, NETWORK).toString();
  x.mnemonic = m.phrase;
  x.mnemonicHasPassphrase = !!passphrase;

  // bug backwards compatibility flags
  x.use145forBCH = !opts.use0forBCH;
  x.compliantDerivation = !opts.nonCompliantDerivation;

  return x;
};

Key.fromMnemonic = function(words, passphrase, opts) {
  $.checkArgument(words);
  opts = opts || {};

  var m = new Mnemonic(words);
  var x = new Key();
  x.xPrivKey = m.toHDPrivateKey(passphrase, NETWORK).toString();
  x.mnemonic = words;
  x.mnemonicHasPassphrase = !!passphrase;

  x.use145forBCH = !opts.use0forBCH;
  x.compliantDerivation = !opts.nonCompliantDerivation;

  return x;
};

Key.fromExtendedPrivateKey = function(xPriv, opts) {
  $.checkArgument(xPriv);
  opts = opts || {};

  try {
    new Bitcore.HDPrivateKey(xPriv);
  } catch (e) {
    throw 'Invalid argument';
  }

  var x = new Key();
  x.xPrivKey = xPriv;
  x.mnemonic = null;
  x.mnemonicHasPassphrase = null;

  x.use145forBCH = !opts.use0forBCH;
  x.compliantDerivation = !opts.nonCompliantDerivation;

  return x;
};



Key.fromObj = function(obj) {

  var x = new Key();
  if (obj.version != x.version) {
    throw 'Bad Credentials version';
  }

  _.each(FIELDS, function(k) {
    x[k] = obj[k];
  });

  $.checkState(x.xPrivKey || x.xPrivKeyEncrypted, "invalid input");
  return x;
};

Key.prototype.toObj = function() {
  var self = this;

  var x = {};
  _.each(FIELDS, function(k) {
    x[k] = self[k];
  });
  return x;
};

Key.prototype.isPrivKeyEncrypted = function() {
  return (!!this.xPrivKeyEncrypted) && !this.xPrivKey;
};

Key.prototype.get = function(password, getMnemonic) {
  var keys = {};

  if (this.isPrivKeyEncrypted()) {
    $.checkArgument(password, 'Private keys are encrypted, a password is needed');
    try {
      keys.xPrivKey = sjcl.decrypt(password, this.xPrivKeyEncrypted);

      if (getMnemonic && this.mnemonicEncrypted) {
        keys.mnemonic = sjcl.decrypt(password, this.mnemonicEncrypted);
      }
    } catch (ex) {
      throw new Error('Could not decrypt');
    }
  } else {
    keys.xPrivKey = this.xPrivKey;

    if (getMnemonic) 
      keys.mnemonic = this.mnemonic;
  }
  return keys;
};

Key.prototype.encrypt = function(password, opts) {
  if (this.xPrivKeyEncrypted)
    throw new Error('Private key already encrypted');

  if (!this.xPrivKey)
    throw new Error('No private key to encrypt');

  this.xPrivKeyEncrypted = sjcl.encrypt(password, this.xPrivKey, opts);
  if (!this.xPrivKeyEncrypted)
    throw new Error('Could not encrypt');

  if (this.mnemonic)
    this.mnemonicEncrypted = sjcl.encrypt(password, this.mnemonic, opts);

  delete this.xPrivKey;
  delete this.mnemonic;
};

Key.prototype.decrypt = function(password) {
  if (!this.xPrivKeyEncrypted)
    throw new Error('Private key is not encrypted');

  try {
    this.xPrivKey = sjcl.decrypt(password, this.xPrivKeyEncrypted);

    if (this.mnemonicEncrypted) {
      this.mnemonic = sjcl.decrypt(password, this.mnemonicEncrypted);
    }
    delete this.xPrivKeyEncrypted;
    delete this.mnemonicEncrypted;
  } catch (ex) {
    throw new Error('Could not decrypt');
  }
};


Key.prototype.derive = function(password, path) {
  $.checkArgument(path, 'no path');

  var xPrivKey = new Bitcore.HDPrivateKey(this.get(password).xPrivKey, NETWORK);
  var deriveFn = !!this.compliantDerivation ? _.bind(xPrivKey.deriveChild, xPrivKey) : _.bind(xPrivKey.deriveNonCompliantChild, xPrivKey);
  return deriveFn(path);
};



module.exports = Key;
