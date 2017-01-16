'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var async = require('async');
var log = require('npmlog');
var config = require('../config');

log.debug = log.verbose;
log.disableColor();
var EmailValidator = require('email-validator');
var Stringify = require('json-stable-stringify');

var Bitcore = require('bitcore-lib');

var Common = require('./common');
var Utils = Common.Utils;
var Constants = Common.Constants;
var Defaults = Common.Defaults;

var ClientError = require('./errors/clienterror');
var Errors = require('./errors/errordefinitions');

var Lock = require('./lock');
var Storage = require('./storage');
var MessageBroker = require('./messagebroker');
var BlockchainExplorer = require('./blockchainexplorer');
var FiatRateService = require('./fiatrateservice');

var request = require('request');

var Model = require('./model');
var Wallet = Model.Wallet;

var initialized = false;

var lock;
var storage;
var blockchainExplorer;
var blockchainExplorerOpts;
var messageBroker;
var fiatRateService;
var serviceVersion;

/**
 * Creates an instance of the Bitcore Wallet Service.
 * @constructor
 */
function WalletService() {
  if (!initialized)
    throw new Error('Server not initialized');

  this.lock = lock;
  this.storage = storage;
  this.blockchainExplorer = blockchainExplorer;
  this.blockchainExplorerOpts = blockchainExplorerOpts;
  this.messageBroker = messageBroker;
  this.fiatRateService = fiatRateService;
  this.notifyTicker = 0;
};

function checkRequired(obj, args, cb) {
  var missing = Utils.getMissingFields(obj, args);
  if (_.isEmpty(missing)) return true;
  if (_.isFunction(cb))
    cb(new ClientError('Required argument ' + _.first(missing) + ' missing.'));
  return false;
};

/**
 * Gets the current version of BWS
 */
WalletService.getServiceVersion = function() {
  if (!serviceVersion)
    serviceVersion = 'bws-' + require('../package').version;
  return serviceVersion;
};

/**
 * Initializes global settings for all instances.
 * @param {Object} opts
 * @param {Storage} [opts.storage] - The storage provider.
 * @param {Storage} [opts.blockchainExplorer] - The blockchainExporer provider.
 * @param {Callback} cb
 */
WalletService.initialize = function(opts, cb) {
  $.shouldBeFunction(cb);

  opts = opts || {};
  lock = opts.lock || new Lock(opts.lockOpts);
  blockchainExplorer = opts.blockchainExplorer;
  blockchainExplorerOpts = opts.blockchainExplorerOpts;
  if (opts.request)
    request = opts.request;

  function initStorage(cb) {
    if (opts.storage) {
      storage = opts.storage;
      return cb();
    } else {
      var newStorage = new Storage();
      newStorage.connect(opts.storageOpts, function(err) {
        if (err) return cb(err);
        storage = newStorage;
        return cb();
      });
    }
  };

  function initMessageBroker(cb) {
    messageBroker = opts.messageBroker || new MessageBroker(opts.messageBrokerOpts);
    if (messageBroker) {
      messageBroker.onMessage(WalletService.handleIncomingNotification);
    }

    return cb();
  };

  function initFiatRateService(cb) {
    if (opts.fiatRateService) {
      fiatRateService = opts.fiatRateService;
      return cb();
    } else {
      var newFiatRateService = new FiatRateService();
      var opts2 = opts.fiatRateServiceOpts || {};
      opts2.storage = storage;
      newFiatRateService.init(opts2, function(err) {
        if (err) return cb(err);
        fiatRateService = newFiatRateService;
        return cb();
      });
    }
  };

  async.series([

    function(next) {
      initStorage(next);
    },
    function(next) {
      initMessageBroker(next);
    },
    function(next) {
      initFiatRateService(next);
    },
  ], function(err) {
    if (err) {
      log.error('Could not initialize', err);
      throw err;
    }
    initialized = true;
    return cb();
  });
};

WalletService.handleIncomingNotification = function(notification, cb) {
  cb = cb || function() {};

  if (!notification || notification.type != 'NewBlock') return cb();

  WalletService._clearBlockchainHeightCache(notification.data.network);
  return cb();
};


WalletService.shutDown = function(cb) {
  if (!initialized) return cb();
  storage.disconnect(function(err) {
    if (err) return cb(err);
    initialized = false;
    return cb();
  });
};

/**
 * Gets an instance of the server without authentication.
 * @param {Object} opts
 * @param {string} opts.clientVersion - A string that identifies the client issuing the request
 */
WalletService.getInstance = function(opts) {
  opts = opts || {};

  var version = Utils.parseVersion(opts.clientVersion);
  if (version && version.agent == 'bwc') {
    if (version.major == 0 || (version.major == 1 && version.minor < 2)) {
      throw new ClientError(Errors.codes.UPGRADE_NEEDED, 'BWC clients < 1.2 are no longer supported.');
    }
  }

  var server = new WalletService();
  server._setClientVersion(opts.clientVersion);
  return server;
};

/**
 * Gets an instance of the server after authenticating the copayer.
 * @param {Object} opts
 * @param {string} opts.copayerId - The copayer id making the request.
 * @param {string} opts.message - (Optional) The contents of the request to be signed. Only needed if no session token is provided.
 * @param {string} opts.signature - (Optional) Signature of message to be verified using one of the copayer's requestPubKeys. Only needed if no session token is provided.
 * @param {string} opts.session - (Optional) A valid session token previously obtained using the #login method
 * @param {string} opts.clientVersion - A string that identifies the client issuing the request
 */
WalletService.getInstanceWithAuth = function(opts, cb) {
  function withSignature(cb) {
    if (!checkRequired(opts, ['copayerId', 'message', 'signature'], cb)) return;

    var server;
    try {
      server = WalletService.getInstance(opts);
    } catch (ex) {
      return cb(ex);
    }

    server.storage.fetchCopayerLookup(opts.copayerId, function(err, copayer) {
      if (err) return cb(err);
      if (!copayer) return cb(new ClientError(Errors.codes.NOT_AUTHORIZED, 'Copayer not found'));

      var isValid = !!server._getSigningKey(opts.message, opts.signature, copayer.requestPubKeys);
      if (!isValid)
        return cb(new ClientError(Errors.codes.NOT_AUTHORIZED, 'Invalid signature'));

      server.copayerId = opts.copayerId;
      server.walletId = copayer.walletId;
      return cb(null, server);
    });
  };

  function withSession(cb) {
    if (!checkRequired(opts, ['copayerId', 'session'], cb)) return;

    var server;
    try {
      server = WalletService.getInstance(opts);
    } catch (ex) {
      return cb(ex);
    }

    server.storage.getSession(opts.copayerId, function(err, s) {
      if (err) return cb(err);

      var isValid = s && s.id == opts.session && s.isValid();
      if (!isValid) return cb(new ClientError(Errors.codes.NOT_AUTHORIZED, 'Session expired'));

      server.storage.fetchCopayerLookup(opts.copayerId, function(err, copayer) {
        if (err) return cb(err);
        if (!copayer) return cb(new ClientError(Errors.codes.NOT_AUTHORIZED, 'Copayer not found'));

        server.copayerId = opts.copayerId;
        server.walletId = copayer.walletId;
        return cb(null, server);
      });
    });
  };

  var authFn = opts.session ? withSession : withSignature;
  return authFn(cb);
};

WalletService.prototype._runLocked = function(cb, task) {
  $.checkState(this.walletId);
  this.lock.runLocked(this.walletId, cb, task);
};

WalletService.prototype.login = function(opts, cb) {
  var self = this;

  var session;
  async.series([

    function(next) {
      self.storage.getSession(self.copayerId, function(err, s) {
        if (err) return next(err);
        session = s;
        next();
      });
    },
    function(next) {
      if (!session || !session.isValid()) {
        session = Model.Session.create({
          copayerId: self.copayerId,
          walletId: self.walletId,
        });
      } else {
        session.touch();
      }
      next();
    },
    function(next) {
      self.storage.storeSession(session, next);
    },
  ], function(err) {
    if (err) return cb(err);
    if (!session) return cb(new Error('Could not get current session for this copayer'));

    return cb(null, session.id);
  });
};

WalletService.prototype.logout = function(opts, cb) {
  var self = this;

  self.storage.removeSession(self.copayerId, cb);
};

/**
 * Creates a new wallet.
 * @param {Object} opts
 * @param {string} opts.id - The wallet id.
 * @param {string} opts.name - The wallet name.
 * @param {number} opts.m - Required copayers.
 * @param {number} opts.n - Total copayers.
 * @param {string} opts.pubKey - Public key to verify copayers joining have access to the wallet secret.
 * @param {string} opts.singleAddress[=false] - The wallet will only ever have one address.
 * @param {string} opts.network[='livenet'] - The Bitcoin network for this wallet.
 * @param {string} opts.supportBIP44AndP2PKH[=true] - Client supports BIP44 & P2PKH for new wallets.
 */
WalletService.prototype.createWallet = function(opts, cb) {
  var self = this,
    pubKey;

  if (!checkRequired(opts, ['name', 'm', 'n', 'pubKey'], cb)) return;

  if (_.isEmpty(opts.name)) return cb(new ClientError('Invalid wallet name'));
  if (!Wallet.verifyCopayerLimits(opts.m, opts.n))
    return cb(new ClientError('Invalid combination of required copayers / total copayers'));

  opts.network = opts.network || 'livenet';
  if (!_.contains(['livenet', 'testnet'], opts.network))
    return cb(new ClientError('Invalid network'));

  opts.supportBIP44AndP2PKH = _.isBoolean(opts.supportBIP44AndP2PKH) ? opts.supportBIP44AndP2PKH : true;

  var derivationStrategy = opts.supportBIP44AndP2PKH ? Constants.DERIVATION_STRATEGIES.BIP44 : Constants.DERIVATION_STRATEGIES.BIP45;
  var addressType = (opts.n == 1 && opts.supportBIP44AndP2PKH) ? Constants.SCRIPT_TYPES.P2PKH : Constants.SCRIPT_TYPES.P2SH;

  try {
    pubKey = new Bitcore.PublicKey.fromString(opts.pubKey);
  } catch (ex) {
    return cb(new ClientError('Invalid public key'));
  };

  var newWallet;
  async.series([

    function(acb) {
      if (!opts.id)
        return acb();

      self.storage.fetchWallet(opts.id, function(err, wallet) {
        if (wallet) return acb(Errors.WALLET_ALREADY_EXISTS);
        return acb(err);
      });
    },
    function(acb) {
      var wallet = Wallet.create({
        id: opts.id,
        name: opts.name,
        m: opts.m,
        n: opts.n,
        network: opts.network,
        pubKey: pubKey.toString(),
        singleAddress: !!opts.singleAddress,
        derivationStrategy: derivationStrategy,
        addressType: addressType,
      });
      self.storage.storeWallet(wallet, function(err) {
        log.debug('Wallet created', wallet.id, opts.network);
        newWallet = wallet;
        return acb(err);
      });
    }
  ], function(err) {
    return cb(err, newWallet ? newWallet.id : null);
  });
};

/**
 * Retrieves a wallet from storage.
 * @param {Object} opts
 * @returns {Object} wallet
 */
WalletService.prototype.getWallet = function(opts, cb) {
  var self = this;

  self.storage.fetchWallet(self.walletId, function(err, wallet) {
    if (err) return cb(err);
    if (!wallet) return cb(Errors.WALLET_NOT_FOUND);
    return cb(null, wallet);
  });
};

/**
 * Retrieves wallet status.
 * @param {Object} opts
 * @param {Object} opts.twoStep[=false] - Optional: use 2-step balance computation for improved performance
 * @param {Object} opts.includeExtendedInfo - Include PKR info & address managers for wallet & copayers
 * @returns {Object} status
 */
