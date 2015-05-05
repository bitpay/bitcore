'use strict';

var $ = require('preconditions').singleton();
var io = require('socket.io');
var log = require('npmlog');
log.debug = log.verbose;

var MessageQueue = function() {};

MessageQueue.start = function(opts, cb) {
  opts = opts || {};
  $.checkIsNumber(opts.port, 'Invalid port number');

  var server = io(opts.port);
  server.on('connection', function(socket) {
    socket.on('notification', function(data) {
      server.emit('notification', data);
    });
  });
  return cb();
};

module.exports = MessageQueue;
