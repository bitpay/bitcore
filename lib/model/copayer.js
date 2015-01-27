'use strict';

var _ = require('lodash');

function Copayer(opts) {
	opts = opts || {};

	this.walletId = opts.walletId;
	this.id = opts.id;
	this.name = opts.name;
	this.xPubKey = opts.xPubKey;
	this.xPubKeySignature = opts.xPubKeySignature;
};

Copayer.fromObj = function (obj) {
	var x = new Copayer();

	x.walletId = obj.walletId;
	x.id = obj.id;
	x.name = obj.name;
	x.xPubKey = obj.xPubKey;
	x.xPubKeySignature = obj.xPubKeySignature;
	return x;
};


module.exports = Copayer;
