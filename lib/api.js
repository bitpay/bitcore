/** @namespace Client.API */
'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var util = require('util');
var async = require('async');
var events = require('events');
var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var sjcl = require('sjcl');
var io = require('socket.io-client');
var url = require('url');
var querystring = require('querystring');

var request;
if (process && !process.browser) {
  request = require('request');
} else {
  request = require('browser-request');
}

var PayPro = require('./paypro');
var log = require('./log');
var Credentials = require('./credentials');
var Verifier = require('./verifier');
var Package = require('../package.json');
var ClientError = require('./errors/clienterror');
var Errors = require('./errors/errordefinitions');



var BASE_URL = 'http://localhost:3232/bws/api';

/**
 * @desc ClientAPI constructor.
 *
 * @param {Object} opts
 * @constructor
 */
function API(opts) {
  opts = opts || {};

  this.verbose = !!opts.verbose;
  this.request = opts.request || request;
  this.baseUrl = opts.baseUrl || BASE_URL;
  var parsedUrl = url.parse(this.baseUrl);
  this.basePath = parsedUrl.path;
  this.baseHost = parsedUrl.protocol + '//' + parsedUrl.host;
  this.payProHttp = null; // Only for testing
  this.doNotVerifyPayPro = opts.doNotVerifyPayPro;

  this.transports = opts.transports || ['polling', 'websocket'];
  this.timeout = opts.timeout || 50000;


  if (this.verbose) {
    log.setLevel('debug');
  } else {
    log.setLevel('info');
  }
};
util.inherits(API, events.EventEmitter);

API.privateKeyEncryptionOpts = {
  iter: 10000
};

API.prototype.initNotifications = function(cb) {
  $.checkState(this.credentials);

  var self = this;
  var socket = io.connect(self.baseHost, {
    'force new connection': true,
    'reconnection': true,
    'reconnectionDelay': 5000,
    'secure': true,
    'transports': self.transports,
  });

  socket.on('unauthorized', function() {
    return cb(new Error('Could not establish web-sockets connection: Unauthorized'));
  });

  socket.on('authorized', function() {
    return cb();
  });

  socket.on('notification', function(data) {
    if (data.creatorId != self.credentials.copayerId) {
      self.emit('notification', data);
    }
  });

  socket.on('reconnecting', function() {
    self.emit('reconnecting');
  });

  socket.on('reconnect', function() {
    self.emit('reconnect');
  });

  socket.on('challenge', function(nonce) {
    $.checkArgument(nonce);

    var auth = {
      copayerId: self.credentials.copayerId,
      message: nonce,
      signature: WalletUtils.signMessage(nonce, self.credentials.requestPrivKey),
    };
    socket.emit('authorize', auth);
  });
};

/**
 * Encrypt a message
 * @private
 * @static
 * @memberof Client.API
 * @param {String} message
 * @param {String} encryptingKey
 */
API._encryptMessage = function(message, encryptingKey) {
  if (!message) return null;
  return WalletUtils.encryptMessage(message, encryptingKey);
};

/**
 * Decrypt a message
 * @private
 * @static
 * @memberof Client.API
 * @param {String} message
 * @param {String} encryptingKey
 */
API._decryptMessage = function(message, encryptingKey) {
  if (!message) return '';
  try {
    return WalletUtils.decryptMessage(message, encryptingKey);
  } catch (ex) {
    return '<ECANNOTDECRYPT>';
  }
};

/**
 * Decrypt text fields in transaction proposals
 * @private
 * @static
 * @memberof Client.API
 * @param {Array} txps
 * @param {String} encryptingKey
 */
API.prototype._processTxps = function(txps) {
  var self = this;
  if (!txps) return;

  var encryptingKey = self.credentials.sharedEncryptingKey;
  _.each([].concat(txps), function(txp) {
    txp.encryptedMessage = txp.message;
    txp.message = API._decryptMessage(txp.message, encryptingKey) || null;

    _.each(txp.actions, function(action) {
      action.comment = API._decryptMessage(action.comment, encryptingKey);
      // TODO get copayerName from Credentials -> copayerId to copayerName
      // action.copayerName = null;
    });
    _.each(txp.outputs, function(output) {
      output.encryptedMessage = output.message;
      output.message = API._decryptMessage(output.message, encryptingKey) || null;
    });
    txp.hasUnconfirmedInputs = _.any(txp.inputs, function(input) {
      return input.confirmations == 0;
    });
  });
};

/**
 * Parse errors
 * @private
 * @static
 * @memberof Client.API
 * @param {Object} body
 */
API._parseError = function(body) {
  if (_.isString(body)) {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {
        error: body
      };
    }
  }
  var ret;
  if (body && body.code) {
    ret = new ClientError(body.code, body.message);
  } else {
    ret = {
      code: 'ERROR',
      error: body ? body.error : 'There was an unknown error processing the request',
    };
  }
  log.error(ret);
  return ret;
};

/**
 * Sign an HTTP request
 * @private
 * @static
 * @memberof Client.API
 * @param {String} method - The HTTP method
 * @param {String} url - The URL for the request
 * @param {Object} args - The arguments in case this is a POST/PUT request
 * @param {String} privKey - Private key to sign the request
 */
API._signRequest = function(method, url, args, privKey) {
  var message = [method.toLowerCase(), url, JSON.stringify(args)].join('|');
  return WalletUtils.signMessage(message, privKey);
};


/**
 * Seed from random
 *
 * @param {String} network
 */
