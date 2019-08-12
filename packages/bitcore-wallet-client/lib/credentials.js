'use strict';

const $ = require('preconditions').singleton();
const _ = require('lodash');

const Bitcore = require('bitcore-lib');
const Mnemonic = require('bitcore-mnemonic');
const sjcl = require('sjcl');

const Common = require('./common');
const Constants = Common.Constants;
const Utils = Common.Utils;

function Credentials() {
  this.version = 2;
  this.account = 0;
};


Credentials.FIELDS = [
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
  'mnemonic',               // Obsolete
  'mnemonicEncrypted',      // Obsolete
  'entropySource',
  'mnemonicHasPassphrase',
  'derivationStrategy',
  'account',
  'compliantDerivation',
  'addressType',
  'hwInfo',                 // Obsolete
  'entropySourcePath',      // Obsolete
  'use145forBCH',           // Obsolete
  'version',
  'rootPath',               // this is only for information
  'keyId',                  // this is only for information
];


/*
 *coin, xPrivKey, account, network
 */

Credentials.fromDerivedKey = function(opts) {
  $.shouldBeString(opts.coin);
  $.shouldBeString(opts.network);
  $.shouldBeNumber(opts.account, 'Invalid account');
  $.shouldBeString(opts.xPubKey, 'Invalid xPubKey');
  $.shouldBeString(opts.rootPath, 'Invalid rootPath');
  $.shouldBeString(opts.keyId, 'Invalid keyId');
  $.shouldBeString(opts.requestPrivKey, 'Invalid requestPrivKey');
  $.checkArgument(_.isUndefined(opts.nonCompliantDerivation));
  opts = opts || {};


  var x = new Credentials();
  x.coin = opts.coin;
  x.network = opts.network;
  x.account = opts.account;
  x.n = opts.n;
  x.xPubKey = opts.xPubKey;
  x.keyId = opts.keyId;

  //this allows to set P2SH in old n=1 wallets
  if (_.isUndefined(opts.addressType)){
    x.addressType = opts.n == 1 ?  Constants.SCRIPT_TYPES.P2PKH:Constants.SCRIPT_TYPES.P2SH;
  } else {
    x.addressType = opts.addressType;
  }


  // Only  used for info
  x.rootPath = opts.rootPath;

  if (opts.walletPrivKey) {
    x.addWalletPrivateKey(opts.walletPrivKey);
  }
  x.requestPrivKey = opts.requestPrivKey;

  const priv = Bitcore.PrivateKey(x.requestPrivKey);
  x.requestPubKey = priv.toPublicKey().toString();

  const prefix= 'personalKey';
  const entropySource = Bitcore.crypto.Hash.sha256(priv.toBuffer()).toString('hex')
  const b = Buffer.from(entropySource, 'hex');
  const b2 = Bitcore.crypto.Hash.sha256hmac(b, Buffer.from(prefix));
  x.personalEncryptingKey = b2.slice(0, 16).toString('base64');
  x.copayerId = Utils.xPubToCopayerId(x.coin, x.xPubKey);
  x.publicKeyRing = [{
    xPubKey: x.xPubKey,
    requestPubKey: x.requestPubKey,
  }];

  return x;
};

Credentials.prototype.getRootPath = function() {
  var self = this;

  // This is for OLD v1.0 credentials only.
  function legacyRootPath () {
    // legacy base path schema
    var purpose;
    switch (self.derivationStrategy) {
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
    if (self.network != 'livenet' ) {
      coin = '1';
    } else if (self.coin == 'bch') {
      if (self.use145forBCH) {
        coin = '145';
      } else {
        coin = '0';
      }
    } else if (self.coin == 'btc') {
      coin = '0';
    } else if (self.coin == 'eth') {
      coin = '60';
    } else {
      throw new Error('unknown coin: ' + self.coin);
    };
    return "m/" + purpose + "'/" + coin + "'/" + self.account + "'";
  };

  if (!this.rootPath) {
    this.rootPath = legacyRootPath();
  }
 return this.rootPath;
};

Credentials.fromObj = function(obj) {
  var x = new Credentials();

  if (!obj.version  || obj.version < x.version) {
    throw 'Obsolete credentials version';
  }

  if (obj.version != x.version) {
    throw 'Bad credentials version';
  }

  _.each(Credentials.FIELDS, function(k) {
    x[k] = obj[k];
  });

  if (x.externalSource) {
    throw new Error('External Wallets are no longer supported');
  }

  x.coin = x.coin || 'btc';
  x.addressType = x.addressType || Constants.SCRIPT_TYPES.P2SH;
  x.account = x.account || 0;

  $.checkState(x.xPrivKey || x.xPubKey || x.xPrivKeyEncrypted, "invalid input");
  return x;
};

Credentials.prototype.toObj = function() {
  var self = this;

  var x = {};
  _.each(Credentials.FIELDS, function(k) {
    x[k] = self[k];
  });
  return x;
};
Credentials.prototype.addWalletPrivateKey = function(walletPrivKey) {
  this.walletPrivKey = walletPrivKey;
  this.sharedEncryptingKey = Utils.privateKeyToAESKey(walletPrivKey);
};

Credentials.prototype.addWalletInfo = function(walletId, walletName, m, n, copayerName, opts) {
  opts = opts || {};
  this.walletId = walletId;
  this.walletName = walletName;
  this.m = m;

  if ( this.n != n && !opts.allowOverwrite) {
    // we always allow multisig n overwrite
    if ( this.n == 1 || n == 1 ) { 
      throw new Error(`Bad nr of copayers in addWalletInfo: this: ${this.n} got: ${n}`);
    }
  }
  
  this.n = n;

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


Credentials.prototype.addPublicKeyRing = function(publicKeyRing) {
  this.publicKeyRing = _.clone(publicKeyRing);
};

Credentials.prototype.isComplete = function() {
  if (!this.m || !this.n) return false;
  if (!this.publicKeyRing || this.publicKeyRing.length != this.n) return false;
  return true;
};

module.exports = Credentials;
