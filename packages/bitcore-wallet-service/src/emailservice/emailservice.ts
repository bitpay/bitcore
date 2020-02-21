#!/usr/bin/env node

var config = require('../config');
const EmailService = require('../lib/emailservice');
const log = require('npmlog');
log.debug = log.verbose;

const emailService = new EmailService();
emailService.start(config, err => {
  if (err) throw err;

  console.log('Email service started');
});
