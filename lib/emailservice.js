'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var fs = require('fs');
var nodemailer = require('nodemailer');

var Model = require('./model');

var EMAIL_TYPES = {
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


function EmailService(opts) {
  this.storage = opts.storage;
  this.lock = opts.lock;
  this.mailer = opts.mailer || nodemailer.createTransport(opts.email);
  $.checkState(this.mailer);
};

// TODO: cache for X minutes
EmailService.prototype._readTemplate = function(filename, cb) {
  fs.readFile(__dirname + '/templates/' + filename + '.plain', 'utf8', function(err, template) {
    if (err) {
      log.error('Could not read template file ' + filename, err);
      return cb(err);
    }
    var lines = template.split('\n');
    return cb(null, {
      subject: _.template(lines[0]),
      body: _.template(_.rest(lines).join('\n')),
    });
  });
};

EmailService.prototype._applyTemplate = function(template, data, cb) {
  var result = _.mapValues(template, function(t) {
    try {
      return t(data);
    } catch (e) {
      log.error('Could not apply data to template', e);
      return cb(e);
    }
  });
  return cb(null, result);
};

EmailService.prototype._getEmailAddresses = function(walletId, cb) {
  self.storage.fetchPreferences(walletId, null, function(err, preferences) {
    if (err) return cb(err);
    if (_.isEmpty(preferences)) return cb(null, {});

    var addressesByCopayer = _.reduce(preferences, function(memo, p) {
      if (p.email) {
        memo[p.copayerId] = p.email;
      }
      return memo;
    }, {});

    return cb(null, addressesByCopayer);
  });
};

EmailService.prototype._send = function(email, cb) {
  var self = this;

  var mailOptions = {
    from: email.from,
    to: email.to,
    subject: email.subject,
    text: email.body,
  };
  self.mailer.sendMail(mailOptions, function(err, result) {
    if (err) {
      log.error('An error occurred when trying to send email to ' + email.to, err);
      return cb(err);
    }
    log.debug('Message sent: ', result || '');
    return cb(err, result);
  });
};

EmailService.prototype._generateFromNotification = function(notification, cb) {
  var self = this;

  var emailType = EMAIL_TYPES[notification.type];
  if (!emailType) return cb();

  var emailByCopayer;

  async.waterfall([

    function(next) {
      self._getEmailAddresses(notification.walletId, next);
    },
    function(emailAddresses, next) {
      if (_.isEmpty(emailAddresses)) return cb();
      emailByCopayer = emailAddresses;
      self._readTemplate(emailType.filename, next);
    },
    function(template, next) {
      self._applyTemplate(template, notification.data, next);
    },
    function(content, next) {
      _.each(emailByCopayer, function(address, copayerId) {
        var email = Model.Email.create({
          walletId: notification.walletId,
          copayerId: copayerId,
          to: address,
          subject: content.subject,
          body: content.body,
        });
        self.storage.storeEmail(email, function(err) {
          return next(err, email);
        });
      });
    },
    function(email, next) {
      self._send(email, next);
    },
  ], cb);

  return cb();
};

module.exports = EmailService;