WalletService.prototype.getStatus = function(opts, cb) {
  var self = this;

  opts = opts || {};

  var status = {};
  async.parallel([

    function(next) {
      self.getWallet({}, function(err, wallet) {
        if (err) return next(err);

        var walletExtendedKeys = ['publicKeyRing', 'pubKey', 'addressManager'];
        var copayerExtendedKeys = ['xPubKey', 'requestPubKey', 'signature', 'addressManager', 'customData'];

        wallet.copayers = _.map(wallet.copayers, function(copayer) {
          if (copayer.id == self.copayerId) return copayer;
          return _.omit(copayer, 'customData');
        });
        if (!opts.includeExtendedInfo) {
          wallet = _.omit(wallet, walletExtendedKeys);
          wallet.copayers = _.map(wallet.copayers, function(copayer) {
            return _.omit(copayer, copayerExtendedKeys);
          });
        }
        status.wallet = wallet;
        next();
      });
    },
    function(next) {
      self.getBalance(opts, function(err, balance) {
        if (err) return next(err);
        status.balance = balance;
        next();
      });
    },
    function(next) {
      self.getPendingTxs({}, function(err, pendingTxps) {
        if (err) return next(err);
        status.pendingTxps = pendingTxps;
        next();
      });
    },
    function(next) {
      self.getPreferences({}, function(err, preferences) {
        if (err) return next(err);
        status.preferences = preferences;
        next();
      });
    },
  ], function(err) {
    if (err) return cb(err);
    return cb(null, status);
  });
};


/*
 * Verifies a signature
 * @param text
 * @param signature
 * @param pubKeys
 */
WalletService.prototype._verifySignature = function(text, signature, pubkey) {
  return Utils.verifyMessage(text, signature, pubkey);
};


/*
 * Verifies a request public key
 * @param requestPubKey
 * @param signature
 * @param xPubKey
 */
WalletService.prototype._verifyRequestPubKey = function(requestPubKey, signature, xPubKey) {
  var pub = (new Bitcore.HDPublicKey(xPubKey)).derive(Constants.PATHS.REQUEST_KEY_AUTH).publicKey;
  return Utils.verifyMessage(requestPubKey, signature, pub.toString());
};

/*
 * Verifies signature againt a collection of pubkeys
 * @param text
 * @param signature
 * @param pubKeys
 */
WalletService.prototype._getSigningKey = function(text, signature, pubKeys) {
  var self = this;
  return _.find(pubKeys, function(item) {
    return self._verifySignature(text, signature, item.key);
  });
};

/**
 * _notify
 *
 * @param {String} type
 * @param {Object} data
 * @param {Object} opts
 * @param {Boolean} opts.isGlobal - If true, the notification is not issued on behalf of any particular copayer (defaults to false)
 */
WalletService.prototype._notify = function(type, data, opts, cb) {
  var self = this;

  if (_.isFunction(opts)) {
    cb = opts;
    opts = {};
  }
  opts = opts || {};

  log.debug('Notification', type, data);

  cb = cb || function() {};

  var walletId = self.walletId || data.walletId;
  var copayerId = self.copayerId || data.copayerId;

  $.checkState(walletId);

  var notification = Model.Notification.create({
    type: type,
    data: data,
    ticker: this.notifyTicker++,
    creatorId: opts.isGlobal ? null : copayerId,
    walletId: walletId,
  });

  this.storage.storeNotification(walletId, notification, function() {
    self.messageBroker.send(notification);
    return cb();
  });
};


WalletService.prototype._notifyTxProposalAction = function(type, txp, extraArgs, cb) {
  var self = this;

  if (_.isFunction(extraArgs)) {
    cb = extraArgs;
    extraArgs = {};
  }

  var data = _.assign({
    txProposalId: txp.id,
    creatorId: txp.creatorId,
    amount: txp.getTotalAmount(),
    message: txp.message,
  }, extraArgs);
  self._notify(type, data, {}, cb);
};

WalletService.prototype._addCopayerToWallet = function(wallet, opts, cb) {
  var self = this;

  var copayer = Model.Copayer.create({
    name: opts.name,
    copayerIndex: wallet.copayers.length,
    xPubKey: opts.xPubKey,
    requestPubKey: opts.requestPubKey,
    signature: opts.copayerSignature,
    customData: opts.customData,
    derivationStrategy: wallet.derivationStrategy,
  });
  self.storage.fetchCopayerLookup(copayer.id, function(err, res) {
    if (err) return cb(err);
    if (res) return cb(Errors.COPAYER_REGISTERED);

    if (opts.dryRun) return cb(null, {
      copayerId: null,
      wallet: wallet
    });

    wallet.addCopayer(copayer);
    self.storage.storeWalletAndUpdateCopayersLookup(wallet, function(err) {
      if (err) return cb(err);

      async.series([

        function(next) {
          self._notify('NewCopayer', {
            walletId: opts.walletId,
            copayerId: copayer.id,
            copayerName: copayer.name,
          }, next);
        },
        function(next) {
          if (wallet.isComplete() && wallet.isShared()) {
            self._notify('WalletComplete', {
              walletId: opts.walletId,
            }, {
              isGlobal: true
            }, next);
          } else {
            next();
          }
        },
      ], function() {
        return cb(null, {
          copayerId: copayer.id,
          wallet: wallet
        });
      });
    });
  });
};


WalletService.prototype._addKeyToCopayer = function(wallet, copayer, opts, cb) {
  var self = this;
  wallet.addCopayerRequestKey(copayer.copayerId, opts.requestPubKey, opts.signature, opts.restrictions, opts.name);
  self.storage.storeWalletAndUpdateCopayersLookup(wallet, function(err) {
    if (err) return cb(err);

    return cb(null, {
      copayerId: copayer.id,
      wallet: wallet
    });
  });
};

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
WalletService.prototype.addAccess = function(opts, cb) {
  var self = this;

  if (!checkRequired(opts, ['copayerId', 'requestPubKey', 'signature'], cb)) return;

  self.storage.fetchCopayerLookup(opts.copayerId, function(err, copayer) {
    if (err) return cb(err);
    if (!copayer) return cb(Errors.NOT_AUTHORIZED);
    self.storage.fetchWallet(copayer.walletId, function(err, wallet) {
      if (err) return cb(err);
      if (!wallet) return cb(Errors.NOT_AUTHORIZED);

      var xPubKey = _.find(wallet.copayers, {
        id: opts.copayerId
      }).xPubKey;

      if (!self._verifyRequestPubKey(opts.requestPubKey, opts.signature, xPubKey)) {
        return cb(Errors.NOT_AUTHORIZED);
      }

      if (copayer.requestPubKeys.length > Defaults.MAX_KEYS)
        return cb(Errors.TOO_MANY_KEYS);

      self._addKeyToCopayer(wallet, copayer, opts, cb);
    });
  });
};

WalletService.prototype._setClientVersion = function(version) {
  delete this.parsedClientVersion;
  this.clientVersion = version;
};

WalletService.prototype._parseClientVersion = function() {
  if (_.isUndefined(this.parsedClientVersion)) {
    this.parsedClientVersion = Utils.parseVersion(this.clientVersion);
  }
  return this.parsedClientVersion;
};

WalletService.prototype._clientSupportsPayProRefund = function() {
  var version = this._parseClientVersion();
  if (!version) return false;
  if (version.agent != 'bwc') return true;
  if (version.major < 1 || (version.major == 1 && version.minor < 2)) return false;
  return true;
};

WalletService._getCopayerHash = function(name, xPubKey, requestPubKey) {
  return [name, xPubKey, requestPubKey].join('|');
};

/**
 * Joins a wallet in creation.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {string} opts.name - The copayer name.
 * @param {string} opts.xPubKey - Extended Public Key for this copayer.
 * @param {string} opts.requestPubKey - Public Key used to check requests from this copayer.
 * @param {string} opts.copayerSignature - S(name|xPubKey|requestPubKey). Used by other copayers to verify that the copayer joining knows the wallet secret.
 * @param {string} opts.customData - (optional) Custom data for this copayer.
 * @param {string} opts.dryRun[=false] - (optional) Simulate the action but do not change server state.
 * @param {string} [opts.supportBIP44AndP2PKH = true] - Client supports BIP44 & P2PKH for joining wallets.
 */
WalletService.prototype.joinWallet = function(opts, cb) {
  var self = this;

  if (!checkRequired(opts, ['walletId', 'name', 'xPubKey', 'requestPubKey', 'copayerSignature'], cb)) return;

  if (_.isEmpty(opts.name))
    return cb(new ClientError('Invalid copayer name'));

  try {
    Bitcore.HDPublicKey(opts.xPubKey);
  } catch (ex) {
    return cb(new ClientError('Invalid extended public key'));
  }

  opts.supportBIP44AndP2PKH = _.isBoolean(opts.supportBIP44AndP2PKH) ? opts.supportBIP44AndP2PKH : true;

  self.walletId = opts.walletId;
  self._runLocked(cb, function(cb) {
    self.storage.fetchWallet(opts.walletId, function(err, wallet) {
      if (err) return cb(err);
      if (!wallet) return cb(Errors.WALLET_NOT_FOUND);

      if (opts.supportBIP44AndP2PKH) {
        // New client trying to join legacy wallet
        if (wallet.derivationStrategy == Constants.DERIVATION_STRATEGIES.BIP45) {
          return cb(new ClientError('The wallet you are trying to join was created with an older version of the client app.'));
        }
      } else {
        // Legacy client trying to join new wallet
        if (wallet.derivationStrategy == Constants.DERIVATION_STRATEGIES.BIP44) {
          return cb(new ClientError(Errors.codes.UPGRADE_NEEDED, 'To join this wallet you need to upgrade your client app.'));
        }
      }

      var hash = WalletService._getCopayerHash(opts.name, opts.xPubKey, opts.requestPubKey);
      if (!self._verifySignature(hash, opts.copayerSignature, wallet.pubKey)) {
        return cb(new ClientError());
      }

      if (_.find(wallet.copayers, {
        xPubKey: opts.xPubKey
      })) return cb(Errors.COPAYER_IN_WALLET);

      if (wallet.copayers.length == wallet.n) return cb(Errors.WALLET_FULL);

      self._addCopayerToWallet(wallet, opts, cb);
    });
  });
};

/**
 * Save copayer preferences for the current wallet/copayer pair.
 * @param {Object} opts
 * @param {string} opts.email - Email address for notifications.
 * @param {string} opts.language - Language used for notifications.
 * @param {string} opts.unit - Bitcoin unit used to format amounts in notifications.
 */
WalletService.prototype.savePreferences = function(opts, cb) {
  var self = this;

  opts = opts || {};

  var preferences = [{
    name: 'email',
    isValid: function(value) {
      return EmailValidator.validate(value);
    },
  }, {
    name: 'language',
    isValid: function(value) {
      return _.isString(value) && value.length == 2;
    },
  }, {
    name: 'unit',
    isValid: function(value) {
      return _.isString(value) && _.contains(['btc', 'bit'], value.toLowerCase());
    },
  }];

  opts = _.pick(opts, _.pluck(preferences, 'name'));
  try {
    _.each(preferences, function(preference) {
      var value = opts[preference.name];
      if (!value) return;
      if (!preference.isValid(value)) {
        throw 'Invalid ' + preference.name;
        return false;
      }
    });
  } catch (ex) {
    return cb(new ClientError(ex));
  }

  self._runLocked(cb, function(cb) {
    self.storage.fetchPreferences(self.walletId, self.copayerId, function(err, oldPref) {
      if (err) return cb(err);

      var newPref = Model.Preferences.create({
        walletId: self.walletId,
        copayerId: self.copayerId,
      });
      var preferences = Model.Preferences.fromObj(_.defaults(newPref, opts, oldPref));
      self.storage.storePreferences(preferences, function(err) {
        return cb(err);
      });
    });
  });
};