API.prototype.seedFromRandom = function(network) {
  this.credentials = Credentials.create(network);
};

/**
 * Seed from random with mnemonic
 *
 * @param {String} network
 * @param {String} Optional: BIP39 passphrase
 * @param {String} Optional: BIP39 language
 */
API.prototype.seedFromRandomWithMnemonic = function(network, passphrase, language) {
  this.credentials = Credentials.createWithMnemonic(network, passphrase, language);
};

API.prototype.getMnemonic = function() {
  return this.credentials.getMnemonic();
};

API.prototype.mnemonicHasPassphrase = function() {
  return this.credentials.mnemonicHasPassphrase;
};



API.prototype.clearMnemonic = function() {
  return this.credentials.clearMnemonic();
};


/**
 * Seed from extended private key
 *
 * @param {String} xPrivKey
 */
API.prototype.seedFromExtendedPrivateKey = function(xPrivKey) {
  this.credentials = Credentials.fromExtendedPrivateKey(xPrivKey);
};


/**
 * Seed from Mnemonics (language autodetected)
 * Can throw an error if mnemonic is invalid
 *
 * @param {String} BIP39 words
 * @param {String} Optional: BIP39 passphrase
 * @param {String} Optional: 'livenet' or 'testnet'
 */
API.prototype.seedFromMnemonic = function(words, passphrase, network) {
  this.credentials = Credentials.fromMnemonic(words, passphrase, network);
};

/**
 * Seed from external wallet public key
 *
 * @param {String} xPubKey - Extended public key
 * @param {String} source - name of external wallet source (ex: ledger)
 * @param {String} entropySourceHex -  an HEX string containing random data, that can be reproducible by the device. NOTE: It should not be possible to derive entropySourceHex from xPubkey.
 */
API.prototype.seedFromExtendedPublicKey = function(xPubKey, source, entropySourceHex) {
  $.checkArgument(!arguments[3], "DEPRECATED: seedFromExtendedPublicKey should receive only 3 parameters");
  this.credentials = Credentials.fromExtendedPublicKey(xPubKey, source, entropySourceHex);
}


/**
 * Export wallet
 *
 * @param {Object} opts
 * @param {Boolean} opts.noSign
 */
API.prototype.export = function(opts) {
  $.checkState(this.credentials);

  opts = opts || {};

  var output;

  var c = Credentials.fromObj(this.credentials);

  if (opts.noSign) {
    c.setNoSign();
  }

  output = JSON.stringify(c.toObj());

  return output;
}


/**
 * Import wallet
 *
 * @param {Object} str
 * @param {Object} opts
 * @param {String} opts.password If the source has the private key encrypted, the password
 * will be needed for derive credentials fields.
 */
API.prototype.import = function(str, opts) {
  opts = opts || {};
  try {
    var credentials = Credentials.fromObj(JSON.parse(str));
    this.credentials = credentials;
  } catch (ex) {
    throw Errors.INVALID_BACKUP;
  }
};

API.prototype._import = function(cb) {
  $.checkState(this.credentials);

  var self = this;

  // First option, grab wallet info from BWS.
  self.openWallet(function(err, ret) {

    // it worked?
    if (!err) return cb(null, ret);

    // Is the error other than "copayer was not found"? || or no priv key.
    if (err.code != 'NOT_AUTHORIZED' || self.isPrivKeyExternal())
      return cb(err);

    //Second option, lets try to add an access
    log.info('Copayer not found, trying to add access');
    self.addAccess({}, function(err) {

      // it worked?
      if (!err) self.openWallet(cb);

      return cb(Errors.WALLET_DOES_NOT_EXIST)
    });
  });
};

API.prototype.importFromMnemonic = function(words, opts, cb) {
  log.debug('Importing from 12 Words');

  try {
    this.credentials = Credentials.fromMnemonic(words, opts.passphrase, opts.network);
  } catch (e) {
    log.info('Mnemonic error:', e);
    return cb(Errors.INVALID_BACKUP);
  };

  this._import(cb);
};


API.prototype.importFromExtendedPrivateKey = function(xPrivKey, cb) {
  log.debug('Importing from Extended Private Key');
  try {
    this.credentials = Credentials.fromExtendedPrivateKey(xPrivKey);
  } catch (e) {
    log.info('xPriv error:', e);
    return cb(Errors.INVALID_BACKUP);
  };

  this._import(cb);
};


API.prototype.importFromExtendedPublicKey = function(xPubKey, source, entropySourceHex, cb) {
  $.checkArgument(!arguments[4], "DEPRECATED: seedFromExtendedPublicKey should receive only 3 parameters");
  log.debug('Importing from Extended Private Key');
  try {
    this.credentials = Credentials.fromExtendedPublicKey(xPubKey, source, entropySourceHex);
  } catch (e) {
    log.info('xPriv error:', e);
    return cb(Errors.INVALID_BACKUP);
  };

  this._import(cb);
};


/**
 * Open a wallet and try to complete the public key ring.
 *
 * @param {Callback} cb - The callback that handles the response. It returns a flag indicating that the wallet is complete.
 * @fires API#walletCompleted
 */
