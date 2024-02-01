import * as async from 'async';
import * as crypto from 'crypto'
import { Validation } from 'crypto-wallet-core';
import * as _ from 'lodash';
import Moralis from 'moralis';
import 'source-map-support/register';
import config from '../config';
import logger from './logger';

import { serverMessages as deprecatedServerMessage } from '../deprecated-serverMessages';
import { serverMessages } from '../serverMessages';
import { BCHAddressTranslator } from './bchaddresstranslator';
import { BlockChainExplorer } from './blockchainexplorer';
import { V8 } from './blockchainexplorers/v8';
import { ChainService } from './chain/index';
import { Common } from './common';
import { ClientError } from './errors/clienterror';
import { Errors } from './errors/errordefinitions';
import { FiatRateService } from './fiatrateservice';
import { Lock } from './lock';
import { MessageBroker } from './messagebroker';
import {
  Advertisement,
  Copayer,
  ExternalServicesConfig,
  INotification,
  ITxProposal,
  IWallet,
  Notification,
  Preferences,
  PushNotificationSub,
  Session,
  TxConfirmationSub,
  TxNote,
  TxProposal,
  Wallet
} from './model';
import { Storage } from './storage';

const Uuid = require('uuid');
const $ = require('preconditions').singleton();
const EmailValidator = require('email-validator');

const Bitcore = require('bitcore-lib');
const Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash'),
  eth: Bitcore,
  matic: Bitcore,
  xrp: Bitcore,
  doge: require('bitcore-lib-doge'),
  ltc: require('bitcore-lib-ltc')
};

const Utils = Common.Utils;
const Constants = Common.Constants;
const Defaults = Common.Defaults;
const Services = Common.Services;

let request = require('request');
let initialized = false;
let doNotCheckV8 = false;
let isMoralisInitialized = false;

let lock;
let storage;
let blockchainExplorer;
let blockchainExplorerOpts;
let messageBroker;
let fiatRateService;
let serviceVersion;

interface IAddress {
  coin: string;
  chain: string;
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
  appVersion: { agent?: string; major?: number; minor?: number };
  parsedClientVersion: { agent?: string; major?: number; minor?: number };
  clientVersion: string;
  copayerIsSupportStaff: boolean;
  copayerIsMarketingStaff: boolean;
  request: any;
}
function boolToNum(x: boolean) {
  return x ? 1 : 0;
}
/**
 * Creates an instance of the Bitcore Wallet Service.
 * @constructor
 */
export class WalletService implements IWalletService {
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
  appVersion: { agent?: string; major?: number; minor?: number };
  parsedClientVersion: { agent?: string; major?: number; minor?: number };
  clientVersion: string;
  copayerIsSupportStaff: boolean;
  copayerIsMarketingStaff: boolean;
  request: any;

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
    // for testing
    //
    this.request = request;
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
    $.shouldBeFunction(cb, '');

    opts = opts || {};
    blockchainExplorer = opts.blockchainExplorer;
    blockchainExplorerOpts = opts.blockchainExplorerOpts;

    doNotCheckV8 = opts.doNotCheckV8;

    if (opts.request) {
      request = opts.request;
    }

    const initStorage = cb => {
      if (opts.storage) {
        storage = opts.storage;
        return cb();
      } else {
        const newStorage = new Storage();
        newStorage.connect(opts.storageOpts, err => {
          if (err) {
            return cb(err);
          }
          storage = newStorage;
          return cb();
        });
      }
    };

    const initMessageBroker = cb => {
      messageBroker = opts.messageBroker || new MessageBroker(opts.messageBrokerOpts);
      if (messageBroker) {
        messageBroker.onMessage(WalletService.handleIncomingNotifications);
      }

      return cb();
    };

    const initFiatRateService = cb => {
      if (opts.fiatRateService) {
        fiatRateService = opts.fiatRateService;
        return cb();
      } else {
        const newFiatRateService = new FiatRateService();
        const opts2 = opts.fiatRateServiceOpts || {};
        opts2.storage = storage;
        newFiatRateService.init(opts2, err => {
          if (err) {
            return cb(err);
          }

          fiatRateService = newFiatRateService;
          return cb();
        });
      }
    };

    // Init Moralis
    const initMoralis = async cb => {
      if (!config.moralis || !config.moralis.apiKey) {
        logger.warn('Moralis missing credentials');
        return cb();
      }

      if (!isMoralisInitialized) {
        try {
          logger.info('Initializing Moralis...');
          const API_KEY = config.moralis.apiKey;

          await Moralis.start({
            apiKey: API_KEY,
          });
          logger.info('Moralis initialized successfully!');
          isMoralisInitialized = true;
          return cb();
        } catch (err) {
          logger.error('Error initializing Moralis: ', err);
          isMoralisInitialized = false;
          return cb();
        }
      } else {
        return cb();
      }
    };

