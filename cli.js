var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
var fs = require('fs');

var clilib = require('./lib/clilib');

fs.unlinkSync('.bit');

clilib.createWallet('my wallet', 'me', 1, 1, function(err, secret) {
  if (err) {
    console.log(err);
    process.exit();
  }

  clilib.status(function(err, status) {
    if (err) {
      console.log(err);
      process.exit();
    }

    console.log(status);
  })
});
