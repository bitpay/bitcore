import * as async from 'async';
import * as _ from 'lodash';
import * as log from 'npmlog';

import { BlockChainExplorer } from './blockchainexplorer';
import { V8 } from './blockchainexplorers/v8';
import { ClientError } from './errors/clienterror';
import { FiatRateService } from './fiatrateservice';
import { Lock } from './lock';
import { MessageBroker } from './messagebroker';
import { Copayer, INotification, ITxProposal, IWallet, Notification, Preferences, PushNotificationSub, Session, TxConfirmationSub, TxNote, TxProposal, Wallet } from './model';
import { Storage } from './storage';

const $ = require('preconditions').singleton();
const deprecatedServerMessage = require('../deprecated-serverMessages');
const serverMessages = require('../serverMessages');
const BCHAddressTranslator = require('./bchaddresstranslator');

log.debug = log.verbose;
log.disableColor();
log.level = 'error';

const EmailValidator = require('email-validator');

import { Validation } from 'crypto-wallet-core';
const Bitcore = require('bitcore-lib');
const Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash'),
  eth: Bitcore
};

const Common = require('./common');
const Utils = Common.Utils;
const Constants = Common.Constants;
const Defaults = Common.Defaults;

const Errors = require('./errors/errordefinitions');

let request = require('request');
let initialized = false;
let doNotCheckV8 = false;

let lock;
let storage;
let blockchainExplorer;
let blockchainExplorerOpts;
let messageBroker;
let fiatRateService;
let serviceVersion;

interface IAddress {
  coin: string;
  network: string;
  address: string;
  hasActivity: boolean;
  isChange?: boolean;
}

export interface IWalletService {
  lock: any;
  storage: Storage;
  blockchainExplorer: any;
  blockchainExplorerOpts: any;
  messageBroker: any;
  fiatRateService: any;
  notifyTicker: number;
  userAgent: string;
  walletId: string;
  copayerId: string;
  appName: string;
  appVersion: string;
  parsedClientVersion: { agent: number; major: number; minor: number; };
  clientVersion: string;
  copayerIsSupportStaff: boolean;
}
function boolToNum(x: boolean) {
  return x ? 1 : 0;
}
/**
 * Creates an instance of the Bitcore Wallet Service.
 * @constructor
 */
export class WalletService {
  lock: any;
  storage: Storage;
  blockchainExplorer: V8;
  blockchainExplorerOpts: any;
  messageBroker: any;
  fiatRateService: any;
  notifyTicker: number;
  userAgent: string;
  walletId: string;
  copayerId: string;
  appName: string;
  appVersion: string;
  parsedClientVersion: { agent: string; major: number; minor: number };
  clientVersion: string;
  copayerIsSupportStaff: boolean;

  constructor() {
    if (!initialized) {
      throw new Error('Server not initialized');
    }

    this.lock = lock;
    this.storage = storage;
    this.blockchainExplorer = blockchainExplorer;
    this.blockchainExplorerOpts = blockchainExplorerOpts;
    this.messageBroker = messageBroker;
    this.fiatRateService = fiatRateService;
    this.notifyTicker = 0;
  }
  /**
   * Gets the current version of BWS
   */
  static getServiceVersion() {
    if (!serviceVersion) {
      serviceVersion = 'bws-' + require('../../package').version;
    }

    return serviceVersion;
  }

  /**
   * Initializes global settings for all instances.
   * @param {Object} opts
   * @param {Storage} [opts.storage] - The storage provider.
   * @param {Storage} [opts.blockchainExplorer] - The blockchainExporer provider.
   * @param {Storage} [opts.doNotCheckV8] - only for testing
   * @param {Callback} cb
   */
  static initialize(opts, cb) {
    $.shouldBeFunction(cb);

    opts = opts || {};
    blockchainExplorer = opts.blockchainExplorer;
    blockchainExplorerOpts = opts.blockchainExplorerOpts;

    doNotCheckV8 = opts.doNotCheckV8;

    if (opts.request) {
      request = opts.request;
    }

    const initStorage = (cb) => {
      if (opts.storage) {
        storage = opts.storage;
        return cb();
      } else {
        const newStorage = new Storage();
        newStorage.connect(
          opts.storageOpts,
          (err) => {
            if (err) {
              return cb(err);
            }
            storage = newStorage;
            return cb();
          }
        );
      }
    };

    const initMessageBroker = (cb) => {
      messageBroker =
        opts.messageBroker || new MessageBroker(opts.messageBrokerOpts);
      if (messageBroker) {
        messageBroker.onMessage(WalletService.handleIncomingNotifications);
      }

      return cb();
    };

    const initFiatRateService = (cb) => {
      if (opts.fiatRateService) {
        fiatRateService = opts.fiatRateService;
        return cb();
      } else {
        const newFiatRateService = new FiatRateService();
        const opts2 = opts.fiatRateServiceOpts || {};
        opts2.storage = storage;
        newFiatRateService.init(opts2, (err) => {
          if (err) {
            return cb(err);
          }

          fiatRateService = newFiatRateService;
          return cb();
        });
      }
    };

    async.series(
      [
        (next) => {
          initStorage(next);
        },
        (next) => {
          initMessageBroker(next);
        },
        (next) => {
          initFiatRateService(next);
        }
      ],
      (err) => {
        lock = opts.lock || new Lock(storage, opts.lockOpts);

        if (err) {
          log.error('Could not initialize', err);
          throw err;
        }
        initialized = true;
        return cb();
      }
    );
  }

  static handleIncomingNotifications(notification, cb) {
    cb = cb || function() { };

    // do nothing here....
    // bc height cache is cleared on bcmonitor
    return cb();
  }

  static shutDown(cb) {
    if (!initialized) {
      return cb();
    }

    storage.disconnect((err) => {
      if (err) {
        return cb(err);
      }

      initialized = false;
      return cb();
    });
  }

  /**
   * Gets an instance of the server without authentication.
   * @param {Object} opts
   * @param {string} opts.clientVersion - A string that identifies the client issuing the request
   */
  static getInstance(opts): WalletService {
    opts = opts || {};

    const version = Utils.parseVersion(opts.clientVersion);
    if (version && version.agent === 'bwc') {
      if (version.major === 0 || (version.major === 1 && version.minor < 2)) {
        throw new ClientError(
          Errors.codes.UPGRADE_NEEDED,
          'BWC clients < 1.2 are no longer supported.'
        );
      }
    }

    const server = new WalletService();
    server._setClientVersion(opts.clientVersion);
    server._setAppVersion(opts.userAgent);
    server.userAgent = opts.userAgent;
    return server;
  }

  /**
   * Gets an instance of the server after authenticating the copayer.
   * @param {Object} opts
   * @param {string} opts.copayerId - The copayer id making the request.
   * @param {string} opts.message - (Optional) The contents of the request to be signed.
   *  Only needed if no session token is provided.
   * @param {string} opts.signature - (Optional) Signature of message to be verified using
   * one of the copayer's requestPubKeys.
   * Only needed if no session token is provided.
   * @param {string} opts.session - (Optional) A valid session token previously obtained using
   * the #login method
   * @param {string} opts.clientVersion - A string that identifies the client issuing the request
   * @param {string} [opts.walletId] - The wallet id to use as current wallet
   * for this request (only when copayer is support staff).
   */
  static getInstanceWithAuth(opts, cb) {
    const withSignature = (cb) => {
      if (!checkRequired(opts, ['copayerId', 'message', 'signature'], cb)) {
        return;
      }

      let server: WalletService;
      try {
        server = WalletService.getInstance(opts);
      } catch (ex) {
        return cb(ex);
      }

      server.storage.fetchCopayerLookup(opts.copayerId, (err, copayer) => {
        if (err) {
          return cb(err);
        }
        if (!copayer) {
          return cb(
            new ClientError(Errors.codes.NOT_AUTHORIZED, 'Copayer not found')
          );
        }

        if (!copayer.isSupportStaff) {
          const isValid = !!server._getSigningKey(
            opts.message,
            opts.signature,
            copayer.requestPubKeys
          );
          if (!isValid) {
            return cb(
              new ClientError(Errors.codes.NOT_AUTHORIZED, 'Invalid signature')
            );
          }

          server.walletId = copayer.walletId;
        } else {
          server.walletId = opts.walletId || copayer.walletId;
          server.copayerIsSupportStaff = true;
        }

        server.copayerId = opts.copayerId;
        return cb(null, server);
      });
    };

    const withSession = (cb) => {
      if (!checkRequired(opts, ['copayerId', 'session'], cb)) {
        return;
      }

      let server;
      try {
        server = WalletService.getInstance(opts);
      } catch (ex) {
        return cb(ex);
      }

      server.storage.getSession(opts.copayerId, (err, s) => {
        if (err) {
          return cb(err);
        }

        const isValid = s && s.id === opts.session && s.isValid();
        if (!isValid) {
          return cb(
            new ClientError(Errors.codes.NOT_AUTHORIZED, 'Session expired')
          );
        }

        server.storage.fetchCopayerLookup(opts.copayerId, (
          err,
          copayer
        ) => {
          if (err) {
            return cb(err);
          }
          if (!copayer) {
            return cb(
              new ClientError(Errors.codes.NOT_AUTHORIZED, 'Copayer not found')
            );
          }

          server.copayerId = opts.copayerId;
          server.walletId = copayer.walletId;
          return cb(null, server);
        });
      });
    };

    const authFn = opts.session ? withSession : withSignature;
    return authFn(cb);
  }

  _runLocked(cb, task, waitTime?: number) {
    $.checkState(this.walletId);

    this.lock.runLocked(this.walletId, { waitTime }, cb, task);
  }

  logi(...args) {
    if (!this) {
      return log.info.apply(this, args);
    }
    if (!this.walletId) {
      return log.info.apply(this, args);
    }

    const argz = [].slice.call(args);
    argz.unshift('<' + this.walletId + '>');
    log.info.apply(this, argz);
  }

  logw(...args) {
    if (!this) {
      return log.warn.apply(this, args);
    }
    if (!this.walletId) {
      return log.warn.apply(this, arguments);
    }

    const argz = [].slice.call(args);
    argz.unshift('<' + this.walletId + '>');
    log.warn.apply(this, argz);
  }

  logd(...args) {
    if (!this) {
      return log.verbose.apply(this, args);
    }
    if (!this.walletId) {
      return log.verbose.apply(this, arguments);
    }

    const argz = [].slice.call(args);
    argz.unshift('<' + this.walletId + '>');
    log.verbose.apply(this, argz);
  }

  login(opts, cb) {
    let session;
    async.series(
      [
        (next) => {
          this.storage.getSession(this.copayerId, (err, s) => {
            if (err) {
              return next(err);
            }
            session = s;
            next();
          });
        },
        (next) => {
          if (!session || !session.isValid()) {
            session = Session.create({
              copayerId: this.copayerId,
              walletId: this.walletId
            });
          } else {
            session.touch();
          }
          next();
        },
        (next) => {
          this.storage.storeSession(session, next);
        }
      ],
      (err) => {
        if (err) {
          return cb(err);
        }
        if (!session) {
          return cb(
            new Error('Could not get current session for this copayer')
          );
        }

        return cb(null, session.id);
      }
    );
  }

  logout(opts, cb) {
    // this.storage.removeSession(this.copayerId, cb);
  }

  /**
   * Creates a new wallet.
   * @param {Object} opts
   * @param {string} opts.id - The wallet id.
   * @param {string} opts.name - The wallet name.
   * @param {number} opts.m - Required copayers.
   * @param {number} opts.n - Total copayers.
   * @param {string} opts.pubKey - Public key to verify copayers joining have access to the wallet secret.
   * @param {string} opts.singleAddress[=false] - The wallet will only ever have one address.
   * @param {string} opts.coin[='btc'] - The coin for this wallet (btc, bch).
   * @param {string} opts.network[='livenet'] - The Bitcoin network for this wallet.
   * @param {string} opts.account[=0] - BIP44 account number
   * @param {string} opts.usePurpose48 - for Multisig wallet, use purpose=48
   */
  createWallet(opts, cb) {
    let pubKey;

    if (opts.coin === 'bch' && opts.n > 1) {
      const version = Utils.parseVersion(this.clientVersion);
      if (version && version.agent === 'bwc') {
        if (version.major < 8 || (version.major === 8 && version.minor < 3)) {
          return cb(new ClientError(
            Errors.codes.UPGRADE_NEEDED,
            'BWC clients < 8.3 are no longer supported for multisig BCH wallets.'
          ));
        }
      }
    }

    if (!checkRequired(opts, ['name', 'm', 'n', 'pubKey'], cb)) {
      return;
    }

    if (_.isEmpty(opts.name)) {
      return cb(new ClientError('Invalid wallet name'));
    }

    if (!Wallet.verifyCopayerLimits(opts.m, opts.n)) {
      return cb(
        new ClientError(
          'Invalid combination of required copayers / total copayers'
        )
      );
    }

    opts.coin = opts.coin || Defaults.COIN;
    if (!Utils.checkValueInCollection(opts.coin, Constants.COINS)) {
      return cb(new ClientError('Invalid coin'));
    }

    opts.network = opts.network || 'livenet';
    if (!Utils.checkValueInCollection(opts.network, Constants.NETWORKS)) {
      return cb(new ClientError('Invalid network'));
    }

    const derivationStrategy = Constants.DERIVATION_STRATEGIES.BIP44;
    const addressType = opts.n === 1
      ? Constants.SCRIPT_TYPES.P2PKH
      : Constants.SCRIPT_TYPES.P2SH;

    try {
      pubKey = new Bitcore.PublicKey.fromString(opts.pubKey);
    } catch (ex) {
      return cb(new ClientError('Invalid public key'));
    }

    if (opts.coin === 'eth' && opts.n > 1) {
      return cb(
        new ClientError( 'Multisig ETH wallet not supported')
      );
    }

    // All ETH wallet are singleAddress
    if (opts.coin === 'eth') {
      opts.singleAddress = true;
    }

    let newWallet;
    async.series(
      [
        (acb) => {
          if (!opts.id) {
            return acb();
          }

          this.storage.fetchWallet(opts.id, (err, wallet) => {
            if (wallet) {
              return acb(Errors.WALLET_ALREADY_EXISTS);
            }
            return acb(err);
          });
        },
        (acb) => {
          const wallet = Wallet.create({
            id: opts.id,
            name: opts.name,
            m: opts.m,
            n: opts.n,
            coin: opts.coin,
            network: opts.network,
            pubKey: pubKey.toString(),
            singleAddress: !!opts.singleAddress,
            derivationStrategy,
            addressType,
            nativeCashAddr: opts.nativeCashAddr,
            usePurpose48: opts.n > 1 && !!opts.usePurpose48,
          });
          this.storage.storeWallet(wallet, (err) => {
            this.logd('Wallet created', wallet.id, opts.network);
            newWallet = wallet;
            return acb(err);
          });
        }
      ],
      (err) => {
        return cb(err, newWallet ? newWallet.id : null);
      }
    );
  }

  /**
   * Retrieves a wallet from storage.
   * @param {Object} opts
   * @returns {Object} wallet
   */
  getWallet(opts, cb) {
    this.storage.fetchWallet(this.walletId, (err, wallet) => {
      if (err) return cb(err);
      if (!wallet) return cb(Errors.WALLET_NOT_FOUND);

      // cashAddress migration
      if (wallet.coin != 'bch' || wallet.nativeCashAddr)
        return cb(null, wallet);

      // only for testing
      if (opts.doNotMigrate) return cb(null, wallet);

      // remove someday...
      log.info(`Migrating wallet ${wallet.id} to cashAddr`);
      this.storage.migrateToCashAddr(this.walletId, e => {
        if (e) return cb(e);
        wallet.nativeCashAddr = true;
        return this.storage.storeWallet(wallet, e => {
          if (e) return cb(e);
          return cb(e, wallet);
        });
      });
    });
  }

  /**
   * Retrieves a wallet from storage.
   * @param {Object} opts
   * @param {string} opts.identifier - The identifier associated with the wallet (one of: walletId, address, txid).
   * @param {string} opts.walletCheck - Check v8 wallet sync
   * @returns {Object} wallet
   */
  getWalletFromIdentifier(opts, cb) {
    if (!opts.identifier) return cb();

    const end = (err, ret) => {
      if (opts.walletCheck && !err && ret) {
        return this.syncWallet(ret, cb);
      } else {
        return cb(err, ret);
      }
    };

    let walletId;
    async.parallel(
      [
        (done) => {
          this.storage.fetchWallet(opts.identifier, (err, wallet) => {
            if (wallet) walletId = wallet.id;
            return done(err);
          });
        },
        (done) => {
          this.storage.fetchAddressByCoin(
            Defaults.COIN,
            opts.identifier,
            (err, address) => {
              if (address) walletId = address.walletId;
              return done(err);
            }
          );
        },
        (done) => {
          // sent txs
          this.storage.fetchTxByHash(opts.identifier, (err, tx) => {
            if (tx) walletId = tx.walletId;
            return done(err);
          });
        }
      ],
      (err) => {
        if (err) return cb(err);
        if (walletId) {
          return this.storage.fetchWallet(walletId, end);
        }

        return cb();
      }
    );
  }

