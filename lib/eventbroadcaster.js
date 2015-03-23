var log = require('npmlog');
log.debug = log.verbose;
var inherits = require('inherits');
var events = require('events');
var nodeutil = require('util');

function EventBroadcaster() {};

nodeutil.inherits(EventBroadcaster, events.EventEmitter);

EventBroadcaster.prototype.broadcast = function(service, args) {
  this.emit(service, args);
};

var _eventBroadcasterInstance;
EventBroadcaster.singleton = function() {
  if (!_eventBroadcasterInstance) {
    _eventBroadcasterInstance = new EventBroadcaster();
  }
  return _eventBroadcasterInstance;
};

module.exports = EventBroadcaster.singleton();
