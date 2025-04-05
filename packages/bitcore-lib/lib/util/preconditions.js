'use strict';

var errors = require('../errors');
var _ = require('lodash');

module.exports = {
  checkState: function(condition, message) {
    if (!condition) {
      throw new errors.InvalidState(message);
    }
  },
  checkArgument: function(condition, argumentName, message, docsPath) {
    if (!condition) {
      throw new errors.InvalidArgument(argumentName, message, docsPath);
    }
  },
  checkArgumentType: function(argument, type, argumentName) {
    argumentName = argumentName || '(unknown name)';
    if (_.isString(type)) {
      if (type === 'Buffer') {
        var buffer = require('buffer'); // './buffer' fails on cordova & RN
        if (!buffer.Buffer.isBuffer(argument)) {
          throw new errors.InvalidArgumentType(argument, type, argumentName);
        }
      } else if (typeof argument !== type && (argument && argument.constructor && argument.constructor.name !== type)) {
        // Note that the constructor check is more reliable than the `instanceof` check below.
        throw new errors.InvalidArgumentType(argument, type, argumentName);
      }
    } else {
      if (!(argument instanceof type)) {
        throw new errors.InvalidArgumentType(argument, type.name, argumentName);
      }
    }
  },
  isType: function(argument, type, argumentName) {
    try {
      this.checkArgumentType(argument, type, argumentName);
      return true;
    } catch {
      return false;
    }
  }
};
