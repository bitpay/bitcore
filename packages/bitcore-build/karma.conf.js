'use strict';

// karma.conf.js
module.exports = function(config) {

  config.set({
    browsers: ['PhantomJS'],
    frameworks: ['mocha'],
    singleRun: true,
    files: [
      './../../tests.js' // project root
    ],
    plugins: [
      'karma-mocha',
      'karma-phantomjs-launcher'
    ]
  });

};
