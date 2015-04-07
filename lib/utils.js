var $ = require('preconditions').singleton();
var _ = require('lodash');

var Utils = {};

Utils.checkRequired = function(obj, args) {
  args = [].concat(args);
  if (!_.isObject(obj)) return false;
  for (var i = 0; i < args.length; i++) {
    if (!obj.hasOwnProperty(args[i])) return false;
  }
  return true;
};

/**
 *
 * @desc rounds a JAvascript number
 * @param number
 * @return {number}
 */
Utils.strip = function(number) {
  return (parseFloat(number.toPrecision(12)));
}

module.exports = Utils;
