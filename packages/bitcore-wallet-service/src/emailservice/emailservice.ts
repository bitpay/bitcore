#!/usr/bin/env node
import logger from '../lib/logger';
import config from '../config';
import { EmailService } from '../lib/emailservice';

const emailService = new EmailService();
emailService.start(config, err => {
  if (err) throw err;

  logger.info('Email service started');
});
