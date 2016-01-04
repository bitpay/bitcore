#!/usr/bin/env node

'use strict';

var _ = require('lodash');
var log = require('npmlog');
log.debug = log.verbose;

var config = require('../config');
var PushNotificationService = require('../lib/pushnotificationsservice');

var PushNotificationsService = new PushNotificationsService();
PushNotificationsService.start(config, function(err) {
  if (err) throw err;

  console.log('Push Notification Service started');
});
