'use strict';

// karma.conf.js
module.exports = function(config) {
  var fs = require('fs');
  var path = require('path');

  var isDocker;

  function hasDockerEnv() {
    try {
      fs.statSync('/.dockerenv');
      return true;
    } catch (err) {
      return false;
    }
  }

  function hasDockerCGroup() {
    try {
      const file = fs.readFileSync('/proc/self/cgroup', 'utf8');
      return file.indexOf('docker') !== -1;
    } catch (err) {
      return false;
    }
  }

  function check() {
    return hasDockerEnv() || hasDockerCGroup();
  }

  if (isDocker === undefined) {
    isDocker = check();
  }



  config.set({
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: isDocker? [
          '--no-sandbox', // required to run without privileges in docker
          '--user-data-dir=/tmp/chrome-test-profile',
          '--disable-web-security'
        ] : []
      }
    },
    frameworks: ['mocha'],
    singleRun: false,
    reporters: ['progress'],
    logLevel: config.LOG_INFO,
    //    port: 9876,  // karma web server port
    autoWatch: false,
    // gulp runs Karma from the consuming package root, where
    // browser:maketests writes the generated Browserify test bundle -- the
    // same consumer-cwd resolution wdio.conf.js already uses, rather than a
    // path relative to this shared config file's own on-disk location
    // (which only lined up under Lerna's per-package bootstrap nesting).
    files: [
      path.join(process.cwd(), 'tests.js')
    ],
    plugins: [
      'karma-mocha',
      'karma-chrome-launcher',
    ]
  });

};
