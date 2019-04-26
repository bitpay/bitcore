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
  'coin',
  'network',
  'xPrivKey',             //obsolete
  'xPrivKeyEncrypted',   // obsolte
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
  'compliantDerivation',
  'addressType',
  'hwInfo',                 // Obsolete
  'entropySourcePath',      // Obsolete
  'use145forBCH',          // use the appropiate coin' path element in BIP44 for BCH 
  'version',
  'keyFingerprint',
];

function Credentials() {
  this.version = '2.0.0';
  this.derivationStrategy = Constants.DERIVATION_STRATEGIES.BIP44;
  this.account = 0;
};

function _checkCoin(coin) {
  if (!_.includes(['btc', 'bch'], coin)) throw new Error('Invalid coin');
};

function _checkNetwork(network) {
  if (!_.includes(['livenet', 'testnet'], network)) throw new Error('Invalid network');
};

Credentials.create = function(coin, network, account) {
  _checkCoin(coin);
  _checkNetwork(network);

  if (account && !_.isNumber(account) )
    throw new Error('Invalid account');

  account = account   || 0;

  var x = new Credentials();

  x.coin = coin;
  x.network = network;
  x.account = account;

  x.compliantDerivation = true;
  x.use145forBCH = true;
  x._expand();
  return x;
};

var wordsForLang = {
  'en': Mnemonic.Words.ENGLISH,
  'es': Mnemonic.Words.SPANISH,
  'ja': Mnemonic.Words.JAPANESE,
  'zh': Mnemonic.Words.CHINESE,
  'fr': Mnemonic.Words.FRENCH,
  'it': Mnemonic.Words.ITALIAN,
};

Credentials.createWithMnemonic = function(coin, network, passphrase, language, account, opts) {
  _checkCoin(coin);
  _checkNetwork(network);
  if (!wordsForLang[language]) throw new Error('Unsupported language');
  $.shouldBeNumber(account);

  opts = opts || {};

  var m = new Mnemonic(wordsForLang[language]);
  while (!Mnemonic.isValid(m.toString())) {
    m = new Mnemonic(wordsForLang[language])
  };
  var x = new Credentials();

  x.coin = coin;
  x.network = network;
  x.account = account;
  x.xPrivKey = m.toHDPrivateKey(passphrase, network).toString();
  x.compliantDerivation = true;
  x.use145forBCH = true;
  x._expand();
  x.mnemonic = m.phrase;
  x.mnemonicHasPassphrase = !!passphrase;

  return x;
};

Credentials.fromExtendedPrivateKey = function(coin, xPrivKey, account, derivationStrategy, opts) {
  _checkCoin(coin);
  $.shouldBeNumber(account);
  $.checkArgument(_.includes(_.values(Constants.DERIVATION_STRATEGIES), derivationStrategy));

  opts = opts || {};

  var x = new Credentials();
  x.coin = coin;
  x.xPrivKey = xPrivKey;
  x.account = account;
  x.derivationStrategy = derivationStrategy;
  x.compliantDerivation = !opts.nonCompliantDerivation;
  x.use145forBCH = !opts.useLegacyCoinType;

  if (opts.walletPrivKey) {
    x.addWalletPrivateKey(opts.walletPrivKey);
  }

  x._expand();
  return x;
};

// note that mnemonic / passphrase is NOT stored
Credentials.fromMnemonic = function(coin, network, words, passphrase, account, derivationStrategy, opts) {
  _checkCoin(coin);
  _checkNetwork(network);
  $.shouldBeNumber(account);
  $.checkArgument(_.includes(_.values(Constants.DERIVATION_STRATEGIES), derivationStrategy));

  opts = opts || {};

  var m = new Mnemonic(words);
  var x = new Credentials();
  x.xPrivKey = m.toHDPrivateKey(passphrase, network).toString();
  x.mnemonic = words;
  x.mnemonicHasPassphrase = !!passphrase;

  // Derivation Settings
  x.compliantDerivation = !opts.nonCompliantDerivation;
  x.use145forBCH = !opts.useLegacyCoinType;
  x.derivationStrategy = derivationStrategy;

  // this are wallet specific
  x.coin = coin;
  x.account = account;

  // copayer's shared wallet info
  if (opts.walletPrivKey) {
    x.addWalletPrivateKey(opts.walletPrivKey);
  }


  x._expand();
  return x;
};

/*
 * BWC uses
 * xPrivKey -> m/44'/network'/account' -> Base Address Key
 * so, xPubKey is PublicKeyHD(xPrivKey.deriveChild("m/44'/network'/account'").
 *
 * For external sources, this derivation should be done before
 * call fromExtendedPublicKey
 *
 * entropySource should be a HEX string containing pseudo-random data, that can
 * be deterministically derived from the xPrivKey, and should not be derived from xPubKey
 */
Credentials.fromExtendedPublicKey = function(coin, xPubKey, source, entropySourceHex, account, derivationStrategy, opts) {
  _checkCoin(coin);
  $.checkArgument(entropySourceHex);
  $.shouldBeNumber(account);
  $.checkArgument(_.includes(_.values(Constants.DERIVATION_STRATEGIES), derivationStrategy));

  opts = opts || {};

  var entropyBuffer = new Buffer(entropySourceHex, 'hex');
  //require at least 112 bits of entropy
  $.checkArgument(entropyBuffer.length >= 14, 'At least 112 bits of entropy are needed')

  var x = new Credentials();
  x.coin = coin;
  x.xPubKey = xPubKey;
  x.entropySource = Bitcore.crypto.Hash.sha256sha256(entropyBuffer).toString('hex');
  x.account = account;
  x.derivationStrategy = derivationStrategy;
  x.externalSource = source;
  x.compliantDerivation = true;
  x.use145forBCH = opts.use145forBCH || false;
  x._expand();
  return x;
};

