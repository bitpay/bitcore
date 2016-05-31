'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var util = require('util');
var async = require('async');
var events = require('events');
var Bitcore = require('bitcore-lib');
var Mnemonic = require('bitcore-mnemonic');
var sjcl = require('sjcl');
var url = require('url');
var querystring = require('querystring');
var Stringify = require('json-stable-stringify');

var request;
if (process && !process.browser) {
  request = require('request');
} else {
  request = require('browser-request');
}

var Common = require('./common');
var Constants = Common.Constants;
var Defaults = Common.Defaults;
var Utils = Common.Utils;

var PayPro = require('./paypro');
var log = require('./log');
var Credentials = require('./credentials');
var Verifier = require('./verifier');
var Package = require('../package.json');
var Errors = require('./errors');

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
  log.warn('DEPRECATED: use initialize() instead.');
  this.initialize({}, cb);
};

API.prototype.initialize = function(opts, cb) {
  $.checkState(this.credentials);

  var self = this;

  self._initNotifications(opts);
  return cb();
};

API.prototype.dispose = function(cb) {
  var self = this;
  self._disposeNotifications();
  return cb();
};

API.prototype._fetchLatestNotifications = function(interval, cb) {
  var self = this;

  cb = cb || function() {};

  var opts = {
    lastNotificationId: self.lastNotificationId,
  };

  if (!self.lastNotificationId) {
    opts.timeSpan = interval + 1;
  }

  self.getNotifications(opts, function(err, notifications) {
    if (err) {
      log.warn('Error receiving notifications.');
      log.debug(err);
      return cb(err);
    }
    if (notifications.length > 0) {
      self.lastNotificationId = _.last(notifications).id;
    }

    _.each(notifications, function(notification) {
      self.emit('notification', notification);
    });
    return cb();
  });
};

API.prototype._initNotifications = function(opts) {
  var self = this;

  opts = opts || {};

  var interval = opts.notificationIntervalSeconds || 5;
  self.notificationsIntervalId = setInterval(function() {
    self._fetchLatestNotifications(interval, function(err) {
      if (err) {
        if (err instanceof Errors.NOT_FOUND || err instanceof Errors.NOT_AUTHORIZED) {
          self._disposeNotifications();
        }
      }
    });
  }, interval * 1000);
};

API.prototype._disposeNotifications = function() {
  var self = this;

  if (self.notificationsIntervalId) {
    clearInterval(self.notificationsIntervalId);
    self.notificationsIntervalId = null;
  }
};


/**
 * Reset notification polling with new interval
 * @param {Numeric} notificationIntervalSeconds - use 0 to pause notifications
 */
API.prototype.setNotificationsInterval = function(notificationIntervalSeconds) {
  var self = this;
  self._disposeNotifications();
  if (notificationIntervalSeconds > 0) {
    self._initNotifications({
      notificationIntervalSeconds: notificationIntervalSeconds
    });
  }
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
  return Utils.encryptMessage(message, encryptingKey);
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
    return Utils.decryptMessage(message, encryptingKey);
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
    txp.creatorName = API._decryptMessage(txp.creatorName, encryptingKey);

    _.each(txp.actions, function(action) {
      action.copayerName = API._decryptMessage(action.copayerName, encryptingKey);
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
    if (Errors[body.code]) {
      ret = new Errors[body.code];
    } else {
      ret = new Error(body.code);
    }
  } else {
    ret = new Error(body.error || body);
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
  return Utils.signMessage(message, privKey);
};


/**
 * Seed from random
 *
 * @param {Object} opts
 * @param {String} opts.network - default 'livenet'
 */
API.prototype.seedFromRandom = function(opts) {
  $.checkArgument(arguments.length <= 1, 'DEPRECATED: only 1 argument accepted.');
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts), 'DEPRECATED: argument should be an options object.');

  opts = opts || {};
  this.credentials = Credentials.create(opts.network || 'livenet');
};

var _hardcodedOk;
API.prototype._validateKeys = function(passphrase) {
  var c = this.credentials;
  if (!c.canSign()) return;

  function testMessageSigning(xpriv, xpub) {
    var nonHardenedPath = 'm/0/0';
    var message = 'Lorem ipsum dolor sit amet, ne amet urbanitas percipitur vim, libris disputando his ne, et facer suavitate qui. Ei quidam laoreet sea. Cu pro dico aliquip gubergren, in mundi postea usu. Ad labitur posidonium interesset duo, est et doctus molestie adipiscing.';
    var priv = xpriv.derive(nonHardenedPath).privateKey;
    var signature = Utils.signMessage(message, priv);
    var pub = xpub.derive(nonHardenedPath).publicKey;
    return Utils.verifyMessage(message, signature, pub);
  };

  function testHardcodedKeys() {
    var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    var xpriv = Mnemonic(words).toHDPrivateKey();

    if (xpriv.toString() != 'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu') return false;

    xpriv = xpriv.derive("m/44'/0'/0'");
    if (xpriv.toString() != 'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb') return false;

    var xpub = Bitcore.HDPublicKey.fromString('xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj');
    return testMessageSigning(xpriv, xpub);
  };

  function testLiveKeys() {
    var words;
    try {
      words = c.getMnemonic();
    } catch (ex) {}

    var xpriv;
    if (words && (!c.mnemonicHasPassphrase || passphrase)) {
      var m = new Mnemonic(words);
      xpriv = m.toHDPrivateKey(passphrase, c.network);
    }
    if (!xpriv) {
      xpriv = new Bitcore.HDPrivateKey(c.xPrivKey);
    }
    xpriv = xpriv.derive(c.getBaseAddressDerivationPath());
    var xpub = new Bitcore.HDPublicKey(c.xPubKey);

    return testMessageSigning(xpriv, xpub);
  };

  if (_.isUndefined(_hardcodedOk)) {
    _hardcodedOk = testHardcodedKeys();
  }
  var liveOk = !c.isPrivKeyEncrypted() ? testLiveKeys() : true;

  this.incorrectDerivation = !_hardcodedOk || !liveOk;

  if (this.incorrectDerivation) {
    this.emit('derivation-error');
  }

  return !this.incorrectDerivation;
};