/**
 * Retrieves a preferences for the current wallet/copayer pair.
 * @param {Object} opts
 * @returns {Object} preferences
 */
WalletService.prototype.getPreferences = function(opts, cb) {
  var self = this;

  self.storage.fetchPreferences(self.walletId, self.copayerId, function(err, preferences) {
    if (err) return cb(err);
    return cb(null, preferences || {});
  });
};

WalletService.prototype._canCreateAddress = function(ignoreMaxGap, cb) {
  var self = this;

  if (ignoreMaxGap) return cb(null, true);

  self.storage.fetchAddresses(self.walletId, function(err, addresses) {
    if (err) return cb(err);
    var latestAddresses = _.takeRight(_.reject(addresses, {
      isChange: true
    }), Defaults.MAX_MAIN_ADDRESS_GAP);
    if (latestAddresses.length < Defaults.MAX_MAIN_ADDRESS_GAP || _.any(latestAddresses, {
      hasActivity: true
    })) return cb(null, true);

    var bc = self._getBlockchainExplorer(latestAddresses[0].network);
    var activityFound = false;
    var i = latestAddresses.length;
    async.whilst(function() {
      return i > 0 && !activityFound;
    }, function(next) {
      bc.getAddressActivity(latestAddresses[--i].address, function(err, res) {
        if (err) return next(err);
        activityFound = !!res;
        return next();
      });
    }, function(err) {
      if (err) return cb(err);
      if (!activityFound) return cb(null, false);

      var address = latestAddresses[i];
      address.hasActivity = true;
      self.storage.storeAddress(address, function(err) {
        return cb(err, true);
      });
    });
  });
};

/**
 * Creates a new address.
 * @param {Object} opts
 * @param {Boolean} [opts.ignoreMaxGap=false] - Ignore constraint of maximum number of consecutive addresses without activity
 * @returns {Address} address
 */
WalletService.prototype.createAddress = function(opts, cb) {
  var self = this;

  opts = opts || {};

  function createNewAddress(wallet, cb) {
    var address = wallet.createAddress(false);

    self.storage.storeAddressAndWallet(wallet, address, function(err) {
      if (err) return cb(err);

      self._notify('NewAddress', {
        address: address.address,
      }, function() {
        return cb(null, address);
      });
    });
  };

  function getFirstAddress(wallet, cb) {
    self.storage.fetchAddresses(self.walletId, function(err, addresses) {
      if (err) return cb(err);
      if (!_.isEmpty(addresses)) return cb(null, _.first(addresses))
      return createNewAddress(wallet, cb);
    });
  };

  self._canCreateAddress(opts.ignoreMaxGap, function(err, canCreate) {
    if (err) return cb(err);
    if (!canCreate) return cb(Errors.MAIN_ADDRESS_GAP_REACHED);

    self._runLocked(cb, function(cb) {
      self.getWallet({}, function(err, wallet) {
        if (err) return cb(err);
        if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

        var createFn = wallet.singleAddress ? getFirstAddress : createNewAddress;
        return createFn(wallet, cb);
      });
    });
  });
};

/**
 * Get all addresses.
 * @param {Object} opts
 * @param {Numeric} opts.limit (optional) - Limit the resultset. Return all addresses by default.
 * @param {Boolean} [opts.reverse=false] (optional) - Reverse the order of returned addresses.
 * @returns {Address[]}
 */
WalletService.prototype.getMainAddresses = function(opts, cb) {
  var self = this;

  opts = opts || {};
  self.storage.fetchAddresses(self.walletId, function(err, addresses) {
    if (err) return cb(err);

    var onlyMain = _.reject(addresses, {
      isChange: true
    });
    if (opts.reverse) onlyMain.reverse();
    if (opts.limit > 0) onlyMain = _.take(onlyMain, opts.limit);

    return cb(null, onlyMain);
  });
};

/**
 * Verifies that a given message was actually sent by an authorized copayer.
 * @param {Object} opts
 * @param {string} opts.message - The message to verify.
 * @param {string} opts.signature - The signature of message to verify.
 * @returns {truthy} The result of the verification.
 */
WalletService.prototype.verifyMessageSignature = function(opts, cb) {
  var self = this;

  if (!checkRequired(opts, ['message', 'signature'], cb)) return;

  self.getWallet({}, function(err, wallet) {
    if (err) return cb(err);

    var copayer = wallet.getCopayer(self.copayerId);

    var isValid = !!self._getSigningKey(opts.message, opts.signature, copayer.requestPubKeys);
    return cb(null, isValid);
  });
};


WalletService.prototype._getBlockchainExplorer = function(network) {
  if (!this.blockchainExplorer) {
    var opts = {};
    if (this.blockchainExplorerOpts && this.blockchainExplorerOpts[network]) {
      opts = this.blockchainExplorerOpts[network];
    }
    // TODO: provider should be configurable
    opts.provider = 'insight';
    opts.network = network;
    opts.userAgent = WalletService.getServiceVersion();
    this.blockchainExplorer = new BlockchainExplorer(opts);
  }

  return this.blockchainExplorer;
};

WalletService.prototype._getUtxos = function(addresses, cb) {
  var self = this;

  if (addresses.length == 0) return cb(null, []);
  var networkName = Bitcore.Address(addresses[0]).toObject().network;

  var bc = self._getBlockchainExplorer(networkName);
  bc.getUtxos(addresses, function(err, utxos) {
    if (err) return cb(err);

    var utxos = _.map(utxos, function(utxo) {
      var u = _.pick(utxo, ['txid', 'vout', 'address', 'scriptPubKey', 'amount', 'satoshis', 'confirmations']);
      u.confirmations = u.confirmations || 0;
      u.locked = false;
      u.satoshis = _.isNumber(u.satoshis) ? +u.satoshis : Utils.strip(u.amount * 1e8);
      delete u.amount;
      return u;
    });

    return cb(null, utxos);
  });
};

WalletService.prototype._getUtxosForCurrentWallet = function(addresses, cb) {
  var self = this;

  function utxoKey(utxo) {
    return utxo.txid + '|' + utxo.vout
  };

  var allAddresses, allUtxos, utxoIndex;

  async.series([

    function(next) {
      if (_.isArray(addresses)) {
        allAddresses = addresses;
        return next();
      }
      self.storage.fetchAddresses(self.walletId, function(err, addresses) {
        allAddresses = addresses;
        return next();
      });
    },
    function(next) {
      if (allAddresses.length == 0) return cb(null, []);

      var addressStrs = _.pluck(allAddresses, 'address');
      self._getUtxos(addressStrs, function(err, utxos) {
        if (err) return next(err);

        if (utxos.length == 0) return cb(null, []);
        allUtxos = utxos;
        utxoIndex = _.indexBy(allUtxos, utxoKey);
        return next();
      });
    },
    function(next) {
      self.getPendingTxs({}, function(err, txps) {
        if (err) return next(err);

        var lockedInputs = _.map(_.flatten(_.pluck(txps, 'inputs')), utxoKey);
        _.each(lockedInputs, function(input) {
          if (utxoIndex[input]) {
            utxoIndex[input].locked = true;
          }
        });
        return next();
      });
    },
    function(next) {
      var now = Math.floor(Date.now() / 1000);
      // Fetch latest broadcasted txs and remove any spent inputs from the
      // list of UTXOs returned by the block explorer. This counteracts any out-of-sync
      // effects between broadcasting a tx and getting the list of UTXOs.
      // This is especially true in the case of having multiple instances of the block explorer.
      self.storage.fetchBroadcastedTxs(self.walletId, {
        minTs: now - 24 * 3600,
        limit: 100
      }, function(err, txs) {
        if (err) return next(err);
        var spentInputs = _.map(_.flatten(_.pluck(txs, 'inputs')), utxoKey);
        _.each(spentInputs, function(input) {
          if (utxoIndex[input]) {
            utxoIndex[input].spent = true;
          }
        });
        allUtxos = _.reject(allUtxos, {
          spent: true
        });
        return next();
      });
    },
    function(next) {
      // Needed for the clients to sign UTXOs
      var addressToPath = _.indexBy(allAddresses, 'address');
      _.each(allUtxos, function(utxo) {
        utxo.path = addressToPath[utxo.address].path;
        utxo.publicKeys = addressToPath[utxo.address].publicKeys;
      });
      return next();
    },
  ], function(err) {
    return cb(err, allUtxos);
  });
};

/**
 * Returns list of UTXOs
 * @param {Object} opts
 * @param {Array} opts.addresses (optional) - List of addresses from where to fetch UTXOs.
 * @returns {Array} utxos - List of UTXOs.
 */
WalletService.prototype.getUtxos = function(opts, cb) {
  var self = this;

  opts = opts || {};

  if (_.isUndefined(opts.addresses)) {
    self._getUtxosForCurrentWallet(null, cb);
  } else {
    self._getUtxos(opts.addresses, cb);
  }
};

WalletService.prototype._totalizeUtxos = function(utxos) {
  var balance = {
    totalAmount: _.sum(utxos, 'satoshis'),
    lockedAmount: _.sum(_.filter(utxos, 'locked'), 'satoshis'),
    totalConfirmedAmount: _.sum(_.filter(utxos, 'confirmations'), 'satoshis'),
    lockedConfirmedAmount: _.sum(_.filter(_.filter(utxos, 'locked'), 'confirmations'), 'satoshis'),
  };
  balance.availableAmount = balance.totalAmount - balance.lockedAmount;
  balance.availableConfirmedAmount = balance.totalConfirmedAmount - balance.lockedConfirmedAmount;

  return balance;
};


WalletService.prototype._getBalanceFromAddresses = function(addresses, cb) {
  var self = this;

  self._getUtxosForCurrentWallet(addresses, function(err, utxos) {
    if (err) return cb(err);

    var balance = self._totalizeUtxos(utxos);

    // Compute balance by address
    var byAddress = {};
    _.each(_.indexBy(_.sortBy(utxos, 'address'), 'address'), function(value, key) {
      byAddress[key] = {
        address: key,
        path: value.path,
        amount: 0,
      };
    });

    _.each(utxos, function(utxo) {
      byAddress[utxo.address].amount += utxo.satoshis;
    });

    balance.byAddress = _.values(byAddress);

    return cb(null, balance);
  });
};

WalletService.prototype._getBalanceOneStep = function(opts, cb) {
  var self = this;

  self.storage.fetchAddresses(self.walletId, function(err, addresses) {
    if (err) return cb(err);
    self._getBalanceFromAddresses(addresses, function(err, balance) {
      if (err) return cb(err);

      // Update cache
      async.series([

        function(next) {
          self.storage.cleanActiveAddresses(self.walletId, next);
        },
        function(next) {
          var active = _.pluck(balance.byAddress, 'address')
          self.storage.storeActiveAddresses(self.walletId, active, next);
        },
      ], function(err) {
        if (err) {
          log.warn('Could not update wallet cache', err);
        }
        return cb(null, balance);
      });
    });
  });
};


WalletService.prototype._getActiveAddresses = function(cb) {
  var self = this;

  self.storage.fetchActiveAddresses(self.walletId, function(err, active) {
    if (err) {
      log.warn('Could not fetch active addresses from cache', err);
      return cb();
    }

    if (!_.isArray(active)) return cb();

    self.storage.fetchAddresses(self.walletId, function(err, allAddresses) {
      if (err) return cb(err);

      var now = Math.floor(Date.now() / 1000);
      var recent = _.pluck(_.filter(allAddresses, function(address) {
        return address.createdOn > (now - 24 * 3600);
      }), 'address');

      var result = _.union(active, recent);

      var index = _.indexBy(allAddresses, 'address');
      result = _.compact(_.map(result, function(r) {
        return index[r];
      }));
      return cb(null, result);
    });
  });
};

