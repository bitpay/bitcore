if (process.versions) {
  module.exports = require('./node/cryptox');
  return;
}
module.exports = require('./browser/cryptox');
