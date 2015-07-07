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
var ServerCompromisedError = require('./servercompromisederror');
var ClientError = require('./clienterror');
var Package = require('../package.json');

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
  var encryptingKey = self.credentials.sharedEncryptingKey;

  if (!txps) return;
  _.each([].concat(txps), function(txp) {
    txp.encryptedMessage = txp.message;
    txp.message = API._decryptMessage(txp.message, encryptingKey);

    _.each(txp.actions, function(action) {
      action.comment = API._decryptMessage(action.comment, encryptingKey);
      // TODO get copayerName from Credentials -> copayerId to copayerName
      // action.copayerName = null;
    });
    _.each(txp.outputs, function(output) {
      output.encryptedMessage = output.message;
      output.message = API._decryptMessage(output.message, encryptingKey);
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
 * Seed from extended private key
 *
 * @param {String} xPrivKey
 */
API.prototype.seedFromExtendedPrivateKey = function(xPrivKey) {
  this.credentials = Credentials.fromExtendedPrivateKey(xPrivKey);
};


/**
 * Export wallet
 *
 * @param {Object} opts
 * @param {Boolean} opts.compressed
 * @param {Boolean} opts.noSign
 */
API.prototype.export = function(opts) {
  $.checkState(this.credentials);

  opts = opts || {};

  var output;

  var cred = Credentials.fromObj(this.credentials);
  if (opts.noSign) {
    delete cred.xPrivKey;
    delete cred.xPrivKeyEncrypted;
  }

  if (opts.compressed) {
    output = cred.exportCompressed();
  } else {
    output = JSON.stringify(cred.toObj());
  }

  return output;
}


/**
 * Import wallet
 *
 * @param {Object} opts
 * @param {Boolean} opts.compressed
 * @param {String} opts.password If the source has the private key encrypted, the password
 * will be needed for derive credentials fields.
 */
API.prototype.import = function(str, opts) {
  opts = opts || {};

  var credentials;
  try {
    if (opts.compressed) {
      credentials = Credentials.importCompressed(str, opts.password);
      // HACK: simulate incomplete credentials
      delete credentials.m;
    } else {
      credentials = Credentials.fromObj(JSON.parse(str));
    }
  } catch (ex) {
    throw new Error('Error importing from source:' + ex);
  }
  this.credentials = credentials;
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

  if (this.credentials.requestPrivKey || args._requestPrivKey) {
    reqSignature = API._signRequest(method, url, args, args._requestPrivKey || this.credentials.requestPrivKey);
  }

  var absUrl = this.baseUrl + url;
  var args = {
    // relUrl: only for testing with `supertest`
    relUrl: this.basePath + url,
    headers: {
      'x-identity': this.credentials.copayerId,
      'x-signature': reqSignature,
      'x-client-version': 'bws-' + Package.version,
    },
    method: method,
    url: absUrl,
    body: args,
    json: true,
    withCredentials: false,
    timeout: 10000
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
        code: 'CONNERROR',
      });
    }

    if (res.statusCode != 200) {
      if (res.statusCode == 404)
        return cb({
          code: 'NOTFOUND'
        });

      if (!res.statusCode)
        return cb({
          code: 'CONNERROR',
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
 * @param {Object} .isTemporaryRequestKey
 * @param {Callback} cb
 */
API.prototype._doJoinWallet = function(walletId, walletPrivKey, xPubKey, requestPubKey, copayerName, opts, cb) {
  opts = opts || {};
  $.shouldBeFunction(cb);

  var args = {
    walletId: walletId,
    name: copayerName,
    xPubKey: xPubKey,
    requestPubKey: requestPubKey,
    isTemporaryRequestKey: !!opts.isTemporaryRequestKey,
  };
  var hash = WalletUtils.getCopayerHash(args.name, args.xPubKey, args.requestPubKey);
  args.copayerSignature = WalletUtils.signMessage(hash, walletPrivKey);

  var url = '/v1/wallets/' + walletId + '/copayers';
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
    var pkr = _.pick(copayer, ['xPubKey', 'requestPubKey', 'isTemporaryRequestKey']);
    pkr.copayerName = copayer.name;
    return pkr;
  });
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

  var wasComplete = self.credentials.isComplete();

  if (wasComplete && !self.credentials.hasTemporaryRequestKeys())
    return cb(null, true);

  self._doGetRequest('/v1/wallets/', function(err, ret) {
    if (err) return cb(err);
    var wallet = ret.wallet;

    if (wallet.status != 'complete')
      return cb();

    if (self.credentials.walletPrivKey) {

      if (!Verifier.checkCopayers(self.credentials, wallet.copayers)) {
        return cb(new ServerCompromisedError(
          'Copayers in the wallet could not be verified to have known the wallet secret'));
      }
    } else {
      log.warn('Could not verify copayers key (missing wallet Private Key)');
    }

    if (wasComplete) {

      // Wallet was completed. We are just updating temporary request keys

      self.credentials.updatePublicKeyRing(API._extractPublicKeyRing(wallet.copayers));
      if (!self.credentials.hasTemporaryRequestKeys())
        self.emit('walletCompleted', wallet);
    } else {


      // Wallet was not complete. We are completing it.

      self.credentials.addPublicKeyRing(API._extractPublicKeyRing(wallet.copayers));

      if (!self.credentials.hasWalletInfo()) {
        var me = _.find(wallet.copayers, {
          id: self.credentials.copayerId
        });
        self.credentials.addWalletInfo(wallet.id, wallet.name, wallet.m, wallet.n, null, me.name);
      }
      self.emit('walletCompleted', wallet);
    }
    if (ret.pendingTxps)
      self._processTxps(ret.pendingTxps);

    return cb(null, ret);
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
 *
 * Create a wallet.
 * @param {String} walletName
 * @param {String} copayerName
 * @param {Number} m
 * @param {Number} n
 * @param {Object} opts (Optional: advanced options)
 * @param {String} opts.network - 'livenet' or 'testnet'
 * @param {String} opts.walletPrivKey - set a walletPrivKey (instead of random)
 * @param {String} opts.id - set a id for wallet (instead of server given)
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
  self._doPostRequest('/v1/wallets/', args, function(err, body) {
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
 * Join to an existent wallet
 *
 * @param {String} secret
 * @param {String} copayerName
 * @param {Callback} cb
 * @returns {Callback} cb - Returns the wallet
 */
API.prototype.joinWallet = function(secret, copayerName, cb) {
  var self = this;

  try {
    var secretData = WalletUtils.fromSecret(secret);
  } catch (ex) {
    return cb(ex);
  }

  if (!self.credentials) {
    self.seedFromRandom(secretData.network);
  }

  self._doJoinWallet(secretData.walletId, secretData.walletPrivKey, self.credentials.xPubKey, self.credentials.requestPubKey, copayerName, {},
    function(err, wallet) {
      if (err) return cb(err);
      self.credentials.addWalletInfo(wallet.id, wallet.name, wallet.m, wallet.n, secretData.walletPrivKey.toString(), copayerName);
      return cb(null, wallet);
    });
};

/**
 * Recreate a wallet
 *
 * @returns {Callback} cb - Returns the wallet
 */
API.prototype.recreateWallet = function(cb) {
  $.checkState(this.credentials && this.credentials.isComplete() && this.credentials.hasWalletInfo());

  var self = this;

  var walletPrivKey = Bitcore.PrivateKey.fromString(self.credentials.walletPrivKey);
  var walletId = self.credentials.walletId;
  var args = {
    name: self.credentials.walletName || 'recovered wallet',
    m: self.credentials.m,
    n: self.credentials.n,
    pubKey: walletPrivKey.toPublicKey().toString(),
    network: self.credentials.network,
    id: walletId,
  };
  self._doPostRequest('/v1/wallets/', args, function(err, body) {
    // Ignore error is wallet already exist
    if (err && err.code != 'WEXISTS') return cb(err);


    var i = 1;
    async.each(self.credentials.publicKeyRing, function(item, next) {
      var name = item.copayerName || ('copayer ' + i++);
      self._doJoinWallet(walletId, walletPrivKey, item.xPubKey, item.requestPubKey, name, {
        isTemporaryRequestKey: item.isTemporaryRequestKey,
      }, function(err) {
        //Ignore error is copayer already in wallet
        if (err && err.code == 'CINWALLET') return next();
        return next(err);
      });
    }, cb);
  });
};


/**
 * Get status of the wallet
 *
 * @param {Callback} cb
 * @returns {Callback} cb - Returns error or an object with status information
 */
API.prototype.getStatus = function(cb) {
  $.checkState(this.credentials);
  var self = this;

  self._doGetRequest('/v1/wallets/', function(err, result) {
    if (err) return cb(err);
    if (result.wallet.status == 'pending') {
      var cred = self.credentials;
      result.wallet.secret = WalletUtils.toSecret(cred.walletId, cred.walletPrivKey, cred.network);
    }
    self._processTxps(result.pendingTxps);
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
        return _.pick(output, ['toAddress', 'amount', 'message']);
      }),
      message: args.message,
      payProUrl: args.payProUrl
    };
    hash = WalletUtils.getProposalHash(proposalHeader);
  } else {
    $.shouldBeNumber(args.amount);
    hash = WalletUtils.getProposalHash(args.toAddress, args.amount, args.message, args.payProUrl);
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
 * Send a transaction proposal
 *
 * @param {Object} opts
 * @param {String} opts.toAddress | opts.outputs[].toAddress
 * @param {Number} opts.amount | opts.outputs[].amount
 * @param {String} opts.message | opts.outputs[].message
 * @param {string} opts.feePerKb - Optional: Use an alternative fee per KB for this TX
 * @param {String} opts.payProUrl - Optional: Tx is from a payment protocol URL
 * @returns {Callback} cb - Return error or the transaction proposal
 */
API.prototype.sendTxProposal = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(opts);

  var self = this;

  var args = {
    toAddress: opts.toAddress,
    amount: opts.amount,
    message: API._encryptMessage(opts.message, this.credentials.sharedEncryptingKey),
    feePerKb: opts.feePerKb,
    payProUrl: opts.payProUrl,
    type: opts.type,
    outputs: opts.outputs,
  };
  if (args.outputs) {
    _.each(args.outputs, function(o) {
      o.message = API._encryptMessage(o.message, self.credentials.sharedEncryptingKey);
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
      return cb(new ServerCompromisedError('Server sent fake address'));
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
        return cb(new ServerCompromisedError('Server sent fake address'));
    }
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
          return cb(new ServerCompromisedError('Server sent fake transaction proposal'));

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
      return cb(new ServerCompromisedError('Server sent fake transaction proposal'));

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
    throw new Error('You do not have the required keys to sign transactions');

  if (self.isPrivKeyEncrypted())
    return cb(new Error('Private Key is encrypted, cannot sign'));

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

        var amount = txp.amount;
        if (txp.outputs) {
          amount = _.reduce(txp.outputs, function(total, output) {
            return total += output.amount;
          }, 0);
        }

        PayPro.send({
          http: self.payProHttp,
          url: txp.payProUrl,
          amountSat: amount,
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

API.prototype._walletPrivKeyFromOldCopayWallet = function(w) {
  // IN BWS, the master Pub Keys are not sent to the server, 
  // so it is safe to use them as seed for wallet's shared secret.
  var seed = w.publicKeyRing.copayersExtPubKeys.sort().join('');
  var seedBuf = new Buffer(seed);
  var privKey = new Bitcore.PrivateKey.fromBuffer(Bitcore.crypto.Hash.sha256(seedBuf));
  return privKey.toString();
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

  var m = w.opts.requiredCopayers;
  var n = w.opts.totalCopayers;
  var walletId = w.opts.id;
  var walletName = w.opts.name;
  var network = w.opts.networkName;
  this.credentials = Credentials.fromOldCopayWallet(w);
  var walletPrivKey = this._walletPrivKeyFromOldCopayWallet(w);
  var copayerName = this.credentials.copayerName;

  // First: Try to get the wallet with the imported credentials...
  this.getStatus(function(err) {
    // No error? -> Wallet is ready.
    if (!err) {
      log.debug('Wallet is already imported');
      self.credentials.addWalletInfo(walletId, walletName, m, n,
        walletPrivKey, copayerName);
      return cb();
    };

    self.createWallet(walletName, copayerName, m, n, {
      network: network,
      id: walletId,
      walletPrivKey: walletPrivKey,
    }, function(err, secret) {
      if (err && err.code == 'WEXISTS') {

        self.credentials.addWalletInfo(walletId, walletName, m, n,
          walletPrivKey, copayerName);

        return self._replaceTemporaryRequestKey(function(err) {
          if (err) return cb(err);
          self.openWallet(function(err) {
            return cb(err, true);
          });
        });
      }
      if (err) return cb(err);

      var i = 1;
      async.eachSeries(self.credentials.publicKeyRing, function(item, next) {
        if (item.xPubKey == self.credentials.xPubKey)
          return next();
        self._doJoinWallet(walletId, walletPrivKey, item.xPubKey, item.requestPubKey, item.copayerName, {
          isTemporaryRequestKey: true
        }, next);
      }, cb);
    });
  });
};

/*
Replace temporary request key
 */
API.prototype._replaceTemporaryRequestKey = function(cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var args = {
    name: this.credentials.copayerName,
    xPubKey: this.credentials.xPubKey,
    requestPubKey: this.credentials.requestPubKey,
    isTemporaryRequestKey: false,
  };

  var hash = WalletUtils.getCopayerHash(args.name, args.xPubKey, args.requestPubKey);
  args.copayerSignature = WalletUtils.signMessage(hash, this.credentials.walletPrivKey);

  // Use tmp request key to create the request.
  var path0 = WalletUtils.PATHS.BASE_ADDRESS_DERIVATION;
  var requestDerivationBase = (new Bitcore.HDPrivateKey(this.credentials.xPrivKey))
    .derive(path0);

  var path1 = WalletUtils.PATHS.TMP_REQUEST_KEY;
  var requestDerivation = requestDerivationBase.derive(path1);
  args._requestPrivKey = requestDerivation.privateKey.toString();


  this._doPutRequest('/v1/copayers/', args, function(err, wallet) {
    if (err) return cb(err);
    return cb(null, wallet);
  });
};


module.exports = API;