/**
 * Get wallet balance.
 * @param {Object} opts
 * @param {Boolean} opts.twoStep[=false] - Optional - Use 2 step balance computation for improved performance
 * @returns {Object} balance - Total amount & locked amount.
 */
WalletService.prototype.getBalance = function(opts, cb) {
  var self = this;

  opts = opts || {};

  if (!opts.twoStep)
    return self._getBalanceOneStep(opts, cb);

  self.storage.countAddresses(self.walletId, function(err, nbAddresses) {
    if (err) return cb(err);
    if (nbAddresses < Defaults.TWO_STEP_BALANCE_THRESHOLD) {
      return self._getBalanceOneStep(opts, cb);
    }
    self._getActiveAddresses(function(err, activeAddresses) {
      if (err) return cb(err);
      if (!_.isArray(activeAddresses)) {
        return self._getBalanceOneStep(opts, cb);
      } else {
        log.debug('Requesting partial balance for ' + activeAddresses.length + ' out of ' + nbAddresses + ' addresses');
        self._getBalanceFromAddresses(activeAddresses, function(err, partialBalance) {
          if (err) return cb(err);
          cb(null, partialBalance);
          setTimeout(function() {
            self._getBalanceOneStep(opts, function(err, fullBalance) {
              if (err) return;
              if (!_.isEqual(partialBalance, fullBalance)) {
                log.info('Balance in active addresses differs from final balance');
                self._notify('BalanceUpdated', fullBalance, {
                  isGlobal: true
                });
              }
            });
          }, 1);
          return;
        });
      }
    });
  });
};

/**
 * Return info needed to send all funds in the wallet
 * @param {Object} opts
 * @param {number} opts.feeLevel[='normal'] - Optional. Specify the fee level for this TX ('priority', 'normal', 'economy', 'superEconomy') as defined in Defaults.FEE_LEVELS.
 * @param {number} opts.feePerKb - Optional. Specify the fee per KB for this TX (in satoshi).
 * @param {string} opts.excludeUnconfirmedUtxos[=false] - Optional. Do not use UTXOs of unconfirmed transactions as inputs
 * @param {string} opts.returnInputs[=false] - Optional. Return the list of UTXOs that would be included in the tx.
 * @returns {Object} sendMaxInfo
 */
WalletService.prototype.getSendMaxInfo = function(opts, cb) {
  var self = this;


  opts = opts || {};

  var feeArgs = !!opts.feeLevel + _.isNumber(opts.feePerKb);
  if (feeArgs > 1)
    return cb(new ClientError('Only one of feeLevel/feePerKb can be specified'));

  if (feeArgs == 0) {
    log.debug('No fee provided, using "normal" fee level');
    opts.feeLevel = 'normal';
  }

  if (opts.feeLevel) {
    if (!_.any(Defaults.FEE_LEVELS, {
      name: opts.feeLevel
    }))
      return cb(new ClientError('Invalid fee level. Valid values are ' + _.pluck(Defaults.FEE_LEVELS, 'name').join(', ')));
  }

  if (_.isNumber(opts.feePerKb)) {
    if (opts.feePerKb < Defaults.MIN_FEE_PER_KB || opts.feePerKb > Defaults.MAX_FEE_PER_KB)
      return cb(new ClientError('Invalid fee per KB'));
  }

  self.getWallet({}, function(err, wallet) {
    if (err) return cb(err);

    self._getUtxosForCurrentWallet(null, function(err, utxos) {
      if (err) return cb(err);

      var info = {
        size: 0,
        amount: 0,
        fee: 0,
        feePerKb: 0,
        inputs: [],
        utxosBelowFee: 0,
        amountBelowFee: 0,
        utxosAboveMaxSize: 0,
        amountAboveMaxSize: 0,
      };

      var inputs = _.reject(utxos, 'locked');
      if (!!opts.excludeUnconfirmedUtxos) {
        inputs = _.filter(inputs, 'confirmations');
      }
      inputs = _.sortBy(inputs, function(input) {
        return -input.satoshis;
      });

      if (_.isEmpty(inputs)) return cb(null, info);

      self._getFeePerKb(wallet, opts, function(err, feePerKb) {
        if (err) return cb(err);

        info.feePerKb = feePerKb;

        var txp = Model.TxProposal.create({
          walletId: self.walletId,
          network: wallet.network,
          walletM: wallet.m,
          walletN: wallet.n,
          feePerKb: feePerKb,
        });

        var baseTxpSize = txp.getEstimatedSize();
        var baseTxpFee = baseTxpSize * txp.feePerKb / 1000.;
        var sizePerInput = txp.getEstimatedSizeForSingleInput();
        var feePerInput = sizePerInput * txp.feePerKb / 1000.;

        var partitionedByAmount = _.partition(inputs, function(input) {
          return input.satoshis > feePerInput;
        });

        info.utxosBelowFee = partitionedByAmount[1].length;
        info.amountBelowFee = _.sum(partitionedByAmount[1], 'satoshis');
        inputs = partitionedByAmount[0];

        _.each(inputs, function(input, i) {
          var sizeInKb = (baseTxpSize + (i + 1) * sizePerInput) / 1000.;
          if (sizeInKb > Defaults.MAX_TX_SIZE_IN_KB) {
            info.utxosAboveMaxSize = inputs.length - i;
            info.amountAboveMaxSize = _.sum(_.slice(inputs, i), 'satoshis');
            return false;
          }
          txp.inputs.push(input);
        });

        if (_.isEmpty(txp.inputs)) return cb(null, info);

        info.size = txp.getEstimatedSize();
        info.fee = txp.getEstimatedFee();
        info.amount = _.sum(txp.inputs, 'satoshis') - info.fee;
        if (opts.returnInputs) {
          info.inputs = _.shuffle(txp.inputs);
        }

        return cb(null, info);
      });
    });
  });
};

WalletService.prototype._sampleFeeLevels = function(network, points, cb) {
  var self = this;

  var bc = self._getBlockchainExplorer(network);
  bc.estimateFee(points, function(err, result) {
    if (err) {
      log.error('Error estimating fee', err);
      return cb(err);
    }

    var failed = [];
    var levels = _.zipObject(_.map(points, function(p) {
      var feePerKb = _.isObject(result) ? +result[p] : -1;
      if (feePerKb < 0)
        failed.push(p);

      return [p, Utils.strip(feePerKb * 1e8)];
    }));

    if (failed.length) {
      var logger = network == 'livenet' ? log.warn : log.debug;
      logger('Could not compute fee estimation in ' + network + ': ' + failed.join(', ') + ' blocks.');
    }

    return cb(null, levels);
  });
};

/**
 * Returns fee levels for the current state of the network.
 * @param {Object} opts
 * @param {string} [opts.network = 'livenet'] - The Bitcoin network to estimate fee levels from.
 * @returns {Object} feeLevels - A list of fee levels & associated amount per kB in satoshi.
 */
WalletService.prototype.getFeeLevels = function(opts, cb) {
  var self = this;

  opts = opts || {};

  function samplePoints() {
    var definedPoints = _.uniq(_.pluck(Defaults.FEE_LEVELS, 'nbBlocks'));
    return _.uniq(_.flatten(_.map(definedPoints, function(p) {
      return _.range(p, p + Defaults.FEE_LEVELS_FALLBACK + 1);
    })));
  };

  function getFeeLevel(feeSamples, level, n, fallback) {
    var result;

    if (feeSamples[n] >= 0) {
      result = {
        nbBlocks: n,
        feePerKb: feeSamples[n],
      };
    } else {
      if (fallback > 0) {
        result = getFeeLevel(feeSamples, level, n + 1, fallback - 1);
      } else {
        result = {
          feePerKb: level.defaultValue,
          nbBlocks: null,
        };
      }
    }
    return result;
  };

  var network = opts.network || 'livenet';
  if (network != 'livenet' && network != 'testnet')
    return cb(new ClientError('Invalid network'));

  self._sampleFeeLevels(network, samplePoints(), function(err, feeSamples) {
    var values = _.map(Defaults.FEE_LEVELS, function(level) {
      var result = {
        level: level.name,
      };
      if (err) {
        result.feePerKb = level.defaultValue;
        result.nbBlocks = null;
      } else {
        var feeLevel = getFeeLevel(feeSamples, level, level.nbBlocks, Defaults.FEE_LEVELS_FALLBACK);
        result.feePerKb = feeLevel.feePerKb;
        result.nbBlocks = feeLevel.nbBlocks;
      }
      return result;
    });

    // Ensure monotonically decreasing values
    for (var i = 1; i < values.length; i++) {
      values[i].feePerKb = Math.min(values[i].feePerKb, values[i - 1].feePerKb);
    }

    return cb(null, values);
  });
};

WalletService.prototype._estimateFee = function(txp) {
  txp.estimateFee();
};

WalletService.prototype._checkTx = function(txp) {
  var bitcoreError;

  var serializationOpts = {
    disableIsFullySigned: true,
    disableSmallFees: true,
    disableLargeFees: true,
  };

  if (txp.getEstimatedSize() / 1000 > Defaults.MAX_TX_SIZE_IN_KB)
    return Errors.TX_MAX_SIZE_EXCEEDED;

  try {
    var bitcoreTx = txp.getBitcoreTx();
    bitcoreError = bitcoreTx.getSerializationError(serializationOpts);
    if (!bitcoreError) {
      txp.fee = bitcoreTx.getFee();
    }
  } catch (ex) {
    log.error('Error building Bitcore transaction', ex);
    return ex;
  }

  if (bitcoreError instanceof Bitcore.errors.Transaction.FeeError)
    return Errors.INSUFFICIENT_FUNDS_FOR_FEE;

  if (bitcoreError instanceof Bitcore.errors.Transaction.DustOutputs)
    return Errors.DUST_AMOUNT;
  return bitcoreError;
};

