'use strict';

// karma.conf.js
module.exports = function(config) {

  config.set({
    browsers: ['Firefox'],
    frameworks: ['mocha'],
    singleRun: true,
    files: [
      './../../tests.js' // project root
    ],
    plugins: [
      'karma-mocha',
      'karma-firefox-launcher'
    ]
  });

};