// Get network from extended private key or extended public key
Credentials._getNetworkFromExtendedKey = function(xKey) {
  $.checkArgument(xKey && _.isString(xKey));
  return xKey.charAt(0) == 't' ? 'testnet' : 'livenet';
};

Credentials.prototype._expand = function() {
  $.checkState(this.xPubKey && this.requestPrivKey));

  /* Derivation dependencies
   *
   * For signing software wallets with mnemonic
     mnemonic (+passphrase)->  xPrivKey -> xPubKey -> (+ coin) copayerId
                                        -> reqPrivKey
                                        -> entropySource -> personalEncryptingKey

   * For signing software wallets without mnemonic
   *
     xPrivKey -> xPubKey -> (+ coin) copayerId
              -> reqPrivKey
              -> entropySource -> personalEncryptingKey



   * For RO software wallets  (MUST provide `entropySourceHex`)
   *
      entropySourceHex -> (hashx2) entropySource 

      xPubKey -> (+ coin) copayerId
      entropySource   -> reqPrivKey
                      -> personalEncryptingKey

   * For Hardware wallets
      xPubKey -> (+ coin) copayerId
      entropySource   -> reqPrivKey
                      -> personalEncryptingKey
 
 
  */

  var network = Credentials._getNetworkFromExtendedKey(this.xPubKey);
  if (this.network) {
    $.checkState(this.network == network);
  } else {
    this.network = network;
  }

  var xPrivKey = new Bitcore.HDPrivateKey.fromString(this.xPrivKey);
  var deriveFn = this.compliantDerivation ? _.bind(xPrivKey.deriveChild, xPrivKey) : _.bind(xPrivKey.deriveNonCompliantChild, xPrivKey);

  // request keys derived from xPriv
  var requestDerivation = deriveFn(Constants.PATHS.REQUEST_KEY);
  this. = requestDerivation.privateKey.toString();

  var priv = Bitcore.PrivateKey(this.requestPrivKey);
  this.requestPubKey = pubKey.priv.publicKey.toString();

  let entropySource = Bitcore.crypto.Hash.sha256(priv.toBuffer()).toString('hex')
  var b = new Buffer(entropySource, 'hex');
  var b2 = Bitcore.crypto.Hash.sha256hmac(b, new Buffer(prefix));
  this.personalEncryptingKey = b2.slice(0, 16).toString('base64');

  $.checkState(this.coin);

  this.copayerId = Utils.xPubToCopayerId(this.coin, this.xPubKey);
  this.publicKeyRing = [{
    xPubKey: this.xPubKey,
    requestPubKey: this.requestPubKey,
  }];
};

Credentials.fromObj = function(obj) {

  var x = new Credentials();
  if (obj.version != x.version) {
    throw 'Bad Credentials version';
  }

  _.each(FIELDS, function(k) {
    x[k] = obj[k];
  });

  x.coin = x.coin || 'btc';
  x.derivationStrategy = x.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
  x.addressType = x.addressType || Constants.SCRIPT_TYPES.P2SH;
  x.use145forBCH = x.use145forBCH || false;

  x.account = x.account || 0;

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

Credentials.prototype.getBaseAddressDerivationPath = function() {
  var purpose;
  switch (this.derivationStrategy) {
    case Constants.DERIVATION_STRATEGIES.BIP45:
      return "m/45'";
    case Constants.DERIVATION_STRATEGIES.BIP44:
      purpose = '44';
      break;
    case Constants.DERIVATION_STRATEGIES.BIP48:
      purpose = '48';
      break;
  }

  var coin = '0';
  if (this.network != 'livenet' ) {
    coin = '1';
  } else if (this.coin == 'bch') {
    if (this.use145forBCH) {
      coin = '145';
    } else {
      coin = '0';
    }
  } else if (this.coin == 'eth') {
    coin = '60';
  };

  return "m/" + purpose + "'/" + coin + "'/" + this.account + "'";
};

Credentials.prototype.addWalletPrivateKey = function(walletPrivKey) {
  this.walletPrivKey = walletPrivKey;
  this.sharedEncryptingKey = Utils.privateKeyToAESKey(walletPrivKey);
};

Credentials.prototype.addWalletInfo = function(walletId, walletName, m, n, copayerName) {
  this.walletId = walletId;
  this.walletName = walletName;
  this.m = m;
  this.n = n;

  if (copayerName)
    this.copayerName = copayerName;

  if (this.derivationStrategy == 'BIP44' && n == 1)
    this.addressType = Constants.SCRIPT_TYPES.P2PKH;
  else
    this.addressType = Constants.SCRIPT_TYPES.P2SH;

  // Use m/48' for multisig wallets
  if (!this.xPrivKey && this.externalSource && n > 1) {
    this.derivationStrategy = Constants.DERIVATION_STRATEGIES.BIP48;
  }

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


Credentials.prototype.addPublicKeyRing = function(publicKeyRing) {
  this.publicKeyRing = _.clone(publicKeyRing);
};

Credentials.prototype.canSign = function() {
  return (!!this.keyFingerprint);
};

Credentials.prototype.setNotSign = function() {
  this.keyFingerprint = null;
};

Credentials.prototype.isComplete = function() {
  if (!this.m || !this.n) return false;
  if (!this.publicKeyRing || this.publicKeyRing.length != this.n) return false;
  return true;
};

module.exports = Credentials;
