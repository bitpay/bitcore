'use strict';

function TxProposal(opts) {
	opts = opts || {};

	this.createdOn = Math.floor(Date.now() / 1000);
	this.id = opts.id;
	this.creatorId = opts.creatorId;
	this.toAddress = opts.toAddress;
	this.amount = opts.amount;
	this.changeAddress = opts.changeAddress;
	this.inputs = opts.inputs;
	this.actions = [];
};

TxProposal.fromObj = function (obj) {
	var x = new TxProposal();

	x.createdOn = obj.createdOn;
	x.id = obj.id;
	x.creatorId = obj.creatorId;
	x.toAddress = obj.toAddress;
	x.amount = obj.amount;
	x.changeAddress = obj.changeAddress;
	x.inputs = obj.inputs;
	x.raw = obj.raw;
	x.actions = _.map(obj.actions, function(a) {
		return {
			createdOn: a.createdOn,
			copayerId: a.copayerId,
			type: a.type,
			signature: a.signature,
		};
	});

	return x;
};

module.exports = TxProposal;
