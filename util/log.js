var noop = function() {};

var loggers = {
  none: {info: noop, warn: noop, err: noop, debug: noop},
  normal: {info: console.log, warn: console.log, err: console.log, debug: noop},
  debug: {info: console.log, warn: console.log, err: console.log, debug: console.log},
};

var config = require('../config');
if(config.log) {
  module.exports = config.log;
} else {
  module.exports = loggers[config.logger || 'normal'];
}
