#!/usr/bin/env node
import { PushNotificationsService } from "../lib/pushnotificationsservice";

var log = require('npmlog');
log.debug = log.verbose;
log.level = 'debug';

var config = require('../config');

var pushNotificationsService = new PushNotificationsService();
pushNotificationsService.start(config, function(err) {
  if (err) throw err;

  log.debug('Push Notification Service started');
});
