if (process.versions) {
  module.exports = require('./node/Point');
  return;
}
module.exports = require('./browser/Point');
