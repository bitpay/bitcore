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

// WsApp._handleNotification = function(notification) {
//   console.log('*** [wsapp.js ln26] notification:', notification); // TODO

//   io.to(notification.walletId).emit('notification', notification);
// };

WsApp._initMessageQueue = function(cb) {
  function handleNotification(notification) {
    io.to(notification.walletId).emit('notification', notification);
  };

  messageQueue = require('socket.io-client').connect('http://localhost:3380', {
    'force new connection': true,
  });
  messageQueue.on('connect_error', function(err) {
    log.warn('Could not connect to message queue server');
  });
  messageQueue.on('notification', handleNotification);

  messageQueue.on('connect', function() {
    return cb();
  });
};

WsApp.start = function(server, config, cb) {
  io = require('socket.io')(server);

  async.series([

    function(done) {
      WsApp._initMessageQueue(done);
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
