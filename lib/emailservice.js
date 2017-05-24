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

var Utils = require('./common/utils');
var Storage = require('./storage');
var MessageBroker = require('./messagebroker');
var Lock = require('./lock');

var Model = require('./model');

var EMAIL_TYPES = {
  'NewCopayer': {
    filename: 'new_copayer',
    notifyDoer: false,
    notifyOthers: true,
  },
  'WalletComplete': {
    filename: 'wallet_complete',
    notifyDoer: true,
    notifyOthers: true,
  },
  'NewTxProposal': {
    filename: 'new_tx_proposal',
    notifyDoer: false,
    notifyOthers: true,
  },
  'NewOutgoingTx': {
    filename: 'new_outgoing_tx',
    notifyDoer: true,
    notifyOthers: true,
  },
  'NewIncomingTx': {
    filename: 'new_incoming_tx',
    notifyDoer: true,
    notifyOthers: true,
  },
  'TxProposalFinallyRejected': {
    filename: 'txp_finally_rejected',
    notifyDoer: false,
    notifyOthers: true,
  },
  'TxConfirmation': {
    filename: 'tx_confirmation',
    notifyDoer: true,
    notifyOthers: false,
  },
};


function EmailService() {};

EmailService.prototype.start = function(opts, cb) {
  opts = opts || {};

  function _readDirectories(basePath, cb) {
    fs.readdir(basePath, function(err, files) {
      if (err) return cb(err);
      async.filter(files, function(file, next) {
        fs.stat(path.join(basePath, file), function(err, stats) {
          return next(!err && stats.isDirectory());
        });
      }, function(dirs) {
        return cb(null, dirs);
      });
    });
  };

  var self = this;

  self.defaultLanguage = opts.emailOpts.defaultLanguage || 'en';
  self.defaultUnit = opts.emailOpts.defaultUnit || 'btc';
  self.templatePath = path.normalize((opts.emailOpts.templatePath || (__dirname + '/templates')) + '/');
  self.publicTxUrlTemplate = opts.emailOpts.publicTxUrlTemplate || {};
  self.subjectPrefix = opts.emailOpts.subjectPrefix || '[Wallet service]';
  self.from = opts.emailOpts.from;

  async.parallel([

    function(done) {
      _readDirectories(self.templatePath, function(err, res) {
        self.availableLanguages = res;
        done(err);
      });
    },
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
      self.messageBroker = opts.messageBroker || new MessageBroker(opts.messageBrokerOpts);
      self.messageBroker.onMessage(_.bind(self.sendEmail, self));
      done();
    },
    function(done) {
      self.lock = opts.lock || new Lock(opts.lockOpts);
      done();
    },
    function(done) {
      self.mailer = opts.mailer || nodemailer.createTransport(opts.emailOpts);
      done();
    },
  ], function(err) {
    if (err) {
      log.error(err);
    }
    return cb(err);
  });
};

EmailService.prototype._compileTemplate = function(template, extension) {
  var lines = template.split('\n');
  if (extension == '.html') {
    lines.unshift('');
  }
  return {
    subject: lines[0],
    body: _.rest(lines).join('\n'),
  };
};

EmailService.prototype._readTemplateFile = function(language, filename, cb) {
  var self = this;

  var fullFilename = path.join(self.templatePath, language, filename);
  fs.readFile(fullFilename, 'utf8', function(err, template) {
    if (err) {
      return cb(new Error('Could not read template file ' + fullFilename, err));
    }
    return cb(null, template);
  });
};

// TODO: cache for X minutes
EmailService.prototype._loadTemplate = function(emailType, recipient, extension, cb) {
  var self = this;

  self._readTemplateFile(recipient.language, emailType.filename + extension, function(err, template) {
    if (err) return cb(err);
    return cb(null, self._compileTemplate(template, extension));
  });
};

EmailService.prototype._applyTemplate = function(template, data, cb) {
  if (!data) return cb(new Error('Could not apply template to empty data'));

  var error;
  var result = _.mapValues(template, function(t) {
    try {
      return Mustache.render(t, data);
    } catch (e) {
      log.error('Could not apply data to template', e);
      error = e;
    }
  });
  if (error) return cb(error);
  return cb(null, result);
};