WalletService.prototype._selectTxInputs = function(txp, utxosToExclude, cb) {
  var self = this;

  //todo: check inputs are ours and have enough value
  if (txp.inputs && !_.isEmpty(txp.inputs)) {
    if (!_.isNumber(txp.fee))
      self._estimateFee(txp);
    return cb(self._checkTx(txp));
  }

  var txpAmount = txp.getTotalAmount();
  var baseTxpSize = txp.getEstimatedSize();
  var baseTxpFee = baseTxpSize * txp.feePerKb / 1000.;
  var sizePerInput = txp.getEstimatedSizeForSingleInput();
  var feePerInput = sizePerInput * txp.feePerKb / 1000.;

  function sanitizeUtxos(utxos) {
    var excludeIndex = _.reduce(utxosToExclude, function(res, val) {
      res[val] = val;
      return res;
    }, {});

    return _.filter(utxos, function(utxo) {
      if (utxo.locked) return false;
      if (utxo.satoshis <= feePerInput) return false;
      if (txp.excludeUnconfirmedUtxos && !utxo.confirmations) return false;
      if (excludeIndex[utxo.txid + ":" + utxo.vout]) return false;
      return true;
    });
  };

  function partitionUtxos(utxos) {
    return _.groupBy(utxos, function(utxo) {
      if (utxo.confirmations == 0) return '0'
      if (utxo.confirmations < 6) return '<6';
      return '6+';
    });
  };

  function select(utxos, cb) {
    var totalValueInUtxos = _.sum(utxos, 'satoshis');
    var netValueInUtxos = totalValueInUtxos - baseTxpFee - (utxos.length * feePerInput);

    if (totalValueInUtxos < txpAmount) {
      log.debug('Total value in all utxos (' + Utils.formatAmountInBtc(totalValueInUtxos) + ') is insufficient to cover for txp amount (' + Utils.formatAmountInBtc(txpAmount) + ')');
      return cb(Errors.INSUFFICIENT_FUNDS);
    }
    if (netValueInUtxos < txpAmount) {
      log.debug('Value after fees in all utxos (' + Utils.formatAmountInBtc(netValueInUtxos) + ') is insufficient to cover for txp amount (' + Utils.formatAmountInBtc(txpAmount) + ')');
      return cb(Errors.INSUFFICIENT_FUNDS_FOR_FEE);
    }

    var bigInputThreshold = txpAmount * Defaults.UTXO_SELECTION_MAX_SINGLE_UTXO_FACTOR + (baseTxpFee + feePerInput);
    log.debug('Big input threshold ' + Utils.formatAmountInBtc(bigInputThreshold));

    var partitions = _.partition(utxos, function(utxo) {
      return utxo.satoshis > bigInputThreshold;
    });

    var bigInputs = _.sortBy(partitions[0], 'satoshis');
    var smallInputs = _.sortBy(partitions[1], function(utxo) {
      return -utxo.satoshis;
    });

    log.debug('Considering ' + bigInputs.length + ' big inputs (' + Utils.formatUtxos(bigInputs) + ')');
    log.debug('Considering ' + smallInputs.length + ' small inputs (' + Utils.formatUtxos(smallInputs) + ')');

    var total = 0;
    var netTotal = -baseTxpFee;
    var selected = [];
    var fee;
    var error;

    _.each(smallInputs, function(input, i) {
      log.debug('Input #' + i + ': ' + Utils.formatUtxos(input));

      var netInputAmount = input.satoshis - feePerInput;

      log.debug('The input contributes ' + Utils.formatAmountInBtc(netInputAmount));

      selected.push(input);

      total += input.satoshis;
      netTotal += netInputAmount;

      var txpSize = baseTxpSize + selected.length * sizePerInput;
      fee = Math.round(baseTxpFee + selected.length * feePerInput);

      log.debug('Tx size: ' + Utils.formatSize(txpSize) + ', Tx fee: ' + Utils.formatAmountInBtc(fee));

      var feeVsAmountRatio = fee / txpAmount;
      var amountVsUtxoRatio = netInputAmount / txpAmount;

      log.debug('Fee/Tx amount: ' + Utils.formatRatio(feeVsAmountRatio) + ' (max: ' + Utils.formatRatio(Defaults.UTXO_SELECTION_MAX_FEE_VS_TX_AMOUNT_FACTOR) + ')');
      log.debug('Tx amount/Input amount:' + Utils.formatRatio(amountVsUtxoRatio) + ' (min: ' + Utils.formatRatio(Defaults.UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR) + ')');

      if (txpSize / 1000. > Defaults.MAX_TX_SIZE_IN_KB) {
        log.debug('Breaking because tx size (' + Utils.formatSize(txpSize) + ') is too big (max: ' + Utils.formatSize(Defaults.MAX_TX_SIZE_IN_KB * 1000.) + ')');
        error = Errors.TX_MAX_SIZE_EXCEEDED;
        return false;
      }

      if (!_.isEmpty(bigInputs)) {
        if (amountVsUtxoRatio < Defaults.UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR) {
          log.debug('Breaking because utxo is too small compared to tx amount');
          return false;
        }

        if (feeVsAmountRatio > Defaults.UTXO_SELECTION_MAX_FEE_VS_TX_AMOUNT_FACTOR) {
          var feeVsSingleInputFeeRatio = fee / (baseTxpFee + feePerInput);
          log.debug('Fee/Single-input fee: ' + Utils.formatRatio(feeVsSingleInputFeeRatio) + ' (max: ' + Utils.formatRatio(Defaults.UTXO_SELECTION_MAX_FEE_VS_SINGLE_UTXO_FEE_FACTOR) + ')' + ' loses wrt single-input tx: ' + Utils.formatAmountInBtc((selected.length - 1) * feePerInput));
          if (feeVsSingleInputFeeRatio > Defaults.UTXO_SELECTION_MAX_FEE_VS_SINGLE_UTXO_FEE_FACTOR) {
            log.debug('Breaking because fee is too significant compared to tx amount and it is too expensive compared to using single input');
            return false;
          }
        }
      }

      log.debug('Cumuled total so far: ' + Utils.formatAmountInBtc(total) + ', Net total so far: ' + Utils.formatAmountInBtc(netTotal));

      if (netTotal >= txpAmount) {
        var changeAmount = Math.round(total - txpAmount - fee);
        log.debug('Tx change: ', Utils.formatAmountInBtc(changeAmount));

        var dustThreshold = Math.max(Defaults.MIN_OUTPUT_AMOUNT, Bitcore.Transaction.DUST_AMOUNT);
        if (changeAmount > 0 && changeAmount <= dustThreshold) {
          log.debug('Change below dust threshold (' + Utils.formatAmountInBtc(dustThreshold) + '). Incrementing fee to remove change.');
          // Remove dust change by incrementing fee
          fee += changeAmount;
        }

        return false;
      }
    });

    if (netTotal < txpAmount) {
      log.debug('Could not reach Txp total (' + Utils.formatAmountInBtc(txpAmount) + '), still missing: ' + Utils.formatAmountInBtc(txpAmount - netTotal));

      selected = [];
      if (!_.isEmpty(bigInputs)) {
        var input = _.first(bigInputs);
        log.debug('Using big input: ', Utils.formatUtxos(input));
        total = input.satoshis;
        fee = Math.round(baseTxpFee + feePerInput);
        netTotal = total - fee;
        selected = [input];
      }
    }

    if (_.isEmpty(selected)) {
      log.debug('Could not find enough funds within this utxo subset');
      return cb(error || Errors.INSUFFICIENT_FUNDS_FOR_FEE);
    }

    return cb(null, selected, fee);
  };

  log.debug('Selecting inputs for a ' + Utils.formatAmountInBtc(txp.getTotalAmount()) + ' txp');

  self._getUtxosForCurrentWallet(null, function(err, utxos) {
    if (err) return cb(err);

    var totalAmount;
    var availableAmount;

    var balance = self._totalizeUtxos(utxos);
    if (txp.excludeUnconfirmedUtxos) {
      totalAmount = balance.totalConfirmedAmount;
      availableAmount = balance.availableConfirmedAmount;
    } else {
      totalAmount = balance.totalAmount;
      availableAmount = balance.availableAmount;
    }

    if (totalAmount < txp.getTotalAmount()) return cb(Errors.INSUFFICIENT_FUNDS);
    if (availableAmount < txp.getTotalAmount()) return cb(Errors.LOCKED_FUNDS);

    utxos = sanitizeUtxos(utxos);

    log.debug('Considering ' + utxos.length + ' utxos (' + Utils.formatUtxos(utxos) + ')');

    var groups = [6, 1];
    if (!txp.excludeUnconfirmedUtxos) groups.push(0);

    var inputs = [];
    var fee;
    var selectionError;
    var i = 0;
    var lastGroupLength;
    async.whilst(function() {
      return i < groups.length && _.isEmpty(inputs);
    }, function(next) {
      var group = groups[i++];

      var candidateUtxos = _.filter(utxos, function(utxo) {
        return utxo.confirmations >= group;
      });

      log.debug('Group >= ' + group);

      // If this group does not have any new elements, skip it
      if (lastGroupLength === candidateUtxos.length) {
        log.debug('This group is identical to the one already explored');
        return next();
      }

      log.debug('Candidate utxos: ' + Utils.formatUtxos(candidateUtxos));

      lastGroupLength = candidateUtxos.length;

      select(candidateUtxos, function(err, selectedInputs, selectedFee) {
        if (err) {
          log.debug('No inputs selected on this group: ', err);
          selectionError = err;
          return next();
        }

        selectionError = null;
        inputs = selectedInputs;
        fee = selectedFee;

        log.debug('Selected inputs from this group: ' + Utils.formatUtxos(inputs));
        log.debug('Fee for this selection: ' + Utils.formatAmountInBtc(fee));

        return next();
      });
    }, function(err) {
      if (err) return cb(err);
      if (selectionError || _.isEmpty(inputs)) return cb(selectionError || new Error('Could not select tx inputs'));

      txp.setInputs(_.shuffle(inputs));
      txp.fee = fee;

      var err = self._checkTx(txp);

      if (!err) {
        var change = _.sum(txp.inputs, 'satoshis') - _.sum(txp.outputs, 'amount') - txp.fee;
        log.debug('Successfully built transaction. Total fees: ' + Utils.formatAmountInBtc(txp.fee) + ', total change: ' + Utils.formatAmountInBtc(change));
      } else {
        log.warn('Error building transaction', err);
      }

      return cb(err);
    });
  });
};

WalletService.prototype._canCreateTx = function(cb) {
  var self = this;
  self.storage.fetchLastTxs(self.walletId, self.copayerId, 5 + Defaults.BACKOFF_OFFSET, function(err, txs) {
    if (err) return cb(err);

    if (!txs.length)
      return cb(null, true);

    var lastRejections = _.takeWhile(txs, {
      status: 'rejected'
    });

    var exceededRejections = lastRejections.length - Defaults.BACKOFF_OFFSET;
    if (exceededRejections <= 0)
      return cb(null, true);


    var lastTxTs = txs[0].createdOn;
    var now = Math.floor(Date.now() / 1000);
    var timeSinceLastRejection = now - lastTxTs;
    var backoffTime = Defaults.BACKOFF_TIME;

    if (timeSinceLastRejection <= backoffTime)
      log.debug('Not allowing to create TX: timeSinceLastRejection/backoffTime', timeSinceLastRejection, backoffTime);

    return cb(null, timeSinceLastRejection > backoffTime);
  });
};

WalletService.prototype._validateOutputs = function(opts, wallet, cb) {
  var dustThreshold = Math.max(Defaults.MIN_OUTPUT_AMOUNT, Bitcore.Transaction.DUST_AMOUNT);

  if (_.isEmpty(opts.outputs)) return new ClientError('No outputs were specified');

  for (var i = 0; i < opts.outputs.length; i++) {
    var output = opts.outputs[i];
    output.valid = false;

    if (!checkRequired(output, ['toAddress', 'amount'])) {
      return new ClientError('Argument missing in output #' + (i + 1) + '.');
    }

    var toAddress = {};
    try {
      toAddress = new Bitcore.Address(output.toAddress);
    } catch (ex) {
      return Errors.INVALID_ADDRESS;
    }
    if (toAddress.network != wallet.getNetworkName()) {
      return Errors.INCORRECT_ADDRESS_NETWORK;
    }

    if (!_.isNumber(output.amount) || _.isNaN(output.amount) || output.amount <= 0) {
      return new ClientError('Invalid amount');
    }
    if (output.amount < dustThreshold) {
      return Errors.DUST_AMOUNT;
    }

    output.valid = true;
  }
  return null;
};

