'use strict';

import { EventEmitter } from 'events';
var log = require('npmlog');
log.debug = log.verbose;
var inherits = require('inherits');
var events = require('events');
var nodeutil = require('util');
var _instance;

export class NotificationBroadcaster extends EventEmitter {
  broadcast(eventName, notification, walletService) {
    this.emit(eventName, notification, walletService);
  }
  static singleton() {
    if (!_instance) {
      _instance = new NotificationBroadcaster();
    }
    return _instance;
  }
}

module.exports = NotificationBroadcaster.singleton();
