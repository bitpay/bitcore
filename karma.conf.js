'use strict';

// karma.conf.js
module.exports = function(config) {

  // basic config
  config.set({
    frameworks: ['mocha'],
    singleRun: true,
    files: [
      'browser/tests.js'
    ]
  });

  // check environment variables
  var username = process.env.BS_USERNAME;
  var accesskey = process.env.BS_ACCESSKEY;

  var browsers = ['Firefox'];

  if (username && accesskey) {

    config.set({

      // browserstack settings
      browserStack: {
        username: username,
        accessKey: accesskey
      },

      // define browsers
      customLaunchers: {
        bs_firefox_mac: {
          base: 'BrowserStack',
          browser: 'firefox',
          browser_version: '34.0',
          os: 'OS X',
          os_version: 'Mountain Lion'
        }
      }
    });

    browsers.push('bs_firefox_mac');
  }

  // define browsers
  config.set({
    browsers: browsers
  });

};
