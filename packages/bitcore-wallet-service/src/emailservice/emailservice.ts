#!/usr/bin/env node
import logger from '../lib/logger';
var config = require('../config');
const EmailService = require('../lib/emailservice');

const emailService = new EmailService();
emailService.start(config, err => {
  if (err) throw err;

  logger.info('Email service started');
});
