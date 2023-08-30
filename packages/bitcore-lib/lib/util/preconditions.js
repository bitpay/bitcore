'use strict';

var errors = require('../errors');

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
    if (typeof type === 'string') {
      if (type === 'Buffer') {
        var buffer = require('buffer'); // './buffer' fails on cordova & RN
        if (!buffer.Buffer.isBuffer(argument)) {
          throw new errors.InvalidArgumentType(argument, type, argumentName);
        }
      } else if (typeof argument !== type) {
        throw new errors.InvalidArgumentType(argument, type, argumentName);
      }
    } else {
      if (!(argument instanceof type)) {
        throw new errors.InvalidArgumentType(argument, type.name, argumentName);
      }
    }
  }
};
