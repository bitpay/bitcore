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

WsApp.start = function(server) {
  var self = this;

  var io = require('socket.io')(server);

  WalletService.onNotification(function(serviceInstance, args) {
    var walletId = serviceInstance.walletId;
    var copayerId = serviceInstance.copayerId;

    io.to(walletId).emit('notification', args);
  });


  io.on('connection', function(socket) {
    socket.nonce = Uuid.v4();
    socket.emit('challenge', socket.nonce);

    socket.on('authorize', function(data) {
      if (data.message != socket.nonce) {
        socket.emit('unauthorized');
        socket.disconnect();
        return;
      }
      WalletService.getInstanceWithAuth(data, function(err, res) {
        var room = res.walletId;
        if (err) {
          socket.emit('unauthorized');
          socket.disconnect();
          return;
        }
        socket.join(room);
        socket.emit('authorized');
      });
    });
  });
};

module.exports = WsApp;
