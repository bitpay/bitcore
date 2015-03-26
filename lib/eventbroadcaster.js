'use strict';

var log = require('npmlog');
log.debug = log.verbose;
var inherits = require('inherits');
var events = require('events');
var nodeutil = require('util');

function EventBroadcaster() {};

nodeutil.inherits(EventBroadcaster, events.EventEmitter);

EventBroadcaster.prototype.broadcast = function(eventName, serviceInstance, args) {
  this.emit(eventName, serviceInstance, args);
};

var _eventBroadcasterInstance;
EventBroadcaster.singleton = function() {
  if (!_eventBroadcasterInstance) {
    _eventBroadcasterInstance = new EventBroadcaster();
  }
  return _eventBroadcasterInstance;
};

module.exports = EventBroadcaster.singleton();
