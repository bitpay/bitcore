'use strict';

var _ = require('lodash');

var Copayer = require('./copayer');
var Bitcore = require('bitcore');
var PublicKey = Bitcore.PublicKey;

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

  if (opts.pubKey)
    this.pubKey = new PublicKey(opts.pubKey);
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
  x.pubKey = new PublicKey(obj.pubKey);

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