    async.series(
      [
        next => {
          initStorage(next);
        },
        next => {
          initMessageBroker(next);
        },
        next => {
          initFiatRateService(next);
        },
        next => {
          initMoralis(next);
        }
      ],
      err => {
        lock = opts.lock || new Lock(storage);

        if (err) {
          logger.error('Could not initialize: %o', err);
          throw err;
        }
        initialized = true;
        return cb();
      }
    );
  }

  static handleIncomingNotifications(notification, cb) {
    cb = cb || function() {};

    // do nothing here....
    // bc height cache is cleared on bcmonitor
    return cb();
  }

  static shutDown(cb) {
    if (!initialized) {
      return cb();
    }

    storage.disconnect(err => {
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
        throw new ClientError(Errors.codes.UPGRADE_NEEDED, 'BWC clients < 1.2 are no longer supported.');
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
    const withSignature = cb => {
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
          return cb(new ClientError(Errors.codes.NOT_AUTHORIZED, 'Copayer not found'));
        }

        const isValid = !!server._getSigningKey(opts.message, opts.signature, copayer.requestPubKeys);
        if (!isValid) {
          return cb(new ClientError(Errors.codes.NOT_AUTHORIZED, 'Invalid signature'));
        }

        server.walletId = copayer.walletId;

        // allow overwrite walletid if the copayer is from the support team
        if (copayer.isSupportStaff) {
          server.walletId = opts.walletId || copayer.walletId;
          server.copayerIsSupportStaff = true;
        }
        if (copayer.isMarketingStaff) {
          server.copayerIsMarketingStaff = true;
        }

        server.copayerId = opts.copayerId;
        return cb(null, server);
      });
    };

    const withSession = cb => {
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
          return cb(new ClientError(Errors.codes.NOT_AUTHORIZED, 'Session expired'));
        }

        server.storage.fetchCopayerLookup(opts.copayerId, (err, copayer) => {
          if (err) {
            return cb(err);
          }
          if (!copayer) {
            return cb(new ClientError(Errors.codes.NOT_AUTHORIZED, 'Copayer not found'));
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
    $.checkState(this.walletId, 'Failed state: this.walletId undefined at <_runLocked()>');

    this.lock.runLocked(this.walletId, { waitTime }, cb, task);
  }
  logi(message, ...args) {
    if (typeof message === 'string' && args.length > 0 && !message.endsWith('%o')) {
      for (let i = 0; i < args.length; i++) {
        message += ' %o';
      }
    }

    if (!this || !this.walletId) {
      return logger.warn(message, ...args);
    }

    message = '<' + this.walletId + '>' + message;
    return logger.info(message, ...args);
  }

  logw(message, ...args) {
    if (typeof message === 'string' && args.length > 0 && !message.endsWith('%o')) {
      for (let i = 0; i < args.length; i++) {
        message += ' %o';
      }
    }

    if (!this || !this.walletId) {
      return logger.warn(message, ...args);
    }

    message = '<' + this.walletId + '>' + message;
    return logger.warn(message, ...args);
  }

  logd(message, ...args) {
    if (typeof message === 'string' && args.length > 0 && !message.endsWith('%o')) {
      for (let i = 0; i < args.length; i++) {
        message += ' %o';
      }
    }

    if (!this || !this.walletId) {
      return logger.verbose(message, ...args);
    }

    message = '<' + this.walletId + '>' + message;
    return logger.verbose(message, ...args);
  }

  login(opts, cb) {
    let session;
    async.series(
      [
        next => {
          this.storage.getSession(this.copayerId, (err, s) => {
            if (err) {
              return next(err);
            }
            session = s;
            next();
          });
        },
        next => {
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
        next => {
          this.storage.storeSession(session, next);
        }
      ],
      err => {
        if (err) {
          return cb(err);
        }
        if (!session) {
          return cb(new Error('Could not get current session for this copayer'));
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
   * @param {string} opts.hardwareSourcePublicKey - public key from a hardware device for this copayer
   * @param {string} opts.singleAddress[=false] - The wallet will only ever have one address.
   * @param {string} opts.coin[='btc'] - The coin for this wallet (btc, bch, eth, doge, ltc).
   * @param {string} opts.chain[='btc'] - The chain for this wallet (btc, bch, eth, doge, ltc).
   * @param {string} opts.network[='livenet'] - The Bitcoin network for this wallet.
   * @param {string} opts.account[=0] - BIP44 account number
   * @param {string} opts.usePurpose48 - for Multisig wallet, use purpose=48
   * @param {string} opts.useNativeSegwit - for Segwit address, set addressType to P2WPKH or P2WSH
   */
  createWallet(opts, cb) {
    let pubKey;

    opts.coin = opts.coin || Defaults.COIN;
    if (!opts.chain) {
      opts.chain = opts.coin; // chain === coin for stored clients
    }

    if (opts.chain === 'bch' && opts.n > 1) {
      const version = Utils.parseVersion(this.clientVersion);
      if (version && version.agent === 'bwc') {
        if (version.major < 8 || (version.major === 8 && version.minor < 3)) {
          return cb(
            new ClientError(
              Errors.codes.UPGRADE_NEEDED,
              'BWC clients < 8.3 are no longer supported for multisig BCH wallets.'
            )
          );
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
      return cb(new ClientError('Invalid combination of required copayers / total copayers'));
    }

    if (!Utils.checkValueInCollection(opts.chain, Constants.CHAINS)) {
      return cb(new ClientError('Invalid chain'));
    }

    opts.network = opts.network || 'livenet';
    if (!Utils.checkValueInCollection(opts.network, Constants.NETWORKS)) {
      return cb(new ClientError('Invalid network'));
    }

    const derivationStrategy = Constants.DERIVATION_STRATEGIES.BIP44;
    let addressType = opts.n === 1 ? Constants.SCRIPT_TYPES.P2PKH : Constants.SCRIPT_TYPES.P2SH;

    if (opts.useNativeSegwit && Utils.checkValueInCollection(opts.chain, Constants.NATIVE_SEGWIT_CHAINS)) {
      addressType = opts.n === 1 ? Constants.SCRIPT_TYPES.P2WPKH : Constants.SCRIPT_TYPES.P2WSH;
    }

    try {
      pubKey = new Bitcore.PublicKey.fromString(opts.pubKey);
    } catch (ex) {
      return cb(new ClientError('Invalid public key'));
    }

    // using coin for simplicity
    if (opts.n > 1 && !ChainService.supportsMultisig(opts.chain)) {
      return cb(new ClientError('Multisig wallets are not supported for this coin'));
    }

    // using coin for simplicity
    if (ChainService.isSingleAddress(opts.chain)) {
      opts.singleAddress = true;
    }

    let newWallet;
    async.series(
      [
        acb => {
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
        acb => {
          const wallet = Wallet.create({
            id: opts.id,
            name: opts.name,
            m: opts.m,
            n: opts.n,
            coin: opts.coin,
            chain: opts.chain, // chain === coin for stored wallets
            network: opts.network,
            pubKey: pubKey.toString(),
            singleAddress: !!opts.singleAddress,
            derivationStrategy,
            addressType,
            nativeCashAddr: opts.nativeCashAddr,
            usePurpose48: opts.n > 1 && !!opts.usePurpose48,
            hardwareSourcePublicKey: opts.hardwareSourcePublicKey,
          });
          this.storage.storeWallet(wallet, err => {
            this.logd('Wallet created', wallet.id, opts.network);
            newWallet = wallet;
            return acb(err);
          });
        }
      ],
      err => {
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
      if (wallet.coin != 'bch' || wallet.nativeCashAddr) return cb(null, wallet);

      // only for testing
      if (opts.doNotMigrate) return cb(null, wallet);

      // backwards compatibility
      if (!wallet.chain) wallet.chain = ChainService.getChain(wallet.coin);

      // remove someday...
      logger.info(`Migrating wallet ${wallet.id} to cashAddr`);
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
        done => {
          this.storage.fetchWallet(opts.identifier, (err, wallet) => {
            if (wallet) walletId = wallet.id;
            return done(err);
          });
        },
        done => {
          this.storage.fetchAddressByChain(Defaults.CHAIN, opts.identifier, (err, address) => {
            if (address) walletId = address.walletId;
            return done(err);
          });
        },
        done => {
          // sent txs
          this.storage.fetchTxByHash(opts.identifier, (err, tx) => {
            if (tx) walletId = tx.walletId;
            return done(err);
          });
        }
      ],
      err => {
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
   * @param {Object} opts.tokenAddress - (Optional) Token contract address to pass in getBalance
   * @param {Object} opts.multisigContractAddress - (Optional) Multisig ETH contract address to pass in getBalance
   * @param {Object} opts.network - (Optional ETH MULTISIG) Multisig ETH contract address network
   * @returns {Object} status
   */
  getStatus(opts, cb) {
    opts = opts || {};

    const status: {
      wallet?: IWallet;
      serverMessage?: {
        title: string;
        body: string;
        link: string;
        id: string;
        dismissible: boolean;
        category: string;
        app: string;
      };
      serverMessages?: Array<{
        title: string;
        body: string;
        link: string;
        id: string;
        dismissible: boolean;
        category: string;
        app: string;
        priority: number;
      }>;
      balance?: string;
      pendingTxps?: ITxProposal[];
      preferences?: boolean;
    } = {};
    async.parallel(
      [
        next => {
          this.getWallet({}, (err, wallet) => {
            if (err) return next(err);

            const walletExtendedKeys = ['publicKeyRing', 'pubKey', 'addressManager'];
            const copayerExtendedKeys = ['xPubKey', 'requestPubKey', 'signature', 'addressManager', 'customData'];

            wallet.copayers = _.map(wallet.copayers, copayer => {
              if (copayer.id == this.copayerId) return copayer;
              return _.omit(copayer, 'customData');
            });
            if (!opts.includeExtendedInfo) {
              wallet = _.omit(wallet, walletExtendedKeys);
              wallet.copayers = _.map(wallet.copayers, copayer => {
                return _.omit(copayer, copayerExtendedKeys);
              });
            }
            status.wallet = wallet;

            if (opts.includeServerMessages) {
              status.serverMessages = serverMessages(wallet, this.appName, this.appVersion);
            } else {
              status.serverMessage = deprecatedServerMessage(wallet, this.appName, this.appVersion);
            }
            next();
          });
        },
        next => {
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
        next => {
          this.getPendingTxs(opts, (err, pendingTxps) => {
            if (err) return next(err);
            status.pendingTxps = pendingTxps;
            next();
          });
        },
        next => {
          this.getPreferences({}, (err, preferences) => {
            if (err) return next(err);
            status.preferences = preferences;
            next();
          });
        }
      ],
      err => {
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
    const pub = new Bitcore.HDPublicKey(xPubKey).deriveChild(Constants.PATHS.REQUEST_KEY_AUTH).publicKey;
    return Utils.verifyMessage(requestPubKey, signature, pub.toString());
  }

  /*
   * Verifies signature againt a collection of pubkeys
   * @param text
   * @param signature
   * @param pubKeys
   */
  _getSigningKey(text, signature, pubKeys) {
    return _.find(pubKeys, item => {
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

    cb = cb || function() {};

    const walletId = this.walletId || data.walletId;
    const copayerId = this.copayerId || data.copayerId;

    $.checkState(walletId, 'Failed state: walletId undefined at <_notify()>');

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

  _notifyTxProposalAction(type, txp, extraArgs, cb?: (err?: any, data?: any) => void) {
    if (_.isFunction(extraArgs)) {
      cb = extraArgs;
      extraArgs = {};
    }

    const data = _.assign(
      {
        txProposalId: txp.id,
        creatorId: txp.creatorId,
        amount: txp.getTotalAmount(),
        message: txp.message,
        tokenAddress: txp.tokenAddress,
        multisigContractAddress: txp.multisigContractAddress
      },
      extraArgs
    );
    this._notify(type, data, {}, cb);
  }

  _addCopayerToWallet(wallet, opts, cb) {
    const copayer = Copayer.create({
      coin: wallet.coin,
      chain: wallet.chain, // chain === coin for stored clients
      name: opts.name,
      copayerIndex: wallet.copayers.length,
      xPubKey: opts.xPubKey,
      hardwareSourcePublicKey: opts.hardwareSourcePublicKey,
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
      this.storage.storeWalletAndUpdateCopayersLookup(wallet, err => {
        if (err) return cb(err);

        async.series(
          [
            next => {
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
            next => {
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
    wallet.addCopayerRequestKey(copayer.copayerId, opts.requestPubKey, opts.signature, opts.restrictions, opts.name);
    this.storage.storeWalletAndUpdateCopayersLookup(wallet, err => {
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
    if (!checkRequired(opts, ['copayerId', 'requestPubKey', 'signature'], cb)) return;

    this.storage.fetchCopayerLookup(opts.copayerId, (err, copayer) => {
      if (err) return cb(err);
      if (!copayer) return cb(Errors.NOT_AUTHORIZED);
      this.storage.fetchWallet(copayer.walletId, (err, wallet) => {
        if (err) return cb(err);
        if (!wallet) return cb(Errors.NOT_AUTHORIZED);

        const xPubKey = wallet.copayers.find(c => c.id === opts.copayerId).xPubKey;

        if (!this._verifyRequestPubKey(opts.requestPubKey, opts.signature, xPubKey)) {
          return cb(Errors.NOT_AUTHORIZED);
        }

        if (copayer.requestPubKeys.length > Defaults.MAX_KEYS) return cb(Errors.TOO_MANY_KEYS);

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
    if (version.major < 1 || (version.major == 1 && version.minor < 2)) return false;
    return true;
  }

  static _getCopayerHash(name, xPubKey, requestPubKey) {
    return [name, xPubKey, requestPubKey].join('|');
  }

  /**
   * Joins a wallet in creation.
   * @param {Object} opts
   * @param {string} opts.walletId - The wallet id.
   * @param {string} opts.coin[='btc'] - The expected coin for this wallet (btc, bch, eth, doge, ltc).
   * @param {string} opts.chain[='btc'] - The expected chain for this wallet (btc, bch, eth, doge, ltc).
   * @param {string} opts.name - The copayer name.
   * @param {string} opts.xPubKey - Extended Public Key for this copayer
   * @param {string} opts.hardwareSourcePublicKey - public key from a hardware device for this copayer
   * @param {string} opts.requestPubKey - Public Key used to check requests from this copayer.
   * @param {string} opts.copayerSignature - S(name|xPubKey|requestPubKey). Used by other copayers to verify that the copayer joining knows the wallet secret.
   * @param {string} opts.customData - (optional) Custom data for this copayer.
   * @param {string} opts.dryRun[=false] - (optional) Simulate the action but do not change server state.
   */
  joinWallet(opts, cb) {
    if (!checkRequired(opts, ['walletId', 'name', 'requestPubKey', 'copayerSignature'], cb)) return;
    if (_.isEmpty(opts.name)) return cb(new ClientError('Invalid copayer name'));

    opts.coin = opts.coin || Defaults.COIN;
    if (!opts.chain) {
      opts.chain = opts.coin; // chain === coin for stored clients
    }
    if (!Utils.checkValueInCollection(opts.chain, Constants.CHAINS)) return cb(new ClientError('Invalid coin'));

    let xPubKey;
    if (!opts.hardwareSourcePublicKey) {
      if (!checkRequired(opts, ['xPubKey'], cb)) return;
      try {
        xPubKey = Bitcore_[opts.chain].HDPublicKey(opts.xPubKey);
      } catch (ex) {
        return cb(new ClientError('Invalid extended public key'));
      }
      if (_.isUndefined(xPubKey.network)) {
        return cb(new ClientError('Invalid extended public key'));
      }
    }

    this.walletId = opts.walletId;
    this._runLocked(cb, cb => {
      this.storage.fetchWallet(opts.walletId, (err, wallet) => {
        if (err) return cb(err);
        if (!wallet) return cb(Errors.WALLET_NOT_FOUND);

        if (opts.hardwareSourcePublicKey) {
          this._addCopayerToWallet(wallet, opts, cb);
          return;
        }
        
        if (opts.chain === 'bch' && wallet.n > 1) {
          const version = Utils.parseVersion(this.clientVersion);
          if (version && version.agent === 'bwc') {
            if (version.major < 8 || (version.major === 8 && version.minor < 3)) {
              return cb(
                new ClientError(
                  Errors.codes.UPGRADE_NEEDED,
                  'BWC clients < 8.3 are no longer supported for multisig BCH wallets.'
                )
              );
            }
          }
        }

        if (wallet.n > 1 && wallet.usePurpose48) {
          const version = Utils.parseVersion(this.clientVersion);
          if (version && version.agent === 'bwc') {
            if (version.major < 8 || (version.major === 8 && version.minor < 4)) {
              return cb(
                new ClientError(Errors.codes.UPGRADE_NEEDED, 'Please upgrade your client to join this multisig wallet')
              );
            }
          }
        }

        if (wallet.n > 1 && wallet.addressType === 'P2WSH') {
          const version = Utils.parseVersion(this.clientVersion);
          if (version && version.agent === 'bwc') {
            if (version.major < 8 || (version.major === 8 && version.minor < 17)) {
              return cb(
                new ClientError(Errors.codes.UPGRADE_NEEDED, 'Please upgrade your client to join this multisig wallet')
              );
            }
          }
        }

        if (opts.chain != wallet.chain) {
          return cb(new ClientError('The wallet you are trying to join was created for a different chain'));
        }

        if (wallet.network != xPubKey.network.name) {
          return cb(new ClientError('The wallet you are trying to join was created for a different network'));
        }

        // New client trying to join legacy wallet
        if (wallet.derivationStrategy == Constants.DERIVATION_STRATEGIES.BIP45) {
          return cb(
            new ClientError('The wallet you are trying to join was created with an older version of the client app.')
          );
        }

        const hash = WalletService._getCopayerHash(opts.name, opts.xPubKey, opts.requestPubKey);
        if (!this._verifySignature(hash, opts.copayerSignature, wallet.pubKey)) {
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
   * @param {string} opts.tokenAddresses - Linked token addresses
   * @param {string} opts.multisigEthInfo - Linked multisig eth wallet info
   * @param {string} opts.maticTokenAddresses - Linked token addresses
   * @param {string} opts.multisigMaticInfo - Linked multisig eth wallet info
   *
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
          return _.isString(value) && _.includes(['btc', 'bit'], value.toLowerCase());
        }
      },
      {
        name: 'tokenAddresses',
        isValid(value) {
          return _.isArray(value) && value.every(x => Validation.validateAddress('eth', 'mainnet', x));
        }
      },
      {
        name: 'multisigEthInfo',
        isValid(value) {
          return (
            _.isArray(value) &&
            value.every(x => Validation.validateAddress('eth', 'mainnet', x.multisigContractAddress))
          );
        }
      },
      {
        name: 'maticTokenAddresses',
        isValid(value) {
          return _.isArray(value) && value.every(x => Validation.validateAddress('matic', 'mainnet', x));
        }
      },
      {
        name: 'multisigMaticInfo',
        isValid(value) {
          return (
            _.isArray(value) &&
            value.every(x => Validation.validateAddress('matic', 'mainnet', x.multisigContractAddress))
          );
        }
      }
    ];

    opts = _.pick(opts, _.map(preferences, 'name'));
    try {
      _.each(preferences, preference => {
        const value = opts[preference.name];
        if (!value) return;
        if (!preference.isValid(value)) {
          throw new Error('Invalid ' + preference.name);
        }
      });
    } catch (ex) {
      return cb(new ClientError(ex));
    }

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      if (!Constants.EVM_CHAINS[wallet.chain.toUpperCase()]) {
        opts.tokenAddresses = null;
        opts.multisigEthInfo = null;
      }

      if (wallet.coin != 'matic') {
        opts.maticMokenAddresses = null;
        opts.multisigMaticInfo = null;
      }

      this._runLocked(cb, cb => {
        this.storage.fetchPreferences(this.walletId, this.copayerId, (err, oldPref) => {
          if (err) return cb(err);

          const newPref = Preferences.create({
            walletId: this.walletId,
            copayerId: this.copayerId
          });
          const preferences = Preferences.fromObj(_.defaults(newPref, opts, oldPref));

          // merge eth tokenAddresses
          if (opts.tokenAddresses) {
            oldPref = oldPref || {};
            oldPref.tokenAddresses = oldPref.tokenAddresses || [];
            preferences.tokenAddresses = _.uniq(oldPref.tokenAddresses.concat(opts.tokenAddresses));
          }

          // merge eth multisigEthInfo
          if (opts.multisigEthInfo) {
            oldPref = oldPref || {};
            oldPref.multisigEthInfo = oldPref.multisigEthInfo || [];

            preferences.multisigEthInfo = _.uniq(
              oldPref.multisigEthInfo.concat(opts.multisigEthInfo).reduce((x, y) => {
                let exists = false;
                x.forEach(e => {
                  // add new token addresses linked to the multisig wallet
                  if (e.multisigContractAddress === y.multisigContractAddress) {
                    e.tokenAddresses = e.tokenAddresses || [];
                    y.tokenAddresses = _.uniq(e.tokenAddresses.concat(y.tokenAddresses));
                    e = Object.assign(e, y);
                    exists = true;
                  }
                });
                return exists ? x : [...x, y];
              }, [])
            );
          }

          // merge matic tokenAddresses
          if (opts.maticTokenAddresses) {
            oldPref = oldPref || {};
            oldPref.maticTokenAddresses = oldPref.maticTokenAddresses || [];
            preferences.maticTokenAddresses = _.uniq(oldPref.maticTokenAddresses.concat(opts.maticTokenAddresses));
          }

          // merge matic multisigMaticInfo
          if (opts.multisigMaticInfo) {
            oldPref = oldPref || {};
            oldPref.multisigMaticInfo = oldPref.multisigMaticInfo || [];

            preferences.multisigMaticInfo = _.uniq(
              oldPref.multisigMaticInfo.concat(opts.multisigMaticInfo).reduce((x, y) => {
                let exists = false;
                x.forEach(e => {
                  // add new token addresses linked to the multisig wallet
                  if (e.multisigContractAddress === y.multisigContractAddress) {
                    e.maticTokenAddresses = e.maticTokenAddresses || [];
                    y.maticTokenAddresses = _.uniq(e.maticTokenAddresses.concat(y.maticTokenAddresses));
                    e = Object.assign(e, y);
                    exists = true;
                  }
                });
                return exists ? x : [...x, y];
              }, [])
            );
          }
          this.storage.storePreferences(preferences, err => {
            return cb(err);
          });
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
    this.storage.fetchPreferences(this.walletId, this.copayerId, (err, preferences) => {
      if (err) return cb(err);
      return cb(null, preferences || {});
    });
  }

  _canCreateAddress(ignoreMaxGap, cb) {
    if (ignoreMaxGap) return cb(null, true);

    this.storage.fetchAddresses(this.walletId, (err, addresses: IAddress[]) => {
      if (err) return cb(err);
      const latestAddresses = addresses.filter(x => !x.isChange).slice(-Defaults.MAX_MAIN_ADDRESS_GAP) as IAddress[];
      if (
        latestAddresses.length < Defaults.MAX_MAIN_ADDRESS_GAP ||
        _.some(latestAddresses, {
          hasActivity: true
        })
      )
        return cb(null, true);

      const bc = this._getBlockchainExplorer(latestAddresses[0].coin, latestAddresses[0].network);
      if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
      let activityFound = false;
      let i = latestAddresses.length;
      async.whilst(
        () => {
          return i > 0 && !activityFound;
        },
        next => {
          bc.getAddressActivity(latestAddresses[--i].address, (err, res) => {
            if (err) return next(err);
            activityFound = !!res;
            return next();
          });
        },
        err => {
          if (err) return cb(err);
          if (!activityFound) return cb(null, false);

          const address = latestAddresses[i];
          address.hasActivity = true;
          this.storage.storeAddress(address, err => {
            return cb(err, true);
          });
        }
      );
    });
  }

  _store(wallet, address, cb, checkSync = false) {
    let stoAddress = _.clone(address);
    ChainService.addressToStorageTransform(wallet.chain, wallet.network, stoAddress);
    this.storage.storeAddressAndWallet(wallet, stoAddress, (err, isDuplicate) => {
      if (err) return cb(err);
      this.syncWallet(
        wallet,
        err2 => {
          if (err2) {
            this.logw('Error syncing v8 addresses: ', err2);
          }
          return cb(null, isDuplicate);
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
        address = wallet.createAddress(!!opts.isChange);
      } catch (e) {
        this.logw('Error creating address', e);
        return cb('Bad xPub');
      }

      this._store(
        wallet,
        address,
        (err, duplicate) => {
          if (err) return cb(err);
          if (duplicate) return cb(null, address);
          if (wallet.chain == 'bch' && opts.noCashAddr) {
            address = _.cloneDeep(address);
            address.address = BCHAddressTranslator.translate(address.address, 'copay');
          }

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
        if (!_.isEmpty(addresses)) {
          let x = _.head(addresses);
          ChainService.addressFromStorageTransform(wallet.chain, wallet.network, x);
          return cb(null, x);
        }
        return createNewAddress(wallet, cb);
      });
    };

    this.getWallet({ doNotMigrate: opts.doNotMigrate }, (err, wallet) => {
      if (err) return cb(err);

      if (ChainService.isSingleAddress(wallet.chain)) {
        opts.ignoreMaxGap = true;
        opts.singleAddress = true;
      }

      this._canCreateAddress(opts.ignoreMaxGap || opts.singleAddress || wallet.singleAddress, (err, canCreate) => {
        if (err) return cb(err);
        if (!canCreate) return cb(Errors.MAIN_ADDRESS_GAP_REACHED);

        this._runLocked(
          cb,
          cb => {
            this.getWallet({ doNotMigrate: opts.doNotMigrate }, (err, wallet) => {
              if (err) return cb(err);
              if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);
              if (wallet.scanStatus == 'error') return cb(Errors.WALLET_NEED_SCAN);

              const createFn = opts.singleAddress || wallet.singleAddress ? getFirstAddress : createNewAddress;
              return createFn(wallet, (err, address) => {
                if (err) {
                  return cb(err);
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

      this.getWallet({}, (err, wallet) => {
        _.each(onlyMain, x => {
          ChainService.addressFromStorageTransform(wallet.chain, wallet.network, x);
        });
        return cb(null, onlyMain);
      });
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

      const isValid = !!this._getSigningKey(opts.message, opts.signature, copayer.requestPubKeys);
      return cb(null, isValid);
    });
  }

  _getBlockchainExplorer(chain, network): ReturnType<typeof BlockChainExplorer> {
    let opts: Partial<{
      provider: string;
      chain: string;
      network: string;
      userAgent: string;
    }> = {};

    let provider;

    // blockchainExplorerOpts has lowercased fields
    chain = chain.toLowerCase();

    if (this.blockchainExplorer) return this.blockchainExplorer;
    if (this.blockchainExplorerOpts) {
      if (this.blockchainExplorerOpts[chain] && this.blockchainExplorerOpts[chain][network]) {
        opts = this.blockchainExplorerOpts[chain][network];
        provider = opts.provider;
      } else if (this.blockchainExplorerOpts[network]) {
        opts = this.blockchainExplorerOpts[network];
      }
    }
    opts.provider = provider;
    opts.chain = chain;
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

  getUtxosForCurrentWallet(opts, cb) {
    opts = opts || {};

    const utxoKey = utxo => {
      return utxo.txid + '|' + utxo.vout;
    };

    let coin, allAddresses, allUtxos, utxoIndex, addressStrs, bc, wallet, blockchainHeight;
    async.series(
      [
        next => {
          this.getWallet({}, (err, w) => {
            if (err) return next(err);

            wallet = w;

            if (wallet.scanStatus == 'error') return cb(Errors.WALLET_NEED_SCAN);

            bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
            if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
            return next();
          });
        },
        next => {
          if (_.isArray(opts.addresses)) {
            allAddresses = opts.addresses;
            return next();
          }

          // even with Grouping we need address for pubkeys and path (see last step)
          this.storage.fetchAddresses(this.walletId, (err, addresses) => {
            _.each(addresses, x => {
              ChainService.addressFromStorageTransform(wallet.chain, wallet.network, x);
            });
            allAddresses = addresses;
            if (allAddresses.length == 0) return cb(null, []);

            return next();
          });
        },
        next => {
          addressStrs = _.map(allAddresses, 'address');
          return next();
        },
        next => {
          if (!wallet.isComplete()) return next();
          this._getBlockchainHeight(wallet.chain, wallet.network, (err, height, hash) => {
            if (err) return next(err);
            blockchainHeight = height;
            next();
          });
        },
        next => {
          if (!wallet.isComplete()) return next();

          const dustThreshold = Bitcore_[wallet.chain].Transaction.DUST_AMOUNT;
          const isEscrowPayment = wallet.isZceCompatible() && opts.instantAcceptanceEscrow ? true : false;
          const replaceTxByFee = opts.replaceTxByFee ? true : false;
          bc.getUtxos(
            wallet,
            blockchainHeight,
            (err, utxos) => {
              if (err) return next(err);
              if (utxos.length == 0) return cb(null, []);

              let unusableAddresses = [];
              if (isEscrowPayment) {
                const unusableUtxos = utxos.filter(utxo => utxo.spent || utxo.address.startsWith('p'));
                unusableAddresses = unusableUtxos.map(utxo => utxo.address);
              }

              allUtxos = utxos.filter(x => x.satoshis >= dustThreshold && !unusableAddresses.includes(x.address));

              return next();
            },
            { includeSpent: isEscrowPayment || replaceTxByFee }
          );
        },
        next => {
          if (!wallet.isComplete() || !wallet.isZceCompatible()) return next();

          // Ensure no UTXOs which originate from addresses that were recently used to fund a currently
          // insufficiently confirmed ZCE-secured payment can be used to fund any subsequent transactions
          // until the ZCE-secured payment (and escrow reclaim tx) receives 11 confirmations.
          // Rationale: https://github.com/bitjson/bch-zce#wallet-utxo-selection

          const bchRollingBlockCheckpointNumber = 10;
          const bchReorgSafeBlockHeight = blockchainHeight - bchRollingBlockCheckpointNumber - 1;
          let lockedAddresses = [];
          bc.getTransactions(wallet, bchReorgSafeBlockHeight, (err, txs) => {
            if (err) return next(err);
            const unconfirmedZceTxs = txs.filter(tx => tx.category === 'move' && tx.address.startsWith('p'));
            async.each(
              unconfirmedZceTxs,
              (tx: any, next) => {
                this.getCoinsForTx({ txId: tx.txid }, (err, coins) => {
                  if (err) return next(err);
                  const inputAddresses = coins.inputs.map(input => input.address);
                  lockedAddresses = [...lockedAddresses, ...inputAddresses];
                  return next();
                });
              },
              err => {
                if (err) return next(err);
                allUtxos = allUtxos.map(utxo => {
                  if (lockedAddresses.includes(utxo.address)) {
                    utxo.locked = true;
                  }
                  return utxo;
                });
                return next();
              }
            );
          });
        },
        next => {
          utxoIndex = _.keyBy(allUtxos, utxoKey);

          this.getPendingTxs({}, (err, txps) => {
            if (err) return next(err);

            const lockedInputs = _.map(_.flatten(_.map(txps, 'inputs')), utxoKey);
            _.each(lockedInputs, input => {
              if (utxoIndex[input]) {
                utxoIndex[input].locked = true;
              }
            });
            logger.debug(`Got  ${lockedInputs.length} locked utxos`);
            return next();
          });
        },
        next => {
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
              const txIdArray = _.map(opts.inputs, 'txid');

              _.each(spentInputs, input => {
                if (utxoIndex[input]) {
                  utxoIndex[input].spent = true;
                }
              });
              // except spent inputs of the RBF transaction if it's a replacement
              allUtxos = _.reject(allUtxos, utxo => {
                return (
                  (!opts.replaceTxByFee && utxo.spent) ||
                  (utxo.spent && opts.replaceTxByFee && !_.includes(txIdArray, utxo.txid))
                );
              });
              logger.debug(`Got ${allUtxos.length} usable UTXOs`);
              return next();
            }
          );
        },
        next => {
          // Needed for the clients to sign UTXOs
          const addressToPath = _.keyBy(allAddresses, 'address');
          _.each(allUtxos, utxo => {
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
      if (opts.addresses.length > 1) return cb(new ClientError('Addresses option only support 1 address'));

      this.getWallet({}, (err, wallet) => {
        if (err) return cb(err);

        const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
        if (!bc) {
          return cb(new Error('Could not get blockchain explorer instance'));
        }

        const address = opts.addresses[0];
        const A = Bitcore_[wallet.chain].Address;
        let addrObj: { network?: { name?: string } } = {};
        try {
          addrObj = new A(address);
        } catch (ex) {
          return cb(null, []);
        }
        if (addrObj.network.name != wallet.network) {
          return cb(null, []);
        }

        this._getBlockchainHeight(wallet.chain, wallet.network, (err, height, hash) => {
          if (err) return cb(err);
          bc.getAddressUtxos(address, height, (err, utxos) => {
            if (err) return cb(err);
            return cb(null, utxos);
          });
        });
      });
    } else {
      this.getUtxosForCurrentWallet({}, cb);
    }
  }

  /**
   * Returns list of Coins for TX
   * @param {Object} opts
   * @param {string} opts.coin - The coin of the transaction.
   * @param {string} opts.network - the network of the transaction.
   * @param {string} opts.txId - the transaction id.
   * @returns {Obejct} coins - Inputs and Outputs of the transaction.
   */
  getCoinsForTx(opts, cb) {
    this.getWallet({}, (err, wallet) => {
      if (!ChainService.isUTXOChain(wallet.chain)) {
        // this prevents old BWC clients to break
        return cb(null, {
          inputs: [],
          outputs: []
        });
      }
      const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
      if (!bc) {
        return cb(new Error('Could not get blockchain explorer instance'));
      }

      bc.getCoinsForTx(opts.txId, (err, coins) => {
        if (err) return cb(err);
        return cb(null, coins);
      });
    });
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
        const emptyBalance = {
          totalAmount: 0,
          lockedAmount: 0,
          totalConfirmedAmount: 0,
          lockedConfirmedAmount: 0,
          availableAmount: 0,
          availableConfirmedAmount: 0
        };
        return cb(null, emptyBalance);
      }

      this.syncWallet(wallet, err => {
        if (err) return cb(err);
        return ChainService.getWalletBalance(this, wallet, opts, cb);
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
   * @param {string} opts.usePayPro[=false] - Optional. Use fee estimation for paypro
   * @param {string} opts.from - Optional. Specify the sender ETH address.
   * @returns {Object} sendMaxInfo
   */
  getSendMaxInfo(opts, cb) {
    opts = opts || {};

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      const feeArgs = boolToNum(!!opts.feeLevel) + boolToNum(_.isNumber(opts.feePerKb));
      if (feeArgs > 1) return cb(new ClientError('Only one of feeLevel/feePerKb can be specified'));

      if (feeArgs == 0) {
        opts.feeLevel = 'normal';
      }

      const feeLevels = Defaults.FEE_LEVELS[wallet.chain];
      if (opts.feeLevel) {
        if (
          !_.some(feeLevels, {
            name: opts.feeLevel
          })
        )
          return cb(new ClientError('Invalid fee level. Valid values are ' + _.map(feeLevels, 'name').join(', ')));
      }

      if (_.isNumber(opts.feePerKb)) {
        if (opts.feePerKb < Defaults.MIN_FEE_PER_KB || opts.feePerKb > Defaults.MAX_FEE_PER_KB[wallet.chain])
          return cb(new ClientError('Invalid fee per KB'));
      }

      return ChainService.getWalletSendMaxInfo(this, wallet, opts, cb);
    });
  }

  _sampleFeeLevels(chain, network, points, cb) {
    const bc = this._getBlockchainExplorer(chain, network);
    if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
    bc.estimateFee(points, (err, result) => {
      if (err) {
        this.logw('Error estimating fee', err);
        return cb(err);
      }

      const failed = [];
      const levels = _.fromPairs(
        _.map(points, p => {
          const feePerKb = _.isObject(result) && result[p] && _.isNumber(result[p]) ? +result[p] : -1;
          if (feePerKb < 0) failed.push(p);

          // NOTE: ONLY BTC/BCH/DOGE/LTC expect feePerKb to be Bitcoin amounts
          // others... expect wei.

          return ChainService.convertFeePerKb(chain, p, feePerKb);
        })
      );

      if (failed.length) {
        const logger = network == 'livenet' ? this.logw : this.logi;
        logger('Could not compute fee estimation in ' + network + ': ' + failed.join(', ') + ' blocks.');
      }

      return cb(null, levels, failed.length);
    });
  }

  estimateFee(opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      const bc = this._getBlockchainExplorer(opts.chain, opts.network);
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.estimateFeeV2(opts, (err, result) => {
        if (err) {
          this.logw('Error estimating fee', err);
          return reject(err);
        }
        return resolve(result);
      });
    });
  }

  estimatePriorityFee(opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      const bc = this._getBlockchainExplorer(opts.chain, opts.network);
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.estimatePriorityFee(opts, (err, result) => {
        if (err) {
          this.logw('Error estimating priority fee', err);
          return reject(err);
        }
        return resolve(result);
      });
    });
  }

  /**
   * Returns fee levels for the current state of the network.
   * @param {Object} opts
   * @param {string} [opts.coin = 'btc'] - The coin to estimate fee levels from.
   * @param {string} [opts.chain = 'btc'] - The coin to estimate fee levels from.
   * @param {string} [opts.network = 'livenet'] - The Bitcoin network to estimate fee levels from.
   * @returns {Object} feeLevels - A list of fee levels & associated amount per kB in satoshi.
   */
  getFeeLevels(opts, cb) {
    opts = opts || {};

    opts.chain = opts.chain || Defaults.CHAIN;
    if (!Utils.checkValueInCollection(opts.chain, Constants.CHAINS)) return cb(new ClientError('Invalid chain'));

    opts.network = opts.network || 'livenet';
    if (!Utils.checkValueInCollection(opts.network, Constants.NETWORKS)) return cb(new ClientError('Invalid network'));

    const cacheKey = 'feeLevel:' + opts.chain + ':' + opts.network;

    this.storage.checkAndUseGlobalCache(cacheKey, Defaults.FEE_LEVEL_CACHE_DURATION, (err, values, oldvalues) => {
      if (err) return cb(err);
      if (values) return cb(null, values, true);

      const feeLevels = Defaults.FEE_LEVELS[opts.chain];

      /*
      if (opts.chain === 'doge') {
        const defaultDogeFeeLevels = feeLevels[0];
        const result: {
          feePerKb?: number;
          nbBlocks?: number;
          level: string;
        } = {
          level: defaultDogeFeeLevels.name,
          nbBlocks: defaultDogeFeeLevels.nbBlocks,
          feePerKb: defaultDogeFeeLevels.defaultValue
        };
        return cb(null, [result]);
      }
      */

      const samplePoints = () => {
        const definedPoints = _.uniq(_.map(feeLevels, 'nbBlocks'));
        return _.uniq(
          _.flatten(
            _.map(definedPoints, p => {
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

      this._sampleFeeLevels(opts.chain, opts.network, samplePoints(), (err, feeSamples, failed) => {
        if (err) {
          if (oldvalues) {
            this.logw('##  There was an error estimating fees... using old cached values');
            return cb(null, oldvalues, true);
          }
        }

        const values = _.map(feeLevels, level => {
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
            const feeLevel = getFeeLevel(feeSamples, level, level.nbBlocks, Defaults.FEE_LEVELS_FALLBACK);
            result.feePerKb = +(feeLevel.feePerKb * (level.multiplier || 1)).toFixed(0);
            result.nbBlocks = feeLevel.nbBlocks;
          }
          return result;
        });

        // Ensure monotonically decreasing values
        for (let i = 1; i < values.length; i++) {
          values[i].feePerKb = Math.min(values[i].feePerKb, values[i - 1].feePerKb);
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
    });
  }

  _canCreateTx(cb) {
    this.storage.fetchLastTxs(this.walletId, this.copayerId, 5 + Defaults.BACKOFF_OFFSET, (err, txs) => {
      if (err) return cb(err);

      if (!txs.length) return cb(null, true);

      const lastRejections = _.takeWhile(txs, {
        status: 'rejected'
      });

      const exceededRejections = lastRejections.length - Defaults.BACKOFF_OFFSET;
      if (exceededRejections <= 0) return cb(null, true);

      const lastTxTs = txs[0].createdOn;
      const now = Math.floor(Date.now() / 1000);
      const timeSinceLastRejection = now - lastTxTs;
      const backoffTime = Defaults.BACKOFF_TIME;

      if (timeSinceLastRejection <= backoffTime)
        this.logd('Not allowing to create TX: timeSinceLastRejection/backoffTime', timeSinceLastRejection, backoffTime);

      return cb(null, timeSinceLastRejection > backoffTime);
    });
  }

  _validateOutputs(opts, wallet, cb) {
    if (_.isEmpty(opts.outputs)) return new ClientError('No outputs were specified');

    for (let i = 0; i < opts.outputs.length; i++) {
      const output = opts.outputs[i];
      output.valid = false;

      try {
        ChainService.validateAddress(wallet, output.toAddress, opts);
      } catch (addrErr) {
        return addrErr;
      }

      if (!checkRequired(output, ['toAddress', 'amount'])) {
        return new ClientError('Argument missing in output #' + (i + 1) + '.');
      }

      if (!ChainService.checkValidTxAmount(wallet.chain, output)) {
        return new ClientError('Invalid amount');
      }

      const error = ChainService.checkDust(wallet.chain, output, opts);
      if (error) return error;
      output.valid = true;
    }
    return null;
  }

  _validateAndSanitizeTxOpts(wallet, opts, cb) {
    async.series(
      [
        next => {
          const feeArgs =
            boolToNum(!!opts.feeLevel) + boolToNum(_.isNumber(opts.feePerKb)) + boolToNum(_.isNumber(opts.fee));
          if (feeArgs > 1) return next(new ClientError('Only one of feeLevel/feePerKb/fee can be specified'));

          if (feeArgs == 0) {
            opts.feeLevel = 'normal';
          }

          const feeLevels = Defaults.FEE_LEVELS[wallet.chain];
          if (opts.feeLevel) {
            if (
              !_.some(feeLevels, {
                name: opts.feeLevel
              })
            )
              return next(
                new ClientError('Invalid fee level. Valid values are ' + _.map(feeLevels, 'name').join(', '))
              );
          }

          const error = ChainService.checkUtxos(wallet.chain, opts);
          if (error) {
            return next(new ClientError('fee can only be set when inputs are specified'));
          }
          next();
        },
        next => {
          if (wallet.singleAddress && opts.changeAddress)
            return next(new ClientError('Cannot specify change address on single-address wallet'));
          next();
        },

        next => {
          if (!opts.sendMax) return next();
          if (!_.isArray(opts.outputs) || opts.outputs.length > 1) {
            return next(new ClientError('Only one output allowed when sendMax is specified'));
          }
          if (_.isNumber(opts.outputs[0].amount))
            return next(new ClientError('Amount is not allowed when sendMax is specified'));
          if (_.isNumber(opts.fee))
            return next(
              new ClientError('Fee is not allowed when sendMax is specified (use feeLevel/feePerKb instead)')
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
              opts.inputs = info.inputs;
              return next();
            }
          );
        },
        next => {
          const validationError = this._validateOutputs(opts, wallet, next);
          if (validationError) {
            return next(validationError);
          }
          next();
        },
        next => {
          // check outputs are on 'copay' format for BCH
          if (wallet.chain != 'bch') return next();
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
        chain: wallet.chain,
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
    const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
    if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
    bc.getTransactionCount(address, (err, nonce) => {
      if (err) {
        this.logw('Error estimating nonce', err);
        return cb(err);
      }
      return cb(null, nonce);
    });
  }

  getNonce(opts) {
    const bc = this._getBlockchainExplorer(opts.chain || opts.coin || Defaults.EVM_CHAIN, opts.network);
    return new Promise((resolve, reject) => {
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.getTransactionCount(opts.address, (err, nonce) => {
        if (err) {
          this.logw('Error estimating nonce', err);
          return reject(err);
        }
        return resolve(nonce);
      });
    });
  }

  estimateGas(opts) {
    const bc = this._getBlockchainExplorer(opts.chain || opts.coin || Defaults.EVM_CHAIN, opts.network);
    return new Promise((resolve, reject) => {
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.estimateGas(opts, (err, gasLimit) => {
        if (err) {
          this.logw('Error estimating gas limit', err);
          return reject(err);
        }
        return resolve(gasLimit);
      });
    });
  }

  getMultisigContractInstantiationInfo(opts) {
    const bc = this._getBlockchainExplorer(opts.chain || Defaults.EVM_CHAIN, opts.network);
    return new Promise((resolve, reject) => {
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.getMultisigContractInstantiationInfo(opts, (err, contractInstantiationInfo) => {
        if (err) {
          this.logw('Error getting contract instantiation info', err);
          return reject(err);
        }
        return resolve(contractInstantiationInfo);
      });
    });
  }

  getMultisigContractInfo(opts) {
    const bc = this._getBlockchainExplorer(opts.chain || Defaults.EVM_CHAIN, opts.network);
    return new Promise((resolve, reject) => {
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.getMultisigContractInfo(opts, (err, contractInfo) => {
        if (err) {
          this.logw('Error getting contract instantiation info', err);
          return reject(err);
        }
        return resolve(contractInfo);
      });
    });
  }

  getTokenContractInfo(opts) {
    const bc = this._getBlockchainExplorer(opts.chain || Defaults.EVM_CHAIN, opts.network);
    return new Promise((resolve, reject) => {
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.getTokenContractInfo(opts, (err, contractInfo) => {
        if (err) {
          this.logw('Error getting contract info', err);
          return reject(err);
        }
        return resolve(contractInfo);
      });
    });
  }

  getMultisigTxpsInfo(opts) {
    const bc = this._getBlockchainExplorer(opts.chain || Defaults.EVM_CHAIN, opts.network);
    return new Promise((resolve, reject) => {
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.getMultisigTxpsInfo(opts, (err, multisigTxpsInfo) => {
        if (err) {
          this.logw('Error getting contract txps hash', err);
          return reject(err);
        }
        return resolve(multisigTxpsInfo);
      });
    });
  }

  /**
   * Creates a new transaction proposal.
   * @param {Object} opts
   * @param {string} opts.txProposalId - Optional. If provided it will be used as this TX proposal ID. Should be unique in the scope of the wallet.
   * @param {String} opts.coin - tx coin.
   * @param {String} opts.chain - tx chain.
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
   * @param {Boolean} opts.dryRun[=false] - Optional. Simulate the action but do not change server state.
   * @param {Array} opts.inputs - Optional. Inputs for this TX
   * @param {Array} opts.txpVersion - Optional. Version for TX Proposal (current = 4, only =3 allowed).
   * @param {number} opts.fee - Optional. Use an fixed fee for this TX (only when opts.inputs is specified)
   * @param {Boolean} opts.noShuffleOutputs - Optional. If set, TX outputs won't be shuffled. Defaults to false
   * @param {Boolean} opts.noCashAddr - do not use cashaddress for bch
   * @param {Boolean} opts.signingMethod[=ecdsa] - do not use cashaddress for bch
   * @param {string} opts.tokenAddress - optional. ERC20 Token Contract Address
   * @param {string} opts.multisigContractAddress - optional. MULTISIG ETH Contract Address
   * @param {Boolean} opts.isTokenSwap - Optional. To specify if we are trying to make a token swap
   * @param {Boolean} opts.enableRBF - Optional. enable BTC Replace By Fee
   * @param {Boolean} opts.replaceTxByFee - Optional. Ignore locked utxos check ( used for replacing a transaction designated as RBF)
   * @param {number} opts.txType - Optional. Type of EVM transaction
   * @param {number} opts.priorityFeePercentile - Optional. Percentile of targeted priority fee rate
   * @returns {TxProposal} Transaction proposal. outputs address format will use the same format as inpunt.
   */
  createTx(opts, cb) {
    opts = opts ? _.clone(opts) : {};

    const checkTxpAlreadyExists = (txProposalId, cb) => {
      if (!txProposalId) return cb();
      this.storage.fetchTx(this.walletId, txProposalId, cb);
    };

    this._runLocked(
      cb,
      cb => {
        let changeAddress, feePerKb, gasPrice, gasLimit, fee, maxGasFee, priorityGasFee;
        this.getWallet({}, (err, wallet) => {
          if (err) return cb(err);
          if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

          if (wallet.scanStatus == 'error') return cb(Errors.WALLET_NEED_SCAN);

          if (config.suspendedChains && config.suspendedChains.includes(wallet.chain)) {
            let Err = Errors.NETWORK_SUSPENDED;
            Err.message = Err.message.replace('$network', wallet.chain.toUpperCase());
            return cb(Err);
          }

          checkTxpAlreadyExists(opts.txProposalId, (err, txp) => {
            if (err) return cb(err);
            if (txp) return cb(null, txp);

            async.series(
              [
                next => {
                  if (ChainService.isUTXOChain(wallet.chain)) return next();
                  this.getMainAddresses({ reverse: true, limit: 1 }, (err, mainAddr) => {
                    if (err) return next(err);
                    opts.from = mainAddr[0].address;
                    next();
                  });
                },
                next => {
                  this._validateAndSanitizeTxOpts(wallet, opts, next);
                },
                next => {
                  this._canCreateTx((err, canCreate) => {
                    if (err) return next(err);
                    if (!canCreate) return next(Errors.TX_CANNOT_CREATE);
                    next();
                  });
                },
                async next => {
                  if (opts.sendMax) return next();
                  try {
                    changeAddress = await ChainService.getChangeAddress(this, wallet, opts);
                  } catch (error) {
                    return next(error);
                  }
                  return next();
                },
                async next => {
                  if (_.isNumber(opts.fee) && !_.isEmpty(opts.inputs)) return next();
                  try {
                    ({ feePerKb, gasPrice, maxGasFee, priorityGasFee, gasLimit, fee } = await ChainService.getFee(this, wallet, opts));
                  } catch (error) {
                    return next(error);
                  }
                  next();
                },
                async next => {
                  if (!opts.nonce) {
                    try {
                      opts.nonce = await ChainService.getTransactionCount(this, wallet, opts.from);
                    } catch (error) {
                      return next(error);
                    }
                  }
                  return next();
                },
                async next => {
                  opts.signingMethod = opts.signingMethod || 'ecdsa';
                  opts.coin = opts.coin || wallet.coin;

                  if (!['ecdsa', 'schnorr'].includes(opts.signingMethod)) {
                    return next(Errors.WRONG_SIGNING_METHOD);
                  }

                  //  schnorr only on BCH
                  if (opts.coin != 'bch' && opts.signingMethod == 'schnorr') return next(Errors.WRONG_SIGNING_METHOD);

                  return next();
                },
                next => {
                  let txOptsFee = fee;

                  if (!txOptsFee) {
                    const useInputFee = opts.inputs && !_.isNumber(opts.feePerKb);
                    const isNotUtxoCoin = !ChainService.isUTXOChain(wallet.chain);
                    const shouldUseOptsFee = useInputFee || isNotUtxoCoin;

                    if (shouldUseOptsFee) {
                      txOptsFee = opts.fee;
                    }
                  }

                  const txOpts = {
                    id: opts.txProposalId,
                    walletId: this.walletId,
                    creatorId: this.copayerId,
                    coin: opts.coin,
                    chain: opts.chain?.toLowerCase() || ChainService.getChain(opts.coin), // getChain -> backwards compatibility
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
                    instantAcceptanceEscrow: opts.instantAcceptanceEscrow,
                    addressType: wallet.addressType,
                    customData: opts.customData,
                    inputs: opts.inputs,
                    version: opts.txpVersion,
                    fee: txOptsFee,
                    noShuffleOutputs: opts.noShuffleOutputs,
                    gasPrice,
                    maxGasFee,
                    priorityGasFee,
                    txType: opts.txType,
                    nonce: opts.nonce,
                    gasLimit, // Backward compatibility for BWC < v7.1.1
                    data: opts.data, // Backward compatibility for BWC < v7.1.1
                    tokenAddress: opts.tokenAddress,
                    multisigContractAddress: opts.multisigContractAddress,
                    multiSendContractAddress: opts.multiSendContractAddress,
                    destinationTag: opts.destinationTag,
                    invoiceID: opts.invoiceID,
                    signingMethod: opts.signingMethod,
                    isTokenSwap: opts.isTokenSwap,
                    enableRBF: opts.enableRBF,
                    replaceTxByFee: opts.replaceTxByFee
                  };
                  txp = TxProposal.create(txOpts);
                  next();
                },
                next => {
                  return ChainService.selectTxInputs(this, txp, wallet, opts, next);
                },
                async next => {
                  if (!wallet.isZceCompatible() || !opts.instantAcceptanceEscrow) return next();
                  try {
                    opts.inputs = txp.inputs;
                    const escrowAddress = await ChainService.getChangeAddress(this, wallet, opts);
                    txp.escrowAddress = escrowAddress;
                  } catch (error) {
                    return next(error);
                  }
                  if (opts.dryRun) return next();
                  this._store(wallet, txp.escrowAddress, next, true);
                },
                next => {
                  if (!changeAddress || wallet.singleAddress || opts.dryRun || opts.changeAddress) return next();

                  this._store(wallet, txp.changeAddress, next, true);
                },
                next => {
                  if (opts.dryRun) return next();

                  if (txp.coin == 'bch' && txp.changeAddress) {
                    const format = opts.noCashAddr ? 'copay' : 'cashaddr';
                    txp.changeAddress.address = BCHAddressTranslator.translate(txp.changeAddress.address, format);
                  }

                  this.storage.storeTx(wallet.id, txp, next);
                }
              ],
              err => {
                if (err) return cb(err);

                if (txp.coin == 'bch') {
                  if (opts.returnOrigAddrOutputs) {
                    logger.info('Returning Orig BCH address outputs for compat');
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
    if (!checkRequired(opts, ['txProposalId', 'proposalSignature'], cb)) return;

    this._runLocked(cb, cb => {
      this.getWallet({}, (err, wallet) => {
        if (err) return cb(err);

        if (config.suspendedChains && config.suspendedChains.includes(wallet.chain)) {
          let Err = Errors.NETWORK_SUSPENDED;
          Err.message = Err.message.replace('$network', wallet.chain.toUpperCase());
          return cb(Err);
        }

        this.storage.fetchTx(this.walletId, opts.txProposalId, (err, txp) => {
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
          const signingKey = this._getSigningKey(raw, opts.proposalSignature, copayer.requestPubKeys);
          if (!signingKey) {
            return cb(new ClientError('Invalid proposal signature'));
          }

          // Save signature info for other copayers to check
          txp.proposalSignature = opts.proposalSignature;
          if (signingKey.selfSigned) {
            txp.proposalSignaturePubKey = signingKey.key;
            txp.proposalSignaturePubKeySig = signingKey.signature;
          }

          ChainService.checkTxUTXOs(this, txp, opts, err => {
            if (err) return cb(err);
            txp.status = 'pending';
            this.storage.storeTx(this.walletId, txp, err => {
              if (err) return cb(err);

              this._notifyTxProposalAction('NewTxProposal', txp, () => {
                if (txp.coin == 'bch' && txp.changeAddress) {
                  const format = opts.noCashAddr ? 'copay' : 'cashaddr';
                  txp.changeAddress.address = BCHAddressTranslator.translate(txp.changeAddress.address, format);
                }
                return cb(null, txp);
              });
            });
          });
        });
      });
    });
  }

  /**
   * Retrieves a tx from storage.
   * @param {Object} opts
   * @param {string} opts.txProposalId - The tx proposal id.
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
   * Retrieves a tx from storage using txid
   * @param {Object} opts
   * @param {string} opts.txid - The tx blockchain id.
   * @returns {Object} txProposal
   */
  getTxByHash(opts, cb) {
    this.storage.fetchTxByHash(opts.txid, (err, txp) => {
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

    this._runLocked(cb, cb => {
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
        this.storage.storeTxNote(note, err => {
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
    this._runLocked(cb, cb => {
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
    if (approvers.length > 1 || (approvers.length == 1 && approvers[0] !== this.copayerId)) return lockTimeRemaining;

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

    this._runLocked(cb, cb => {
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

  _broadcastRawTx(chain, network, raw, cb) {
    const bc = this._getBlockchainExplorer(chain, network);
    if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
    bc.broadcast(raw, (err, txid) => {
      if (err) {
        logger.info('Error broadcasting tx: %o %o %o %o', chain, network, raw, err);
        return cb(err);
      }
      return cb(null, txid);
    });
  }

  /**
   * Broadcast a raw transaction.
   * @param {Object} opts
   * @param {string} [opts.coin = 'btc'] - The coin for this transaction.
   * @param {string} [opts.chain = 'btc'] - The coin for this transaction.
   * @param {string} [opts.network = 'livenet'] - The Bitcoin network for this transaction.
   * @param {string} opts.rawTx - Raw tx data.
   */
  broadcastRawTx(opts, cb) {
    if (!checkRequired(opts, ['network', 'rawTx'], cb)) return;

    opts.chain = opts.chain || opts.coin || Defaults.COIN;
    if (!Utils.checkValueInCollection(opts.chain, Constants.CHAINS)) return cb(new ClientError('Invalid chain'));

    opts.network = opts.network || 'livenet';
    if (!Utils.checkValueInCollection(opts.network, Constants.NETWORKS)) return cb(new ClientError('Invalid network'));
    this._broadcastRawTx(opts.chain, opts.network, opts.rawTx, cb);
  }

  _checkTxInBlockchain(txp, cb) {
    if (!txp.txid) return cb();
    const bc = this._getBlockchainExplorer(txp.chain, txp.network);
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
   * @param {string} opts.signatures - The signatures of the inputs of this tx for this copayer (in appearance order)
   * @param {string} opts.maxTxpVersion - Client's maximum supported txp version
   * @param {boolean} opts.supportBchSchnorr - indication whether to use schnorr for signing tx
   */
  signTx(opts, cb) {
    if (!checkRequired(opts, ['txProposalId', 'signatures'], cb)) return;
    opts.maxTxpVersion = opts.maxTxpVersion || 3;

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      if (config.suspendedChains && config.suspendedChains.includes(wallet.chain)) {
        let Err = Errors.NETWORK_SUSPENDED;
        Err.message = Err.message.replace('$network', wallet.chain.toUpperCase());
        return cb(Err);
      }

      this.getTx(
        {
          txProposalId: opts.txProposalId
        },
        async (err, txp) => {
          if (err) return cb(err);

          if (opts.maxTxpVersion < txp.version) {
            return cb(
              new ClientError(
                Errors.codes.UPGRADE_NEEDED,
                'Your client does not support signing this transaction. Please upgrade'
              )
            );
          }

          const action = _.find(txp.actions, {
            copayerId: this.copayerId
          });
          if (action) return cb(Errors.COPAYER_VOTED);
          if (!txp.isPending()) return cb(Errors.TX_NOT_PENDING);

          if (txp.signingMethod === 'schnorr' && !opts.supportBchSchnorr) return cb(Errors.UPGRADE_NEEDED);

          if (Constants.EVM_CHAINS[wallet.chain.toUpperCase()]) {
            try {
              const txps = await this.getPendingTxsPromise({});
              for (let t of txps) {
                if (t.id !== txp.id && t.nonce <= txp.nonce && t.status !== 'rejected') {
                  return cb(Errors.TX_NONCE_CONFLICT);
                }
              }
            } catch (err) {
              return cb(err);
            }
          }

          const copayer = wallet.getCopayer(this.copayerId);

          try {
            if (!txp.sign(this.copayerId, opts.signatures, copayer.xPubKey)) {
              this.logw('Error signing transaction (BAD_SIGNATURES)');
              this.logw('Client version:', this.clientVersion);
              this.logw('Arguments:', JSON.stringify(opts));
              this.logw('Transaction proposal:', JSON.stringify(txp));
              const raw = ChainService.getBitcoreTx(txp).uncheckedSerialize();
              this.logw('Raw tx:', raw);
              return cb(Errors.BAD_SIGNATURES);
            }
          } catch (ex) {
            this.logw('Error signing transaction proposal', ex);
            return cb(ex);
          }

          this.storage.storeTx(this.walletId, txp, err => {
            if (err) return cb(err);

            async.series(
              [
                next => {
                  this._notifyTxProposalAction(
                    'TxProposalAcceptedBy',
                    txp,
                    {
                      copayerId: this.copayerId
                    },
                    next
                  );
                },
                next => {
                  if (txp.isAccepted()) {
                    this._notifyTxProposalAction('TxProposalFinallyAccepted', txp, next);
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
    $.checkState(txp.txid, 'Failed state: txp.txid undefined at <_processBroadcast()>');
    opts = opts || {};
    txp.setBroadcasted();
    this.storage.storeTx(this.walletId, txp, err => {
      if (err) return cb(err);

      const extraArgs = {
        txid: txp.txid
      };
      if (opts.byThirdParty) {
        this._notifyTxProposalAction('NewOutgoingTxByThirdParty', txp, extraArgs);
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

      if (config.suspendedChains && config.suspendedChains.includes(wallet.chain)) {
        let Err = Errors.NETWORK_SUSPENDED;
        Err.message = Err.message.replace('$network', wallet.chain.toUpperCase());
        return cb(Err);
      }

      this.getTx(
        {
          txProposalId: opts.txProposalId
        },
        (err, txp) => {
          if (err) return cb(err);

          if (txp.status == 'broadcasted') return cb(Errors.TX_ALREADY_BROADCASTED);
          if (txp.status != 'accepted') return cb(Errors.TX_NOT_ACCEPTED);

          const sub = TxConfirmationSub.create({
            copayerId: txp.creatorId,
            txid: txp.txid,
            walletId: txp.walletId,
            amount: txp.amount,
            isActive: true,
            isCreator: true
          });
          this.storage.storeTxConfirmationSub(sub, err => {
            if (err) logger.error('Could not store Tx confirmation subscription: %o', err);

            let raw;
            try {
              raw = txp.getRawTx();
            } catch (ex) {
              return cb(ex);
            }
            this._broadcastRawTx(wallet.chain, wallet.network, raw, (err, txid) => {
              if (err || txid != txp.txid) {
                logger.warn('Broadcast failed: %o %o %o %o %o', wallet.id, wallet.chain, wallet.network, raw, err?.stack || err?.message || err);

                const broadcastErr = err;
                // Check if tx already in blockchain
                this._checkTxInBlockchain(txp, (err, isInBlockchain) => {
                  if (err) return cb(err);
                  if (!isInBlockchain) return cb(broadcastErr || 'broadcast error');

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
                  err => {
                    if (err) return cb(err);
                    return cb(null, txp);
                  }
                );
              }
            });
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

        this.storage.storeTx(this.walletId, txp, err => {
          if (err) return cb(err);

          async.series(
            [
              next => {
                this._notifyTxProposalAction(
                  'TxProposalRejectedBy',
                  txp,
                  {
                    copayerId: this.copayerId
                  },
                  next
                );
              },
              next => {
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
   * @param {String} opts.tokenAddress ERC20 Token Contract Address
   * @param {String} opts.multisigContractAddress MULTISIG ETH Contract Address
   * @param {String} opts.network  The network of the MULTISIG ETH transactions
   * @returns {TxProposal[]} Transaction proposal.
   */
  async getPendingTxs(opts, cb) {
    if (opts.tokenAddress) {
      return cb();
    } else if (opts.multisigContractAddress) {
      try {
        const multisigTxpsInfo = await this.getMultisigTxpsInfo(opts);
        const txps = await this.storage.fetchEthPendingTxs(multisigTxpsInfo);
        return cb(null, txps);
      } catch (error) {
        return cb(error);
      }
    } else {
      this.storage.fetchPendingTxs(this.walletId, (err, txps) => {
        if (err) return cb(err);

        _.each(txps, txp => {
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
          err => {
            txps = _.reject(txps, txp => {
              return txp.status == 'broadcasted';
            });

            if (txps[0] && txps[0].chain == 'bch') {
              const format = opts.noCashAddr ? 'copay' : 'cashaddr';
              _.each(txps, x => {
                if (x.changeAddress) {
                  x.changeAddress.address = BCHAddressTranslator.translate(x.changeAddress.address, format);
                }
                _.each(x.outputs, x => {
                  if (x.toAddress) {
                    x.toAddress = BCHAddressTranslator.translate(x.toAddress, format);
                  }
                });
              });
            }
            return cb(err, txps);
          }
        );
      });
    }
  }

  getPendingTxsPromise(opts): Promise<any>  {
    return new Promise((resolve, reject) => {
      this.getPendingTxs(opts, (err, txps) => {
        if (err) return reject(err);
        return resolve(txps)
      });
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
        [`${wallet.chain}:${wallet.network}`, this.walletId],
        (walletId, next) => {
          this.storage.fetchNotifications(walletId, opts.notificationId, opts.minTs || 0, next);
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
    const indexedFee: any = _.keyBy(_.filter(txs, { category: 'fee' } as any), 'txid');
    const indexedSend = _.keyBy(_.filter(txs, { category: 'send' } as any), 'txid');
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
        if (tx.satoshis < dustThreshold) return false;

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

    const fixMoves = cb2 => {
      if (_.isEmpty(moves)) return cb2();

      // each detected duplicate output move
      const moves3 = _.flatten(_.map(_.values(moves), 'outputs'));
      // check output address for change address
      this.storage.fetchAddressesByWalletId(walletId, _.map(moves3, 'address'), (err, addrs) => {
        if (err) return cb(err);

        const isChangeAddress = _.countBy(_.filter(addrs, { isChange: true }), 'address');
        _.each(moves, x => {
          _.remove(x.outputs, i => {
            return isChangeAddress[i.address];
          });
        });
        return cb2();
      });
    };

    fixMoves(err => {
      if (err) return cb(err);

      const ret = _.filter(
        _.map([].concat(txs), tx => {
          const t = new Date(tx.blockTime).getTime() / 1000;
          const c = tx.height >= 0 && bcHeight >= tx.height ? bcHeight - tx.height + 1 : 0;
          
          // This adapter rebuilds the abiType property from data contained in the effects so that it returns what wallet is used to
          // If we remove the slight reliance in the wallet on abiType then we can remove this adapter
          function recreateAbiType(effects) {
            // Check if any top level effects are ERC20 transfers
            if (effects && effects.length) {
              const erc20Transfer = effects.find(e => e.type == 'ERC20:transfer' && e.callStack == '');
              if (erc20Transfer) {
                // This is the only data used in old wallet and bitpay-app
                return { name: 'transfer' };
              }
            }
            return undefined;
          }

          const ret = {
            id: tx.id,
            txid: tx.txid,
            confirmations: c,
            blockheight: tx.height > 0 ? tx.height : null,
            fees: tx.fee || (indexedFee[tx.txid] ? Math.abs(indexedFee[tx.txid].satoshis) : null),
            time: t,
            size: tx.size,
            amount: 0,
            action: undefined,
            addressTo: undefined,
            outputs: undefined,
            dust: false,
            error: tx.error,
            internal: tx.internal,
            network: tx.network,
            chain: tx.chain,
            data: tx.data,
            abiType: tx.abiType || recreateAbiType(tx.effects),
            gasPrice: tx.gasPrice,
            maxGasFee: tx.maxGasFee, 
            priorityGasFee: tx.priorityGasFee,
            txType: tx.txType,
            gasLimit: tx.gasLimit,
            receipt: tx.receipt,
            nonce: tx.nonce,
            effects: tx.effects
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
              ret.addressTo = tx.outputs && tx.outputs.length ? tx.outputs[0].address : null;
              ret.outputs = tx.outputs;
              break;
            default:
              ret.action = 'invalid';
          }

          // not available
          // inputs: inputs,
          return ret;

          // filter out dust
        }),
        x => {
          return !x.dust;
        }
      );

      // console.log('[server.js.2965:ret:] END',ret); //TODO
      return cb(null, ret);
    });
  }

  _getBlockchainHeight(chain, network, cb) {
    const cacheKey = Storage.BCHEIGHT_KEY + ':' + chain + ':' + network;

    this.storage.checkAndUseGlobalCache(cacheKey, Defaults.BLOCKHEIGHT_CACHE_TIME, (err, values) => {
      if (err) return cb(err);

      if (values) return cb(null, values.current, values.hash, true);

      values = {};

      const bc = this._getBlockchainExplorer(chain, network);
      if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
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
    });
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
    const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);

    this.logd('Registering wallet');
    bc.register(wallet, err => {
      if (err) {
        return cb(err);
      }
      wallet.beRegistered = true;
      return this.storage.storeWallet(wallet, err => cb(err, true));
    });
  }

  checkWalletSync(bc, wallet, simpleRun, cb) {
    if (!wallet.addressManager && !wallet.addressManager.receiveAddressIndex) return cb(null, true);

    // check cache
    const totalAddresses = wallet.addressManager.receiveAddressIndex + wallet.addressManager.changeAddressIndex;

    this.storage.getWalletAddressChecked(wallet.id, (err, checkedTotal) => {
      if (checkedTotal == totalAddresses) {
        logger.debug('addresses checked already');
        return cb(null, true);
      }

      // only check total number of addreses
      if (simpleRun) return cb();

      this.storage.walletCheck({ walletId: wallet.id }).then((localCheck: { sum: number }) => {
        bc.getCheckData(wallet, (err, serverCheck) => {
          // If there is an error, just ignore it (server does not support walletCheck)
          if (err) {
            this.logw('Error at bitcore WalletCheck, ignoring' + err);
            return cb();
          }

          const isOK = serverCheck.sum == localCheck.sum;

          if (isOK) {
            logger.debug('Wallet Sync Check OK');
          } else {
            logger.warn('ERROR: Wallet check failed: %o', { localCheck, serverCheck });
            return cb(null, isOK);
          }

          this.storage.setWalletAddressChecked(wallet.id, totalAddresses, err => {
            return cb(null, isOK);
          });
        });
      });
    });
  }

  // Syncs wallet regitration and address with a V8 type blockexplorerer
  syncWallet(wallet, cb, skipCheck?, count?) {
    count = count || 0;
    const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
    if (!bc) {
      return cb(new Error('Could not get blockchain explorer instance'));
    }

    this.updateWalletV8Keys(wallet);
    this.registerWalletV8(wallet, (err, justRegistered) => {
      if (err) {
        return cb(err);
      }

      // First
      this.checkWalletSync(bc, wallet, true, (err, isOK) => {
        // ignore err
        if (isOK && !justRegistered) return cb();

        this.storage.fetchUnsyncAddresses(this.walletId, (err, addresses) => {
          if (err) {
            return cb(err);
          }

          const syncAddr = (addresses, icb) => {
            if (!addresses || _.isEmpty(addresses)) {
              // this.logi('Addresses already sync');
              return icb();
            }

            const addressStr = _.map(addresses, x => {
              ChainService.addressFromStorageTransform(wallet.chain, wallet.network, x);
              return x.address;
            });

            this.logd('Syncing addresses: ', addressStr.length);
            bc.addAddresses(wallet, addressStr, err => {
              if (err) return cb(err);
              this.storage.markSyncedAddresses(addressStr, icb);
            });
          };

          syncAddr(addresses, err => {
            if (skipCheck || doNotCheckV8) return cb();

            this.checkWalletSync(bc, wallet, false, (err, isOK) => {
              // ignore err
              if (err) return cb();

              if (isOK) return cb();

              if (count++ >= 1) {
                logger.warn('## ERROR: TRIED TO SYNC WALLET AND FAILED. GIVING UP');
                return cb();
              }
              logger.info('Trying to RESYNC wallet... count:' + count);

              // Reset sync and sync again...
              wallet.beRegistered = false;
              this.storage.deregisterWallet(wallet.id, () => {
                this.syncWallet(wallet, cb, false, count);
              });
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

    const classify = items => {
      return _.map(items, item => {
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
      if (amountIn == amountOut + amountOutChange + (amountIn > 0 ? tx.fees : 0)) {
        amount = amountOut;
        action = 'moved';
      } else {
        // BWS standard sent
        // (amountIn > 0 && amountOutChange >0 && outputs.length <= 2)
        amount = amountIn - amountOut - amountOutChange - (amountIn > 0 && amountOutChange > 0 ? tx.fees : 0);
        action = amount > 0 ? 'sent' : 'received';
      }

      amount = Math.abs(amount);
      if (action == 'sent' || action == 'moved') {
        const firstExternalOutput = outputs.find(o => o.isMine === false);
        addressTo = firstExternalOutput ? firstExternalOutput.address : null;
      }

      if (action == 'sent' && inputs.length != _.filter(inputs, 'isMine').length) {
        foreignCrafted = true;
      }
    } else {
      action = 'invalid';
      amount = 0;
    }

    const formatOutput = o => {
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
      newTx.inputs = _.map(inputs, input => {
        return _.pick(input, 'address', 'amount', 'isMine');
      });
      newTx.outputs = _.map(outputs, output => {
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

  static _addProposalInfo(tx: any, indexedProposals: { [txid: string]: TxProposal }, opts: any) {
    opts = opts || {};
    const proposal = indexedProposals[tx.txid];
    if (proposal) {
      tx.createdOn = proposal.createdOn;
      tx.proposalId = proposal.id;
      tx.proposalType = proposal.type;
      tx.creatorName = proposal.creatorName;
      tx.message = proposal.message;
      tx.nonce = proposal.nonce;
      tx.actions = _.map(proposal.actions, action => {
        return _.pick(action, ['createdOn', 'type', 'copayerId', 'copayerName', 'comment']);
      });
      _.each(tx.outputs, output => {
        const query = {
          toAddress: output.address,
          amount: output.amount
        };
        if (proposal.outputs) {
          const txpOut = proposal.outputs.find(o => o.toAddress === output.address && o.amount === output.amount);
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

  /**
   * // Create Advertisement
   * @param opts
   * @param cb
   */
  createAdvert(opts, cb) {
    opts = opts ? _.clone(opts) : {};

    // Usually do error checking on preconditions
    if (!checkRequired(opts, ['title'], cb)) {
      return;
    }
    // Check if ad exists already

    const checkIfAdvertExistsAlready = (adId, cb) => {
      this.storage.fetchAdvert(opts.adId, (err, result) => {
        if (err) return cb(err);

        if (result) {
          return cb(Errors.AD_ALREADY_EXISTS);
        }

        if (!result) {
          let x = new Advertisement();

          x.advertisementId = opts.advertisementId || Uuid.v4();
          x.name = opts.name;
          x.title = opts.title;
          x.country = opts.country;
          x.type = opts.type;
          x.body = opts.body;
          x.imgUrl = opts.imgUrl;
          x.linkText = opts.linkText;
          x.linkUrl = opts.linkUrl;
          x.isAdActive = opts.isAdActive;
          x.dismissible = opts.dismissible;
          x.signature = opts.signature;
          x.app = opts.app;
          x.isTesting = opts.isTesting;

          return cb(null, x);
        }
      });
    };

    this._runLocked(
      cb,
      cb => {
        checkIfAdvertExistsAlready(opts.adId, (err, advert) => {
          if (err) throw err;
          if (advert) {
            try {
              this.storage.storeAdvert(advert, cb);
            } catch (err) {
              throw err;
            }
          }
        });
      },
      10 * 1000
    );
  }

  /**
   * Get All active (live) advertisements
   * @param opts
   * @param opts.adId - adId of advert to get
   * @param cb
   */
  getAdvert(opts, cb) {
    this.storage.fetchAdvert(opts.adId, (err, advert) => {
      if (err) return cb(err);
      return cb(null, advert);
    });
  }

  /**
   * Get All active (live) advertisements
   * @param opts
   * @param cb
   */
  getAdverts(opts, cb) {
    this.storage.fetchActiveAdverts((err, adverts) => {
      if (err) return cb(err);
      return cb(null, adverts);
    });
  }

  /**
   * Get adverts by country
   * @param opts.country
   * @param cb
   */
  getAdvertsByCountry(opts, cb) {
    this.storage.fetchAdvertsByCountry(opts.country, (err, adverts) => {
      if (err) return cb(err);
      return cb(null, adverts);
    });
  }

  /**
   * Get All active (live) advertisements
   * @param opts
   * @param cb
   */
  getTestingAdverts(opts, cb) {
    this.storage.fetchTestingAdverts((err, adverts) => {
      if (err) return cb(err);
      return cb(null, adverts);
    });
  }

  /**
   * Get all adverts regardless of inactive or active.
   * @param opts
   * @param cb
   */
  getAllAdverts(opts, cb) {
    this._runLocked(cb, cb => {
      this.getAllAdverts(opts, cb);
    });
  }

  removeAdvert(opts, cb) {
    opts = opts ? _.clone(opts) : {};

    // Usually do error checking on preconditions
    if (!checkRequired(opts, ['adId'], cb)) {
      throw new Error('adId is missing');
    }
    // Check if ad exists already

    const checkIfAdvertExistsAlready = (adId, cb) => {
      this.storage.fetchAdvert(opts.adId, (err, result) => {
        if (err) return cb(err);

        if (!result) {
          throw new Error('Advertisement does not exist: ' + opts.adId);
        }

        if (result) {
          this.logw('Advert already exists');
          return cb(null, adId);
        }
      });
    };

    try {
      this._runLocked(
        cb,
        cb => {
          checkIfAdvertExistsAlready(opts.adId, (err, adId) => {
            if (err) throw err;
            this.storage.removeAdvert(adId, cb); // TODO: add to errordefinitions Errors.ADVERTISEMENT already exists
          });
        },
        10 * 1000
      );
    } catch (err) {
      throw err;
    }
  }

  activateAdvert(opts, cb) {
    opts = opts ? _.clone(opts) : {};
    // Usually do error checking on preconditions
    if (!checkRequired(opts, ['adId'], cb)) {
      throw new Error('adId is missing');
    }

    this.storage.activateAdvert(opts.adId, (err, result) => {
      if (err) return cb(err);
      return cb(null, result);
    });
  }

  deactivateAdvert(opts, cb) {
    opts = opts ? _.clone(opts) : {};
    // Usually do error checking on preconditions
    if (!checkRequired(opts, ['adId'], cb)) {
      throw new Error('adId is missing');
    }

    this.storage.deactivateAdvert(opts.adId, (err, result) => {
      if (err) return cb(err);
      return cb(null, result);
    });
  }

  tagLowFeeTxs(wallet: IWallet, txs: any[], cb) {
    const unconfirmed = txs.filter(tx => tx.confirmations === 0);
    if (_.isEmpty(unconfirmed)) return cb();

    this.getFeeLevels(
      {
        chain: wallet.chain,
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
            _.each(unconfirmed, tx => {
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

    let walletCacheKey = wallet.id;
    if (opts.tokenAddress) {
      wallet.tokenAddress = opts.tokenAddress;
      walletCacheKey = `${wallet.id}-${opts.tokenAddress}`;
    }

    if (opts.multisigContractAddress) {
      wallet.multisigContractAddress = opts.multisigContractAddress;
      walletCacheKey = `${wallet.id}-${opts.multisigContractAddress}`;
    }

    async.series(
      [
        next => {
          // be sure the wallet is onsync
          this.syncWallet(wallet, next, true);
        },
        next => {
          this._getBlockchainHeight(wallet.chain, wallet.network, (err, height, hash) => {
            if (err) return next(err);
            bcHeight = height;
            bcHash = hash;
            streamKey = (this.userAgent || '') + '-' + limit + '-' + bcHash;
            return next();
          });
        },
        next => {
          this.storage.getTxHistoryCacheStatusV8(walletCacheKey, (err, inCacheStatus) => {
            if (err) return cb(err);
            cacheStatus = inCacheStatus;
            return next();
          });
        },
        next => {
          if (skip == 0 || !streamKey) return next();

          logger.debug('Checking streamKey/skip %o', { streamKey, skip });
          this.storage.getTxHistoryStreamV8(walletCacheKey, (err, result) => {
            if (err) return next(err);
            if (!result) return next();

            if (result.streamKey != streamKey) {
              logger.debug('Deleting old stream cache:' + result.streamKey);
              return this.storage.clearTxHistoryStreamV8(walletCacheKey, next);
            }

            streamData = result.items;
            logger.debug(`Using stream cache: ${streamData.length} txs`);
            return next();
          });
        },
        next => {
          if (streamData) {
            lastTxs = streamData;
            return next();
          }

          const startBlock = cacheStatus.updatedHeight || 0;
          logger.debug(' ########### GET HISTORY v8 startBlock/bcH] %o', { startBlock, bcHeight });

          bc.getTransactions(wallet, startBlock, (err, txs) => {
            if (err) return cb(err);
            const dustThreshold = ChainService.getDustAmountValue(wallet.chain);
            this._normalizeTxHistory(walletCacheKey, txs, dustThreshold, bcHeight, (err, inTxs: any[]) => {
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
                logger.info(`Storing stream cache for ${walletCacheKey}: ${lastTxs.length} txs`);
                return this.storage.storeTxHistoryStreamV8(walletCacheKey, streamKey, lastTxs, next);
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
          this.storage.getTxHistoryCacheV8(walletCacheKey, skip, limit, (err, oldTxs) => {
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
          });
        },
        next => {
          if (streamData) {
            return next();
          }
          // We have now TXs from 'tipHeight` to end in `lastTxs`.
          // Store hard confirmed TXs
          // confirmations here is bcHeight - tip + 1, so OK.
          let CONFIRMATIONS_TO_START_CACHING = Defaults.CONFIRMATIONS_TO_START_CACHING;
          if (Constants.CONFIRMATIONS_TO_START_CACHING[wallet.chain] != null) {
            CONFIRMATIONS_TO_START_CACHING = Constants.CONFIRMATIONS_TO_START_CACHING[wallet.chain];
          }

          txsToCache = _.filter(lastTxs, i => {
            if (i.confirmations < CONFIRMATIONS_TO_START_CACHING) {
              return false;
            }
            if (!cacheStatus.tipHeight) return true;

            return i.blockheight > cacheStatus.tipHeight;
          });

          logger.debug(`Found ${lastTxs.length} new txs. Caching ${txsToCache.length}`);
          if (!txsToCache.length) {
            return next();
          }

          const updateHeight = bcHeight - CONFIRMATIONS_TO_START_CACHING;
          this.storage.storeTxHistoryCacheV8(walletCacheKey, cacheStatus.tipIndex, txsToCache, updateHeight, next);
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
   * @param {String} opts.tokenAddress ERC20 Token Contract Address
   * @param {String} opts.multisigContractAddress MULTISIG ETH Contract Address
   * @param {Number} opts.includeExtendedInfo[=false] - Include all inputs/outputs for every tx.
   * @returns {TxProposal[]} Transaction proposals, first newer
   */
  getTxHistory(opts, cb) {
    let bc;
    opts = opts || {};

    // 50 is accepted by insight.
    // TODO move it to a bigger number with v8 is fully deployed
    opts.limit = _.isUndefined(opts.limit) ? 50 : opts.limit;
    if (opts.limit > Defaults.HISTORY_LIMIT) return cb(Errors.HISTORY_LIMIT_EXCEEDED);

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      if (wallet.scanStatus == 'error') return cb(Errors.WALLET_NEED_SCAN);

      if (wallet.scanStatus == 'running') return cb(Errors.WALLET_BUSY);

      bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
      if (!bc) return cb(new Error('Could not get blockchain explorer instance'));

      const from = opts.skip || 0;
      const to = from + opts.limit;

      async.waterfall(
        [
          next => {
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
                done => {
                  this.storage.fetchTxs(
                    this.walletId,
                    {
                      minTs,
                      maxTs
                    },
                    done
                  );
                },
                done => {
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
          this.tagLowFeeTxs(wallet, finalTxs, err => {
            if (err) this.logw('Failed to tag unconfirmed with low fee');

            if (res.txs.fromCache) {
              let p = '';
              if (res.txs.fromBc) {
                p = 'Partial';
              }
              this.logd(`${p} History from cache ${from}/${to}: ${finalTxs.length} txs`);
            } else {
              this.logd(`History from bc ${from}/${to}: ${finalTxs.length} txs`);
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
        // do not scan single address UTXO wallets.
        if (wallet.singleAddress && ChainService.isUTXOChain(wallet.chain)) return cb();

        this._runLocked(cb, cb => {
          wallet.scanStatus = 'running';
          this.storage.storeWallet(wallet, err => {
            if (err) return cb(err);

            const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
            if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
            opts.bc = bc;

            const scanComplete = error => {
              this.storage.fetchWallet(wallet.id, (err, wallet) => {
                if (err) return cb(err);
                wallet.scanStatus = error ? 'error' : 'success';
                this.storage.storeWallet(wallet, err => {
                  return cb(error || err);
                });
              });
            };

            if (!ChainService.isUTXOChain(wallet.chain)) {
              // non-UTXO chain "scan" is just a resync
              return this.syncWallet(wallet, scanComplete);
            }

            let step = opts.startingStep;
            async.doWhilst(
              next => {
                this._runScan(wallet, step, opts, next);
              },
              () => {
                step = step / 10;
                return step >= 1;
              },
              scanComplete
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
        next => {
          const address = derivator.derive();

          opts.bc.getAddressActivity(address.address, (err, activity) => {
            if (err) return next(err);
            //       console.log('[server.js.3779:address:] SCANING:' + address.address+ ':'+address.path + " :" + !!activity); //TODO

            allAddresses.push(address);
            inactiveCounter = activity ? 0 : inactiveCounter + 1;
            return next();
          });
        },
        err => {
          derivator.rewind(gap);
          return cb(err, _.dropRight(allAddresses, gap));
        }
      );
    };

    const derivators = [];
    _.each([false, true], isChange => {
      derivators.push({
        id: wallet.addressManager.getBaseAddressPath(isChange),
        derive: _.bind(wallet.createAddress, wallet, isChange, step),
        index: _.bind(wallet.addressManager.getCurrentIndex, wallet.addressManager, isChange),
        rewind: _.bind(wallet.addressManager.rewindIndex, wallet.addressManager, isChange, step),
        getSkippedAddress: _.bind(wallet.getSkippedAddress, wallet)
      });
      if (opts.includeCopayerBranches) {
        _.each(wallet.copayers, copayer => {
          if (copayer.addressManager) {
            derivators.push({
              id: copayer.addressManager.getBaseAddressPath(isChange),
              derive: _.bind(copayer.createAddress, copayer, wallet, isChange),
              index: _.bind(copayer.addressManager.getCurrentIndex, copayer.addressManager, isChange),
              rewind: _.bind(copayer.addressManager.rewindIndex, copayer.addressManager, isChange, step)
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
            this.logd('Deriving addresses for scan steps gaps DERIVATOR:' + derivator.id);

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
      cb
    );
  }

  /**
   * Start a scan process.
   *
   * @param {Object} opts
   * @param {Boolean} opts.includeCopayerBranches (defaults to false)
   */
  startScan(opts, cb) {
    const scanFinished = err => {
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

      // do not scan single address UTXO wallets.
      if (wallet.singleAddress && ChainService.isUTXOChain(wallet.chain)) return cb();

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
   * Returns exchange rates of the supported fiat currencies for all coins.
   * @param {Object} opts
   * @param {String} [opts.code] - Currency ISO code (e.g: USD, EUR, ARS).
   * @param {Date} [opts.ts] - A timestamp to base the rate on (default Date.now()).
   * @param {String} [opts.provider] - A provider of exchange rates (default 'BitPay').
   * @returns {Array} rates - The exchange rate.
   */
  getFiatRates(opts, cb) {
    if (_.isNaN(opts.ts) || _.isArray(opts.ts)) return cb(new ClientError('Invalid timestamp'));

    this.fiatRateService.getRates(opts, (err, rates) => {
      if (err) return cb(err);
      return cb(null, rates);
    });
  }

  /**
   * Returns exchange rates of the supported fiat currencies for the specified coin.
   * @param {Object} opts
   * @param {String} opts.coin - The coin requested (btc, bch, eth, xrp, , ltc).
   * @param {String} [opts.code] - Currency ISO code (e.g: USD, EUR, ARS).
   * @param {Date} [opts.ts] - A timestamp to base the rate on (default Date.now()).
   * @param {String} [opts.provider] - A provider of exchange rates (default 'BitPay').
   * @returns {Array} rates - The exchange rate.
   */
  getFiatRatesByCoin(opts, cb) {
    if (!checkRequired(opts, ['coin'], cb)) return;
    if (_.isNaN(opts.ts) || _.isArray(opts.ts)) return cb(new ClientError('Invalid timestamp'));

    this.fiatRateService.getRatesByCoin(opts, (err, rate) => {
      if (err) return cb(err);
      return cb(null, rate);
    });
  }

  /**
   * Returns historical exchange rates for the specified currency & timestamp range.
   * @param {Object} opts
   * @param {string} opts.code - Currency ISO code.
   * @param {Date} opts.ts - The oldest timestamp in the range to Date.now().
   * @param {String} [opts.provider] - A provider of exchange rates (default 'BitPay').
   * @returns {Object} rates - The exchange rate.
   */
  getHistoricalRates(opts, cb) {
    if (!checkRequired(opts, ['code'], cb)) return;

    this.fiatRateService.getHistoricalRates(opts, (err, rates) => {
      if (err) return cb(err);
      return cb(null, rates);
    });
  }

  /**
   * Subscribe this copayer to the Push Notifications service using the specified token.
   * @param {Object} opts
   * @param {string} opts.token - The token representing the app/device.
   * @param {string} [opts.packageName] - The restricted_package_name option associated with this token.
   * @param {string} [opts.platform] - The platform associated with this token.
   * @param {string} [opts.walletId] - The walletId associated with this token.
   */
  pushNotificationsSubscribe(opts, cb) {
    if (!checkRequired(opts, ['token'], cb)) return;
    const sub = PushNotificationSub.create({
      copayerId: this.copayerId,
      token: opts.token,
      packageName: opts.packageName,
      platform: opts.platform,
      walletId: opts.walletId
    });

    this.storage.storePushNotificationSub(sub, cb);
  }

  /**
   * Subscribe this copayer to the Push Notifications service using the specified token.
   * @param {Object} opts
   * @param {string} opts.externalUserId - The token representing the app/device. - Braze
   * @param {string} [opts.packageName] - The restricted_package_name option associated with this token.
   * @param {string} [opts.platform] - The platform associated with this token.
   * @param {string} [opts.walletId] - The walletId associated with this token.
   */
  pushNotificationsBrazeSubscribe(opts, cb) {
    if (!checkRequired(opts, ['externalUserId'], cb)) return;

    const sub = PushNotificationSub.create({
      copayerId: this.copayerId,
      externalUserId: opts.externalUserId,
      packageName: opts.packageName,
      platform: opts.platform,
      walletId: opts.walletId
    });

    this.storage.storePushNotificationBrazeSub(sub, cb);
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
   * Unsubscribe this copayer to the Push Notifications service using the specified token.
   * @param {Object} opts
   * @param {string} opts.externalUserId - The token representing the app/device. // Braze
   */
  pushNotificationsBrazeUnsubscribe(opts, cb) {
    if (!checkRequired(opts, ['externalUserId'], cb)) return;

    this.storage.removePushNotificationBrazeSub(this.copayerId, opts.externalUserId, cb);
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
      txid: opts.txid,
      amount: opts.amount,
      isCreator: true
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

  /**
   * Get External Services configuration based on the users location and their current version of the app
   * @param {Object} opts
   * @param {string} opts.currentAppVersion - (Optional) The version of the app from which the user is connected.
   * @param {string} opts.currentLocationCountry - (Optional) Country where the user is currently located.
   * @param {string} opts.currentLocationState - (Optional) State where the user is currently located.
   * @param {string} opts.bitpayIdLocationCountry - (Optional) Country registered as address of the user logged in with BitpayId.
   * @param {string} opts.bitpayIdLocationState - (Optional) State registered as address of the user logged in with BitpayId.
   * @param {Object} opts.platform - (Optional) Operating system and version of the user's device.
   */
  getServicesData(opts, cb) {
    let externalServicesConfig: ExternalServicesConfig = _.cloneDeep(config.services);

    const isLoggedIn = !!opts?.bitpayIdLocationCountry;

    // Swap crypto rules
    const swapUsaBannedStates = ['HI', 'LA', 'NY'];

    if (
      // Logged in with bitpayId
      (['US', 'USA'].includes(opts?.bitpayIdLocationCountry?.toUpperCase()) && swapUsaBannedStates.includes(opts?.bitpayIdLocationState?.toUpperCase())) ||
      // Logged out (IP restriction)
      (!isLoggedIn && ['US', 'USA'].includes(opts?.currentLocationCountry?.toUpperCase()) && swapUsaBannedStates.includes(opts?.currentLocationState?.toUpperCase()))
    ) {
      externalServicesConfig.swapCrypto = {...externalServicesConfig.swapCrypto, ...{ disabled: true, disabledMessage: 'Swaps are currently unavailable in your area.'}};
    }

    if (opts?.platform?.os === 'ios' && opts?.currentAppVersion === '14.11.5') {
      externalServicesConfig.swapCrypto = {...externalServicesConfig.swapCrypto, ...{ disabled: true, disabledTitle: 'Unavailable', disabledMessage: 'Swaps are currently unavailable in your area.'}};
    }

    // Buy crypto rules
    const buyCryptoUsaBannedStates = ['NY'];
    if (
      // Logged in with bitpayId
      (['US', 'USA'].includes(opts?.bitpayIdLocationCountry?.toUpperCase()) && buyCryptoUsaBannedStates.includes(opts?.bitpayIdLocationState?.toUpperCase())) ||
      // Logged out (IP restriction)
      (!isLoggedIn && ['US', 'USA'].includes(opts?.currentLocationCountry?.toUpperCase()) && buyCryptoUsaBannedStates.includes(opts?.currentLocationState?.toUpperCase()))
    ) {
      externalServicesConfig.buyCrypto = {...externalServicesConfig.buyCrypto, ...{ disabled: true, disabledTitle: 'Unavailable', disabledMessage: 'This service is currently unavailable in your area.'}};
    }

    return cb(null, externalServicesConfig);
  }

  private banxaGetKeys(req) {
    if (!config.banxa) throw new Error('Banxa missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }

    delete req.body.env;
    delete req.body.context;

    const keys: {
      API: string;
      API_KEY: string;
      SECRET_KEY: string;
    } = {
      API: config.banxa[env].api,
      API_KEY: config.banxa[env].apiKey,
      SECRET_KEY: config.banxa[env].secretKey
    };

    return keys;
  }

  private getBanxaSignature(method: 'get' | 'post', endpoint: string, apiKey: string, secret: string, body?: string) {
    let signature, auth: string
    const nonce = Date.now().toString();

    switch (method) {
      case 'get':
        signature = 'GET' + '\n' + `/api${endpoint}` + '\n' + nonce;
        break;
      case 'post':
        const stringifiedBody = body ? JSON.stringify(_.cloneDeep(body)) : '';
        signature = 'POST' + '\n' + `/api${endpoint}` + '\n' + nonce + '\n' + stringifiedBody;
        break;
      default:
        signature = undefined;
        break;
    }

    const localSignature = crypto.createHmac('sha256', secret).update(signature).digest('hex');
    auth = `${apiKey}:${localSignature}:${nonce}`
    return auth;
  }

  banxaGetPaymentMethods(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      let qs = [];
      if (req.body.source) qs.push('source=' + req.body.source);
      if (req.body.target) qs.push('target=' + req.body.target);

      const UriPath = `/payment-methods${qs.length > 0 ? '?' + qs.join('&') : ''}`;
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('get', UriPath, API_KEY, SECRET_KEY);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
      };

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  banxaGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['source', 'target'])) {
        return reject(new ClientError("Banxa's request missing arguments"));
      }

      let qs = [];
      qs.push('source=' + req.body.source);
      qs.push('target=' + req.body.target);

      if (req.body.source_amount) qs.push('source_amount=' + req.body.source_amount);
      if (req.body.target_amount) qs.push('target_amount=' + req.body.target_amount);
      if (req.body.payment_method_id) qs.push('payment_method_id=' + req.body.payment_method_id);
      if (req.body.account_reference) qs.push('account_reference=' + req.body.account_reference);
      if (req.body.blockchain) qs.push('blockchain=' + req.body.blockchain);
      
      const UriPath = `/prices${qs.length > 0 ? '?' + qs.join('&') : ''}`;
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('get', UriPath, API_KEY, SECRET_KEY);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
      };

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  banxaCreateOrder(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['account_reference', 'source', 'target', 'wallet_address', 'return_url_on_success'])) {
        return reject(new ClientError("Banxa's request missing arguments"));
      }

      delete req.body.payment_method_id;
      
      const UriPath = '/orders';
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('post', UriPath, API_KEY, SECRET_KEY, req.body);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
      };

      this.request.post(
        URL,
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  banxaGetOrder(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['order_id'])) {
        return reject(new ClientError("Banxa's request missing arguments"));
      }

      let qs = [];
      if (req.body.fx_currency) qs.push('fx_currency=' + req.body.fx_currency);

      const UriPath = `/orders/${req.body.order_id}${qs.length > 0 ? '?' + qs.join('&') : ''}`;
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('get', UriPath, API_KEY, SECRET_KEY);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
      };

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  private moonpayGetKeys(req) {
    if (!config.moonpay) throw new Error('Moonpay missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }

    delete req.body.env;
    delete req.body.context;

    const keys: {
      API: string;
      WIDGET_API: string;
      API_KEY: string;
      SECRET_KEY: string;
    } = {
      API: config.moonpay[env].api,
      WIDGET_API: config.moonpay[env].widgetApi,
      API_KEY: config.moonpay[env].apiKey,
      SECRET_KEY: config.moonpay[env].secretKey
    };

    return keys;
  }

  moonpayGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.moonpayGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['currencyAbbreviation', 'baseCurrencyAmount', 'baseCurrencyCode'])) {
        return reject(new ClientError("Moonpay's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      let qs = [];
      qs.push('apiKey=' + API_KEY);
      qs.push('baseCurrencyAmount=' + req.body.baseCurrencyAmount);
      qs.push('baseCurrencyCode=' + req.body.baseCurrencyCode);

      if (req.body.extraFeePercentage) qs.push('extraFeePercentage=' + req.body.extraFeePercentage);
      if (req.body.paymentMethod) qs.push('paymentMethod=' + req.body.paymentMethod);
      if (req.body.areFeesIncluded) qs.push('areFeesIncluded=' + req.body.areFeesIncluded);

      const URL: string = API + `/v3/currencies/${req.body.currencyAbbreviation}/buy_quote/?${qs.join('&')}`;

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  moonpayGetCurrencyLimits(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.moonpayGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['currencyAbbreviation', 'baseCurrencyCode'])) {
        return reject(new ClientError("Moonpay's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      let qs = [];
      qs.push('apiKey=' + API_KEY);
      qs.push('baseCurrencyCode=' + encodeURIComponent(req.body.baseCurrencyCode));
      if (req.body.areFeesIncluded) qs.push('areFeesIncluded=' + encodeURIComponent(req.body.areFeesIncluded));
      if (req.body.paymentMethod) qs.push('paymentMethod=' + encodeURIComponent(req.body.paymentMethod));

      const URL = API + `/v3/currencies/${req.body.currencyAbbreviation}/limits/?${qs.join('&')}`

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  moonpayGetSignedPaymentUrl(req): { urlWithSignature: string } {
    const keys = this.moonpayGetKeys(req);
    const SECRET_KEY = keys.SECRET_KEY;
    const API_KEY = keys.API_KEY;
    const WIDGET_API = keys.WIDGET_API;

    if (
      !checkRequired(req.body, [
        'currencyCode',
        'walletAddress',
        'baseCurrencyCode',
        'baseCurrencyAmount',
        'externalTransactionId',
        'redirectURL'
      ])
    ) {
      throw new ClientError("Moonpay's request missing arguments");
    }

    const headers = {
      'Content-Type': 'application/json'
    };

    let qs = [];
    qs.push('apiKey=' + API_KEY);
    qs.push('currencyCode=' + encodeURIComponent(req.body.currencyCode));
    qs.push('walletAddress=' + encodeURIComponent(req.body.walletAddress));
    qs.push('baseCurrencyCode=' + encodeURIComponent(req.body.baseCurrencyCode));
    qs.push('baseCurrencyAmount=' + encodeURIComponent(req.body.baseCurrencyAmount));
    qs.push('externalTransactionId=' + encodeURIComponent(req.body.externalTransactionId));
    qs.push('redirectURL=' + encodeURIComponent(req.body.redirectURL));
    if (req.body.lockAmount) qs.push('lockAmount=' + encodeURIComponent(req.body.lockAmount));
    if (req.body.showWalletAddressForm)
      qs.push('showWalletAddressForm=' + encodeURIComponent(req.body.showWalletAddressForm));
    if (req.body.paymentMethod) qs.push('paymentMethod=' + encodeURIComponent(req.body.paymentMethod));

    const URL_SEARCH: string = `?${qs.join('&')}`;

    const URLSignatureHash: string = Bitcore.crypto.Hash.sha256hmac(
      Buffer.from(URL_SEARCH),
      Buffer.from(SECRET_KEY)
    ).toString('base64');

    const urlWithSignature = `${WIDGET_API}${URL_SEARCH}&signature=${encodeURIComponent(URLSignatureHash)}`;

    return { urlWithSignature };
  }

  moonpayGetTransactionDetails(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.moonpayGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['transactionId']) && !checkRequired(req.body, ['externalId'])) {
        return reject(new ClientError("Moonpay's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };
      let URL: string;

      let qs = [];
      qs.push('apiKey=' + API_KEY);
      if (req.body.transactionId) {
        URL = API + `/v1/transactions/${req.body.transactionId}?${qs.join('&')}`;
      } else if (req.body.externalId) {
        URL = API + `/v1/transactions/ext/${req.body.externalId}?${qs.join('&')}`;
      }

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  moonpayGetAccountDetails(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.moonpayGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Content-Type': 'application/json'
      };

      let qs = [];
      qs.push('apiKey=' + API_KEY);

      const URL = API + `/v3/accounts/me?${qs.join('&')}`;

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  private rampGetKeys(req) {
    if (!config.ramp) throw new Error('Ramp missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }
    delete req.body.env;
    delete req.body.context;

    const keys: {
      API: string;
      WIDGET_API: string;
      API_KEY: string;
    } = {
      API: config.ramp[env].api,
      WIDGET_API: config.ramp[env].widgetApi,
      API_KEY: config.ramp[env].apiKey,
    };

    return keys;
  }

  rampGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.rampGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['cryptoAssetSymbol', 'fiatValue', 'fiatCurrency'])) {
        return reject(new ClientError("Ramp's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      const URL: string = API + `/host-api/v3/onramp/quote/all?hostApiKey=${API_KEY}`;

      this.request.post(
        URL,
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  rampGetSignedPaymentUrl(req): { urlWithSignature: string } {
    const webRequiredParams = [
      'swapAsset',
      'userAddress',
      'selectedCountryCode',
      'finalUrl',
    ];
    const appRequiredParams = [
      'swapAsset',
      'swapAmount',
      'enabledFlows',
      'defaultFlow',
      'userAddress',
      'selectedCountryCode',
      'defaultAsset',
      'finalUrl',
    ];

    const requiredParams = req.body.context === 'web' ? webRequiredParams : appRequiredParams;
    const keys = this.rampGetKeys(req);
    const API_KEY = keys.API_KEY;
    const WIDGET_API = keys.WIDGET_API;

    if (
      !checkRequired(req.body, requiredParams)
    ) {
      throw new ClientError("Ramp's request missing arguments");
    }

    const headers = {
      'Content-Type': 'application/json'
    };

    let qs = [];
    qs.push('hostApiKey=' + API_KEY);
    qs.push('swapAsset=' + encodeURIComponent(req.body.swapAsset));
    qs.push('userAddress=' + encodeURIComponent(req.body.userAddress));
    qs.push('selectedCountryCode=' + encodeURIComponent(req.body.selectedCountryCode));
    qs.push('finalUrl=' + encodeURIComponent(req.body.finalUrl));
    if (req.body.enabledFlows) qs.push('enabledFlows=' + encodeURIComponent(req.body.enabledFlows));
    if (req.body.defaultFlow) qs.push('defaultFlow=' + encodeURIComponent(req.body.defaultFlow));
    if (req.body.hostLogoUrl) qs.push('hostLogoUrl=' + encodeURIComponent(req.body.hostLogoUrl));
    if (req.body.hostAppName) qs.push('hostAppName=' + encodeURIComponent(req.body.hostAppName));
    if (req.body.swapAmount) qs.push('swapAmount=' + encodeURIComponent(req.body.swapAmount));
    if (req.body.fiatValue) qs.push('fiatValue=' + encodeURIComponent(req.body.fiatValue));
    if (req.body.fiatCurrency) qs.push('fiatCurrency=' + encodeURIComponent(req.body.fiatCurrency));
    if (req.body.defaultAsset) qs.push('defaultAsset=' + encodeURIComponent(req.body.defaultAsset));
    if (req.body.userEmailAddress) qs.push('userEmailAddress=' + encodeURIComponent(req.body.userEmailAddress));

    const URL_SEARCH: string = `?${qs.join('&')}`;

    const urlWithSignature = `${WIDGET_API}${URL_SEARCH}`;

    return { urlWithSignature };
  }

  rampGetAssets(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.rampGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Content-Type': 'application/json'
      };
      let URL: string;

      let qs = [];
      qs.push('hostApiKey=' + API_KEY);
    if (req.body.currencyCode) qs.push('currencyCode=' + encodeURIComponent(req.body.currencyCode));
    if (req.body.withDisabled) qs.push('withDisabled=' + encodeURIComponent(req.body.withDisabled));
    if (req.body.withHidden) qs.push('withHidden=' + encodeURIComponent(req.body.withHidden));
    if (req.body.useIp) {
      const ip = Utils.getIpFromReq(req);
      qs.push('userIp=' + encodeURIComponent(ip));
    }

      URL = API + `/host-api/v3/assets?${qs.join('&')}`;

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  private sardineGetKeys(req) {
    if (!config.sardine) throw new Error('Sardine missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }
    delete req.body.env;
    delete req.body.context;

    const keys: {
      API: string;
      SECRET_KEY: string;
      CLIENT_ID: string;
    } = {
      API: config.sardine[env].api,
      SECRET_KEY: config.sardine[env].secretKey,
      CLIENT_ID: config.sardine[env].clientId,
    };

    return keys;
  }

  sardineGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['asset_type', 'network', 'total'])) {
        return reject(new ClientError("Sardine's request missing arguments"));
      }

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        Accept: 'application/json',
        Authorization: `Basic ${secretBase64}`,
      };

      let qs = [];
      qs.push('asset_type=' + req.body.asset_type);
      qs.push('network=' + req.body.network);
      qs.push('total=' + req.body.total);

      if (req.body.currency) qs.push('currency=' + req.body.currency);
      if (req.body.paymentType) qs.push('paymentType=' + req.body.paymentType);
      if (req.body.quote_type) qs.push('quote_type=' + req.body.quote_type);

      const URL: string = API + `/v1/quotes?${qs.join('&')}`;

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  sardineGetCurrencyLimits(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        Accept: 'application/json',
        Authorization: `Basic ${secretBase64}`,
      };

      const URL: string = API + '/v1/fiat-currencies';

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  sardineGetToken(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['referenceId', 'externalUserId', 'customerId'])) {
        return reject(new ClientError("Sardine's request missing arguments"));
      }

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${secretBase64}`,
      };

      const URL: string = API + '/v1/auth/client-tokens';

      this.request.post(
        URL,
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  sardineGetOrdersDetails(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['orderId']) && !checkRequired(req.body, ['externalUserId']) && !checkRequired(req.body, ['referenceId'])) {
        return reject(new ClientError("Sardine's request missing arguments"));
      }

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        Accept: 'application/json',
        Authorization: `Basic ${secretBase64}`,
      };

      let qs = [];
      let URL: string;

      if (req.body.orderId) {
        URL = API + `/v1/orders/${req.body.orderId}`;
      } else if (req.body.externalUserId || req.body.referenceId) {
        if (req.body.externalUserId) qs.push('externalUserId=' + req.body.externalUserId);
        if (req.body.referenceId) qs.push('referenceId=' + req.body.referenceId);
        if (req.body.startDate) qs.push('startDate=' + req.body.startDate);
        if (req.body.endDate) qs.push('endDate=' + req.body.endDate);
        if (req.body.limit) qs.push('limit=' + req.body.limit);

        URL = API + `/v1/orders?${qs.join('&')}`;
      }

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  private simplexGetKeys(req) {
    if (!config.simplex) throw new Error('Simplex missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }

    delete req.body.env;
    delete req.body.context;

    const keys = {
      API: config.simplex[env].api,
      API_KEY: config.simplex[env].apiKey,
      APP_PROVIDER_ID: config.simplex[env].appProviderId
    };

    return keys;
  }

  simplexGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.simplexGetKeys(req);

      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const ip = Utils.getIpFromReq(req);

      req.body.client_ip = ip;
      req.body.wallet_id = keys.APP_PROVIDER_ID;

      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey ' + API_KEY
      };

      this.request.post(
        API + '/wallet/merchant/v2/quote',
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : null);
          }
        }
      );
    });
  }

  simplexPaymentRequest(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.simplexGetKeys(req);

      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const appProviderId = keys.APP_PROVIDER_ID;
      const paymentId = Uuid.v4();
      const orderId = Uuid.v4();
      const apiHost = keys.API;
      const ip = Utils.getIpFromReq(req);

      if (
        !checkRequired(req.body, ['account_details', 'transaction_details']) &&
        !checkRequired(req.body.transaction_details, ['payment_details'])
      ) {
        return reject(new ClientError("Simplex's request missing arguments"));
      }

      req.body.account_details.app_provider_id = appProviderId;
      req.body.account_details.signup_login = {
        ip,
        location: '',
        uaid: '',
        accept_language: 'de,en-US;q=0.7,en;q=0.3',
        http_accept_language: 'de,en-US;q=0.7,en;q=0.3',
        user_agent: req.body.account_details.signup_login ? req.body.account_details.signup_login.user_agent : '', // Format: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:67.0) Gecko/20100101 Firefox/67.0'
        cookie_session_id: '',
        timestamp: req.body.account_details.signup_login ? req.body.account_details.signup_login.timestamp : ''
      };

      req.body.transaction_details.payment_details.payment_id = paymentId;
      req.body.transaction_details.payment_details.order_id = orderId;

      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey ' + API_KEY
      };

      this.request.post(
        API + '/wallet/merchant/v2/payments/partner/data',
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            data.body.payment_id = paymentId;
            data.body.order_id = orderId;
            data.body.app_provider_id = appProviderId;
            data.body.api_host = apiHost;
            return resolve(data.body);
          }
        }
      );
    });
  }

  simplexGetEvents(req): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!config.simplex) return reject(new Error('Simplex missing credentials'));
      if (!req.env || (req.env != 'sandbox' && req.env != 'production'))
        return reject(new Error("Simplex's request wrong environment"));

      const API = config.simplex[req.env].api;
      const API_KEY = config.simplex[req.env].apiKey;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey ' + API_KEY
      };

      this.request.get(
        API + '/wallet/merchant/v2/events',
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : null);
          } else {
            return resolve(data.body ? data.body : null);
          }
        }
      );
    });
  }

  private wyreGetKeys(req) {
    if (!config.wyre) throw new Error('Wyre missing credentials');

    let env = 'sandbox';
    if (req.body.env && req.body.env == 'production') {
      env = 'production';
    }
    delete req.body.env;

    const keys = {
      API: config.wyre[env].api,
      API_KEY: config.wyre[env].apiKey,
      SECRET_API_KEY: config.wyre[env].secretApiKey,
      ACCOUNT_ID: config.wyre[env].appProviderAccountId
    };

    return keys;
  }

  private transakGetKeys(req) {
    if (!config.transak) throw new Error('Transak missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }

    delete req.body.env;
    delete req.body.context;

    const keys: {
      API: string;
      API_KEY: string;
      SECRET_KEY: string;
      WIDGET_API: string;
    } = {
      API: config.transak[env].api,
      API_KEY: config.transak[env].apiKey,
      SECRET_KEY: config.transak[env].secretKey,
      WIDGET_API: config.transak[env].widgetApi
    };

    return keys;
  }

  transakGetAccessToken(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.transakGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      const headers = {
        'Content-Type': 'application/json',
        'api-secret': SECRET_KEY,
      };

      req.body = {
        apiKey: API_KEY
      }

      const URL: string = API + '/partners/api/v2/refresh-token';

      this.request.post(
        URL,
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  transakGetCryptoCurrencies(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.transakGetKeys(req);
      const API = keys.API;

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      const URL: string = API + '/api/v2/currencies/crypto-currencies';

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  transakGetFiatCurrencies(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.transakGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      const URL: string = API + `/api/v2/currencies/fiat-currencies?apiKey=${API_KEY}`;

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  transakGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.transakGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['fiatCurrency', 'cryptoCurrency', 'network', 'paymentMethod'])) {
        return reject(new ClientError("Transak's request missing arguments"));
      }

      const headers = {
        Accept: 'application/json',
      };

      let qs = [];
      qs.push('partnerApiKey=' + API_KEY);
      qs.push('fiatCurrency=' + req.body.fiatCurrency);
      qs.push('cryptoCurrency=' + req.body.cryptoCurrency);
      qs.push('isBuyOrSell=BUY');
      qs.push('network=' + req.body.network);
      qs.push('paymentMethod=' + req.body.paymentMethod);

      if (req.body.fiatAmount) qs.push('fiatAmount=' + req.body.fiatAmount);
      if (req.body.cryptoAmount) qs.push('cryptoAmount=' + req.body.cryptoAmount);

      const URL: string = API + `/api/v2/currencies/price?${qs.join('&')}`;

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  transakGetSignedPaymentUrl(req): { urlWithSignature: string } {
    const appRequiredParams = [
      'walletAddress',
      'redirectURL',
      'fiatAmount',
      'fiatCurrency',
      'network',
      'cryptoCurrencyCode',
      'partnerOrderId',
      'partnerCustomerId',
    ];

    const requiredParams = req.body.context === 'web' ? [] : appRequiredParams;
    const keys = this.transakGetKeys(req);
    const API_KEY = keys.API_KEY;
    const WIDGET_API = keys.WIDGET_API;

    if (
      !checkRequired(req.body, requiredParams)
    ) {
      throw new ClientError("Transak's request missing arguments");
    }

    const headers = {
      'Content-Type': 'application/json'
    };

    let qs = [];
    // Recommended parameters to customize from the app
    if (req.body.walletAddress) qs.push('walletAddress=' + encodeURIComponent(req.body.walletAddress));
    if (req.body.disableWalletAddressForm) qs.push('disableWalletAddressForm=' + encodeURIComponent(req.body.disableWalletAddressForm));
    if (req.body.redirectURL) qs.push('redirectURL=' + encodeURIComponent(req.body.redirectURL));
    if (req.body.exchangeScreenTitle) qs.push('exchangeScreenTitle=' + encodeURIComponent(req.body.exchangeScreenTitle));
    if (req.body.fiatAmount) qs.push('fiatAmount=' + encodeURIComponent(req.body.fiatAmount));
    if (req.body.fiatCurrency) qs.push('fiatCurrency=' + encodeURIComponent(req.body.fiatCurrency));
    if (req.body.network) qs.push('network=' + encodeURIComponent(req.body.network));
    if (req.body.paymentMethod) qs.push('paymentMethod=' + encodeURIComponent(req.body.paymentMethod));
    if (req.body.cryptoCurrencyCode) qs.push('cryptoCurrencyCode=' + encodeURIComponent(req.body.cryptoCurrencyCode));
    if (req.body.cryptoCurrencyList) qs.push('cryptoCurrencyList=' + encodeURIComponent(req.body.cryptoCurrencyList));
    if (req.body.hideExchangeScreen) qs.push('hideExchangeScreen=' + encodeURIComponent(req.body.hideExchangeScreen));
    if (req.body.themeColor) qs.push('themeColor=' + encodeURIComponent(req.body.themeColor));
    if (req.body.hideMenu) qs.push('hideMenu=' + encodeURIComponent(req.body.hideMenu));
    if (req.body.partnerOrderId) qs.push('partnerOrderId=' + encodeURIComponent(req.body.partnerOrderId));
    if (req.body.partnerCustomerId) qs.push('partnerCustomerId=' + encodeURIComponent(req.body.partnerCustomerId));
    // Other parameters
    if (req.body.environment) qs.push('environment=' + encodeURIComponent(req.body.environment));
    if (req.body.widgetHeight) qs.push('widgetHeight=' + encodeURIComponent(req.body.widgetHeight));
    if (req.body.widgetWidth) qs.push('widgetWidth=' + encodeURIComponent(req.body.widgetWidth));
    if (req.body.productsAvailed) qs.push('productsAvailed=' + encodeURIComponent(req.body.productsAvailed));
    if (req.body.defaultFiatAmount) qs.push('defaultFiatAmount=' + encodeURIComponent(req.body.defaultFiatAmount));
    if (req.body.countryCode) qs.push('countryCode=' + encodeURIComponent(req.body.countryCode));
    if (req.body.excludeFiatCurrencies) qs.push('excludeFiatCurrencies=' + encodeURIComponent(req.body.excludeFiatCurrencies));
    if (req.body.defaultNetwork) qs.push('defaultNetwork=' + encodeURIComponent(req.body.defaultNetwork));
    if (req.body.networks) qs.push('networks=' + encodeURIComponent(req.body.networks));
    if (req.body.defaultPaymentMethod) qs.push('defaultPaymentMethod=' + encodeURIComponent(req.body.defaultPaymentMethod));
    if (req.body.disablePaymentMethods) qs.push('disablePaymentMethods=' + encodeURIComponent(req.body.disablePaymentMethods));
    if (req.body.defaultCryptoAmount) qs.push('defaultCryptoAmount=' + encodeURIComponent(req.body.defaultCryptoAmount));
    if (req.body.cryptoAmount) qs.push('cryptoAmount=' + encodeURIComponent(req.body.cryptoAmount));
    if (req.body.defaultCryptoCurrency) qs.push('defaultCryptoCurrency=' + encodeURIComponent(req.body.defaultCryptoCurrency));
    if (req.body.isFeeCalculationHidden) qs.push('isFeeCalculationHidden=' + encodeURIComponent(req.body.isFeeCalculationHidden));
    if (req.body.walletAddressesData) qs.push('walletAddressesData=' + encodeURIComponent(req.body.walletAddressesData));
    if (req.body.email) qs.push('email=' + encodeURIComponent(req.body.email));
    if (req.body.userData) qs.push('userData=' + encodeURIComponent(req.body.userData));
    if (req.body.isAutoFillUserData) qs.push('isAutoFillUserData=' + encodeURIComponent(req.body.isAutoFillUserData));

    const URL_SEARCH: string = `?apiKey=${API_KEY}&${qs.join('&')}`;

    const urlWithSignature = `${WIDGET_API}${URL_SEARCH}`;

    return { urlWithSignature };
  }

  transakGetOrderDetails(req): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const env = _.cloneDeep(req.body.env);
      const keys = this.transakGetKeys(req);
      const API = keys.API;

      if (!checkRequired(req.body, ['orderId'])) {
        return reject(new ClientError("Transak's request missing arguments"));
      }

      let accessToken;
      if (req.body.accessToken) {
        accessToken = req.body.accessToken;
      } else {
        try {
          const accessTokenData = await this.transakGetAccessToken({body: env});
          accessToken = accessTokenData?.data?.accessToken;
        } catch (err) {
          return reject(err?.body ? err.body : err);
        }
      }

      const headers = {
        Accept: 'application/json',
        'access-token': accessToken,
      };

      const URL: string = API + `/partners/api/v2/order/${req.body.orderId}`;

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }


  wyreWalletOrderQuotation(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.wyreGetKeys(req);
      req.body.accountId = keys.ACCOUNT_ID;

      if (req.body.amountIncludeFees) {
        if (
          !checkRequired(req.body, ['sourceAmount', 'sourceCurrency', 'destCurrency', 'dest', 'country', 'walletType'])
        ) {
          return reject(new ClientError("Wyre's request missing arguments"));
        }
      } else {
        if (!checkRequired(req.body, ['amount', 'sourceCurrency', 'destCurrency', 'dest', 'country'])) {
          return reject(new ClientError("Wyre's request missing arguments"));
        }
      }

      const URL: string = `${keys.API}/v3/orders/quote/partner?timestamp=${Date.now().toString()}`;
      const XApiSignature: string = URL + JSON.stringify(req.body);
      const XApiSignatureHash: string = Bitcore.crypto.Hash.sha256hmac(
        Buffer.from(XApiSignature),
        Buffer.from(keys.SECRET_API_KEY)
      ).toString('hex');

      const headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': keys.API_KEY,
        'X-Api-Signature': XApiSignatureHash
      };

      this.request.post(
        URL,
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  wyreWalletOrderReservation(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.wyreGetKeys(req);
      req.body.referrerAccountId = keys.ACCOUNT_ID;

      if (req.body.amountIncludeFees) {
        if (
          !checkRequired(req.body, [
            'sourceAmount',
            'sourceCurrency',
            'destCurrency',
            'dest',
            'country',
            'paymentMethod'
          ])
        ) {
          return reject(new ClientError("Wyre's request missing arguments"));
        }
      } else {
        if (!checkRequired(req.body, ['amount', 'sourceCurrency', 'destCurrency', 'dest', 'paymentMethod'])) {
          return reject(new ClientError("Wyre's request missing arguments"));
        }
      }

      const URL: string = `${keys.API}/v3/orders/reserve?timestamp=${Date.now().toString()}`;
      const XApiSignature: string = URL + JSON.stringify(req.body);
      const XApiSignatureHash: string = Bitcore.crypto.Hash.sha256hmac(
        Buffer.from(XApiSignature),
        Buffer.from(keys.SECRET_API_KEY)
      ).toString('hex');

      const headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': keys.API_KEY,
        'X-Api-Signature': XApiSignatureHash
      };

      this.request.post(
        URL,
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  private changellyGetKeys(req) {
    if (!config.changelly) {
      logger.warn('Changelly missing credentials');
      throw new Error('ClientError: Service not configured.');
      if (!config.changelly.v1) {
        logger.warn('Changelly v1 missing credentials');
        throw new Error('ClientError: Service v1 not configured.');
      }
    }

    const keys = {
      API: config.changelly.v1.api,
      API_KEY: config.changelly.v1.apiKey,
      SECRET: config.changelly.v1.secret
    };

    return keys;
  }

  private changellyGetKeysV2(req) {
    if (!config.changelly) {
      logger.warn('Changelly missing credentials');
      throw new Error('ClientError: Service not configured.');
      if (!config.changelly.v2) {
        logger.warn('Changelly v2 missing credentials');
        throw new Error('ClientError: Service v2 not configured.');
      }
    }

    const keys = {
      API: config.changelly.v2.api,
      SECRET: config.changelly.v2.secret
    };

    return keys;
  }

  changellySignRequests(message, secret: string) {
    if (!message || !secret) throw new Error('Missing parameters to sign Changelly v1 request');

    const sign: string = Bitcore.crypto.Hash.sha512hmac(
      Buffer.from(JSON.stringify(message)),
      Buffer.from(secret)
    ).toString('hex');

    return sign;
  }


  changellySignRequestsV2(message, secret: string) {
    if (!message || !secret) throw new Error('Missing parameters to sign Changelly v2 request');

    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(secret, 'hex'),
      format: 'der',
      type: 'pkcs8',
    });

    const publicKey = crypto.createPublicKey(privateKey).export({
        type: 'pkcs1',
        format: 'der'
    });

    const signature = crypto.sign('sha256', Buffer.from(JSON.stringify(message)), privateKey);

    return {signature, publicKey};
  }

  changellyGetCurrencies(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys, headers;
      if (req.body.useV2) {
        keys = this.changellyGetKeysV2(req);
      } else {
        keys = this.changellyGetKeys(req);
      }

      if (!checkRequired(req.body, ['id'])) {
        return reject(new ClientError('changellyGetCurrencies request missing arguments'));
      }

      const message = {
        jsonrpc: '2.0',
        id: req.body.id,
        method: req.body.full ? 'getCurrenciesFull' : 'getCurrencies',
        params: {}
      };

      const URL: string = keys.API;

      if (req.body.useV2) {
        const {signature, publicKey} = this.changellySignRequestsV2(message, keys.SECRET);
        headers = {
          'Content-Type': 'application/json',
          'X-Api-Key': crypto.createHash('sha256').update(publicKey).digest('base64'),
          'X-Api-Signature': signature.toString('base64'),
        };
      } else {
        const sign: string = this.changellySignRequests(message, keys.SECRET);
        headers = {
          'Content-Type': 'application/json',
          sign,
          'api-key': keys.API_KEY
        };
      }

      this.request.post(
        URL,
        {
          headers,
          body: message,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  changellyGetPairsParams(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys, headers;
      if (req.body.useV2) {
        keys = this.changellyGetKeysV2(req);
      } else {
        keys = this.changellyGetKeys(req);
      }

      if (!checkRequired(req.body, ['id', 'coinFrom', 'coinTo'])) {
        return reject(new ClientError('changellyGetPairsParams request missing arguments'));
      }

      const message = {
        id: req.body.id,
        jsonrpc: '2.0',
        method: 'getPairsParams',
        params: [
          {
            from: req.body.coinFrom,
            to: req.body.coinTo
          }
        ]
      };

      const URL: string = keys.API;
      if (req.body.useV2) {
        const {signature, publicKey} = this.changellySignRequestsV2(message, keys.SECRET);
        headers = {
          'Content-Type': 'application/json',
          'X-Api-Key': crypto.createHash('sha256').update(publicKey).digest('base64'),
          'X-Api-Signature': signature.toString('base64'),
        };
      } else {
        const sign: string = this.changellySignRequests(message, keys.SECRET);
        headers = {
          'Content-Type': 'application/json',
          sign,
          'api-key': keys.API_KEY
        };
      }

      this.request.post(
        URL,
        {
          headers,
          body: message,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  changellyGetFixRateForAmount(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys, headers;
      if (req.body.useV2) {
        keys = this.changellyGetKeysV2(req);
      } else {
        keys = this.changellyGetKeys(req);
      }

      if (!checkRequired(req.body, ['id', 'coinFrom', 'coinTo', 'amountFrom'])) {
        return reject(new ClientError('changellyGetFixRateForAmount request missing arguments'));
      }

      const message = {
        id: req.body.id,
        jsonrpc: '2.0',
        method: 'getFixRateForAmount',
        params: [
          {
            from: req.body.coinFrom,
            to: req.body.coinTo,
            amountFrom: req.body.amountFrom
          }
        ]
      };

      const URL: string = keys.API;

      if (req.body.useV2) {
        const {signature, publicKey} = this.changellySignRequestsV2(message, keys.SECRET);
        headers = {
          'Content-Type': 'application/json',
          'X-Api-Key': crypto.createHash('sha256').update(publicKey).digest('base64'),
          'X-Api-Signature': signature.toString('base64'),
        };
      } else {
        const sign: string = this.changellySignRequests(message, keys.SECRET);
        headers = {
          'Content-Type': 'application/json',
          sign,
          'api-key': keys.API_KEY
        };
      }

      this.request.post(
        URL,
        {
          headers,
          body: message,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  changellyCreateFixTransaction(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys, headers;
      if (req.body.useV2) {
        keys = this.changellyGetKeysV2(req);
      } else {
        keys = this.changellyGetKeys(req);
      }

      if (
        !checkRequired(req.body, [
          'id',
          'coinFrom',
          'coinTo',
          'amountFrom',
          'addressTo',
          'fixedRateId',
          'refundAddress'
        ])
      ) {
        return reject(new ClientError('changellyCreateFixTransaction request missing arguments'));
      }

      const message = {
        id: req.body.id,
        jsonrpc: '2.0',
        method: 'createFixTransaction',
        params: {
          from: req.body.coinFrom,
          to: req.body.coinTo,
          address: req.body.addressTo,
          amountFrom: req.body.amountFrom,
          rateId: req.body.fixedRateId,
          refundAddress: req.body.refundAddress
        }
      };

      const URL: string = keys.API;

      if (req.body.useV2) {
        const {signature, publicKey} = this.changellySignRequestsV2(message, keys.SECRET);
        headers = {
          'Content-Type': 'application/json',
          'X-Api-Key': crypto.createHash('sha256').update(publicKey).digest('base64'),
          'X-Api-Signature': signature.toString('base64'),
        };
      } else {
        const sign: string = this.changellySignRequests(message, keys.SECRET);
        headers = {
          'Content-Type': 'application/json',
          sign,
          'api-key': keys.API_KEY
        };
      }

      this.request.post(
        URL,
        {
          headers,
          body: message,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  changellyGetTransactions(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys, headers;
      if (req.body.useV2) {
        keys = this.changellyGetKeysV2(req);
      } else {
        keys = this.changellyGetKeys(req);
      }

      if (!checkRequired(req.body, ['id', 'exchangeTxId'])) {
        return reject(new ClientError('changellyGetTransactions request missing arguments'));
      }

      const message = {
        id: req.body.id,
        jsonrpc: '2.0',
        method: 'getTransactions',
        params:
          {
            id: req.body.exchangeTxId,
            limit: req.body.limit ?? 1,
          }
      };

      const URL: string = keys.API;

      if (req.body.useV2) {
        const {signature, publicKey} = this.changellySignRequestsV2(message, keys.SECRET);
        headers = {
          'Content-Type': 'application/json',
          'X-Api-Key': crypto.createHash('sha256').update(publicKey).digest('base64'),
          'X-Api-Signature': signature.toString('base64'),
        };
      } else {
        const sign: string = this.changellySignRequests(message, keys.SECRET);
        headers = {
          'Content-Type': 'application/json',
          sign,
          'api-key': keys.API_KEY
        };
      }

      this.request.post(
        URL,
        {
          headers,
          body: message,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  changellyGetStatus(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys, headers;
      if (req.body.useV2) {
        keys = this.changellyGetKeysV2(req);
      } else {
        keys = this.changellyGetKeys(req);
      }

      if (!checkRequired(req.body, ['id', 'exchangeTxId'])) {
        return reject(new ClientError('changellyGetStatus request missing arguments'));
      }

      const message = {
        jsonrpc: '2.0',
        id: req.body.id,
        method: 'getStatus',
        params: {
          id: req.body.exchangeTxId
        }
      };

      const URL: string = keys.API;

      if (req.body.useV2) {
        const {signature, publicKey} = this.changellySignRequestsV2(message, keys.SECRET);
        headers = {
          'Content-Type': 'application/json',
          'X-Api-Key': crypto.createHash('sha256').update(publicKey).digest('base64'),
          'X-Api-Signature': signature.toString('base64'),
        };
      } else {
        const sign: string = this.changellySignRequests(message, keys.SECRET);
        headers = {
          'Content-Type': 'application/json',
          sign,
          'api-key': keys.API_KEY
        };
      }

      this.request.post(
        URL,
        {
          headers,
          body: message,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  private oneInchGetCredentials() {
    if (!config.oneInch) throw new Error('1Inch missing credentials');

    const credentials = {
      API: config.oneInch.api,
      API_KEY: config.oneInch.apiKey,
      referrerAddress: config.oneInch.referrerAddress,
      referrerFee: config.oneInch.referrerFee
    };

    return credentials;
  }

  oneInchGetReferrerFee(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const credentials = this.oneInchGetCredentials();

      const referrerFee: number = credentials.referrerFee;

      resolve({ referrerFee });
    });
  }

  oneInchGetSwap(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const credentials = this.oneInchGetCredentials();

      if (
        !checkRequired(req.body, [
          'fromTokenAddress',
          'toTokenAddress',
          'amount',
          'fromAddress',
          'slippage',
          'destReceiver'
        ])
      ) {
        return reject(new ClientError('oneInchGetSwap request missing arguments'));
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      let qs = [];
      qs.push('fromTokenAddress=' + req.body.fromTokenAddress);
      qs.push('toTokenAddress=' + req.body.toTokenAddress);
      qs.push('amount=' + req.body.amount);
      qs.push('fromAddress=' + req.body.fromAddress);
      qs.push('slippage=' + req.body.slippage);
      qs.push('destReceiver=' + req.body.destReceiver);

      if (credentials.referrerFee) qs.push('fee=' + credentials.referrerFee);
      if (credentials.referrerAddress) qs.push('referrerAddress=' + credentials.referrerAddress);

      const chainIdMap = {
        eth: 1,
        matic: 137
      };

      const chainId = chainIdMap[req.params?.['chain'] || 'eth'];

      const URL: string = `${credentials.API}/v5.2/${chainId}/swap/?${qs.join('&')}`;

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  oneInchGetTokens(req): Promise<any> {
    return new Promise((resolve, reject) => {

      const credentials = this.oneInchGetCredentials();
      const chain = req.params?.['chain'] || 'eth';
      const cacheKey = `oneInchTokens:${chain}`;

      this.storage.checkAndUseGlobalCache(cacheKey, Defaults.ONE_INCH_CACHE_DURATION, (err, values, oldvalues) => {
        if (err) this.logw('Could not get stored tokens list', err);
        if (values) return resolve(values);

        const headers = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + credentials.API_KEY,
        };

        const chainIdMap = {
          eth: 1,
          matic: 137
        };

        const chainId = chainIdMap[chain];

        const URL: string = `${credentials.API}/v5.2/${chainId}/tokens`;

        this.request.get(
          URL,
          {
            headers,
            json: true
          },
          (err, data) => {
            if (err) {
              this.logw('An error occured while retrieving the token list', err);
              if (oldvalues) {
               this.logw('Using old cached values');
               return resolve(oldvalues);
              }
              return reject(err.body ?? err);
            } else if (data?.statusCode === 429 && oldvalues) {
              // oneinch rate limit
               return resolve(oldvalues);
            } else {
              if (!data?.body?.tokens) {
                if (oldvalues) {
                  this.logw('No token list available... using old cached values');
                  return resolve(oldvalues);
                }
                return reject(new Error('Could not get tokens list'));
              }
              this.storage.storeGlobalCache(cacheKey, data.body.tokens, err => {
                if (err) {
                  this.logw('Could not store tokens list');
                }
                return resolve(data.body.tokens);
              });
            }
          }
        );
      });
    });
  }

  checkServiceAvailability(req): boolean {
    if (!checkRequired(req.body, ['service', 'opts'])) {
      throw new ClientError('checkServiceAvailability request missing arguments');
    }

    let serviceEnabled: boolean;

    switch (req.body.service) {
      case '1inch':
        if (req.body.opts?.country?.toUpperCase() === 'US') {
          serviceEnabled = false;
        } else {
          serviceEnabled = true;
        }
        break;

      default:
        serviceEnabled = true;
        break;
    }

    return serviceEnabled;
  }

  getSpenderApprovalWhitelist(cb) {
    if (Services.ERC20_SPENDER_APPROVAL_WHITELIST) {
      return cb(null, Services.ERC20_SPENDER_APPROVAL_WHITELIST);
    } else {
      return cb(new Error('Could not get ERC20 spender approval whitelist'));
    }
  }

  getPayId(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const headers = {
        'PayID-Version': '1.0',
        Accept: 'application/payid+json'
      };
      this.request.get(
        url,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  discoverPayId(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const URL: string = `https://${req.domain}/.well-known/webfinger?resource=payid%3A${req.handle}%24${req.domain}`;
      const headers = {
        'PayID-Version': '1.0',
        Accept: 'application/payid+json'
      };
      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            let url;
            if (data.body && data.body.links && data.body.links[0].template) {
              const template: string = data.body.links[0].template;
              url = template.replace('{acctpart}', req.handle);
            } else {
              url = `https://${req.domain}/${req.handle}`;
            }
            this.getPayId(url)
              .then(data => {
                return resolve(data);
              })
              .catch(err => {
                return reject(err);
              });
          }
        }
      );
    });
  }

  clearWalletCache(): Promise<boolean> {
    return new Promise(resolve => {
      this.storage.clearWalletCache(this.walletId, () => {
        resolve(true);
      });
    });
  }

  // Moralis services
  moralisGetWalletTokenBalances(req): Promise<any> {
    return new Promise(async(resolve, reject) => {
      try {
        const response = await Moralis.EvmApi.token.getWalletTokenBalances({
          address: req.body.address,
          chain: req.body.chain,
          toBlock: req.body.toBlock,
          tokenAddresses: req.body.tokenAddresses,
        });
      
        return resolve(response.raw ?? response);
      } catch (err) {
        reject(err);
      }
    });
  }

  moralisGetTokenAllowance(req): Promise<any> {
    return new Promise(async(resolve, reject) => {
      try {
        const response = await Moralis.EvmApi.token.getTokenAllowance({
          address: req.body.address,
          chain: req.body.chain,
          ownerAddress: req.body.ownerAddress,
          spenderAddress: req.body.spenderAddress,
        });
      
        return resolve(response.raw ?? response);
      } catch (err) {
        reject(err);
      }
    });
  }

  moralisGetNativeBalance(req): Promise<any> {
    return new Promise(async(resolve, reject) => {
      try {
        const response = await Moralis.EvmApi.balance.getNativeBalance({
          address: req.body.address,
          chain: req.body.chain,
          toBlock: req.body.toBlock,
        });
      
        return resolve(response.raw ?? response);
      } catch (err) {
        reject(err);
      }
    });
  }

  moralisGetTokenPrice(req): Promise<any> {
    return new Promise(async(resolve, reject) => {
      try {
        const response = await Moralis.EvmApi.token.getTokenPrice({
          address: req.body.address,
          chain: req.body.chain,
          include: req.body.include,
          exchange: req.body.exchange,
          toBlock: req.body.toBlock,
        });
      
        return resolve(response.raw ?? response);
      } catch (err) {
        reject(err);
      }
    });
  }

  moralisGetMultipleERC20TokenPrices(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys, headers;

      if (!config.moralis) return reject(new Error('Moralis missing credentials'));
      if (!checkRequired(req.body, ['tokens'])) {
        return reject(new ClientError('moralisGetMultipleERC20TokenPrices request missing arguments'));
      }

      let qs = [];
      if (req.body.chain) qs.push('chain=' + req.body.chain);
      if (req.body.include) qs.push('include=' + req.body.include);

      const URL: string = `https://deep-index.moralis.io/api/v2.2/erc20/prices${qs.length > 0 ? '?' + qs.join('&') : ''}`

      headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Api-Key': config.moralis.apiKey,
      };

      const message = {tokens: req.body.tokens};

      this.request.post(
        URL,
        {
          headers,
          body: message,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  private coinGeckoGetCredentials() {
    if (!config.coinGecko) throw new Error('coinGecko missing credentials');

    const credentials = {
      API: config.coinGecko.api,
    };

    return credentials;
  }

  coinGeckoGetRates(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const credentials = this.coinGeckoGetCredentials();
      const chain = req.params['chain'];
      const evmBlockchainNetwork = {
        eth: 'ethereum',
        matic: 'polygon-pos',
      };
      const contractAddresses = req.params['contractAddresses']; // format example 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48,0x6b175474e89094c44da98b954eedeac495271d0f,..
      const altCurrencies = req.params['altCurrencies']; // format example ars,aud,usd,...
        
      const URL: string = `${credentials.API}/v3/simple/token_price/${
        evmBlockchainNetwork[chain]
      }?contract_addresses=${contractAddresses}&vs_currencies=${altCurrencies}&include_24hr_change=true&include_last_updated_at=true`;
        
      this.request.get(
        URL,
        {
          json: true
        },
        (err, data) => {
          if (err) {
            this.logw('An error occured while retrieving the token rates', err);
            return reject(err.body ?? err);
          } else {
            if (!data?.body) {
              this.logw('No token rates available');
              return reject(new Error('Could not get tokens rates'));
            }
            return resolve(data.body);
          }
        }
      );
    });
  }
}


function checkRequired(obj, args, cb?: (e: any) => void) {
  const missing = Utils.getMissingFields(obj, args);
  if (_.isEmpty(missing)) {
    return true;
  }

  if (_.isFunction(cb)) {
    return cb(new ClientError('Required argument: ' + _.first(missing) + ' missing.'));
  }

  return false;
}
