'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var fs = require('fs');

var Model = require('./model');

var EMAIL_TYPES = {
  'NewTxProposal': {
    filename: 'new_tx_proposal',
    notifyCreator: false,
    notifyDoer: false,
  },
  'NewOutgoingTx': {
    filename: 'new_outgoing_tx',
    notifyCreator: true,
    notifyDoer: true,
  },
  'NewIncomingTx': {
    filename: 'new_incoming_tx',
    notifyCreator: true,
    notifyDoer: true,
  },
  'TxProposalFinallyRejected': {
    filename: 'txp_finally_rejected',
    notifyCreator: true,
    notifyDoer: false,
  },
};


function EmailService(opts) {
  this.storage = opts.storage;
  this.lock = opts.lock;
};

EmailService.prototype._readTemplate = function(filename, cb) {
  fs.readFile(__dirname + '/templates/' + filename + '.plain', 'utf8', function(err, template) {
    var lines = template.split('\n');
    return cb(null, {
      subject: _.template(lines[0]),
      body: _.template(_.rest(lines).join('\n')),
    });
  });
};

EmailService.prototype._applyTemplate = function(template, data, cb) {
  var result = _.mapValues(template, function(t) {
    // TODO: If this throws exception, log and abort email generation
    return t(data);
  });
  return cb(null, result);
};

EmailService.prototype._generateFromNotification = function(notification, cb) {
  var self = this;

  var emailType = EMAIL_TYPES[notification.type];
  if (!emailType) return cb();

  self.storage.fetchPreferences(notification.walletId, null, function(err, preferences) {
    if (_.isEmpty(preferences)) return cb();

    var addressesByCopayer = _.reduce(preferences, function(memo, p) {
      if (p.email) {
        memo[p.copayerId] = p.email;
      }
      return memo;
    }, {});

    if (_.isEmpty(addressesByCopayer)) return cb();

    self._readTemplate(emailType.filename, function(err, template) {
      if (err) return cb(err);

      self._applyTemplate(template, notification.data, function(err, content) {
        if (err) return cb(err);

        _.each(addressesByCopayer, function(emailAddress, copayerId) {
          var email = Model.Email.create({
            walletId: notification.walletId,
            copayerId: copayerId,
            to: emailAddress,
            subject: content.subject,
            body: content.body,
          });
          self.storage.storeEmail(email, function(err) {
            return cb(err);
          });
        });
      });
    });
  });

  return cb();
};

EmailService.prototype._send = function(cb) {
  var self = this;

  this.lock.runLocked('emails', cb, function() {
    //self._fetchUnsentEmails();

  });
};

module.exports = EmailService;
