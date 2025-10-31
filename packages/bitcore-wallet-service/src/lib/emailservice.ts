import fs from 'fs';
import { IncomingMessage } from 'http';
import path from 'path';
import sgMail from '@sendgrid/mail';
import * as async from 'async';
import juice from 'juice';
import 'source-map-support/register';
import Mustache from 'mustache';
import * as nodemailer from 'nodemailer';
import request from 'request';
import config from '../config';
import { Common } from './common';
import { getIconHtml } from './iconsconfig';
import { Lock } from './lock';
import logger from './logger';
import { MessageBroker } from './messagebroker';
import { Email, Notification, Preferences } from './model';
import { Storage } from './storage';

export interface Recipient {
  copayerId: string;
  emailAddress: string;
  language: string;
  unit: string;
}

interface EmailType {
  filename: string;
  notifyDoer: boolean;
  notifyOthers: boolean;
};

const Utils = Common.Utils;
const Defaults = Common.Defaults;
const Constants = Common.Constants;

const EMAIL_TYPES: { [key: string]: EmailType } = {
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
  NewIncomingTxTestnet: {
    filename: 'new_incoming_tx_testnet',
    notifyDoer: true,
    notifyOthers: true
  },
  NewZeroOutgoingTx: {
    filename: 'new_zero_outgoing_tx',
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
  },
  TxConfirmationReceiver: {
    filename: 'tx_confirmation_receiver',
    notifyDoer: true,
    notifyOthers: false
  },
  TxConfirmationSender: {
    filename: 'tx_confirmation_sender',
    notifyDoer: true,
    notifyOthers: false
  }
};

export class EmailService {
  defaultLanguage: string;
  defaultUnit: string;
  templatePath: string;
  masterTemplatePath: string;
  masterTemplate: string;
  publicTxUrlTemplate: string;
  subjectPrefix: string;
  from: string;
  availableLanguages: string[];
  storage: Storage;
  messageBroker: MessageBroker;
  lock: Lock;
  mailer: nodemailer.Transporter | typeof sgMail;
  request: request.RequestAPI<any, any, any>;
  sendMail: (opts) => any;

