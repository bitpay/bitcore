#!/usr/bin/env node
import { PushNotificationsService } from '../lib/pushnotificationsservice';

let log = require('npmlog');
let config = require('../config');

log.debug = log.verbose;
log.level = 'debug';
const pushNotificationsService = new PushNotificationsService();
pushNotificationsService.start(config, (err) => {
  if (err) throw err;

  log.debug('Push Notification Service started');
});
