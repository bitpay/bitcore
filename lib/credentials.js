'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var Mnemonic = require('bitcore-mnemonic');
var sjcl = require('sjcl');

var FIELDS = [
  'network',
  'xPrivKey',
  'xPrivKeyEncrypted',
  'xPubKey',
  'requestPrivKey',
  'requestPubKey',
  'copayerId',
  'publicKeyRing',
  'walletId',
  'walletName',
  'm',
  'n',
  'walletPrivKey',
  'personalEncryptingKey',
  'sharedEncryptingKey',
  'copayerName',
  'externalSource',
  'externalIndex',
  'mnemonic',
  'mnemonicEncrypted',
  'entropySource',
  'mnemonicHasPassphrase',
];

var EXPORTABLE_FIELDS = [
  'xPrivKey',
  'xPrivKeyEncrypted',
  'requestPrivKey',
  'xPubKey',
  'm',
  'n',
  'publicKeyRing',
  'sharedEncryptingKey',
  'externalSource',
  'externalIndex'
];

function Credentials() {
  this.version = '1.0.0';
};

Credentials.create = function(network) {
  var x = new Credentials();

  x.network = network;
  x.xPrivKey = (new Bitcore.HDPrivateKey(network)).toString();
  x._expand();
  return x;
};

var wordsForLang = {
  'en': Mnemonic.Words.ENGLISH,
  'es': Mnemonic.Words.SPANISH,
  'jp': Mnemonic.Words.JAPANESE,
  'zh': Mnemonic.Words.CHINESE,
  'fr': Mnemonic.Words.FRENCH,
};

Credentials.createWithMnemonic = function(network, passphrase, language) {
  if (!language)
    language = 'en';

  if (!wordsForLang[language])
    throw new Error('Unsupported language');

  var m = new Mnemonic(wordsForLang[language]);
  var x = new Credentials();

  x.network = network;
  x.xPrivKey = m.toHDPrivateKey(passphrase, network).toString();
  x._expand();
  x.mnemonic = m.phrase;
  x.mnemonicHasPassphrase = !!passphrase;

  return x;
};

Credentials.fromExtendedPrivateKey = function(xPrivKey) {
  var x = new Credentials();
  x.xPrivKey = xPrivKey;
  x._expand();
  return x;
};

// note that mnemonic / passphrase is NOT stored
Credentials.fromMnemonic = function(words, passphrase, network) {
  var m = new Mnemonic(words);
  var x = new Credentials();
  x.xPrivKey = m.toHDPrivateKey(passphrase, network).toString();
  x.mnemonicHasPassphrase = !!passphrase;
  x._expand();
  return x;
};

/* 
 * BWC uses
 * xPrivKey -> m/45' -> Base Address Key
 * so, xPubKey is PublicKeyHD(xPrivKey.derive("m/45'").
 *
 * For external sources, this derivation should be done before
 * call fromExternalWalletPublicKey
 *
 * entropySource should be a HEX string containing pseudorandom data, that can
 * be deterministic derived from the xPrivKey, and should not be derived from xPubKey
 *
 */
Credentials.fromExtendedPublicKey = function(xPubKey, source, index, entropySourceHex) {
  $.checkArgument(entropySourceHex);

  var entropyBuffer = new Buffer(entropySourceHex, 'hex');
  //require at least 112 bits of entropy
  $.checkArgument(entropyBuffer.length >= 14, 'At least 112 bits of entropy are needed')

  var x = new Credentials();
  x.xPubKey = xPubKey;
  x.entropySource = Bitcore.crypto.Hash.sha256sha256(entropyBuffer).toString('hex');

  x.externalSource = source;
  x.externalIndex = index;
  x._expand();
  return x;
};

Credentials.prototype._hashFromEntropy = function(prefix, length) {
  $.checkState(prefix);
  var b = new Buffer(this.entropySource, 'hex');
  var b2 = Bitcore.crypto.Hash.sha256hmac(b, new Buffer(prefix));
  return b2.slice(0, length);
};


