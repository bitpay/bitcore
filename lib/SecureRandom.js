if (process.versions) {
  module.exports = require('./node/SecureRandom');
  return;
}
module.exports = require('./browser/SecureRandom');
