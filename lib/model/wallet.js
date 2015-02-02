'use strict';

var _ = require('lodash');

var Copayer = require('./copayer');
var WALLET_VERSION = '1.0.0';

function Wallet(opts) {
	opts = opts || {};

	this.createdOn = Math.floor(Date.now() / 1000);
	this.id = opts.id;
	this.name = opts.name;
	this.m = opts.m;
	this.n = opts.n;
	this.status = 'pending';
	this.publicKeyRing = [];
	this.addressIndex = 0;
	this.copayers = [];
  this.version = WALLET_VERSION;
  this.pubKey = opts.pubKey;
};


Wallet.fromUntrustedObj = function (obj) {

  // TODO add sanity checks OR migration steps?
  if (!obj.pubKey || !obj.m || !obj.n) 
    return cb('Wallet corrupted');

  return Wallet.fromObj(obj);
};

Wallet.fromObj = function (obj) {
	var x = new Wallet();

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
