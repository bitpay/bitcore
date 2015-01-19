if ( typeof(window) === 'undefined' ) {
  module.exports = require('./node');
} else {
  module.exports = require('./browser');
}
