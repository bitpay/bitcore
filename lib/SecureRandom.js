var crypto = require('crypto');

var SecureRandom = require('./common/SecureRandom');

SecureRandom.getRandomBuffer = function(size) {
  return crypto.randomBytes(size);
}

module.exports = SecureRandom;
