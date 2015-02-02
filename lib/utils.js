var $ = require('preconditions').singleton();
var _ = require('lodash');

var utils = {};

utils.checkRequired = function (obj, args) {
	args = [].concat(args);
	if (!_.isObject(obj)) throw 'Required arguments missing';
	_.each(args, function (arg) {
		if (!obj.hasOwnProperty(arg)) throw "Missing required argument '" + arg + "'";
	});
};

module.exports = utils;
