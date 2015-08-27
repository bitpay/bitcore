'use strict';

var _ = require('lodash');
var util = require('util');
var $ = require('preconditions').singleton();
var Uuid = require('uuid');

var Address = require('./address');
var Copayer = require('./copayer');
var AddressManager = require('./addressmanager');
var WalletUtils = require('bitcore-wallet-utils');

function Wallet() {};

Wallet.create = function(opts) {
  opts = opts || {};

  var x = new Wallet();

  x.version = '1.0.0';
  x.createdOn = Math.floor(Date.now() / 1000);
  x.id = opts.id || Uuid.v4();
  x.name = opts.name;
  x.m = opts.m;
  x.n = opts.n;
  x.status = 'pending';
  x.publicKeyRing = [];
  x.addressIndex = 0;
  x.copayers = [];
  x.pubKey = opts.pubKey;
  x.network = opts.network;
  x.addressManager = AddressManager.create();
  x.scanStatus = null;

  return x;
};

Wallet.fromObj = function(obj) {
  var x = new Wallet();

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.id = obj.id;
  x.name = obj.name;
  x.m = obj.m;
  x.n = obj.n;
  x.status = obj.status;
  x.publicKeyRing = obj.publicKeyRing;
  x.copayers = _.map(obj.copayers, function(copayer) {
    return Copayer.fromObj(copayer);
  });
  x.pubKey = obj.pubKey;
  x.network = obj.network;
  x.addressManager = AddressManager.fromObj(obj.addressManager);
  x.scanStatus = obj.scanStatus;

  return x;
};

/* For compressed keys, m*73 + n*34 <= 496 */
Wallet.COPAYER_PAIR_LIMITS = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 4,
  6: 4,
  7: 3,
  8: 3,
  9: 2,
  10: 2,
  11: 1,
  12: 1,
};

/**
 * Get the maximum allowed number of required copayers.
 * This is a limit imposed by the maximum allowed size of the scriptSig.
 * @param {number} totalCopayers - the total number of copayers
 * @return {number}
 */
Wallet.getMaxRequiredCopayers = function(totalCopayers) {
  return Wallet.COPAYER_PAIR_LIMITS[totalCopayers];
};

Wallet.verifyCopayerLimits = function(m, n) {
  return (n >= 1 && n <= 12) && (m >= 1 && m <= Wallet.COPAYER_PAIR_LIMITS[n]);
};

Wallet.prototype.isShared = function() {
  return this.n > 1;
};


Wallet.prototype._updatePublicKeyRing = function() {
  this.publicKeyRing = _.map(this.copayers, function(copayer) {
    return _.pick(copayer, ['xPubKey', 'requestPubKey']);
  });
};

Wallet.prototype.addCopayer = function(copayer) {

  this.copayers.push(copayer);
  if (this.copayers.length < this.n) return;

  this.status = 'complete';
  this._updatePublicKeyRing();
};

Wallet.prototype.addCopayerRequestKey = function(copayerId, requestPubKey, signature, restrictions, name) {
  $.checkState(this.copayers.length == this.n);

  var c = this.getCopayer(copayerId);

  //new ones go first
  c.requestPubKeys.unshift({
    key: requestPubKey.toString(),
    signature: signature,
    selfSigned: true,
    restrictions: restrictions || {},
    name: name || null,
  });
};

Wallet.prototype.getCopayer = function(copayerId) {
  return _.find(this.copayers, {
    id: copayerId
  });
};

Wallet.prototype.getNetworkName = function() {
  return this.network;
};

Wallet.prototype.isComplete = function() {
  return this.status == 'complete';
};

Wallet.prototype.isScanning = function() {
  return this.scanning;
};

Wallet.prototype.createAddress = function(isChange) {
  $.checkState(this.isComplete());

  var path = this.addressManager.getNewAddressPath(isChange);
  var raw = WalletUtils.deriveAddress(this.publicKeyRing, path, this.m, this.network);
  var address = Address.create(_.extend(raw, {
    walletId: this.id,
  }));
  address.isChange = isChange;
  return address;
};


module.exports = Wallet;