API.prototype.openWallet = function(cb) {
  $.checkState(this.credentials);
  var self = this;
  if (self.credentials.isComplete() && self.credentials.hasWalletInfo())
    return cb(null, true);

  self._doGetRequest('/v2/wallets/?includeExtendedInfo=1', function(err, ret) {
    if (err) return cb(err);
    var wallet = ret.wallet;

    if (wallet.status != 'complete')
      return cb();

    if (self.credentials.walletPrivKey) {
      if (!Verifier.checkCopayers(self.credentials, wallet.copayers)) {
        return cb(Errors.SERVER_COMPROMISED);
      }
    } else {
      // this should only happends in AIR-GAPPED flows
      log.warn('Could not verify copayers key (missing wallet Private Key)');
    }

    // Wallet was not complete. We are completing it.
    self.credentials.addPublicKeyRing(API._extractPublicKeyRing(wallet.copayers));

    if (!self.credentials.hasWalletInfo()) {
      var me = _.find(wallet.copayers, {
        id: self.credentials.copayerId
      });
      self.credentials.addWalletInfo(wallet.id, wallet.name, wallet.m, wallet.n, null, me.name);
    }
    self.emit('walletCompleted', wallet);

    self._processTxps(ret.pendingTxps);
    self._processCustomData(ret);

    return cb(null, ret);
  });
};



/**
 * Do an HTTP request
 * @private
 *
 * @param {Object} method
 * @param {String} url
 * @param {Object} args
 * @param {Callback} cb
 */
API.prototype._doRequest = function(method, url, args, cb) {
  $.checkState(this.credentials);

  var reqSignature;

  var key = args._requestPrivKey || this.credentials.requestPrivKey;
  if (key) {
    delete args['_requestPrivKey'];
    reqSignature = API._signRequest(method, url, args, key);
  }

  var absUrl = this.baseUrl + url;
  var args = {
    // relUrl: only for testing with `supertest`
    relUrl: this.basePath + url,
    headers: {
      'x-identity': this.credentials.copayerId,
      'x-signature': reqSignature,
      'x-client-version': 'bwc-' + Package.version,
    },
    method: method,
    url: absUrl,
    body: args,
    json: true,
    withCredentials: false,
    timeout: this.timeout,
  };

  log.debug('Request Args', util.inspect(args, {
    depth: 10
  }));

  this.request(args, function(err, res, body) {
    log.debug(util.inspect(body, {
      depth: 10
    }));
    if (!res) {
      return cb({
        code: 'CONNECTION_ERROR',
      });
    }

    if (res.statusCode != 200) {
      if (res.statusCode == 404)
        return cb({
          code: 'NOT_FOUND'
        });

      if (!res.statusCode)
        return cb({
          code: 'CONNECTION_ERROR',
        });

      return cb(API._parseError(body));
    }

    if (body === '{"error":"read ECONNRESET"}')
      return cb(JSON.parse(body));

    return cb(null, body, res.header);
  });
};

/**
 * Do a POST request
 * @private
 *
 * @param {String} url
 * @param {Object} args
 * @param {Callback} cb
 */
API.prototype._doPostRequest = function(url, args, cb) {
  return this._doRequest('post', url, args, cb);
};

API.prototype._doPutRequest = function(url, args, cb) {
  return this._doRequest('put', url, args, cb);
};

/**
 * Do a GET request
 * @private
 *
 * @param {String} url
 * @param {Callback} cb
 */
API.prototype._doGetRequest = function(url, cb) {
  url += url.indexOf('?') > 0 ? '&' : '?';
  url += 'r=' + _.random(10000, 99999);
  return this._doRequest('get', url, {}, cb);
};

/**
 * Do a DELETE request
 * @private
 *
 * @param {String} url
 * @param {Callback} cb
 */
API.prototype._doDeleteRequest = function(url, cb) {
  return this._doRequest('delete', url, {}, cb);
};

/**
 * Join
 * @private
 *
 * @param {String} walletId
 * @param {String} walletPrivKey
 * @param {String} xPubKey
 * @param {String} requestPubKey
 * @param {String} copayerName
 * @param {Object} Optional args
 * @param {String} opts.customData
 * @param {Callback} cb
 */
API.prototype._doJoinWallet = function(walletId, walletPrivKey, xPubKey, requestPubKey, copayerName, opts, cb) {
  $.shouldBeFunction(cb);
  opts = opts || {};

  // Adds encrypted walletPrivateKey to CustomData
  opts.customData = opts.customData || {};
  opts.customData.walletPrivKey = walletPrivKey.toString();;
  var encCustomData = WalletUtils.encryptMessage(JSON.stringify(opts.customData),
    this.credentials.personalEncryptingKey);

  var args = {
    walletId: walletId,
    name: copayerName,
    xPubKey: xPubKey,
    requestPubKey: requestPubKey,
    customData: encCustomData,
  };
  if (opts.dryRun) args.dryRun = true;

  if (_.isBoolean(opts.supportBIP44AndP2PKH))
    args.supportBIP44AndP2PKH = opts.supportBIP44AndP2PKH;

  var hash = WalletUtils.getCopayerHash(args.name, args.xPubKey, args.requestPubKey);
  args.copayerSignature = WalletUtils.signMessage(hash, walletPrivKey);

  var url = '/v2/wallets/' + walletId + '/copayers';
  this._doPostRequest(url, args, function(err, body) {
    if (err) return cb(err);
    return cb(null, body.wallet);
  });
};

/**
 * Return if wallet is complete
 */
API.prototype.isComplete = function() {
  return this.credentials && this.credentials.isComplete();
};

/**
 * Is private key currently encrypted? (ie, locked)
 *
 * @return {Boolean}
 */
API.prototype.isPrivKeyEncrypted = function() {
  return this.credentials && this.credentials.isPrivKeyEncrypted();
};

/**
 * Is private key encryption setup?
 *
 * @return {Boolean}
 */
