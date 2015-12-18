'use strict';
var _ = require('lodash');
var $ = require('preconditions').singleton();
var async = require('async');
var log = require('npmlog');
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

var Model = require('./model');
var Wallet = Model.Wallet;

var initialized = false;

var lock;
var storage;
var blockchainExplorer;
var blockchainExplorerOpts;
var messageBroker;
var serviceVersion;

var HISTORY_LIMIT = 10;

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
  this.notifyTicker = 0;
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
    if (opts.messageBroker) {
      messageBroker = opts.messageBroker;
    } else {
      messageBroker = new MessageBroker(opts.messageBrokerOpts);
    }
    return cb();
  };

  async.series([

    function(next) {
      initStorage(next);
    },
    function(next) {
      initMessageBroker(next);
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
  var server = new WalletService();
  server._setClientVersion(opts.clientVersion);
  return server;
};

/**
 * Gets an instance of the server after authenticating the copayer.
 * @param {Object} opts
 * @param {string} opts.copayerId - The copayer id making the request.
 * @param {string} opts.message - The contents of the request to be signed.
 * @param {string} opts.signature - Signature of message to be verified using one of the copayer's requestPubKeys
 * @param {string} opts.clientVersion - A string that identifies the client issuing the request
 */
WalletService.getInstanceWithAuth = function(opts, cb) {
  if (!Utils.checkRequired(opts, ['copayerId', 'message', 'signature']))
    return cb(new ClientError('Required argument missing'));

  var server = new WalletService();
  server.storage.fetchCopayerLookup(opts.copayerId, function(err, copayer) {
    if (err) return cb(err);
    if (!copayer) return cb(new ClientError(Errors.codes.NOT_AUTHORIZED, 'Copayer not found'));

    var isValid = !!server._getSigningKey(opts.message, opts.signature, copayer.requestPubKeys);
    if (!isValid)
      return cb(new ClientError(Errors.codes.NOT_AUTHORIZED, 'Invalid signature'));

    server.copayerId = opts.copayerId;
    server.walletId = copayer.walletId;
    server._setClientVersion(opts.clientVersion);
    return cb(null, server);
  });
};

WalletService.prototype._runLocked = function(cb, task) {
  $.checkState(this.walletId);
  this.lock.runLocked(this.walletId, cb, task);
};


/**
 * Creates a new wallet.
 * @param {Object} opts
 * @param {string} opts.id - The wallet id.
 * @param {string} opts.name - The wallet name.
 * @param {number} opts.m - Required copayers.
 * @param {number} opts.n - Total copayers.
 * @param {string} opts.pubKey - Public key to verify copayers joining have access to the wallet secret.
 * @param {string} [opts.network = 'livenet'] - The Bitcoin network for this wallet.
 * @param {string} [opts.supportBIP44AndP2PKH = true] - Client supports BIP44 & P2PKH for new wallets.
 */
WalletService.prototype.createWallet = function(opts, cb) {
  var self = this,
    pubKey;

  if (!Utils.checkRequired(opts, ['name', 'm', 'n', 'pubKey']))
    return cb(new ClientError('Required argument missing'));

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

  if (!Utils.checkRequired(opts, ['copayerId', 'requestPubKey', 'signature']))
    return cb(new ClientError('Required argument missing'));

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
  function parse(version) {
    var v = {};

    if (!version) return null;

    var x = version.split('-');
    if (x.length != 2) {
      v.agent = version;
      return v;
    }
    v.agent = _.contains(['bwc', 'bws'], x[0]) ? 'bwc' : x[0];
    x = x[1].split('.');
    v.major = parseInt(x[0]);
    v.minor = parseInt(x[1]);
    v.patch = parseInt(x[2]);

    return v;
  };

  if (_.isUndefined(this.parsedClientVersion)) {
    this.parsedClientVersion = parse(this.clientVersion);
  }
  return this.parsedClientVersion;
};

WalletService.prototype._clientSupportsTXPv2 = function() {
  var version = this._parseClientVersion();
  if (!version) return false;
  if (version.agent != 'bwc') return true; // Asume 3rd party clients are up-to-date
  if (version.major == 0 && version.minor == 0) return false;
  return true;
};

WalletService.prototype._clientSupportsTXPv3 = function() {
  var version = this._parseClientVersion();
  if (!version) return false;
  if (version.agent != 'bwc') return true; // Asume 3rd party clients are up-to-date
  if (version.major < 2) return false;
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
 * @param {string} [opts.supportBIP44AndP2PKH = true] - Client supports BIP44 & P2PKH for joining wallets.
 */
WalletService.prototype.joinWallet = function(opts, cb) {
  var self = this;

  if (!Utils.checkRequired(opts, ['walletId', 'name', 'xPubKey', 'requestPubKey', 'copayerSignature']))
    return cb(new ClientError('Required argument missing'));

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

  self._runLocked(cb, function(cb) {
    self.getWallet({}, function(err, wallet) {
      if (err) return cb(err);
      if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

      self._canCreateAddress(opts.ignoreMaxGap, function(err, canCreate) {
        if (err) return cb(err);
        if (!canCreate) return cb(Errors.MAIN_ADDRESS_GAP_REACHED);

        var address = wallet.createAddress(false);

        self.storage.storeAddressAndWallet(wallet, address, function(err) {
          if (err) return cb(err);

          self._notify('NewAddress', {
            address: address.address,
          }, function() {
            return cb(null, address);
          });
        });
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

  if (!Utils.checkRequired(opts, ['message', 'signature']))
    return cb(new ClientError('Required argument missing'));

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
    this.blockchainExplorer = new BlockchainExplorer(opts);
  }

  return this.blockchainExplorer;
};

WalletService.prototype._getUtxos = function(addresses, cb) {
  var self = this;

  if (addresses.length == 0) return cb(null, []);
  var networkName = Bitcore.Address(addresses[0]).toObject().network;

  var bc = self._getBlockchainExplorer(networkName);
  bc.getUnspentUtxos(addresses, function(err, utxos) {
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

  async.waterfall([

    function(next) {
      if (_.isArray(addresses)) {
        if (!_.isEmpty(addresses)) {
          next(null, addresses);
        } else {
          next(null, []);
        }
      } else {
        self.storage.fetchAddresses(self.walletId, next);
      }
    },
    function(addresses, next) {
      if (addresses.length == 0) return next(null, []);

      var addressStrs = _.pluck(addresses, 'address');
      self._getUtxos(addressStrs, function(err, utxos) {
        if (err) return next(err);
        if (utxos.length == 0) return next(null, []);

        self.getPendingTxs({}, function(err, txps) {
          if (err) return next(err);

          var lockedInputs = _.map(_.flatten(_.pluck(txps, 'inputs')), utxoKey);
          var utxoIndex = _.indexBy(utxos, utxoKey);
          _.each(lockedInputs, function(input) {
            if (utxoIndex[input]) {
              utxoIndex[input].locked = true;
            }
          });

          // Needed for the clients to sign UTXOs
          var addressToPath = _.indexBy(addresses, 'address');
          _.each(utxos, function(utxo) {
            utxo.path = addressToPath[utxo.address].path;
            utxo.publicKeys = addressToPath[utxo.address].publicKeys;
          });

          return next(null, utxos);
        });
      });
    },
  ], cb);
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


WalletService.prototype._computeBytesToSendMax = function(utxos, cb) {
  var self = this;

  var unlockedUtxos = _.reject(utxos, 'locked');
  if (_.isEmpty(unlockedUtxos)) return cb(null, 0);

  self.getWallet({}, function(err, wallet) {
    if (err) return cb(err);

    var txp = Model.TxProposalLegacy.create({
      walletId: self.walletId,
      requiredSignatures: wallet.m,
      walletN: wallet.n,
    });
    txp.inputs = unlockedUtxos;

    var size = txp.getEstimatedSize();

    return cb(null, size);
  });
};

WalletService.prototype._getBalanceFromAddresses = function(addresses, cb) {
  var self = this;

  self._getUtxosForCurrentWallet(addresses, function(err, utxos) {
    if (err) return cb(err);

    var balance = self._totalizeUtxos(utxos);

    // Compute balance by address
    var byAddress = {};
    _.each(_.indexBy(utxos, 'address'), function(value, key) {
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

    self._computeBytesToSendMax(utxos, function(err, size) {
      if (err) {
        log.error('Could not compute size of send max transaction', err);
      }
      balance.totalBytesToSendMax = _.isNumber(size) ? size : null;
      return cb(null, balance);
    });
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
      result = _.map(result, function(r) {
        return index[r];
      });
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
                log.debug('Cache miss: balance in active addresses differs from final balance');
                self._notify('BalanceUpdated', fullBalance);
              }
            });
          }, 1);
          return;
        });
      }
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

    var levels = _.zipObject(_.map(points, function(p) {
      var feePerKb = _.isObject(result) ? +result[p] : -1;
      if (feePerKb < 0) {
        log.warn('Could not compute fee estimation (nbBlocks=' + p + ')');
      }
      return [p, Utils.strip(feePerKb * 1e8)];
    }));

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

  var network = opts.network || 'livenet';
  if (network != 'livenet' && network != 'testnet')
    return cb(new ClientError('Invalid network'));

  var levels = Defaults.FEE_LEVELS;
  var samplePoints = _.uniq(_.pluck(levels, 'nbBlocks'));
  self._sampleFeeLevels(network, samplePoints, function(err, feeSamples) {
    var values = _.map(levels, function(level) {
      var result = {
        level: level.name,
      };
      if (err || feeSamples[level.nbBlocks] < 0) {
        result.feePerKb = level.defaultValue;
        result.nbBlocks = null;
      } else {
        result.feePerKb = feeSamples[level.nbBlocks];
        result.nbBlocks = level.nbBlocks;
      }
      return result;
    });

    return cb(null, values);
  });
};

WalletService.prototype._checkTxAndEstimateFee = function(txp) {
  var bitcoreError;

  var serializationOpts = {
    disableIsFullySigned: true
  };
  if (!_.startsWith(txp.version, '1.')) {
    serializationOpts.disableSmallFees = true;
    serializationOpts.disableLargeFees = true;
  }

  try {
    txp.estimateFee();
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
  //todo: check inputs are ours and has enough value
  if (txp.inputs && txp.inputs.length > 0) {
    return cb(self._checkTxAndEstimateFee(txp));
  }

  function sortUtxos(utxos) {
    var list = _.map(utxos, function(utxo) {
      var order;
      if (utxo.confirmations == 0) {
        order = 0;
      } else if (utxo.confirmations < 6) {
        order = -1;
      } else {
        order = -2;
      }
      return {
        order: order,
        utxo: utxo
      };
    });
    return _.pluck(_.sortBy(list, 'order'), 'utxo');
  };

  self._getUtxosForCurrentWallet(null, function(err, utxos) {
    if (err) return cb(err);

    var excludeIndex = _.reduce(utxosToExclude, function(res, val) {
      res[val] = val;
      return res;
    }, {});

    utxos = _.reject(utxos, function(utxo) {
      return excludeIndex[utxo.txid + ":" + utxo.vout];
    });

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

    // Prepare UTXOs list
    utxos = _.reject(utxos, 'locked');
    if (txp.excludeUnconfirmedUtxos) {
      utxos = _.filter(utxos, 'confirmations');
    }

    var i = 0;
    var total = 0;
    var selected = [];
    var inputs = sortUtxos(utxos);

    var bitcoreTx, bitcoreError;

    while (i < inputs.length) {
      selected.push(inputs[i]);
      total += inputs[i].satoshis;
      i++;

      if (total >= txp.getTotalAmount()) {
        txp.setInputs(selected);
        bitcoreError = self._checkTxAndEstimateFee(txp);
        if (!bitcoreError) {
          return cb();
        }
      }
    }

    return cb(bitcoreError || new Error('Could not select tx inputs'));
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
    var backoffTime = 60 * Math.pow(Defaults.BACKOFF_TIME, exceededRejections);

    if (timeSinceLastRejection <= backoffTime)
      log.debug('Not allowing to create TX: timeSinceLastRejection/backoffTime', timeSinceLastRejection, backoffTime);

    return cb(null, timeSinceLastRejection > backoffTime);
  });
};

WalletService.prototype._validateOutputs = function(opts, wallet) {
  for (var i = 0; i < opts.outputs.length; i++) {
    var output = opts.outputs[i];
    output.valid = false;

    if (!Utils.checkRequired(output, ['toAddress', 'amount'])) {
      return new ClientError('Required outputs argument missing');
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
    if (output.amount < Bitcore.Transaction.DUST_AMOUNT) {
      return Errors.DUST_AMOUNT;
    }
    output.valid = true;
  }
  return null;
};

WalletService._getProposalHash = function(proposalHeader) {
  function getOldHash(toAddress, amount, message, payProUrl) {
    return [toAddress, amount, (message || ''), (payProUrl || '')].join('|');
  };

  // For backwards compatibility
  if (arguments.length > 1) {
    return getOldHash.apply(this, arguments);
  }

  return Stringify(proposalHeader);
};

/**
 * Creates a new transaction proposal.
 * @param {Object} opts
 * @param {string} opts.type - Proposal type.
 * @param {string} opts.toAddress || opts.outputs[].toAddress - Destination address.
 * @param {number} opts.amount || opts.outputs[].amount - Amount to transfer in satoshi.
 * @param {string} opts.outputs[].message - A message to attach to this output.
 * @param {string} opts.message - A message to attach to this transaction.
 * @param {string} opts.proposalSignature - S(toAddress|amount|message|payProUrl). Used by other copayers to verify the proposal.
 * @param {string} opts.inputs - Optional. Inputs for this TX
 * @param {string} opts.feePerKb - Optional: Use an alternative fee per KB for this TX
 * @param {string} opts.payProUrl - Optional: Paypro URL for peers to verify TX
 * @param {string} opts.excludeUnconfirmedUtxos - Optional: Do not use UTXOs of unconfirmed transactions as inputs
 * @returns {TxProposal} Transaction proposal.
 */
WalletService.prototype.createTxLegacy = function(opts, cb) {
  var self = this;

  if (!opts.outputs) {
    opts.outputs = _.pick(opts, ['amount', 'toAddress']);
  }
  opts.outputs = [].concat(opts.outputs);

  if (!Utils.checkRequired(opts, ['outputs', 'proposalSignature']))
    return cb(new ClientError('Required argument missing'));

  var type = opts.type || Model.TxProposalLegacy.Types.SIMPLE;
  if (!Model.TxProposalLegacy.isTypeSupported(type))
    return cb(new ClientError('Invalid proposal type'));

  var feePerKb = opts.feePerKb || Defaults.DEFAULT_FEE_PER_KB;
  if (feePerKb < Defaults.MIN_FEE_PER_KB || feePerKb > Defaults.MAX_FEE_PER_KB)
    return cb(new ClientError('Invalid fee per KB value'));

  self._runLocked(cb, function(cb) {
    self.getWallet({}, function(err, wallet) {
      if (err) return cb(err);
      if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

      var copayer = wallet.getCopayer(self.copayerId);
      var hash;
      if (!opts.type || opts.type == Model.TxProposalLegacy.Types.SIMPLE) {
        hash = WalletService._getProposalHash(opts.toAddress, opts.amount, opts.message, opts.payProUrl);
      } else {
        // should match bwc api _computeProposalSignature
        var header = {
          outputs: _.map(opts.outputs, function(output) {
            return _.pick(output, ['toAddress', 'amount', 'message']);
          }),
          message: opts.message,
          payProUrl: opts.payProUrl
        };
        hash = WalletService._getProposalHash(header)
      }

      var signingKey = self._getSigningKey(hash, opts.proposalSignature, copayer.requestPubKeys)
      if (!signingKey)
        return cb(new ClientError('Invalid proposal signature'));

      self._canCreateTx(function(err, canCreate) {
        if (err) return cb(err);
        if (!canCreate) return cb(Errors.TX_CANNOT_CREATE);

        if (type != Model.TxProposalLegacy.Types.EXTERNAL) {
          var validationError = self._validateOutputs(opts, wallet);
          if (validationError) {
            return cb(validationError);
          }
        }

        var txOpts = {
          type: type,
          walletId: self.walletId,
          creatorId: self.copayerId,
          outputs: opts.outputs,
          inputs: opts.inputs,
          toAddress: opts.toAddress,
          amount: opts.amount,
          message: opts.message,
          proposalSignature: opts.proposalSignature,
          changeAddress: wallet.createAddress(true),
          feePerKb: feePerKb,
          payProUrl: opts.payProUrl,
          requiredSignatures: wallet.m,
          requiredRejections: Math.min(wallet.m, wallet.n - wallet.m + 1),
          walletN: wallet.n,
          excludeUnconfirmedUtxos: !!opts.excludeUnconfirmedUtxos,
          addressType: wallet.addressType,
          derivationStrategy: wallet.derivationStrategy,
          customData: opts.customData,
        };

        if (signingKey.selfSigned) {
          txOpts.proposalSignaturePubKey = signingKey.key;
          txOpts.proposalSignaturePubKeySig = signingKey.signature;
        }

        var txp = Model.TxProposalLegacy.create(txOpts);

        if (!self._clientSupportsTXPv2()) {
          txp.version = '1.0.1';
        }

        self._selectTxInputs(txp, opts.utxosToExclude, function(err) {
          if (err) return cb(err);

          $.checkState(txp.inputs);

          self.storage.storeAddressAndWallet(wallet, txp.changeAddress, function(err) {
            if (err) return cb(err);

            self.storage.storeTx(wallet.id, txp, function(err) {
              if (err) return cb(err);

              self._notify('NewTxProposal', {
                amount: txp.getTotalAmount()
              }, function() {
                return cb(null, txp);
              });
            });
          });
        });
      });
    });
  });
};

/**
 * Creates a new transaction proposal.
 * @param {Object} opts
 * @param {Array} opts.outputs - List of outputs.
 * @param {string} opts.outputs[].toAddress - Destination address.
 * @param {number} opts.outputs[].amount - Amount to transfer in satoshi.
 * @param {string} opts.outputs[].message - A message to attach to this output.
 * @param {string} opts.message - A message to attach to this transaction.
 * @param {Array} opts.inputs - Optional. Inputs for this TX
 * @param {string} opts.feePerKb - Optional. Use an alternative fee per KB for this TX
 * @param {string} opts.payProUrl - Optional. Paypro URL for peers to verify TX
 * @param {string} opts.excludeUnconfirmedUtxos[=false] - Optional. Do not use UTXOs of unconfirmed transactions as inputs
 * @param {string} opts.validateOutputs[=true] - Optional. Perform validation on outputs.
 * @returns {TxProposal} Transaction proposal.
 */
WalletService.prototype.createTx = function(opts, cb) {
  var self = this;

  if (!Utils.checkRequired(opts, ['outputs']))
    return cb(new ClientError('Required argument missing'));

  var feePerKb = opts.feePerKb || Defaults.DEFAULT_FEE_PER_KB;
  if (feePerKb < Defaults.MIN_FEE_PER_KB || feePerKb > Defaults.MAX_FEE_PER_KB)
    return cb(new ClientError('Invalid fee per KB value'));

  self._runLocked(cb, function(cb) {
    self.getWallet({}, function(err, wallet) {
      if (err) return cb(err);
      if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

      self._canCreateTx(function(err, canCreate) {
        if (err) return cb(err);
        if (!canCreate) return cb(Errors.TX_CANNOT_CREATE);

        if (opts.validateOutputs !== false) {
          var validationError = self._validateOutputs(opts, wallet);
          if (validationError) {
            return cb(validationError);
          }
        }

        var txOpts = {
          walletId: self.walletId,
          creatorId: self.copayerId,
          inputs: opts.inputs,
          outputs: opts.outputs,
          message: opts.message,
          changeAddress: wallet.createAddress(true),
          feePerKb: feePerKb,
          payProUrl: opts.payProUrl,
          walletM: wallet.m,
          walletN: wallet.n,
          excludeUnconfirmedUtxos: !!opts.excludeUnconfirmedUtxos,
          validateOutputs: !opts.validateOutputs,
          addressType: wallet.addressType,
          customData: opts.customData,
        };

        var txp = Model.TxProposal.create(txOpts);

        self._selectTxInputs(txp, opts.utxosToExclude, function(err) {
          if (err) return cb(err);

          self.storage.storeAddressAndWallet(wallet, txp.changeAddress, function(err) {
            if (err) return cb(err);

            self.storage.storeTx(wallet.id, txp, function(err) {
              if (err) return cb(err);

              self._notify('NewTxProposal', {
                amount: txp.getTotalAmount()
              }, function() {
                return cb(null, txp);
              });
            });
          });
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
 * @param {string} opts.proposalSignaturePubKey - (Optional) An alternative public key used to verify the proposal signature.
 * @param {string} opts.proposalSignaturePubKeySig - (Optional) A signature used to validate the opts.proposalSignaturePubKey.
 */
WalletService.prototype.publishTx = function(opts, cb) {
  var self = this;

  function utxoKey(utxo) {
    return utxo.txid + '|' + utxo.vout
  };

  if (!Utils.checkRequired(opts, ['txProposalId', 'proposalSignature']))
    return cb(new ClientError('Required argument missing'));

  self._runLocked(cb, function(cb) {
    self.getWallet({}, function(err, wallet) {
      if (err) return cb(err);

      self.storage.fetchTx(self.walletId, opts.txProposalId, function(err, txp) {
        if (err) return cb(err);
        if (!txp) return cb(Errors.TX_NOT_FOUND);
        if (!txp.isTemporary()) return cb();

        var copayer = wallet.getCopayer(self.copayerId);

        var raw = txp.getRawTx();
        var signingKey = self._getSigningKey(raw, opts.proposalSignature, copayer.requestPubKeys);
        if (!signingKey) {
          return cb(new ClientError('Invalid proposal signature'));
        }

        // Verify signingKey
        if (opts.proposalSignaturePubKey) {
          if (opts.proposalSignaturePubKey != signingKey ||
            !self._verifyRequestPubKey(opts.proposalSignaturePubKey, opts.proposalSignaturePubKeySig, copayer.xPubKey)
          ) {
            return cb(new ClientError('Invalid proposal signing key'));
          }
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
            return cb();
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
    return cb(null, txp);
  });
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

  if (!Utils.checkRequired(opts, ['txProposalId']))
    return cb(new ClientError('Required argument missing'));

  self._runLocked(cb, function(cb) {

    self.getTx({
      txProposalId: opts.txProposalId,
    }, function(err, txp) {
      if (err) return cb(err);

      if (!txp.isPending()) return cb(Errors.TX_NOT_PENDING);

      var deleteLockTime = self.getRemainingDeleteLockTime(txp);
      if (deleteLockTime > 0) return cb(Errors.TX_CANNOT_REMOVE);

      self.storage.removeTx(self.walletId, txp.id, function() {
        self._notify('TxProposalRemoved', {}, cb);
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

  if (!Utils.checkRequired(opts, ['network', 'rawTx']))
    return cb(new ClientError('Required argument missing'));

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

  if (!Utils.checkRequired(opts, ['txProposalId', 'signatures']))
    return cb(new ClientError('Required argument missing'));

  self.getWallet({}, function(err, wallet) {
    if (err) return cb(err);

    self.getTx({
      txProposalId: opts.txProposalId
    }, function(err, txp) {
      if (err) return cb(err);

      if (!self._clientSupportsTXPv2()) {
        if (!_.startsWith(txp.version, '1.')) {
          return cb(new ClientError(Errors.codes.UPGRADE_NEEDED, 'To sign this spend proposal you need to upgrade your client app.'));
        }
      }

      var action = _.find(txp.actions, {
        copayerId: self.copayerId
      });
      if (action) return cb(Errors.COPAYER_VOTED);
      if (!txp.isPending()) return cb(Errors.TX_NOT_PENDING);

      var copayer = wallet.getCopayer(self.copayerId);

      if (!txp.sign(self.copayerId, opts.signatures, copayer.xPubKey))
        return cb(Errors.BAD_SIGNATURES);

      self.storage.storeTx(self.walletId, txp, function(err) {
        if (err) return cb(err);

        async.series([

          function(next) {
            self._notify('TxProposalAcceptedBy', {
              txProposalId: opts.txProposalId,
              copayerId: self.copayerId,
            }, next);
          },
          function(next) {
            if (txp.isAccepted()) {
              self._notify('TxProposalFinallyAccepted', {
                txProposalId: opts.txProposalId,
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
  });
};

WalletService.prototype._processBroadcast = function(txp, opts, cb) {
  var self = this;
  $.checkState(txp.txid);
  opts = opts || {};

  txp.setBroadcasted();
  self.storage.storeTx(self.walletId, txp, function(err) {
    if (err) return cb(err);

    var args = {
      txProposalId: txp.id,
      txid: txp.txid,
      amount: txp.getTotalAmount(),
    };

    if (opts.byThirdParty) {
      self._notify('NewOutgoingTxByThirdParty', args);
    } else {
      self._notify('NewOutgoingTx', args);
    }

    return cb(err, txp);
  });
};


/**
 * Broadcast a transaction proposal.
 * @param {Object} opts
 * @param {string} opts.txProposalId - The identifier of the transaction.
 */
WalletService.prototype.broadcastTx = function(opts, cb) {
  var self = this;

  if (!Utils.checkRequired(opts, ['txProposalId']))
    return cb(new ClientError('Required argument missing'));

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

  if (!Utils.checkRequired(opts, ['txProposalId']))
    return cb(new ClientError('Required argument missing'));

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
          self._notify('TxProposalRejectedBy', {
            txProposalId: opts.txProposalId,
            copayerId: self.copayerId,
          }, next);
        },
        function(next) {
          if (txp.status == 'rejected') {
            var rejectedBy = _.pluck(_.filter(txp.actions, {
              type: 'reject'
            }), 'copayerId');

            self._notify('TxProposalFinallyRejected', {
              txProposalId: opts.txProposalId,
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

    var v3Txps = _.any(txps, function(txp) {
      return txp.version >= 3;
    });
    if (v3Txps && !self._clientSupportsTXPv3()) {
      return cb(new ClientError(Errors.codes.UPGRADE_NEEDED, 'To view some of the pending proposals you need to upgrade your client app.'));
    }

    _.each(txps, function(txp) {
      txp.deleteLockTime = self.getRemainingDeleteLockTime(txp);
    });

    async.each(txps, function(txp, a_cb) {
      if (txp.status != 'accepted') return a_cb();

      self._checkTxInBlockchain(txp, function(err, isInBlockchain) {
        if (err || !isInBlockchain) return a_cb(err);
        self._processBroadcast(txp, {
          byThirdParty: true
        }, a_cb);
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
      fees: parseInt((tx.fees * 1e8).toFixed(0)),
      time: t,
      inputs: inputs,
      outputs: outputs,
    };
  });
};

/**
 * Retrieves all transactions (incoming & outgoing)
 * Times are in UNIX EPOCH
 *
 * @param {Object} opts
 * @param {Number} opts.skip (defaults to 0)
 * @param {Number} opts.limit
 * @returns {TxProposal[]} Transaction proposals, first newer
 */
WalletService.prototype.getTxHistory = function(opts, cb) {
  var self = this;

  opts = opts || {};
  opts.limit = (_.isUndefined(opts.limit) ? HISTORY_LIMIT : opts.limit);
  if (opts.limit > HISTORY_LIMIT)
    return cb(Errors.HISTORY_LIMIT_EXCEEDED);

  function decorate(txs, addresses, proposals) {

    var indexedAddresses = _.indexBy(addresses, 'address');
    var indexedProposals = _.indexBy(proposals, 'txid');

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
          isChange: address ? address.isChange : false,
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

      function outputMap(o) {
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
        outputs: _.map(_.filter(outputs, {
          isChange: false
        }), outputMap),
        confirmations: tx.confirmations,
      };

      var proposal = indexedProposals[tx.txid];
      if (proposal) {
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
        // newTx.sentTs = proposal.sentTs;
        // newTx.merchant = proposal.merchant;
        //newTx.paymentAckMemo = proposal.paymentAckMemo;
      }

      return newTx;
    });
  };

  // Get addresses for this wallet
  self.storage.fetchAddresses(self.walletId, function(err, addresses) {
    if (err) return cb(err);
    if (addresses.length == 0) return cb(null, []);

    var addressStrs = _.pluck(addresses, 'address');
    var networkName = Bitcore.Address(addressStrs[0]).toObject().network;

    var bc = self._getBlockchainExplorer(networkName);
    async.parallel([

      function(next) {
        self.storage.fetchTxs(self.walletId, {}, function(err, txps) {
          if (err) return next(err);
          next(null, txps);
        });
      },
      function(next) {
        var from = opts.skip || 0;
        var to = from + opts.limit;
        bc.getTransactions(addressStrs, from, to, function(err, txs) {
          if (err) return cb(err);
          next(null, self._normalizeTxHistory(txs));
        });
      },
    ], function(err, res) {
      if (err) return cb(err);

      var proposals = res[0];
      var txs = res[1];

      txs = decorate(txs, addresses, proposals);

      return cb(null, txs);
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


module.exports = WalletService;
module.exports.ClientError = ClientError;
