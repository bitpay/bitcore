#!/usr/bin/env node
import config from '../config';
import { EmailService } from '../lib/emailservice';
import logger from '../lib/logger';

const emailService = new EmailService();
emailService.start(config, err => {
  if (err) throw err;

  logger.info('Email service started');
});