API.prototype.hasPrivKeyEncrypted = function() {
  return this.credentials && this.credentials.hasPrivKeyEncrypted();
};

/**
 * Is private key external?
 *
 * @return {Boolean}
 */
API.prototype.isPrivKeyExternal = function() {
  return this.credentials && this.credentials.hasExternalSource();
};

/**
 * Get external wallet source name
 *
 * @return {String}
 */
API.prototype.getPrivKeyExternalSourceName = function() {
  return this.credentials ? this.credentials.getExternalSourceName() : null;
};

/**
 * unlocks the private key. `lock` need to be called explicity
 * later to remove the unencrypted private key.
 *
 * @param password
 */
API.prototype.unlock = function(password) {
  try {
    this.credentials.unlock(password);
  } catch (e) {
    throw new Error('Could not unlock:' + e);
  }
};

/**
 * Can this credentials sign a transaction?
 * (Only returns fail on a 'proxy' setup for airgapped operation)
 *
 * @return {undefined}
 */
API.prototype.canSign = function() {
  return this.credentials && this.credentials.canSign();
};


API._extractPublicKeyRing = function(copayers) {
  return _.map(copayers, function(copayer) {
    var pkr = _.pick(copayer, ['xPubKey', 'requestPubKey']);
    pkr.copayerName = copayer.name;
    return pkr;
  });
};

/**
 * sets up encryption for the extended private key
 *
 * @param {String} password Password used to encrypt
 * @param {Object} opts optional: SJCL options to encrypt (.iter, .salt, etc).
 * @return {undefined}
 */
API.prototype.setPrivateKeyEncryption = function(password, opts) {
  this.credentials.setPrivateKeyEncryption(password, opts || API.privateKeyEncryptionOpts);
};

/**
 * disables encryption for private key.
 * wallet must be unlocked
 *
 */
API.prototype.disablePrivateKeyEncryption = function(password, opts) {
  return this.credentials.disablePrivateKeyEncryption();
};

/**
 * Locks private key (removes the unencrypted version and keep only the encrypted)
 *
 * @return {undefined}
 */
API.prototype.lock = function() {
  this.credentials.lock();
};


/**
 * Get current fee levels for the specified network
 *
 * @param {string} network - 'livenet' (default) or 'testnet'
 * @param {Callback} cb
 * @returns {Callback} cb - Returns error or an object with status information
 */
API.prototype.getFeeLevels = function(network, cb) {
  var self = this;

  $.checkArgument(network || _.contains(['livenet', 'testnet'], network));

  self._doGetRequest('/v1/feelevels/?network=' + (network || 'livenet'), function(err, result) {
    if (err) return cb(err);
    return cb(err, result);
  });
};

/**
 * Get service version
 *
 * @param {Callback} cb
 */
API.prototype.getVersion = function(cb) {
  this._doGetRequest('/v1/version/', cb);
};

/**
 *
 * Create a wallet.
 * @param {String} walletName
 * @param {String} copayerName
 * @param {Number} m
 * @param {Number} n
 * @param {object} opts (optional: advanced options)
 * @param {string} opts.network - 'livenet' or 'testnet'
 * @param {String} opts.walletPrivKey - set a walletPrivKey (instead of random)
 * @param {String} opts.id - set a id for wallet (instead of server given)
 * @param {String} opts.withMnemonics - generate credentials
 * @param cb
 * @return {undefined}
 */
API.prototype.createWallet = function(walletName, copayerName, m, n, opts, cb) {
  var self = this;
  if (opts) $.shouldBeObject(opts);
  opts = opts || {};

  var network = opts.network || 'livenet';
  if (!_.contains(['testnet', 'livenet'], network)) return cb(new Error('Invalid network'));

  if (!self.credentials) {
    log.info('Generating new keys');
    self.seedFromRandom(network);
  } else {
    log.info('Using existing keys');
  }

  if (network != self.credentials.network) {
    return cb(new Error('Existing keys were created for a different network'));
  }

  var walletPrivKey = opts.walletPrivKey || new Bitcore.PrivateKey();
  var args = {
    name: walletName,
    m: m,
    n: n,
    pubKey: (new Bitcore.PrivateKey(walletPrivKey)).toPublicKey().toString(),
    network: network,
    id: opts.id,
  };
  self._doPostRequest('/v2/wallets/', args, function(err, body) {
    if (err) return cb(err);

    var walletId = body.walletId;
    var secret = WalletUtils.toSecret(walletId, walletPrivKey, network);
    self.credentials.addWalletInfo(walletId, walletName, m, n, walletPrivKey.toString(), copayerName);

    self._doJoinWallet(walletId, walletPrivKey, self.credentials.xPubKey, self.credentials.requestPubKey, copayerName, {},
      function(err, wallet) {
        if (err) return cb(err);
        return cb(null, n > 1 ? secret : null);
      });
  });
};

/**
 * Join an existent wallet
 *
 * @param {String} secret
 * @param {String} copayerName
 * @param {Object} opts
 * @param {Boolean} opts.dryRun[=false] - Simulate wallet join
 * @param {Callback} cb
 * @returns {Callback} cb - Returns the wallet
 */
