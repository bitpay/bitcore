'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');

var Common = require('./common');
var Constants = Common.Constants;
var Utils = Common.Utils;

var Bitcore = require('bitcore-lib');
var crypto = Bitcore.crypto;
var encoding = Bitcore.encoding;
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
  'mnemonic',
  'mnemonicEncrypted',
  'entropySource',
  'mnemonicHasPassphrase',
  'derivationStrategy',
  'account',
  'addressType',
];

function Credentials() {
  this.version = '1.0.0';
  this.derivationStrategy = Constants.DERIVATION_STRATEGIES.BIP44;
  this.account = 0;
};

function _checkNetwork(network) {
  if (!_.contains(['livenet', 'testnet'], network)) throw new Error('Invalid network');
};

Credentials.create = function(network) {
  _checkNetwork(network);

  var x = new Credentials();

  x.network = network;
  x.xPrivKey = (new Bitcore.HDPrivateKey(network)).toString();
  x._expand();
  return x;
};

var wordsForLang = {
  'en': Mnemonic.Words.ENGLISH,
  'es': Mnemonic.Words.SPANISH,
  'ja': Mnemonic.Words.JAPANESE,
  'zh': Mnemonic.Words.CHINESE,
  'fr': Mnemonic.Words.FRENCH,
};

Credentials.createWithMnemonic = function(network, passphrase, language, account) {
  _checkNetwork(network);
  if (!wordsForLang[language]) throw new Error('Unsupported language');
  $.shouldBeNumber(account);

  var m = new Mnemonic(wordsForLang[language]);
  while (!Mnemonic.isValid(m.toString())) {
    m = new Mnemonic(wordsForLang[language])
  };
  var x = new Credentials();

  x.network = network;
  x.account = account;
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
Credentials.fromMnemonic = function(network, words, passphrase, account) {
  _checkNetwork(network);
  $.shouldBeNumber(account);

  var m = new Mnemonic(words);
  var x = new Credentials();
  x.xPrivKey = m.toHDPrivateKey(passphrase, network).toString();
  x.mnemonicHasPassphrase = !!passphrase;
  x.account = account;
  x._expand();
  return x;
};

/* 
 * BWC uses
 * xPrivKey -> m/44'/network'/account' -> Base Address Key
 * so, xPubKey is PublicKeyHD(xPrivKey.derive("m/44'/network'/account'").
 *
 * For external sources, this derivation should be done before
 * call fromExtendedPublicKey
 *
 * entropySource should be a HEX string containing pseudo-random data, that can
 * be deterministically derived from the xPrivKey, and should not be derived from xPubKey
 */
Credentials.fromExtendedPublicKey = function(xPubKey, source, entropySourceHex, account) {
  $.checkArgument(entropySourceHex);
  $.shouldBeNumber(account);

  var entropyBuffer = new Buffer(entropySourceHex, 'hex');
  //require at least 112 bits of entropy
  $.checkArgument(entropyBuffer.length >= 14, 'At least 112 bits of entropy are needed')

  var x = new Credentials();
  x.xPubKey = xPubKey;
  x.entropySource = Bitcore.crypto.Hash.sha256sha256(entropyBuffer).toString('hex');
  x.account = account;
  x.externalSource = source;
  x._expand();
  return x;
};

// Get network from extended private key or extended public key
Credentials._getNetworkFromExtendedKey = function(xKey) {
  $.checkArgument(xKey && _.isString(xKey));
  return xKey.charAt(0) == 't' ? 'testnet' : 'livenet';
};

Credentials._xPubToCopayerId = function(xpub) {
  var hash = sjcl.hash.sha256.hash(xpub);
  return sjcl.codec.hex.fromBits(hash);
};

Credentials.prototype._hashFromEntropy = function(prefix, length) {
  $.checkState(prefix);
  var b = new Buffer(this.entropySource, 'hex');
  var b2 = Bitcore.crypto.Hash.sha256hmac(b, new Buffer(prefix));
  return b2.slice(0, length);
};


Credentials.prototype._expand = function() {
  $.checkState(this.xPrivKey || (this.xPubKey && this.entropySource));

  var network = Credentials._getNetworkFromExtendedKey(this.xPrivKey || this.xPubKey);
  if (this.network) {
    $.checkState(this.network == network);
  } else {
    this.network = network;
  }

  if (this.xPrivKey) {
    var xPrivKey = new Bitcore.HDPrivateKey.fromString(this.xPrivKey);

    // this extra derivation is not to share a non hardened xPubKey to the server.
    var addressDerivation = xPrivKey.derive(this.getBaseAddressDerivationPath());
    this.xPubKey = (new Bitcore.HDPublicKey(addressDerivation)).toString();

    var requestDerivation = xPrivKey.derive(Constants.PATHS.REQUEST_KEY);
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


  this.copayerId = Credentials._xPubToCopayerId(this.xPubKey);
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

  x.derivationStrategy = x.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
  x.addressType = x.addressType || Constants.SCRIPT_TYPES.P2SH;
  x.account = x.account || 0;

  $.checkState(x.xPrivKey || x.xPubKey || x.xPrivKeyEncrypted, "invalid input");
  return x;
};

Credentials.prototype.toObj = function() {
  var self = this;

  if (self.hasPrivKeyEncrypted())
    self.lock();

  var x = {};
  _.each(FIELDS, function(k) {
    x[k] = self[k];
  });
  return x;
};

Credentials.prototype.getBaseAddressDerivationPath = function() {
  if (this.derivationStrategy == Constants.DERIVATION_STRATEGIES.BIP45) return "m/45'";
  return "m/44'/" + (this.network == 'livenet' ? "0'" : "1'") + "/" + this.account + "'";
};

Credentials.prototype.getDerivedXPrivKey = function() {
  var path = this.getBaseAddressDerivationPath();
  return new Bitcore.HDPrivateKey(this.xPrivKey, this.network).derive(path);
};

Credentials.prototype.addWalletPrivateKey = function(walletPrivKey) {
  this.walletPrivKey = walletPrivKey;
  this.sharedEncryptingKey = Utils.privateKeyToAESKey(walletPrivKey);
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

  this.addressType = (n == 1) ? Constants.SCRIPT_TYPES.P2PKH : Constants.SCRIPT_TYPES.P2SH;

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
  $.checkArgument(password);

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

Credentials.fromOldCopayWallet = function(w) {
  function walletPrivKeyFromOldCopayWallet(w) {
    // IN BWS, the master Pub Keys are not sent to the server, 
    // so it is safe to use them as seed for wallet's shared secret.
    var seed = w.publicKeyRing.copayersExtPubKeys.sort().join('');
    var seedBuf = new Buffer(seed);
    var privKey = new Bitcore.PrivateKey.fromBuffer(Bitcore.crypto.Hash.sha256(seedBuf));
    return privKey.toString();
  };

  var credentials = new Credentials();
  credentials.derivationStrategy = Constants.DERIVATION_STRATEGIES.BIP45;
  credentials.xPrivKey = w.privateKey.extendedPrivateKeyString;
  credentials._expand();

  credentials.addWalletInfo(w.opts.id, w.opts.name, w.opts.requiredCopayers, w.opts.totalCopayers, walletPrivKeyFromOldCopayWallet(w))

  var pkr = _.map(w.publicKeyRing.copayersExtPubKeys, function(xPubStr) {

    var isMe = xPubStr === credentials.xPubKey;
    var requestDerivation;

    if (isMe) {
      var path = Constants.PATHS.REQUEST_KEY;
      requestDerivation = (new Bitcore.HDPrivateKey(credentials.xPrivKey))
        .derive(path).hdPublicKey;
    } else {
      // this 
      var path = Constants.PATHS.REQUEST_KEY_AUTH;
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
