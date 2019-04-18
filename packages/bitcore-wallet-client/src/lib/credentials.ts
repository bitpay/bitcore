'use strict';

var $ = require('preconditions').singleton();
import * as _ from 'lodash';

var Bitcore = require('bitcore-lib');
var Mnemonic = require('bitcore-mnemonic');
var sjcl = require('sjcl');

var Common = require('./common');
var Constants = Common.Constants;
var Utils = Common.Utils;

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

export class Credentials {
  version: string;
  derivationStrategy: any;
  account: number;
  coin: any;
  network: any;
  xPrivKey: any;
  compliantDerivation: any;

  wordsForLang = {
    'en': Mnemonic.Words.ENGLISH,
    'es': Mnemonic.Words.SPANISH,
    'ja': Mnemonic.Words.JAPANESE,
    'zh': Mnemonic.Words.CHINESE,
    'fr': Mnemonic.Words.FRENCH,
    'it': Mnemonic.Words.ITALIAN,
  };
  mnemonic: any;
  mnemonicHasPassphrase: boolean;
  entropySourcePath: any;
  xPubKey: any;
  entropySource: any;
  externalSource: any;
  requestPrivKey: any;
  requestPubKey: any;
  personalEncryptingKey: any;
  copayerId: any;
  publicKeyRing: { xPubKey: any; requestPubKey: any; }[];
  addressType: any;
  walletPrivKey: any;
  sharedEncryptingKey: any;
  walletId: any;
  walletName: any;
  m: any;
  n: any;
  copayerName: any;
  xPrivKeyEncrypted: any;
  mnemonicEncrypted: any;

  constructor() {
    this.version = '1.0.0';
    this.derivationStrategy = Constants.DERIVATION_STRATEGIES.BIP44;
    this.account = 0;
  }

  _checkCoin(coin) {
    if (!_.includes(['btc', 'bch'], coin)) throw new Error('Invalid coin');
  };

  _checkNetwork(network) {
    if (!_.includes(['livenet', 'testnet'], network)) throw new Error('Invalid network');
  };

  create(coin, network) {
    this._checkCoin(coin);
    this._checkNetwork(network);

    var x = new Credentials();

    x.coin = coin;
    x.network = network;
    x.xPrivKey = (new Bitcore.HDPrivateKey(network)).toString();
    x.compliantDerivation = true;
    x._expand();
    return x;
  };


  createWithMnemonic(coin, network, passphrase, language, account, opts) {
    this._checkCoin(coin);
    this._checkNetwork(network);
    if (!this.wordsForLang[language]) throw new Error('Unsupported language');
    $.shouldBeNumber(account);

    opts = opts || {};

    var m = new Mnemonic(this.wordsForLang[language]);
    while (!Mnemonic.isValid(m.toString())) {
      m = new Mnemonic(this.wordsForLang[language])
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

  fromExtendedPrivateKey(coin, xPrivKey, account, derivationStrategy, opts) {
    this._checkCoin(coin);
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
  fromMnemonic(coin, network, words, passphrase, account, derivationStrategy, opts) {
    this._checkCoin(coin);
    this._checkNetwork(network);
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
  fromExtendedPublicKey(coin, xPubKey, source, entropySourceHex, account, derivationStrategy, opts) {
    this._checkCoin(coin);
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
  _getNetworkFromExtendedKey(xKey) {
    $.checkArgument(xKey && _.isString(xKey));
    return xKey.charAt(0) == 't' ? 'testnet' : 'livenet';
  };

  _hashFromEntropy(prefix, length) {
    $.checkState(prefix);
    var b = new Buffer(this.entropySource, 'hex');
    var b2 = Bitcore.crypto.Hash.sha256hmac(b, new Buffer(prefix));
    return b2.slice(0, length);
  };


  _expand() {
    $.checkState(this.xPrivKey || (this.xPubKey && this.entropySource));

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
    entropySourcePath -> (+hw xPub derivation)  entropySource 
    
    xPubKey -> (+ coin) copayerId
    entropySource   -> reqPrivKey
    -> personalEncryptingKey
    
    
    */

    var network = this._getNetworkFromExtendedKey(this.xPrivKey || this.xPubKey);
    if (this.network) {
      $.checkState(this.network == network);
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

  fromObj(obj) {
    var x = new Credentials();

    _.each(FIELDS, (k) => {
      x[k] = obj[k];
    });

    x.coin = x.coin || 'btc';
    x.derivationStrategy = x.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
    x.addressType = x.addressType || Constants.SCRIPT_TYPES.P2SH;
    x.account = x.account || 0;

    $.checkState(x.xPrivKey || x.xPubKey || x.isPrivKeyEncrypted, "invalid input");
    return x;
  };

  toObj() {
    var self = this;

    var x = {};
    _.each(FIELDS, (k) => {
      x[k] = self[k];
    });
    return x;
  };

  getBaseAddressDerivationPath() {
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

  getDerivedXPrivKey(password) {
    var path = this.getBaseAddressDerivationPath();
    var xPrivKey = new Bitcore.HDPrivateKey(this.getKeys(password).xPrivKey, this.network);
    var deriveFn = !!this.compliantDerivation ? _.bind(xPrivKey.deriveChild, xPrivKey) : _.bind(xPrivKey.deriveNonCompliantChild, xPrivKey);
    return deriveFn(path);
  };

  addWalletPrivateKey(walletPrivKey) {
    this.walletPrivKey = walletPrivKey;
    this.sharedEncryptingKey = Utils.privateKeyToAESKey(walletPrivKey);
  };

  addWalletInfo(walletId, walletName, m, n, copayerName) {
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

  hasWalletInfo() {
    return !!this.walletId;
  };

  isPrivKeyEncrypted() {
    return (!!this.xPrivKeyEncrypted) && !this.xPrivKey;
  };

  encryptPrivateKey(password, opts) {
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

  decryptPrivateKey(password) {
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

  getKeys(password) {
    var keys: {
      xPrivKey: string,
      mnemonic: string,
    };

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

  addPublicKeyRing(publicKeyRing) {
    this.publicKeyRing = _.clone(publicKeyRing);
  };

  canSign() {
    return (!!this.xPrivKey || !!this.xPrivKeyEncrypted);
  };

  setNoSign() {
    delete this.xPrivKey;
    delete this.xPrivKeyEncrypted;
    delete this.mnemonic;
    delete this.mnemonicEncrypted;
  };

  isComplete() {
    if (!this.m || !this.n) return false;
    if (!this.publicKeyRing || this.publicKeyRing.length != this.n) return false;
    return true;
  };

  hasExternalSource() {
    return (typeof this.externalSource == "string");
  };

  getExternalSourceName() {
    return this.externalSource;
  };

  getMnemonic() {
    if (this.mnemonicEncrypted && !this.mnemonic) {
      throw new Error('Credentials are encrypted');
    }

    return this.mnemonic;
  };

  clearMnemonic() {
    delete this.mnemonic;
    delete this.mnemonicEncrypted;
  };

};