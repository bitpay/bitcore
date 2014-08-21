'use strict';

var noop = function() {};
var cl = console.log.bind(console);

var loggers = {
  none: {
    info: noop,
    warn: noop,
    err: noop,
    debug: noop
  },
  normal: {
    info: cl,
    warn: cl,
    err: cl,
    debug: noop
  },
  debug: {
    info: cl,
    warn: cl,
    err: cl,
    debug: cl
  },
};

var config = require('../config');
if (config.log) {
  module.exports = config.log;
} else {
  module.exports = loggers[config.logger || 'normal'];
}
