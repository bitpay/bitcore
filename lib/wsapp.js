'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var Uuid = require('uuid');

var WalletService = require('./server');
var MessageBroker = require('./messagebroker');

log.level = 'debug';

var WsApp = function() {};

WsApp.prototype._unauthorized = function(socket) {
  socket.emit('unauthorized');
  socket.disconnect();
};

WsApp.prototype._handleNotification = function(notification) {
  this.io.to(notification.walletId).emit('notification', notification);
};

WsApp.prototype.start = function(server, opts, cb) {
  opts = opts || {};
  $.checkState(opts.messageBrokerOpts);

  var self = this;

  this.io = require('socket.io')(server);

  async.series([

    function(done) {
      self.messageBroker = new MessageBroker(opts.messageBrokerOpts);
      self.messageBroker.onMessage(_.bind(self._handleNotification, self));
      done();
    },
    function(done) {
      self.io.on('connection', function(socket) {
        socket.nonce = Uuid.v4();
        socket.on('authorize', function(data) {
          if (data.message != socket.nonce) return self._unauthorized(socket);

          WalletService.getInstanceWithAuth(data, function(err, service) {
            if (err) return self._unauthorized(socket);

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
