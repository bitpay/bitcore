#!/usr/bin/env node

process.env.LOGGER_IDENTIFIER = 'pushnotificationsservice';

import config from '../config';
import logger from '../lib/logger';
import { PushNotificationsService } from '../lib/pushnotificationsservice';

const pushNotificationsService = new PushNotificationsService();
pushNotificationsService.start(config, err => {
  if (err) throw err;

  logger.info('Push Notification Service started');
});
