'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
var express = require('express');
var querystring = require('querystring');
var bodyParser = require('body-parser')
var Uuid = require('uuid');

var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var WalletService = require('./server');
var BlockExplorer = require('./blockexplorer');

var Notification = require('./model/notification');

log.debug = log.verbose;
log.level = 'debug';

var io;
var blockExplorerSockets = {};
var subscriptions = {};

var WsApp = function() {};

WsApp._unauthorized = function() {
  socket.emit('unauthorized');
  socket.disconnect();
};

WsApp.subscribeAddresses = function(walletId, addresses) {
  $.checkArgument(walletId);

  if (!addresses || addresses.length == 0) return;

  function handlerFor(address, txid) {
    var notification = Notification.create({
      walletId: this,
      type: 'NewIncomingTx',
      data: {
        address: address,
        txid: txid,
      },
    });
    WsApp._sendNotification(notification);
  };

  if (!subscriptions[walletId]) {
    subscriptions[walletId] = {
      addresses: [],
    };
  };
  var addresses = [].concat(addresses);
  var network = Bitcore.Address.fromString(addresses[0]).network;
  var socket = blockExplorerSockets[network];
  _.each(addresses, function(address) {
    subscriptions[walletId].addresses.push(address);
    socket.emit('subscribe', address);
    socket.on(address, _.bind(handlerFor, walletId, address));
  });
};

WsApp.subscribeWallet = function(serviceInstance) {
  var walletId = serviceInstance.walletId;
  if (subscriptions[walletId]) return;

  serviceInstance.getMainAddresses({}, function(err, addresses) {
    if (err) {
      delete subscriptions[walletId];
      log.warn('Could not subscribe to addresses for wallet ' + serviceInstance.walletId);
      return;
    }
    WsApp.subscribeAddresses(serviceInstance.walletId, _.pluck(addresses, 'address'));
  });
};

WsApp._sendNotification = function(notification) {
  if (notification.type == 'NewAddress') {
    WsApp.subscribeAddresses(notification.walletId, notification.data.address);
  }
  io.to(notification.walletId).emit('notification', notification);
};

WsApp._initBlockExplorerSocket = function(provider, network) {
  var explorer = new BlockExplorer({
    provider: provider,
    network: network,
  });

  blockExplorerSockets[network] = explorer.initSocket();
};

WsApp.start = function(server) {
  io = require('socket.io')(server);

  WsApp._initBlockExplorerSocket('insight', 'testnet');
  WsApp._initBlockExplorerSocket('insight', 'livenet');

  WalletService.onNotification(function(serviceInstance, notification) {
    if (!notification.walletId) return;

    WsApp._sendNotification(notification);
  });

  io.on('connection', function(socket) {
    socket.nonce = Uuid.v4();
    socket.emit('challenge', socket.nonce);

    socket.on('authorize', function(data) {
      if (data.message != socket.nonce) return WsApp.unauthorized();

      WalletService.getInstanceWithAuth(data, function(err, service) {
        if (err) return WsApp.unauthorized();

        socket.join(service.walletId);
        socket.emit('authorized');

        WsApp.subscribeWallet(service);
      });
    });
  });
};

module.exports = WsApp;
