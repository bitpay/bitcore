var noop = function() {};

var loggers = {
  none: {info: noop, warn: noop, err: noop, debug: noop},
  normal: {info: console.log, warn: console.log, err: console.log, debug: noop},
  debug: {info: console.log, warn: console.log, err: console.log, debug: console.log},
};

var build_log = function(config) {
  return config.log || loggers[config.logger || 'normal'];
};
if(!(typeof module === 'undefined')) {
  var config = require('../config');
  module.exports = build_log(config);
} else if(!(typeof define === 'undefined')) {
  define(['config'], function(config){
    var e = build_log(config)
    return e;
  });
}
