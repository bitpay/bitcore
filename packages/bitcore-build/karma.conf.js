'use strict';

// karma.conf.js
module.exports = function(config) {

  config.set({
    browsers: ['ChromeHeadless'],
    frameworks: ['mocha'],
    singleRun: false,
    reporters: ['progress'],
    logLevel: config.LOG_INFO,
//    port: 9876,  // karma web server port
    autoWatch: false,
    files: [
      '../../tests.js'
    ],
    plugins: [
      'karma-mocha',
      'karma-chrome-launcher',
    ]
  });

};
