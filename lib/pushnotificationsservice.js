'use strict';

var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var request = require('request');
var MessageBroker = require('./messagebroker');
var Storage = require('./storage');

var PUSHNOTIFICATIONS_TYPES = {
  'NewCopayer': {
    title: "New copayer",
    message: function(notification) {
      return ("Copayer: " + notification.data.copayerName + " has joined!");
    }
  },
  'WalletComplete': {
    title: "Wallet complete",
    message: function(notification) {
      return ("All copayers has joined!");
    }
  },
  'NewTxProposal': {
    title: "New proposal",
    message: function(notification) {
      return ("New transaction proposal created");
    }
  },
  'NewOutgoingTx': {
    title: "New outgoing transaction",
    message: function(notification) {
      return ((notification.data.amount / 100) + " bits");
    }
  },
  'NewIncomingTx': {
    title: "New incoming transaction",
    message: function(notification) {
      return ((notification.data.amount / 100) + " bits");
    }
  },
  'TxProposalFinallyRejected': {
    title: "Rejected",
    message: function(notification) {
      return ("Transaction proposal finally rejected");
    }
  }
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
    function(done) {
      self.storage = new Storage();
      self.storage.connect(opts.storageOpts, done);
    },
  ], function(err) {
    if (err) {
      log.error(err);
    }
    return cb(err);
  });
};

PushNotificationsService.prototype.sendPushNotifications = function(notification, cb) {
  var self = this;
  cb = cb || function() {};
  if (!PUSHNOTIFICATIONS_TYPES[notification.type]) return cb();

  console.log(notification);

  self.storage.fetchWallet(notification.walletId, function(err, wallet) {
    if (err) return cb(err);

    var copayers = _.reject(wallet.copayers, {
      id: notification.creatorId
    });

    var url = 'http://192.168.1.121:8000/send';
    var opts = {};

    async.each(copayers,
      function(c, next) {
        opts.users = [notification.walletId + '$' + c.id];
        opts.android = {
          "data": {
            "title": PUSHNOTIFICATIONS_TYPES[notification.type].title,
            "message": PUSHNOTIFICATIONS_TYPES[notification.type].message(notification)
          }
        };

        request({
          url: url,
          method: 'POST',
          json: true,
          body: opts
        }, function(error, response, body) {
          console.log(response.statusCode);
          next();
        });
      },
      function(err) {
        log.error(err);
        return cb(err);
      }
    );
  });
};

module.exports = PushNotificationsService;
