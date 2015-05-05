'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var Uuid = require('uuid');

var WalletService = require('./server');

var Notification = require('./model/notification');

log.level = 'debug';

var io, messageQueue;

var WsApp = function() {};

WsApp._unauthorized = function(socket) {
  socket.emit('unauthorized');
  socket.disconnect();
};

WsApp._handleNotification = function(notification) {
  io.to(notification.walletId).emit('notification', notification);
};

WsApp.start = function(server, opts, cb) {
  opts = opts || {};
  $.checkState(opts.messageQueueOpts);

  io = require('socket.io')(server);

  async.series([

    function(done) {
      messageQueue = require('socket.io-client').connect(opts.messageQueueOpts.url, {
        'force new connection': true,
      });
      messageQueue.on('connect_error', function(err) {
        log.warn('Could not connect to message queue server');
      });
      messageQueue.on('notification', WsApp._handleNotification);

      messageQueue.on('connect', function() {
        done();
      });
    },
    function(done) {
      io.on('connection', function(socket) {
        socket.nonce = Uuid.v4();
        socket.on('authorize', function(data) {
          if (data.message != socket.nonce) return WsApp._unauthorized(socket);

          WalletService.getInstanceWithAuth(data, function(err, service) {
            if (err) return WsApp._unauthorized(socket);

            socket.join(service.walletId);
            socket.emit('authorized');
          });
        });

        socket.emit('challenge', socket.nonce);
        done();
      });
    },
  ], function(err) {
    if (cb) return cb(err);
  });
};

module.exports = WsApp;
