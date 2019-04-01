'use strict';

import * as async from 'async';
import * as fs from 'fs';
import * as _ from 'lodash';
import request from 'request';
import { INotification } from './model/notification';
import { IPreferences } from './model/preferences';
import { Storage } from './storage';
var Mustache = require('mustache');
var defaultRequest = require('request');
var MessageBroker = require('./messagebroker');
var path = require('path');
var Utils = require('./common/utils');
var Defaults = require('./common/defaults');
var sjcl = require('sjcl');
var log = require('npmlog');
log.debug = log.verbose;

var PUSHNOTIFICATIONS_TYPES = {
  NewCopayer: {
    filename: 'new_copayer'
  },
  WalletComplete: {
    filename: 'wallet_complete'
  },
  NewTxProposal: {
    filename: 'new_tx_proposal'
  },
  NewOutgoingTx: {
    filename: 'new_outgoing_tx'
  },
  NewIncomingTx: {
    filename: 'new_incoming_tx'
  },
  TxProposalFinallyRejected: {
    filename: 'txp_finally_rejected'
  },
  TxConfirmation: {
    filename: 'tx_confirmation',
    notifyCreatorOnly: true
  }
};

export interface IPushNotificationService {
  templatePath: string;
  defaultLanguage: string;
  defaultUnit: string;
  subjectPrefix: string;
  pushServerUrl: string;
  availableLanguages: string;
  authorizationKey: string;
  messageBroker: any;
}

export class PushNotificationsService {
  request: request.RequestAPI<any, any, any>;
  templatePath: string;
  defaultLanguage: string;
  defaultUnit: string;
  subjectPrefix: string;
  pushServerUrl: string;
  availableLanguages: string;
  authorizationKey: string;
  storage: Storage;
  messageBroker: any;

  start(opts, cb) {
    var self = this;
    opts = opts || {};
    self.request = opts.request || defaultRequest;

    function _readDirectories(basePath, cb) {
      fs.readdir(basePath, (err, files) => {
        if (err) return cb(err);
        async.filter(
          files,
          (file, next: (err: boolean) => void) => {
            fs.stat(path.join(basePath, file), (err, stats) => {
              return next(!err && stats.isDirectory());
            });
          },
          (dirs) => {
            return cb(null, dirs);
          }
        );
      });
    }

    self.templatePath = path.normalize(
      (opts.pushNotificationsOpts.templatePath || __dirname + '../../templates') +
      '/'
    );
    self.defaultLanguage = opts.pushNotificationsOpts.defaultLanguage || 'en';
    self.defaultUnit = opts.pushNotificationsOpts.defaultUnit || 'btc';
    self.subjectPrefix = opts.pushNotificationsOpts.subjectPrefix || '';
    self.pushServerUrl = opts.pushNotificationsOpts.pushServerUrl;
    self.authorizationKey = opts.pushNotificationsOpts.authorizationKey;

    if (!self.authorizationKey)
      return cb(
        new Error('Missing authorizationKey attribute in configuration.')
      );

    async.parallel(
      [
        (done) => {
          _readDirectories(self.templatePath, (err, res) => {
            self.availableLanguages = res;
            done(err);
          });
        },
        (done) => {
          if (opts.storage) {
            self.storage = opts.storage;
            done();
          } else {
            self.storage = new Storage();
            self.storage.connect(
              opts.storageOpts,
              done
            );
          }
        },
        (done) => {
          self.messageBroker =
            opts.messageBroker || new MessageBroker(opts.messageBrokerOpts);
          self.messageBroker.onMessage(
            _.bind(self._sendPushNotifications, self)
          );
          done();
        }
      ],
      (err) => {
        if (err) {
          log.error(err);
        }
        return cb(err);
      }
    );
  }