Credentials.prototype._expand = function() {
  $.checkState(this.xPrivKey || (this.xPubKey && this.entropySource));

  if (this.xPrivKey) {
    var xPrivKey = new Bitcore.HDPrivateKey.fromString(this.xPrivKey);

    // this extra derivation is not to share a non hardened xPubKey to the server.
    var addressDerivation = xPrivKey.derive(WalletUtils.PATHS.BASE_ADDRESS_DERIVATION);
    this.xPubKey = (new Bitcore.HDPublicKey(addressDerivation)).toString();

    var requestDerivation = xPrivKey.derive(WalletUtils.PATHS.REQUEST_KEY);
    this.requestPrivKey = requestDerivation.privateKey.toString();

    var pubKey = requestDerivation.publicKey;
    this.requestPubKey = pubKey.toString();

    this.entropySource = Bitcore.crypto.Hash.sha256(requestDerivation.privateKey.toBuffer()).toString('hex');
  } else {
    var seed = this._hashFromEntropy('reqPrivKey', 32);
    var privKey = new Bitcore.PrivateKey(seed.toString('hex'), network);
    this.requestPrivKey = privKey.toString();
    this.requestPubKey = privKey.toPublicKey().toString();
  }

  this.personalEncryptingKey = this._hashFromEntropy('personalKey', 16).toString('base64');

  var network = WalletUtils.getNetworkFromXPubKey(this.xPubKey);
  if (this.network) {
    $.checkState(this.network == network);
  } else {
    this.network = network;
  }


  this.copayerId = WalletUtils.xPubToCopayerId(this.xPubKey);
  this.publicKeyRing = [{
    xPubKey: this.xPubKey,
    requestPubKey: this.requestPubKey,
  }];
};

Credentials.fromObj = function(obj) {
  var x = new Credentials();

  _.each(FIELDS, function(k) {
    x[k] = obj[k];
  });

  $.checkState(x.xPrivKey || x.xPubKey || x.xPrivKeyEncrypted, "invalid input");
  return x;
};

Credentials.prototype.toObj = function() {
  var self = this;

  var x = {};
  _.each(FIELDS, function(k) {
    x[k] = self[k];
  });
  return x;
};


Credentials.prototype.addWalletPrivateKey = function(walletPrivKey) {
  this.walletPrivKey = walletPrivKey;
  this.sharedEncryptingKey = WalletUtils.privateKeyToAESKey(walletPrivKey);
};

Credentials.prototype.addWalletInfo = function(walletId, walletName, m, n, walletPrivKey, copayerName) {
  this.walletId = walletId;
  this.walletName = walletName;
  this.m = m;
  this.n = n;

  if (walletPrivKey)
    this.addWalletPrivateKey(walletPrivKey);

  if (copayerName)
    this.copayerName = copayerName;

  if (n == 1) {
    this.addPublicKeyRing([{
      xPubKey: this.xPubKey,
      requestPubKey: this.requestPubKey,
    }]);
  }
};

Credentials.prototype.hasWalletInfo = function() {
  return !!this.walletId;
};

Credentials.prototype.isPrivKeyEncrypted = function() {
  return (!!this.xPrivKeyEncrypted) && !this.xPrivKey;
};

Credentials.prototype.hasPrivKeyEncrypted = function() {
  return (!!this.xPrivKeyEncrypted);
};

Credentials.prototype.setPrivateKeyEncryption = function(password, opts) {
  if (this.xPrivKeyEncrypted)
    throw new Error('Encrypted Privkey Already exists');

  if (!this.xPrivKey)
    throw new Error('No private key to encrypt');


  this.xPrivKeyEncrypted = sjcl.encrypt(password, this.xPrivKey, opts);
  if (!this.xPrivKeyEncrypted)
    throw new Error('Could not encrypt');

  if (this.mnemonic)
    this.mnemonicEncrypted = sjcl.encrypt(password, this.mnemonic, opts);
};


Credentials.prototype.disablePrivateKeyEncryption = function() {
  if (!this.xPrivKeyEncrypted)
    throw new Error('Private Key is not encrypted');

  if (!this.xPrivKey)
    throw new Error('Wallet is locked, cannot disable encryption');

  this.xPrivKeyEncrypted = null;
  this.mnemonicEncrypted = null;
};


Credentials.prototype.lock = function() {
  if (!this.xPrivKeyEncrypted)
    throw new Error('Could not lock, no encrypted private key');

  delete this.xPrivKey;
  delete this.mnemonic;
};

