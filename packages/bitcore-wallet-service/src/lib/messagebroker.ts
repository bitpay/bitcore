var $ = require('preconditions').singleton();
var _ = require('lodash');
var inherits = require('inherits');
var events = require('events');
var nodeutil = require('util');
var log = require('npmlog');
log.debug = log.verbose;
log.disableColor();

function MessageBroker(opts) {
  var self = this;

  opts = opts || {};
  if (opts.messageBrokerServer) {
    var url = opts.messageBrokerServer.url;

    this.remote = true;
    this.mq = require('socket.io-client').connect(url);
    this.mq.on('connect', function() {});
    this.mq.on('connect_error', function() {
      log.warn('Error connecting to message broker server @ ' + url);
    });

    this.mq.on('msg', function(data) {
      self.emit('msg', data);
    });

    log.info('Using message broker server at ' + url);
  }
};

nodeutil.inherits(MessageBroker, events.EventEmitter);

MessageBroker.prototype.send = function(data) {
  if (this.remote) {
    this.mq.emit('msg', data);
  } else {
    this.emit('msg', data);
  }
};

MessageBroker.prototype.onMessage = function(handler) {
  this.on('msg', handler);
};

module.exports = MessageBroker;
