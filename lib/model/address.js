'use strict';

function Address(opts) {
	opts = opts || {};

	this.address = opts.address;
	this.path = opts.path;
};

Address.fromObj = function (obj) {
	var x = new Address();

	x.address = obj.address;
	x.path = obj.path;
	return x;
};

module.exports = Address;
