'use strict';

var _ = require('lodash');

var Copayer = require('./copayer');
var VERSION = '1.0.0';

function Wallet(opts) {
  opts = opts || {};

  this.version = VERSION;
  this.createdOn = Math.floor(Date.now() / 1000);
  this.id = opts.id;
  this.name = opts.name;
  this.m = opts.m;
  this.n = opts.n;
  this.status = 'pending';
  this.publicKeyRing = [];
  this.addressIndex = 0;
  this.copayers = [];
  this.pubKey = opts.pubKey;

  this.receiveAddressIndex = 0;
  this.changeAddressIndex = 0;
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

Wallet.verifyCopayerLimits = function (m, n) {
  return (n >= 1 && n <= 12) && (m >= 1 && m <= Wallet.COPAYER_PAIR_LIMITS[n]);
};

Wallet.fromObj = function (obj) {
  var x = new Wallet();

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.id = obj.id;
  x.name = obj.name;
  x.m = obj.m;
  x.n = obj.n;
  x.status = obj.status;
  x.publicKeyRing = obj.publicKeyRing;
  x.addressIndex = obj.addressIndex;
  x.copayers = _.map(obj.copayers, function (copayer) {
    return new Copayer(copayer);
  });
  x.pubKey = obj.pubKey;

  return x;
};

Wallet.prototype.addCopayer = function (copayer) {
  this.copayers.push(copayer);

  if (this.copayers.length < this.n) return;
  
  this.status = 'complete';
  this.publicKeyRing = _.pluck(this.copayers, 'xPubKey');
};

Wallet.prototype.getCopayer = function (copayerId) {
  return _.find(this.copayers, { id: copayerId });
};

module.exports = Wallet;