/**
 * Seed from random with mnemonic
 *
 * @param {Object} opts
 * @param {String} opts.network - default 'livenet'
 * @param {String} opts.passphrase
 * @param {Number} opts.language - default 'en'
 * @param {Number} opts.account - default 0
 * @param {Boolean} opts.noPrivacy[=false] - Should this wallet reuse a single address?
 */
API.prototype.seedFromRandomWithMnemonic = function(opts) {
  $.checkArgument(arguments.length <= 1, 'DEPRECATED: only 1 argument accepted.');
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts), 'DEPRECATED: argument should be an options object.');

  opts = opts || {};
  this.credentials = Credentials.createWithMnemonic(opts.network || 'livenet', opts.passphrase, opts.language || 'en', opts.account || 0, {
    noPrivacy: !!opts.noPrivacy
  });
  if (!this._validateKeys(opts.passphrase)) {
    this.credentials = null;
  }
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
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 */
API.prototype.seedFromExtendedPrivateKey = function(xPrivKey, opts) {
  opts = opts || {};
  this.credentials = Credentials.fromExtendedPrivateKey(xPrivKey, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44);
};


/**
 * Seed from Mnemonics (language autodetected)
 * Can throw an error if mnemonic is invalid
 *
 * @param {String} BIP39 words
 * @param {Object} opts
 * @param {String} opts.network - default 'livenet'
 * @param {String} opts.passphrase
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 */
API.prototype.seedFromMnemonic = function(words, opts) {
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts), 'DEPRECATED: second argument should be an options object.');

  opts = opts || {};
  this.credentials = Credentials.fromMnemonic(opts.network || 'livenet', words, opts.passphrase, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44);
  this._validateKeys(opts.passphrase);
};

/**
 * Seed from external wallet public key
 *
 * @param {String} xPubKey
 * @param {String} source - A name identifying the source of the xPrivKey (e.g. ledger, TREZOR, ...)
 * @param {String} entropySourceHex - A HEX string containing pseudo-random data, that can be deterministically derived from the xPrivKey, and should not be derived from xPubKey.
 * @param {Object} opts
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 */
API.prototype.seedFromExtendedPublicKey = function(xPubKey, source, entropySourceHex, opts) {
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts));

  opts = opts || {};
  this.credentials = Credentials.fromExtendedPublicKey(xPubKey, source, entropySourceHex, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44);
};


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
};


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
    throw new Errors.INVALID_BACKUP;
  }
  this._validateKeys();
};

API.prototype._import = function(cb) {
  $.checkState(this.credentials);

  var self = this;

  // First option, grab wallet info from BWS.
  self.openWallet(function(err, ret) {

    // it worked?
    if (!err) return cb(null, ret);

    // Is the error other than "copayer was not found"? || or no priv key.
    if (err instanceof Errors.NOT_AUTHORIZED || self.isPrivKeyExternal())
      return cb(err);

    //Second option, lets try to add an access
    log.info('Copayer not found, trying to add access');
    self.addAccess({}, function(err) {
      if (err) {
        return cb(new Errors.WALLET_DOES_NOT_EXIST);
      }

      self.openWallet(cb);
    });
  });
};

/**
 * Import from Mnemonics (language autodetected)
 * Can throw an error if mnemonic is invalid
 *
 * @param {String} BIP39 words
 * @param {Object} opts
 * @param {String} opts.network - default 'livenet'
 * @param {String} opts.passphrase
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 */
API.prototype.importFromMnemonic = function(words, opts, cb) {
  log.debug('Importing from 12 Words');

  opts = opts || {};
  try {
    this.credentials = Credentials.fromMnemonic(opts.network || 'livenet', words, opts.passphrase, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44);
  } catch (e) {
    log.info('Mnemonic error:', e);
    return cb(new Errors.INVALID_BACKUP);
  };

  this._import(cb);
};

/*
 * Seed from extended private key
 *
 * @param {String} xPrivKey
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 * @param {Callback} cb - The callback that handles the response. It returns a flag indicating that the wallet is imported.
 */


API.prototype.importFromExtendedPrivateKey = function(xPrivKey, opts, cb) {
  log.debug('Importing from Extended Private Key');

  if (!cb) {
    cb = opts;
    opts = {};
    log.warn('DEPRECATED WARN: importFromExtendedPrivateKey should receive 3 parameters.');
  }

  try {
    this.credentials = Credentials.fromExtendedPrivateKey(xPrivKey, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44);
  } catch (e) {
    log.info('xPriv error:', e);
    return cb(new Errors.INVALID_BACKUP);
  };

  this._import(cb);
};