  /**
   * Retrieves wallet status.
   * @param {Object} opts
   * @param {Object} opts.includeExtendedInfo - Include PKR info & address managers for wallet & copayers
   * @param {Object} opts.includeServerMessages - Include server messages array
   * @returns {Object} status
   */
  getStatus(opts, cb) {
    opts = opts || {};

    const status: {
      wallet?: IWallet;
      serverMessage?: {
        title: string,
        body: string,
        link: string,
        id: string,
        dismissible: boolean,
        category: string,
        app: string
      };
      serverMessages?: Array<{
        title: string,
        body: string,
        link: string,
        id: string,
        dismissible: boolean,
        category: string,
        app: string,
        priority: number
      }>;
      balance?: string;
      pendingTxps?: ITxProposal[];
      preferences?: boolean;
    } = {};
    async.parallel(
      [
        (next) => {
          this.getWallet({}, (err, wallet) => {
            if (err) return next(err);

            const walletExtendedKeys = [
              'publicKeyRing',
              'pubKey',
              'addressManager'
            ];
            const copayerExtendedKeys = [
              'xPubKey',
              'requestPubKey',
              'signature',
              'addressManager',
              'customData'
            ];

            wallet.copayers = _.map(wallet.copayers, (copayer) => {
              if (copayer.id == this.copayerId) return copayer;
              return _.omit(copayer, 'customData');
            });
            if (!opts.includeExtendedInfo) {
              wallet = _.omit(wallet, walletExtendedKeys);
              wallet.copayers = _.map(wallet.copayers, (copayer) => {
                return _.omit(copayer, copayerExtendedKeys);
              });
            }
            status.wallet = wallet;

            if (opts.includeServerMessages) {
              status.serverMessages = serverMessages(
                wallet,
                this.appName,
                this.appVersion
              );
            } else {
              status.serverMessage = deprecatedServerMessage(wallet, this.appName, this.appVersion);
            }
            next();
          });
        },
        (next) => {
          opts.wallet = status.wallet;
          this.getBalance(opts, (err, balance) => {
            // ignore WALLET_NEED_SCAN err is includeExtendedInfo is given
            // (to allow `importWallet` to import a wallet, while scan has
            // failed)
            if (opts.includeExtendedInfo) {
              if (err && err.code != 'WALLET_NEED_SCAN') {
                return next(err);
              }
            } else if (err) {
              return next(err);
            }

            status.balance = balance;
            next();
          });
        },
        (next) => {
          this.getPendingTxs({}, (err, pendingTxps) => {
            if (err) return next(err);
            status.pendingTxps = pendingTxps;
            next();
          });
        },
        (next) => {
          this.getPreferences({}, (err, preferences) => {
            if (err) return next(err);
            status.preferences = preferences;
            next();
          });
        }
      ],
      (err) => {
        if (err) return cb(err);
        return cb(null, status);
      }
    );
  }

  /*
   * Verifies a signature
   * @param text
   * @param signature
   * @param pubKeys
   */
  _verifySignature(text, signature, pubkey) {
    return Utils.verifyMessage(text, signature, pubkey);
  }

  /*
   * Verifies a request public key
   * @param requestPubKey
   * @param signature
   * @param xPubKey
   */
  _verifyRequestPubKey(requestPubKey, signature, xPubKey) {
    const pub = new Bitcore.HDPublicKey(xPubKey).deriveChild(
      Constants.PATHS.REQUEST_KEY_AUTH
    ).publicKey;
    return Utils.verifyMessage(requestPubKey, signature, pub.toString());
  }

  /*
   * Verifies signature againt a collection of pubkeys
   * @param text
   * @param signature
   * @param pubKeys
   */
  _getSigningKey(text, signature, pubKeys) {
    return _.find(pubKeys, (item) => {
      return this._verifySignature(text, signature, item.key);
    });
  }

  /**
   * _notify
   *
   * @param {String} type
   * @param {Object} data
   * @param {Object} opts
   * @param {Boolean} opts.isGlobal - If true, the notification is not issued on behalf of any particular copayer (defaults to false)
   */
  _notify(type, data, opts, cb?: (err?: any, data?: any) => void) {
    if (_.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    opts = opts || {};

    // this.logi('Notification', type);

    cb = cb || function() { };

    const walletId = this.walletId || data.walletId;
    const copayerId = this.copayerId || data.copayerId;

    $.checkState(walletId);

    const notification = Notification.create({
      type,
      data,
      ticker: this.notifyTicker++,
      creatorId: opts.isGlobal ? null : copayerId,
      walletId
    });

    this.storage.storeNotification(walletId, notification, () => {
      this.messageBroker.send(notification);
      return cb();
    });
  }

  _notifyTxProposalAction(
    type,
    txp,
    extraArgs,
    cb?: (err?: any, data?: any) => void
  ) {
    if (_.isFunction(extraArgs)) {
      cb = extraArgs;
      extraArgs = {};
    }

    const data = _.assign(
      {
        txProposalId: txp.id,
        creatorId: txp.creatorId,
        amount: txp.getTotalAmount(),
        message: txp.message
      },
      extraArgs
    );
    this._notify(type, data, {}, cb);
  }

  _addCopayerToWallet(wallet, opts, cb) {
    const copayer = Copayer.create({
      coin: wallet.coin,
      name: opts.name,
      copayerIndex: wallet.copayers.length,
      xPubKey: opts.xPubKey,
      requestPubKey: opts.requestPubKey,
      signature: opts.copayerSignature,
      customData: opts.customData,
      derivationStrategy: wallet.derivationStrategy
    });

    this.storage.fetchCopayerLookup(copayer.id, (err, res) => {
      if (err) return cb(err);
      if (res) return cb(Errors.COPAYER_REGISTERED);

      if (opts.dryRun)
        return cb(null, {
          copayerId: null,
          wallet
        });

      wallet.addCopayer(copayer);
      this.storage.storeWalletAndUpdateCopayersLookup(wallet, (err) => {
        if (err) return cb(err);

        async.series(
          [
            (next) => {
              this._notify(
                'NewCopayer',
                {
                  walletId: opts.walletId,
                  copayerId: copayer.id,
                  copayerName: copayer.name
                },
                {},
                next
              );
            },
            (next) => {
              if (wallet.isComplete() && wallet.isShared()) {
                this._notify(
                  'WalletComplete',
                  {
                    walletId: opts.walletId
                  },
                  {
                    isGlobal: true
                  },
                  next
                );
              } else {
                next();
              }
            }
          ],
          () => {
            return cb(null, {
              copayerId: copayer.id,
              wallet
            });
          }
        );
      });
    });
  }

  _addKeyToCopayer(wallet, copayer, opts, cb) {
    wallet.addCopayerRequestKey(
      copayer.copayerId,
      opts.requestPubKey,
      opts.signature,
      opts.restrictions,
      opts.name
    );
    this.storage.storeWalletAndUpdateCopayersLookup(wallet, (err) => {
      if (err) return cb(err);

      return cb(null, {
        copayerId: copayer.id,
        wallet
      });
    });
  }

  /**
   * Adds access to a given copayer
   *
   * @param {Object} opts
   * @param {string} opts.copayerId - The copayer id
   * @param {string} opts.requestPubKey - Public Key used to check requests from this copayer.
   * @param {string} opts.copayerSignature - S(requestPubKey). Used by other copayers to verify the that the copayer is himself (signed with REQUEST_KEY_AUTH)
   * @param {string} opts.restrictions
   *    - cannotProposeTXs
   *    - cannotXXX TODO
   * @param {string} opts.name  (name for the new access)
   */
  addAccess(opts, cb) {
    if (!checkRequired(opts, ['copayerId', 'requestPubKey', 'signature'], cb))
      return;

    this.storage.fetchCopayerLookup(opts.copayerId, (err, copayer) => {
      if (err) return cb(err);
      if (!copayer) return cb(Errors.NOT_AUTHORIZED);
      this.storage.fetchWallet(copayer.walletId, (err, wallet) => {
        if (err) return cb(err);
        if (!wallet) return cb(Errors.NOT_AUTHORIZED);

        const xPubKey = wallet.copayers.find(c => c.id === opts.copayerId)
          .xPubKey;

        if (
          !this._verifyRequestPubKey(
            opts.requestPubKey,
            opts.signature,
            xPubKey
          )
        ) {
          return cb(Errors.NOT_AUTHORIZED);
        }

        if (copayer.requestPubKeys.length > Defaults.MAX_KEYS)
          return cb(Errors.TOO_MANY_KEYS);

        this._addKeyToCopayer(wallet, copayer, opts, cb);
      });
    });
  }

  _setClientVersion(version) {
    delete this.parsedClientVersion;
    this.clientVersion = version;
  }

  _setAppVersion(userAgent) {
    const parsed = Utils.parseAppVersion(userAgent);
    if (!parsed) {
      this.appName = this.appVersion = null;
    } else {
      this.appName = parsed.app;
      this.appVersion = parsed;
    }
  }

  _parseClientVersion() {
    if (_.isUndefined(this.parsedClientVersion)) {
      this.parsedClientVersion = Utils.parseVersion(this.clientVersion);
    }
    return this.parsedClientVersion;
  }

  _clientSupportsPayProRefund() {
    const version = this._parseClientVersion();
    if (!version) return false;
    if (version.agent != 'bwc') return true;
    if (version.major < 1 || (version.major == 1 && version.minor < 2))
      return false;
    return true;
  }

  static _getCopayerHash(name, xPubKey, requestPubKey) {
    return [name, xPubKey, requestPubKey].join('|');
  }

  /**
   * Joins a wallet in creation.
   * @param {Object} opts
   * @param {string} opts.walletId - The wallet id.
   * @param {string} opts.coin[='btc'] - The expected coin for this wallet (btc, bch).
   * @param {string} opts.name - The copayer name.
   * @param {string} opts.xPubKey - Extended Public Key for this copayer.
   * @param {string} opts.requestPubKey - Public Key used to check requests from this copayer.
   * @param {string} opts.copayerSignature - S(name|xPubKey|requestPubKey). Used by other copayers to verify that the copayer joining knows the wallet secret.
   * @param {string} opts.customData - (optional) Custom data for this copayer.
   * @param {string} opts.dryRun[=false] - (optional) Simulate the action but do not change server state.
   */
  joinWallet(opts, cb) {
    if (
      !checkRequired(
        opts,
        ['walletId', 'name', 'xPubKey', 'requestPubKey', 'copayerSignature'],
        cb
      )
    )
      return;

    if (_.isEmpty(opts.name))
      return cb(new ClientError('Invalid copayer name'));

    opts.coin = opts.coin || Defaults.COIN;
    if (!Utils.checkValueInCollection(opts.coin, Constants.COINS))
      return cb(new ClientError('Invalid coin'));

    let xPubKey;
    try {
      xPubKey = Bitcore.HDPublicKey(opts.xPubKey);
    } catch (ex) {
      return cb(new ClientError('Invalid extended public key'));
    }
    if (_.isUndefined(xPubKey.network)) {
      return cb(new ClientError('Invalid extended public key'));
    }

    this.walletId = opts.walletId;
    this._runLocked(cb, (cb) => {
      this.storage.fetchWallet(opts.walletId, (err, wallet) => {
        if (err) return cb(err);
        if (!wallet) return cb(Errors.WALLET_NOT_FOUND);

        if (opts.coin === 'bch' && wallet.n > 1) {
          const version = Utils.parseVersion(this.clientVersion);
          if (version && version.agent === 'bwc') {
            if (version.major < 8 || (version.major === 8 && version.minor < 3)) {
              return cb(new ClientError(
                Errors.codes.UPGRADE_NEEDED,
                'BWC clients < 8.3 are no longer supported for multisig BCH wallets.',
              ));
            }
          }
        }

        if (wallet.n > 1 && wallet.usePurpose48) {
          const version = Utils.parseVersion(this.clientVersion);
          if (version && version.agent === 'bwc') {
            if (version.major < 8 || (version.major === 8 && version.minor < 4)) {
              return cb(new ClientError(
                Errors.codes.UPGRADE_NEEDED,
                'Please upgrade your client to join this multisig wallet',
              ));
            }
          }
        }

        if (opts.coin != wallet.coin) {
          return cb(
            new ClientError(
              'The wallet you are trying to join was created for a different coin'
            )
          );
        }

        if (wallet.network != xPubKey.network.name) {
          return cb(
            new ClientError(
              'The wallet you are trying to join was created for a different network'
            )
          );
        }

        // New client trying to join legacy wallet
        if (
          wallet.derivationStrategy == Constants.DERIVATION_STRATEGIES.BIP45
        ) {
          return cb(
            new ClientError(
              'The wallet you are trying to join was created with an older version of the client app.'
            )
          );
        }

        const hash = WalletService._getCopayerHash(
          opts.name,
          opts.xPubKey,
          opts.requestPubKey
        );
        if (
          !this._verifySignature(hash, opts.copayerSignature, wallet.pubKey)
        ) {
          return cb(new ClientError());
        }

        if (
          _.find(wallet.copayers, {
            xPubKey: opts.xPubKey
          })
        )
          return cb(Errors.COPAYER_IN_WALLET);

        if (wallet.copayers.length == wallet.n) return cb(Errors.WALLET_FULL);

        this._addCopayerToWallet(wallet, opts, cb);
      });
    });
  }

  /**
   * Save copayer preferences for the current wallet/copayer pair.
   * @param {Object} opts
   * @param {string} opts.email - Email address for notifications.
   * @param {string} opts.language - Language used for notifications.
   * @param {string} opts.unit - Bitcoin unit used to format amounts in notifications.
   */
  savePreferences(opts, cb) {
    opts = opts || {};

    const preferences = [
      {
        name: 'email',
        isValid(value) {
          return EmailValidator.validate(value);
        }
      },
      {
        name: 'language',
        isValid(value) {
          return _.isString(value) && value.length == 2;
        }
      },
      {
        name: 'unit',
        isValid(value) {
          return (
            _.isString(value) && _.includes(['btc', 'bit'], value.toLowerCase())
          );
        }
      }
    ];

    opts = _.pick(opts, _.map(preferences, 'name'));
    try {
      _.each(preferences, (preference) => {
        const value = opts[preference.name];
        if (!value) return;
        if (!preference.isValid(value)) {
          throw new Error('Invalid ' + preference.name);
        }
      });
    } catch (ex) {
      return cb(new ClientError(ex));
    }

    this._runLocked(cb, (cb) => {
      this.storage.fetchPreferences(this.walletId, this.copayerId, (
        err,
        oldPref
      ) => {
        if (err) return cb(err);

        const newPref = Preferences.create({
          walletId: this.walletId,
          copayerId: this.copayerId
        });
        const preferences = Preferences.fromObj(
          _.defaults(newPref, opts, oldPref)
        );
        this.storage.storePreferences(preferences, (err) => {
          return cb(err);
        });
      });
    });
  }

  /**
   * Retrieves a preferences for the current wallet/copayer pair.
   * @param {Object} opts
   * @returns {Object} preferences
   */
  getPreferences(opts, cb) {
    this.storage.fetchPreferences(this.walletId, this.copayerId, (
      err,
      preferences
    ) => {
      if (err) return cb(err);
      return cb(null, preferences || {});
    });
  }

  _canCreateAddress(ignoreMaxGap, cb) {
    if (ignoreMaxGap) return cb(null, true);

    this.storage.fetchAddresses(this.walletId, (
      err,
      addresses: IAddress[]
    ) => {
      if (err) return cb(err);
      const latestAddresses =
        addresses.filter(x => !x.isChange).slice(-Defaults.MAX_MAIN_ADDRESS_GAP) as IAddress[];
      if (
        latestAddresses.length < Defaults.MAX_MAIN_ADDRESS_GAP ||
        _.some(latestAddresses, {
          hasActivity: true
        })
      )
        return cb(null, true);

      const bc = this._getBlockchainExplorer(
        latestAddresses[0].coin,
        latestAddresses[0].network
      );
      if (!bc)
        return cb(new Error('Could not get blockchain explorer instance'));
      let activityFound = false;
      let i = latestAddresses.length;
      async.whilst(
        () => {
          return i > 0 && !activityFound;
        },
        (next) => {
          bc.getAddressActivity(latestAddresses[--i].address, (
            err,
            res
          ) => {
            if (err) return next(err);
            activityFound = !!res;
            return next();
          });
        },
        (err) => {
          if (err) return cb(err);
          if (!activityFound) return cb(null, false);

          const address = latestAddresses[i];
          address.hasActivity = true;
          this.storage.storeAddress(address, (err) => {
            return cb(err, true);
          });
        }
      );
    });
  }

  _store(wallet, address, cb, checkSync = false) {
    this.storage.storeAddressAndWallet(wallet, address, (err, duplicate) => {
      if (err) return cb(err);
      this.syncWallet(
        wallet,
        err2 => {
          if (err2) {
            this.logw('Error syncing v8 addresses: ', err2);
          }
          return cb(null, duplicate);
        },
        !checkSync
      );
    });
  }

  /**
   * Creates a new address.
   * @param {Object} opts
   * @param {Boolean} [opts.ignoreMaxGap=false] - Ignore constraint of maximum number of consecutive addresses without activity
   * @param {Boolean} opts.noCashAddr (do not use cashaddr, only for backwards compat)
   * @returns {Address} address
   */
  createAddress(opts, cb) {
    opts = opts || {};

    const createNewAddress = (wallet, cb) => {
      let address;
      try {
        address = wallet.createAddress(false);
      } catch (e) {
        this.logw('Error creating address', e);
        return cb('Bad xPub');
      }

      this._store(
        wallet,
        address,
        (err, duplicate) => {
          if (err) return cb(err);

          if (duplicate)
            return cb(null, address);

          this._notify(
            'NewAddress',
            {
              address: address.address
            },
            () => {
              return cb(null, address);
            }
          );
        },
        true
      );
    };

    const getFirstAddress = (wallet, cb) => {
      this.storage.fetchAddresses(this.walletId, (err, addresses) => {
        if (err) return cb(err);
        if (!_.isEmpty(addresses)) return cb(null, _.head(addresses));
        return createNewAddress(wallet, cb);
      });
    };

    this.getWallet({ doNotMigrate: opts.doNotMigrate }, (
      err,
      wallet
    ) => {
      if (err) return cb(err);

      // ETH has only one address
      if (wallet.coin == 'eth') {
        opts.ignoreMaxGap = true;
        opts.singleAddress = true;
      }

      this._canCreateAddress(opts.ignoreMaxGap || opts.singleAddress ||  wallet.singleAddress, (err, canCreate) => {
        if (err) return cb(err);
        if (!canCreate) return cb(Errors.MAIN_ADDRESS_GAP_REACHED);

        this._runLocked(
          cb,
          (cb) => {
            this.getWallet({ doNotMigrate: opts.doNotMigrate }, (
              err,
              wallet
            ) => {
              if (err) return cb(err);
              if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);
              if (wallet.scanStatus == 'error')
                return cb(Errors.WALLET_NEED_SCAN);

              const createFn = opts.singleAddress || wallet.singleAddress
                ? getFirstAddress
                : createNewAddress;
              return createFn(wallet, (err, address) => {
                if (err) {
                  return cb(err);
                }

                if (wallet.coin == 'bch' && opts.noCashAddr) {
                  address.address = BCHAddressTranslator.translate(
                    address.address,
                    'copay'
                  );
                }

                return cb(err, address);
              });
            });
          },
          10 * 1000
        );
      });
    });
  }

