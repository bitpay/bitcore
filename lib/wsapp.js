'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var Uuid = require('uuid');

var WalletService = require('./server');
var MessageBroker = require('./messagebroker');
var BlockchainMonitor = require('./blockchainmonitor');

log.level = 'debug';

var io, messageBroker, blockchainMonitor;

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
  $.checkState(opts.messageBrokerOpts);

  io = require('socket.io')(server);

  async.series([

    function(done) {
      messageBroker = new MessageBroker(opts.messageBrokerOpts);
      messageBroker.onMessage(WsApp._handleNotification);
      done();
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
