'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var async = require('async');
var Mustache = require('mustache');
var log = require('npmlog');
log.debug = log.verbose;
var fs = require('fs');
var path = require('path');
var nodemailer = require('nodemailer');
var request = require('request');

var Utils = require('./common/utils');
var Storage = require('./storage');
var MessageBroker = require('./messagebroker');
var Lock = require('./lock');
var BlockchainExplorer = require('./blockchainexplorer');

var Model = require('./model');

var PUSHNOTIFICATION_TYPES = {
  'NewCopayer': {
    filename: 'new_copayer',
    notifyDoer: false,
  },
  'WalletComplete': {
    filename: 'wallet_complete',
    notifyDoer: true,
  },
  'NewTxProposal': {
    filename: 'new_tx_proposal',
    notifyDoer: false,
  },
  'NewOutgoingTx': {
    filename: 'new_outgoing_tx',
    notifyDoer: true,
  },
  'NewIncomingTx': {
    filename: 'new_incoming_tx',
    notifyDoer: true,
  },
  'TxProposalFinallyRejected': {
    filename: 'txp_finally_rejected',
    notifyDoer: false,
  },
};

function PushNotificationService() {};

PushNotificationService.prototype.start = function(opts, cb) {
  var self = this;
  async.parallel([
    function(done) {
      self.messageBroker = opts.messageBroker || new MessageBroker(opts.messageBrokerOpts);
      self.messageBroker.onMessage(_.bind(self.sendPushNotification, self));
      done();
    },
  ], function(err) {
    if (err) {
      log.error(err);
    }
    return cb(err);
  });
};

PushNotificationService.prototype.sendPushNotification = function(notification, cb) {
  console.log(notification);
  if (PUSHNOTIFICATION_TYPES[notification.type] == notification.type) {

    if (notification.type == 'NewIncomingTx') {
      var opts = {};
      opts.users = [notification.walletId];
      opts.android = {
        "collapseKey": "optional",
        "data": {
          "title": "New incoming transaction",
          "message": notification.data.amount + " bits"
        }
      };
    }
    if (notification.type == 'NewOutgoingTx') {
      var opts = {};
      opts.users = [notification.walletId];
      opts.android = {
        "collapseKey": "optional",
        "data": {
          "title": "New outgoing transaction",
          "message": notification.data.amount + " bits"
        }
      };
    }
    if (notification.type == 'NewCopayer') {
      var opts = {};
      opts.users = [notification.walletId];
      opts.android = {
        "collapseKey": "optional",
        "data": {
          "title": "New copayer",
          "message": "Copayer: " + notification.data.copayerName + " has joined"
        }
      };
    }
    // if (notification.type == 'WalletComplete') {
    //   var opts = {};
    //   opts.users = [notification.walletId];
    //   opts.android = {
    //     "collapseKey": "optional",
    //     "data": {
    //       "title": "Wallet complete",
    //       "message": "Wallet complete"
    //     }
    //   };
    // }
    if (notification.type == '  NewTxProposal') {
      var opts = {};
      opts.users = [notification.walletId];
      opts.android = {
        "collapseKey": "optional",
        "data": {
          "title": "New proposal"
          "message": "New transaction proposal created"
        }
      };
    }
    if (notification.type == 'TxProposalFinallyRejected') {
      var opts = {};
      opts.users = [notification.walletId];
      opts.android = {
        "collapseKey": "optional",
        "data": {
          "title": "Rejected"
          "message": "Transaction proposal finally rejected"
        }
      };
    }
    if (notification.type == '  TxProposalAcceptedBy') {
      var opts = {};
      opts.users = [notification.walletId];
      opts.android = {
        "collapseKey": "optional",
        "data": {
          "title": "Accepted"
          "message": "Transaction proposal accepted"
        }
      };
    }
    var url = 'http://192.168.1.126:8000/send';
    request({
      url: url,
      method: 'POST',
      json: true,
      body: opts
    }, function(error, response, body) {
      console.log(error);
      console.log(response.statusCode);
    });
  }
};

module.exports = PushNotificationService;