  /**
   * Get all addresses.
   * @param {Object} opts
   * @param {Numeric} opts.limit (optional) - Limit the resultset. Return all addresses by default.
   * @param {Boolean} [opts.reverse=false] (optional) - Reverse the order of returned addresses.
   * @returns {Address[]}
   */
  getMainAddresses(opts, cb) {
    opts = opts || {};
    this.storage.fetchAddresses(this.walletId, (err, addresses) => {
      if (err) return cb(err);

      let onlyMain = _.reject(addresses, {
        isChange: true
      });
      if (opts.reverse) onlyMain.reverse();
      if (opts.limit > 0) onlyMain = _.take(onlyMain, opts.limit);

      return cb(null, onlyMain);
    });
  }

  /**
   * Verifies that a given message was actually sent by an authorized copayer.
   * @param {Object} opts
   * @param {string} opts.message - The message to verify.
   * @param {string} opts.signature - The signature of message to verify.
   * @returns {truthy} The result of the verification.
   */
  verifyMessageSignature(opts, cb) {
    if (!checkRequired(opts, ['message', 'signature'], cb)) return;

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      const copayer = wallet.getCopayer(this.copayerId);

      const isValid = !!this._getSigningKey(
        opts.message,
        opts.signature,
        copayer.requestPubKeys
      );
      return cb(null, isValid);
    });
  }

  _getBlockchainExplorer(coin, network): ReturnType<typeof BlockChainExplorer> {
    let opts: Partial<{
      provider: string;
      coin: string;
      network: string;
      userAgent: string;
    }> = {};

    let provider;

    if (this.blockchainExplorer) return this.blockchainExplorer;
    if (this.blockchainExplorerOpts) {
      if (
        this.blockchainExplorerOpts[coin] &&
        this.blockchainExplorerOpts[coin][network]
      ) {
        opts = this.blockchainExplorerOpts[coin][network];
        provider = opts.provider;
      } else if (this.blockchainExplorerOpts[network]) {
        opts = this.blockchainExplorerOpts[network];
      }
    }
    opts.provider = provider;
    opts.coin = coin;
    opts.network = network;
    opts.userAgent = WalletService.getServiceVersion();
    let bc;
    try {
      bc = BlockChainExplorer(opts);
    } catch (ex) {
      this.logw('Could not instantiate blockchain explorer', ex);
    }
    return bc;
  }

  _getUtxosForCurrentWallet(opts, cb) {
    opts = opts || {};

    const utxoKey = (utxo) => {
      return utxo.txid + '|' + utxo.vout;
    };

    let coin, allAddresses, allUtxos, utxoIndex, addressStrs, bc, wallet;
    async.series(
      [
        (next) => {
          this.getWallet({}, (err, w) => {
            if (err) return next(err);

            wallet = w;

            if (wallet.scanStatus == 'error')
              return cb(Errors.WALLET_NEED_SCAN);

            coin = wallet.coin;

            bc = this._getBlockchainExplorer(coin, wallet.network);
            if (!bc)
              return cb(
                new Error('Could not get blockchain explorer instance')
              );
            return next();
          });
        },
        (next) => {
          if (_.isArray(opts.addresses)) {
            allAddresses = opts.addresses;
            return next();
          }

          // even with Grouping we need address for pubkeys and path (see last step)
          this.storage.fetchAddresses(this.walletId, (err, addresses) => {
            allAddresses = addresses;
            if (allAddresses.length == 0) return cb(null, []);

            return next();
          });
        },
        (next) => {
          addressStrs = _.map(allAddresses, 'address');
          return next();
        },
        (next) => {
          if (!wallet.isComplete()) return next();

          this._getBlockchainHeight(wallet.coin, wallet.network, (
            err,
            height,
            hash
          ) => {
            if (err) return next(err);

            const dustThreshold = Bitcore_[wallet.coin].Transaction.DUST_AMOUNT;
            bc.getUtxos(wallet, height, (err, utxos) => {
              if (err) return next(err);
              if (utxos.length == 0) return cb(null, []);

              // filter out DUST
              allUtxos = _.filter(utxos, (x) => {
                return x.satoshis >= dustThreshold;
              });

              utxoIndex = _.keyBy(allUtxos, utxoKey);
              return next();
            });
          });
        },
        (next) => {
          this.getPendingTxs({}, (err, txps) => {
            if (err) return next(err);

            const lockedInputs = _.map(_.flatten(_.map(txps, 'inputs')), utxoKey);
            _.each(lockedInputs, (input) => {
              if (utxoIndex[input]) {
                utxoIndex[input].locked = true;
              }
            });
            log.debug(`Got  ${lockedInputs.length} locked utxos`);
            return next();
          });
        },
        (next) => {
          const now = Math.floor(Date.now() / 1000);
          // Fetch latest broadcasted txs and remove any spent inputs from the
          // list of UTXOs returned by the block explorer. This counteracts any out-of-sync
          // effects between broadcasting a tx and getting the list of UTXOs.
          // This is especially true in the case of having multiple instances of the block explorer.
          this.storage.fetchBroadcastedTxs(
            this.walletId,
            {
              minTs: now - 24 * 3600,
              limit: 100
            },
            (err, txs) => {
              if (err) return next(err);
              const spentInputs = _.map(_.flatten(_.map(txs, 'inputs')), utxoKey);
              _.each(spentInputs, (input) => {
                if (utxoIndex[input]) {
                  utxoIndex[input].spent = true;
                }
              });
              allUtxos = _.reject(allUtxos, {
                spent: true
              });
              log.debug(`Got ${allUtxos.length} usable UTXOs`);
              return next();
            }
          );
        },
        (next) => {
          // Needed for the clients to sign UTXOs
          const addressToPath = _.keyBy(allAddresses, 'address');
          _.each(allUtxos, (utxo) => {
            if (!addressToPath[utxo.address]) {
              if (!opts.addresses) this.logw('Ignored UTXO!: ' + utxo.address);
              return;
            }
            utxo.path = addressToPath[utxo.address].path;
            utxo.publicKeys = addressToPath[utxo.address].publicKeys;
          });
          return next();
        }
      ],
      (err: any) => {
        // TODO`
        if (err && err.statusCode == 404) {
          return this.registerWalletV8(wallet, cb);
        }
        return cb(err, allUtxos);
      }
    );
  }

  /**
   * Returns list of UTXOs
   * @param {Object} opts
   * @param {Array} [opts.addresses] - List of addresses. options. only one address is supported
   * @returns {Array} utxos - List of UTXOs.
   */
  getUtxos(opts, cb) {
    opts = opts || {};

    if (opts.coin) {
      return cb(new ClientError('coins option no longer supported'));
    }

    if (opts.addresses) {
      if (opts.addresses.length > 1)
        return cb(new ClientError('Addresses option only support 1 address'));

      this.getWallet({}, (err, wallet) => {
        if (err) return cb(err);

        const bc = this._getBlockchainExplorer(wallet.coin, wallet.network);
        if (!bc) {
          return cb(new Error('Could not get blockchain explorer instance'));
        }

        const address = opts.addresses[0];
        const A = Bitcore_[wallet.coin].Address;
        let addrObj: { network?: { name?: string } } = {};
        try {
          addrObj = new A(address);
        } catch (ex) {
          return cb(null, []);
        }
        if (addrObj.network.name != wallet.network) {
          return cb(null, []);
        }

        this._getBlockchainHeight(wallet.coin, wallet.network, (
          err,
          height,
          hash
        ) => {
          if (err) return cb(err);
          bc.getAddressUtxos(address, height, (err, utxos) => {
            if (err) return cb(err);
            return cb(null, utxos);
          });
        });
      });
    } else {
      this._getUtxosForCurrentWallet({}, cb);
    }
  }

  _totalizeUtxos(utxos) {
    const balance = {
      totalAmount: _.sumBy(utxos, 'satoshis'),
      lockedAmount: _.sumBy(_.filter(utxos, 'locked'), 'satoshis'),
      totalConfirmedAmount: _.sumBy(
        _.filter(utxos, 'confirmations'),
        'satoshis'
      ),
      lockedConfirmedAmount: _.sumBy(
        _.filter(_.filter(utxos, 'locked'), 'confirmations'),
        'satoshis'
      ),
      availableAmount: undefined,
      availableConfirmedAmount: undefined
    };
    balance.availableAmount = balance.totalAmount - balance.lockedAmount;
    balance.availableConfirmedAmount =
      balance.totalConfirmedAmount - balance.lockedConfirmedAmount;

    return balance;
  }

  /**
   * Converts Bitcore Balance Response.
   * @param {Object} bitcoreBalance - { unconfirmed, confirmed, balance }
   * @param {Number} locked - Sum of txp.amount
   * @returns {Object} balance - Total amount & locked amount.
   */
  _convertBitcoreBalance(bitcoreBalance, locked) {
    const { unconfirmed, confirmed, balance } = bitcoreBalance;
    // we ASUME all locked as confirmed, for ETH.
    const convertedBalance = {
      totalAmount: balance,
      totalConfirmedAmount: confirmed,
      lockedAmount: locked,
      lockedConfirmedAmount: confirmed - locked,
      availableAmount: balance - locked,
      availableConfirmedAmount: confirmed - locked,
      byAddress: []
    };
    return convertedBalance;
  }

  /**
   * Get wallet balance.
   * @param {Object} opts
   * @returns {Object} balance - Total amount & locked amount.
   */

  getBalance(opts, cb) {
    opts = opts || {};

    if (opts.coin) {
      return cb(new ClientError('coin is not longer supported in getBalance'));
    }
    let wallet = opts.wallet;

    const setWallet = cb1 => {
      if (wallet) return cb1();
      this.getWallet({}, (err, ret) => {
        if (err) return cb(err);
        wallet = ret;
        return cb1(null, wallet);
      });
    };

    setWallet(() => {
      if (!wallet.isComplete()) {
        return cb(null, this._totalizeUtxos([]));
      }

      const bc = this._getBlockchainExplorer(wallet.coin, wallet.network);
      if (!bc) {
        return cb(new Error('Could not get blockchain explorer instance'));
      }

      this.syncWallet(wallet, err => {
        if (err) return cb(err);

        if (! wallet.isUTXOCoin()) {
          bc.getBalance(wallet, (err, balance) => {
            if (err) {
              return cb(err);
            }
            this.getPendingTxs({}, (err, txps) => {
              if (err) return cb(err);
              const lockedSum = _.sumBy(txps, 'amount');
              const convertedBalance = this._convertBitcoreBalance(balance, lockedSum);
              this.storage.fetchAddresses(this.walletId, (
                err,
                addresses: IAddress[]
              ) => {
                if (err) return cb(err);
                if (addresses.length > 0) {
                  const byAddress = [{
                    address: addresses[0].address,
                    path: Constants.PATHS.SINGLE_ADDRESS,
                    amount: convertedBalance.totalAmount
                  }];
                  convertedBalance.byAddress = byAddress;
                }
                return cb(null, convertedBalance);
              });
            });
          });
        } else {
          this._getUtxosForCurrentWallet(
            {
              coin: opts.coin,
              addresses: opts.addresses
            },
            (err, utxos) => {
              if (err) return cb(err);

              const balance = { ...this._totalizeUtxos(utxos), byAddress: [] };

              // Compute balance by address
              const byAddress = {};
              _.each(_.keyBy(_.sortBy(utxos, 'address'), 'address'), (
                value,
                key
              ) => {
                byAddress[key] = {
                  address: key,
                  path: value.path,
                  amount: 0
                };
              });

              _.each(utxos, (utxo) => {
                byAddress[utxo.address].amount += utxo.satoshis;
              });

              balance.byAddress = _.values(byAddress);

              return cb(null, balance);
            }
          );
        }
      });
    });
  }

  /**
   * Return info needed to send all funds in the wallet
   * @param {Object} opts
   * @param {number} opts.feeLevel[='normal'] - Optional. Specify the fee level for this TX ('priority', 'normal', 'economy', 'superEconomy') as defined in Defaults.FEE_LEVELS.
   * @param {number} opts.feePerKb - Optional. Specify the fee per KB for this TX (in satoshi).
   * @param {string} opts.excludeUnconfirmedUtxos[=false] - Optional. Do not use UTXOs of unconfirmed transactions as inputs
   * @param {string} opts.returnInputs[=false] - Optional. Return the list of UTXOs that would be included in the tx.
   * @returns {Object} sendMaxInfo
   */
  getSendMaxInfo(opts, cb) {
    opts = opts || {};

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      const feeArgs =
        boolToNum(!!opts.feeLevel) + boolToNum(_.isNumber(opts.feePerKb));
      if (feeArgs > 1)
        return cb(
          new ClientError('Only one of feeLevel/feePerKb can be specified')
        );

      if (feeArgs == 0) {
        opts.feeLevel = 'normal';
      }

      const feeLevels = Defaults.FEE_LEVELS[wallet.coin];
      if (opts.feeLevel) {
        if (
          !_.some(feeLevels, {
            name: opts.feeLevel
          })
        )
          return cb(
            new ClientError(
              'Invalid fee level. Valid values are ' +
              _.map(feeLevels, 'name').join(', ')
            )
          );
      }

      if (_.isNumber(opts.feePerKb)) {
        if (
          opts.feePerKb < Defaults.MIN_FEE_PER_KB ||
          opts.feePerKb > Defaults.MAX_FEE_PER_KB[wallet.coin]
        )
          return cb(new ClientError('Invalid fee per KB'));
      }

      if (!wallet.isUTXOCoin() ) {
        this.getBalance({}, (err, balance) => {
          if (err) return cb(err);
          const { totalAmount, availableAmount } = balance;

          this.estimateGas({
            coin: wallet.coin,
            network: wallet.network,
            from: opts.from,
            to: '0x0', // a dummy address
            value: totalAmount, // it will be lest that this, at the end
            data: null,
            gasPrice: opts.feePerKb,
          }, (err, gasLimit) => {
            let fee = opts.feePerKb * (gasLimit || Defaults.DEFAULT_GAS_LIMIT);
            return cb(null, {
              utxosBelowFee: 0,
              amountBelowFee: 0,
              amount: availableAmount - fee,
              feePerKb: opts.feePerKb,
              fee,
            });
          });
        });
      }  else {
        this._getUtxosForCurrentWallet({}, (err, utxos) => {
          if (err) return cb(err);

          const info = {
            size: 0,
            amount: 0,
            fee: 0,
            feePerKb: 0,
            inputs: [],
            utxosBelowFee: 0,
            amountBelowFee: 0,
            utxosAboveMaxSize: 0,
            amountAboveMaxSize: 0
          };

          let inputs = _.reject(utxos, 'locked');
          if (!!opts.excludeUnconfirmedUtxos) {
            inputs = _.filter(inputs, 'confirmations');
          }
          inputs = _.sortBy(inputs, (input) => {
            return -input.satoshis;
          });

          if (_.isEmpty(inputs)) return cb(null, info);

          this._getFeePerKb(wallet, opts, (err, feePerKb) => {
            if (err) return cb(err);

            info.feePerKb = feePerKb;

            const txp = TxProposal.create({
              walletId: this.walletId,
              coin: wallet.coin,
              network: wallet.network,
              walletM: wallet.m,
              walletN: wallet.n,
              feePerKb
            });

            const baseTxpSize = txp.getEstimatedSize();
            const sizePerInput = txp.getEstimatedSizeForSingleInput();
            const feePerInput = (sizePerInput * txp.feePerKb) / 1000;

            const partitionedByAmount = _.partition(inputs, (input) => {
              return input.satoshis > feePerInput;
            });

            info.utxosBelowFee = partitionedByAmount[1].length;
            info.amountBelowFee = _.sumBy(partitionedByAmount[1], 'satoshis');
            inputs = partitionedByAmount[0];

            _.each(inputs, (input, i) => {
              const sizeInKb = (baseTxpSize + (i + 1) * sizePerInput) / 1000;
              if (sizeInKb > Defaults.MAX_TX_SIZE_IN_KB[wallet.coin]) {
                info.utxosAboveMaxSize = inputs.length - i;
                info.amountAboveMaxSize = _.sumBy(_.slice(inputs, i), 'satoshis');
                return false;
              }
              txp.inputs.push(input);
            });

            if (_.isEmpty(txp.inputs)) return cb(null, info);

            const fee = txp.getEstimatedFee();
            const amount = _.sumBy(txp.inputs, 'satoshis') - fee;

            if (amount < Defaults.MIN_OUTPUT_AMOUNT) return cb(null, info);

            info.size = txp.getEstimatedSize();
            info.fee = fee;
            info.amount = amount;

            if (opts.returnInputs) {
              info.inputs = _.shuffle(txp.inputs);
            }

            return cb(null, info);
          });
        });
      }
    });
  }

  _sampleFeeLevels(coin, network, points, cb) {
    const bc = this._getBlockchainExplorer(coin, network);
    if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
    bc.estimateFee(points, (err, result) => {
      if (err) {
        this.logw('Error estimating fee', err);
        return cb(err);
      }

      const failed = [];
      const levels = _.fromPairs(
        _.map(points, (p) => {
          const feePerKb =
            _.isObject(result) && result[p] && _.isNumber(result[p])
              ? +result[p]
              : -1;
          if (feePerKb < 0) failed.push(p);

          // NOTE: ONLY BTC/BCH expect feePerKb to be Bitcoin amounts
          // others... expect wei.

          if (!Constants.UTXO_COINS[coin.toUpperCase()]) {
            return [p, feePerKb];
          } else {
            return [p, Utils.strip(feePerKb * 1e8)];
          }
        })
      );

      if (failed.length) {
        const logger = network == 'livenet' ? this.logw : this.logi;
        logger(
          'Could not compute fee estimation in ' +
          network +
          ': ' +
          failed.join(', ') +
          ' blocks.'
        );
      }

      return cb(null, levels, failed.length);
    });
  }

  /**
   * Returns fee levels for the current state of the network.
   * @param {Object} opts
   * @param {string} [opts.coin = 'btc'] - The coin to estimate fee levels from.
   * @param {string} [opts.network = 'livenet'] - The Bitcoin network to estimate fee levels from.
   * @returns {Object} feeLevels - A list of fee levels & associated amount per kB in satoshi.
   */
  getFeeLevels(opts, cb) {
    opts = opts || {};

    opts.coin = opts.coin || Defaults.COIN;
    if (!Utils.checkValueInCollection(opts.coin, Constants.COINS))
      return cb(new ClientError('Invalid coin'));

    opts.network = opts.network || 'livenet';
    if (!Utils.checkValueInCollection(opts.network, Constants.NETWORKS))
      return cb(new ClientError('Invalid network'));

    const cacheKey = 'feeLevel:' + opts.coin + ':' + opts.network;

    this.storage.checkAndUseGlobalCache(
      cacheKey,
      Defaults.FEE_LEVEL_CACHE_DURATION,
      (err, values, oldvalues) => {
        if (err) return cb(err);
        if (values) return cb(null, values, true);

        const feeLevels = Defaults.FEE_LEVELS[opts.coin];
        const samplePoints = () => {
          const definedPoints = _.uniq(_.map(feeLevels, 'nbBlocks'));
          return _.uniq(
            _.flatten(
              _.map(definedPoints, (p) => {
                return _.range(p, p + Defaults.FEE_LEVELS_FALLBACK + 1);
              })
            )
          );
        };

        const getFeeLevel = (feeSamples, level, n, fallback) => {
          let result;

          if (feeSamples[n] >= 0) {
            result = {
              nbBlocks: n,
              feePerKb: feeSamples[n]
            };
          } else {
            if (fallback > 0) {
              result = getFeeLevel(feeSamples, level, n + 1, fallback - 1);
            } else {
              result = {
                feePerKb: level.defaultValue,
                nbBlocks: null
              };
            }
          }
          return result;
        };

        this._sampleFeeLevels(opts.coin, opts.network, samplePoints(), (
          err,
          feeSamples,
          failed
        ) => {
          if (err) {
            if (oldvalues) {
              this.logw(
                '##  There was an error estimating fees... using old cached values'
              );
              return cb(null, oldvalues, true);
            }
          }

          const values = _.map(feeLevels, (level) => {
            const result: {
              feePerKb?: number;
              nbBlocks?: number;
              level: string;
            } = {
              level: level.name
            };
            if (err) {
              result.feePerKb = level.defaultValue;
              result.nbBlocks = null;
            } else {
              const feeLevel = getFeeLevel(
                feeSamples,
                level,
                level.nbBlocks,
                Defaults.FEE_LEVELS_FALLBACK
              );
              result.feePerKb = +(
                feeLevel.feePerKb * (level.multiplier || 1)
              ).toFixed(0);
              result.nbBlocks = feeLevel.nbBlocks;
            }
            return result;
          });

          // Ensure monotonically decreasing values
          for (let i = 1; i < values.length; i++) {
            values[i].feePerKb = Math.min(
              values[i].feePerKb,
              values[i - 1].feePerKb
            );
          }

          if (failed > 0) {
            this.logw('Not caching default values. Failed:' + failed);
            return cb(null, values);
          }

          this.storage.storeGlobalCache(cacheKey, values, err => {
            if (err) {
              this.logw('Could not store fee level cache');
            }
            return cb(null, values);
          });
        });
      }
    );
  }

  _checkTx(txp) {
    if (txp.getEstimatedSize() / 1000 > Defaults.MAX_TX_SIZE_IN_KB[txp.coin])
      return Errors.TX_MAX_SIZE_EXCEEDED;

    if (!Constants.UTXO_COINS[txp.coin.toUpperCase()]) {
      try {
        const bitcoreTx = txp.getBitcoreTx();
      } catch (ex) {
        this.logw('Error building Bitcore transaction', ex);
        return ex;
      }
    } else {
      let bitcoreError;

      const serializationOpts = {
        disableIsFullySigned: true,
        disableSmallFees: true,
        disableLargeFees: true
      };
      if (_.isEmpty(txp.inputPaths)) return Errors.NO_INPUT_PATHS;

      try {
        const bitcoreTx = txp.getBitcoreTx();
        bitcoreError = bitcoreTx.getSerializationError(serializationOpts);
        if (!bitcoreError) {
          txp.fee = bitcoreTx.getFee();
        }
      } catch (ex) {
        this.logw('Error building Bitcore transaction', ex);
        return ex;
      }

      if (bitcoreError instanceof Bitcore_[txp.coin].errors.Transaction.FeeError)
        return Errors.INSUFFICIENT_FUNDS_FOR_FEE;

      if (
        bitcoreError instanceof Bitcore_[txp.coin].errors.Transaction.DustOutputs
      )
        return Errors.DUST_AMOUNT;
      return bitcoreError;
    }
  }

  _selectTxInputs(txp, utxosToExclude, cb) {

    // todo: check inputs are ours and have enough value
    if (txp.inputs && !_.isEmpty(txp.inputs)) {

      if (!_.isNumber(txp.fee))
        txp.estimateFee();

      return cb(this._checkTx(txp));
    }

    const txpAmount = txp.getTotalAmount();
    const baseTxpSize = txp.getEstimatedSize();
    const baseTxpFee = (baseTxpSize * txp.feePerKb) / 1000;
    const sizePerInput = txp.getEstimatedSizeForSingleInput();
    const feePerInput = (sizePerInput * txp.feePerKb) / 1000;

    const sanitizeUtxos = (utxos) => {
      const excludeIndex = _.reduce(
        utxosToExclude,
        (res, val) => {
          res[val] = val;
          return res;
        },
        {}
      );

      return _.filter(utxos, (utxo) => {
        if (utxo.locked) return false;
        if (utxo.satoshis <= feePerInput) return false;
        if (txp.excludeUnconfirmedUtxos && !utxo.confirmations) return false;
        if (excludeIndex[utxo.txid + ':' + utxo.vout]) return false;
        return true;
      });
    };

    const select = (utxos, coin, cb) => {
      const totalValueInUtxos = _.sumBy(utxos, 'satoshis');
      const netValueInUtxos =
        totalValueInUtxos - baseTxpFee - utxos.length * feePerInput;

      if (totalValueInUtxos < txpAmount) {
        this.logd(
          'Total value in all utxos (' +
          Utils.formatAmountInBtc(totalValueInUtxos) +
          ') is insufficient to cover for txp amount (' +
          Utils.formatAmountInBtc(txpAmount) +
          ')'
        );
        return cb(Errors.INSUFFICIENT_FUNDS);
      }
      if (netValueInUtxos < txpAmount) {
        this.logd(
          'Value after fees in all utxos (' +
          Utils.formatAmountInBtc(netValueInUtxos) +
          ') is insufficient to cover for txp amount (' +
          Utils.formatAmountInBtc(txpAmount) +
          ')'
        );
        return cb(Errors.INSUFFICIENT_FUNDS_FOR_FEE);
      }

      const bigInputThreshold =
        txpAmount * Defaults.UTXO_SELECTION_MAX_SINGLE_UTXO_FACTOR +
        (baseTxpFee + feePerInput);
      this.logd(
        'Big input threshold ' + Utils.formatAmountInBtc(bigInputThreshold)
      );

      const partitions = _.partition(utxos, (utxo) => {
        return utxo.satoshis > bigInputThreshold;
      });

      const bigInputs = _.sortBy(partitions[0], 'satoshis');
      const smallInputs = _.sortBy(partitions[1], (utxo) => {
        return -utxo.satoshis;
      });

      // log.debug('Considering ' + bigInputs.length + ' big inputs (' + Utils.formatUtxos(bigInputs) + ')');
      // log.debug('Considering ' + smallInputs.length + ' small inputs (' + Utils.formatUtxos(smallInputs) + ')');

      let total = 0;
      let netTotal = -baseTxpFee;
      let selected = [];
      let fee;
      let error;

      _.each(smallInputs, (input, i) => {
        // log.debug('Input #' + i + ': ' + Utils.formatUtxos(input));

        const netInputAmount = input.satoshis - feePerInput;

        // log.debug('The input contributes ' + Utils.formatAmountInBtc(netInputAmount));

        selected.push(input);

        total += input.satoshis;
        netTotal += netInputAmount;

        const txpSize = baseTxpSize + selected.length * sizePerInput;
        fee = Math.round(baseTxpFee + selected.length * feePerInput);

        // log.debug('Tx size: ' + Utils.formatSize(txpSize) + ', Tx fee: ' + Utils.formatAmountInBtc(fee));

        const feeVsAmountRatio = fee / txpAmount;
        const amountVsUtxoRatio = netInputAmount / txpAmount;

        // log.debug('Fee/Tx amount: ' + Utils.formatRatio(feeVsAmountRatio) + ' (max: ' + Utils.formatRatio(Defaults.UTXO_SELECTION_MAX_FEE_VS_TX_AMOUNT_FACTOR) + ')');
        // log.debug('Tx amount/Input amount:' + Utils.formatRatio(amountVsUtxoRatio) + ' (min: ' + Utils.formatRatio(Defaults.UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR) + ')');

        if (txpSize / 1000 > Defaults.MAX_TX_SIZE_IN_KB[coin]) {
          // log.debug('Breaking because tx size (' + Utils.formatSize(txpSize) + ') is too big (max: ' + Utils.formatSize(Defaults.MAX_TX_SIZE_IN_KB[coin] * 1000.) + ')');
          error = Errors.TX_MAX_SIZE_EXCEEDED;
          return false;
        }

        if (!_.isEmpty(bigInputs)) {
          if (
            amountVsUtxoRatio <
            Defaults.UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR
          ) {
            // log.debug('Breaking because utxo is too small compared to tx amount');
            return false;
          }

          if (
            feeVsAmountRatio >
            Defaults.UTXO_SELECTION_MAX_FEE_VS_TX_AMOUNT_FACTOR
          ) {
            const feeVsSingleInputFeeRatio = fee / (baseTxpFee + feePerInput);
            // log.debug('Fee/Single-input fee: ' + Utils.formatRatio(feeVsSingleInputFeeRatio) + ' (max: ' + Utils.formatRatio(Defaults.UTXO_SELECTION_MAX_FEE_VS_SINGLE_UTXO_FEE_FACTOR) + ')' + ' loses wrt single-input tx: ' + Utils.formatAmountInBtc((selected.length - 1) * feePerInput));
            if (
              feeVsSingleInputFeeRatio >
              Defaults.UTXO_SELECTION_MAX_FEE_VS_SINGLE_UTXO_FEE_FACTOR
            ) {
              // log.debug('Breaking because fee is too significant compared to tx amount and it is too expensive compared to using single input');
              return false;
            }
          }
        }

        // log.debug('Cumuled total so far: ' + Utils.formatAmountInBtc(total) + ', Net total so far: ' + Utils.formatAmountInBtc(netTotal));

        if (netTotal >= txpAmount) {
          const changeAmount = Math.round(total - txpAmount - fee);
          // log.debug('Tx change: ', Utils.formatAmountInBtc(changeAmount));

          const dustThreshold = Math.max(
            Defaults.MIN_OUTPUT_AMOUNT,
            Bitcore_[txp.coin].Transaction.DUST_AMOUNT
          );
          if (changeAmount > 0 && changeAmount <= dustThreshold) {
            // log.debug('Change below dust threshold (' + Utils.formatAmountInBtc(dustThreshold) + '). Incrementing fee to remove change.');
            // Remove dust change by incrementing fee
            fee += changeAmount;
          }

          return false;
        }
      });

      if (netTotal < txpAmount) {
        // log.debug('Could not reach Txp total (' + Utils.formatAmountInBtc(txpAmount) + '), still missing: ' + Utils.formatAmountInBtc(txpAmount - netTotal));

        selected = [];
        if (!_.isEmpty(bigInputs)) {
          const input = _.head(bigInputs);
          // log.debug('Using big input: ', Utils.formatUtxos(input));
          total = input.satoshis;
          fee = Math.round(baseTxpFee + feePerInput);
          netTotal = total - fee;
          selected = [input];
        }
      }

      if (_.isEmpty(selected)) {
        // log.debug('Could not find enough funds within this utxo subset');
        return cb(error || Errors.INSUFFICIENT_FUNDS_FOR_FEE);
      }

      return cb(null, selected, fee);
    };

    // log.debug('Selecting inputs for a ' + Utils.formatAmountInBtc(txp.getTotalAmount()) + ' txp');

    this._getUtxosForCurrentWallet({}, (err, utxos) => {
      if (err) return cb(err);

      let totalAmount;
      let availableAmount;

      const balance = this._totalizeUtxos(utxos);
      if (txp.excludeUnconfirmedUtxos) {
        totalAmount = balance.totalConfirmedAmount;
        availableAmount = balance.availableConfirmedAmount;
      } else {
        totalAmount = balance.totalAmount;
        availableAmount = balance.availableAmount;
      }

      if (totalAmount < txp.getTotalAmount())
        return cb(Errors.INSUFFICIENT_FUNDS);
      if (availableAmount < txp.getTotalAmount())
        return cb(Errors.LOCKED_FUNDS);

      utxos = sanitizeUtxos(utxos);

      // log.debug('Considering ' + utxos.length + ' utxos (' + Utils.formatUtxos(utxos) + ')');

      const groups = [6, 1];
      if (!txp.excludeUnconfirmedUtxos) groups.push(0);

      let inputs = [];
      let fee;
      let selectionError;
      let i = 0;
      let lastGroupLength;
      async.whilst(
        () => {
          return i < groups.length && _.isEmpty(inputs);
        },
        (next) => {
          const group = groups[i++];

          const candidateUtxos = _.filter(utxos, (utxo) => {
            return utxo.confirmations >= group;
          });

          // log.debug('Group >= ' + group);

          // If this group does not have any new elements, skip it
          if (lastGroupLength === candidateUtxos.length) {
            // log.debug('This group is identical to the one already explored');
            return next();
          }

          // log.debug('Candidate utxos: ' + Utils.formatUtxos(candidateUtxos));

          lastGroupLength = candidateUtxos.length;

          select(candidateUtxos, txp.coin, (err, selectedInputs, selectedFee) => {
            if (err) {
              // log.debug('No inputs selected on this group: ', err);
              selectionError = err;
              return next();
            }

            selectionError = null;
            inputs = selectedInputs;
            fee = selectedFee;

            // log.debug('Selected inputs from this group: ' + Utils.formatUtxos(inputs));
            // log.debug('Fee for this selection: ' + Utils.formatAmountInBtc(fee));

            return next();
          });
        },
        (err) => {
          if (err) return cb(err);
          if (selectionError || _.isEmpty(inputs))
            return cb(
              selectionError || new Error('Could not select tx inputs')
            );

          txp.setInputs(_.shuffle(inputs));
          txp.fee = fee;

          err = this._checkTx(txp);
          if (!err) {
            const change =
              _.sumBy(txp.inputs, 'satoshis') -
              _.sumBy(txp.outputs, 'amount') -
              txp.fee;
            this.logd(
              'Successfully built transaction. Total fees: ' +
              Utils.formatAmountInBtc(txp.fee) +
              ', total change: ' +
              Utils.formatAmountInBtc(change)
            );
          } else {
            this.logw('Error building transaction', err);
          }

          return cb(err);
        }
      );
    });
  }

  _canCreateTx(cb) {
    this.storage.fetchLastTxs(
      this.walletId,
      this.copayerId,
      5 + Defaults.BACKOFF_OFFSET,
      (err, txs) => {
        if (err) return cb(err);

        if (!txs.length) return cb(null, true);

        const lastRejections = _.takeWhile(txs, {
          status: 'rejected'
        });

        const exceededRejections =
          lastRejections.length - Defaults.BACKOFF_OFFSET;
        if (exceededRejections <= 0) return cb(null, true);

        const lastTxTs = txs[0].createdOn;
        const now = Math.floor(Date.now() / 1000);
        const timeSinceLastRejection = now - lastTxTs;
        const backoffTime = Defaults.BACKOFF_TIME;

        if (timeSinceLastRejection <= backoffTime)
          this.logd(
            'Not allowing to create TX: timeSinceLastRejection/backoffTime',
            timeSinceLastRejection,
            backoffTime
          );

        return cb(null, timeSinceLastRejection > backoffTime);
      }
    );
  }

  _validateAddr(wallet, inaddr, opts) {
    if (wallet.coin == 'eth') {
      try {
        Validation.validateAddress(
          wallet.coin.toUpperCase(),
          wallet.network,  // not really used for ETH. wallet.network is 'livenet/testnet/regtest' in wallet.
          inaddr,
        );
      } catch (ex) {
        return Errors.INVALID_ADDRESS;
      }

    } else {
      const A = Bitcore_[wallet.coin].Address;
      let addr: {
        network?: string;
        toString?: (cashAddr: boolean) => string;
      } = {};
      try {
        addr = new A(inaddr);
      } catch (ex) {
        return Errors.INVALID_ADDRESS;
      }
      if (addr.network.toString() != wallet.network) {
        return Errors.INCORRECT_ADDRESS_NETWORK;
      }

      if (wallet.coin == 'bch' && !opts.noCashAddr) {
        if (addr.toString(true) != inaddr) return Errors.ONLY_CASHADDR;
      }
    }

    return;
  }

  _validateOutputs(opts, wallet, cb) {
    if (_.isEmpty(opts.outputs))
      return new ClientError('No outputs were specified');

    for (let i = 0; i < opts.outputs.length; i++) {
      const output = opts.outputs[i];
      output.valid = false;

      const addrErr = this._validateAddr(wallet, output.toAddress, opts);
      if (addrErr) return addrErr;

      if (!checkRequired(output, ['toAddress', 'amount'])) {
        return new ClientError('Argument missing in output #' + (i + 1) + '.');
      }

      if (
        !_.isNumber(output.amount) ||
        _.isNaN(output.amount) ||
        output.amount <= 0
      ) {
        return new ClientError('Invalid amount');
      }

      if (wallet.isUTXOCoin()) {
        const dustThreshold = Math.max(
          Defaults.MIN_OUTPUT_AMOUNT,
          Bitcore_[wallet.coin].Transaction.DUST_AMOUNT
        );

        if (output.amount < dustThreshold) {
          return Errors.DUST_AMOUNT;
        }
      } else {
        if (opts.outputs.length != 1) {
          return Errors.MORE_THAT_ONE_OUTPUT;
        }
      }
      output.valid = true;
    }
    return null;
  }

  _validateAndSanitizeTxOpts(wallet, opts, cb) {
    async.series(
      [
        (next) => {
          const feeArgs =
            boolToNum(!!opts.feeLevel) +
            boolToNum(_.isNumber(opts.feePerKb)) +
            boolToNum(_.isNumber(opts.fee));
          if (feeArgs > 1)
            return next(
              new ClientError(
                'Only one of feeLevel/feePerKb/fee can be specified'
              )
            );

          if (feeArgs == 0) {
            opts.feeLevel = 'normal';
          }

          const feeLevels = Defaults.FEE_LEVELS[wallet.coin];
          if (opts.feeLevel) {
            if (
              !_.some(feeLevels, {
                name: opts.feeLevel
              })
            )
              return next(
                new ClientError(
                  'Invalid fee level. Valid values are ' +
                  _.map(feeLevels, 'name').join(', ')
                )
              );
          }

          if (_.isNumber(opts.fee) && _.isEmpty(opts.inputs) && wallet.isUTXOCoin())
            return next(
              new ClientError('fee can only be set when inputs are specified')
            );

          next();
        },
        (next) => {
          if (wallet.singleAddress && opts.changeAddress)
            return next(
              new ClientError(
                'Cannot specify change address on single-address wallet'
              )
            );
          next();
        },

        (next) => {
          if (!opts.sendMax) return next();
          if (!_.isArray(opts.outputs) || opts.outputs.length > 1) {
            return next(
              new ClientError(
                'Only one output allowed when sendMax is specified'
              )
            );
          }
          if (_.isNumber(opts.outputs[0].amount))
            return next(
              new ClientError('Amount is not allowed when sendMax is specified')
            );
          if (_.isNumber(opts.fee))
            return next(
              new ClientError(
                'Fee is not allowed when sendMax is specified (use feeLevel/feePerKb instead)'
              )
            );

          this.getSendMaxInfo(
            {
              feePerKb: opts.feePerKb,
              excludeUnconfirmedUtxos: !!opts.excludeUnconfirmedUtxos,
              returnInputs: true
            },
            (err, info) => {
              if (err) return next(err);
              opts.outputs[0].amount = info.amount;

              if (wallet.isUTXOCoin()) {
                opts.inputs = info.inputs;
              }

              return next();
            }
          );
        },
        (next) => {
          if (opts.validateOutputs === false) return next();
          const validationError = this._validateOutputs(opts, wallet, next);
          if (validationError) {
            return next(validationError);
          }
          next();
        },
        (next) => {
          // check outputs are on 'copay' format for BCH
          if (wallet.coin != 'bch') return next();
          if (!opts.noCashAddr) return next();

          // TODO remove one cashaddr is used internally (noCashAddr flag)?
          opts.origAddrOutputs = _.map(opts.outputs, x => {
            const ret: {
              toAddress?: string;
              amount?: number;
              message?: string;
            } = {
              toAddress: x.toAddress,
              amount: x.amount
            };
            if (x.message) ret.message = x.message;

            return ret;
          });
          opts.returnOrigAddrOutputs = false;
          _.each(opts.outputs, x => {
            if (!x.toAddress) return;

            let newAddr;
            try {
              newAddr = Bitcore_['bch'].Address(x.toAddress).toLegacyAddress();
            } catch (e) {
              return next(e);
            }
            if (x.txAddress != newAddr) {
              x.toAddress = newAddr;
              opts.returnOrigAddrOutputs = true;
            }
          });
          next();
        }
      ],
      cb
    );
  }

  _getFeePerKb(wallet, opts, cb) {
    if (_.isNumber(opts.feePerKb)) return cb(null, opts.feePerKb);
    this.getFeeLevels(
      {
        coin: wallet.coin,
        network: wallet.network
      },
      (err, levels) => {
        if (err) return cb(err);
        const level = levels.find(l => l.level === opts.feeLevel);
        if (!level) {
          const msg = 'Could not compute fee for "' + opts.feeLevel + '" level';
          this.logw(msg);
          return cb(new ClientError(msg));
        }
        return cb(null, level.feePerKb);
      }
    );
  }

  _getTransactionCount(wallet, address, cb) {
    const bc = this._getBlockchainExplorer(wallet.coin, wallet.network);
    if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
    bc.getTransactionCount(address, (err, nonce) => {
      if (err) {
        this.logw('Error estimating nonce', err);
        return cb(err);
      }
      return cb(null, nonce);
    });
  }

  estimateGas(opts, cb) {
    const bc = this._getBlockchainExplorer(opts.coin, opts.network);
    if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
    bc.estimateGas(opts, (err, gasLimit) => {
      if (err) {
        this.logw('Error estimating gas limit', err);
        return cb(err);
      }
      return cb(null, gasLimit);
    });
  }

  /**
   * Creates a new transaction proposal.
   * @param {Object} opts
   * @param {string} opts.txProposalId - Optional. If provided it will be used as this TX proposal ID. Should be unique in the scope of the wallet.
   * @param {Array} opts.outputs - List of outputs.
   * @param {string} opts.outputs[].toAddress - Destination address.
   * @param {number} opts.outputs[].amount - Amount to transfer in satoshi.
   * @param {string} opts.outputs[].message - A message to attach to this output.
   * @param {string} opts.message - A message to attach to this transaction.
   * @param {number} opts.feeLevel[='normal'] - Optional. Specify the fee level for this TX ('priority', 'normal', 'economy', 'superEconomy') as defined in Defaults.FEE_LEVELS.
   * @param {number} opts.feePerKb - Optional. Specify the fee per KB for this TX (in satoshi).
   * @param {string} opts.changeAddress - Optional. Use this address as the change address for the tx. The address should belong to the wallet. In the case of singleAddress wallets, the first main address will be used.
   * @param {Boolean} opts.sendMax - Optional. Send maximum amount of funds that make sense under the specified fee/feePerKb conditions. (defaults to false).
   * @param {string} opts.payProUrl - Optional. Paypro URL for peers to verify TX
   * @param {Boolean} opts.excludeUnconfirmedUtxos[=false] - Optional. Do not use UTXOs of unconfirmed transactions as inputs
   * @param {Boolean} opts.validateOutputs[=true] - Optional. Perform validation on outputs.
   * @param {Boolean} opts.dryRun[=false] - Optional. Simulate the action but do not change server state.
   * @param {Array} opts.inputs - Optional. Inputs for this TX
   * @param {number} opts.fee - Optional. Use an fixed fee for this TX (only when opts.inputs is specified)
   * @param {Boolean} opts.noShuffleOutputs - Optional. If set, TX outputs won't be shuffled. Defaults to false
   * @param {Boolean} [opts.noCashAddr] - do not use cashaddress for bch
   * @returns {TxProposal} Transaction proposal. outputs address format will use the same format as inpunt.
   */
  createTx(opts, cb) {
    opts = opts ? _.clone(opts) : {};

    const getChangeAddress = (wallet, cb) => {
      if (wallet.singleAddress) {
        this.storage.fetchAddresses(this.walletId, (err, addresses) => {
          if (err) return cb(err);
          if (_.isEmpty(addresses))
            return cb(new ClientError('The wallet has no addresses'));
          return cb(null, _.head(addresses));
        });
      } else {

        if (opts.changeAddress) {
          const addrErr = this._validateAddr(wallet, opts.changeAddress, opts);
          if (addrErr) return cb(addrErr);

          this.storage.fetchAddressByWalletId(
            wallet.id,
            opts.changeAddress,
            (err, address) => {
              if (err || !address) return cb(Errors.INVALID_CHANGE_ADDRESS);
              return cb(null, address);
            }
          );
        } else {
          return cb(null, wallet.createAddress(true), true);
        }
      }
    };

    const checkTxpAlreadyExists = (txProposalId, cb) => {
      if (!txProposalId) return cb();
      this.storage.fetchTx(this.walletId, txProposalId, cb);
    };

    this._runLocked(
      cb,
      (cb) => {
        let changeAddress, feePerKb, gasPrice, gasLimit;
        this.getWallet({}, (err, wallet) => {
          if (err) return cb(err);
          if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

          if (wallet.scanStatus == 'error') return cb(Errors.WALLET_NEED_SCAN);

          checkTxpAlreadyExists(opts.txProposalId, (err, txp) => {
            if (err) return cb(err);
            if (txp) return cb(null, txp);

            async.series(
              [
                (next) => {
                  this._validateAndSanitizeTxOpts(wallet, opts, next);
                },
                (next) => {
                  this._canCreateTx((err, canCreate) => {
                    if (err) return next(err);
                    if (!canCreate) return next(Errors.TX_CANNOT_CREATE);
                    next();
                  });
                },
                (next) => {
                  if (opts.sendMax) return next();
                  if (! wallet.isUTXOCoin()) {
                    return next();
                  }
                  getChangeAddress(wallet, (err, address, isNew) => {
                    if (err) return next(err);
                    changeAddress = address;

                    return next();
                  });
                },
                (next) => {
                  if (_.isNumber(opts.fee) && !_.isEmpty(opts.inputs))
                    return next();

                  this._getFeePerKb(wallet, opts, (err, inFeePerKb) => {
                    feePerKb = inFeePerKb;
                    if (! wallet.isUTXOCoin()) {
                      gasPrice = inFeePerKb;
                      const { from, data, outputs } = opts;
                      const { coin, network } = wallet;
                      this.estimateGas({
                        coin,
                        network,
                        from,
                        to: outputs[0].toAddress,
                        value: outputs[0].amount,
                        data,
                        gasPrice
                      },
                        (err, inGasLimit) => {
                          if (_.isNumber(opts.fee)) {
                            // This is used for sendmax
                            gasPrice = feePerKb =
                              Number((opts.fee /  (inGasLimit || Defaults.DEFAULT_GAS_LIMIT)).toFixed());
                          }

                          gasLimit = inGasLimit || Defaults.DEFAULT_GAS_LIMIT;
                          opts.fee = feePerKb * gasLimit;
                          return next();
                        });
                    } else {
                      next();
                    }
                  });
                },
                (next) => {
                  const txOpts = {
                    id: opts.txProposalId,
                    walletId: this.walletId,
                    creatorId: this.copayerId,
                    coin: wallet.coin,
                    network: wallet.network,
                    outputs: opts.outputs,
                    message: opts.message,
                    from: opts.from,
                    changeAddress,
                    feeLevel: opts.feeLevel,
                    feePerKb,
                    payProUrl: opts.payProUrl,
                    walletM: wallet.m,
                    walletN: wallet.n,
                    excludeUnconfirmedUtxos: !!opts.excludeUnconfirmedUtxos,
                    validateOutputs: !opts.validateOutputs,
                    addressType: wallet.addressType,
                    customData: opts.customData,
                    inputs: opts.inputs,
                    fee:
                      opts.inputs && !_.isNumber(opts.feePerKb)
                        ? opts.fee
                        : ! wallet.isUTXOCoin()
                          ? opts.fee
                          : null,
                    noShuffleOutputs: opts.noShuffleOutputs,
                    data: opts.data,
                    gasPrice,
                    gasLimit
                  };
                  txp = TxProposal.create(txOpts);
                  next();
                },
                (next) => {
                  if (! wallet.isUTXOCoin() ) {
                    this.getBalance({ wallet }, (err, balance) => {
                      if (err) return next(err);

                      const { totalAmount, availableAmount } = balance;
                      if (totalAmount < txp.getTotalAmount()) {
                        return cb(Errors.INSUFFICIENT_FUNDS);
                      } else if (availableAmount < txp.getTotalAmount()) {
                        return cb(Errors.LOCKED_FUNDS);
                      } else {
                        return next(this._checkTx(txp));
                      }
                    });
                  } else {

                    this._selectTxInputs(txp, opts.utxosToExclude, next);
                  }
                },
                (next) => {
                  if (wallet.isUTXOCoin() ) {
                    return next();
                  }
                  this._getTransactionCount(wallet, txp.from, (err, nonce) => {
                    txp.nonce = nonce;
                    return next();
                  });
                },
                (next) => {
                  if (!changeAddress || wallet.singleAddress || opts.dryRun || opts.changeAddress)
                    return next();

                  this._store(wallet, txp.changeAddress, next, true);
                },
                (next) => {
                  if (opts.dryRun) return next();

                  if (txp.coin == 'bch') {
                    if (opts.noCashAddr && txp.changeAddress) {
                      txp.changeAddress.address = BCHAddressTranslator.translate(
                        txp.changeAddress.address,
                        'copay'
                      );
                    }
                  }

                  this.storage.storeTx(wallet.id, txp, next);
                }
              ],
              (err) => {
                if (err) return cb(err);

                if (txp.coin == 'bch') {
                  if (opts.returnOrigAddrOutputs) {
                    log.info('Returning Orig BCH address outputs for compat');
                    txp.outputs = opts.origAddrOutputs;
                  }
                }
                return cb(null, txp);
              }
            );
          });
        });
      },
      10 * 1000
    );
  }

  /**
   * Publish an already created tx proposal so inputs are locked and other copayers in the wallet can see it.
   * @param {Object} opts
   * @param {string} opts.txProposalId - The tx id.
   * @param {string} opts.proposalSignature - S(raw tx). Used by other copayers to verify the proposal.
   * @param {Boolean} [opts.noCashAddr] - do not use cashaddress for bch
   */
  publishTx(opts, cb) {
    const utxoKey = (utxo) => {
      return utxo.txid + '|' + utxo.vout;
    };

    if (!checkRequired(opts, ['txProposalId', 'proposalSignature'], cb)) return;

    this._runLocked(cb, (cb) => {
      this.getWallet({}, (err, wallet) => {
        if (err) return cb(err);

        this.storage.fetchTx(this.walletId, opts.txProposalId, (
          err,
          txp
        ) => {
          if (err) return cb(err);
          if (!txp) return cb(Errors.TX_NOT_FOUND);
          if (!txp.isTemporary()) return cb(null, txp);

          const copayer = wallet.getCopayer(this.copayerId);

          let raw;
          try {
            raw = txp.getRawTx();
          } catch (ex) {
            return cb(ex);
          }
          const signingKey = this._getSigningKey(
            raw,
            opts.proposalSignature,
            copayer.requestPubKeys
          );
          if (!signingKey) {
            return cb(new ClientError('Invalid proposal signature'));
          }

          // Save signature info for other copayers to check
          txp.proposalSignature = opts.proposalSignature;
          if (signingKey.selfSigned) {
            txp.proposalSignaturePubKey = signingKey.key;
            txp.proposalSignaturePubKeySig = signingKey.signature;
          }

          // Verify UTXOs are still available
          if (Constants.UTXO_COINS[txp.coin.toUpperCase()]) {
            log.debug('Rechecking UTXOs availability for publishTx');

            this._getUtxosForCurrentWallet(
              {
                addresses: txp.inputs
              },
              (err, utxos) => {
                if (err) return cb(err);

                const txpInputs = _.map(txp.inputs, utxoKey);
                const utxosIndex = _.keyBy(utxos, utxoKey);
                const unavailable = _.some(txpInputs, (i) => {
                  const utxo = utxosIndex[i];
                  return !utxo || utxo.locked;
                });

                if (unavailable) return cb(Errors.UNAVAILABLE_UTXOS);

                txp.status = 'pending';
                this.storage.storeTx(this.walletId, txp, (err) => {
                  if (err) return cb(err);

                  this._notifyTxProposalAction('NewTxProposal', txp, () => {
                    if (opts.noCashAddr && txp.coin == 'bch') {
                      if (txp.changeAddress) {
                        txp.changeAddress.address = BCHAddressTranslator.translate(
                          txp.changeAddress.address,
                          'copay'
                        );
                      }
                    }
                    return cb(null, txp);
                  });
                });
              }
            );
          } else {
            txp.status = 'pending';
            this.storage.storeTx(this.walletId, txp, (err) => {
              if (err) return cb(err);

              this._notifyTxProposalAction('NewTxProposal', txp, () => {
                return cb(null, txp);
              });
            });
          }
        });
      });
    });
  }

  /**
   * Retrieves a tx from storage.
   * @param {Object} opts
   * @param {string} opts.txProposalId - The tx id.
   * @returns {Object} txProposal
   */
  getTx(opts, cb) {
    this.storage.fetchTx(this.walletId, opts.txProposalId, (err, txp) => {
      if (err) return cb(err);
      if (!txp) return cb(Errors.TX_NOT_FOUND);

      if (!txp.txid) return cb(null, txp);

      this.storage.fetchTxNote(this.walletId, txp.txid, (err, note) => {
        if (err) {
          this.logw('Error fetching tx note for ' + txp.txid);
        }
        txp.note = note;
        return cb(null, txp);
      });
    });
  }

  /**
   * Edit note associated to a txid.
   * @param {Object} opts
   * @param {string} opts.txid - The txid of the tx on the blockchain.
   * @param {string} opts.body - The contents of the note.
   */
  editTxNote(opts, cb) {
    if (!checkRequired(opts, 'txid', cb)) return;

    this._runLocked(cb, (cb) => {
      this.storage.fetchTxNote(this.walletId, opts.txid, (err, note) => {
        if (err) return cb(err);

        if (!note) {
          note = TxNote.create({
            walletId: this.walletId,
            txid: opts.txid,
            copayerId: this.copayerId,
            body: opts.body
          });
        } else {
          note.edit(opts.body, this.copayerId);
        }
        this.storage.storeTxNote(note, (err) => {
          if (err) return cb(err);
          this.storage.fetchTxNote(this.walletId, opts.txid, cb);
        });
      });
    });
  }

  /**
   * Get tx notes.
   * @param {Object} opts
   * @param {string} opts.txid - The txid associated with the note.
   */
  getTxNote(opts, cb) {
    if (!checkRequired(opts, 'txid', cb)) return;
    this.storage.fetchTxNote(this.walletId, opts.txid, cb);
  }

  /**
   * Get tx notes.
   * @param {Object} opts
   * @param {string} opts.minTs[=0] - The start date used to filter notes.
   */
  getTxNotes(opts, cb) {
    opts = opts || {};
    this.storage.fetchTxNotes(this.walletId, opts, cb);
  }

  /**
   * removeWallet
   *
   * @param opts
   * @param cb
   * @return {undefined}
   */
  removeWallet(opts, cb) {
    this._runLocked(cb, (cb) => {
      this.storage.removeWallet(this.walletId, cb);
    });
  }

  getRemainingDeleteLockTime(txp) {
    const now = Math.floor(Date.now() / 1000);

    const lockTimeRemaining = txp.createdOn + Defaults.DELETE_LOCKTIME - now;
    if (lockTimeRemaining < 0) return 0;

    // not the creator? need to wait
    if (txp.creatorId !== this.copayerId) return lockTimeRemaining;

    // has other approvers? need to wait
    const approvers = txp.getApprovers();
    if (
      approvers.length > 1 ||
      (approvers.length == 1 && approvers[0] !== this.copayerId)
    )
      return lockTimeRemaining;

    return 0;
  }

  /**
   * removePendingTx
   *
   * @param opts
   * @param {string} opts.txProposalId - The tx id.
   * @return {undefined}
   */
  removePendingTx(opts, cb) {
    if (!checkRequired(opts, ['txProposalId'], cb)) return;

    this._runLocked(cb, (cb) => {
      this.getTx(
        {
          txProposalId: opts.txProposalId
        },
        (err, txp) => {
          if (err) return cb(err);

          if (!txp.isPending()) return cb(Errors.TX_NOT_PENDING);

          const deleteLockTime = this.getRemainingDeleteLockTime(txp);
          if (deleteLockTime > 0) return cb(Errors.TX_CANNOT_REMOVE);

          this.storage.removeTx(this.walletId, txp.id, () => {
            this._notifyTxProposalAction('TxProposalRemoved', txp, cb);
          });
        }
      );
    });
  }

  _broadcastRawTx(coin, network, raw, cb) {
    const bc = this._getBlockchainExplorer(coin, network);
    if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
    bc.broadcast(raw, (err, txid) => {
      if (err) return cb(err);
      return cb(null, txid);
    });
  }

  /**
   * Broadcast a raw transaction.
   * @param {Object} opts
   * @param {string} [opts.coin = 'btc'] - The coin for this transaction.
   * @param {string} [opts.network = 'livenet'] - The Bitcoin network for this transaction.
   * @param {string} opts.rawTx - Raw tx data.
   */
  broadcastRawTx(opts, cb) {
    if (!checkRequired(opts, ['network', 'rawTx'], cb)) return;

    opts.coin = opts.coin || Defaults.COIN;
    if (!Utils.checkValueInCollection(opts.coin, Constants.COINS))
      return cb(new ClientError('Invalid coin'));

    opts.network = opts.network || 'livenet';
    if (!Utils.checkValueInCollection(opts.network, Constants.NETWORKS))
      return cb(new ClientError('Invalid network'));

    this._broadcastRawTx(opts.coin, opts.network, opts.rawTx, cb);
  }

  _checkTxInBlockchain(txp, cb) {
    if (!txp.txid) return cb();
    const bc = this._getBlockchainExplorer(txp.coin, txp.network);
    if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
    bc.getTransaction(txp.txid, (err, tx) => {
      if (err) return cb(err);
      return cb(null, !!tx);
    });
  }

  /**
   * Sign a transaction proposal.
   * @param {Object} opts
   * @param {string} opts.txProposalId - The identifier of the transaction.
   * @param {string} opts.signatures - The signatures of the inputs of this tx for this copayer (in apperance order)
   */
  signTx(opts, cb) {
    if (!checkRequired(opts, ['txProposalId', 'signatures'], cb)) return;

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      this.getTx(
        {
          txProposalId: opts.txProposalId
        },
        (err, txp) => {
          if (err) return cb(err);

          const action = _.find(txp.actions, {
            copayerId: this.copayerId
          });
          if (action) return cb(Errors.COPAYER_VOTED);
          if (!txp.isPending()) return cb(Errors.TX_NOT_PENDING);

          const copayer = wallet.getCopayer(this.copayerId);

          try {
            if (!txp.sign(this.copayerId, opts.signatures, copayer.xPubKey)) {
              this.logw('Error signing transaction (BAD_SIGNATURES)');
              this.logw('Client version:', this.clientVersion);
              this.logw('Arguments:', JSON.stringify(opts));
              this.logw('Transaction proposal:', JSON.stringify(txp));
              const raw = txp.getBitcoreTx().uncheckedSerialize();
              this.logw('Raw tx:', raw);
              return cb(Errors.BAD_SIGNATURES);
            }
          } catch (ex) {
            this.logw('Error signing transaction proposal', ex);
            return cb(ex);
          }

          this.storage.storeTx(this.walletId, txp, (err) => {
            if (err) return cb(err);

            async.series(
              [
                (next) => {
                  this._notifyTxProposalAction(
                    'TxProposalAcceptedBy',
                    txp,
                    {
                      copayerId: this.copayerId
                    },
                    next
                  );
                },
                (next) => {
                  if (txp.isAccepted()) {
                    this._notifyTxProposalAction(
                      'TxProposalFinallyAccepted',
                      txp,
                      next
                    );
                  } else {
                    next();
                  }
                }
              ],
              () => {
                return cb(null, txp);
              }
            );
          });
        }
      );
    });
  }

  _processBroadcast(txp, opts, cb) {
    $.checkState(txp.txid);
    opts = opts || {};

    txp.setBroadcasted();
    this.storage.storeTx(this.walletId, txp, (err) => {
      if (err) return cb(err);

      const extraArgs = {
        txid: txp.txid
      };
      if (opts.byThirdParty) {
        this._notifyTxProposalAction(
          'NewOutgoingTxByThirdParty',
          txp,
          extraArgs
        );
      } else {
        this._notifyTxProposalAction('NewOutgoingTx', txp, extraArgs);
      }

      return cb(null, txp);
    });
  }

  /**
   * Broadcast a transaction proposal.
   * @param {Object} opts
   * @param {string} opts.txProposalId - The identifier of the transaction.
   */
  broadcastTx(opts, cb) {
    if (!checkRequired(opts, ['txProposalId'], cb)) return;

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      this.getTx(
        {
          txProposalId: opts.txProposalId
        },
        (err, txp) => {
          if (err) return cb(err);

          if (txp.status == 'broadcasted')
            return cb(Errors.TX_ALREADY_BROADCASTED);
          if (txp.status != 'accepted') return cb(Errors.TX_NOT_ACCEPTED);

          let raw;
          try {
            raw = txp.getRawTx();
          } catch (ex) {
            return cb(ex);
          }
          this._broadcastRawTx(wallet.coin, wallet.network, raw, (
            err,
            txid
          ) => {
            if (err) {
              const broadcastErr = err;
              // Check if tx already in blockchain
              this._checkTxInBlockchain(txp, (err, isInBlockchain) => {
                if (err) return cb(err);
                if (!isInBlockchain) return cb(broadcastErr);

                this._processBroadcast(
                  txp,
                  {
                    byThirdParty: true
                  },
                  cb
                );
              });
            } else {
              this._processBroadcast(
                txp,
                {
                  byThirdParty: false
                },
                (err) => {
                  if (err) return cb(err);
                  return cb(null, txp);
                }
              );
            }
          });
        }
      );
    });
  }

  /**
   * Reject a transaction proposal.
   * @param {Object} opts
   * @param {string} opts.txProposalId - The identifier of the transaction.
   * @param {string} [opts.reason] - A message to other copayers explaining the rejection.
   */
  rejectTx(opts, cb) {
    if (!checkRequired(opts, ['txProposalId'], cb)) return;

    this.getTx(
      {
        txProposalId: opts.txProposalId
      },
      (err, txp) => {
        if (err) return cb(err);

        const action = _.find(txp.actions, {
          copayerId: this.copayerId
        });

        if (action) return cb(Errors.COPAYER_VOTED);
        if (txp.status != 'pending') return cb(Errors.TX_NOT_PENDING);

        txp.reject(this.copayerId, opts.reason);

        this.storage.storeTx(this.walletId, txp, (err) => {
          if (err) return cb(err);

          async.series(
            [
              (next) => {
                this._notifyTxProposalAction(
                  'TxProposalRejectedBy',
                  txp,
                  {
                    copayerId: this.copayerId
                  },
                  next
                );
              },
              (next) => {
                if (txp.status == 'rejected') {
                  const rejectedBy = _.map(
                    _.filter(txp.actions, {
                      type: 'reject'
                    }),
                    'copayerId'
                  );

                  this._notifyTxProposalAction(
                    'TxProposalFinallyRejected',
                    txp,
                    {
                      rejectedBy
                    },
                    next
                  );
                } else {
                  next();
                }
              }
            ],
            () => {
              return cb(null, txp);
            }
          );
        });
      }
    );
  }

  /**
   * Retrieves pending transaction proposals.
   * @param {Object} opts
   * @param {Boolean} opts.noCashAddr (do not use cashaddr, only for backwards compat)
   * @returns {TxProposal[]} Transaction proposal.
   */
  getPendingTxs(opts, cb) {
    this.storage.fetchPendingTxs(this.walletId, (err, txps) => {
      if (err) return cb(err);

      _.each(txps, (txp) => {
        txp.deleteLockTime = this.getRemainingDeleteLockTime(txp);
      });

      async.each(
        txps,
        (txp: ITxProposal, next) => {
          if (txp.status != 'accepted') return next();

          this._checkTxInBlockchain(txp, (err, isInBlockchain) => {
            if (err || !isInBlockchain) return next(err);
            this._processBroadcast(
              txp,
              {
                byThirdParty: true
              },
              next
            );
          });
        },
        (err) => {
          txps = _.reject(txps, (txp) => {
            return txp.status == 'broadcasted';
          });

          if (opts.noCashAddr && txps[0] && txps[0].coin == 'bch') {
            _.each(txps, x => {
              if (x.changeAddress) {
                x.changeAddress.address = BCHAddressTranslator.translate(
                  x.changeAddress.address,
                  'copay'
                );
              }
              _.each(x.outputs, x => {
                if (x.toAddress) {
                  x.toAddress = BCHAddressTranslator.translate(
                    x.toAddress,
                    'copay'
                  );
                }
              });
            });
          }

          return cb(err, txps);
        }
      );
    });
  }

  /**
   * Retrieves all transaction proposals in the range (maxTs-minTs)
   * Times are in UNIX EPOCH
   *
   * @param {Object} opts.minTs (defaults to 0)
   * @param {Object} opts.maxTs (defaults to now)
   * @param {Object} opts.limit
   * @returns {TxProposal[]} Transaction proposals, newer first
   */
  getTxs(opts, cb) {
    this.storage.fetchTxs(this.walletId, opts, (err, txps) => {
      if (err) return cb(err);
      return cb(null, txps);
    });
  }

  /**
   * Retrieves notifications after a specific id or from a given ts (whichever is more recent).
   *
   * @param {Object} opts
   * @param {Object} opts.notificationId (optional)
   * @param {Object} opts.minTs (optional) - default 0.
   * @returns {Notification[]} Notifications
   */
  getNotifications(opts, cb) {
    opts = opts || {};

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      async.map(
        [wallet.network, this.walletId],
        (walletId, next) => {
          this.storage.fetchNotifications(
            walletId,
            opts.notificationId,
            opts.minTs || 0,
            next
          );
        },
        (err, res) => {
          if (err) return cb(err);

          const notifications = _.sortBy(
            _.map(_.flatten(res), (n: INotification) => {
              n.walletId = this.walletId;
              return n;
            }),
            'id'
          );

          return cb(null, notifications);
        }
      );
    });
  }

  _normalizeTxHistory(walletId, txs: any[], dustThreshold, bcHeight, cb) {
    if (_.isEmpty(txs)) return cb(null, txs);

    // console.log('[server.js.2915:txs:] IN NORMALIZE',txs); //TODO
    const now = Math.floor(Date.now() / 1000);

    // One fee per TXID
    const indexedFee: any = _.keyBy(
      _.filter(txs, { category: 'fee' } as any),
      'txid'
    );
    const indexedSend = _.keyBy(
      _.filter(txs, { category: 'send' } as any),
      'txid'
    );
    const seenSend = {};
    const seenReceive = {};

    const moves: { [txid: string]: ITxProposal } = {};

    // remove 'fees' and 'moves' (probably change addresses)
    txs = _.filter(txs, tx => {
      // double spend or error
      // This should be shown on the client, so we dont remove it here
      //    if (tx.height && tx.height <= -3)
      //      return false;

      if (tx.category == 'receive') {

        if (tx.satoshis < dustThreshold)
          return false;

        const output = {
          address: tx.address,
          amount: Math.abs(tx.satoshis)
        };
        if (seenReceive[tx.txid]) {
          seenReceive[tx.txid].outputs.push(output);
          return false;
        } else {
          tx.outputs = [output];
          seenReceive[tx.txid] = tx;
          return true;
        }
      }
      if (tx.category == 'send') {
        const output = {
          address: tx.address,
          amount: Math.abs(tx.satoshis)
        };
        if (seenSend[tx.txid]) {
          seenSend[tx.txid].outputs.push(output);
          return false;
        } else {
          tx.outputs = [output];
          seenSend[tx.txid] = tx;
          return true;
        }
      }

      // move without send?
      if (tx.category == 'move' && !indexedSend[tx.txid]) {
        const output = {
          address: tx.address,
          amount: Math.abs(tx.satoshis)
        };

        if (moves[tx.txid]) {
          moves[tx.txid].outputs.push(output);
          return false;
        } else {
          moves[tx.txid] = tx;
          tx.outputs = [output];
          return true;
        }
      }
    });

    // Filter out moves:
    // This are moves from the wallet to itself. There are 2+ outputs. one if the change
    // the other a main address for the wallet.
    _.each(moves, (v, k) => {
      if (v.outputs.length <= 1) {
        delete moves[k];
      }
    });

    const fixMoves = (cb2) => {
      if (_.isEmpty(moves)) return cb2();

      // each detected duplicate output move
      const moves3 = _.flatten(_.map(_.values(moves), 'outputs'));
      // check output address for change address
      this.storage.fetchAddressesByWalletId(
        walletId,
        _.map(moves3, 'address'),
        (err, addrs) => {
          if (err) return cb(err);

          const isChangeAddress = _.countBy(
            _.filter(addrs, { isChange: true }),
            'address'
          );
          _.each(moves, x => {
            _.remove(x.outputs, i => {
              return isChangeAddress[i.address];
            });
          });
          return cb2();
        }
      );
    };

    fixMoves(err => {
      if (err) return cb(err);

      const ret = _.filter(_.map([].concat(txs), (tx) => {
        const t = new Date(tx.blockTime).getTime() / 1000;
        const c = tx.height >= 0 && bcHeight >= tx.height ? bcHeight - tx.height + 1 : 0;
        const ret = {
          id: tx.id,
          txid: tx.txid,
          confirmations: c,
          blockheight: tx.height > 0 ? tx.height : null,
          fees:
            tx.fee ||
            (indexedFee[tx.txid]
              ? Math.abs(indexedFee[tx.txid].satoshis)
              : null),
          time: t,
          size: tx.size,
          amount: 0,
          action: undefined,
          addressTo: undefined,
          outputs: undefined,
          dust: false,
        };
        switch (tx.category) {
          case 'send':
            ret.action = 'sent';
            ret.amount = Math.abs(_.sumBy(tx.outputs, 'amount')) || Math.abs(tx.satoshis);
            ret.addressTo = tx.outputs ? tx.outputs[0].address : null;
            ret.outputs = tx.outputs;
            break;
          case 'receive':
            ret.action = 'received';
            ret.outputs = tx.outputs;
            ret.amount = Math.abs(_.sumBy(tx.outputs, 'amount')) || Math.abs(tx.satoshis);
            ret.dust = ret.amount < dustThreshold;
            break;
          case 'move':
            ret.action = 'moved';
            ret.amount = Math.abs(tx.satoshis);
            ret.addressTo =
              tx.outputs && tx.outputs.length ? tx.outputs[0].address : null;
            ret.outputs = tx.outputs;
            break;
          default:
            ret.action = 'invalid';
        }

        // not available
        // inputs: inputs,
        return ret;

        // filter out dust
      }), (x) => {
        return !x.dust;
      });

      // console.log('[server.js.2965:ret:] END',ret); //TODO
      return cb(null, ret);
    });
  }

  _getBlockchainHeight(coin, network, cb) {
    const cacheKey = Storage.BCHEIGHT_KEY + ':' + coin + ':' + network;

    this.storage.checkAndUseGlobalCache(
      cacheKey,
      Defaults.BLOCKHEIGHT_CACHE_TIME,
      (err, values) => {
        if (err) return cb(err);

        if (values) return cb(null, values.current, values.hash, true);

        values = {};

        const bc = this._getBlockchainExplorer(coin, network);
        if (!bc)
          return cb(new Error('Could not get blockchain explorer instance'));
        bc.getBlockchainHeight((err, height, hash) => {
          if (!err && height > 0) {
            values.current = height;
            values.hash = hash;
          } else {
            return cb(err || 'wrong height');
          }

          this.storage.storeGlobalCache(cacheKey, values, err => {
            if (err) {
              this.logw('Could not store bc heigth cache');
            }
            return cb(null, values.current, values.hash);
          });
        });
      }
    );
  }

  updateWalletV8Keys(wallet) {
    if (!wallet.beAuthPrivateKey2) {
      this.logd('Adding wallet beAuthKey');
      wallet.updateBEKeys();
    }
  }

  registerWalletV8(wallet: Wallet, cb) {
    if (wallet.beRegistered) {
      return cb();
    }
    const bc = this._getBlockchainExplorer(wallet.coin, wallet.network);

    this.logd('Registering wallet');
    bc.register(wallet, err => {
      if (err) {
        return cb(err);
      }
      wallet.beRegistered = true;
      return this.storage.storeWallet(wallet, cb);
    });
  }

  checkWalletSync(bc, wallet, cb) {
    if (!wallet.addressManager && !wallet.addressManager.receiveAddressIndex)
      return cb(null, true);

    // check cache
    const totalAddresses =
      wallet.addressManager.receiveAddressIndex +
      wallet.addressManager.changeAddressIndex;

    this.storage.getWalletAddressChecked(wallet.id, (err, checkedTotal) => {
      if (checkedTotal == totalAddresses) {
        log.debug('addresses checked already');
        return cb(null, true);
      }

      this.storage
        .walletCheck({ walletId: wallet.id })
        .then((localCheck: { sum: number }) => {
          bc.getCheckData(wallet, (err, serverCheck) => {
            // If there is an error, just ignore it (server does not support walletCheck)
            if (err) {
              this.logw('Error at bitcore WalletCheck, ignoring' + err);
              return cb();
            }

            const isOK = serverCheck.sum == localCheck.sum;

            if (isOK) {
              log.debug('Wallet Sync Check OK');
            } else {
              log.warn('ERROR: Wallet check failed:', localCheck, serverCheck);
              return cb(null, isOK);
            }

            this.storage.setWalletAddressChecked(
              wallet.id,
              totalAddresses,
              err => {
                return cb(null, isOK);
              }
            );
          });
        });
    });
  }

  // Syncs wallet regitration and address with a V8 type blockexplorerer
  syncWallet(wallet, cb, skipCheck?, count?) {
    count = count || 0;
    const bc = this._getBlockchainExplorer(wallet.coin, wallet.network);
    if (!bc) {
      return cb(new Error('Could not get blockchain explorer instance'));
    }

    this.updateWalletV8Keys(wallet);

    this.registerWalletV8(wallet, err => {
      if (err) {
        return cb(err);
      }

      this.storage.fetchUnsyncAddresses(this.walletId, (err, addresses) => {
        if (err) {
          return cb(err);
        }

        const syncAddr = (addresses, icb) => {
          if (!addresses || _.isEmpty(addresses)) {
            // this.logi('Addresses already sync');
            return icb();
          }

          const addressStr = _.map(addresses, 'address');
          this.logd('Syncing addresses: ', addressStr.length);
          bc.addAddresses(wallet, addressStr, err => {
            if (err) return cb(err);

            this.storage.markSyncedAddresses(addressStr, icb);
          });
        };

        syncAddr(addresses, err => {
          if (skipCheck || doNotCheckV8) return cb();

          this.checkWalletSync(bc, wallet, (err, isOK) => {
            // ignore err
            if (err) return cb();

            if (isOK) return cb();

            if (count++ >= 1) {
              log.warn('## ERROR: TRIED TO SYNC WALLET AND FAILED. GIVING UP');
              return cb();
            }
            log.info('Trying to RESYNC wallet... count:' + count);

            // Reset sync and sync again...
            wallet.beRegistered = false;
            this.storage.deregisterWallet(wallet.id, () => {
              this.syncWallet(wallet, cb, false, count);
            });
          });
        });
      });
    });
  }

  static _getResultTx(wallet, indexedAddresses, tx, opts) {
    let amountIn, amountOut, amountOutChange;
    let amount, action, addressTo;
    let inputs, outputs, foreignCrafted;

    const sum = (items, isMine, isChange = false) => {
      const filter: { isMine?: boolean; isChange?: boolean } = {};
      if (_.isBoolean(isMine)) filter.isMine = isMine;
      if (_.isBoolean(isChange)) filter.isChange = isChange;
      return _.sumBy(_.filter(items, filter), 'amount');
    };

    const classify = (items) => {
      return _.map(items, (item) => {
        const address = indexedAddresses[item.address];
        return {
          address: item.address,
          amount: item.amount,
          isMine: !!address,
          isChange: address ? address.isChange || wallet.singleAddress : false
        };
      });
    };

    if (tx.outputs.length || tx.inputs.length) {
      inputs = classify(tx.inputs);
      outputs = classify(tx.outputs);
      amountIn = sum(inputs, true);
      amountOut = sum(outputs, true, false);
      amountOutChange = sum(outputs, true, true);
      if (
        amountIn ==
        amountOut + amountOutChange + (amountIn > 0 ? tx.fees : 0)
      ) {
        amount = amountOut;
        action = 'moved';
      } else {
        // BWS standard sent
        // (amountIn > 0 && amountOutChange >0 && outputs.length <= 2)
        amount =
          amountIn -
          amountOut -
          amountOutChange -
          (amountIn > 0 && amountOutChange > 0 ? tx.fees : 0);
        action = amount > 0 ? 'sent' : 'received';
      }

      amount = Math.abs(amount);
      if (action == 'sent' || action == 'moved') {
        const firstExternalOutput = outputs.find(o => o.isMine === false);
        addressTo = firstExternalOutput ? firstExternalOutput.address : null;
      }

      if (
        action == 'sent' &&
        inputs.length != _.filter(inputs, 'isMine').length
      ) {
        foreignCrafted = true;
      }
    } else {
      action = 'invalid';
      amount = 0;
    }

    const formatOutput = (o) => {
      return {
        amount: o.amount,
        address: o.address
      };
    };

    const newTx = {
      txid: tx.txid,
      action,
      amount,
      fees: tx.fees,
      time: tx.time,
      addressTo,
      confirmations: tx.confirmations,
      foreignCrafted,
      outputs: undefined,
      feePerKb: undefined,
      inputs: undefined
    };

    if (_.isNumber(tx.size) && tx.size > 0) {
      newTx.feePerKb = +((tx.fees * 1000) / tx.size).toFixed();
    }

    if (opts.includeExtendedInfo) {
      newTx.inputs = _.map(inputs, (input) => {
        return _.pick(input, 'address', 'amount', 'isMine');
      });
      newTx.outputs = _.map(outputs, (output) => {
        return _.pick(output, 'address', 'amount', 'isMine');
      });
    } else {
      outputs = _.filter(outputs, {
        isChange: false
      });
      if (action == 'received') {
        outputs = _.filter(outputs, {
          isMine: true
        });
      }
      newTx.outputs = _.map(outputs, formatOutput);
    }

    return newTx;
  }

  static _addProposalInfo(
    tx: any,
    indexedProposals: { [txid: string]: TxProposal },
    opts: any,
  ) {
    opts = opts || {};
    const proposal = indexedProposals[tx.txid];
    if (proposal) {
      tx.createdOn = proposal.createdOn;
      tx.proposalId = proposal.id;
      tx.proposalType = proposal.type;
      tx.creatorName = proposal.creatorName;
      tx.message = proposal.message;
      tx.actions = _.map(proposal.actions, (action) => {
        return _.pick(action, [
          'createdOn',
          'type',
          'copayerId',
          'copayerName',
          'comment'
        ]);
      });
      _.each(tx.outputs, (output) => {
        const query = {
          toAddress: output.address,
          amount: output.amount
        };
        if (proposal.outputs) {
          const txpOut = proposal.outputs.find(
            o => o.toAddress === output.address && o.amount === output.amount
          );
          output.message = txpOut ? txpOut.message : null;
        }
      });
      tx.customData = proposal.customData;

      tx.createdOn = proposal.createdOn;
      if (opts.includeExtendedInfo) {
        tx.raw = proposal.raw;
      }
      // .sentTs = proposal.sentTs;
      // .merchant = proposal.merchant;
      // .paymentAckMemo = proposal.paymentAckMemo;
    }
  }

  static _addNotesInfo(tx, indexedNotes) {
    const note = indexedNotes[tx.txid];
    if (note) {
      tx.note = _.pick(note, ['body', 'editedBy', 'editedByName', 'editedOn']);
    }
  }

  tagLowFeeTxs(wallet: IWallet, txs: any[], cb) {
    const unconfirmed = txs.filter(tx => tx.confirmations === 0);
    if (_.isEmpty(unconfirmed)) return cb();

    this.getFeeLevels(
      {
        coin: wallet.coin,
        network: wallet.network
      },
      (err, levels) => {
        if (err) {
          this.logw('Could not fetch fee levels', err);
        } else {
          const level = levels.find(l => l.level === 'superEconomy');
          if (!level || !level.nbBlocks) {
            this.logi('Cannot compute super economy fee level from blockchain');
          } else {
            const minFeePerKb = level.feePerKb;
            _.each(unconfirmed, (tx) => {
              tx.lowFees = tx.feePerKb < minFeePerKb;
            });
          }
        }
        return cb();
      }
    );
  }

  getTxHistoryV8(bc, wallet, opts, skip, limit, cb) {
    let bcHeight,
      bcHash,
      sinceTx,
      lastTxs,
      cacheStatus,
      resultTxs = [],
      fromCache = false;
    let txsToCache = [],
      fromBc;
    let streamData;
    let streamKey;

    async.series(
      [
        next => {
          // be sure the wallet is onsync
          this.syncWallet(wallet, next, true);
        },
        next => {
          this._getBlockchainHeight(wallet.coin, wallet.network, (
            err,
            height,
            hash
          ) => {
            if (err) return next(err);
            bcHeight = height;
            bcHash = hash;
            streamKey = (this.userAgent || '') + '-' + limit + '-' + bcHash;
            return next();
          });
        },
        next => {
          this.storage.getTxHistoryCacheStatusV8(
            wallet.id,
            (err, inCacheStatus) => {
              if (err) return cb(err);
              cacheStatus = inCacheStatus;
              return next();
            }
          );
        },
        next => {
          if (skip == 0 || !streamKey) return next();

          log.debug('Checking streamKey/skip', streamKey, skip);
          this.storage.getTxHistoryStreamV8(wallet.id, (err, result) => {
            if (err) return next(err);
            if (!result) return next();

            if (result.streamKey != streamKey) {
              log.debug('Deleting old stream cache:' + result.streamKey);
              return this.storage.clearTxHistoryStreamV8(wallet.id, next);
            }

            streamData = result.items;
            log.debug(`Using stream cache: ${streamData.length} txs`);
            return next();
          });
        },
        next => {
          if (streamData) {
            lastTxs = streamData;
            return next();
          }

          const startBlock = cacheStatus.updatedHeight || 0;
          log.debug(
            ' ########### GET HISTORY v8 startBlock/bcH]',
            startBlock,
            bcHeight
          ); // TODO

          bc.getTransactions(wallet, startBlock, (err, txs) => {
            if (err) return cb(err);
            const dustThreshold = wallet.isUTXOCoin()
              ? Bitcore_[wallet.coin].Transaction.DUST_AMOUNT
              : 0;
            this._normalizeTxHistory(wallet.id, txs, dustThreshold, bcHeight, (
              err,
              inTxs: any[]
            ) => {
              if (err) return cb(err);

              if (cacheStatus.tipTxId) {
                // first item is the most recent tx.
                // removes already cache txs
                lastTxs = _.takeWhile(inTxs, tx => {
                  // cacheTxs are very confirmed, so can't be reorged
                  return tx.txid != cacheStatus.tipTxId;
                });

                // only store stream IF cache is been used.
                //
                log.info(
                  `Storing stream cache for ${wallet.id}: ${lastTxs.length} txs`
                );
                return this.storage.storeTxHistoryStreamV8(
                  wallet.id,
                  streamKey,
                  lastTxs,
                  next
                );
              }

              lastTxs = inTxs;
              return next();
            });
          });
        },
        next => {
          // Case 1.
          //            t -->
          //  | Old TXS    | ======= LAST TXS ========== \
          //                     ^skip+limit       ^skip

          // Do we have enough results in last txs?
          if (lastTxs.length >= skip + limit) {
            resultTxs = lastTxs.slice(skip, skip + limit);
            fromCache = false;
            fromBc = true;
            return next();
          }
          // Case 2.
          // compose result (if the wallet has move that `limit`txs)
          //            t -->
          //  | Old TXS    |  [x]======= LAST TXS ==========[0] \
          //       ^skip+limit       ^skip
          if (lastTxs.length >= skip) {
            resultTxs = lastTxs.slice(skip); // grab from skip to the end.

            skip = 0;
            limit -= resultTxs.length;
            fromBc = resultTxs.length > 0;
          } else {
            // Case 3.
            //            t -->
            //  | Old TXS ------------------ | ======= LAST TXS ========== \
            //       ^skip+limit       ^skip

            skip -= lastTxs.length;
          }
          // Complete result
          this.storage.getTxHistoryCacheV8(
            this.walletId,
            skip,
            limit,
            (err, oldTxs) => {
              if (err) {
                return next(err);
              }

              if (oldTxs.length) {
                fromCache = true;
              }

              // update confirmations from height
              _.each(oldTxs, x => {
                if (x.blockheight > 0 && bcHeight >= x.blockheight) {
                  x.confirmations = bcHeight - x.blockheight + 1;
                }
              });

              resultTxs = resultTxs.concat(oldTxs);
              return next();
            }
          );
        },
        next => {
          if (streamData) {
            return next();
          }
          // We have now TXs from 'tipHeight` to end in `lastTxs`.
          // Store hard confirmed TXs
          // confirmations here is bcHeight - tip + 1, so OK.
          txsToCache = _.filter(lastTxs, (i) => {
            if (i.confirmations < Defaults.CONFIRMATIONS_TO_START_CACHING) {
              return false;
            }
            if (!cacheStatus.tipHeight) return true;

            return i.blockheight > cacheStatus.tipHeight;
          });

          log.info(
            `Found ${lastTxs.length} new txs. Caching ${txsToCache.length}`
          );
          if (!txsToCache.length) {
            return next();
          }

          const updateHeight = bcHeight - Defaults.CONFIRMATIONS_TO_START_CACHING;
          this.storage.storeTxHistoryCacheV8(
            this.walletId,
            cacheStatus.tipIndex,
            txsToCache,
            updateHeight,
            next
          );
        }
      ],
      err => {
        if (err) return cb(err);
        return cb(null, {
          items: resultTxs,
          fromCache,
          fromBc,
          useStream: !!streamData
        });
      }
    );
  }

  /**
   * Retrieves all transactions (incoming & outgoing)
   * Times are in UNIX EPOCH
   *
   * @param {Object} opts
   * @param {Number} opts.skip (defaults to 0)
   * @param {Number} opts.limit
   * @param {Number} opts.includeExtendedInfo[=false] - Include all inputs/outputs for every tx.
   * @returns {TxProposal[]} Transaction proposals, first newer
   */
  getTxHistory(opts, cb) {
    let bc;
    opts = opts || {};

    // 50 is accepted by insight.
    // TODO move it to a bigger number with v8 is fully deployed
    opts.limit = _.isUndefined(opts.limit) ? 50 : opts.limit;
    if (opts.limit > Defaults.HISTORY_LIMIT)
      return cb(Errors.HISTORY_LIMIT_EXCEEDED);

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      if (wallet.scanStatus == 'error') return cb(Errors.WALLET_NEED_SCAN);

      if (wallet.scanStatus == 'running') return cb(Errors.WALLET_BUSY);

      bc = this._getBlockchainExplorer(wallet.coin, wallet.network);
      if (!bc)
        return cb(new Error('Could not get blockchain explorer instance'));

      const from = opts.skip || 0;
      const to = from + opts.limit;

      async.waterfall(
        [
          (next) => {
            this.getTxHistoryV8(bc, wallet, opts, from, opts.limit, next);
          },
          (txs: { items: Array<{ time: number }> }, next) => {
            if (!txs || _.isEmpty(txs.items)) {
              return next();
            }
            // TODO optimize this...
            // Fetch all proposals in [t - 7 days, t + 1 day]
            const minTs = _.minBy(txs.items, 'time').time - 7 * 24 * 3600;
            const maxTs = _.maxBy(txs.items, 'time').time + 1 * 24 * 3600;

            async.parallel(
              [
                (done) => {
                  this.storage.fetchTxs(
                    this.walletId,
                    {
                      minTs,
                      maxTs
                    },
                    done
                  );
                },
                (done) => {
                  this.storage.fetchTxNotes(
                    this.walletId,
                    {
                      minTs
                    },
                    done
                  );
                }
              ],
              (err, res) => {
                return next(err, {
                  txs,
                  txps: res[0],
                  notes: res[1]
                });
              }
            );
          }
        ],
        (err, res: any) => {
          if (err) return cb(err);
          if (!res) return cb(null, []);
          // TODO we are indexing everything again, each query.
          const indexedProposals = _.keyBy(res.txps, 'txid');
          const indexedNotes = _.keyBy(res.notes, 'txid');

          const finalTxs = _.map(res.txs.items, tx => {
            WalletService._addProposalInfo(tx, indexedProposals, opts);
            WalletService._addNotesInfo(tx, indexedNotes);
            return tx;
          });
          this.tagLowFeeTxs(wallet, finalTxs, (err) => {
            if (err) this.logw('Failed to tag unconfirmed with low fee');

            if (res.txs.fromCache) {
              let p = '';
              if (res.txs.fromBc) {
                p = 'Partial';
              }
              this.logd(
                `${p} History from cache ${from}/${to}: ${finalTxs.length} txs`
              );
            } else {
              this.logd(
                `History from bc ${from}/${to}: ${finalTxs.length} txs`
              );
            }
            return cb(null, finalTxs, !!res.txs.fromCache, !!res.txs.useStream);
          });
        }
      );
    });
  }

  /**
   * Scan the blockchain looking for addresses having some activity
   *
   * @param {Object} opts
   * @param {Boolean} opts.includeCopayerBranches (defaults to false)
   * @param {Boolean} opts.startingStep (estimate address number magniture (dflt to 1k), only
   * for optimization)
   */
  scan(opts, cb) {
    opts = opts || {};
    opts.startingStep = opts.startingStep || 1000;

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);
      if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

      // OCT2018: We dont allow copayer's BIP45 addr scanning anymore (for performance)
      // for BIP44 wallets.
      if (wallet.derivationStrategy === Constants.DERIVATION_STRATEGIES.BIP44) {
        opts.includeCopayerBranches = false;
      }

      // no powerScan when scanning copayer Branches
      if (opts.includeCopayerBranches) {
        opts.startingStep = 1;
      }

      this.storage.clearWalletCache(this.walletId, () => {
        // single address or non UTXO coins do not scan.
        if (wallet.singleAddress)
          return cb();
        if (! wallet.isUTXOCoin() )
          return cb();

        this._runLocked(cb, (cb) => {
          wallet.scanStatus = 'running';
          this.storage.storeWallet(wallet, (err) => {
            if (err) return cb(err);

            const bc = this._getBlockchainExplorer(wallet.coin, wallet.network);
            if (!bc)
              return cb(
                new Error('Could not get blockchain explorer instance')
              );
            opts.bc = bc;
            let step = opts.startingStep;
            async.doWhilst(
              next => {
                this._runScan(wallet, step, opts, next);
              },
              () => {
                step = step / 10;
                return step >= 1;
              },
              cb
            );
          });
        });
      });
    });
  }

  _runScan(wallet: Wallet, step, opts, cb) {
    const scanBranch = (wallet: Wallet, derivator, cb) => {
      let inactiveCounter = 0;
      const allAddresses = [];

      let gap = Defaults.SCAN_ADDRESS_GAP;

      // when powerScanning, we just accept gap<=3
      if (step > 1) {
        gap = _.min([gap, 3]);
      }

      async.whilst(
        () => {
          //      this.logi('Scanning addr branch: %s index: %d gap %d step %d', derivator.id, derivator.index(), inactiveCounter, step);
          return inactiveCounter < gap;
        },
        (next) => {
          const address = derivator.derive();

          opts.bc.getAddressActivity(address.address, (err, activity) => {
            if (err) return next(err);
            //       console.log('[server.js.3779:address:] SCANING:' + address.address+ ':'+address.path + " :" + !!activity); //TODO

            allAddresses.push(address);
            inactiveCounter = activity ? 0 : inactiveCounter + 1;
            return next();
          });
        },
        (err) => {
          derivator.rewind(gap);
          return cb(err, _.dropRight(allAddresses, gap));
        }
      );
    };

    const derivators = [];
    _.each([false, true], (isChange) => {
      derivators.push({
        id: wallet.addressManager.getBaseAddressPath(isChange),
        derive: _.bind(wallet.createAddress, wallet, isChange, step),
        index: _.bind(
          wallet.addressManager.getCurrentIndex,
          wallet.addressManager,
          isChange
        ),
        rewind: _.bind(
          wallet.addressManager.rewindIndex,
          wallet.addressManager,
          isChange,
          step
        ),
        getSkippedAddress: _.bind(wallet.getSkippedAddress, wallet)
      });
      if (opts.includeCopayerBranches) {
        _.each(wallet.copayers, (copayer) => {
          if (copayer.addressManager) {
            derivators.push({
              id: copayer.addressManager.getBaseAddressPath(isChange),
              derive: _.bind(copayer.createAddress, copayer, wallet, isChange),
              index: _.bind(
                copayer.addressManager.getCurrentIndex,
                copayer.addressManager,
                isChange
              ),
              rewind: _.bind(
                copayer.addressManager.rewindIndex,
                copayer.addressManager,
                isChange,
                step
              )
            });
          }
        });
      }
    });

    async.eachSeries(
      derivators,
      (derivator, next) => {
        let addresses = [];
        scanBranch(wallet, derivator, (err, scannedAddresses) => {
          if (err) return next(err);
          addresses = addresses.concat(scannedAddresses);

          if (step > 1) {
            this.logd(
              'Deriving addresses for scan steps gaps DERIVATOR:' + derivator.id
            );

            let addr,
              i = 0;
            // tslint:disable-next-line:no-conditional-assignment
            while ((addr = derivator.getSkippedAddress())) {
              addresses.push(addr);
              i++;
            }
            // this.logi(i + ' addresses were added.');
          }

          this._store(wallet, addresses, next);
        });
      },
      (error) => {
        this.storage.fetchWallet(wallet.id, (err, wallet) => {
          if (err) return cb(err);
          wallet.scanStatus = error ? 'error' : 'success';
          this.storage.storeWallet(wallet, (err) => {
            return cb(error || err);
          });
        });
      }
    );
  }

  /**
   * Start a scan process.
   *
   * @param {Object} opts
   * @param {Boolean} opts.includeCopayerBranches (defaults to false)
   */
  startScan(opts, cb) {
    const scanFinished = (err) => {
      const data = {
        result: err ? 'error' : 'success',
        error: undefined
      };
      if (err) data.error = err;
      this._notify('ScanFinished', data, {
        isGlobal: true
      });
    };

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);
      if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

      // single address or non UTXO coins do not scan.
      if (wallet.singleAddress)
        return cb();
      if (! wallet.isUTXOCoin() )
        return cb();

      setTimeout(() => {
        wallet.beRegistered = false;
        this.storage.deregisterWallet(wallet.id, () => {
          this.scan(opts, scanFinished);
        });
      }, 100);

      return cb(null, {
        started: true
      });
    });
  }

  /**
   * Returns exchange rate for the specified currency & timestamp.
   * @param {Object} opts
   * @param {string} opts.code - Currency ISO code.
   * @param {Date} [opts.ts] - A timestamp to base the rate on (default Date.now()).
   * @param {String} [opts.provider] - A provider of exchange rates (default 'BitPay').
   * @returns {Object} rates - The exchange rate.
   */
  getFiatRate(opts, cb) {
    if (!checkRequired(opts, ['code'], cb)) return;

    this.fiatRateService.getRate(opts, (err, rate) => {
      if (err) return cb(err);
      return cb(null, rate);
    });
  }

  /**
   * Subscribe this copayer to the Push Notifications service using the specified token.
   * @param {Object} opts
   * @param {string} opts.token - The token representing the app/device.
   * @param {string} [opts.packageName] - The restricted_package_name option associated with this token.
   * @param {string} [opts.platform] - The platform associated with this token.
   */
  pushNotificationsSubscribe(opts, cb) {
    if (!checkRequired(opts, ['token'], cb)) return;
    const sub = PushNotificationSub.create({
      copayerId: this.copayerId,
      token: opts.token,
      packageName: opts.packageName,
      platform: opts.platform
    });

    this.storage.storePushNotificationSub(sub, cb);
  }

  /**
   * Unsubscribe this copayer to the Push Notifications service using the specified token.
   * @param {Object} opts
   * @param {string} opts.token - The token representing the app/device.
   */
  pushNotificationsUnsubscribe(opts, cb) {
    if (!checkRequired(opts, ['token'], cb)) return;

    this.storage.removePushNotificationSub(this.copayerId, opts.token, cb);
  }

  /**
   * Subscribe this copayer to the specified tx to get a notification when the tx confirms.
   * @param {Object} opts
   * @param {string} opts.txid - The txid of the tx to be notified of.
   */
  txConfirmationSubscribe(opts, cb) {
    if (!checkRequired(opts, ['txid'], cb)) return;

    const sub = TxConfirmationSub.create({
      copayerId: this.copayerId,
      walletId: this.walletId,
      txid: opts.txid
    });

    this.storage.storeTxConfirmationSub(sub, cb);
  }

  /**
   * Unsubscribe this copayer to the Push Notifications service using the specified token.
   * @param {Object} opts
   * @param {string} opts.txid - The txid of the tx to be notified of.
   */
  txConfirmationUnsubscribe(opts, cb) {
    if (!checkRequired(opts, ['txid'], cb)) return;

    this.storage.removeTxConfirmationSub(this.copayerId, opts.txid, cb);
  }
}

function checkRequired(obj, args, cb?: (e: any) => void) {
  const missing = Utils.getMissingFields(obj, args);
  if (_.isEmpty(missing)) {
    return true;
  }

  if (_.isFunction(cb)) {
    return cb(
      new ClientError('Required argument: ' + _.first(missing) + ' missing.')
    );
  }

  return false;
}