Credentials.prototype.unlock = function(password) {
  if (this.xPrivKeyEncrypted) {
    this.xPrivKey = sjcl.decrypt(password, this.xPrivKeyEncrypted);
    if (this.mnemonicEncrypted) {
      this.mnemonic = sjcl.decrypt(password, this.mnemonicEncrypted);
    }
  }
};

Credentials.prototype.addPublicKeyRing = function(publicKeyRing) {
  this.publicKeyRing = _.clone(publicKeyRing);
};

Credentials.prototype.canSign = function() {
  return (!!this.xPrivKey || !!this.xPrivKeyEncrypted);
};

Credentials.prototype.setNoSign = function() {
  delete this.xPrivKey;
  delete this.xPrivKeyEncrypted;
  delete this.mnemonic;
  delete this.mnemonicEncrypted;
};

Credentials.prototype.isComplete = function() {
  if (!this.m || !this.n) return false;
  if (!this.publicKeyRing || this.publicKeyRing.length != this.n) return false;
  return true;
};

Credentials.prototype.hasExternalSource = function() {
  return (typeof this.externalSource == "string");
};

Credentials.prototype.getExternalSourceName = function() {
  return this.externalSource;
};

Credentials.prototype.getExternalIndex = function() {
  return this.externalIndex;
};


Credentials.prototype.getMnemonic = function() {
  if (this.mnemonicEncrypted && !this.mnemonic) {
    throw new Error('Credentials are encrypted');
  }

  return this.mnemonic;
};


Credentials.prototype.clearMnemonic = function() {
  delete this.mnemonic;
  delete this.mnemonicEncrypted;
};

Credentials.prototype.exportCompressed = function() {
  var self = this;
  var values = _.map(EXPORTABLE_FIELDS, function(field) {
    if ((field == 'xPubKey' || field == 'requestPrivKey') && self.canSign()) return '';
    if (field == 'requestPrivKey') {
      return Bitcore.PrivateKey.fromString(self.requestPrivKey).toWIF();
    }
    if (field == 'publicKeyRing') {
      return _.reject(self.publicKeyRing, {
        xPubKey: self.xPubKey
      });
    }
    return self[field];
  });
  values.unshift(self.version);

  return JSON.stringify(values);
};

Credentials.importCompressed = function(compressed, password) {
  var list;
  try {
    list = JSON.parse(compressed);
  } catch (ex) {
    throw new Error('Invalid compressed format');
  }

  var x = new Credentials();

  // Remove version
  var version = list[0];
  list = _.rest(list);

  _.each(EXPORTABLE_FIELDS, function(field, i) {
    x[field] = list[i];
  });

  if (password)
    x.unlock(password);
  x._expand();
  if (password)
    x.lock(password);

  x.network = WalletUtils.getNetworkFromXPubKey(x.xPubKey);
  x.publicKeyRing.push({
    xPubKey: x.xPubKey,
    requestPubKey: x.requestPubKey,
  });
  return x;
};

Credentials.fromOldCopayWallet = function(w) {
  var credentials = Credentials.fromExtendedPrivateKey(w.privateKey.extendedPrivateKeyString);

  var pkr = _.map(w.publicKeyRing.copayersExtPubKeys, function(xPubStr) {

    var isMe = xPubStr === credentials.xPubKey;
    var requestDerivation;

    if (isMe) {
      var path = WalletUtils.PATHS.REQUEST_KEY;
      requestDerivation = (new Bitcore.HDPrivateKey(credentials.xPrivKey))
        .derive(path).hdPublicKey;
    } else {
      // this 
      var path = WalletUtils.PATHS.REQUEST_KEY_AUTH;
      requestDerivation = (new Bitcore.HDPublicKey(xPubStr)).derive(path);
    }

    // Grab Copayer Name
    var hd = new Bitcore.HDPublicKey(xPubStr).derive('m/2147483646/0/0');
    var pubKey = hd.publicKey.toString('hex');
    var copayerName = w.publicKeyRing.nicknameFor[pubKey];
    if (isMe) {
      credentials.copayerName = copayerName;
    }

    return {
      xPubKey: xPubStr,
      requestPubKey: requestDerivation.publicKey.toString(),
      copayerName: copayerName,
    };
  });
  credentials.addPublicKeyRing(pkr);
  return credentials;
};

module.exports = Credentials;