  start(opts, cb) {
    opts = opts || {};
    this.request = opts.request || request;

    opts.emailOpts = opts.emailOpts || {};

    this.defaultLanguage = opts.emailOpts.defaultLanguage || 'en';
    this.defaultUnit = opts.emailOpts.defaultUnit || 'btc';
    this.templatePath = path.normalize(opts.emailOpts.templatePath || path.join(__dirname, '../../templates'));
    this.masterTemplatePath = path.join(this.templatePath, 'master-template.html');
    
    try {
      this.masterTemplate = fs.readFileSync(this.masterTemplatePath, 'utf8');
      logger.debug('Master template loaded successfully from: %s', this.masterTemplatePath);
    } catch (err) {
      logger.error('Could not load master template from %s: %o', this.masterTemplatePath, err);
      return cb(new Error('Could not load master template'));
    }

    this.publicTxUrlTemplate = opts.emailOpts.publicTxUrlTemplate || {};
    this.subjectPrefix = opts.emailOpts.subjectPrefix || '[Wallet service]';
    this.from = opts.emailOpts.from;

    async.parallel(
      [
        done => {
          try {
            const langs = this._getTemplateLanguages(this.templatePath);
            this.availableLanguages = langs;
            done();
          } catch (err) {
            done(err);
          }
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
          this.messageBroker.onMessage(this.sendEmail.bind(this));
          done();
        },
        done => {
          this.lock = opts.lock || new Lock(this.storage);
          done();
        },
        done => {
          try {
            if (opts.emailOpts.mailer === 'nodemailer') {
              this.mailer = nodemailer.createTransport(opts.emailOpts);
              this.sendMail = this.mailer.sendMail.bind(this.mailer);
            } else if (opts.emailOpts.mailer === 'sendgrid') {
              sgMail.setApiKey(opts.emailOpts.sendGridApiKey);
              this.mailer = sgMail;
              this.sendMail = this.mailer.send.bind(this.mailer);
            } else if (opts.emailOpts.mailer === 'mailersend') {
              this.sendMail = async function(opts) {
                return new Promise((resolve, reject) => {
                  this.request(
                    {
                      url: 'https://api.mailersend.com/v1/email',
                      method: 'POST',
                      json: true,
                      headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        Authorization: 'Bearer ' + config.emailOpts.mailerSendApiKey,
                      },
                      body: {
                        from: { email: opts.from },
                        to: [{ email: opts.to }],
                        subject: opts.subject,
                        text: opts.text,
                        html: opts.html
                      }
                    },
                    (err, data) => {
                      if (err) return reject(err);
                      data = data.toJSON();
                      if (data?.statusCode >= 200 && data?.statusCode < 300) {
                        return resolve(data?.body || data);
                      }
                      return reject(data?.body || data);
                    }
                  );
                });
              };
            } else {
              throw new Error('Unknown emailOpts.mailer: ' + opts.emailOpts.mailer);
            }
          } catch (err) {
            return done(err);
          }
          done();
        }
      ],
      err => {
        if (err) {
          logger.error('%o', err);
        }
        return cb(err);
      }
    );
  }

  _getTemplateLanguages(templatePath) {
    const contents = fs.readdirSync(templatePath, { withFileTypes: true });
    const langs = contents.filter(item => item.isDirectory()).map(item => item.name);
    return langs;
  }

  _compileTemplate(template, extension) {
    const lines = template.split('\n');
    if (extension == '.html') {
      lines.unshift('');
    }
    return {
      subject: lines[0],
      body: lines.slice(1).join('\n')
    };
  }

  _readTemplateFile(language: string, filename: string, cb) {
    const fullFilename = path.join(this.templatePath, language, filename);
    fs.readFile(fullFilename, 'utf8', (err, template) => {
      if (err) {
        return cb(new Error('Could not read template file ' + fullFilename + err));
      }
      return cb(null, template);
    });
  }

  // TODO: cache for X minutes
  _loadTemplate(emailType: EmailType, recipient: Recipient, extension: string, cb) {
    this._readTemplateFile(recipient.language, emailType.filename + extension, (err, template) => {
      if (err) {
        logger.error('Could not read template file for language %s: %o', recipient.language, err.message);
        return cb(err);
      }

      const compiled = this._compileTemplate(template, extension);
      if (extension === '.html') {
        compiled.body = this.masterTemplate.replace('{{> htmlContent}}', compiled.body);
      }
      return cb(null, compiled);
    });
  }

  _applyTemplate(template, data, cb) {
    if (!data) return cb(new Error('Could not apply template to empty data'));

    let error;
    const result = {};
    for (const [key, templateStr] of Object.entries(template)) {
      try {
        result[key] = Mustache.render(templateStr, data);
      } catch (e) {
        logger.error('Could not apply data to template: %o', e);
        error = e;
      }
    }
    if (error) return cb(error);
    return cb(null, result);
  }

  _getRecipientsList(notification: Notification, emailType: EmailType, cb) {
    this.storage.fetchWallet(notification.walletId, (err, wallet) => {
      if (err) return cb(err);

      this.storage.fetchPreferences<Preferences[]>(notification.walletId, null, (err, preferences) => {
        if (err) return cb(err);
        if (!preferences?.length) return cb(null, []);

        const usedEmails = {};
        const recipients = preferences.map(p => {
          if (!p.email || usedEmails[p.email]) return;

          usedEmails[p.email] = true;
          if (notification.creatorId == p.copayerId && !emailType.notifyDoer) return;
          if (notification.creatorId != p.copayerId && !emailType.notifyOthers) return;
          if (!this.availableLanguages.includes(p.language)) {
            if (p.language) {
              logger.warn('Language for email "' + p.language + '" not available.');
            }
            p.language = this.defaultLanguage;
          }

          let unit;
          if (wallet.coin != Defaults.COIN) {
            switch (wallet.coin) {
              case 'pax':
                unit = 'usdp'; // backwards compatibility
                break;
              default:
                unit = wallet.coin;
            }
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
          .filter(p => !!p); // filter out falsy values (e.g. undefined)

        return cb(null, recipients);
      });
    });
  }

  async _getDataForTemplate(notification: Notification, recipient: Recipient, cb) {
    const UNIT_LABELS = {
      btc: 'BTC',
      bit: 'bits',
      bch: 'BCH',
      eth: 'ETH',
      matic: 'MATIC',
      xrp: 'XRP',
      doge: 'DOGE',
      ltc: 'LTC',
      usdc: 'USDC',
      pyusd: 'PYUSD',
      usdp: 'USDP',
      gusd: 'GUSD',
      busd: 'BUSD',
      wbtc: 'WBTC',
      dai: 'DAI',
      shib: 'SHIB',
      ape: 'APE',
      euroc: 'EUROC',
      usdt: 'USDT',
      weth: 'WETH',
      'usdc.e': 'USDC.e',
      sol: 'SOL',
    };

    const data = JSON.parse(JSON.stringify(notification.data)) as Notification['data'];
    data.subjectPrefix = this.subjectPrefix.trim() + ' ';
    
    // Helper function to properly title case text
    const toTitleCase = (text: string) => {
      const minorWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'via'];
      return text.split(' ').map((word, index) => {
        if (index === 0 || !minorWords.includes(word.toLowerCase())) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        return word.toLowerCase();
      }).join(' ');
    };
    
    try {
      const plainTemplate = await new Promise<string>((resolve, reject) => {
        this._readTemplateFile(recipient.language, `${EMAIL_TYPES[notification.type].filename}.plain`, (err, template) => {
          if (err) reject(err);
          else resolve(template);
        });
      });
      const firstLine = plainTemplate.split('\n')[0];
      if (firstLine && firstLine.startsWith('{{subjectPrefix}}')) {
        data.title = toTitleCase(firstLine.replace('{{subjectPrefix}}', ''));
      }
    } catch {
      const templateName = EMAIL_TYPES[notification.type].filename;
      data.title = toTitleCase(templateName.split('_').join(' '));
    }
    
    const templateName = EMAIL_TYPES[notification.type]?.filename;
    const icon = getIconHtml(templateName, true);
    if (icon) {
      data.icon = icon;
    }

    if (data.amount) {
      try {
        let unit = recipient.unit.toLowerCase();
        let label = UNIT_LABELS[unit];
        const opts = {} as any;
        if (data.tokenAddress) {
          const tokenAddress = data.tokenAddress.toLowerCase();
          if (Constants.ETH_TOKEN_OPTS[tokenAddress]) {
            unit = Constants.ETH_TOKEN_OPTS[tokenAddress].symbol.toLowerCase();
            label = UNIT_LABELS[unit];
          } else if (Constants.MATIC_TOKEN_OPTS[tokenAddress]) {
            unit = Constants.MATIC_TOKEN_OPTS[tokenAddress].symbol.toLowerCase();
            label = UNIT_LABELS[unit];
          } else if (Constants.ARB_TOKEN_OPTS[tokenAddress]) {
            unit = Constants.ARB_TOKEN_OPTS[tokenAddress].symbol.toLowerCase();
            label = UNIT_LABELS[unit];
          } else if (Constants.OP_TOKEN_OPTS[tokenAddress]) {
            unit = Constants.OP_TOKEN_OPTS[tokenAddress].symbol.toLowerCase();
            label = UNIT_LABELS[unit];
          } else if (Constants.BASE_TOKEN_OPTS[tokenAddress]) {
            unit = Constants.BASE_TOKEN_OPTS[tokenAddress].symbol.toLowerCase();
            label = UNIT_LABELS[unit];
          } else if (Constants.SOL_TOKEN_OPTS[tokenAddress]) {
            unit = Constants.SOL_TOKEN_OPTS[tokenAddress].symbol.toLowerCase();
            label = UNIT_LABELS[unit];
          } else {
            let customTokensData;
            let tokenData;
            try {
              customTokensData = await this.getTokenData(data.address.coin);
              tokenData = customTokensData.find(t => t.address === tokenAddress);
            } catch {
              return cb(new Error('Could not get custom tokens data'));
            }
            if (tokenData) {
              unit = tokenData.symbol.toLowerCase();
              label = unit.toUpperCase();
              opts.toSatoshis = 10 ** tokenData.decimals;
              opts.decimals = {
                maxDecimals: 6,
                minDecimals: 2
              };
            } else {
              return cb(new Error(`Email Notifications for unsupported tokens are not allowed: ${tokenAddress}`));
            }
          }
        }
        data.amount = Utils.formatAmount(+data.amount, unit, opts) + ' ' + label;
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
        const rejectors = data.rejectedBy.map(copayerId => {
          const copayer = wallet.copayers.find(c => c.id == copayerId);
          return copayer.name;
        });
        data.rejectorsNames = rejectors.join(', ');
      }

      if (['NewIncomingTx', 'NewOutgoingTx'].includes(notification.type) && data.txid) {
        const urlTemplate = this.publicTxUrlTemplate[wallet.chain]?.[wallet.network];
        if (urlTemplate) {
          try {
            data.urlForTx = Mustache.render(urlTemplate, data);
          } catch (ex) {
            logger.warn('Could not render public url for tx: %o', ex);
          }
        } else {
          logger.warn(`Could not find template for chain "${wallet.chain}" on network "${wallet.network}"`);
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
      mailOptions.html = juice(email.bodyHtml, {
        removeStyleTags: false,
        preserveImportant: true,
        preserveMediaQueries: true,
        preserveFontFaces: true,
        applyStyleTags: true
      });
    }
    this.sendMail(mailOptions)
      .then(result => {
        result = result[0] instanceof IncomingMessage ? result[0] : result;
        logger.debug('Message sent: %o %o', mailOptions, result?.toJSON?.() || result || '(no result)');
        return cb(null, result);
      })
      .catch(err => {
        let errStr;
        try {
          errStr = err.toString();
        } catch { /* ignore errors */ }

        logger.warn('An error occurred when trying to send email to %o %o', email.to, (errStr || err));
        return cb(err);
      });
  }

  _readAndApplyTemplates(notification: Notification, emailType: EmailType, recipientsList: Recipient[], cb) {
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
                  return next(err, Utils.fromPairs(res.filter(Boolean)));
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
        return cb(err, Utils.fromPairs(res.filter(Boolean)));
      }
    );
  }

  _checkShouldSendEmail(notification: Notification, cb) {
    if (notification.type != 'NewTxProposal') return cb(null, true);
    this.storage.fetchWallet(notification.walletId, (err, wallet) => {
      return cb(err, wallet.m > 1);
    });
  }

  sendEmail(notification: Notification, cb) {
    cb = cb || function() { };

    const emailType = EMAIL_TYPES[notification.type];
    if (!emailType) return cb();

    this._checkShouldSendEmail(notification, (err, should) => {
      if (err) return cb(err);
      if (!should) return cb();

      this._getRecipientsList(notification, emailType, (err, recipientsList: Recipient[]) => {
        if (!recipientsList?.length) return cb();

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
                    () => {
                      return next();
                    }
                  );
                }
              ],
              err => {
                if (err) {
                  let errStr;
                  try {
                    errStr = err.toString();
                  } catch { /* ignore errors */ }

                  logger.warn('An error ocurred generating email notification: %o', errStr || err);
                }
                return cb(err);
              }
            );
          });
        });
      });
    });
  }

  private coinGeckoGetCredentials() {
    if (!config.coinGecko) throw new Error('coinGecko missing credentials');

    const credentials = {
      API: config.coinGecko.api,
      API_KEY: config.coinGecko.apiKey,
    };

    return credentials;
  }

  getTokenData(chain: string): Promise<Array<{
    chainId: number;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI: string;
  }>> {
    return new Promise((resolve, reject) => {
      const cacheKey = `cgTokenList:${chain}`;
      const credentials = this.coinGeckoGetCredentials();

      this.storage.checkAndUseGlobalCache(cacheKey, Defaults.COIN_GECKO_CACHE_DURATION, (err, values, oldvalues) => {
        if (err) logger.warn('Cache check failed', err);
        if (values) return resolve(values);

        const assetPlatformMap = {
          eth: 'ethereum',
          matic: 'polygon-pos',
          pol: 'polygon-pos',
          arb: 'arbitrum-one',
          base: 'base',
          op: 'optimistic-ethereum',
          sol: 'solana',
        };

        const assetId = assetPlatformMap[chain];
        if (!assetId) return reject(new Error(`Unsupported chain '${chain}'`));

        const URL: string = `${credentials.API}/v3/token_lists/${assetId}/all.json`;
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-cg-pro-api-key': credentials.API_KEY
        };

        this.request.get(
          URL,
          {
            headers,
            json: true
          },
          (err, data) => {
            const tokens = data?.body?.tokens;
            const status = data?.body?.status;
            if (err) {
              logger.warn('An error occured while retrieving the token list', err);
              if (oldvalues) {
                logger.warn('Using old cached values');
                return resolve(oldvalues);
              }
              return reject(err.body ?? err);
            } else if (status?.error_code === 429 && oldvalues) {
              return resolve(oldvalues);
            } else {
              if (!tokens) {
                if (oldvalues) {
                  logger.warn('No token list available... using old cached values');
                  return resolve(oldvalues);
                }
                return reject(new Error(`Could not get tokens list. Code: ${status?.error_code}. Error: ${status?.error_message || 'Unknown error'}`));
              }
              const updatedTokens = tokens.map(token => {
                if (token.logoURI?.includes('/thumb/')) {
                  token.logoURI = token.logoURI.replace('/thumb/', '/large/');
                }
                return token;
              });
              this.storage.storeGlobalCache(cacheKey, updatedTokens, storeErr => {
                if (storeErr) logger.warn('Could not cache token list', storeErr);
                return resolve(updatedTokens);
              });
            }
          });
      });
    });
  }
}