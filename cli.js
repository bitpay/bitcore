var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
var fs = require('fs');

var CliLib = require('./lib/clilib');

try {
  fs.unlinkSync('copay.dat');
} catch (e) {}

var cli = new CliLib({
  filename: 'copay.dat'
});

cli.createWallet('my wallet', 'me', 1, 1, 'testnet', function(err, secret) {
  if (err) {
    console.log(err);
    process.exit();
  }

  cli.status(function(err, status) {
    if (err) {
      console.log(err);
      process.exit();
    }

    console.log(status);
  })
});