API.prototype.joinWallet = function(secret, copayerName, opts, cb) {
  var self = this;

  if (!cb) {
    cb = opts;
    opts = {};
    log.warn('DEPRECATED WARN: joinWallet should receive 4 parameters.')
  }

  opts = opts || {};

  try {
    var secretData = WalletUtils.fromSecret(secret);
  } catch (ex) {
    return cb(ex);
  }

  if (!self.credentials) {
    self.seedFromRandom(secretData.network);
  }

  self._doJoinWallet(secretData.walletId, secretData.walletPrivKey, self.credentials.xPubKey, self.credentials.requestPubKey, copayerName, {
    dryRun: !!opts.dryRun,
  }, function(err, wallet) {
    if (err) return cb(err);
    if (!opts.dryRun) {
      self.credentials.addWalletInfo(wallet.id, wallet.name, wallet.m, wallet.n, secretData.walletPrivKey.toString(), copayerName);
    }
    return cb(null, wallet);
  });
};

/**
 * Recreates a wallet, given credentials (with wallet id)
 *
 * @returns {Callback} cb - Returns the wallet
 */
API.prototype.recreateWallet = function(cb) {
  $.checkState(this.credentials);
  $.checkState(this.credentials.isComplete());
  $.checkState(this.credentials.walletPrivKey);
  //$.checkState(this.credentials.hasWalletInfo());
  var self = this;

  // First: Try to get the wallet with current credentials
  this.getStatus({
    includeExtendedInfo: true
  }, function(err) {
    // No error? -> Wallet is ready.
    if (!err) {
      log.info('Wallet is already created');
      return cb();
    };
    var walletPrivKey = Bitcore.PrivateKey.fromString(self.credentials.walletPrivKey);
    var walletId = self.credentials.walletId;
    var supportBIP44AndP2PKH = self.credentials.derivationStrategy == WalletUtils.DERIVATION_STRATEGIES.BIP44;

    var args = {
      name: self.credentials.walletName || 'recovered wallet',
      m: self.credentials.m,
      n: self.credentials.n,
      pubKey: walletPrivKey.toPublicKey().toString(),
      network: self.credentials.network,
      id: walletId,
      supportBIP44AndP2PKH: supportBIP44AndP2PKH,
    };

    self._doPostRequest('/v2/wallets/', args, function(err, body) {
      if (err) {
        if (err.code != 'WALLET_ALREADY_EXISTS')
          return cb(err);

        return self.addAccess({}, function(err) {
          if (err) return cb(err);
          self.openWallet(function(err) {
            return cb(err);
          });
        });
      }

      if (!walletId) {
        walletId = body.walletId;
      }

      var i = 1;
      async.each(self.credentials.publicKeyRing, function(item, next) {
        var name = item.copayerName || ('copayer ' + i++);
        self._doJoinWallet(walletId, walletPrivKey, item.xPubKey, item.requestPubKey, name, {
          supportBIP44AndP2PKH: supportBIP44AndP2PKH,
        }, function(err) {
          //Ignore error is copayer already in wallet
          if (err && err.code == 'COPAYER_IN_WALLET') return next();
          return next(err);
        });
      }, cb);
    });
  });
};


API.prototype._processCustomData = function(result) {
  var copayers = result.wallet.copayers;
  if (!copayers) return;

  var me = _.find(copayers, {
    'id': this.credentials.copayerId
  });
  if (!me || !me.customData) return;

  var customData;
  try {
    customData = JSON.parse(WalletUtils.decryptMessage(me.customData, this.credentials.personalEncryptingKey));
  } catch (e) {
    log.warn('Could not decrypt customData:', me.customData);
  }
  if (!customData) return;

  // Add it to result
  result.customData = customData;

  // Update walletPrivateKey
  if (!this.credentials.walletPrivKey && customData.walletPrivKey)
    this.credentials.addWalletPrivateKey(customData.walletPrivKey)
}

/**
 * Get status of the wallet
 *
 * @param {object} opts.includeExtendedInfo (optional: query extended status)
 * @returns {Callback} cb - Returns error or an object with status information
 */
API.prototype.getStatus = function(opts, cb) {
  $.checkState(this.credentials);

  if (!cb) {
    cb = opts;
    opts = {};
    log.warn('DEPRECATED WARN: getStatus should receive 2 parameters.')
  }

  var self = this;
  opts = opts || {};

  self._doGetRequest('/v2/wallets/?includeExtendedInfo=' + (opts.includeExtendedInfo ? '1' : '0'), function(err, result) {
    if (err) return cb(err);
    if (result.wallet.status == 'pending') {
      var cred = self.credentials;
      result.wallet.secret = WalletUtils.toSecret(cred.walletId, cred.walletPrivKey, cred.network);
    }
    self._processTxps(result.pendingTxps);
    self._processCustomData(result);
    return cb(err, result);
  });
};

/**
 * Get copayer preferences
 *
 * @param {Callback} cb
 * @return {Callback} cb - Return error or object
 */
API.prototype.getPreferences = function(cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(cb);

  var self = this;
  self._doGetRequest('/v1/preferences/', function(err, preferences) {
    if (err) return cb(err);
    return cb(null, preferences);
  });
};

/**
 * Save copayer preferences
 *
 * @param {Object} preferences
 * @param {Callback} cb
 * @return {Callback} cb - Return error or object
 */
API.prototype.savePreferences = function(preferences, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(cb);

  var self = this;
  self._doPutRequest('/v1/preferences/', preferences, cb);
};


