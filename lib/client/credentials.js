'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var Bitcore = require('bitcore');
var WalletUtils = require('../walletutils');

var FIELDS = [
  'network',
  'xPrivKey',
  'xPubKey',
  'requestPrivKey',
  'copayerId',
  'publicKeyRing',
  'walletId',
  'walletName',
  'm',
  'n',
  'walletPrivKey',
  'sharedEncryptingKey',
  'copayerName',
];

var EXPORTABLE_FIELDS = [
  'xPrivKey',
  'requestPrivKey',
  'xPubKey',
  'm',
  'n',
  'publicKeyRing',
  'sharedEncryptingKey',
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

Credentials.fromExtendedPrivateKey = function(network, xPrivKey) {
  var x = new Credentials();
  x.network = network;
  x.xPrivKey = xPrivKey;
  x._expand();
  return x;
};

Credentials.fromAirGapped = function(network, xPubKey, requestPrivKey) {
  var x = new Credentials();
  x.network = network;
  x.xPubKey = xPubKey;
  x.requestPrivKey = requestPrivKey;
  x._expand();
  return x;
};

Credentials.prototype._expand = function() {
  $.checkState(this.xPrivKey || this.xPubKey);

  if (this.xPrivKey) {
    var xPrivKey = new Bitcore.HDPrivateKey.fromString(this.xPrivKey);
    this.xPubKey = (new Bitcore.HDPublicKey(xPrivKey)).toString();
    this.requestPrivKey = xPrivKey.derive('m/1/1').privateKey.toString();
  }
  this.personalEncryptingKey = WalletUtils.privateKeyToAESKey(this.requestPrivKey);
  this.copayerId = WalletUtils.xPubToCopayerId(this.xPubKey);
};

Credentials.fromObj = function(obj) {
  var x = new Credentials();

  _.each(FIELDS, function(k) {
    x[k] = obj[k];
  });

  return x;
};

Credentials.prototype.toObj = function() {
  return this;
};

Credentials.prototype.addWalletInfo = function(walletId, walletName, m, n, walletPrivKey, copayerName) {
  this.walletId = walletId;
  this.walletName = walletName;
  this.m = m;
  this.n = n;
  this.walletPrivKey = walletPrivKey;
  this.sharedEncryptingKey = WalletUtils.privateKeyToAESKey(walletPrivKey);
  this.copayerName = copayerName;
  if (n == 1) {
    this.addPublicKeyRing([this.xPubKey]);
  }
};

Credentials.prototype.addPublicKeyRing = function(publicKeyRing) {
  this.publicKeyRing = _.clone(publicKeyRing);
};

Credentials.prototype.canSign = function() {
  return !!this.xPrivKey;
};

Credentials.prototype.isComplete = function() {
  if (!this.m || !this.n) return false;
  if (!this.publicKeyRing || this.publicKeyRing.length != this.n) return false;
  return true;
};

Credentials.prototype.exportCompressed = function() {
  var self = this;

  var values = _.map(EXPORTABLE_FIELDS, function(field) {
    if ((field == 'xPubKey' || field == 'requestPrivKey') && self.canSign()) return;
    if (field == 'publicKeyRing') {
      return _.without(self.publicKeyRing, self.xPubKey);
    }
    return self[field];
  });
  values.unshift(self.version);

  return JSON.stringify(values);
};

Credentials.importCompressed = function(compressed) {
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
  x._expand();

  x.network = x.xPubKey.substr(0, 4) == 'tpub' ? 'testnet' : 'livenet';
  x.publicKeyRing.push(x.xPubKey);
  return x;
};

module.exports = Credentials;
