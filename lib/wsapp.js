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

WsApp.start = function(server) {
  var self = this;

  var io = require('socket.io')(server);

  WalletService.onNotification(function(serviceInstance, args) {
    io.to(serviceInstance.walletId).emit('notification', args);
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
      });
    });
  });
};

module.exports = WsApp;
