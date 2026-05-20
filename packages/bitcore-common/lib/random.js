'use strict';
var crypto = require('crypto');

exports.randomBytes = function(n) {
  return crypto.randomBytes(n);
};
