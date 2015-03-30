'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var Uuid = require('uuid');

var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var WalletService = require('./server');
var BlockchainMonitor = require('./blockchainmonitor')

var Notification = require('./model/notification');

log.level = 'debug';

var io, bcMonitor;

var WsApp = function() {};

WsApp._unauthorized = function() {
  socket.emit('unauthorized');
  socket.disconnect();
};

WsApp.handleNotification = function(service, notification) {
  if (notification.type == 'NewAddress') {
    self.subscribeAddresses(notification.walletId, notification.data.address);
  }
  io.to(notification.walletId).emit('notification', notification);
};

WsApp.start = function(server) {
  io = require('socket.io')(server);

  bcMonitor = new BlockchainMonitor();

  function handleNotification(notification) {
    if (notification.type == 'NewAddress') {
      bcMonitor.subscribeAddresses(notification.walletId, notification.data.address);
    }
    io.to(notification.walletId).emit('notification', notification);
  };

  bcMonitor.on('notification', handleNotification);
  WalletService.onNotification(handleNotification);

  io.on('connection', function(socket) {
    socket.nonce = Uuid.v4();
    socket.emit('challenge', socket.nonce);

    socket.on('authorize', function(data) {
      if (data.message != socket.nonce) return WsApp.unauthorized();

      WalletService.getInstanceWithAuth(data, function(err, service) {
        if (err) return WsApp.unauthorized();

        socket.join(service.walletId);
        socket.emit('authorized');

        bcMonitor.subscribeWallet(service);
      });
    });
  });
};

module.exports = WsApp;
