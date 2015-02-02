var $ = require('preconditions').singleton();
var _ = require('lodash');
var Lock = require('./lock');

var Utils = {};

Utils.runLocked = function (token, cb, task) {
  var self = this;

  Lock.get(token, function (lock) {
    var _cb = function () {
      cb.apply(null, arguments);
      lock.free();
    };
    task(_cb);
  });
};


Utils.checkRequired = function (obj, args) {
  args = [].concat(args);
  if (!_.isObject(obj)) throw 'Required arguments missing';
  _.each(args, function (arg) {
    if (!obj.hasOwnProperty(arg)) throw "Missing required argument '" + arg + "'";
  });
};

module.exports = Utils;
