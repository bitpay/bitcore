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

EmailService.prototype._getRecipientsList = function(notification, emailType, cb) {
  var self = this;

  self.storage.fetchPreferences(notification.walletId, null, function(err, preferences) {
    if (err) return cb(err);
    if (_.isEmpty(preferences)) return cb(null, []);

    var recipients = _.compact(_.map(preferences, function(p) {
      if (!p.email) return;
      if (notification.creatorId == p.copayerId && !emailType.notifyDoer) return;
      return {
        copayerId: p.copayerId,
        emailAddress: p.email
      };
    }));

    return cb(null, recipients);
  });
};

EmailService.prototype._getDataForTemplate = function(notification, cb) {
  var self = this;

  var data = _.cloneDeep(notification.data);
  self.storage.fetchWallet(notification.walletId, function(err, wallet) {
    if (err) return cb(err);
    data.walletId = wallet.id;
    data.walletName = wallet.name;
    data.walletM = wallet.m;
    data.walletN = wallet.n;
    var copayer = _.find(wallet.copayers, {
      copayerId: notification.creatorId
    });
    if (copayer) {
      data.creatorId = copayer.id;
      data.creatorName = copayer.name;
    }
    return cb(null, data);
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

EmailService.prototype.sendEmail = function(notification, cb) {
  var self = this;

  var emailType = EMAIL_TYPES[notification.type];
  if (!emailType) return cb();

  var recipientsList;

  async.waterfall([

    function(next) {
      self._getRecipientsList(notification, emailType, function(err, list) {
        if (_.isEmpty(list)) return cb();
        recipientsList = list;
        next();
      });
    },
    function(next) {
      async.parallel([

        function(next) {
          self._readTemplate(emailType.filename, next);
        },
        function(next) {
          self._getDataForTemplate(notification, next);
        },
      ], function(err, res) {
        next(err, res[0], res[1]);
      });
    },
    function(template, data, next) {
      self._applyTemplate(template, data, next);
    },
    function(content, next) {
      async.map(recipientsList, function(recipient, next) {
        var email = Model.Email.create({
          walletId: notification.walletId,
          copayerId: recipient.copayerId,
          to: recipient.emailAddress,
          subject: content.subject,
          body: content.body,
        });
        self.storage.storeEmail(email, function(err) {
          return next(err, email);
        });
      }, next);
    },
    function(emails, next) {
      async.each(emails, function(email, next) {
        self._send(email, next);
      }, next);
    },
  ], cb);
};

module.exports = EmailService;
