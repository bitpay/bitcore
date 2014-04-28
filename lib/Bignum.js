if (process.versions) {
  module.exports = require('bignum');
  return;
}
module.exports = require('./browser/Bignum');
