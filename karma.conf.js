'use strict';

// karma.conf.js
module.exports = function(config) {
  config.set({
    frameworks: ['mocha'],
    browsers: ['Chrome', 'Firefox'],
    singleRun: true,
    files: [
      'browser/tests.js'
    ]
  });
};
