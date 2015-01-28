'use strict';

function TxProposal(opts) {
	opts = opts || {};

	this.createdOn = Math.floor(Date.now() / 1000);
	this.creatorId = opts.creatorId;
	this.toAddress = opts.toAddress;
	this.amount = opts.amount;
	this.changeAddress = opts.changeAddress;
	this.inputs = opts.inputs;
};

TxProposal.fromObj = function (obj) {
	var x = new TxProposal();

	x.createdOn = obj.createdOn;
	x.creatorId = obj.creatorId;
	x.toAddress = obj.toAddress;
	x.amount = obj.amount;
	x.changeAddress = obj.changeAddress;
	x.inputs = obj.inputs;
	x.raw = obj.raw;

	return x;
};

module.exports = TxProposal;