  _sendPushNotifications(notification, cb) {
    var self = this;
    cb = cb || function() { };

    var notifType = PUSHNOTIFICATIONS_TYPES[notification.type];
    if (!notifType) return cb();

    log.debug('Notification received: ' + notification.type);
    log.debug(JSON.stringify(notification));

    self._checkShouldSendNotif(notification, (err, should) => {
      if (err) return cb(err);

      log.debug('Should send notification: ', should);
      if (!should) return cb();

      self._getRecipientsList(notification, notifType, (
        err,
        recipientsList
      ) => {
        if (err) return cb(err);

        async.waterfall(
          [
            (next) => {
              self._readAndApplyTemplates(
                notification,
                notifType,
                recipientsList,
                next
              );
            },
            (contents, next) => {
              async.map(
                recipientsList,
                (recipient: IPreferences, next) => {
                  var content = contents[recipient.language];

                  self.storage.fetchPushNotificationSubs(
                    recipient.copayerId,
                    (err, subs) => {
                      if (err) return next(err);

                      var notifications = _.map(subs, (sub) => {
                        return {
                          to: sub.token,
                          priority: 'high',
                          restricted_package_name: sub.packageName,
                          notification: {
                            title: content.plain.subject,
                            body: content.plain.body,
                            sound: 'default',
                            click_action: 'FCM_PLUGIN_ACTIVITY',
                            icon: 'fcm_push_icon'
                          },
                          data: {
                            walletId: sjcl.codec.hex.fromBits(
                              sjcl.hash.sha256.hash(notification.walletId)
                            ),
                            copayerId: sjcl.codec.hex.fromBits(
                              sjcl.hash.sha256.hash(recipient.copayerId)
                            ),
                            title: content.plain.subject,
                            body: content.plain.body,
                            notification_type: notification.type
                          }
                        };
                      });
                      return next(err, notifications);
                    }
                  );
                },
                function(err, allNotifications) {
                  if (err) return next(err);
                  return next(null, _.flatten(allNotifications));
                }
              );
            },
            function(notifications, next) {
              async.each(
                notifications,
                function(notification, next) {
                  self._makeRequest(notification, function(err, response) {
                    if (err) log.error(err);
                    if (response) {
                      log.debug('Request status: ', response.statusCode);
                      log.debug('Request message: ', response.statusMessage);
                      log.debug('Request body: ', response.request.body);
                    }
                    next();
                  });
                },
                (err) => {
                  return next(err);
                }
              );
            }
          ],
          (err) => {
            if (err) {
              log.error('An error ocurred generating notification', err);
            }
            return cb(err);
          }
        );
      });
    });
  }

  _checkShouldSendNotif(notification, cb) {
    var self = this;

    if (notification.type != 'NewTxProposal') return cb(null, true);
    self.storage.fetchWallet(notification.walletId, function(err, wallet) {
      return cb(err, wallet && wallet.m > 1);
    });
  }

  _getRecipientsList(notification, notificationType, cb) {
    var self = this;

    self.storage.fetchWallet(notification.walletId, function(err, wallet) {
      if (err) return cb(err);

      var unit;
      if (wallet.coin != Defaults.COIN) {
        unit = wallet.coin;
      }

      self.storage.fetchPreferences(notification.walletId, null, function(
        err,
        preferences
      ) {
        if (err) log.error(err);
        if (_.isEmpty(preferences)) preferences = [];

        var recipientPreferences = _.compact(
          _.map(preferences, function(p) {
            if (!_.includes(self.availableLanguages, p.language)) {
              if (p.language)
                log.warn(
                  'Language for notifications "' +
                  p.language +
                  '" not available.'
                );
              p.language = self.defaultLanguage;
            }

            return {
              copayerId: p.copayerId,
              language: p.language,
              unit: unit || p.unit || self.defaultUnit
            };
          })
        );

        const copayers = _.keyBy(recipientPreferences, 'copayerId');

        var recipientsList = _.compact(
          _.map(wallet.copayers, function(copayer) {
            if (
              (copayer.id == notification.creatorId &&
                notificationType.notifyCreatorOnly) ||
              (copayer.id != notification.creatorId &&
                !notificationType.notifyCreatorOnly)
            ) {
              var p = copayers[copayer.id] || {
                language: self.defaultLanguage,
                unit: self.defaultUnit
              };
              return {
                copayerId: copayer.id,
                language: p.language || self.defaultLanguage,
                unit: unit || p.unit || self.defaultUnit
              };
            }
          })
        );

        return cb(null, recipientsList);
      });
    });
  }