/**
 * Import from Extended Public Key
 *
 * @param {String} xPubKey
 * @param {String} source - A name identifying the source of the xPrivKey
 * @param {String} entropySourceHex - A HEX string containing pseudo-random data, that can be deterministically derived from the xPrivKey, and should not be derived from xPubKey.
 * @param {Object} opts
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 */
API.prototype.importFromExtendedPublicKey = function(xPubKey, source, entropySourceHex, opts, cb) {
  $.checkArgument(arguments.length == 5, "DEPRECATED: should receive 5 arguments");
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts));
  $.shouldBeFunction(cb);

  opts = opts || {};
  log.debug('Importing from Extended Private Key');
  try {
    this.credentials = Credentials.fromExtendedPublicKey(xPubKey, source, entropySourceHex, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44);
  } catch (e) {
    log.info('xPriv error:', e);
    return cb(new Errors.INVALID_BACKUP);
  };

  this._import(cb);
};

API.prototype.decryptBIP38PrivateKey = function(encryptedPrivateKeyBase58, passphrase, opts, cb) {
  var Bip38 = require('bip38');
  var bip38 = new Bip38();

  var privateKeyWif;
  try {
    privateKeyWif = bip38.decrypt(encryptedPrivateKeyBase58, passphrase);
  } catch (ex) {
    return cb(new Error('Could not decrypt BIP38 private key', ex));
  }

  var privateKey = new Bitcore.PrivateKey(privateKeyWif);
  var address = privateKey.publicKey.toAddress().toString();
  var addrBuff = new Buffer(address, 'ascii');
  var actualChecksum = Bitcore.crypto.Hash.sha256sha256(addrBuff).toString('hex').substring(0, 8);
  var expectedChecksum = Bitcore.encoding.Base58Check.decode(encryptedPrivateKeyBase58).toString('hex').substring(6, 14);

  if (actualChecksum != expectedChecksum)
    return cb(new Error('Incorrect passphrase'));

  return cb(null, privateKeyWif);
};

API.prototype.getBalanceFromPrivateKey = function(privateKey, cb) {
  var self = this;

  var privateKey = new Bitcore.PrivateKey(privateKey);
  var address = privateKey.publicKey.toAddress();
  self.getUtxos({
    addresses: address.toString(),
  }, function(err, utxos) {
    if (err) return cb(err);
    return cb(null, _.sum(utxos, 'satoshis'));
  });
};

API.prototype.buildTxFromPrivateKey = function(privateKey, destinationAddress, opts, cb) {
  var self = this;

  opts = opts || {};

  var privateKey = new Bitcore.PrivateKey(privateKey);
  var address = privateKey.publicKey.toAddress();

  async.waterfall([

    function(next) {
      self.getUtxos({
        addresses: address.toString(),
      }, function(err, utxos) {
        return next(err, utxos);
      });
    },
    function(utxos, next) {
      if (!_.isArray(utxos) || utxos.length == 0) return next(new Error('No utxos found'));

      var fee = opts.fee || 10000;
      var amount = _.sum(utxos, 'satoshis') - fee;
      if (amount <= 0) return next(new Errors.INSUFFICIENT_FUNDS);

      var tx;
      try {
        var toAddress = Bitcore.Address.fromString(destinationAddress);

        tx = new Bitcore.Transaction()
          .from(utxos)
          .to(toAddress, amount)
          .fee(fee)
          .sign(privateKey);

        // Make sure the tx can be serialized
        tx.serialize();

      } catch (ex) {
        log.error('Could not build transaction from private key', ex);
        return next(new Errors.COULD_NOT_BUILD_TRANSACTION);
      }
      return next(null, tx);
    }
  ], cb);
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

    self._processStatus(ret);

    if (!self.credentials.hasWalletInfo()) {
      var me = _.find(wallet.copayers, {
        id: self.credentials.copayerId
      });
      self.credentials.addWalletInfo(wallet.id, wallet.name, wallet.m, wallet.n, me.name);
    }

    if (wallet.status != 'complete')
      return cb();

    if (self.credentials.walletPrivKey) {
      if (!Verifier.checkCopayers(self.credentials, wallet.copayers)) {
        return cb(new Errors.SERVER_COMPROMISED);
      }
    } else {
      // this should only happen in AIR-GAPPED flows
      log.warn('Could not verify copayers key (missing wallet Private Key)');
    }

    self.credentials.addPublicKeyRing(API._extractPublicKeyRing(wallet.copayers));

    self.emit('walletCompleted', wallet);

    return cb(null, ret);
  });
};