API.prototype._computeProposalSignature = function(args) {
  var hash;
  if (args.outputs) {
    $.shouldBeArray(args.outputs);
    // should match bws server createTx
    var proposalHeader = {
      outputs: _.map(args.outputs, function(output) {
        $.shouldBeNumber(output.amount);
        return _.pick(output, ['toAddress', 'amount', 'message']);
      }),
      message: args.message || null,
      payProUrl: args.payProUrl
    };
    hash = WalletUtils.getProposalHash(proposalHeader);
  } else {
    $.shouldBeNumber(args.amount);
    hash = WalletUtils.getProposalHash(args.toAddress, args.amount, args.message || null, args.payProUrl);
  }
  return WalletUtils.signMessage(hash, this.credentials.requestPrivKey);
}

/**
 * fetchPayPro
 *
 * @param opts.payProUrl  URL for paypro request
 * @returns {Callback} cb - Return error or the parsed payment protocol request
 * Returns (err,paypro)
 *  paypro.amount
 *  paypro.toAddress
 *  paypro.memo
 */
API.prototype.fetchPayPro = function(opts, cb) {
  $.checkArgument(opts)
    .checkArgument(opts.payProUrl);

  PayPro.get({
    url: opts.payProUrl,
    http: this.payProHttp,
  }, function(err, paypro) {
    if (err)
      return cb(err || 'Could not fetch PayPro request');

    return cb(null, paypro);
  });
};

/**
 * Gets list of utxos
 *
 * @param {Function} cb
 * @param {Object} opts
 * @param {Array} opts.addresses (optional) - List of addresses from where to fetch UTXOs.
 * @returns {Callback} cb - Return error or the list of utxos
 */
API.prototype.getUtxos = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  opts = opts || {};
  var url = '/v1/utxos/';
  if (opts.addresses) {
    url += '?' + querystring.stringify({
      addresses: [].concat(opts.addresses).join(',')
    });
  }
  this._doGetRequest(url, cb);
};

/**
 * Send a transaction proposal
 *
 * @param {Object} opts
 * @param {String} opts.toAddress | opts.outputs[].toAddress
 * @param {Number} opts.amount | opts.outputs[].amount
 * @param {String} opts.message | opts.outputs[].message
 * @param {string} opts.feePerKb - Optional: Use an alternative fee per KB for this TX
 * @param {String} opts.payProUrl - Optional: Tx is from a payment protocol URL
 * @param {string} opts.excludeUnconfirmedUtxos - Optional: Do not use UTXOs of unconfirmed transactions as inputs
 * @returns {Callback} cb - Return error or the transaction proposal
 */
API.prototype.sendTxProposal = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(!opts.message || this.credentials.sharedEncryptingKey, 'Cannot create transaction with message without shared Encrypting key');
  $.checkArgument(opts);

  var self = this;

  var args = {
    toAddress: opts.toAddress,
    amount: opts.amount,
    message: API._encryptMessage(opts.message, this.credentials.sharedEncryptingKey) || null,
    feePerKb: opts.feePerKb,
    payProUrl: opts.payProUrl,
    excludeUnconfirmedUtxos: !!opts.excludeUnconfirmedUtxos,
    type: opts.type,
    outputs: _.cloneDeep(opts.outputs),
    customData: opts.customData
  };
  if (args.outputs) {
    _.each(args.outputs, function(o) {
      o.message = API._encryptMessage(o.message, self.credentials.sharedEncryptingKey) || null;
    });
  }
  log.debug('Generating & signing tx proposal:', JSON.stringify(args));
  args.proposalSignature = this._computeProposalSignature(args);

  this._doPostRequest('/v1/txproposals/', args, function(err, txp) {
    if (err) return cb(err);
    return cb(null, txp);
  });
};

/**
 * Create a new address
 *
 * @param {Callback} cb
 * @returns {Callback} cb - Return error or the address
 */
API.prototype.createAddress = function(cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;

  self._doPostRequest('/v1/addresses/', {}, function(err, address) {
    if (err) return cb(err);

    if (!Verifier.checkAddress(self.credentials, address)) {
      return cb(Errors.SERVER_COMPROMISED);
    }

    return cb(null, address);
  });
};

/**
 * Get your main addresses
 *
 * @param {Object} opts
 * @param {Boolean} opts.doNotVerify
 * @param {Callback} cb
 * @returns {Callback} cb - Return error or the array of addresses
 */
API.prototype.getMainAddresses = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  var self = this;

  self._doGetRequest('/v1/addresses/', function(err, addresses) {
    if (err) return cb(err);

    if (!opts.doNotVerify) {
      var fake = _.any(addresses, function(address) {
        return !Verifier.checkAddress(self.credentials, address);
      });
      if (fake)
        return cb(Errors.SERVER_COMPROMISED);
    }

    var basePath = WalletUtils.PATHS.BASE_ADDRESS_DERIVATION[self.credentials.derivationStrategy][self.credentials.network];
    _.each(addresses, function(addr) {
      addr.path = basePath + addr.path.substring(1);
    });

    return cb(null, addresses);
  });
};

/**
 * Update wallet balance
 *
 * @param {Callback} cb
 */
API.prototype.getBalance = function(cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  this._doGetRequest('/v1/balance/', cb);
};

/**
 * Get list of transactions proposals
 *
 * @param {Object} opts
 * @param {Boolean} opts.doNotVerify
 * @param {Boolean} opts.forAirGapped
 * @return {Callback} cb - Return error or array of transactions proposals
 */