WalletService.prototype._validateAndSanitizeTxOpts = function(wallet, opts, cb) {
  var self = this;

  async.series([

    function(next) {
      var feeArgs = !!opts.feeLevel + _.isNumber(opts.feePerKb) + _.isNumber(opts.fee);
      if (feeArgs > 1)
        return next(new ClientError('Only one of feeLevel/feePerKb/fee can be specified'));

      if (feeArgs == 0) {
        log.debug('No fee provided, using "normal" fee level');
        opts.feeLevel = 'normal';
      }

      if (opts.feeLevel) {
        if (!_.any(Defaults.FEE_LEVELS, {
          name: opts.feeLevel
        }))
          return next(new ClientError('Invalid fee level. Valid values are ' + _.pluck(Defaults.FEE_LEVELS, 'name').join(', ')));
      }

      if (_.isNumber(opts.feePerKb)) {
        if (opts.feePerKb < Defaults.MIN_FEE_PER_KB || opts.feePerKb > Defaults.MAX_FEE_PER_KB)
          return next(new ClientError('Invalid fee per KB'));
      }

      if (_.isNumber(opts.fee) && _.isEmpty(opts.inputs))
        return next(new ClientError('fee can only be set when inputs are specified'));

      next();
    },
    function(next) {
      if (wallet.singleAddress && opts.changeAddress) return next(new ClientError('Cannot specify change address on single-address wallet'));
      next();
    },
    function(next) {
      if (!opts.sendMax) return next();
      if (!_.isArray(opts.outputs) || opts.outputs.length > 1) {
        return next(new ClientError('Only one output allowed when sendMax is specified'));
      }
      if (_.isNumber(opts.outputs[0].amount))
        return next(new ClientError('Amount is not allowed when sendMax is specified'));
      if (_.isNumber(opts.fee))
        return next(new ClientError('Fee is not allowed when sendMax is specified (use feeLevel/feePerKb instead)'));

      self.getSendMaxInfo({
        feePerKb: opts.feePerKb || Defaults.DEFAULT_FEE_PER_KB,
        excludeUnconfirmedUtxos: !!opts.excludeUnconfirmedUtxos,
        returnInputs: true,
      }, function(err, info) {
        if (err) return next(err);
        opts.outputs[0].amount = info.amount;
        opts.inputs = info.inputs;
        return next();
      });
    },
    function(next) {
      if (opts.validateOutputs === false) return next();
      var validationError = self._validateOutputs(opts, wallet, next);
      if (validationError) {
        return next(validationError);
      }
      next();
    },
  ], cb);
};

WalletService.prototype._getFeePerKb = function(wallet, opts, cb) {
  var self = this;

  if (_.isNumber(opts.feePerKb)) return cb(null, opts.feePerKb);
  self.getFeeLevels({
    network: wallet.network
  }, function(err, levels) {
    if (err) return cb(err);
    var level = _.find(levels, {
      level: opts.feeLevel
    });
    if (!level) {
      var msg = 'Could not compute fee for "' + opts.feeLevel + '" level';
      log.error(msg);
      return cb(new ClientError(msg));
    }
    return cb(null, level.feePerKb);
  });
};


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
 * @returns {TxProposal} Transaction proposal.
 */
WalletService.prototype.createTx = function(opts, cb) {
  var self = this;

  opts = opts || {};

  function getChangeAddress(wallet, cb) {
    if (wallet.singleAddress) {
      self.storage.fetchAddresses(self.walletId, function(err, addresses) {
        if (err) return cb(err);
        if (_.isEmpty(addresses)) return cb(new ClientError('The wallet has no addresses'));
        return cb(null, _.first(addresses));
      });
    } else {
      if (opts.changeAddress) {
        self.storage.fetchAddress(opts.changeAddress, function(err, address) {
          if (err) return cb(Errors.INVALID_CHANGE_ADDRESS);
          return cb(null, address);
        });
      } else {
        return cb(null, wallet.createAddress(true));
      }
    }
  };

  function checkTxpAlreadyExists(txProposalId, cb) {
    if (!txProposalId) return cb();
    self.storage.fetchTx(self.walletId, txProposalId, cb);
  };

  self._runLocked(cb, function(cb) {
    var txp, changeAddress, feePerKb;
    self.getWallet({}, function(err, wallet) {
      if (err) return cb(err);
      if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

      checkTxpAlreadyExists(opts.txProposalId, function(err, txp) {
        if (err) return cb(err);
        if (txp) return cb(null, txp);

        async.series([

          function(next) {
            self._validateAndSanitizeTxOpts(wallet, opts, next);
          },
          function(next) {
            self._canCreateTx(function(err, canCreate) {
              if (err) return next(err);
              if (!canCreate) return next(Errors.TX_CANNOT_CREATE);
              next();
            });
          },
          function(next) {
            if (opts.sendMax) return next();
            getChangeAddress(wallet, function(err, address) {
              if (err) return next(err);
              changeAddress = address;
              next();
            });
          },
          function(next) {
            if (_.isNumber(opts.fee) && !_.isEmpty(opts.inputs)) return next();
            self._getFeePerKb(wallet, opts, function(err, fee) {
              feePerKb = fee;
              next();
            });
          },
          function(next) {
            var txOpts = {
              id: opts.txProposalId,
              walletId: self.walletId,
              creatorId: self.copayerId,
              outputs: opts.outputs,
              message: opts.message,
              changeAddress: changeAddress,
              feeLevel: opts.feeLevel,
              feePerKb: feePerKb,
              payProUrl: opts.payProUrl,
              walletM: wallet.m,
              walletN: wallet.n,
              excludeUnconfirmedUtxos: !!opts.excludeUnconfirmedUtxos,
              validateOutputs: !opts.validateOutputs,
              addressType: wallet.addressType,
              customData: opts.customData,
              inputs: opts.inputs,
              fee: opts.inputs && !_.isNumber(opts.feePerKb) ? opts.fee : null,
              noShuffleOutputs: opts.noShuffleOutputs
            };

            txp = Model.TxProposal.create(txOpts);
            next();
          },
          function(next) {
            self._selectTxInputs(txp, opts.utxosToExclude, next);
          },
          function(next) {
            if (!changeAddress || opts.dryRun) return next();
            self.storage.storeAddressAndWallet(wallet, txp.changeAddress, next);
          },
          function(next) {
            if (opts.dryRun) return next();
            self.storage.storeTx(wallet.id, txp, next);
          },
        ], function(err) {
          if (err) return cb(err);
          return cb(null, txp);
        });

      });
    });
  });
};
WalletService.prototype._verifyRequestPubKey = function(requestPubKey, signature, xPubKey) {
  var pub = (new Bitcore.HDPublicKey(xPubKey)).derive(Constants.PATHS.REQUEST_KEY_AUTH).publicKey;
  return Utils.verifyMessage(requestPubKey, signature, pub.toString());
};

/**
 * Publish an already created tx proposal so inputs are locked and other copayers in the wallet can see it.
 * @param {Object} opts
 * @param {string} opts.txProposalId - The tx id.
 * @param {string} opts.proposalSignature - S(raw tx). Used by other copayers to verify the proposal.
 */
WalletService.prototype.publishTx = function(opts, cb) {
  var self = this;

  function utxoKey(utxo) {
    return utxo.txid + '|' + utxo.vout
  };

  if (!checkRequired(opts, ['txProposalId', 'proposalSignature'], cb)) return;

  self._runLocked(cb, function(cb) {
    self.getWallet({}, function(err, wallet) {
      if (err) return cb(err);

      self.storage.fetchTx(self.walletId, opts.txProposalId, function(err, txp) {
        if (err) return cb(err);
        if (!txp) return cb(Errors.TX_NOT_FOUND);
        if (!txp.isTemporary()) return cb(null, txp);

        var copayer = wallet.getCopayer(self.copayerId);

        var raw;
        try {
          raw = txp.getRawTx();
        } catch (ex) {
          return cb(ex);
        }
        var signingKey = self._getSigningKey(raw, opts.proposalSignature, copayer.requestPubKeys);
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
        self.getUtxos({}, function(err, utxos) {
          if (err) return cb(err);

          var txpInputs = _.map(txp.inputs, utxoKey);
          var lockedUtxoIndex = _.indexBy(_.filter(utxos, 'locked'), utxoKey);
          var unavailable = _.any(txpInputs, function(i) {
            return lockedUtxoIndex[i];
          });

          if (unavailable) return cb(Errors.UNAVAILABLE_UTXOS);

          txp.status = 'pending';
          self.storage.storeTx(self.walletId, txp, function(err) {
            if (err) return cb(err);

            self._notifyTxProposalAction('NewTxProposal', txp, function() {
              return cb(null, txp);
            });
          });
        });
      });
    });
  });
};

/**
 * Retrieves a tx from storage.
 * @param {Object} opts
 * @param {string} opts.txProposalId - The tx id.
 * @returns {Object} txProposal
 */
WalletService.prototype.getTx = function(opts, cb) {
  var self = this;

  self.storage.fetchTx(self.walletId, opts.txProposalId, function(err, txp) {
    if (err) return cb(err);
    if (!txp) return cb(Errors.TX_NOT_FOUND);

    if (!txp.txid) return cb(null, txp);

    self.storage.fetchTxNote(self.walletId, txp.txid, function(err, note) {
      if (err) {
        log.warn('Error fetching tx note for ' + txp.txid);
      }
      txp.note = note;
      return cb(null, txp);
    });
  });
};

/**
 * Edit note associated to a txid.
 * @param {Object} opts
 * @param {string} opts.txid - The txid of the tx on the blockchain.
 * @param {string} opts.body - The contents of the note.
 */
WalletService.prototype.editTxNote = function(opts, cb) {
  var self = this;

  if (!checkRequired(opts, 'txid', cb)) return;

  self._runLocked(cb, function(cb) {
    self.storage.fetchTxNote(self.walletId, opts.txid, function(err, note) {
      if (err) return cb(err);

      if (!note) {
        note = Model.TxNote.create({
          walletId: self.walletId,
          txid: opts.txid,
          copayerId: self.copayerId,
          body: opts.body,
        });
      } else {
        note.edit(opts.body, self.copayerId);
      }
      self.storage.storeTxNote(note, function(err) {
        if (err) return cb(err);
        self.storage.fetchTxNote(self.walletId, opts.txid, cb);
      });
    });
  });
};

/**
 * Get tx notes.
 * @param {Object} opts
 * @param {string} opts.txid - The txid associated with the note.
 */
WalletService.prototype.getTxNote = function(opts, cb) {
  var self = this;

  if (!checkRequired(opts, 'txid', cb)) return;
  self.storage.fetchTxNote(self.walletId, opts.txid, cb);
};

/**
 * Get tx notes.
 * @param {Object} opts
 * @param {string} opts.minTs[=0] - The start date used to filter notes.
 */
WalletService.prototype.getTxNotes = function(opts, cb) {
  var self = this;

  opts = opts || {};
  self.storage.fetchTxNotes(self.walletId, opts, cb);
};

/**
 * removeWallet
 *
 * @param opts
 * @param cb
 * @return {undefined}
 */
WalletService.prototype.removeWallet = function(opts, cb) {
  var self = this;

  self._runLocked(cb, function(cb) {
    self.storage.removeWallet(self.walletId, cb);
  });
};

WalletService.prototype.getRemainingDeleteLockTime = function(txp) {
  var now = Math.floor(Date.now() / 1000);

  var lockTimeRemaining = txp.createdOn + Defaults.DELETE_LOCKTIME - now;
  if (lockTimeRemaining < 0)
    return 0;

  // not the creator? need to wait
  if (txp.creatorId !== this.copayerId)
    return lockTimeRemaining;

  // has other approvers? need to wait
  var approvers = txp.getApprovers();
  if (approvers.length > 1 || (approvers.length == 1 && approvers[0] !== this.copayerId))
    return lockTimeRemaining;

  return 0;
};


/**
 * removePendingTx
 *
 * @param opts
 * @param {string} opts.txProposalId - The tx id.
 * @return {undefined}
 */
WalletService.prototype.removePendingTx = function(opts, cb) {
  var self = this;

  if (!checkRequired(opts, ['txProposalId'], cb)) return;

  self._runLocked(cb, function(cb) {

    self.getTx({
      txProposalId: opts.txProposalId,
    }, function(err, txp) {
      if (err) return cb(err);

      if (!txp.isPending()) return cb(Errors.TX_NOT_PENDING);

      var deleteLockTime = self.getRemainingDeleteLockTime(txp);
      if (deleteLockTime > 0) return cb(Errors.TX_CANNOT_REMOVE);

      self.storage.removeTx(self.walletId, txp.id, function() {
        self._notifyTxProposalAction('TxProposalRemoved', txp, cb);
      });
    });
  });
};

