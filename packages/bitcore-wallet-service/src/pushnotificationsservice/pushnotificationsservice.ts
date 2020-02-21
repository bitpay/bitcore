#!/usr/bin/env node
import { PushNotificationsService } from '../lib/pushnotificationsservice';

const config = require('../config');
const log = require('npmlog');
log.debug = log.verbose;
log.level = 'debug';

const pushNotificationsService = new PushNotificationsService();
pushNotificationsService.start(config, err => {
  if (err) throw err;

  log.debug('Push Notification Service started');
});
