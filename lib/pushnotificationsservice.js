'use strict';

var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var request = require('request');
var MessageBroker = require('./messagebroker');

var PUSHNOTIFICATIONS_TYPES = {
  'NewCopayer': {
    title: "New copayer",
    message: function(notification) {
      return ("Copayer: " + notification.data.copayerName + " has joined!");
    };
  },
  'WalletComplete': {
    title: "Wallet complete",
    message: function(notification) {
      return ("All copayers has joined!");
    };
  },
  'NewTxProposal': {
    title: "New proposal",
    message: function(notification) {
      return ("New transaction proposal created");
    };
  },
  'NewOutgoingTx': {
    title: "New outgoing transaction",
    message: function(notification) {
      return ((notification.data.amount / 100) + " bits");
    };
  },
  'NewIncomingTx': {
    title: "New incoming transaction",
    message: function(notification) {
      return ((notification.data.amount / 100) + " bits");
    };
  },
  'TxProposalFinallyRejected': {
    title: "Rejected",
    message: function(notification) {
      return ("Transaction proposal finally rejected");
    };
  },
};

function PushNotificationsService() {};

PushNotificationsService.prototype.start = function(opts, cb) {

  opts = opts || {};
  var self = this;

  async.parallel([
    function(done) {
      self.messageBroker = opts.messageBroker || new MessageBroker(opts.messageBrokerOpts);
      self.messageBroker.onMessage(_.bind(self.sendPushNotifications, self));
      done();
    },
  ], function(err) {
    if (err) {
      log.error(err);
    }
    return cb(err);
  });
};

PushNotificationsService.prototype.sendPushNotifications = function(notification, cb) {
  log.debug(notification);

  if (!PUSHNOTIFICATIONS_TYPES[notification.type]) return;

  var opts = {};
  opts.users = [notification.walletId];
  opts.android = {
    "data": {
      "title": PUSHNOTIFICATIONS_TYPES[notification.type].title,
      "message": PUSHNOTIFICATIONS_TYPES[notification.type].message(notification)
    }
  };

  var url = 'http://192.168.1.121:8000/send';
  request({
    url: url,
    method: 'POST',
    json: true,
    body: opts
  }, function(error, response, body) {
    log.debug(response.statusCode);
  });
}
};

module.exports = PushNotificationsService;
