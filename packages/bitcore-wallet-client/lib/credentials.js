'use strict';

const $ = require('preconditions').singleton();
const _ = require('lodash');

const Bitcore = require('bitcore-lib');
const Mnemonic = require('bitcore-mnemonic');
const sjcl = require('sjcl');

const Common = require('./common');
const Constants = Common.Constants;
const Utils = Common.Utils;

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
  'version',
  'rootPath',               // this is only for information
];

function Credentials() {
  this.version = '2.0.0';
  this.account = 0;
};

/*
 *coin, xPrivKey, account, network
 */

Credentials.fromDerivedKey = function(opts) {
  $.shouldBeString(opts.coin);
  $.shouldBeString(opts.network);
  $.shouldBeNumber(opts.account, 'Invalid account');
  $.shouldBeString(opts.xPubKey, 'Invalid xPubKey');
  $.shouldBeString(opts.rootPath, 'Invalid rootPath');
  $.shouldBeString(opts.requestPrivKey, 'Invalid requestPrivKey');
  $.checkArgument(_.isUndefined(opts.nonCompliantDerivation));
  opts = opts || {};


  var x = new Credentials();
  x.coin = opts.coin;
  x.network = opts.network;
  x.account = opts.account;
  x.n = opts.n;
  x.xPubKey = opts.xPubKey;

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

Credentials.getRootPath = function() {
  if (!this.rootPath) {
    // legacy base path schema
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
  } else {
    throw new Error('unknown coin: ' + this.coin);
  };

  return "m/" + purpose + "'/" + coin + "'/" + this.account + "'";
  return this.rootPath;
};

Credentials.fromObj = function(obj) {

  var x = new Credentials();
  if (obj.version != x.version) {
    throw 'Bad Credentials version';
  }

  _.each(FIELDS, function(k) {
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
  _.each(FIELDS, function(k) {
    x[k] = self[k];
  });
  return x;
};
Credentials.prototype.addWalletPrivateKey = function(walletPrivKey) {
  this.walletPrivKey = walletPrivKey;
  this.sharedEncryptingKey = Utils.privateKeyToAESKey(walletPrivKey);
};

Credentials.prototype.addWalletInfo = function(walletId, walletName, m, n, copayerName) {
  this.walletId = walletId;
  this.walletName = walletName;
  this.m = m;

  if (this.n && this.n != n) {
    throw new Error(`Bad nr of copayers in addWalletInfo: this: ${this.n} got: ${n}`, this.n, n);
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