API.prototype.getTxProposals = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;

  self._doGetRequest('/v1/txproposals/', function(err, txps) {
    if (err) return cb(err);

    self._processTxps(txps);
    async.every(txps,
      function(txp, acb) {
        if (opts.doNotVerify) return acb(true);
        self.getPayPro(txp, function(err, paypro) {

          var isLegit = Verifier.checkTxProposal(self.credentials, txp, {
            paypro: paypro,
          });

          return acb(isLegit);
        });
      },
      function(isLegit) {
        if (!isLegit)
          return cb(Errors.SERVER_COMPROMISED);

        var result;
        if (opts.forAirGapped) {
          result = {
            txps: JSON.parse(JSON.stringify(txps)),
            encryptedPkr: WalletUtils.encryptMessage(JSON.stringify(self.credentials.publicKeyRing), self.credentials.personalEncryptingKey),
            m: self.credentials.m,
            n: self.credentials.n,
          };
        } else {
          result = txps;
        }
        return cb(null, result);
      });
  });
};

API.prototype.getPayPro = function(txp, cb) {
  var self = this;
  if (!txp.payProUrl || this.doNotVerifyPayPro)
    return cb();

  PayPro.get({
    url: txp.payProUrl,
    http: self.payProHttp,
  }, function(err, paypro) {
    if (err) return cb(new Error('Cannot check transaction now:' + err));
    return cb(null, paypro);
  });
};


/**
 * Sign a transaction proposal
 *
 * @param {Object} txp
 * @param {Callback} cb
 * @return {Callback} cb - Return error or object
 */
API.prototype.signTxProposal = function(txp, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(txp.creatorId);

  var self = this;

  if (!self.canSign() && !txp.signatures)
    return cb(new Error('You do not have the required keys to sign transactions'));

  if (self.isPrivKeyEncrypted())
    return cb(new Error('Private Key is encrypted, cannot sign'));

  self.getPayPro(txp, function(err, paypro) {
    if (err) return cb(err);

    var isLegit = Verifier.checkTxProposal(self.credentials, txp, {
      paypro: paypro,
    });

    if (!isLegit)
      return cb(Errors.SERVER_COMPROMISED);

    var signatures = txp.signatures || WalletUtils.signTxp(txp, self.credentials.xPrivKey);

    var url = '/v1/txproposals/' + txp.id + '/signatures/';
    var args = {
      signatures: signatures
    };

    self._doPostRequest(url, args, function(err, txp) {
      if (err) return cb(err);
      self._processTxps([txp]);
      return cb(null, txp);
    });
  })
};

/**
 * Sign transaction proposal from AirGapped
 *
 * @param {Object} txp
 * @param {String} encryptedPkr
 * @param {Number} m
 * @param {Number} n
 * @return {Object} txp - Return transaction
 */
API.prototype.signTxProposalFromAirGapped = function(txp, encryptedPkr, m, n) {
  $.checkState(this.credentials);

  var self = this;

  if (!self.canSign())
    throw Errors.MISSING_PRIVATE_KEY;

  if (self.isPrivKeyEncrypted())
    throw Errors.ENCRYPTED_PRIVATE_KEY;

  var publicKeyRing;
  try {
    publicKeyRing = JSON.parse(WalletUtils.decryptMessage(encryptedPkr, self.credentials.personalEncryptingKey));
  } catch (ex) {
    throw new Error('Could not decrypt public key ring');
  }

  if (!_.isArray(publicKeyRing) || publicKeyRing.length != n) {
    throw new Error('Invalid public key ring');
  }

  self.credentials.m = m;
  self.credentials.n = n;
  self.derivationStrategy = txp.derivationStrategy;
  self.addressType = txp.addressType;
  self.credentials.addPublicKeyRing(publicKeyRing);

  if (!Verifier.checkTxProposalBody(self.credentials, txp))
    throw new Error('Fake transaction proposal');

  return WalletUtils.signTxp(txp, self.credentials.xPrivKey);
};


/**
 * Reject a transaction proposal
 *
 * @param {Object} txp
 * @param {String} reason
 * @param {Callback} cb
 * @return {Callback} cb - Return error or object
 */
API.prototype.rejectTxProposal = function(txp, reason, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(cb);

  var self = this;

  var url = '/v1/txproposals/' + txp.id + '/rejections/';
  var args = {
    reason: API._encryptMessage(reason, self.credentials.sharedEncryptingKey) || '',
  };
  self._doPostRequest(url, args, function(err, txp) {
    if (err) return cb(err);
    self._processTxps([txp]);
    return cb(null, txp);
  });
};

/**
 * Broadcast raw transaction
 *
 * @param {Object} opts
 * @param {String} opts.network
 * @param {String} opts.rawTx
 * @param {Callback} cb
 * @return {Callback} cb - Return error or txid
 */
API.prototype.broadcastRawTx = function(opts, cb) {
  $.checkState(this.credentials);
  $.checkArgument(cb);

  var self = this;

  opts = opts || {};

  var url = '/v1/broadcast_raw/';
  self._doPostRequest(url, opts, function(err, txid) {
    if (err) return cb(err);
    return cb(null, txid);
  });
};

API.prototype._doBroadcast = function(txp, cb) {
  var self = this;
  var url = '/v1/txproposals/' + txp.id + '/broadcast/';
  self._doPostRequest(url, {}, function(err, txp) {
    if (err) return cb(err);
    return cb(null, txp);
  });
};


/**
 * Broadcast a transaction proposal
 *
 * @param {Object} txp
 * @param {Callback} cb
 * @return {Callback} cb - Return error or object
 */
