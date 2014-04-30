if (process.versions) {
  module.exports = require('./node/Message');
  return;
}
module.exports = require('./browser/Message');
