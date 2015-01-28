'use strict';

var _ = require('lodash');

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
	return x;
};

module.exports = Wallet;
