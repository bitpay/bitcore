#!/usr/bin/env node

'use strict';

var _ = require('lodash');
var log = require('npmlog');
log.debug = log.verbose;

var config = require('../config');
if (process.argv[2]) {
  config = JSON.parse(process.argv[2]);
}
var EmailService = require('../lib/emailservice');

var emailService = new EmailService();
emailService.start(config, function(err) {
  if (err) throw err;

  console.log('Email service started');
});
