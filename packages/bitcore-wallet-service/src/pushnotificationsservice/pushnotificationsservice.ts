#!/usr/bin/env node
import logger from '../lib/logger';
import { PushNotificationsService } from '../lib/pushnotificationsservice';
import config from '../config';

const pushNotificationsService = new PushNotificationsService();
pushNotificationsService.start(config, err => {
  if (err) throw err;

  logger.info('Push Notification Service started');
});