WalletService.prototype._broadcastRawTx = function(network, raw, cb) {
  var bc = this._getBlockchainExplorer(network);
  bc.broadcast(raw, function(err, txid) {
    if (err) return cb(err);
    return cb(null, txid);
  });
};

/**
 * Broadcast a raw transaction.
 * @param {Object} opts
 * @param {string} [opts.network = 'livenet'] - The Bitcoin network for this transaction.
 * @param {string} opts.rawTx - Raw tx data.
 */
WalletService.prototype.broadcastRawTx = function(opts, cb) {
  var self = this;

  if (!checkRequired(opts, ['network', 'rawTx'], cb)) return;

  var network = opts.network || 'livenet';
  if (network != 'livenet' && network != 'testnet')
    return cb(new ClientError('Invalid network'));

  self._broadcastRawTx(network, opts.rawTx, cb);
};


WalletService.prototype._checkTxInBlockchain = function(txp, cb) {
  if (!txp.txid) return cb();
  var bc = this._getBlockchainExplorer(txp.getNetworkName());
  bc.getTransaction(txp.txid, function(err, tx) {
    if (err) return cb(err);
    return cb(null, !!tx);
  })
};

/**
 * Sign a transaction proposal.
 * @param {Object} opts
 * @param {string} opts.txProposalId - The identifier of the transaction.
 * @param {string} opts.signatures - The signatures of the inputs of this tx for this copayer (in apperance order)
 */
WalletService.prototype.signTx = function(opts, cb) {
  var self = this;

  if (!checkRequired(opts, ['txProposalId', 'signatures'], cb)) return;

  self.getWallet({}, function(err, wallet) {
    if (err) return cb(err);

    self.getTx({
      txProposalId: opts.txProposalId
    }, function(err, txp) {
      if (err) return cb(err);

      var action = _.find(txp.actions, {
        copayerId: self.copayerId
      });
      if (action) return cb(Errors.COPAYER_VOTED);
      if (!txp.isPending()) return cb(Errors.TX_NOT_PENDING);

      var copayer = wallet.getCopayer(self.copayerId);

      try {
        if (!txp.sign(self.copayerId, opts.signatures, copayer.xPubKey)) {
          log.warn('Error signing transaction (BAD_SIGNATURES)');
          log.warn('Wallet id:', self.walletId);
          log.warn('Copayer id:', self.copayerId);
          log.warn('Client version:', self.clientVersion);
          log.warn('Arguments:', JSON.stringify(opts));
          log.warn('Transaction proposal:', JSON.stringify(txp));
          var raw = txp.getBitcoreTx().uncheckedSerialize();
          log.warn('Raw tx:', raw);
          return cb(Errors.BAD_SIGNATURES);
        }
      } catch (ex) {
        log.error('Error signing transaction proposal', ex);
        return cb(ex);
      }

      self.storage.storeTx(self.walletId, txp, function(err) {
        if (err) return cb(err);

        async.series([

          function(next) {
            self._notifyTxProposalAction('TxProposalAcceptedBy', txp, {
              copayerId: self.copayerId,
            }, next);
          },
          function(next) {
            if (txp.isAccepted()) {
              self._notifyTxProposalAction('TxProposalFinallyAccepted', txp, next);
            } else {
              next();
            }
          },
        ], function() {
          return cb(null, txp);
        });
      });
    });
  });
};

WalletService.prototype._processBroadcast = function(txp, opts, cb) {
  var self = this;
  $.checkState(txp.txid);
  opts = opts || {};

  txp.setBroadcasted();
  self.storage.storeTx(self.walletId, txp, function(err) {
    if (err) return cb(err);

    var extraArgs = {
      txid: txp.txid,
    };
    if (opts.byThirdParty) {
      self._notifyTxProposalAction('NewOutgoingTxByThirdParty', txp, extraArgs);
    } else {
      self._notifyTxProposalAction('NewOutgoingTx', txp, extraArgs);
    }

    self.storage.softResetTxHistoryCache(self.walletId, function() {
      return cb(err, txp);
    });
  });
};


/**
 * Broadcast a transaction proposal.
 * @param {Object} opts
 * @param {string} opts.txProposalId - The identifier of the transaction.
 */
WalletService.prototype.broadcastTx = function(opts, cb) {
  var self = this;

  if (!checkRequired(opts, ['txProposalId'], cb)) return;

  self.getWallet({}, function(err, wallet) {
    if (err) return cb(err);

    self.getTx({
      txProposalId: opts.txProposalId
    }, function(err, txp) {
      if (err) return cb(err);

      if (txp.status == 'broadcasted') return cb(Errors.TX_ALREADY_BROADCASTED);
      if (txp.status != 'accepted') return cb(Errors.TX_NOT_ACCEPTED);

      var raw;
      try {
        raw = txp.getRawTx();
      } catch (ex) {
        return cb(ex);
      }
      self._broadcastRawTx(txp.getNetworkName(), raw, function(err, txid) {
        if (err) {
          var broadcastErr = err;
          // Check if tx already in blockchain
          self._checkTxInBlockchain(txp, function(err, isInBlockchain) {
            if (err) return cb(err);
            if (!isInBlockchain) return cb(broadcastErr);

            self._processBroadcast(txp, {
              byThirdParty: true
            }, cb);
          });
        } else {
          self._processBroadcast(txp, {
            byThirdParty: false
          }, function(err) {
            if (err) return cb(err);
            return cb(null, txp);
          });
        }
      });
    });
  });
};

/**
 * Reject a transaction proposal.
 * @param {Object} opts
 * @param {string} opts.txProposalId - The identifier of the transaction.
 * @param {string} [opts.reason] - A message to other copayers explaining the rejection.
 */
WalletService.prototype.rejectTx = function(opts, cb) {
  var self = this;

  if (!checkRequired(opts, ['txProposalId'], cb)) return;

  self.getTx({
    txProposalId: opts.txProposalId
  }, function(err, txp) {
    if (err) return cb(err);

    var action = _.find(txp.actions, {
      copayerId: self.copayerId
    });

    if (action) return cb(Errors.COPAYER_VOTED);
    if (txp.status != 'pending') return cb(Errors.TX_NOT_PENDING);

    txp.reject(self.copayerId, opts.reason);

    self.storage.storeTx(self.walletId, txp, function(err) {
      if (err) return cb(err);

      async.series([

        function(next) {
          self._notifyTxProposalAction('TxProposalRejectedBy', txp, {
            copayerId: self.copayerId,
          }, next);
        },
        function(next) {
          if (txp.status == 'rejected') {
            var rejectedBy = _.pluck(_.filter(txp.actions, {
              type: 'reject'
            }), 'copayerId');

            self._notifyTxProposalAction('TxProposalFinallyRejected', txp, {
              rejectedBy: rejectedBy,
            }, next);
          } else {
            next();
          }
        },
      ], function() {
        return cb(null, txp);
      });
    });
  });
};

/**
 * Retrieves pending transaction proposals.
 * @param {Object} opts
 * @returns {TxProposal[]} Transaction proposal.
 */
WalletService.prototype.getPendingTxs = function(opts, cb) {
  var self = this;

  self.storage.fetchPendingTxs(self.walletId, function(err, txps) {
    if (err) return cb(err);

    _.each(txps, function(txp) {
      txp.deleteLockTime = self.getRemainingDeleteLockTime(txp);
    });

    async.each(txps, function(txp, next) {
      if (txp.status != 'accepted') return next();

      self._checkTxInBlockchain(txp, function(err, isInBlockchain) {
        if (err || !isInBlockchain) return next(err);
        self._processBroadcast(txp, {
          byThirdParty: true
        }, next);
      });
    }, function(err) {
      return cb(err, _.reject(txps, function(txp) {
        return txp.status == 'broadcasted';
      }));
    });
  });
};

/**
 * Retrieves all transaction proposals in the range (maxTs-minTs)
 * Times are in UNIX EPOCH
 *
 * @param {Object} opts.minTs (defaults to 0)
 * @param {Object} opts.maxTs (defaults to now)
 * @param {Object} opts.limit
 * @returns {TxProposal[]} Transaction proposals, newer first
 */
WalletService.prototype.getTxs = function(opts, cb) {
  var self = this;
  self.storage.fetchTxs(self.walletId, opts, function(err, txps) {
    if (err) return cb(err);
    return cb(null, txps);
  });
};


/**
 * Retrieves notifications after a specific id or from a given ts (whichever is more recent).
 *
 * @param {Object} opts
 * @param {Object} opts.notificationId (optional)
 * @param {Object} opts.minTs (optional) - default 0.
 * @returns {Notification[]} Notifications
 */
WalletService.prototype.getNotifications = function(opts, cb) {
  var self = this;
  opts = opts || {};

  self.getWallet({}, function(err, wallet) {
    if (err) return cb(err);

    async.map([wallet.network, self.walletId], function(walletId, next) {
      self.storage.fetchNotifications(walletId, opts.notificationId, opts.minTs || 0, next);
    }, function(err, res) {
      if (err) return cb(err);

      var notifications = _.sortBy(_.map(_.flatten(res), function(n) {
        n.walletId = self.walletId;
        return n;
      }), 'id');

      return cb(null, notifications);
    });
  });
};

WalletService.prototype._normalizeTxHistory = function(txs) {
  var now = Math.floor(Date.now() / 1000);

  return _.map(txs, function(tx) {
    var inputs = _.map(tx.vin, function(item) {
      return {
        address: item.addr,
        amount: item.valueSat,
      }
    });

    var outputs = _.map(tx.vout, function(item) {
      var itemAddr;
      // If classic multisig, ignore
      if (item.scriptPubKey && _.isArray(item.scriptPubKey.addresses) && item.scriptPubKey.addresses.length == 1) {
        itemAddr = item.scriptPubKey.addresses[0];
      }

      return {
        address: itemAddr,
        amount: parseInt((item.value * 1e8).toFixed(0)),
      }
    });

    var t = tx.blocktime; // blocktime
    if (!t || _.isNaN(t)) t = tx.firstSeenTs;
    if (!t || _.isNaN(t)) t = now;

    return {
      txid: tx.txid,
      confirmations: tx.confirmations,
      blockheight: tx.blockheight,
      fees: parseInt((tx.fees * 1e8).toFixed(0)),
      time: t,
      inputs: inputs,
      outputs: outputs,
    };
  });
};

WalletService._cachedBlockheight;

WalletService._initBlockchainHeightCache = function() {
  if (WalletService._cachedBlockheight) return;
  WalletService._cachedBlockheight = {
    livenet: {},
    testnet: {}
  };
};

WalletService._clearBlockchainHeightCache = function(network) {
  WalletService._initBlockchainHeightCache();
  if (!_.contains(['livenet', 'testnet'], network)) {
    log.error('Incorrect network in new block: ' + network);
    return;
  }
  WalletService._cachedBlockheight[network].current = null;
};

