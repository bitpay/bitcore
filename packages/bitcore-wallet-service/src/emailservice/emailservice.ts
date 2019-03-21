#!/usr/bin/env node

'use strict';

import { EmailService } from '../lib/emailservice';
var _ = require('lodash');
var log = require('npmlog');
log.debug = log.verbose;

var config = require('../config');

var emailService = new EmailService();
emailService.start(config, function(err) {
  if (err) throw err;

  console.log('Email service started');
});
