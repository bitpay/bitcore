'use strict';

var log = require('npmlog');
log.debug = log.verbose;
var inherits = require('inherits');
var events = require('events');
var nodeutil = require('util');

function NotificationBroadcaster() {};

nodeutil.inherits(NotificationBroadcaster, events.EventEmitter);

NotificationBroadcaster.prototype.broadcast = function(eventName, notification, walletService) {
  this.emit(eventName, notification, walletService);
};

var _instance;
NotificationBroadcaster.singleton = function() {
  if (!_instance) {
    _instance = new NotificationBroadcaster();
  }
  return _instance;
};

module.exports = NotificationBroadcaster.singleton();
