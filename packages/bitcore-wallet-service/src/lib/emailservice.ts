import * as async from 'async';
import * as _ from 'lodash';
import 'source-map-support/register';

// This has been changed in favor of @sendgrid.  To use nodemail, change the
// sending function from `.send` to `.sendMail`.
// import * as nodemailer from nodemailer';
import { Lock } from './lock';
import logger from './logger';
import { MessageBroker } from './messagebroker';
import { Email } from './model';
import { Storage } from './storage';

export interface Recipient {
  copayerId: string;
  emailAddress: string;
  language: string;
  unit: string;
}

const Mustache = require('mustache');
const fs = require('fs');
const path = require('path');
const Utils = require('./common/utils');
const Defaults = require('./common/defaults');

const EMAIL_TYPES = {
  NewCopayer: {
    filename: 'new_copayer',
    notifyDoer: false,
    notifyOthers: true
  },
  WalletComplete: {
    filename: 'wallet_complete',
    notifyDoer: true,
    notifyOthers: true
  },
  NewTxProposal: {
    filename: 'new_tx_proposal',
    notifyDoer: false,
    notifyOthers: true
  },
  NewOutgoingTx: {
    filename: 'new_outgoing_tx',
    notifyDoer: true,
    notifyOthers: true
  },
  NewIncomingTx: {
    filename: 'new_incoming_tx',
    notifyDoer: true,
    notifyOthers: true
  },
  TxProposalFinallyRejected: {
    filename: 'txp_finally_rejected',
    notifyDoer: false,
    notifyOthers: true
  },
  TxConfirmation: {
    filename: 'tx_confirmation',
    notifyDoer: true,
    notifyOthers: false
  }
};

export class EmailService {
  defaultLanguage: string;
  defaultUnit: string;
  templatePath: string;
  publicTxUrlTemplate: string;
  subjectPrefix: string;
  from: string;
  availableLanguages: string[];
  storage: Storage;
  messageBroker: MessageBroker;
  lock: Lock;
  mailer: any;
  //  mailer: nodemailer.Transporter;

  start(opts, cb) {
    opts = opts || {};

    const _readDirectories = (basePath, cb) => {
      fs.readdir(basePath, (err, files) => {
        if (err) return cb(err);
        async.filter(
          files,
          (file, next) => {
            fs.stat(path.join(basePath, file), (err, stats) => {
              return next(!err && stats.isDirectory());
            });
          },
          dirs => {
            return cb(null, dirs);
          }
        );
      });
    };

    opts.emailOpts = opts.emailOpts || {};

    this.defaultLanguage = opts.emailOpts.defaultLanguage || 'en';
    this.defaultUnit = opts.emailOpts.defaultUnit || 'btc';
    logger.info('Email templates at:' + (opts.emailOpts.templatePath || __dirname + '/../../templates') + '/');
    this.templatePath = path.normalize((opts.emailOpts.templatePath || __dirname + '/../../templates') + '/');

    this.publicTxUrlTemplate = opts.emailOpts.publicTxUrlTemplate || {};
    this.subjectPrefix = opts.emailOpts.subjectPrefix || '[Wallet service]';
    this.from = opts.emailOpts.from;

    async.parallel(
      [
        done => {
          _readDirectories(this.templatePath, (err, res) => {
            this.availableLanguages = res;
            done(err);
          });
        },
        done => {
          if (opts.storage) {
            this.storage = opts.storage;
            done();
          } else {
            this.storage = new Storage();
            this.storage.connect(opts.storageOpts, done);
          }
        },
        done => {
          this.messageBroker = opts.messageBroker || new MessageBroker(opts.messageBrokerOpts);
          this.messageBroker.onMessage(_.bind(this.sendEmail, this));
          done();
        },
        done => {
          this.lock = opts.lock || new Lock(this.storage);
          done();
        },
        done => {
          this.mailer = opts.mailer; // || nodemailer.createTransport(opts.emailOpts);
          done();
        }
      ],
      err => {
        if (err) {
          logger.error(err);
        }
        return cb(err);
      }
    );
  }

  _compileTemplate(template, extension) {
    const lines = template.split('\n');
    if (extension == '.html') {
      lines.unshift('');
    }
    return {
      subject: lines[0],
      body: _.tail(lines).join('\n')
    };
  }

