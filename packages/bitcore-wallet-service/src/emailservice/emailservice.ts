#!/usr/bin/env node

const EmailService = require('../lib/emailservice');
const config = require('../config');
const log = require('npmlog');
log.debug = log.verbose;

const emailService = new EmailService();
emailService.start(config, (err) => {
  if (err) throw err;

  console.log('Email service started');
});
