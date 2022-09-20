import * as async from 'async';
import * as _ from 'lodash';
import 'source-map-support/register';
import { BlockChainExplorer } from './blockchainexplorer';
import { V8 } from './blockchainexplorers/v8';
import { UNITS } from '@abcpros/crypto-wallet-core/ts_build/src/constants/units';
import { ChainService } from './chain/index';
import { ClientError } from './errors/clienterror';
import { FiatRateService } from './fiatrateservice';
import { Lock } from './lock';
import logger from './logger';
import { MessageBroker } from './messagebroker';
import {
  Advertisement,
  Copayer,
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

const Client = require('@abcpros/bitcore-wallet-client').default;
const Key = Client.Key;
const commonBWC = require('@abcpros/bitcore-wallet-client/ts_build/lib/common');
const walletLotus = require('../../../../wallet-lotus-donation.json');
// const keyFund = require('../../../../key-store.json');
const fs = require('fs');
const { dirname } = require('path');
const appDir = dirname(require.main.filename);
// import * as swapConfigFile from './admin-config.json';
// var obj = JSON.parse(fs.readFileSync(swapConfig, 'utf8'));

const config = require('../config');
const Uuid = require('uuid');
const $ = require('preconditions').singleton();
const deprecatedServerMessage = require('../deprecated-serverMessages');
const serverMessages = require('../serverMessages');
const BCHAddressTranslator = require('./bchaddresstranslator');
const EmailValidator = require('email-validator');

import { Validation } from '@abcpros/crypto-wallet-core';
import assert from 'assert';
import { CurrencyRateService } from './currencyrate';
import { CoinDonationToAddress, DonationInfo, DonationStorage } from './model/donation';
import { TokenInfo, TokenItem } from './model/tokenInfo';
import { Order } from './model/order';
import { countBy } from 'lodash';
import { isIfStatement, isToken, Token } from 'typescript';
import { Unit } from '@abcpros/bitcore-lib-xpi';
import { CoinConfig, ConfigSwap } from './model/config-swap';
import { Config } from './model/config-model';
const Bitcore = require('@abcpros/bitcore-lib');
const Bitcore_ = {
  btc: Bitcore,
  bch: require('@abcpros/bitcore-lib-cash'),
  xec: require('@abcpros/bitcore-lib-xec'),
  eth: Bitcore,
  xrp: Bitcore,
  doge: require('@abcpros/bitcore-lib-doge'),
  xpi: require('@abcpros/bitcore-lib-xpi'),
  ltc: require('@abcpros/bitcore-lib-ltc')
};

const Common = require('./common');
const Utils = Common.Utils;
const Constants = Common.Constants;
const Defaults = Common.Defaults;

const Errors = require('./errors/errordefinitions');

const shell = require('shelljs');

const BCHJS = require('@abcpros/xpi-js');
const bchURL = config.supportToken.xec.bchUrl;
const bchjs = new BCHJS({ restURL: bchURL });

const ecashaddr = require('ecashaddrjs');


let request = require('request');
let initialized = false;
let doNotCheckV8 = false;

let lock;
let storage;
let blockchainExplorer;
let blockchainExplorerOpts;
let messageBroker;
let fiatRateService;
let currencyRateService;
let serviceVersion;
let fundingWalletClients: any;
let receivingWalletClients: any;
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
  parsedClientVersion: { agent: number; major: number; minor: number };
  clientVersion: string;
  copayerIsSupportStaff: boolean;
  copayerIsMarketingStaff: boolean;
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
  copayerIsMarketingStaff: boolean;
  request;

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

    const initCurrencyRateService = cb => {
      if (opts.currency) {
        currencyRateService = opts.currencyRateService;
        return cb();
      } else {
        const newCurrencyRateService = new CurrencyRateService();
        const opts2 = opts.currencyRateServiceOpts || {};
        opts2.storage = storage;
        newCurrencyRateService.init(opts2, err => {
          if (err) {
            return cb(err);
          }
          currencyRateService = newCurrencyRateService;
          return cb();
        });
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
          initCurrencyRateService(next);
        }
      ],
      err => {
        lock = opts.lock || new Lock(storage);

        if (err) {
          logger.error('Could not initialize', err);
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
    if (!this || !this.walletId) {
      return logger.warn(message, ...args);
    }

    message = '<' + this.walletId + '>' + message;
    return logger.info(message, ...args);
  }

  logw(message, ...args) {
    if (!this || !this.walletId) {
      return logger.warn(message, ...args);
    }

    message = '<' + this.walletId + '>' + message;
    return logger.warn(message, ...args);
  }

  logd(message, ...args) {
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
   * @param {string} opts.singleAddress[=false] - The wallet will only ever have one address.
   * @param {string} opts.coin[='btc'] - The coin for this wallet (btc, bch, eth, doge, ltc).
   * @param {string} opts.network[='livenet'] - The Bitcoin network for this wallet.
   * @param {string} opts.account[=0] - BIP44 account number
   * @param {string} opts.usePurpose48 - for Multisig wallet, use purpose=48
   * @param {string} opts.useNativeSegwit - for Segwit address, set addressType to P2WPKH or P2WSH
   */
  createWallet(opts, cb) {
    let pubKey;

    if (opts.coin === 'bch' && opts.n > 1) {
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

    opts.coin = opts.coin || Defaults.COIN;
    if (!Utils.checkValueInCollection(opts.coin, Constants.COINS)) {
      return cb(new ClientError('Invalid coin'));
    }

    opts.network = opts.network || 'livenet';
    if (!Utils.checkValueInCollection(opts.network, Constants.NETWORKS)) {
      return cb(new ClientError('Invalid network'));
    }

    const derivationStrategy = Constants.DERIVATION_STRATEGIES.BIP44;
    let addressType = opts.n === 1 ? Constants.SCRIPT_TYPES.P2PKH : Constants.SCRIPT_TYPES.P2SH;

    if (opts.useNativeSegwit) {
      addressType = opts.n === 1 ? Constants.SCRIPT_TYPES.P2WPKH : Constants.SCRIPT_TYPES.P2WSH;
    }

    try {
      pubKey = new Bitcore.PublicKey.fromString(opts.pubKey);
    } catch (ex) {
      return cb(new ClientError('Invalid public key'));
    }

    if (opts.n > 1 && !ChainService.supportsMultisig(opts.coin)) {
      return cb(new ClientError('Multisig wallets are not supported for this coin'));
    }

    if (ChainService.isSingleAddress(opts.coin)) {
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
            network: opts.network,
            pubKey: pubKey.toString(),
            singleAddress: !!opts.singleAddress,
            derivationStrategy,
            addressType,
            nativeCashAddr: opts.nativeCashAddr,
            usePurpose48: opts.n > 1 && !!opts.usePurpose48,
            isSlpToken: opts.isSlpToken
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
   * * @param {string} opts.walletId - The wallet id.
   * @returns {Object} wallet
   */
  getWallet(opts, cb) {
    let walletId = this.walletId;
    if (opts.walletId) {
      walletId = opts.walletId;
    }
    this.storage.fetchWallet(walletId, (err, wallet) => {
      if (err) return cb(err);
      if (!wallet) return cb(Errors.WALLET_NOT_FOUND);

      // cashAddress migration
      if (wallet.coin != 'bch' || wallet.nativeCashAddr) return cb(null, wallet);

      // only for testing
      if (opts.doNotMigrate) return cb(null, wallet);

      // remove someday...
      logger.info(`Migrating wallet ${wallet.id} to cashAddr`);
      this.storage.migrateToCashAddr(walletId, e => {
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
   * @returns {Object} wallet
   */
  getWalletFromId(walletId, cb) {
    this.storage.fetchWallet(walletId, (err, wallet) => {
      if (err) return cb(err);
      if (!wallet) return cb(Errors.WALLET_NOT_FOUND);

      // cashAddress migration
      if (wallet.coin != 'bch' || wallet.nativeCashAddr) return cb(null, wallet);

      // remove someday...
      logger.info(`Migrating wallet ${wallet.id} to cashAddr`);
      this.storage.migrateToCashAddr(walletId, e => {
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
          this.storage.fetchAddressByCoin(Defaults.COIN, opts.identifier, (err, address) => {
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
   * @param {string} opts.name - The copayer name.
   * @param {string} opts.xPubKey - Extended Public Key for this copayer.
   * @param {string} opts.requestPubKey - Public Key used to check requests from this copayer.
   * @param {string} opts.copayerSignature - S(name|xPubKey|requestPubKey). Used by other copayers to verify that the copayer joining knows the wallet secret.
   * @param {string} opts.customData - (optional) Custom data for this copayer.
   * @param {string} opts.dryRun[=false] - (optional) Simulate the action but do not change server state.
   */
  joinWallet(opts, cb) {
    if (!checkRequired(opts, ['walletId', 'name', 'xPubKey', 'requestPubKey', 'copayerSignature'], cb)) return;

    if (_.isEmpty(opts.name)) return cb(new ClientError('Invalid copayer name'));

    opts.coin = opts.coin || Defaults.COIN;
    if (!Utils.checkValueInCollection(opts.coin, Constants.COINS)) return cb(new ClientError('Invalid coin'));

    let xPubKey;
    try {
      xPubKey = Bitcore_[opts.coin].HDPublicKey(opts.xPubKey);
    } catch (ex) {
      return cb(new ClientError('Invalid extended public key'));
    }
    if (_.isUndefined(xPubKey.network)) {
      return cb(new ClientError('Invalid extended public key'));
    }

    this.walletId = opts.walletId;
    this._runLocked(cb, cb => {
      this.storage.fetchWallet(opts.walletId, (err, wallet) => {
        if (err) return cb(err);
        if (!wallet) return cb(Errors.WALLET_NOT_FOUND);

        if (opts.coin === 'bch' && wallet.n > 1) {
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

        if (opts.coin != wallet.coin) {
          return cb(new ClientError('The wallet you are trying to join was created for a different coin'));
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

      if (wallet.coin != 'eth') {
        opts.tokenAddresses = null;
        opts.multisigEthInfo = null;
      }

      this._runLocked(cb, cb => {
        this.storage.fetchPreferences(this.walletId, this.copayerId, (err, oldPref) => {
          if (err) return cb(err);

          const newPref = Preferences.create({
            walletId: this.walletId,
            copayerId: this.copayerId
          });
          const preferences = Preferences.fromObj(_.defaults(newPref, opts, oldPref));

          // merge tokenAddresses
          if (opts.tokenAddresses) {
            oldPref = oldPref || {};
            oldPref.tokenAddresses = oldPref.tokenAddresses || [];
            preferences.tokenAddresses = _.uniq(oldPref.tokenAddresses.concat(opts.tokenAddresses));
          }

          // merge multisigEthInfo
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
    ChainService.addressToStorageTransform(wallet.coin, wallet.network, stoAddress);
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
          if (duplicate) return cb(null, address);
          if (wallet.coin == 'bch' && opts.noCashAddr) {
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
          ChainService.addressFromStorageTransform(wallet.coin, wallet.network, x);
          return cb(null, x);
        }
        return createNewAddress(wallet, cb);
      });
    };

    this.getWallet({ doNotMigrate: opts.doNotMigrate }, (err, wallet) => {
      if (err) return cb(err);

      if (ChainService.isSingleAddress(wallet.coin)) {
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
          ChainService.addressFromStorageTransform(wallet.coin, wallet.network, x);
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
      if (this.blockchainExplorerOpts[coin] && this.blockchainExplorerOpts[coin][network]) {
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

  getUtxosForCurrentWallet(opts, cb) {
    opts = opts || {};
    let walletId = this.walletId;
    if(opts.walletId){
      walletId = opts.walletId;
    }
    const utxoKey = utxo => {
      return utxo.txid + '|' + utxo.vout;
    };

    let coin, allAddresses, allUtxos, utxoIndex, addressStrs, bc, wallet;
    async.series(
      [
        next => {
          this.getWallet({walletId: walletId}, (err, w) => {
            if (err) return next(err);

            wallet = w;

            if (wallet.scanStatus == 'error') return cb(Errors.WALLET_NEED_SCAN);

            coin = wallet.coin;

            bc = this._getBlockchainExplorer(coin, wallet.network);
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
          this.storage.fetchAddresses(walletId, (err, addresses) => {
            _.each(addresses, x => {
              ChainService.addressFromStorageTransform(wallet.coin, wallet.network, x);
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

          this._getBlockchainHeight(wallet.coin, wallet.network, (err, height, hash) => {
            if (err) return next(err);

            const dustThreshold = Bitcore_[wallet.coin].Transaction.DUST_AMOUNT;
            bc.getUtxos(wallet, height, (err, utxos) => {
              if (err) return next(err);
              if (utxos.length == 0) return cb(null, []);

              // filter out DUST
              allUtxos = _.filter(utxos, x => {
                return x.satoshis >= dustThreshold;
              });

              utxoIndex = _.keyBy(allUtxos, utxoKey);
              return next();
            });
          });
        },
        next => {
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
            walletId,
            {
              minTs: now - 24 * 3600,
              limit: 100
            },
            (err, txs) => {
              if (err) return next(err);
              const spentInputs = _.map(_.flatten(_.map(txs, 'inputs')), utxoKey);
              _.each(spentInputs, input => {
                if (utxoIndex[input]) {
                  utxoIndex[input].spent = true;
                }
              });
              allUtxos = _.reject(allUtxos, {
                spent: true
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
        },
        next => {
          if (this._isSupportToken(wallet)) {
            this.storage.fetchAddresses(walletId, async (err, addresses) => {
              if (err) return next(err);
              if (_.size(addresses) < 1 || !addresses[0].address) return next('no addresss');
              let promiseList = [];
              _.each(addresses, address => {
                promiseList.push(this._getUxtosByChronik(wallet.coin, address.address));
              });

              await Promise.all(promiseList)
                .then(async utxos => {
                  utxos = utxos.reduce((accumulator, value) => accumulator.concat(value), []);
                  const utxoNonSlpChronik = _.filter(utxos, item => item.isNonSLP);
                  allUtxos = this._filterOutSlpUtxo(utxoNonSlpChronik, _.cloneDeep(allUtxos));
                  return next();
                })
                .catch(err => {
                  return next(err);
                });
            });
          } else {
            return next();
          }
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

  _filterOutSlpUtxo(utxoNonSlpChronik, allUtxos) {
    const utxoNonSlp = [];
    _.forEach(utxoNonSlpChronik, itemUtxos => {
      const utxosNonSlp = _.find(allUtxos, item => item.txid == itemUtxos.txid && item.vout == itemUtxos.outIdx);
      if (utxosNonSlp) utxoNonSlp.push(utxosNonSlp);
    });
    return utxoNonSlp;
  }

  _isSupportToken(wallet: any): boolean {
    const isSupportToken = _.get(config, `supportToken[${wallet.coin}].isSupportToken`, false);
    return wallet.isSlpToken && isSupportToken;
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

        this._getBlockchainHeight(wallet.coin, wallet.network, (err, height, hash) => {
          if (err) return cb(err);
          bc.getAddressUtxos(address, height, wallet.coin, (err, allUtxos) => {
            if (err) return cb(err);
            if (this._isSupportToken(wallet)) {
              this.storage.fetchAddresses(this.walletId, async (err, addresses) => {
                if (err) return cb(err);
                if (_.size(addresses) < 1 || !addresses[0].address) return cb('no addresss');
                let promiseList = [];
                _.each(addresses, address => {
                  promiseList.push(this._getUxtosByChronik(wallet.coin, address.address));
                });
                await Promise.all(promiseList)
                  .then(async utxos => {
                    utxos = utxos.reduce((accumulator, value) => accumulator.concat(value), []);
                    const utxoNonSlpChronik = _.filter(utxos, item => item.isNonSLP);
                    allUtxos = this._filterOutSlpUtxo(utxoNonSlpChronik, _.cloneDeep(allUtxos));
                    return cb(null, allUtxos);
                  })
                  .catch(err => {
                    return cb(err);
                  });
              });
            } else {
              return cb(null, allUtxos);
            }
          });
        });
      });
    } else {
      this.getUtxosForCurrentWallet({}, cb);
    }
  }

  getUtxosForSelectedAddressAndWallet(opts, cb) {
    opts = opts || {};

    if (opts.addresses) {
      if (opts.addresses.length > 1) return cb(new ClientError('Addresses option only support 1 address'));

      let wallet = opts;

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

      this._getBlockchainHeight(wallet.coin, wallet.network, (err, height, hash) => {
        if (err) return cb(err);
        bc.getAddressUtxos(address, height, wallet.coin, async (err, allUtxos) => {
          if (err) return cb(err);
          let promiseList = [];
          if (wallet.isTokenSupport) {
            this._getUxtosByChronik(wallet.coin, address).then(
              utxos => {
                // utxos = utxos.reduce((accumulator, value) => accumulator.concat(value), []);
                // const utxoNonSlpChronik = _.filter(utxos, item => !item.isNonSLP && item.slpMeta.tokenId === wallet.tokenId);
                // allUtxos = this._filterOutSlpUtxo(utxoNonSlpChronik, _.cloneDeep(allUtxos));
                const filteredUtxos = _.filter(utxos, item => !item.isNonSLP && item.slpMeta.tokenId === wallet.tokenId);
                return cb(null, filteredUtxos);
              }
            )
            // await Promise.all(promiseList)
            //   .then(async
            //   })
              .catch(err => {
                return cb(err);
              });
          } else {
            return cb(null, allUtxos);
          }
        });
      });
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
      if (!ChainService.isUTXOCoin(wallet.coin)) {
        // this prevents old BWC clients to break
        return cb(null, {
          inputs: [],
          outputs: []
        });
      }
      const bc = this._getBlockchainExplorer(wallet.coin, wallet.network);
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
   * Returns tx Detail by txid (function support XEC and XPI )
   * @param {string} txId - the transaction id.
   * @returns {Obejct} tx detail
   */
  getTxDetail(txId, cb) {
    this.getWallet({}, async (err, wallet) => {
      try {
        const chronikClient = ChainService.getChronikClient(wallet.coin);
        const txDetail: any = await chronikClient.tx(txId);
        if (!txDetail) return cb('no txDetail');
        const inputAddresses = _.uniq(
          _.map(txDetail.inputs, item => {
            return this._convertAddressFormInputScript(item.inputScript, wallet.coin, true);
          })
        );
        if (inputAddresses) {
          txDetail.inputAddresses = inputAddresses;
          this.storage.updateCacheTxHistoryByTxId(wallet.id, txId, inputAddresses, (err, result) => {
            if (err) return cb(err);
            return cb(null, txDetail);
          });
        } else {
          return cb(null, txDetail);
        }
      } catch (err) {
        return cb(err);
      }
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
      let optsReturn = {};
      if(opts.walletId){
        optsReturn = opts;
      }
      this.getWallet(optsReturn, (err, ret) => {
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

  getBalanceWithPromise(opts){
    return new Promise((resolve, reject) => {
      this.getBalance(opts, (err, balance) => {
        if(err) return reject(err);
        else return resolve({
          walletId: opts.walletId,
          coin: opts.coinCode,
          balance: balance
        });
      })
    })
  }

  getBalanceDonation(opts, cb) {
    opts = opts || {};
    if (opts.coin) {
      return cb(new ClientError('coin is not longer supported in getBalance'));
    }
    let wallet = opts.wallet;
    this.walletId = config.donationWalletId;
    const setWallet = cb1 => {
      const walletIdDonation = config.donationWalletId;
      if (wallet) return cb1();
      this.getWalletFromId(walletIdDonation, (err, ret) => {
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

  getRemainingAmount(receiveAmountLotus, cb) {
    this.storage.fetchDonationInToday((err, donationInToday: DonationStorage) => {
      if (err) return 0;
      if (_.isEmpty(donationInToday)) return cb(config.donationRemaining.totalAmountLotusInDay);
      const remaningAmount =
        config.donationRemaining.totalAmountLotusInDay - _.size(donationInToday) * receiveAmountLotus;
      return cb(remaningAmount);
    });
  }

  _getUxtosByChronik(coin, address) {
    let chronikClient;
    let scriptPayload;
    if(address.includes('ecash:')){
      address = address.replace(/ecash:/,'');
    }
    try {
      scriptPayload = ChainService.convertAddressToScriptPayload(coin, address);
      chronikClient = ChainService.getChronikClient(coin);
    } catch {
      return Promise.reject('err funtion _getUxtosByChronik in aws');
    }
    return chronikClient
      .script('p2pkh', scriptPayload)
      .utxos()
      .then(chronikUtxos => {
        const utxos = _.flatMap(chronikUtxos, scriptUtxos => {
          return _.map(scriptUtxos.utxos, utxo => ({
            txid: utxo.outpoint.txid,
            outIdx: utxo.outpoint.outIdx,
            value: utxo.value.toNumber(),
            isNonSLP: utxo.slpToken ? false : true,
            slpMeta: utxo.slpMeta,
            tokenId: utxo.slpMeta ? utxo.slpMeta.tokenId : undefined,
            amountToken: utxo.slpToken && utxo.slpToken.amount ? utxo.slpToken.amount.toNumber() : undefined
          }));
        });
        return utxos;
      })
      .catch(err => {
        return Promise.reject(err);
      });
  }

  getUtxosToken(opts, cb) {
    opts = opts || {};
    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);
      this.storage.fetchAddresses(this.walletId, async (err, addresses) => {
        if (err) return cb(err);

        if (_.size(addresses) < 1 || !addresses[0].address) return cb('no addresss');
        let promiseList = [];
        _.each(addresses, address => {
          promiseList.push(this._getUxtosByChronik(wallet.coin, address.address));
        });

        await Promise.all(promiseList)
          .then(async utxos => {
            utxos = utxos.reduce((accumulator, value) => accumulator.concat(value), []);
            return cb(null, utxos);
          })
          .catch(err => {
            return cb(err);
          });
      });
    });
  }

  _getAndStoreTokenInfo(coin, tokenId): Promise<TokenInfo> {
    return new Promise((resolve, reject) => {
      return this.storage.fetchTokenInfoById(tokenId, (err, tokenInfo: TokenInfo) => {
        if (err) return reject(err);
        if (tokenInfo) return resolve(tokenInfo);
        return ChainService.getTokenInfo(coin, tokenId)
          .then((data: TokenInfo) => {
            if (data && data.id) {
              this.storage.storeTokenInfo(data, err => {
                if (err) return reject(err);
                return resolve(data);
              });
            } else {
              return reject(`No info for token ${tokenId}`);
            }
          })
          .catch(err => {
            return reject(err);
          });
      });
    });
  }

  getTokensWithPromise(opts){
    return new Promise((resolve, reject) =>{
      this.getTokens(opts, (err, result)=>{
        if(err) return reject(err);
        return resolve(result);
      })
    })
  }

  getTokens(opts, cb) {
    opts = opts || {};
    const walletId = opts && opts.walletId ? opts.walletId : this.walletId;
    const groupToken = [];
    const caculateAmountToken = (utxoToken, decimals) => {
      const totalAmount = _.sumBy(utxoToken, 'amountToken');
      return totalAmount / Math.pow(10, decimals);
    };
    this.getWallet({ walletId: walletId }, (err, wallet) => {
      if (err) return cb(err);
      this.storage.fetchAddresses(walletId, async (err, addresses) => {
        if (err) return cb(err);

        if (_.size(addresses) < 1 || !addresses[0].address) return cb('no addresss');
        let promiseList = [];
        _.each(addresses, address => {
          promiseList.push(this._getUxtosByChronik(wallet.coin, address.address));
        });

        await Promise.all(promiseList)
          .then(async data => {
            data = data.reduce((accumulator, value) => accumulator.concat(value), []);
            if (_.isEmpty(data)) return cb(null, []);
            const groupTokenId = _.groupBy(data, 'tokenId');
            for (var tokenId in groupTokenId) {
              if (tokenId == 'undefined') continue;
              if (groupTokenId.hasOwnProperty(tokenId)) {
                try {
                  const tokenInfor: TokenInfo = await this._getAndStoreTokenInfo(wallet.coin, tokenId);
                  const tokenItem = {
                    tokenId,
                    tokenInfo: tokenInfor,
                    amountToken: caculateAmountToken(groupTokenId[tokenId], tokenInfor.decimals),
                    utxoToken: groupTokenId[tokenId]
                  };
                  groupToken.push(tokenItem);
                } catch (err) {
                  return cb(err);
                }
              }
            }
            return cb(null, groupToken);
          })
          .catch(err => {
            return cb(err);
          });
      });
    });
  }

  getAllTokenInfo(cb){
    // return new Promise((resolve, reject) => {
      this.storage.fetchTokenInfo((err, tokenInfoList)=>{
        if(err) return cb(err);
        return cb(null, tokenInfoList);
      })
    // })
  }

  getRemainingInfo(opts, cb) {
    const infor: DonationInfo = {};
    this.convertUSDToSatoshiLotus(config.donationRemaining.minMoneydonation, 'xpi', receiveAmountLotus => {
      this.getRemainingAmount(receiveAmountLotus, remaningAmount => {
        infor.remaining = remaningAmount;
        infor.minMoneydonation = config.donationRemaining.minMoneydonation;
        infor.receiveAmountLotus = receiveAmountLotus;
        infor.donationToAddresses = config.donationRemaining.donationToAddresses;
        infor.donationCoin = config.donationRemaining.donationCoin;
        return cb(null, infor);
      });
    });
  }

  getWalletFundRemaining(opts, cb) {
    const infor: DonationInfo = {};
    this.convertUSDToSatoshiLotus(config.donationRemaining.minMoneydonation, 'xpi', receiveAmountLotus => {
      this.getRemainingAmount(receiveAmountLotus, remaningAmount => {
        infor.remaining = remaningAmount;
        infor.minMoneydonation = config.donationRemaining.minMoneydonation;
        infor.receiveAmountLotus = receiveAmountLotus;
        infor.donationToAddresses = config.donationRemaining.donationToAddresses;
        infor.donationCoin = config.donationRemaining.donationCoin;
        return cb(null, infor);
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

      const feeLevels = Defaults.FEE_LEVELS[wallet.coin];
      if (opts.feeLevel) {
        if (
          !_.some(feeLevels, {
            name: opts.feeLevel
          })
        )
          return cb(new ClientError('Invalid fee level. Valid values are ' + _.map(feeLevels, 'name').join(', ')));
      }

      if (_.isNumber(opts.feePerKb)) {
        if (opts.feePerKb < Defaults.MIN_FEE_PER_KB || opts.feePerKb > Defaults.MAX_FEE_PER_KB[wallet.coin])
          return cb(new ClientError('Invalid fee per KB'));
      }

      return ChainService.getWalletSendMaxInfo(this, wallet, opts, cb);
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
        _.map(points, p => {
          const feePerKb = _.isObject(result) && result[p] && _.isNumber(result[p]) ? +result[p] : -1;
          if (feePerKb < 0) failed.push(p);

          // NOTE: ONLY BTC/BCH/DOGE/LTC expect feePerKb to be Bitcoin amounts
          // others... expect wei.

          return ChainService.convertFeePerKb(coin, p, feePerKb);
        })
      );

      if (failed.length) {
        const logger = network == 'livenet' ? this.logw : this.logi;
        logger('Could not compute fee estimation in ' + network + ': ' + failed.join(', ') + ' blocks.');
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
  async getFeeLevels(opts, cb) {
    opts = opts || {};

    opts.coin = opts.coin || Defaults.COIN;
    if (!Utils.checkValueInCollection(opts.coin, Constants.COINS)) return cb(new ClientError('Invalid coin'));

    opts.network = opts.network || 'livenet';
    if (!Utils.checkValueInCollection(opts.network, Constants.NETWORKS)) return cb(new ClientError('Invalid network'));

    const cacheKey = 'feeLevel:' + opts.coin + ':' + opts.network;

    this.storage.checkAndUseGlobalCache(cacheKey, Defaults.FEE_LEVEL_CACHE_DURATION, (err, values, oldvalues) => {
      if (err) return cb(err);
      if (!_.isEmpty(values)) return cb(null, values, true);

      const feeLevels = Defaults.FEE_LEVELS[opts.coin];

      /*
      if (opts.coin === 'doge') {
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

      this._sampleFeeLevels(opts.coin, opts.network, samplePoints(), (err, feeSamples, failed) => {
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

      if (!ChainService.checkValidTxAmount(wallet.coin, output)) {
        return new ClientError('Invalid amount');
      }

      const error = ChainService.checkDust(wallet.coin, output, opts);
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

          const feeLevels = Defaults.FEE_LEVELS[wallet.coin];
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

          const error = ChainService.checkUtxos(wallet.coin, opts);
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
          if (opts.validateOutputs === false) return next();
          const validationError = this._validateOutputs(opts, wallet, next);
          if (validationError) {
            return next(validationError);
          }
          next();
        },
        next => {
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

  getFee(coinInfo, opts) {
    return new Promise((resolve, reject) => {
      // This is used for sendmax flow
      // if (_.isNumber(opts.fee)) {
      //   return resolve({ feePerKb: opts.fee });
      // }
      const coinCode = coinInfo.isToken ? 'xec' : coinInfo.code;
      this._getFeePerKb({ coin: coinCode }, opts, (err, inFeePerKb) => {
        if (err) {
          return reject(err);
        }
        let feePerKb = inFeePerKb;
        return resolve({ coin: coinInfo, feePerKb });
      });
    });
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

  getNonce(opts) {
    const bc = this._getBlockchainExplorer(opts.coin, opts.network);
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
    const bc = this._getBlockchainExplorer(opts.coin, opts.network);
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
    const bc = this._getBlockchainExplorer('eth', opts.network);
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
    const bc = this._getBlockchainExplorer('eth', opts.network);
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
    const bc = this._getBlockchainExplorer('eth', opts.network);
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
    const bc = this._getBlockchainExplorer('eth', opts.network);
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
   * @param {String} opts.walletId - Select wallet to create tx.
   * @param {string} opts.txProposalId - Optional. If provided it will be used as this TX proposal ID. Should be unique in the scope of the wallet.
   * @param {String} opts.coin - tx coin.
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
   * @param {Array} opts.txpVersion - Optional. Version for TX Proposal (current = 4, only =3 allowed).
   * @param {number} opts.fee - Optional. Use an fixed fee for this TX (only when opts.inputs is specified)
   * @param {Boolean} opts.noShuffleOutputs - Optional. If set, TX outputs won't be shuffled. Defaults to false
   * @param {Boolean} opts.noCashAddr - do not use cashaddress for bch
   * @param {Boolean} opts.signingMethod[=ecdsa] - do not use cashaddress for bch
   * @param {string} opts.tokenAddress - optional. ERC20 Token Contract Address
   * @param {string} opts.multisigContractAddress - optional. MULTISIG ETH Contract Address
   * @param {Boolean} opts.isTokenSwap - Optional. To specify if we are trying to make a token swap
   * @returns {TxProposal} Transaction proposal. outputs address format will use the same format as inpunt.
   */
  createTx(opts, cb) {
    opts = opts ? _.clone(opts) : {};
    const walletId = opts.walletId ? opts.walletId : this.walletId;
    const copayerId = opts.copayerId ? opts.copayerId : this.copayerId;
    const checkTxpAlreadyExists = (txProposalId, cb) => {
      if (!txProposalId) return cb();
      this.storage.fetchTx(walletId, txProposalId, cb);
    };

    this._runLocked(
      cb,
      cb => {
        let changeAddress, feePerKb, gasPrice, gasLimit, fee;
        this.getWallet(walletId, (err, wallet) => {
          if (err) return cb(err);
          if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

          if (wallet.scanStatus == 'error') return cb(Errors.WALLET_NEED_SCAN);

          if (config.suspendedChains && config.suspendedChains.includes(wallet.coin)) {
            let Err = Errors.NETWORK_SUSPENDED;
            Err.message = Err.message.replace('$network', wallet.coin.toUpperCase());
            return cb(Err);
          }

          checkTxpAlreadyExists(opts.txProposalId, (err, txp) => {
            if (err) return cb(err);
            if (txp) return cb(null, txp);

            async.series(
              [
                next => {
                  if (ChainService.isUTXOCoin(wallet.coin)) return next();
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
                    ({ feePerKb, gasPrice, gasLimit, fee } = await ChainService.getFee(this, wallet, opts));
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
                    const isNotUtxoCoin = !ChainService.isUTXOCoin(wallet.coin);
                    const shouldUseOptsFee = useInputFee || isNotUtxoCoin;

                    if (shouldUseOptsFee) {
                      txOptsFee = opts.fee;
                    }
                  }

                  const txOpts = {
                    id: opts.txProposalId,
                    walletId: walletId,
                    creatorId: copayerId,
                    coin: opts.coin,
                    chain: opts.chain ? opts.chain : ChainService.getChain(opts.coin),
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
                    version: opts.txpVersion,
                    fee: txOptsFee,
                    noShuffleOutputs: opts.noShuffleOutputs,
                    gasPrice,
                    nonce: opts.nonce,
                    gasLimit, // Backward compatibility for BWC < v7.1.1
                    data: opts.data, // Backward compatibility for BWC < v7.1.1
                    tokenAddress: opts.tokenAddress,
                    multisigContractAddress: opts.multisigContractAddress,
                    destinationTag: opts.destinationTag,
                    invoiceID: opts.invoiceID,
                    signingMethod: opts.signingMethod,
                    isDonation: opts.isDonation,
                    receiveLotusAddress: opts.receiveLotusAddress,
                    isTokenSwap: opts.isTokenSwap
                  };
                  txp = TxProposal.create(txOpts);
                  next();
                },
                next => {
                  return ChainService.selectTxInputs(this, txp, wallet, opts, next);
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
    const walletId = opts.walletId ? opts.walletId : this.walletId;
    const copayerId = opts.copayerId ? opts.copayerId : this.copayerId;

    if (!checkRequired(opts, ['txProposalId', 'proposalSignature'], cb)) return;

    this._runLocked(cb, cb => {
      this.getWallet({}, (err, wallet) => {
        if (err) return cb(err);

        if (config.suspendedChains && config.suspendedChains.includes(wallet.coin)) {
          let Err = Errors.NETWORK_SUSPENDED;
          Err.message = Err.message.replace('$network', wallet.coin.toUpperCase());
          return cb(Err);
        }

        this.storage.fetchTx(walletId, opts.txProposalId, (err, txp) => {
          if (err) return cb(err);
          if (!txp) return cb(Errors.TX_NOT_FOUND);
          if (!txp.isTemporary()) return cb(null, txp);

          const copayer = wallet.getCopayer(copayerId);

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
            this.storage.storeTx(walletId, txp, err => {
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

  _broadcastRawTx(coin, network, raw, cb) {
    const bc = this._getBlockchainExplorer(coin, network);
    if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
    bc.broadcast(raw, (err, txid) => {
      if (err) return cb(err);
      return cb(null, txid);
    });
  }

  _broadcastRawTxByChronik(chronikClient, hex, cb) {
    return chronikClient
      .broadcastTx(hex)
      .then(txidObj => {
        return cb(null, txidObj.txid);
      })
      .catch(err => {
        return cb(err);
      });
  }

  /**
   * Broadcast a raw transaction.
   * @param {Object} opts
   * @param {string} [opts.coin = 'btc'] - The coin for this transaction.
   * @param {string} [opts.network = 'livenet'] - The Bitcoin network for this transaction.
   * @param {string} opts.rawTx - Raw tx data.
   */
  async broadcastRawTx(opts, cb) {
    if (!checkRequired(opts, ['network', 'rawTx'], cb)) return;
    const ischronik = opts.ischronik ? opts.ischronik : undefined;
    opts.coin = opts.coin || Defaults.COIN;
    if (!Utils.checkValueInCollection(opts.coin, Constants.COINS)) return cb(new ClientError('Invalid coin'));

    opts.network = opts.network || 'livenet';
    if (!Utils.checkValueInCollection(opts.network, Constants.NETWORKS)) return cb(new ClientError('Invalid network'));
    if (!ischronik) {
      this._broadcastRawTx(opts.coin, opts.network, opts.rawTx, cb);
    } else {
      const coin = opts.coin;
      const chronikClient = ChainService.getChronikClient(coin);
      this._broadcastRawTxByChronik(chronikClient, opts.rawTx, async (err, txid) => {
        if (err || !txid) {
          logger.warn(`Broadcast failed: ${err}`);
        } else {
          const extraArgs = {};

          const data = _.assign(
            {
              txid,
              creatorId: this.copayerId ? this.copayerId : null,
              amount: null,
              message: null,
              tokenAddress: null,
              multisigContractAddress: null
            },
            extraArgs
          );
          this._notify('NewOutgoingTx', data, extraArgs);
          return cb(null, txid);
        }
      });
    }
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
   * @param {string} opts.signatures - The signatures of the inputs of this tx for this copayer (in appearance order)
   * @param {string} opts.maxTxpVersion - Client's maximum supported txp version
   * @param {boolean} opts.supportBchSchnorr - indication whether to use schnorr for signing tx
   */
  signTx(opts, cb) {
    if (!checkRequired(opts, ['txProposalId', 'signatures'], cb)) return;
    opts.maxTxpVersion = opts.maxTxpVersion || 3;

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      if (config.suspendedChains && config.suspendedChains.includes(wallet.coin)) {
        let Err = Errors.NETWORK_SUSPENDED;
        Err.message = Err.message.replace('$network', wallet.coin.toUpperCase());
        return cb(Err);
      }

      this.getTx(
        {
          txProposalId: opts.txProposalId
        },
        (err, txp) => {
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

  checkIsDonation(txp): boolean {
    const addressObjDonation = _.find(
      config.donationRemaining.donationToAddresses,
      (item: CoinDonationToAddress) => item.coin == txp.coin && item.network == txp.network
    );
    if (_.isEmpty(addressObjDonation)) return false;
    return txp.isDonation && txp.outputs[0].toAddress == addressObjDonation.address;
  }

  _sendLotusDonation(client, key, txDonation, cb) {
    this.createTx(txDonation, (err, txp) => {
      if (err) return cb(err);
      let proposalSignature;
      try {
        const t = commonBWC.Utils.buildTx(txp);
        const hash = t.uncheckedSerialize();
        proposalSignature = commonBWC.Utils.signMessage(hash, client.credentials.requestPrivKey);
      } catch (error) {
        return cb(error);
      }

      const optPublish = {
        proposalSignature,
        txProposalId: txp.id
      };
      this.publishTx(optPublish, (err, txp) => {
        if (err) return cb(err);
        let signatures;
        try {
          signatures = key.sign(client.getRootPath(), txp);
        } catch (error) {
          return cb(error);
        }

        const optSigh = {
          maxTxpVersion: 3,
          signatures,
          supportBchSchnorr: true,
          txProposalId: txp.id
        };
        this.signTx(optSigh, (err, txp) => {
          if (err) return cb(err);
          this.broadcastTx({ txProposalId: txp.id }, (err, txp) => {
            if (err) return cb(err);
            return cb(null, txp.txid);
          });
        });
      });
    });
  }
  _createOtpTxSwap(coinCode, addressUserReceive, amountTo) {
    const tx = {
      coin: coinCode,
      dryRun: false,
      excludeUnconfirmedUtxos: false,
      feeLevel: 'normal',
      isTokenSwap: null,
      message: null,
      outputs: [
        {
          amount: _.toSafeInteger(amountTo),
          message: null,
          toAddress: addressUserReceive
        }
      ],
      payProUrl: null,
      txpVersion: 3
    };
    return tx;
  }

  _sendSwap(client, key, txSwap, cb) {
    this.createTx(txSwap, (err, txp) => {
      if (err) return cb(err);
      let proposalSignature;
      try {
        const t = commonBWC.Utils.buildTx(txp);
        const hash = t.uncheckedSerialize();
        proposalSignature = commonBWC.Utils.signMessage(hash, client.credentials.requestPrivKey);
      } catch (error) {
        return cb(error);
      }

      const optPublish = {
        proposalSignature,
        txProposalId: txp.id,
        walletId: txSwap.walletId,
        copayerId: txSwap.copayerId
      };
      this.publishTx(optPublish, (err, txp) => {
        if (err) return cb(err);
        let signatures;
        try {
          signatures = key.sign(client.getRootPath(), txp);
        } catch (error) {
          return cb(error);
        }

        const optSigh = {
          maxTxpVersion: 3,
          signatures,
          supportBchSchnorr: true,
          txProposalId: txp.id
        };
        this.signTx(optSigh, (err, txp) => {
          if (err) return cb(err);
          this.broadcastTx({ txProposalId: txp.id }, (err, txp) => {
            if (err) return cb(err);
            return cb(null, txp.txid);
          });
        });
      });
    });
  }
  async sendSwapWithToken(mnemonic, clientsFund, opts, cb){
    const orderInfo = Order.create(opts);
    const clientFundSelectedToSendToUser = clientsFund.find(s => s.credentials.coin === 'xec');
    this.walletId = clientFundSelectedToSendToUser.credentials.walletId;
    this.copayerId = clientFundSelectedToSendToUser.credentials.copayerId;
    await this._sendSwapWithToken('xec',
    clientFundSelectedToSendToUser,
    mnemonic,
    orderInfo.toTokenId,
    null,
    orderInfo.amountFrom * orderInfo.createdRate,
    orderInfo.addressUserReceive,
    (err, result)=>{
      if(err) return cb(err)
      return cb(null, result);
    }
    )
  }
  async _sendSwapWithToken(coin, wallet, mnemonic, tokenId, token, TOKENQTY, etokenAddress, cb){
    try{
      const txId = await ChainService.sendToken(coin, wallet, mnemonic, tokenId, token, TOKENQTY, etokenAddress);
      return cb(null ,txId);
    } catch(e){
      return cb(e);
    }
  }

  _getKeyLotus(client, cb) {
    let key;
    const walletData = walletLotus;
    try {
      let imported = Client.upgradeCredentialsV1(walletData);
      client.fromString(JSON.stringify(imported.credentials));

      key = new Key({ seedType: 'object', seedData: imported.key });
    } catch (e) {
      try {
        client.fromObj(walletData.cred);
        key = new Key({ seedType: 'object', seedData: walletData.key });
      } catch (e) {
        return cb(e);
      }
    }
    return cb(null, client, key);
  }

  _getKeyFund(client, cb) {
    let key;
    try {
      let opts = { words: '' };
      opts.words = 'outer vast luggage make cat road match ecology flat gesture seed sight';
      client.serverAssistedImport
      // this.supportImport(opts, client, (err, key, walletClients) => {
      //   return cb(null, key, walletClients);
      // });
    } catch (e) {
      return cb(e);
    }
  }

  _getKeyFundWithMnemonic(client, cb) {
    let key;
    try {
      logger.debug("client: ", client);
      let opts = { words: '' };
      opts.words = 'final major brother expire hazard palace match stadium carpet tomato develop guess';
      // this.supportImport(opts, client, (err, key, walletClients) => {
      //   logger.debug('Inside function _getKeyFund: ', walletClients);
      //   return cb(null, key, walletClients, opts.words);
      // });
      Client.serverAssistedImport(opts,
        {
          baseUrl: client.request.baseUrl
        },  (err, key, walletClients) => {
            logger.debug('Inside function _getKeyFund: ', walletClients);
            return cb(null, key, walletClients, opts.words);
          })
    } catch (e) {
      return cb(e);
    }
  }

  _getKeyReceive(client, cb) {
    let key;
    try {
      let opts = { words: '' };
      opts.words = 'embark good rotate outside youth original razor know fantasy wool perfect reason';
      Client.serverAssistedImport(opts,
        {
          baseUrl: client.request.baseUrl
        },  (err, key, walletClients) => {
            return cb(null, key, walletClients, opts.words);
          })
    } catch (e) {
      return cb(e);
    }
  }

  // supportImport(opts, clientOpts, callback) {
  //   $.checkArgument(opts.words, 'provide opts.words');

  //   let copayerIdAlreadyTested = {};
  //   var checkCredentials = (key, opts, icb) => {
  //     let c = key.createCredentials(null, {
  //       coin: opts.coin,
  //       network: opts.network,
  //       account: opts.account,
  //       n: opts.n,
  //       isSlpToken: opts.isSlpToken
  //     });

  //     if (copayerIdAlreadyTested[c.copayerId + ':' + opts.n]) {
  //       // console.log('[api.js.2226] ALREADY T:', opts.n); // TODO
  //       return icb();
  //     } else {
  //       copayerIdAlreadyTested[c.copayerId + ':' + opts.n] = true;
  //     }

  //     let client = clientOpts;
  //     logger.debug('before open wallet');
  //     client.fromString(c);
  //     client.openWallet({}, (err, status) => {
  //       //        console.log(
  //       //          `PATH: ${c.rootPath} n: ${c.n}:`,
  //       //          err && err.message ? err.message : 'FOUND!'
  //       //        );

  //       // Exists
  //     logger.debug('inside open wallet');

  //       if (!err) {
  //         if (opts.coin == 'btc' && (status.wallet.addressType == 'P2WPKH' || status.wallet.addressType == 'P2WSH')) {
  //           client.credentials.addressType =
  //             status.wallet.n == 1 ? Constants.SCRIPT_TYPES.P2WPKH : Constants.SCRIPT_TYPES.P2WSH;
  //         }
  //         let clients = [client];
  //         // Eth wallet with tokens?
  //         const tokenAddresses = status.preferences.tokenAddresses;
  //         if (!_.isEmpty(tokenAddresses)) {
  //           _.each(tokenAddresses, t => {
  //             const token = Constants.TOKEN_OPTS[t];
  //             if (!token) {
  //               return;
  //             }
  //             const tokenCredentials = client.credentials.getTokenCredentials(token);
  //             let tokenClient = _.cloneDeep(client);
  //             tokenClient.credentials = tokenCredentials;
  //             clients.push(tokenClient);
  //           });
  //         }
  //         // Eth wallet with mulsig wallets?
  //         const multisigEthInfo = status.preferences.multisigEthInfo;
  //         if (!_.isEmpty(multisigEthInfo)) {
  //           _.each(multisigEthInfo, info => {
  //             const multisigEthCredentials = client.credentials.getMultisigEthCredentials({
  //               walletName: info.walletName,
  //               multisigContractAddress: info.multisigContractAddress,
  //               n: info.n,
  //               m: info.m
  //             });
  //             let multisigEthClient = _.cloneDeep(client);
  //             multisigEthClient.credentials = multisigEthCredentials;
  //             clients.push(multisigEthClient);
  //             const tokenAddresses = info.tokenAddresses;
  //             if (!_.isEmpty(tokenAddresses)) {
  //               _.each(tokenAddresses, t => {
  //                 const token = Constants.TOKEN_OPTS[t];
  //                 if (!token) {
  //                   return;
  //                 }
  //                 const tokenCredentials = multisigEthClient.credentials.getTokenCredentials(token);
  //                 let tokenClient = _.cloneDeep(multisigEthClient);
  //                 tokenClient.credentials = tokenCredentials;
  //                 clients.push(tokenClient);
  //               });
  //             }
  //           });
  //         }
  //         return icb(null, clients);
  //       }
  //       if (
  //         err.message === 'Copayer not found'
  //         // ||
  //         // err instanceof ErrorsImport.NOT_AUTHORIZED ||
  //         // err instanceof ErrorsImport.WALLET_DOES_NOT_EXIST)
  //       ) {
  //         return icb();
  //       }

  //       return icb(err);
  //     });
  //   };

  //   var checkKey = (key, cb) => {
  //     logger.debug('checking key');
  //     let opts = [
  //       // coin, network,  multisig
  //       ['btc', 'livenet'],
  //       ['bch', 'livenet'],
  //       ['eth', 'livenet'],
  //       ['eth', 'testnet'],
  //       ['xrp', 'livenet'],
  //       ['xrp', 'testnet'],
  //       ['doge', 'livenet'],
  //       ['doge', 'testnet'],
  //       ['xec', 'livenet'],
  //       ['xec', 'testnet'],
  //       ['xpi', 'livenet'],
  //       ['xpi', 'testnet'],
  //       ['ltc', 'testnet'],
  //       ['ltc', 'livenet'],
  //       ['btc', 'livenet', true],
  //       ['bch', 'livenet', true],
  //       ['xpi', 'livenet', true],
  //       ['xpi', 'livenet', false, true],
  //       ['xec', 'livenet', true],
  //       ['xec', 'livenet', false, true]
  //     ];
  //     if (key.use44forMultisig) {
  //       //  testing old multi sig
  //       opts = opts.filter(x => {
  //         return x[2];
  //       });
  //     }

  //     if (key.use0forBCH) {
  //       //  testing BCH, old coin=0 wallets
  //       opts = opts.filter(x => {
  //         return x[0] == 'bch';
  //       });
  //     }

  //     if (!key.nonCompliantDerivation) {
  //       // TESTNET
  //       let testnet = _.cloneDeep(opts);
  //       testnet.forEach(x => {
  //         x[1] = 'testnet';
  //       });
  //       opts = opts.concat(testnet);
  //     } else {
  //       //  leave only BTC, and no testnet
  //       opts = opts.filter(x => {
  //         return x[0] == 'btc';
  //       });
  //     }

  //     let clients = [];
  //     async.eachSeries(
  //       opts,
  //       (x, next) => {
  //         let optsObj = {
  //           coin: x[0],
  //           network: x[1],
  //           account: 0,
  //           n: x[2] ? 2 : 1,
  //           isSlpToken: x[3] ? x[3] : false
  //         };
  //         // console.log('[api.js.2287:optsObj:]',optsObj); // TODO
  //         // TODO OPTI: do not scan accounts if XX
  //         //
  //         // 1. check account 0
  //         checkCredentials(key, optsObj, (err, iclients) => {
  //           logger.debug('checking credentials: ', iclients);

  //           if (err) return next(err);
  //           if (_.isEmpty(iclients)) return next();
  //           clients = clients.concat(_.cloneDeep(iclients));

  //           // Accounts not allowed?
  //           if (key.use0forBCH || !key.compliantDerivation || key.use44forMultisig || key.BIP45) return next();
  //           logger.debug('checking key: ', key);

  //           // Now, lets scan all accounts for the found client
  //           let cont = true,
  //             account = 1;
  //           async.whilst(
  //             () => {
  //               return cont;
  //             },
  //             icb => {
  //               optsObj.account = account++;

  //               checkCredentials(key, optsObj, (err, iclients) => {
  //                 logger.debug('checking iclient: ', iclients);
  //                 if (err) return icb(err);
  //                 // we do not allow accounts nr gaps in BWS.
  //                 cont = !_.isEmpty(iclients);
  //                 if (cont) {
  //                   clients = clients.concat(iclients);
  //                 }
  //                 return icb();
  //               });
  //             },
  //             err => {
  //               return next(err);
  //             }
  //           );
  //         });
  //       },
  //       err => {
  //         if (err) return cb(err);
  //         return cb(null, clients);
  //       }
  //     );
  //   };

  //   let sets = [
  //     {
  //       // current wallets: /[44,48]/[0,145]'/
  //       nonCompliantDerivation: false,
  //       useLegacyCoinType: false,
  //       useLegacyPurpose: false
  //     },
  //     {
  //       // older bch wallets: /[44,48]/[0,0]'/
  //       nonCompliantDerivation: false,
  //       useLegacyCoinType: true,
  //       useLegacyPurpose: false
  //     },
  //     {
  //       // older BTC/BCH  multisig wallets: /[44]/[0,145]'/
  //       nonCompliantDerivation: false,
  //       useLegacyCoinType: false,
  //       useLegacyPurpose: true
  //     },
  //     {
  //       // not that // older multisig BCH wallets: /[44]/[0]'/
  //       nonCompliantDerivation: false,
  //       useLegacyCoinType: true,
  //       useLegacyPurpose: true
  //     },

  //     {
  //       // old BTC no-comp wallets: /44'/[0]'/
  //       nonCompliantDerivation: true,
  //       useLegacyPurpose: true
  //     }
  //   ];

  //   let s,
  //     resultingClients = [],
  //     k;
  //   async.whilst(
  //     () => {
  //       if (!_.isEmpty(resultingClients)) return false;

  //       s = sets.shift();
  //       if (!s) return false;

  //       try {
  //         if (opts.passphrase) {
  //           s.passphrase = opts.passphrase;
  //         }

  //         k = new Key({ seedData: opts.words, seedType: 'mnemonic', ...s });
  //       } catch (e) {
  //         return callback(new Errors.INVALID_BACKUP());
  //       }
  //       return true;
  //     },
  //     icb => {
  //       checkKey(k, (err, clients) => {
  //         logger.debug('checking client: ', clients);
  //         if (err) return icb(err);

  //         if (clients && clients.length) {
  //           resultingClients = clients;
  //         }
  //         return icb();
  //       });
  //     },
  //     err => {
  //       if (err) return callback(err);

  //       if (_.isEmpty(resultingClients)) k = null;
  //       return callback(null, k, resultingClients);
  //     }
  //   );
  // }

  getWalletLotusDonation(cb) {
    this.copayerId = _.get(walletLotus, 'cred.copayerId', '');
    this.walletId = _.get(walletLotus, 'cred.walletId', '');
    const clientBwc = new Client();
    this._getKeyLotus(clientBwc, (err, client, key) => {
      if (err) return cb(err);
      this.createAddress({}, function(err, x) {
        if (err) return cb(err);
        return cb(null, client, key, x.address);
      });
    });
  }

  getKeyFund(cb) {
    const clientBwc = new Client();
    this._getKeyFund(clientBwc, (err, key, clients) => {
      logger.debug('function _getKeyFund: ', clients);
      if (err) return cb(err);
      return cb(null, key, clients);
    });
  }

  getKeyFundAndReceiveWithFundMnemonic(cb) {
    const clientBwc = new Client();
    this._getKeyFundWithMnemonic(clientBwc, (err, keyFund, clientsFund, mnemonic) => {
      if (err) return cb(err);
      this._getKeyReceive(clientBwc, (err, keyReceive, clientsReceive) => {
        if (err) return cb(err);
        return cb(null, keyFund, clientsFund, clientsReceive, mnemonic);
      })
    });
  }

  getKeyReceive(cb) {
    const clientBwc = new Client();
    this._getKeyReceive(clientBwc, (err, key, clients) => {
      if (err) return cb(err);
      return cb(null, key, clients);
    });
  }

  _createOtpTxDonation(addressDonation, receiveLotusAddress, receiveAmountLotus) {
    const tx = {
      coin: 'xpi',
      dryRun: false,
      excludeUnconfirmedUtxos: false,
      feeLevel: 'normal',
      from: addressDonation,
      isTokenSwap: null,
      message: null,
      outputs: [
        {
          amount: receiveAmountLotus,
          message: null,
          toAddress: receiveLotusAddress
        }
      ],
      payProUrl: null,
      txpVersion: 3
    };
    return tx;
  }

  checkQueueHandleSendLotus(client, key, addressDonation, isWalletLotusDonation) {
    setInterval(() => {
      if (this.storage && this.storage.queue) {
        this.storage.queue.get((err, data) => {
          if (data) {
            const ackQueue = this.storage.queue.ack(data.ack, (err, id) => {});
            const saveError = (donationStorage, err) => {
              donationStorage.error = JSON.stringify(err);
              this.storage.updateDonation(donationStorage, err => {
                return ackQueue;
              });
            };
            const donationStorage: DonationStorage = data.payload;
            this.storage.storeDonation(donationStorage, err => {
              if (!isWalletLotusDonation) return saveError(donationStorage, 'Lotus Donation not exist Wallet AWS');
              if (err) return saveError(donationStorage, err);
              this.getRemainingInfo({}, (err, remainingData: DonationInfo) => {
                if (err) return saveError(donationStorage, err);
                if (remainingData.remaining < 0) saveError(donationStorage, 'RemainingLotus is over today');
                const txDonation = this._createOtpTxDonation(
                  addressDonation,
                  donationStorage.receiveLotusAddress,
                  remainingData.receiveAmountLotus
                );
                this._sendLotusDonation(client, key, txDonation, (err, txid) => {
                  if (err) return saveError(donationStorage, err);
                  donationStorage.txidGiveLotus = txid;
                  donationStorage.isGiven = true;
                  this.storage.updateDonation(donationStorage, err => {
                    return ackQueue;
                  });
                });
              });
            });
          }
        });
        this.storage.queue.clean(err => {});
      }
    }, 300000);
  }

  checkQueueHandleSwap(key, clientsFund, clientsReceive, mnemonic ) {
    // this.getKeyFund((err, key, clientsFund) => {
      // if(err) return cb(err);
      setInterval(() => {
        if (this.storage && this.storage.orderQueue) {
          this.storage.orderQueue.get(async (err, data) => {
            console.log('orderinfo created: ', data);
            const saveError = (orderInfo, data, err) => {
              orderInfo.status = 'pending';
              if(err.message){
                orderInfo.error = err.message;
              } else{
                orderInfo.error = JSON.stringify(err);
              }
              this.storage.updateOrder(orderInfo, err => {
                return this.storage.orderQueue.ack(data.ack, (err, id) => {})
              });
            };

            if (data) {
              const orderInfo: Order = data.payload;
              try{
                console.log('orderinfo in queue detected: ', data);
                // const ackQueue = (data) => this.storage.orderQueue.ack(data.ack, (err, id) => {});
                const configSwap : ConfigSwap = await this.getConfigSwapWithPromise(clientsFund);
                const isValidOrder = await this.checkRequiremenBeforeQueueExcetue(configSwap, orderInfo);
                  if (isValidOrder && orderInfo.status === 'waiting') {
                    // get utxos for deposit address => checking amount user sent to deposit address
                    this.getUtxosForSelectedAddressAndWallet(
                      {
                        coin: orderInfo.isFromToken ? 'xec' :  orderInfo.fromCoinCode,
                        network: 'livenet',
                        addresses: orderInfo.isFromToken ? [this._convertEtokenAddressToEcashAddress(orderInfo.adddressUserDeposit)] : [orderInfo.adddressUserDeposit],
                        isTokenSupport: orderInfo.isFromToken,
                        tokenId: orderInfo.fromTokenId
                      },
                      (err, utxos) => {
                        let amountDepositDetect = 0;
                        if (utxos.length > 0) {
                          _.each(utxos, utxo => {
                            if(orderInfo.isFromToken){
                              amountDepositDetect += utxo.amountToken
                            } else{
                              amountDepositDetect += utxo.satoshis;
                            }
                            orderInfo.txIdUserDeposit = utxo.txid;
                          });
                        }
                        if (amountDepositDetect > 0) {
                          if (amountDepositDetect > orderInfo.amountFrom) {
                            orderInfo.amountUserDeposit = amountDepositDetect;
                            throw new Error('Amount deposit detect is greater than amount from');
                          } else {
                            const coinCode = orderInfo.isToToken ? 'xec' : orderInfo.toCoinCode;
                            const fundingWallet = clientsFund.find(s => s.credentials.coin === coinCode );
                            // checking rate again before creating tx
                            this.getCurrentRate(orderInfo, async (err, rate) => {
                              orderInfo.updatedRate = rate;
                              // calculate updated rate compare with created rate , if more than 20% (later dynamic) , suspend transaction
                              if ((Math.abs(rate - orderInfo.createdRate) / orderInfo.createdRate) * 100 > 20) {
                               throw new Error('Order rate is not stable');
                              } else {
                                this.walletId = fundingWallet.credentials.walletId;
                                this.copayerId = fundingWallet.credentials.copayerId;
                                if(orderInfo.isToToken){
                                  await this._sendSwapWithToken('xec', fundingWallet, mnemonic, orderInfo.toTokenId, null,  (amountDepositDetect / orderInfo.fromSatUnit) * orderInfo.toSatUnit * rate, orderInfo.addressUserReceive, (err, txId) => {
                                    orderInfo.status = 'success';
                                    orderInfo.txIdUserReceive = txId;
                                    orderInfo.isSentToUser = true;
                                    this.storage.updateOrder(orderInfo, (err, result) => {
                                      this.storage.orderQueue.ack(data.ack, (err, id) => {});
                                    });
                                  })
                                } else{
                                  const txOptsSwap = this._createOtpTxSwap(
                                    orderInfo.isToToken ? 'xec' : orderInfo.toCoinCode,
                                    orderInfo.addressUserReceive,
                                    (amountDepositDetect / orderInfo.fromSatUnit) * orderInfo.toSatUnit * rate
                                  );
                                  this._sendSwap(fundingWallet, key, txOptsSwap, (err, txId) => {
                                    if(err) saveError(orderInfo, data, err);
                                    else{
                                      orderInfo.status = 'success';
                                      // orderInfo.amountSentToUser = orderInfo.amountFrom * rate;
                                      orderInfo.txIdUserReceive = txId;
                                      orderInfo.isSentToUser = true;
                                      this.storage.updateOrder(orderInfo, (err, result) => {
                                        if(err) saveError(orderInfo, data, err);
                                        else{
                                          this.storage.orderQueue.ack(data.ack, (err, id) => {});
                                        }
                                      });
                                    }
                                   
                                  });
                                }
                              }
                            });
                          }
                        }
                      }
                    );
                  }
                  else if (orderInfo.status === 'pending') {
                    return this.storage.orderQueue.ack(data.ack, (err, id) => {})
                  }
              }
              catch(e){
                saveError(orderInfo, data, e);
              }

            }
          });
          this.storage.queue.clean(err => {});
        }
      }, 2000);
  // });

  }

  checkRequireInfoForOrderInfo(configSwap: ConfigSwap, orderInfo: Order){
    
  }

  async checkRequiremenBeforeQueueExcetue(configSwap: ConfigSwap, orderInfo: Order){
    let listCoinReceiveCode = [];
    let convertedListTokenReceiveFound = [];
    let listCoinSwapCode = [];
    let convertedListTokenSwapFound = [];
    const availabeCoinSupportExchange = ['xec', 'bch', 'xpi'];
    const availabeTokenSupportExchange = ['abcslp', 'eat', 'bcpro'];
    let isValidOrder = false;
    if(orderInfo){
      if(!(orderInfo.fromCoinCode
        && orderInfo.toCoinCode
        && orderInfo.createdRate
        && orderInfo.addressUserReceive)){
          throw new Error('missing requiremnet field in order info');
      }

      // if (!checkRequired(orderInfo, ['fromCoinCode', 'amountFrom'])) {
      //   throw new Error('adId is missing');
      // }

      if(typeof(orderInfo.amountFrom) !== 'number' || orderInfo.amountFrom === 0){
        throw new Error('Amount deposit must be greater than 0');
      }

      if(orderInfo.isFromToken && ( !orderInfo.fromTokenId || !(orderInfo.fromTokenInfo && orderInfo.fromTokenInfo.decimals))){
        throw new Error('Missing token info from');
      }

      if(orderInfo.isToToken && (!orderInfo.toTokenId || !(orderInfo.toTokenInfo && orderInfo.toTokenInfo.decimals))){
        throw new Error('Missing token info to');
      }

      
     
    }


    if(configSwap){

      // checking required coin , token for receive 
      const listCoinReceive = configSwap.coinReceive.filter(config => config.isEnable);
      if(listCoinReceive && listCoinReceive.length > 0){
        listCoinReceiveCode = listCoinReceive.map(item => item.code.toLowerCase());
      }
      // const supportReceiveToken = configSwap.coinReceive.find(config => config.isToken);
      // if(supportReceiveToken){
      //   const walletXECFound = clientsFund.find(client => client.credentials.coin.toLowerCase() === 'xec');
      //   let listTokenReceiveFound = null;
      //   listTokenReceiveFound = await this.getTokensWithPromise({walletId: walletXECFound.credentials.walletId});
      //   if(listTokenReceiveFound && listTokenReceiveFound.length > 0){
      //     convertedListTokenReceiveFound = _.map(listTokenReceiveFound, item => item.tokenInfo.symbol.toLowerCase());
      //   }
      // }
      // const coinAndTokenReceiveSupport = listCoinReceiveCode.concat(convertedListTokenReceiveFound);
      if(!listCoinReceiveCode.includes(orderInfo.toCoinCode)){
        throw new Error('Not found this receive coin or token on server');
      }

      const listCoinSwap = configSwap.coinReceive.filter(config => config.isEnable);
      if(listCoinSwap && listCoinSwap.length > 0){
        listCoinSwapCode = listCoinSwap.map(item => item.code.toLowerCase());
      }
      // const supportSwapToken = configSwap.coinSwap.find(config => config.isToken);
      // if(supportSwapToken){
      //   const walletXECFound = clientsFund.find(client => client.credentials.coin.toLowerCase() === 'xec');
      //   let listTokenSwapFound = null;
      //   let convertedListTokenReceiveFound = [];
      //   listTokenSwapFound = await this.getTokensWithPromise({walletId: walletXECFound.credentials.walletId});
      //   if(listTokenSwapFound && listTokenSwapFound.length > 0){
      //     convertedListTokenSwapFound = _.map(listTokenSwapFound, item => item.tokenInfo.symbol.toLowerCase());
      //   }
      // }
      // const coinAndTokenSwapSupport = listCoinSwapCode.concat(convertedListTokenSwapFound);
      if(!listCoinSwapCode.includes(orderInfo.fromCoinCode)){
        throw new Error('Not found this swap coin or token on server');
      }
      if(typeof(orderInfo.fromSatUnit) !== 'number' || orderInfo.fromSatUnit === 0){
        if(orderInfo.isFromToken){
          orderInfo.fromSatUnit = Math.pow(10, orderInfo.fromTokenInfo.decimals);
        } else{
          orderInfo.fromSatUnit = UNITS[orderInfo.fromCoinCode.toLowerCase()].toSatoshis;
        }
      } 

      if(typeof(orderInfo.toSatUnit) !== 'number' || orderInfo.toSatUnit === 0){
        if(orderInfo.isToToken){
          orderInfo.toSatUnit = Math.pow(10, orderInfo.toTokenInfo.decimals);
        } else{
          orderInfo.toSatUnit = UNITS[orderInfo.toCoinCode.toLowerCase()].toSatoshis;
        }
      }

      const coinReceiveSelected = configSwap.coinReceive.find(coin => coin.code.toLowerCase() === orderInfo.toCoinCode.toLowerCase());
      if(coinReceiveSelected){
        // checking balance
        if( coinReceiveSelected.max && coinReceiveSelected.maxConvertToSat ) {
          if(coinReceiveSelected.max > 0 && coinReceiveSelected.max > coinReceiveSelected.min && orderInfo.amountFrom && orderInfo.amountFrom > 0){
            const balanceOfOrder = orderInfo.amountFrom / orderInfo.fromSatUnit * orderInfo.toSatUnit * ( (orderInfo.updatedRate && orderInfo.updatedRate > 0) ? orderInfo.updatedRate : orderInfo.createdRate );
            if( coinReceiveSelected.maxConvertToSat > balanceOfOrder ){
              if(balanceOfOrder > coinReceiveSelected.min){
                isValidOrder = true;
              }
              else{
                // handle error if balance order < min of coin config
                throw new Error('Order is less than min coin config')
              }
            } else{
              // handle error case if coin receive selected max <= balance of order ( not enough fund )
             throw new Error('Fund not enough');
            }
          } else{
            // handle error case if coin max < coin min
            throw new Error('Fund not enough');
          }
        } else{
          // handle error case if we don't have coin max , or coin max convert to Satoshis
          throw new Error('Can not calculate funding');
        }
      } else{
        // handle error case if we don't have coin receive config
        throw new Error('Can not find config for receive config');
      }
    } else{
      // handle error case if we don't have config swap
      throw new Error('Can not find config for swap');
    }
    return isValidOrder;
  }
  

  confirmationAndBroadcastRawTx(wallet, txp, sub, cb) {
    this.storage.storeTxConfirmationSub(sub, err => {
      if (err) logger.error('Could not store Tx confirmation subscription: ', err);

      let raw;
      try {
        raw = txp.getRawTx();
      } catch (ex) {
        return cb(ex);
      }
      this._broadcastRawTx(wallet.coin, wallet.network, raw, (err, txid) => {
        if (err || txid != txp.txid) {
          if (!err || txp.txid != txid) {
            logger.warn(`Broadcast failed for: ${raw}`);
          } else {
            logger.warn(`Broadcast failed: ${err}`);
          }

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

  convertCoinToUSD(amount, coin, cp) {
    this.getFiatRates({}, (err, rates) => {
      if (err) return err;
      let unitToSatoshi = 100000000;
      if (coin === 'xpi') {
        unitToSatoshi = 1000000;
      } else if (coin === 'xec') {
        unitToSatoshi = 100;
      }
      const rateCoin = _.find(rates[coin], item => item.code == 'USD');
      if (_.isEmpty(rateCoin || rateCoin.rate)) return cp('no rate');
      const amountUSD = amount * (1 / unitToSatoshi) * rateCoin.rate;
      return cp(null, amountUSD);
    });
  }

  convertUSDToSatoshiLotus(amountUSD, coin, cp) {
    const option = {
      coin,
      code: 'USD'
    };
    this.getFiatRatesByCoin(option, (err, rate) => {
      let satoshiLotus = 0;
      if (err) return cp(satoshiLotus);
      const rateCoin = rate[0].rate ? rate[0].rate : rate.rate;
      if (rateCoin == 0 || !rateCoin) return cp(satoshiLotus);
      const amoutLotus = _.toNumber(((1.1 * amountUSD) / rateCoin).toFixed(2)); // bonus 10% xpi;
      satoshiLotus = amoutLotus * 1e6;
      return cp(satoshiLotus);
    });
  }

  checkAmoutToSendLostus(txp, cb) {
    this.convertCoinToUSD(txp.outputs[0].amount, txp.coin, (err, amountUsd) => {
      if (err) return cb(err);
      if (amountUsd + amountUsd * 0.1 < config.donationRemaining.minMoneydonation)
        return cb('not enough money donation to receive lotus');
      this.getRemainingInfo({}, (err, remainingData: DonationInfo) => {
        if (err) return cb(err);
        if (remainingData.remaining < remainingData.receiveAmountLotus) return cb('not enough Lotus to give');
        return cb(null, true);
      });
    });
  }

  getCurrentRate(orderInfo: Order, cb) {
    // checking rate again before sending txp
    this._getRatesWithCustomFormat((err, rateList) => {
      const rate = rateList[orderInfo.fromCoinCode].USD / rateList[orderInfo.toCoinCode].USD;
      return cb(null, rate);
    });
  }

  _getRatesWithCustomFormat(cb) {
    let rateList = [];
    // for (const coin of this.currencyProvider.getAvailableCoins()) {
    //   rateList[coin.toLowerCase()] = { USD: 0 };
    // }
    this.getFiatRates({}, (err, fiatRates) => {
      try {
        _.map(fiatRates, (rates, coin) => {
          const coinRates = {};
          _.each(rates, r => {
            const rate = { [r.code]: r.rate };
            Object.assign(coinRates, rate);
          });
          rateList[coin.toLowerCase()] = !_.isEmpty(coinRates) ? coinRates : { USD: 0 };
        });
        return cb(null, rateList);
      } catch (error) {
        return cb(error);
      }
    });
  }

  async createOrder(clientsFund, clientsReceive, opts, cb) {
    try{
      if(!clientsFund){
        throw new Error('Not found funding');
      }
      if(!clientsReceive){
        throw new Error('Not found funding');
      }
      const orderInfo = Order.create(opts);
      const fromCoinCode = orderInfo.isFromToken ? 'xec' : orderInfo.fromCoinCode;
      const configSwap = await this.getConfigSwapWithPromise(clientsFund);
      const isValidOrder = await this.checkRequiremenBeforeQueueExcetue(configSwap, orderInfo);
      if(isValidOrder === true){
        const depositClient = clientsReceive.find(client => client.credentials.coin === fromCoinCode);
        this.walletId = depositClient.credentials.walletId;
        const coinConfigSelected = configSwap.coinReceive.find(coin => coin.code.toLowerCase() === orderInfo.toCoinCode.toLowerCase());
        this.createAddress({ ignoreMaxGap: true }, (err, address) => {
          if (err) return cb(err);
          if(orderInfo.isFromToken){
            address = this._convertAddressToEtoken(address.address);
            // const slpAddress = bchjs.HDNode.toSLPAddress(change);
          } else {
            address = address.address;
          }
      
          orderInfo.adddressUserDeposit = address;
          this.storage.storeOrderInfo(orderInfo, (err, result) => {
            if (err) return cb(err);
            // let order into queue
            this.storage.orderQueue.add(Order.fromObj(result.ops[0]), (err, id) => {
              if (err) return cb(err);
              const orderCreated = Order.fromObj(result.ops[0]);
              orderCreated.coinConfig = coinConfigSelected;
              return cb(null, orderCreated);
            });
          });
        });
      }
    } catch(e){
      return cb(e);
    }
  }

  _convertAddressToEtoken(address) {
    try {
      const protocolPrefix = { livenet: 'ecash', testnet: 'ectest' };
      const protoXEC = protocolPrefix.livenet; // only support livenet
      const protoAddr: string = protoXEC + ':' + address;
      const { prefix, type, hash } = ecashaddr.decode(protoAddr);
      const cashAddress = ecashaddr.encode('etoken', type, hash);
      return cashAddress;
    } catch {
      return '';
    }
  }

  _convertEtokenAddressToEcashAddress(address) {
    try {
      // const protocolPrefix = { livenet: 'ecash', testnet: 'ectest' };
      // const protoXEC = protocolPrefix.livenet; // only support livenet
      // const protoAddr: string = protoXEC + ':' + address;
      const { prefix, type, hash } = ecashaddr.decode(address);
      const addressConverted = ecashaddr.encode('ecash', type, hash);
      return addressConverted;
    } catch {
      return '';
    }
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

      if (config.suspendedChains && config.suspendedChains.includes(wallet.coin)) {
        let Err = Errors.NETWORK_SUSPENDED;
        Err.message = Err.message.replace('$network', wallet.coin.toUpperCase());
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
          if (this.checkIsDonation(txp)) {
            this.checkAmoutToSendLostus(txp, (err, isSend) => {
              if (err) return cb(err);
              this.confirmationAndBroadcastRawTx(wallet, txp, sub, (err, txp) => {
                if (err) return cb(err);
                const donationStorage: DonationStorage = {
                  txidDonation: txp.txid,
                  amount: txp.outputs[0].amount,
                  isGiven: false,
                  walletId: txp.walletId,
                  receiveLotusAddress: txp.receiveLotusAddress || undefined,
                  txidGiveLotus: txp.txidGiveLotus || undefined,
                  addressDonation: txp.from,
                  createdOn: Date.now()
                };
                this.storage.queue.add(donationStorage, (err, id) => {
                  if (err) return cb(err);
                  return cb(null, txp);
                });
              });
            });
          } else {
            this.confirmationAndBroadcastRawTx(wallet, txp, sub, cb);
          }
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

            if (txps[0] && txps[0].coin == 'bch') {
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
        [`${wallet.coin}:${wallet.network}`, this.walletId],
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
  _convertAddressFormInputScript(script: string, coin: string, isToken?: boolean) {
    let address: string;
    const scriptBitcore = Bitcore_[coin].Script(script);
    const { hashBuffer, type } = scriptBitcore.getAddressInfo();
    if (!hashBuffer || !type) return address;
    switch (coin) {
      case 'xpi':
        address = Bitcore_[coin].Address(hashBuffer).toXAddress();
        break;
      case 'xec':
        const addressBitcore = Bitcore_[coin].Address(hashBuffer);
        if (isToken) {
          address = addressBitcore.encode('etoken', type, hashBuffer);
        } else {
          address = addressBitcore.encode('ecash', type, hashBuffer);
        }
        break;
      default:
        address = Bitcore_[coin].Address(hashBuffer).toCashAddress();
        break;
    }
    return address;
  }

  _normalizeTxHistory(walletId, txs: any[], dustThreshold, bcHeight, includeImmatureStatus, wallet, cb) {
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
            coinbase: tx.coinbase,
            inputAddresses: _.uniq(
              _.map(tx.inputs, item => {
                return this._convertAddressFormInputScript(item.script, wallet.coin, wallet.isSlpToken);
              })
            )
          };
          switch (tx.category) {
            case 'send':
              ret.action = 'sent';
              ret.amount = Math.abs(_.sumBy(tx.outputs, 'amount')) || Math.abs(tx.satoshis);
              ret.addressTo = tx.outputs ? tx.outputs[0].address : null;
              ret.outputs = tx.outputs;
              break;
            case 'receive':
              let action = 'received';
              if (tx.coinbase && includeImmatureStatus) {
                action = c >= Defaults.COINBASE_MATURITY ? 'mined' : 'immature';
              }
              ret.action = action;
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

  _getBlockchainHeight(coin, network, cb) {
    const cacheKey = Storage.BCHEIGHT_KEY + ':' + coin + ':' + network;

    this.storage.checkAndUseGlobalCache(cacheKey, Defaults.BLOCKHEIGHT_CACHE_TIME, (err, values) => {
      if (err) return cb(err);

      if (values) return cb(null, values.current, values.hash, true);

      values = {};

      const bc = this._getBlockchainExplorer(coin, network);
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
    const bc = this._getBlockchainExplorer(wallet.coin, wallet.network);

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
            logger.warn('ERROR: Wallet check failed:', localCheck, serverCheck);
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
    const bc = this._getBlockchainExplorer(wallet.coin, wallet.network);
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
              ChainService.addressFromStorageTransform(wallet.coin, wallet.network, x);
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
            _.each(unconfirmed, tx => {
              tx.lowFees = tx.feePerKb < minFeePerKb;
            });
          }
        }
        return cb();
      }
    );
  }

  async getlastTxsByChronik(wallet, address, limit) {
    let scriptPayload;
    let totalTxs;
    try {
      const chronikClient = ChainService.getChronikClient(wallet.coin);
      scriptPayload = ChainService.convertAddressToScriptPayload(wallet.coin, address);
      const txHistoryPage = await chronikClient.script('p2pkh', scriptPayload).history(0, limit);
      return txHistoryPage.txs;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  updateStatusSlpTxs(inTxs, lastTxsChronik, wallet) {
    const validTxs = [];
    _.forEach(inTxs, item => {
      const txsSlp = _.find(lastTxsChronik, itemTxsChronik => itemTxsChronik.txid == item.txid);
      if (txsSlp && txsSlp.slpTxData && txsSlp.slpTxData.slpMeta) {
        item.isSlpToken = true;
        item.tokenId = txsSlp.slpTxData.slpMeta.tokenId;
        item.tokenType = txsSlp.slpTxData.slpMeta.tokenType;
        item.txType = txsSlp.slpTxData.slpMeta.txType;
        item.inputAddresses = _.uniq(
          _.map(txsSlp.inputs, item => {
            return this._convertAddressFormInputScript(item.inputScript, wallet.coin, true);
          })
        );
        item.amountTokenUnit =
          txsSlp.outputs[1].slpToken && txsSlp.outputs[1].slpToken.amount
            ? txsSlp.outputs[1].slpToken.amount.toNumber()
            : undefined;
      }
      validTxs.push(item);
    });
    return validTxs;
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
    let addressesToken;
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
          this._getBlockchainHeight(wallet.coin, wallet.network, (err, height, hash) => {
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

          logger.debug('Checking streamKey/skip', streamKey, skip);
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
          if (this._isSupportToken(wallet)) {
            this.storage.fetchAddresses(this.walletId, (err, addresses) => {
              if (err) return cb(err);
              if (_.size(addresses) < 1 || !addresses[0].address)
                return cb('no addresss to get history by chronikClient ');
              addressesToken = addresses;
              return next();
            });
          } else {
            return next();
          }
        },
        next => {
          if (streamData) {
            lastTxs = streamData;
            return next();
          }

          const startBlock = cacheStatus.updatedHeight || 0;
          logger.debug(' ########### GET HISTORY v8 startBlock/bcH]', startBlock, bcHeight); // TODO

          bc.getTransactions(wallet, startBlock, (err, txs) => {
            if (err) return cb(err);
            const dustThreshold = ChainService.getDustAmountValue(wallet.coin);
            this._normalizeTxHistory(
              walletCacheKey,
              txs,
              dustThreshold,
              bcHeight,
              opts.includeImmatureStatus,
              wallet,
              async (err, inTxs: any[]) => {
                if (err) return cb(err);
                if (this._isSupportToken(wallet) && addressesToken && _.size(inTxs) > 0) {
                  try {
                    let promiseList = [];
                    _.each(addressesToken, address => {
                      promiseList.push(
                        this.getlastTxsByChronik(wallet, address.address, _.size(inTxs) > 200 ? 200 : _.size(inTxs))
                      );
                    });
                    await Promise.all(promiseList).then(async lastTxsChronik => {
                      lastTxsChronik = lastTxsChronik.reduce((accumulator, value) => accumulator.concat(value), []);
                      if (lastTxsChronik.length > 0) {
                        inTxs = this.updateStatusSlpTxs(_.cloneDeep(inTxs), lastTxsChronik, wallet);
                      }
                    });
                  } catch (err) {
                    return cb(err);
                  }
                }

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
              }
            );
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
              if (x.action == 'immature' && x.confirmations >= Defaults.COINBASE_MATURITY) {
                x.action = 'mined';
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
          txsToCache = _.filter(lastTxs, i => {
            if (i.confirmations < Defaults.CONFIRMATIONS_TO_START_CACHING) {
              return false;
            }
            if (!cacheStatus.tipHeight) return true;

            return i.blockheight > cacheStatus.tipHeight;
          });

          logger.debug(`Found ${lastTxs.length} new txs. Caching ${txsToCache.length}`);
          if (!txsToCache.length) {
            return next();
          }

          const updateHeight = bcHeight - Defaults.CONFIRMATIONS_TO_START_CACHING;
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

      bc = this._getBlockchainExplorer(wallet.coin, wallet.network);
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
        // non UTXO coins do not scan.
        if (!ChainService.isUTXOCoin(wallet.coin)) return cb();

        this._runLocked(cb, cb => {
          wallet.scanStatus = 'running';
          this.storage.storeWallet(wallet, err => {
            if (err) return cb(err);

            const bc = this._getBlockchainExplorer(wallet.coin, wallet.network);
            if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
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
      error => {
        this.storage.fetchWallet(wallet.id, (err, wallet) => {
          if (err) return cb(err);
          wallet.scanStatus = error ? 'error' : 'success';
          this.storage.storeWallet(wallet, err => {
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

      // non UTXO coins do not scan.
      if (!ChainService.isUTXOCoin(wallet.coin)) return cb();

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
   * Returns swap configetOrderInfog.
   */
   async getConfigSwap(clientsFund, cb) {
    await fs.readFile(appDir + '/admin-config.json', 'utf8', (error, data) => {
      if (error) {
        console.log(error);
        return;
      }
      const swapConfig = JSON.parse(data);
      const listCoin = swapConfig.coinSwap.concat(swapConfig.coinReceive);
      let promiseList = [];
      let promiseList2 = [];
      // const clientFundsSelected = clientsFund.find(client => client.credentials.coin === (coin.isToken ? 'xec' : coin.code));
      let isFundClientXecFound = false;
      let balanceTokenFound = null;
      clientsFund.forEach(async clientFund => {
        if(clientFund.credentials.coin === 'xec'){
          isFundClientXecFound = true;
        }
        promiseList2.push(this.getBalanceWithPromise({walletId: clientFund.credentials.walletId, coinCode: clientFund.credentials.coin}));
        if(isFundClientXecFound && swapConfig.coinSwap.find(s => s.isToken === true)){
          balanceTokenFound = await this.getTokensWithPromise({walletId: clientFund.credentials.walletId});
        }
        isFundClientXecFound = false;
      });
      Promise.all(promiseList2).then(balance => {
        logger.debug('balance: ', balance);
        const listBalanceTokenConverted = _.map(balanceTokenFound, item => {
          return {
            tokenId :item.tokenId,
            tokenInfo: item.tokenInfo,
            amountToken: item.amountToken,
            utxoToken: item.utxoToken
          } as TokenItem
        })
        logger.debug('listBalanceTokenConverted: ',listBalanceTokenConverted);
        this.getAllTokenInfo((err, tokenInfoList : TokenInfo[]) => {
          this._getRatesWithCustomFormat((err, fiatRates) => {
            try{

              for (var i = 0; i < listCoin.length; i++) {
                const coin = listCoin[i];
                const coinQuantityFromUSDMin = coin.min * fiatRates[coin.code.toLowerCase()].USD;
                const rateCoinUsd =  fiatRates[coin.code.toLowerCase()].USD;
                const maxWeightBalanceOfFund = 0.8;
                if(coin.isToken){
                  const balanceSelected = listBalanceTokenConverted.find( s=> s.tokenInfo.symbol.toLowerCase() === coin.code.toLowerCase());
                  const tokenDecimals = tokenInfoList.find(s => s.symbol.toLowerCase() === coin.code.toLowerCase()).decimals;
                  coin.minConvertToSat = coin.min * Math.pow(10, tokenDecimals);
                  coin.max = maxWeightBalanceOfFund * balanceSelected.amountToken * rateCoinUsd;
                  coin.maxConvertToSat = ( maxWeightBalanceOfFund * balanceSelected.amountToken ) * Math.pow(10, tokenDecimals);
                  coin.tokenInfo = balanceSelected.tokenInfo;
                }else{
                  const balanceSelected = balance.find( s => s.coin.toLowerCase() === coin.code.toLowerCase()).balance.totalAmount;
                  coin.minConvertToSat = coinQuantityFromUSDMin * UNITS[coin.code.toLowerCase()].toSatoshis;
                  coin.max = ( balanceSelected / UNITS[coin.code.toLowerCase()].toSatoshis) * rateCoinUsd * maxWeightBalanceOfFund;
                  coin.maxConvertToSat = balanceSelected * maxWeightBalanceOfFund;
                }
                coin.rate = fiatRates[coin.code.toLowerCase()];
                promiseList.push(this.getFee(coin, { feeLevel: 'normal' }));
              }
              Promise.all(promiseList).then(listData => {
                listData.forEach((data: any) => {
                  const coin = data.coin;
                  const feePerKb = data.feePerKb;
                  let estimatedFee;
                  if (coin.isToken || coin.code === 'xec') {
                    // Send dust transaction representing tokens being sent.
                    const dustRepresenting = 546;
                    //  Return any token change back to the sender.
                    const dustReturnAnyToken = 546;
                    // fee
                    const fee = 250;

                    estimatedFee = dustRepresenting + dustReturnAnyToken + fee;
                  } else {
                    const baseTxpSize = 78;
                    const baseTxpFee = (baseTxpSize * feePerKb) / 1000;
                    const sizePerInput = 148;
                    const feePerInput = (sizePerInput * feePerKb) / 1000;
                    estimatedFee = Math.round(baseTxpFee + feePerInput);
                  }
                  coin.networkFee = estimatedFee;
                });
                return cb(null, swapConfig);
              });

            }catch(e){
                logger.debug(e);
            }

          })
        })
       }).catch(e =>{
         logger.debug(e);
       });

    });
  }

  getConfigSwapWithPromise(clientsFund) : Promise<ConfigSwap>{
    return new Promise((resolve, reject) => {
      this.getConfigSwap(clientsFund, (err, configSwap)=>{
        if(err) return reject(err);
        return resolve(ConfigSwap.fromObj(configSwap));
      })
    })
  }x

  getBalanceForClientsFund(opts){
    return new Promise((resolve, reject) => {
      this.getBalanceWithPromise
    })
  }


   /**
   * Returns exchange rates of the supported fiat currencies for the specified coin.
   * @param {Object} opts
   * @param {String} opts.id - The order info id requested.
   * @returns {Array} rates - The exchange rate.
   */
  getOrderInfo(opts, cb){
    this.storage.fetchOrderinfoById(opts.id, (err, result)=>{
      if(err) return cb(err);

      return cb(null, Order.fromObj(result));
    })
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

  getServicesData(cb) {
    const data = config.services ?? {};
    return cb(null, data);
  }

  simplexGetKeys(req) {
    if (!config.simplex) throw new Error('Simplex missing credentials');

    let env = 'sandbox';
    if (req.body.env && req.body.env == 'production') {
      env = 'production';
    }
    delete req.body.env;

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

  wyreGetKeys(req) {
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

  changellyGetKeys(req) {
    if (!config.changelly) {
      logger.warn('Changelly missing credentials');
      throw new Error('ClientError: Service not configured.');
    }

    const keys = {
      API: config.changelly.api,
      API_KEY: config.changelly.apiKey,
      SECRET: config.changelly.secret
    };

    return keys;
  }

  changellySignRequests(message, secret: string) {
    if (!message || !secret) throw new Error('Missing parameters to sign Changelly request');

    const sign: string = Bitcore.crypto.Hash.sha512hmac(
      Buffer.from(JSON.stringify(message)),
      Buffer.from(secret)
    ).toString('hex');

    return sign;
  }

  changellyGetCurrencies(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.changellyGetKeys(req);

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
      const sign: string = this.changellySignRequests(message, keys.SECRET);

      const headers = {
        'Content-Type': 'application/json',
        sign,
        'api-key': keys.API_KEY
      };

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
      const keys = this.changellyGetKeys(req);

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
      const sign: string = this.changellySignRequests(message, keys.SECRET);

      const headers = {
        'Content-Type': 'application/json',
        sign,
        'api-key': keys.API_KEY
      };

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
      const keys = this.changellyGetKeys(req);

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
      const sign: string = this.changellySignRequests(message, keys.SECRET);

      const headers = {
        'Content-Type': 'application/json',
        sign,
        'api-key': keys.API_KEY
      };

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
      const keys = this.changellyGetKeys(req);

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
      const sign: string = this.changellySignRequests(message, keys.SECRET);

      const headers = {
        'Content-Type': 'application/json',
        sign,
        'api-key': keys.API_KEY
      };

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
      const keys = this.changellyGetKeys(req);

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
      const sign: string = this.changellySignRequests(message, keys.SECRET);

      const headers = {
        'Content-Type': 'application/json',
        sign,
        'api-key': keys.API_KEY
      };

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

  oneInchGetCredentials() {
    if (!config.oneInch) throw new Error('1Inch missing credentials');

    const credentials = {
      API: config.oneInch.api,
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

      const URL: string = credentials.API + '/v3.0/1/swap/?' + qs.join('&');

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