WalletService.prototype._getBlockchainHeight = function(network, cb) {
  var self = this;

  var now = Date.now();
  WalletService._initBlockchainHeightCache();
  var cache = WalletService._cachedBlockheight[network];

  function fetchFromBlockchain(cb) {
    var bc = self._getBlockchainExplorer(network);
    bc.getBlockchainHeight(function(err, height) {
      if (!err && height > 0) {
        cache.current = height;
        cache.last = height;
        cache.updatedOn = now;
      }
      return cb(null, cache.last);
    });
  };

  if (!cache.current || (now - cache.updatedOn) > Defaults.BLOCKHEIGHT_CACHE_TIME * 1000) {
    return fetchFromBlockchain(cb);
  }

  return cb(null, cache.current);
};

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
WalletService.prototype.getTxHistory = function(opts, cb) {
  var self = this;


  opts = opts || {};
  opts.limit = (_.isUndefined(opts.limit) ? Defaults.HISTORY_LIMIT : opts.limit);
  if (opts.limit > Defaults.HISTORY_LIMIT)
    return cb(Errors.HISTORY_LIMIT_EXCEEDED);

  function decorate(wallet, txs, addresses, proposals, notes) {
    var indexedAddresses = _.indexBy(addresses, 'address');
    var indexedProposals = _.indexBy(proposals, 'txid');
    var indexedNotes = _.indexBy(notes, 'txid');

    function sum(items, isMine, isChange) {
      var filter = {};
      if (_.isBoolean(isMine)) filter.isMine = isMine;
      if (_.isBoolean(isChange)) filter.isChange = isChange;
      return _.sum(_.filter(items, filter), 'amount');
    };

    function classify(items) {
      return _.map(items, function(item) {
        var address = indexedAddresses[item.address];
        return {
          address: item.address,
          amount: item.amount,
          isMine: !!address,
          isChange: address ? (address.isChange || wallet.singleAddress) : false,
        }
      });
    };

    return _.map(txs, function(tx) {

      var amountIn, amountOut, amountOutChange;
      var amount, action, addressTo;
      var inputs, outputs;

      if (tx.outputs.length || tx.inputs.length) {

        inputs = classify(tx.inputs);
        outputs = classify(tx.outputs);

        amountIn = sum(inputs, true);
        amountOut = sum(outputs, true, false);
        amountOutChange = sum(outputs, true, true);
        if (amountIn == (amountOut + amountOutChange + (amountIn > 0 ? tx.fees : 0))) {
          amount = amountOut;
          action = 'moved';
        } else {
          amount = amountIn - amountOut - amountOutChange - (amountIn > 0 ? tx.fees : 0);
          action = amount > 0 ? 'sent' : 'received';
        }

        amount = Math.abs(amount);
        if (action == 'sent' || action == 'moved') {
          var firstExternalOutput = _.find(outputs, {
            isMine: false
          });
          addressTo = firstExternalOutput ? firstExternalOutput.address : 'N/A';
        };
      } else {
        action = 'invalid';
        amount = 0;
      }

      function formatOutput(o) {
        return {
          amount: o.amount,
          address: o.address
        }
      };

      var newTx = {
        txid: tx.txid,
        action: action,
        amount: amount,
        fees: tx.fees,
        time: tx.time,
        addressTo: addressTo,
        confirmations: tx.confirmations,
      };

      if (opts.includeExtendedInfo) {
        newTx.inputs = _.map(inputs, function(input) {
          return _.pick(input, 'address', 'amount', 'isMine');
        });
        newTx.outputs = _.map(outputs, function(output) {
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

      var proposal = indexedProposals[tx.txid];
      if (proposal) {
        newTx.createdOn = proposal.createdOn;
        newTx.proposalId = proposal.id;
        newTx.proposalType = proposal.type;
        newTx.creatorName = proposal.creatorName;
        newTx.message = proposal.message;
        newTx.actions = _.map(proposal.actions, function(action) {
          return _.pick(action, ['createdOn', 'type', 'copayerId', 'copayerName', 'comment']);
        });
        _.each(newTx.outputs, function(output) {
          var query = {
            toAddress: output.address,
            amount: output.amount
          };
          var txpOut = _.find(proposal.outputs, query);
          output.message = txpOut ? txpOut.message : null;
        });
        newTx.customData = proposal.customData;
        // newTx.sentTs = proposal.sentTs;
        // newTx.merchant = proposal.merchant;
        //newTx.paymentAckMemo = proposal.paymentAckMemo;
      }

      var note = indexedNotes[tx.txid];
      if (note) {
        newTx.note = _.pick(note, ['body', 'editedBy', 'editedByName', 'editedOn']);
      }

      return newTx;
    });
  };

  function getNormalizedTxs(addresses, from, to, cb) {
    var txs, fromCache, totalItems;
    var useCache = addresses.length >= Defaults.HISTORY_CACHE_ADDRESS_THRESOLD;
    var network = Bitcore.Address(addresses[0].address).toObject().network;

    async.series([

      function(next) {
        if (!useCache) return next();

        self.storage.getTxHistoryCache(self.walletId, from, to, function(err, res) {
          if (err) return next(err);
          if (!res || !res[0]) return next();

          txs = res;
          fromCache = true;

          return next()
        });
      },
      function(next) {
        if (txs) return next();

        var addressStrs = _.pluck(addresses, 'address');
        var bc = self._getBlockchainExplorer(network);
        bc.getTransactions(addressStrs, from, to, function(err, rawTxs, total) {
          if (err) return next(err);
          txs = self._normalizeTxHistory(rawTxs);
          totalItems = total;
          return next();
        });
      },
      function(next) {
        if (!useCache || fromCache) return next();

        var txsToCache = _.filter(txs, function(i) {
          return i.confirmations >= Defaults.CONFIRMATIONS_TO_START_CACHING;
        }).reverse();

        if (!txsToCache.length) return next();

        var fwdIndex = totalItems - to;
        if (fwdIndex < 0) fwdIndex = 0;
        self.storage.storeTxHistoryCache(self.walletId, totalItems, fwdIndex, txsToCache, next);
      },
      function(next) {
        if (!useCache || !fromCache) return next();
        if (!txs) return next();

        // Fix tx confirmations for cached txs
        self._getBlockchainHeight(network, function(err, height) {
          if (err || !height) return next(err);
          _.each(txs, function(tx) {
            if (tx.blockheight >= 0) {
              tx.confirmations = height - tx.blockheight + 1;
            }
          });
          next();
        });
      },
    ], function(err) {
      if (err) return cb(err);

      return cb(null, {
        items: txs,
        fromCache: fromCache
      });
    });
  };

  self.getWallet({}, function(err, wallet) {
    if (err) return cb(err);

    // Get addresses for this wallet
    self.storage.fetchAddresses(self.walletId, function(err, addresses) {
      if (err) return cb(err);
      if (addresses.length == 0) return cb(null, []);

      var from = opts.skip || 0;
      var to = from + opts.limit;


      async.waterfall([

        function(next) {
          getNormalizedTxs(addresses, from, to, next);
        },
        function(txs, next) {
          // Fetch all proposals in [t - 7 days, t + 1 day]
          var minTs = _.min(txs.items, 'time').time - 7 * 24 * 3600;
          var maxTs = _.max(txs.items, 'time').time + 1 * 24 * 3600;

          async.parallel([

            function(done) {
              self.storage.fetchTxs(self.walletId, {
                minTs: minTs,
                maxTs: maxTs
              }, done);
            },
            function(done) {
              self.storage.fetchTxNotes(self.walletId, {
                minTs: minTs
              }, done);
            },
          ], function(err, res) {
            return next(err, {
              txs: txs,
              txps: res[0],
              notes: res[1]
            });
          });
        },
      ], function(err, res) {
        if (err) return cb(err);

        var finalTxs = decorate(wallet, res.txs.items, addresses, res.txps, res.notes);

        if (res.txs.fromCache)
          log.debug("History from cache for:", self.walletId, from, to);

        return cb(null, finalTxs, !!res.txs.fromCache);
      });
    });
  });
};


/**
 * Scan the blockchain looking for addresses having some activity
 *
 * @param {Object} opts
 * @param {Boolean} opts.includeCopayerBranches (defaults to false)
 */
WalletService.prototype.scan = function(opts, cb) {
  var self = this;

  opts = opts || {};

  function checkActivity(address, network, cb) {
    var bc = self._getBlockchainExplorer(network);
    bc.getAddressActivity(address, cb);
  };

  function scanBranch(derivator, cb) {
    var inactiveCounter = 0;
    var allAddresses = [];
    var gap = Defaults.SCAN_ADDRESS_GAP;

    async.whilst(function() {
      return inactiveCounter < gap;
    }, function(next) {
      var address = derivator.derive();
      checkActivity(address.address, address.network, function(err, activity) {
        if (err) return next(err);

        allAddresses.push(address);
        inactiveCounter = activity ? 0 : inactiveCounter + 1;
        next();
      });
    }, function(err) {
      derivator.rewind(gap);
      return cb(err, _.dropRight(allAddresses, gap));
    });
  };


  self._runLocked(cb, function(cb) {
    self.getWallet({}, function(err, wallet) {
      if (err) return cb(err);
      if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

      wallet.scanStatus = 'running';

      self.storage.clearTxHistoryCache(self.walletId, function() {
        self.storage.storeWallet(wallet, function(err) {
          if (err) return cb(err);

          var derivators = [];
          _.each([false, true], function(isChange) {
            derivators.push({
              derive: _.bind(wallet.createAddress, wallet, isChange),
              rewind: _.bind(wallet.addressManager.rewindIndex, wallet.addressManager, isChange),
            });
            if (opts.includeCopayerBranches) {
              _.each(wallet.copayers, function(copayer) {
                if (copayer.addressManager) {
                  derivators.push({
                    derive: _.bind(copayer.createAddress, copayer, wallet, isChange),
                    rewind: _.bind(copayer.addressManager.rewindIndex, copayer.addressManager, isChange),
                  });
                }
              });
            }
          });

          async.eachSeries(derivators, function(derivator, next) {
            scanBranch(derivator, function(err, addresses) {
              if (err) return next(err);
              self.storage.storeAddressAndWallet(wallet, addresses, next);
            });
          }, function(error) {
            self.storage.fetchWallet(wallet.id, function(err, wallet) {
              if (err) return cb(err);
              wallet.scanStatus = error ? 'error' : 'success';
              self.storage.storeWallet(wallet, function() {
                return cb(error);
              });
            })
          });
        });
      });
    });
  });
};

/**
 * Start a scan process.
 *
 * @param {Object} opts
 * @param {Boolean} opts.includeCopayerBranches (defaults to false)
 */
WalletService.prototype.startScan = function(opts, cb) {
  var self = this;

  function scanFinished(err) {
    var data = {
      result: err ? 'error' : 'success',
    };
    if (err) data.error = err;
    self._notify('ScanFinished', data, {
      isGlobal: true
    });
  };

  self.getWallet({}, function(err, wallet) {
    if (err) return cb(err);
    if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

    setTimeout(function() {
      self.scan(opts, scanFinished);
    }, 100);

    return cb(null, {
      started: true
    });
  });
};

/**
 * Returns exchange rate for the specified currency & timestamp.
 * @param {Object} opts
 * @param {string} opts.code - Currency ISO code.
 * @param {Date} [opts.ts] - A timestamp to base the rate on (default Date.now()).
 * @param {String} [opts.provider] - A provider of exchange rates (default 'BitPay').
 * @returns {Object} rates - The exchange rate.
 */
WalletService.prototype.getFiatRate = function(opts, cb) {
  var self = this;

  if (!checkRequired(opts, ['code'], cb)) return;

  self.fiatRateService.getRate(opts, function(err, rate) {
    if (err) return cb(err);
    return cb(null, rate);
  });
};

WalletService.prototype.pushNotificationsSubscribe = function(opts, cb) {
  if (!checkRequired(opts, ['token'], cb)) return;

  var self = this;

  opts.user = self.walletId + '$' + self.copayerId;

  request({
    url: config.pushNotificationsOpts.pushServerUrl + '/subscribe',
    method: 'POST',
    json: true,
    body: opts
  }, function(err, response) {
    return cb(err, response);
  });
};

WalletService.prototype.pushNotificationsUnsubscribe = function(cb) {
  var self = this;

  request({
    url: config.pushNotificationsOpts.pushServerUrl + '/unsubscribe',
    method: 'POST',
    json: true,
    body: {
      user: self.walletId + '$' + self.copayerId
    }
  }, function(err, response) {
    return cb(err, response);
  });
};

module.exports = WalletService;
module.exports.ClientError = ClientError;
