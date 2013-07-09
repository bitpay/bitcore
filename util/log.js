var noop = function() {};

var loggers = {
  none: {info: noop, warn: noop, err: noop, debug: noop},
  normal: {info: console.log, warn: console.log, err: console.log, debug: noop},
  debug: {info: console.log, warn: console.log, err: console.log, debug: console.log},
};

module.exports = function(config) {
  config = config || {};
  if(config.log) return config.log;
  if(config.loggers) return config.loggers[config.logging || 'normal'];
  return loggers[config.logging || 'normal'];
};
