if (process.versions) {
  module.exports = require('./Key.node');
  return;
}
module.exports = require('./Key.browser');
