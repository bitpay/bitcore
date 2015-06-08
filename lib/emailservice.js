'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var async = require('async');
var Mustache = require('mustache');
var log = require('npmlog');
log.debug = log.verbose;
var fs = require('fs');
var nodemailer = require('nodemailer');

var WalletUtils = require('bitcore-wallet-utils');
var Storage = require('./storage');
var MessageBroker = require('./messagebroker');
var Lock = require('./lock');

var Model = require('./model');

var EMAIL_TYPES = {
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


function EmailService() {};

EmailService.prototype.start = function(opts, cb) {
  opts = opts || {};

  var self = this;

  async.parallel([

    function(done) {
      if (opts.storage) {
        self.storage = opts.storage;
        done();
      } else {
        self.storage = new Storage();
        self.storage.connect(opts.storageOpts, done);
      }
    },
    function(done) {
      if (opts.messageBroker) {
        self.messageBroker = opts.messageBroker;
      } else {
        self.messageBroker = new MessageBroker(opts.messageBrokerOpts);
      }
      self.messageBroker.onMessage(_.bind(self.sendEmail, self));
      done();
    },
    function(done) {
      self.lock = opts.lock || new Lock(opts.lockOpts);
      done();
    },
    function(done) {
      self.mailer = opts.mailer || nodemailer.createTransport(opts.emailOpts);
      self.subjectPrefix = opts.emailOpts.subjectPrefix || '[Wallet service]';
      self.from = opts.emailOpts.from;
      done();
    },
  ], function(err) {
    if (err) {
      log.error(err);
    }
    return cb(err);
  });
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
      subject: lines[0],
      body: _.rest(lines).join('\n'),
    });
  });
};

EmailService.prototype._applyTemplate = function(template, data, cb) {
  var result = _.mapValues(template, function(t) {
    try {
      return Mustache.render(t, data);
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
  data.subjectPrefix = _.trim(self.subjectPrefix) + ' ';
  if (data.amount) {
    data.amount = WalletUtils.formatAmount(+data.amount, 'bit') + ' bits';
  }
  self.storage.fetchWallet(notification.walletId, function(err, wallet) {
    if (err) return cb(err);
    data.walletId = wallet.id;
    data.walletName = wallet.name;
    data.walletM = wallet.m;
    data.walletN = wallet.n;
    var copayer = _.find(wallet.copayers, {
      id: notification.creatorId
    });
    if (copayer) {
      data.copayerId = copayer.id;
      data.copayerName = copayer.name;
    }

    if (notification.type == 'TxProposalFinallyRejected' && data.rejectedBy) {
      var rejectors = _.map(data.rejectedBy, function(copayerId) {
        return _.find(wallet.copayers, {
          id: copayerId
        }).name
      });
      data.rejectorsNames = rejectors.join(', ');
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

  cb = cb || function() {};

  var emailType = EMAIL_TYPES[notification.type];
  if (!emailType) return cb();

  self._getRecipientsList(notification, emailType, function(err, recipientsList) {
    if (_.isEmpty(recipientsList)) return cb();

    async.waterfall([

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
            from: self.from,
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
          self._send(email, function(err) {
            if (err) {
              email.setFail();
            } else {
              email.setSent();
            }
            self.storage.storeEmail(email, next);
          });
        }, function(err) {
          return next();
        });
      },
    ], function(err) {
      if (err) {
        log.error('An error ocurred generating email notification', err);
      }
      return cb(err);
    });
  });
};

module.exports = EmailService;