API.prototype.broadcastTxProposal = function(txp, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;

  self.getPayPro(txp, function(err, paypro) {

    if (paypro) {

      var t = WalletUtils.buildTx(txp);
      self.createAddress(function(err, addr) {
        if (err) return cb(err);

        PayPro.send({
          http: self.payProHttp,
          url: txp.payProUrl,
          amountSat: txp.amount,
          refundAddr: addr.address,
          merchant_data: paypro.merchant_data,
          rawTx: t.uncheckedSerialize(),
        }, function(err, ack, memo) {
          if (err) return cb(err);
          self._doBroadcast(txp, function(err, txp) {
            return cb(err, txp, memo);
          });
        });
      });
    } else {
      self._doBroadcast(txp, cb);
    }
  });
};

/**
 * Remove a transaction proposal
 *
 * @param {Object} txp
 * @param {Callback} cb
 * @return {Callback} cb - Return error or empty
 */
API.prototype.removeTxProposal = function(txp, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;

  var url = '/v1/txproposals/' + txp.id;
  self._doDeleteRequest(url, function(err) {
    return cb(err);
  });
};

/**
 * Get transaction history
 *
 * @param {Object} opts
 * @param {Number} opts.skip (defaults to 0)
 * @param {Number} opts.limit
 * @param {Callback} cb
 * @return {Callback} cb - Return error or array of transactions
 */
API.prototype.getTxHistory = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;
  var args = [];
  if (opts) {
    if (opts.skip) args.push('skip=' + opts.skip);
    if (opts.limit) args.push('limit=' + opts.limit);
  }
  var qs = '';
  if (args.length > 0) {
    qs = '?' + args.join('&');
  }

  var url = '/v1/txhistory/' + qs;
  self._doGetRequest(url, function(err, txs) {
    if (err) return cb(err);
    self._processTxps(txs);
    return cb(null, txs);
  });
};

/**
 * getTx
 *
 * @param {String} TransactionId
 * @return {Callback} cb - Return error or transaction
 */
API.prototype.getTx = function(id, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;
  var url = '/v1/txproposals/' + id;
  this._doGetRequest(url, function(err, tx) {
    if (err) return cb(err);

    self._processTxps([tx]);
    return cb(null, tx);
  });
};


/**
 * Start an address scanning process.
 * When finished, the scanning process will send a notification 'ScanFinished' to all copayers.
 *
 * @param {Object} opts
 * @param {Boolean} opts.includeCopayerBranches (defaults to false)
 * @param {Callback} cb
 */
API.prototype.startScan = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;

  var args = {
    includeCopayerBranches: opts.includeCopayerBranches,
  };

  self._doPostRequest('/v1/addresses/scan', args, function(err) {
    return cb(err);
  });
};

/*
 *
 * Compatibility Functions
 *
 */

API.prototype._oldCopayDecrypt = function(username, password, blob) {
  var SEP1 = '@#$';
  var SEP2 = '%^#@';

  var decrypted;
  try {
    var passphrase = username + SEP1 + password;
    decrypted = sjcl.decrypt(passphrase, blob);
  } catch (e) {
    passphrase = username + SEP2 + password;
    try {
      decrypted = sjcl.decrypt(passphrase, blob);
    } catch (e) {
      log.debug(e);
    };
  }

  if (!decrypted)
    return null;

  var ret;
  try {
    ret = JSON.parse(decrypted);
  } catch (e) {};
  return ret;
};


API.prototype.getWalletIdsFromOldCopay = function(username, password, blob) {
  var p = this._oldCopayDecrypt(username, password, blob);
  if (!p) return null;
  var ids = p.walletIds.concat(_.keys(p.focusedTimestamps));
  return _.uniq(ids);
};


/**
 * createWalletFromOldCopay
 *
 * @param username
 * @param password
 * @param blob
 * @param cb
 * @return {undefined}
 */
API.prototype.createWalletFromOldCopay = function(username, password, blob, cb) {
  var self = this;
  var w = this._oldCopayDecrypt(username, password, blob);
  if (!w) return cb('Could not decrypt');

  if (w.publicKeyRing.copayersExtPubKeys.length != w.opts.totalCopayers)
    return cb('Wallet is incomplete, cannot be imported');

  this.credentials = Credentials.fromOldCopayWallet(w);
  this.recreateWallet(cb);
};

/*
  Adds access to the current copayer
 * @param {Object} opts
 * @param {bool} opts.generateNewKey Optional: generate a new key for the new access
 * @param {string} opts.restrictions
 *    - cannotProposeTXs
 *    - cannotXXX TODO
 * @param {string} opts.name  (name for the new access)
 *
 * return the accesses Wallet and the requestPrivateKey
 */
API.prototype.addAccess = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.canSign());

  var reqPrivKey = new Bitcore.PrivateKey(opts.generateNewKey ? null : this.credentials.requestPrivKey);
  var requestPubKey = reqPrivKey.toPublicKey().toString();

  var xPriv = new Bitcore.HDPrivateKey(this.credentials.xPrivKey)
    .derive(WalletUtils.PATHS.BASE_ADDRESS_DERIVATION[this.credentials.derivationStrategy][this.credentials.network]);
  var sig = WalletUtils.signRequestPubKey(requestPubKey, xPriv);
  var copayerId = this.credentials.copayerId;

  var opts = {
    copayerId: copayerId,
    requestPubKey: requestPubKey,
    signature: sig,
    name: opts.name,
    restrictions: opts.restrictions,
  };

  this._doPutRequest('/v1/copayers/' + copayerId + '/', opts, function(err, res) {
    if (err) return cb(err);
    return cb(null, res.wallet, reqPrivKey);
  });
};


module.exports = API;