  _readTemplateFile(language, filename, cb) {
    const fullFilename = path.join(this.templatePath, language, filename);
    fs.readFile(fullFilename, 'utf8', (err, template) => {
      if (err) {
        return cb(new Error('Could not read template file ' + fullFilename + err));
      }
      return cb(null, template);
    });
  }

  // TODO: cache for X minutes
  _loadTemplate(emailType, recipient, extension, cb) {
    this._readTemplateFile(recipient.language, emailType.filename + extension, (err, template) => {
      if (err) return cb(err);
      return cb(null, this._compileTemplate(template, extension));
    });
  }

  _applyTemplate(template, data, cb) {
    if (!data) return cb(new Error('Could not apply template to empty data'));

    let error;
    const result = _.mapValues(template, t => {
      try {
        return Mustache.render(t, data);
      } catch (e) {
        logger.error('Could not apply data to template', e);
        error = e;
      }
    });
    if (error) return cb(error);
    return cb(null, result);
  }

  _getRecipientsList(notification, emailType, cb) {
    this.storage.fetchWallet(notification.walletId, (err, wallet) => {
      if (err) return cb(err);

      this.storage.fetchPreferences(notification.walletId, null, (err, preferences) => {
        if (err) return cb(err);
        if (_.isEmpty(preferences)) return cb(null, []);

        const usedEmails = {};
        const recipients = _.compact(
          _.map(preferences, p => {
            if (!p.email || usedEmails[p.email]) return;

            usedEmails[p.email] = true;
            if (notification.creatorId == p.copayerId && !emailType.notifyDoer) return;
            if (notification.creatorId != p.copayerId && !emailType.notifyOthers) return;
            if (!_.includes(this.availableLanguages, p.language)) {
              if (p.language) {
                logger.warn('Language for email "' + p.language + '" not available.');
              }
              p.language = this.defaultLanguage;
            }

            let unit;
            if (wallet.coin != Defaults.COIN) {
              unit = wallet.coin;
            } else {
              unit = p.unit || this.defaultUnit;
            }

            return {
              copayerId: p.copayerId,
              emailAddress: p.email,
              language: p.language,
              unit
            };
          })
        );

        return cb(null, recipients);
      });
    });
  }

  _getDataForTemplate(notification, recipient, cb) {
    // TODO: Declare these in BWU
    const UNIT_LABELS = {
      btc: 'BTC',
      bit: 'bits',
      bch: 'BCH',
      eth: 'ETH',
      xrp: 'XRP'
    };

    const data = _.cloneDeep(notification.data);
    data.subjectPrefix = _.trim(this.subjectPrefix) + ' ';
    if (data.amount) {
      try {
        const unit = recipient.unit.toLowerCase();
        data.amount = Utils.formatAmount(+data.amount, unit) + ' ' + UNIT_LABELS[unit];
      } catch (ex) {
        return cb(new Error('Could not format amount' + ex));
      }
    }

    this.storage.fetchWallet(notification.walletId, (err, wallet) => {
      if (err) return cb(err);
      if (!wallet) return cb('no wallet');
      data.walletId = wallet.id;
      data.walletName = wallet.name;
      data.walletM = wallet.m;
      data.walletN = wallet.n;
      const copayer = wallet.copayers.find(c => c.id == notification.creatorId);
      if (copayer) {
        data.copayerId = copayer.id;
        data.copayerName = copayer.name;
      }

      if (notification.type == 'TxProposalFinallyRejected' && data.rejectedBy) {
        const rejectors = _.map(data.rejectedBy, copayerId => {
          const copayer = wallet.copayers.find(c => c.id == copayerId);
          return copayer.name;
        });
        data.rejectorsNames = rejectors.join(', ');
      }

      if (_.includes(['NewIncomingTx', 'NewOutgoingTx'], notification.type) && data.txid) {
        const urlTemplate = this.publicTxUrlTemplate[wallet.coin][wallet.network];
        if (urlTemplate) {
          try {
            data.urlForTx = Mustache.render(urlTemplate, data);
          } catch (ex) {
            logger.warn('Could not render public url for tx', ex);
          }
        }
      }

      return cb(null, data);
    });
  }