EmailService.prototype._getRecipientsList = function(notification, emailType, cb) {
  var self = this;

  self.storage.fetchPreferences(notification.walletId, null, function(err, preferences) {
    if (err) return cb(err);
    if (_.isEmpty(preferences)) return cb(null, []);

    var usedEmails = {};
    var recipients = _.compact(_.map(preferences, function(p) {
      if (!p.email || usedEmails[p.email]) return;

      usedEmails[p.email] = true;
      if (notification.creatorId == p.copayerId && !emailType.notifyDoer) return;
      if (notification.creatorId != p.copayerId && !emailType.notifyOthers) return;
      if (!_.contains(self.availableLanguages, p.language)) {
        if (p.language) {
          log.warn('Language for email "' + p.language + '" not available.');
        }
        p.language = self.defaultLanguage;
      }

      return {
        copayerId: p.copayerId,
        emailAddress: p.email,
        language: p.language,
        unit: p.unit || self.defaultUnit,
      };
    }));

    return cb(null, recipients);
  });
};

EmailService.prototype._getDataForTemplate = function(notification, recipient, cb) {
  var self = this;

  // TODO: Declare these in BWU
  var UNIT_LABELS = {
    btc: 'BTC',
    bit: 'bits'
  };

  var data = _.cloneDeep(notification.data);
  data.subjectPrefix = _.trim(self.subjectPrefix) + ' ';
  if (data.amount) {
    try {
      var unit = recipient.unit.toLowerCase();
      data.amount = Utils.formatAmount(+data.amount, unit) + ' ' + UNIT_LABELS[unit];
    } catch (ex) {
      return cb(new Error('Could not format amount', ex));
    }
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

    if (_.contains(['NewIncomingTx', 'NewOutgoingTx'], notification.type) && data.txid) {
      var urlTemplate = self.publicTxUrlTemplate[wallet.network];
      if (urlTemplate) {
        try {
          data.urlForTx = Mustache.render(urlTemplate, data);
        } catch (ex) {
          log.warn('Could not render public url for tx', ex);
        }
      }
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
    text: email.bodyPlain,
  };
  if (email.bodyHtml) {
    mailOptions.html = email.bodyHtml;
  }
  self.mailer.sendMail(mailOptions, function(err, result) {
    if (err) {
      log.error('An error occurred when trying to send email to ' + email.to, err);
      return cb(err);
    }
    log.debug('Message sent: ', result || '');
    return cb(err, result);
  });
};


EmailService.prototype._readAndApplyTemplates = function(notification, emailType, recipientsList, cb) {
  var self = this;

  async.map(recipientsList, function(recipient, next) {
    async.waterfall([

      function(next) {
        self._getDataForTemplate(notification, recipient, next);
      },
      function(data, next) {
        async.map(['plain', 'html'], function(type, next) {
          self._loadTemplate(emailType, recipient, '.' + type, function(err, template) {
            if (err && type == 'html') return next();
            if (err) return next(err);
            self._applyTemplate(template, data, function(err, res) {
              return next(err, [type, res]);
            });
          });
        }, function(err, res) {
          return next(err, _.zipObject(res));
        });
      },
      function(result, next) {
        next(null, result);
      },
    ], function(err, res) {
      next(err, [recipient.language, res]);
    });
  }, function(err, res) {
    return cb(err, _.zipObject(res));
  });
};

EmailService.prototype._checkShouldSendEmail = function(notification, cb) {
  var self = this;

  if (notification.type != 'NewTxProposal') return cb(null, true);
  self.storage.fetchWallet(notification.walletId, function(err, wallet) {
    return cb(err, wallet.m > 1);
  });
};

EmailService.prototype.sendEmail = function(notification, cb) {
  var self = this;

  cb = cb || function() {};

  var emailType = EMAIL_TYPES[notification.type];
  if (!emailType) return cb();

  self._checkShouldSendEmail(notification, function(err, should) {
    if (err) return cb(err);
    if (!should) return cb();

    self._getRecipientsList(notification, emailType, function(err, recipientsList) {
      if (_.isEmpty(recipientsList)) return cb();

      // TODO: Optimize so one process does not have to wait until all others are done
      // Instead set a flag somewhere in the db to indicate that this process is free
      // to serve another request.
      self.lock.runLocked('email-' + notification.id, cb, function(cb) {
        self.storage.fetchEmailByNotification(notification.id, function(err, email) {
          if (err) return cb(err);
          if (email) return cb();

          async.waterfall([

            function(next) {
              self._readAndApplyTemplates(notification, emailType, recipientsList, next);
            },
            function(contents, next) {
              async.map(recipientsList, function(recipient, next) {
                var content = contents[recipient.language];
                var email = Model.Email.create({
                  walletId: notification.walletId,
                  copayerId: recipient.copayerId,
                  from: self.from,
                  to: recipient.emailAddress,
                  subject: content.plain.subject,
                  bodyPlain: content.plain.body,
                  bodyHtml: content.html ? content.html.body : null,
                  notificationId: notification.id,
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
      });
    });
  });

};

module.exports = EmailService;
