'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');

var Bitcore = require('bitcore-lib');
var Mnemonic = require('bitcore-mnemonic');
var sjcl = require('sjcl');

var Common = require('./common');
var Constants = Common.Constants;
var Utils = Common.Utils;
var config = require('./common/config');

var FIELDS = [
  'coin',
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
  'compliantDerivation',
  'addressType',
  'hwInfo',
  'entropySourcePath',
];

function Credentials() {
  this.version = '1.0.0';
  this.derivationStrategy = Constants.DERIVATION_STRATEGIES.BIP44;
  this.account = 0;
};

function _checkCoin(coin) {
  if (!config.chains[coin]) Error('Invalid coin');
};

function _checkNetwork(coin, network) {
  if (!config.chains[coin][network]) throw new Error('Invalid network');
};

Credentials.create = function(coin, network) {
  _checkCoin(coin);
  _checkNetwork(coin, network);

  var x = new Credentials();

  x.coin = coin;
  x.network = network;
  x.xPrivKey = (new Bitcore.HDPrivateKey(network)).toString();
  x.compliantDerivation = true;
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
  _checkNetwork(coin, network);
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

  if (opts.walletPrivKey) {
    x.addWalletPrivateKey(opts.walletPrivKey);
  }

  x._expand();
  return x;
};

// note that mnemonic / passphrase is NOT stored
Credentials.fromMnemonic = function(coin, network, words, passphrase, account, derivationStrategy, opts) {
  _checkCoin(coin);
  _checkNetwork(coin, network);
  $.shouldBeNumber(account);
  $.checkArgument(_.includes(_.values(Constants.DERIVATION_STRATEGIES), derivationStrategy));

  opts = opts || {};

  var m = new Mnemonic(words);
  var x = new Credentials();
  x.coin = coin;
  x.xPrivKey = m.toHDPrivateKey(passphrase, network).toString();
  x.mnemonic = words;
  x.mnemonicHasPassphrase = !!passphrase;
  x.account = account;
  x.derivationStrategy = derivationStrategy;
  x.compliantDerivation = !opts.nonCompliantDerivation;
  x.entropySourcePath = opts.entropySourcePath;

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
  x._expand();
  return x;
};

// Get network from extended private key or extended public key
Credentials._getNetworkFromExtendedKey = function(xKey) {
  $.checkArgument(xKey && _.isString(xKey));
  return xKey.charAt(0) == 't' ? 'testnet' : 'livenet';
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
    // the default network of livenet should be okay
    $.checkState(this.network.name === network.name || network === 'livenet');
  } else {
    this.network = network;
  }

  if (this.xPrivKey) {
    var xPrivKey = new Bitcore.HDPrivateKey.fromString(this.xPrivKey);

    var deriveFn = this.compliantDerivation ? _.bind(xPrivKey.deriveChild, xPrivKey) : _.bind(xPrivKey.deriveNonCompliantChild, xPrivKey);

    var derivedXPrivKey = deriveFn(this.getBaseAddressDerivationPath());

    // this is the xPubKey shared with the server.
    this.xPubKey = derivedXPrivKey.hdPublicKey.toString();
  }

  // requests keys from mnemonics, but using a xPubkey
  // This is only used when importing mnemonics FROM 
  // an hwwallet, in which xPriv was not available when
  // the wallet was created.
  if (this.entropySourcePath) {
    var seed = deriveFn(this.entropySourcePath).publicKey.toBuffer();
    this.entropySource = Bitcore.crypto.Hash.sha256sha256(seed).toString('hex');
  }

  if (this.entropySource) {
    // request keys from entropy (hw wallets)
    var seed = this._hashFromEntropy('reqPrivKey', 32);
    var privKey = new Bitcore.PrivateKey(seed.toString('hex'), network);
    this.requestPrivKey = privKey.toString();
    this.requestPubKey = privKey.toPublicKey().toString();
  } else {
    // request keys derived from xPriv
    var requestDerivation = deriveFn(Constants.PATHS.REQUEST_KEY);
    this.requestPrivKey = requestDerivation.privateKey.toString();

    var pubKey = requestDerivation.publicKey;
    this.requestPubKey = pubKey.toString();

    this.entropySource = Bitcore.crypto.Hash.sha256(requestDerivation.privateKey.toBuffer()).toString('hex');
  }

  this.personalEncryptingKey = this._hashFromEntropy('personalKey', 16).toString('base64');

  $.checkState(this.coin);

  this.copayerId = Utils.xPubToCopayerId(this.coin, this.xPubKey);
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

  x.coin = x.coin || 'btc';
  x.derivationStrategy = x.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
  x.addressType = x.addressType || Constants.SCRIPT_TYPES.P2SH;
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

  var coin = (this.network == 'livenet' ? "0" : "1");
  return "m/" + purpose + "'/" + coin + "'/" + this.account + "'";
};

Credentials.prototype.getDerivedXPrivKey = function(password) {
  var path = this.getBaseAddressDerivationPath();
  var xPrivKey = new Bitcore.HDPrivateKey(this.getKeys(password).xPrivKey, this.network);
  var deriveFn = !!this.compliantDerivation ? _.bind(xPrivKey.deriveChild, xPrivKey) : _.bind(xPrivKey.deriveNonCompliantChild, xPrivKey);
  return deriveFn(path);
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

  // Use m/48' for multisig hardware wallets
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

Credentials.prototype.isPrivKeyEncrypted = function() {
  return (!!this.xPrivKeyEncrypted) && !this.xPrivKey;
};

Credentials.prototype.encryptPrivateKey = function(password, opts) {
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

Credentials.prototype.decryptPrivateKey = function(password) {
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

Credentials.prototype.getKeys = function(password) {
  var keys = {};

  if (this.isPrivKeyEncrypted()) {
    $.checkArgument(password, 'Private keys are encrypted, a password is needed');
    try {
      keys.xPrivKey = sjcl.decrypt(password, this.xPrivKeyEncrypted);

      if (this.mnemonicEncrypted) {
        keys.mnemonic = sjcl.decrypt(password, this.mnemonicEncrypted);
      }
    } catch (ex) {
      throw new Error('Could not decrypt');
    }
  } else {
    keys.xPrivKey = this.xPrivKey;
    keys.mnemonic = this.mnemonic;
  }
  return keys;
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
  credentials.coin = 'btc';
  credentials.derivationStrategy = Constants.DERIVATION_STRATEGIES.BIP45;
  credentials.xPrivKey = w.privateKey.extendedPrivateKeyString;
  credentials._expand();

  credentials.addWalletPrivateKey(walletPrivKeyFromOldCopayWallet(w));
  credentials.addWalletInfo(w.opts.id, w.opts.name, w.opts.requiredCopayers, w.opts.totalCopayers)

  var pkr = _.map(w.publicKeyRing.copayersExtPubKeys, function(xPubStr) {

    var isMe = xPubStr === credentials.xPubKey;
    var requestDerivation;

    if (isMe) {
      var path = Constants.PATHS.REQUEST_KEY;
      requestDerivation = (new Bitcore.HDPrivateKey(credentials.xPrivKey))
        .deriveChild(path).hdPublicKey;
    } else {
      // this 
      var path = Constants.PATHS.REQUEST_KEY_AUTH;
      requestDerivation = (new Bitcore.HDPublicKey(xPubStr)).deriveChild(path);
    }

    // Grab Copayer Name
    var hd = new Bitcore.HDPublicKey(xPubStr).deriveChild('m/2147483646/0/0');
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