API.prototype._getHeaders = function(method, url, args) {
  var headers = {
    'x-client-version': 'bwc-' + Package.version,
  };

  if (this.credentials) {
    var reqSignature;
    var key = args._requestPrivKey || this.credentials.requestPrivKey;
    if (key) {
      delete args['_requestPrivKey'];
      reqSignature = API._signRequest(method, url, args, key);
    }
    headers['x-identity'] = this.credentials.copayerId;
    headers['x-signature'] = reqSignature;
  }
  return headers;
}



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
  var absUrl = this.baseUrl + url;
  var newArgs = {
    // relUrl: only for testing with `supertest`
    relUrl: this.basePath + url,
    headers: this._getHeaders(method, url, args),
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

  this.request(newArgs, function(err, res, body) {
    log.debug(util.inspect(body, {
      depth: 10
    }));
    if (!res) {
      return cb(new Errors.CONNECTION_ERROR);
    }

    if (res.statusCode !== 200) {
      if (res.statusCode === 404)
        return cb(new Errors.NOT_FOUND);

      if (!res.statusCode)
        return cb(new Errors.CONNECTION_ERROR);

      return cb(API._parseError(body));
    }

    if (body === '{"error":"read ECONNRESET"}')
      return cb(new Errors.ECONNRESET_ERROR(JSON.parse(body)));

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

API._buildSecret = function(walletId, walletPrivKey, network) {
  if (_.isString(walletPrivKey)) {
    walletPrivKey = Bitcore.PrivateKey.fromString(walletPrivKey);
  }
  var widHex = new Buffer(walletId.replace(/-/g, ''), 'hex');
  var widBase58 = new Bitcore.encoding.Base58(widHex).toString();
  return _.padRight(widBase58, 22, '0') + walletPrivKey.toWIF() + (network == 'testnet' ? 'T' : 'L');
};

API.parseSecret = function(secret) {
  $.checkArgument(secret);

  function split(str, indexes) {
    var parts = [];
    indexes.push(str.length);
    var i = 0;
    while (i < indexes.length) {
      parts.push(str.substring(i == 0 ? 0 : indexes[i - 1], indexes[i]));
      i++;
    };
    return parts;
  };

  try {
    var secretSplit = split(secret, [22, 74]);
    var widBase58 = secretSplit[0].replace(/0/g, '');
    var widHex = Bitcore.encoding.Base58.decode(widBase58).toString('hex');
    var walletId = split(widHex, [8, 12, 16, 20]).join('-');

    var walletPrivKey = Bitcore.PrivateKey.fromString(secretSplit[1]);
    var networkChar = secretSplit[2];

    return {
      walletId: walletId,
      walletPrivKey: walletPrivKey,
      network: networkChar == 'T' ? 'testnet' : 'livenet',
    };
  } catch (ex) {
    throw new Error('Invalid secret');
  }
};

API.getRawTx = function(txp) {
  var t = Utils.buildTx(txp);
  return t.uncheckedSerialize();
};

API.signTxp = function(txp, derivedXPrivKey) {
  //Derive proper key to sign, for each input
  var privs = [];
  var derived = {};

  var xpriv = new Bitcore.HDPrivateKey(derivedXPrivKey);

  _.each(txp.inputs, function(i) {
    $.checkState(i.path, "Input derivation path no available (signing transaction)")
    if (!derived[i.path]) {
      derived[i.path] = xpriv.derive(i.path).privateKey;
      privs.push(derived[i.path]);
    }
  });

  var t = Utils.buildTx(txp);

  var signatures = _.map(privs, function(priv, i) {
    return t.getSignatures(priv);
  });

  signatures = _.map(_.sortBy(_.flatten(signatures), 'inputIndex'), function(s) {
    return s.signature.toDER().toString('hex');
  });

  return signatures;
};

API.prototype._signTxp = function(txp) {
  return API.signTxp(txp, this.credentials.getDerivedXPrivKey());
};

API.prototype._getCurrentSignatures = function(txp) {
  var acceptedActions = _.filter(txp.actions, {
    type: 'accept'
  });

  return _.map(acceptedActions, function(x) {
    return {
      signatures: x.signatures,
      xpub: x.xpub,
    };
  });
};

API.prototype._addSignaturesToBitcoreTx = function(txp, t, signatures, xpub) {
  if (signatures.length != txp.inputs.length)
    throw new Error('Number of signatures does not match number of inputs');

  var i = 0,
    x = new Bitcore.HDPublicKey(xpub);

  _.each(signatures, function(signatureHex) {
    var input = txp.inputs[i];
    try {
      var signature = Bitcore.crypto.Signature.fromString(signatureHex);
      var pub = x.derive(txp.inputPaths[i]).publicKey;
      var s = {
        inputIndex: i,
        signature: signature,
        sigtype: Bitcore.crypto.Signature.SIGHASH_ALL,
        publicKey: pub,
      };
      t.inputs[i].addSignature(t, s);
      i++;
    } catch (e) {};
  });

  if (i != txp.inputs.length)
    throw new Error('Wrong signatures');
};


API.prototype._applyAllSignatures = function(txp, t) {
  var self = this;

  $.checkState(txp.status == 'accepted');

  var sigs = self._getCurrentSignatures(txp);
  _.each(sigs, function(x) {
    self._addSignaturesToBitcoreTx(txp, t, x.signatures, x.xpub);
  });
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
  var self = this;

  opts = opts || {};

  // Adds encrypted walletPrivateKey to CustomData
  opts.customData = opts.customData || {};
  opts.customData.walletPrivKey = walletPrivKey.toString();
  var encCustomData = Utils.encryptMessage(JSON.stringify(opts.customData), this.credentials.personalEncryptingKey);
  var encCopayerName = Utils.encryptMessage(copayerName, this.credentials.sharedEncryptingKey);

  var args = {
    walletId: walletId,
    name: encCopayerName,
    xPubKey: xPubKey,
    requestPubKey: requestPubKey,
    customData: encCustomData,
  };
  if (opts.dryRun) args.dryRun = true;

  if (_.isBoolean(opts.supportBIP44AndP2PKH))
    args.supportBIP44AndP2PKH = opts.supportBIP44AndP2PKH;

  var hash = Utils.getCopayerHash(args.name, args.xPubKey, args.requestPubKey);
  args.copayerSignature = Utils.signMessage(hash, walletPrivKey);

  var url = '/v2/wallets/' + walletId + '/copayers';
  this._doPostRequest(url, args, function(err, body) {
    if (err) return cb(err);
    self._processWallet(body.wallet);
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

  if (self.incorrectDerivation) {
    log.error('Key derivation for this device is not working as expected');
    return cb(new Error('Cannot create new wallet'));
  }

  if (opts) $.shouldBeObject(opts);
  opts = opts || {};

  var network = opts.network || 'livenet';
  if (!_.contains(['testnet', 'livenet'], network)) return cb(new Error('Invalid network'));

  if (!self.credentials) {
    log.info('Generating new keys');
    self.seedFromRandom({
      network: network
    });
  } else {
    log.info('Using existing keys');
  }

  if (network != self.credentials.network) {
    return cb(new Error('Existing keys were created for a different network'));
  }

  var walletPrivKey = opts.walletPrivKey || new Bitcore.PrivateKey();

  var c = self.credentials;
  c.addWalletPrivateKey(walletPrivKey.toString());
  var encWalletName = Utils.encryptMessage(walletName, c.sharedEncryptingKey);

  var args = {
    name: encWalletName,
    m: m,
    n: n,
    pubKey: (new Bitcore.PrivateKey(walletPrivKey)).toPublicKey().toString(),
    network: network,
    id: opts.id,
  };
  self._doPostRequest('/v2/wallets/', args, function(err, res) {
    if (err) return cb(err);

    var walletId = res.walletId;
    c.addWalletInfo(walletId, walletName, m, n, copayerName);
    var secret = API._buildSecret(c.walletId, c.walletPrivKey, c.network);

    self._doJoinWallet(walletId, walletPrivKey, c.xPubKey, c.requestPubKey, copayerName, {},
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
    log.warn('DEPRECATED WARN: joinWallet should receive 4 parameters.');
  }

  if (self.incorrectDerivation) {
    log.error('Key derivation for this device is not working as expected');
    return cb(new Error('Cannot join wallet'));
  }

  opts = opts || {};

  try {
    var secretData = API.parseSecret(secret);
  } catch (ex) {
    return cb(ex);
  }

  if (!self.credentials) {
    self.seedFromRandom({
      network: secretData.network
    });
  }

  self.credentials.addWalletPrivateKey(secretData.walletPrivKey.toString());
  self._doJoinWallet(secretData.walletId, secretData.walletPrivKey, self.credentials.xPubKey, self.credentials.requestPubKey, copayerName, {
    dryRun: !!opts.dryRun,
  }, function(err, wallet) {
    if (err) return cb(err);
    if (!opts.dryRun) {
      self.credentials.addWalletInfo(wallet.id, wallet.name, wallet.m, wallet.n, copayerName);
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

    var c = self.credentials;
    var walletPrivKey = Bitcore.PrivateKey.fromString(c.walletPrivKey);
    var walletId = c.walletId;
    var supportBIP44AndP2PKH = c.derivationStrategy != Constants.DERIVATION_STRATEGIES.BIP45;
    var encWalletName = Utils.encryptMessage(c.walletName || 'recovered wallet', c.sharedEncryptingKey);

    var args = {
      name: encWalletName,
      m: c.m,
      n: c.n,
      pubKey: walletPrivKey.toPublicKey().toString(),
      network: c.network,
      id: walletId,
      supportBIP44AndP2PKH: supportBIP44AndP2PKH,
    };

    self._doPostRequest('/v2/wallets/', args, function(err, body) {
      if (err) {
        if (!(err instanceof Errors.WALLET_ALREADY_EXISTS))
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
          if (err && err instanceof Errors.COPAYER_IN_WALLET) return next();
          return next(err);
        });
      }, cb);
    });
  });
};

API.prototype._processWallet = function(wallet) {
  var self = this;

  var encryptingKey = self.credentials.sharedEncryptingKey;

  var name = Utils.decryptMessage(wallet.name, encryptingKey);
  if (name != wallet.name) {
    wallet.encryptedName = wallet.name;
  }
  wallet.name = name;
  _.each(wallet.copayers, function(copayer) {
    var name = Utils.decryptMessage(copayer.name, encryptingKey);
    if (name != copayer.name) {
      copayer.encryptedName = copayer.name;
    }
    copayer.name = name;
    _.each(copayer.requestPubKeys, function(access) {
      if (!access.name) return;

      var name = Utils.decryptMessage(access.name, encryptingKey);
      if (name != access.name) {
        access.encryptedName = access.name;
      }
      access.name = name;
    });
  });
};

API.prototype._processStatus = function(status) {
  var self = this;

  function processCustomData(data) {
    var copayers = data.wallet.copayers;
    if (!copayers) return;

    var me = _.find(copayers, {
      'id': self.credentials.copayerId
    });
    if (!me || !me.customData) return;

    var customData;
    try {
      customData = JSON.parse(Utils.decryptMessage(me.customData, self.credentials.personalEncryptingKey));
    } catch (e) {
      log.warn('Could not decrypt customData:', me.customData);
    }
    if (!customData) return;

    // Add it to result
    data.customData = customData;

    // Update walletPrivateKey
    if (!self.credentials.walletPrivKey && customData.walletPrivKey)
      self.credentials.addWalletPrivateKey(customData.walletPrivKey);
  };

  processCustomData(status);
  self._processWallet(status.wallet);
  self._processTxps(status.pendingTxps);
}


/**
 * Get latest notifications
 *
 * @param {object} opts
 * @param {String} lastNotificationId (optional) - The ID of the last received notification
 * @param {String} timeSpan (optional) - A time window on which to look for notifications (in seconds)
 * @returns {Callback} cb - Returns error or an array of notifications
 */
API.prototype.getNotifications = function(opts, cb) {
  $.checkState(this.credentials);

  var self = this;
  opts = opts || {};

  var url = '/v1/notifications/';
  if (opts.lastNotificationId) {
    url += '?notificationId=' + opts.lastNotificationId;
  } else if (opts.timeSpan) {
    url += '?timeSpan=' + opts.timeSpan;
  }

  self._doGetRequest(url, function(err, result) {
    if (err) return cb(err);
    var notifications = _.filter(result, function(notification) {
      return (notification.creatorId != self.credentials.copayerId);
    });
    return cb(null, notifications);
  });
};

/**
 * Get status of the wallet
 *
 * @param {Boolean} opts.twoStep[=false] - Optional: use 2-step balance computation for improved performance
 * @param {Boolean} opts.includeExtendedInfo (optional: query extended status)
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

  var qs = [];
  qs.push('includeExtendedInfo=' + (opts.includeExtendedInfo ? '1' : '0'));
  qs.push('twoStep=' + (opts.twoStep ? '1' : '0'));

  self._doGetRequest('/v2/wallets/?' + qs.join('&'), function(err, result) {
    if (err) return cb(err);
    if (result.wallet.status == 'pending') {
      var c = self.credentials;
      result.wallet.secret = API._buildSecret(c.walletId, c.walletPrivKey, c.network);
    }

    self._processStatus(result);

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
  $.checkState(this.credentials);
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
  $.checkState(this.credentials);
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
      payProUrl: args.payProUrl || null,
    };
    hash = Utils.getProposalHash(proposalHeader);
  } else {
    $.shouldBeNumber(args.amount);
    hash = Utils.getProposalHash(args.toAddress, args.amount, args.message || null, args.payProUrl || null);
  }
  return Utils.signMessage(hash, this.credentials.requestPrivKey);
};

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
      return cb(err);

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
 * @param {Object} opts.customData - Optional: Arbitrary data to store along with proposal
 * @param {Array} opts.inputs - Optional: Inputs to be used in proposal.
 * @param {Array} opts.outputs - Optional: Outputs to be used in proposal.
 * @param {Array} opts.utxosToExclude - Optional: List of UTXOS (in form of txid:vout string)
 *        to exclude from coin selection for this proposal
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
    payProUrl: opts.payProUrl || null,
    excludeUnconfirmedUtxos: !!opts.excludeUnconfirmedUtxos,
    type: opts.type,
    customData: opts.customData,
    inputs: opts.inputs,
    utxosToExclude: opts.utxosToExclude
  };
  if (opts.outputs) {
    args.outputs = _.map(opts.outputs, function(o) {
      return {
        toAddress: o.toAddress,
        script: o.script,
        amount: o.amount,
        message: API._encryptMessage(o.message, self.credentials.sharedEncryptingKey) || null,
      };
    });
  }
  log.debug('Generating & signing tx proposal:', JSON.stringify(args));
  args.proposalSignature = this._computeProposalSignature(args);

  this._doPostRequest('/v1/txproposals/', args, function(err, txp) {
    if (err) return cb(err);
    return cb(null, txp);
  });
};

API.prototype._getCreateTxProposalArgs = function(opts) {
  var self = this;

  var args = {
    message: API._encryptMessage(opts.message, this.credentials.sharedEncryptingKey) || null,
    fee: opts.fee,
    feePerKb: opts.feePerKb,
    changeAddress: opts.changeAddress,
    payProUrl: opts.payProUrl || null,
    excludeUnconfirmedUtxos: !!opts.excludeUnconfirmedUtxos,
    customData: opts.customData,
    inputs: opts.inputs,
    utxosToExclude: opts.utxosToExclude,
    validateOutputs: opts.validateOutputs
  };

  args.outputs = _.map(opts.outputs, function(o) {
    return {
      toAddress: o.toAddress,
      script: o.script,
      amount: o.amount,
      message: API._encryptMessage(o.message, self.credentials.sharedEncryptingKey) || null,
    };
  });

  return args;
};

/**
 * Create a transaction proposal
 *
 * @param {Object} opts
 * @param {Array} opts.outputs - List of outputs.
 * @param {String} opts.outputs[].toAddress / opts.outputs[].script
 * @param {Number} opts.outputs[].amount
 * @param {String} opts.outputs[].message
 * @param {string} opts.message - A message to attach to this transaction.
 * @param {string} opts.fee - Optional: Use an alternative fee for this TX (mutually exclusive with feePerKb)
 * @param {string} opts.feePerKb - Optional: Use an alternative fee per KB for this TX (mutually exclusive with fee)
 * @param {string} opts.changeAddress - Optional. Use this address as the change address for the tx. The address should belong to the wallet.
 * @param {String} opts.payProUrl - Optional: Tx is from a payment protocol URL
 * @param {string} opts.excludeUnconfirmedUtxos - Optional: Do not use UTXOs of unconfirmed transactions as inputs
 * @param {Object} opts.customData - Optional: Arbitrary data to store along with proposal
 * @param {Array} opts.inputs - Optional: Inputs to be used in proposal.
 * @param {Array} opts.outputs - Optional: Outputs to be used in proposal.
 * @param {Array} opts.utxosToExclude - Optional: List of UTXOS (in form of txid:vout string)
 *        to exclude from coin selection for this proposal
 * @returns {Callback} cb - Return error or the transaction proposal
 */
API.prototype.createTxProposal = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(!opts.message || this.credentials.sharedEncryptingKey, 'Cannot create transaction with message without shared Encrypting key');
  $.checkArgument(opts);
  $.checkState(!_.isNumber(opts.fee) || !_.isNumber(opts.feePerKb));

  var self = this;

  var args = this._getCreateTxProposalArgs(opts);

  this._doPostRequest('/v2/txproposals/', args, function(err, txp) {
    if (err) return cb(err);

    if (!Verifier.checkProposalCreation(args, txp)) {
      return cb(new Errors.SERVER_COMPROMISED);
    }

    self._processTxps(txp);
    return cb(null, txp);
  });
};

/**
 * Publish a transaction proposal
 *
 * @param {Object} opts
 * @param {Object} opts.txp - The transaction proposal object returned by the API#createTxProposal method
 * @returns {Callback} cb - Return error or null
 */
API.prototype.publishTxProposal = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(opts)
    .checkArgument(opts.txp);

  $.checkState(parseInt(opts.txp.version) >= 3);

  var self = this;

  var t = Utils.buildTx(opts.txp);
  var hash = t.uncheckedSerialize();
  var args = {
    proposalSignature: Utils.signMessage(hash, self.credentials.requestPrivKey)
  };

  var url = '/v1/txproposals/' + opts.txp.id + '/publish/';
  self._doPostRequest(url, args, function(err, txp) {
    if (err) return cb(err);
    return cb(null, txp);
  });
};

/**
 * Create a new address
 *
 * @param {Object} opts
 * @param {Boolean} opts.ignoreMaxGap[=false]
 * @param {Callback} cb
 * @returns {Callback} cb - Return error or the address
 */
API.prototype.createAddress = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;

  function getNewAddress() {
    self._doPostRequest('/v3/addresses/', opts, cb);
  };

  function getFirstAddress(cb) {
    self.getMainAddresses({
      doNotVerify: true,
      reverse: false,
      limit: 1
    }, function(err, addresses) {
      if (err) return cb(err);
      if (!_.isEmpty(addresses)) return cb(null, _.first(addresses));
      return getNewAddress(cb);
    });
  };

  if (!cb) {
    cb = opts;
    opts = {};
    log.warn('DEPRECATED WARN: createAddress should receive 2 parameters.')
  }

  if (self.incorrectDerivation) {
    log.error('Key derivation for this device is not working as expected');
    return cb(new Error('Cannot create new address for this wallet'));
  }

  opts = opts || {};

  var getAddressFn = this.credentials.noPrivacy ? getFirstAddress : getNewAddress;

  getAddressFn(function(err, address) {
    if (!Verifier.checkAddress(self.credentials, address)) {
      return cb(new Errors.SERVER_COMPROMISED);
    }

    return cb(null, address);
  });
};

/**
 * Get your main addresses
 *
 * @param {Object} opts
 * @param {Boolean} opts.doNotVerify
 * @param {Numeric} opts.limit (optional) - Limit the resultset. Return all addresses by default.
 * @param {Boolean} [opts.reverse=false] (optional) - Reverse the order of returned addresses.
 * @param {Callback} cb
 * @returns {Callback} cb - Return error or the array of addresses
 */
API.prototype.getMainAddresses = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;

  opts = opts || {};

  var args = [];
  if (opts.limit) args.push('limit=' + opts.limit);
  if (opts.reverse) args.push('reverse=1');
  var qs = '';
  if (args.length > 0) {
    qs = '?' + args.join('&');
  }
  var url = '/v1/addresses/' + qs;

  self._doGetRequest(url, function(err, addresses) {
    if (err) return cb(err);

    if (!opts.doNotVerify) {
      var fake = _.any(addresses, function(address) {
        return !Verifier.checkAddress(self.credentials, address);
      });
      if (fake)
        return cb(new Errors.SERVER_COMPROMISED);
    }
    return cb(null, addresses);
  });
};

/**
 * Update wallet balance
 *
 * @param {Boolean} opts.twoStep[=false] - Optional: use 2-step balance computation for improved performance
 * @param {Callback} cb
 */
API.prototype.getBalance = function(opts, cb) {
  if (!cb) {
    cb = opts;
    opts = {};
    log.warn('DEPRECATED WARN: getBalance should receive 2 parameters.')
  }

  var self = this;
  opts = opts || {};

  $.checkState(this.credentials && this.credentials.isComplete());
  var url = '/v1/balance/';
  if (opts.twoStep) url += '?twoStep=1';
  this._doGetRequest(url, cb);
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
          return cb(new Errors.SERVER_COMPROMISED);

        var result;
        if (opts.forAirGapped) {
          result = {
            txps: JSON.parse(JSON.stringify(txps)),
            encryptedPkr: Utils.encryptMessage(JSON.stringify(self.credentials.publicKeyRing), self.credentials.personalEncryptingKey),
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
      return cb(new Errors.SERVER_COMPROMISED);

    var signatures = txp.signatures;

    if (_.isEmpty(signatures)) {
      try {
        signatures = self._signTxp(txp);
      } catch (ex) {
        log.error('Error signing tx', ex);
        return cb(ex);
      }
    }

    var url = '/v1/txproposals/' + txp.id + '/signatures/';
    var args = {
      signatures: signatures
    };

    self._doPostRequest(url, args, function(err, txp) {
      if (err) return cb(err);
      self._processTxps(txp);
      return cb(null, txp);
    });
  });
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
    throw new Errors.MISSING_PRIVATE_KEY;

  if (self.isPrivKeyEncrypted())
    throw new Errors.ENCRYPTED_PRIVATE_KEY;

  var publicKeyRing;
  try {
    publicKeyRing = JSON.parse(Utils.decryptMessage(encryptedPkr, self.credentials.personalEncryptingKey));
  } catch (ex) {
    throw new Error('Could not decrypt public key ring');
  }

  if (!_.isArray(publicKeyRing) || publicKeyRing.length != n) {
    throw new Error('Invalid public key ring');
  }

  self.credentials.m = m;
  self.credentials.n = n;
  self.credentials.addressType = txp.addressType;
  self.credentials.addPublicKeyRing(publicKeyRing);

  if (!Verifier.checkTxProposalSignature(self.credentials, txp))
    throw new Error('Fake transaction proposal');

  return self._signTxp(txp);
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
    self._processTxps(txp);
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

      var t = Utils.buildTx(txp);
      self._applyAllSignatures(txp, t);

      PayPro.send({
        http: self.payProHttp,
        url: txp.payProUrl,
        amountSat: txp.amount,
        refundAddr: txp.changeAddress.address,
        merchant_data: paypro.merchant_data,
        rawTx: t.serialize({
          disableSmallFees: true,
          disableLargeFees: true,
          disableDustOutputs: true
        }),
      }, function(err, ack, memo) {
        if (err) return cb(err);
        self._doBroadcast(txp, function(err, txp) {
          return cb(err, txp, memo);
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
 * @param {Boolean} opts.includeExtendedInfo
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
    if (opts.includeExtendedInfo) args.push('includeExtendedInfo=1');
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
  this._doGetRequest(url, function(err, txp) {
    if (err) return cb(err);

    self._processTxps(txp);
    return cb(null, txp);
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

  opts = opts || {};

  var reqPrivKey = new Bitcore.PrivateKey(opts.generateNewKey ? null : this.credentials.requestPrivKey);
  var requestPubKey = reqPrivKey.toPublicKey().toString();

  var xPriv = new Bitcore.HDPrivateKey(this.credentials.xPrivKey)
    .derive(this.credentials.getBaseAddressDerivationPath());
  var sig = Utils.signRequestPubKey(requestPubKey, xPriv);
  var copayerId = this.credentials.copayerId;

  var encCopayerName = opts.name ? Utils.encryptMessage(opts.name, this.credentials.sharedEncryptingKey) : null;

  var opts = {
    copayerId: copayerId,
    requestPubKey: requestPubKey,
    signature: sig,
    name: encCopayerName,
    restrictions: opts.restrictions,
  };

  this._doPutRequest('/v1/copayers/' + copayerId + '/', opts, function(err, res) {
    if (err) return cb(err);
    return cb(null, res.wallet, reqPrivKey);
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
API.prototype.getFiatRate = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(cb);

  var self = this;

  var opts = opts || {};

  var args = [];
  if (opts.ts) args.push('ts=' + opts.ts);
  if (opts.provider) args.push('provider=' + opts.provider);
  var qs = '';
  if (args.length > 0) {
    qs = '?' + args.join('&');
  }

  self._doGetRequest('/v1/fiatrates/' + opts.code + '/' + qs, function(err, rates) {
    if (err) return cb(err);
    return cb(null, rates);
  });
}

/**
 * Returns subscription status.
 * @param {Object} opts
 * @param {String} opts.type - Device type (ios or android).
 * @param {String} opts.token - Device token.
 * @returns {Object} response - Status of subscription.
 */
API.prototype.pushNotificationsSubscribe = function(opts, cb) {
  var url = '/v1/pushnotifications/subscriptions/';
  this._doPostRequest(url, opts, function(err, response) {
    if (err) return cb(err);
    return cb(null, response);
  });
};

/**
 * Returns unsubscription status.
 * @param {String} token - Device token
 * @return {Callback} cb - Return error if exists
 */
API.prototype.pushNotificationsUnsubscribe = function(cb) {
  var url = '/v1/pushnotifications/subscriptions/';
  this._doDeleteRequest(url, function(err) {
    if (err) return cb(err);
    return cb(null);
  });
};

/**
 * Returns send max information.
 * @param {String} opts
 * @param {Number} opts.feePerKb - Fee value
 * @param {Boolean} opts.excludeUnconfirmedUtxos - Indicates it if should use (or not) the unconfirmed utxos
 * @param {Boolean} opts.returnInputs - Indicates it if should return (or not) the inputs
 * @return {Callback} cb - Return error (if exists) and object result
 */
API.prototype.getSendMaxInfo = function(opts, cb) {
  var self = this;
  var args = [];
  opts = opts || {};

  if (opts.feePerKb) args.push('feePerKb=' + opts.feePerKb);
  if (opts.excludeUnconfirmedUtxos) args.push('excludeUnconfirmedUtxos=1');
  if (opts.returnInputs) args.push('returnInputs=1');

  var qs = '';

  if (args.length > 0)
    qs = '?' + args.join('&');

  var url = '/v1/sendmaxinfo/' + qs;

  self._doGetRequest(url, function(err, result) {
    if (err) return cb(err);
    return cb(null, result);
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
  if (!w) return cb(new Error('Could not decrypt'));

  if (w.publicKeyRing.copayersExtPubKeys.length != w.opts.totalCopayers)
    return cb(new Error('Wallet is incomplete, cannot be imported'));

  this.credentials = Credentials.fromOldCopayWallet(w);
  this.recreateWallet(cb);
};

module.exports = API;