  _send(email, cb) {
    const mailOptions = {
      from: email.from,
      to: email.to,
      subject: email.subject,
      text: email.bodyPlain,
      html: undefined
    };
    if (email.bodyHtml) {
      mailOptions.html = email.bodyHtml;
    }
    this.mailer
      .send(mailOptions)
      .then(result => {
        logger.debug('Message sent: ', result || '');
        return cb(null, result);
      })
      .catch(err => {
        let errStr;
        try {
          errStr = err.toString().substr(0, 100);
        } catch (e) {}

        logger.warn('An error occurred when trying to send email to ' + email.to, errStr || err);
        return cb(err);
      });
  }

  _readAndApplyTemplates(notification, emailType, recipientsList: Recipient[], cb) {
    async.map(
      recipientsList,
      (recipient, next) => {
        async.waterfall(
          [
            next => {
              this._getDataForTemplate(notification, recipient, next);
            },
            (data, next) => {
              async.map(
                ['plain', 'html'],
                (type, next) => {
                  this._loadTemplate(emailType, recipient, '.' + type, (err, template) => {
                    if (err && type == 'html') return next();
                    if (err) return next(err);
                    this._applyTemplate(template, data, (err, res) => {
                      return next(err, [type, res]);
                    });
                  });
                },
                (err, res: any) => {
                  return next(err, _.fromPairs(res.filter(Boolean)));
                }
              );
            },
            (result, next) => {
              next(null, result);
            }
          ],
          (err, res) => {
            next(err, [recipient.language, res]);
          }
        );
      },
      (err, res: any) => {
        return cb(err, _.fromPairs(res.filter(Boolean)));
      }
    );
  }

  _checkShouldSendEmail(notification, cb) {
    if (notification.type != 'NewTxProposal') return cb(null, true);
    this.storage.fetchWallet(notification.walletId, (err, wallet) => {
      return cb(err, wallet.m > 1);
    });
  }

  sendEmail(notification, cb) {
    cb = cb || function() {};

    const emailType = EMAIL_TYPES[notification.type];
    if (!emailType) return cb();

    this._checkShouldSendEmail(notification, (err, should) => {
      if (err) return cb(err);
      if (!should) return cb();

      this._getRecipientsList(notification, emailType, (err, recipientsList: Recipient[]) => {
        if (_.isEmpty(recipientsList)) return cb();

        // TODO: Optimize so one process does not have to wait until all others are done
        // Instead set a flag somewhere in the db to indicate that this process is free
        // to serve another request.
        this.lock.runLocked('email-' + notification.id, {}, cb, cb => {
          this.storage.fetchEmailByNotification(notification.id, (err, email) => {
            if (err) return cb(err);
            if (email) return cb();

            async.waterfall(
              [
                next => {
                  this._readAndApplyTemplates(notification, emailType, recipientsList, next);
                },
                (contents, next) => {
                  async.map(
                    recipientsList,
                    (recipient, next) => {
                      const content = contents[recipient.language];
                      const email = Email.create({
                        walletId: notification.walletId,
                        copayerId: recipient.copayerId,
                        from: this.from,
                        to: recipient.emailAddress,
                        subject: content.plain.subject,
                        bodyPlain: content.plain.body,
                        bodyHtml: content.html ? content.html.body : null,
                        notificationId: notification.id
                      });
                      this.storage.storeEmail(email, err => {
                        return next(err, email);
                      });
                    },
                    next
                  );
                },
                (emails, next) => {
                  async.each(
                    emails,
                    (email: any, next) => {
                      this._send(email, err => {
                        if (err) {
                          email.setFail();
                        } else {
                          email.setSent();
                        }
                        this.storage.storeEmail(email, next);
                      });
                    },
                    err => {
                      return next();
                    }
                  );
                }
              ],
              err => {
                if (err) {
                  let errStr;
                  try {
                    errStr = err.toString().substr(0, 100);
                  } catch (e) {}

                  logger.warn('An error ocurred generating email notification', errStr || err);
                }
                return cb(err);
              }
            );
          });
        });
      });
    });
  }
}

module.exports = EmailService;