  _readAndApplyTemplates(notification, notifType, recipientsList, cb) {
    var self = this;

    async.map(
      recipientsList,
      function(recipient: { language: string }, next) {
        async.waterfall(
          [
            (next) => {
              self._getDataForTemplate(notification, recipient, next);
            },
            function(data, next) {
              async.map(
                ['plain', 'html'],
                function(type, next) {
                  self._loadTemplate(notifType, recipient, '.' + type, function(
                    err,
                    template
                  ) {
                    if (err && type == 'html') return next();
                    if (err) return next(err);

                    self._applyTemplate(template, data, (err, res) => {
                      return next(err, [type, res]);
                    });
                  });
                },
                (err, res) => {
                  return next(
                    err,
                    _.fromPairs(res.filter(Boolean) as any[])
                  );
                }
              );
            },
            function(result, next) {
              next(null, result);
            }
          ],
          (err, res) => {
            next(err, [recipient.language, res]);
          }
        );
      },
      (err, res) => {
        return cb(err, _.fromPairs(res.filter(Boolean) as any[]));
      }
    );
  }

  _getDataForTemplate(notification: INotification, recipient, cb) {
    var self = this;
    var UNIT_LABELS = {
      btc: 'BTC',
      bit: 'bits',
      bch: 'BCH'
    };

    var data = _.cloneDeep(notification.data);
    data.subjectPrefix = _.trim(self.subjectPrefix + ' ');
    if (data.amount) {
      try {
        var unit = recipient.unit.toLowerCase();
        data.amount =
          Utils.formatAmount(+data.amount, unit) + ' ' + UNIT_LABELS[unit];
      } catch (ex) {
        return cb(new Error('Could not format amount' + ex));
      }
    }

    self.storage.fetchWallet(notification.walletId, function(err, wallet) {
      if (err || !wallet) return cb(err);

      data.walletId = wallet.id;
      data.walletName = wallet.name;
      data.walletM = wallet.m;
      data.walletN = wallet.n;

      const copayer = wallet.copayers.find(
        (c) => c.id === notification.creatorId
      );
      /*
       *var copayer = _.find(wallet.copayers, {
       *  id: notification.creatorId
       *});
       */

      if (copayer) {
        data.copayerId = copayer.id;
        data.copayerName = copayer.name;
      }

      if (notification.type == 'TxProposalFinallyRejected' && data.rejectedBy) {
        var rejectors = _.map(data.rejectedBy, function(copayerId) {
          return wallet.copayers.find((c) => c.id === copayerId).name;
        });
        data.rejectorsNames = rejectors.join(', ');
      }

      return cb(null, data);
    });
  }

  _applyTemplate(template, data, cb) {
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
  }

  _loadTemplate(notifType, recipient, extension, cb) {
    var self = this;

    self._readTemplateFile(
      recipient.language,
      notifType.filename + extension,
      function(err, template) {
        if (err) return cb(err);
        return cb(null, self._compileTemplate(template, extension));
      }
    );
  }

  _readTemplateFile(language, filename, cb) {
    var self = this;

    var fullFilename = path.join(self.templatePath, language, filename);
    fs.readFile(fullFilename, 'utf8', function(err, template) {
      if (err) {
        return cb(
          new Error('Could not read template file ' + fullFilename + err)
        );
      }
      return cb(null, template);
    });
  }

  _compileTemplate(template, extension) {
    var lines = template.split('\n');
    if (extension == '.html') {
      lines.unshift('');
    }
    return {
      subject: lines[0],
      body: _.tail(lines).join('\n')
    };
  }

  _makeRequest(opts, cb) {
    var self = this;

    self.request(
      {
        url: self.pushServerUrl + '/send',
        method: 'POST',
        json: true,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'key=' + self.authorizationKey
        },
        body: opts
      },
      cb
    );
  }
}
