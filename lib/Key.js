if (process.versions) {
  module.exports = require('./node/Key');
  return;
}
module.exports = require('./browser/Key');
