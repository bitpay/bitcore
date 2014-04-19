if (process.versions) {
  module.exports = require('./Point.node');
  return;
}
module.exports = require('./Point.browser');
