'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
var express = require('express');
var querystring = require('querystring');
var bodyParser = require('body-parser')
var Uuid = require('uuid');

var WalletService = require('./server');

log.debug = log.verbose;
log.level = 'debug';

var subscriptions = {};

var WsApp = function() {};

WsApp._unauthorized = function() {
  socket.emit('unauthorized');
  socket.disconnect();
};

WsApp.subscribeAddresses = function(walletId, addresses) {
  console.log('*** [wsapp.js ln27] subscribing:', addresses, walletId); // TODO

  _.each([].concat(addresses), function(address) {
    subscriptions[address] = walletId;
  });
};

WsApp.subscribeWallet = function(serviceInstance) {
  // TODO: optimize!
  serviceInstance.getMainAddresses({}, function(err, addresses) {
    if (err) {
      log.warn('Could not subscribe to addresses for wallet ' + serviceInstance.walletId);
      return;
    }
    WsApp.subscribeAddress(_.pluck(addresses, 'address'), serviceInstance.walletId);
  });
};

WsApp.start = function(server) {
  var self = this;

  var io = require('socket.io')(server);

  WalletService.onNotification(function(serviceInstance, args) {
    var walletId = serviceInstance.walletId || args.walletId;
    if (!walletId) return;

    if (args.type == 'NewAddress') {
      WsApp.subscribeAddress(walletId, args.address);
    }
    io.to(walletId).emit('notification', args);
  });

  io.on('connection', function(socket) {
    socket.nonce = Uuid.v4();
    socket.emit('challenge', socket.nonce);

    socket.on('authorize', function(data) {
      if (data.message != socket.nonce) return WsApp.unauthorized();

      WalletService.getInstanceWithAuth(data, function(err, res) {
        if (err) return WsApp.unauthorized();

        socket.join(res.walletId);
        socket.emit('authorized');

        WsApp.subscribeWallet(res);
      });
    });
  });
};

module.exports = WsApp;
