'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var util = require('util');
var async = require('async');
var events = require('events');
var Bitcore = require('bitcore-lib');
var Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash'),
};
var Mnemonic = require('bitcore-mnemonic');
var sjcl = require('sjcl');
var url = require('url');
var querystring = require('querystring');
var Stringify = require('json-stable-stringify');

var request = require('superagent');

var Common = require('./common');
const config = require('./common/config');
var Constants = Common.Constants;
var Defaults = Common.Defaults;
var Utils = Common.Utils;

var PayPro = require('./paypro');
var log = require('./log');
var Credentials = require('./credentials');
var Verifier = require('./verifier');
var Package = require('../package.json');
var Errors = require('./errors');

var BASE_URL = 'http://localhost:3000/api';

/**
 * @desc ClientAPI constructor.
 *
 * @param {Object} opts
 * @constructor
 */
function API(opts) {
  opts = opts || {};

  this.request = opts.request || request;
  this.baseUrl = opts.baseUrl || BASE_URL;
  this.payProHttp = null; // Only for testing
  this.doNotVerifyPayPro = opts.doNotVerifyPayPro;
  this.timeout = opts.timeout || 50000;
  this.logLevel = opts.logLevel || 'silent';
  this.supportStaffWalletId = opts.supportStaffWalletId;

  log.setLevel(this.logLevel);
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

  self.notificationIncludeOwn = !!opts.notificationIncludeOwn;
  self._initNotifications(opts);
  return cb();
};

API.prototype.dispose = function(cb) {
  var self = this;
  self._disposeNotifications();
  self._logout(cb);
};

API.prototype._fetchLatestNotifications = function(interval, cb) {
  var self = this;

  cb = cb || function() {};

  var opts = {
    lastNotificationId: self.lastNotificationId,
    includeOwn: self.notificationIncludeOwn,
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

API.prototype._processTxNotes = function(notes) {
  var self = this;

  if (!notes) return;

  var encryptingKey = self.credentials.sharedEncryptingKey;
  _.each([].concat(notes), function(note) {
    note.encryptedBody = note.body;
    note.body = API._decryptMessage(note.body, encryptingKey);
    note.encryptedEditedByName = note.editedByName;
    note.editedByName = API._decryptMessage(note.editedByName, encryptingKey);
  });
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
    txp.hasUnconfirmedInputs = _.some(txp.inputs, function(input) {
      return input.confirmations == 0;
    });
    self._processTxNotes(txp.note);
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
  if (!body) return;

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
  if (body.code) {
    if (Errors[body.code]) {
      ret = new Errors[body.code];
      if (body.message) ret.message = body.message;
    } else {
      ret = new Error(body.code + ': ' + body.message);
    }
  } else {
    ret = new Error(body.error || JSON.stringify(body));
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
 * @param {String} opts.coin - default 'btc'
 * @param {String} opts.network - default 'livenet'
 */
API.prototype.seedFromRandom = function(opts) {
  $.checkArgument(arguments.length <= 1, 'DEPRECATED: only 1 argument accepted.');
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts), 'DEPRECATED: argument should be an options object.');

  opts = opts || {};
  this.credentials = Credentials.create(opts.coin || 'btc', opts.network || 'livenet');
};


var _deviceValidated;

/**
 * Seed from random
 *
 * @param {Object} opts
 * @param {String} opts.passphrase
 * @param {String} opts.skipDeviceValidation
 */
API.prototype.validateKeyDerivation = function(opts, cb) {
  var self = this;

  opts = opts || {};

  var c = self.credentials;

  function testMessageSigning(xpriv, xpub) {
    var nonHardenedPath = 'm/0/0';
    var message = 'Lorem ipsum dolor sit amet, ne amet urbanitas percipitur vim, libris disputando his ne, et facer suavitate qui. Ei quidam laoreet sea. Cu pro dico aliquip gubergren, in mundi postea usu. Ad labitur posidonium interesset duo, est et doctus molestie adipiscing.';
    var priv = xpriv.deriveChild(nonHardenedPath).privateKey;
    var signature = Utils.signMessage(message, priv);
    var pub = xpub.deriveChild(nonHardenedPath).publicKey;
    return Utils.verifyMessage(message, signature, pub);
  };

  function testHardcodedKeys() {
    var words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    var xpriv = Mnemonic(words).toHDPrivateKey();

    if (xpriv.toString() != 'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu') return false;

    xpriv = xpriv.deriveChild("m/44'/0'/0'");
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
    if (words && (!c.mnemonicHasPassphrase || opts.passphrase)) {
      var m = new Mnemonic(words);
      xpriv = m.toHDPrivateKey(opts.passphrase, c.network);
    }
    if (!xpriv) {
      xpriv = new Bitcore.HDPrivateKey(c.xPrivKey);
    }
    xpriv = xpriv.deriveChild(c.getBaseAddressDerivationPath());
    var xpub = new Bitcore.HDPublicKey(c.xPubKey);

    return testMessageSigning(xpriv, xpub);
  };

  var hardcodedOk = true;
  if (!_deviceValidated && !opts.skipDeviceValidation) {
    hardcodedOk = testHardcodedKeys();
    _deviceValidated = true;
  }

  var liveOk = (c.canSign() && !c.isPrivKeyEncrypted()) ? testLiveKeys() : true;

  self.keyDerivationOk = hardcodedOk && liveOk;

  return cb(null, self.keyDerivationOk);
};

/**
 * Seed from random with mnemonic
 *
 * @param {Object} opts
 * @param {String} opts.coin - default 'btc'
 * @param {String} opts.network - default 'livenet'
 * @param {String} opts.passphrase
 * @param {Number} opts.language - default 'en'
 * @param {Number} opts.account - default 0
 */
API.prototype.seedFromRandomWithMnemonic = function(opts) {
  $.checkArgument(arguments.length <= 1, 'DEPRECATED: only 1 argument accepted.');
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts), 'DEPRECATED: argument should be an options object.');

  opts = opts || {};
  this.credentials = Credentials.createWithMnemonic(opts.coin || 'btc', opts.network || 'livenet', opts.passphrase, opts.language || 'en', opts.account || 0);
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
 * @param {String} opts.coin - default 'btc'
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 */
API.prototype.seedFromExtendedPrivateKey = function(xPrivKey, opts) {
  opts = opts || {};
  this.credentials = Credentials.fromExtendedPrivateKey(opts.coin || 'btc', xPrivKey, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44, opts);
};


/**
 * Seed from Mnemonics (language autodetected)
 * Can throw an error if mnemonic is invalid
 *
 * @param {String} BIP39 words
 * @param {Object} opts
 * @param {String} opts.coin - default 'btc'
 * @param {String} opts.network - default 'livenet'
 * @param {String} opts.passphrase
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 */
API.prototype.seedFromMnemonic = function(words, opts) {
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts), 'DEPRECATED: second argument should be an options object.');

  opts = opts || {};
  this.credentials = Credentials.fromMnemonic(opts.coin || 'btc', opts.network || 'livenet', words, opts.passphrase, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44, opts);
};

/**
 * Seed from external wallet public key
 *
 * @param {String} xPubKey
 * @param {String} source - A name identifying the source of the xPrivKey (e.g. ledger, TREZOR, ...)
 * @param {String} entropySourceHex - A HEX string containing pseudo-random data, that can be deterministically derived from the xPrivKey, and should not be derived from xPubKey.
 * @param {Object} opts
 * @param {String} opts.coin - default 'btc'
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 */
API.prototype.seedFromExtendedPublicKey = function(xPubKey, source, entropySourceHex, opts) {
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts));

  opts = opts || {};
  this.credentials = Credentials.fromExtendedPublicKey(opts.coin || 'btc', xPubKey, source, entropySourceHex, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44);
};


/**
 * Export wallet
 *
 * @param {Object} opts
 * @param {Boolean} opts.password
 * @param {Boolean} opts.noSign
 */
API.prototype.export = function(opts) {
  $.checkState(this.credentials);

  opts = opts || {};

  var output;

  var c = Credentials.fromObj(this.credentials);

  if (opts.noSign) {
    c.setNoSign();
  } else if (opts.password) {
    c.decryptPrivateKey(opts.password);
  }

  output = JSON.stringify(c.toObj());

  return output;
};


/**
 * Import wallet
 *
 * @param {Object} str - The serialized JSON created with #export
 */
API.prototype.import = function(str) {
  try {
    var credentials = Credentials.fromObj(JSON.parse(str));
    this.credentials = credentials;
  } catch (ex) {
    throw new Errors.INVALID_BACKUP;
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
 * @param {String} opts.coin - default 'btc'
 * @param {String} opts.network - default 'livenet'
 * @param {String} opts.passphrase
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 * @param {String} opts.entropySourcePath - Only used if the wallet was created on a HW wallet, in which that private keys was not available for all the needed derivations
 * @param {String} opts.walletPrivKey - if available, walletPrivKey for encrypting metadata
 */
API.prototype.importFromMnemonic = function(words, opts, cb) {
  log.debug('Importing from 12 Words');

  var self = this;

  opts = opts || {};

  function derive(nonCompliantDerivation) {
    return Credentials.fromMnemonic(opts.coin || 'btc', opts.network || 'livenet', words, opts.passphrase, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44, {
      nonCompliantDerivation: nonCompliantDerivation,
      entropySourcePath: opts.entropySourcePath,
      walletPrivKey: opts.walletPrivKey,
    });
  };

  try {
    self.credentials = derive(false);
  } catch (e) {
    log.info('Mnemonic error:', e);
    return cb(new Errors.INVALID_BACKUP);
  }

  self._import(function(err, ret) {
    if (!err) return cb(null, ret);
    if (err instanceof Errors.INVALID_BACKUP) return cb(err);
    if (err instanceof Errors.NOT_AUTHORIZED || err instanceof Errors.WALLET_DOES_NOT_EXIST) {
      var altCredentials = derive(true);
      if (altCredentials.xPubKey.toString() == self.credentials.xPubKey.toString()) return cb(err);
      self.credentials = altCredentials;
      return self._import(cb);
    }
    return cb(err);
  });
};

/*
 * Import from extended private key
 *
 * @param {String} xPrivKey
 * @param {String} opts.coin - default 'btc'
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 * @param {String} opts.compliantDerivation - default 'true'
 * @param {String} opts.walletPrivKey - if available, walletPrivKey for encrypting metadata
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
    this.credentials = Credentials.fromExtendedPrivateKey(opts.coin || 'btc', xPrivKey, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44, opts);
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
 * @param {String} opts.coin - default 'btc'
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 * @param {String} opts.compliantDerivation - default 'true'
 */
API.prototype.importFromExtendedPublicKey = function(xPubKey, source, entropySourceHex, opts, cb) {
  $.checkArgument(arguments.length == 5, "DEPRECATED: should receive 5 arguments");
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts));
  $.shouldBeFunction(cb);

  opts = opts || {};
  log.debug('Importing from Extended Private Key');
  try {
    this.credentials = Credentials.fromExtendedPublicKey(opts.coin || 'btc', xPubKey, source, entropySourceHex, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44, opts);
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

API.prototype.getBalanceFromPrivateKey = function(privateKey, coin, cb) {
  var self = this;

  if (_.isFunction(coin)) {
    cb = coin;
    coin = 'btc';
  }
  var B = Bitcore_[coin];
 
  var privateKey = new B.PrivateKey(privateKey);
  var address = privateKey.publicKey.toAddress();
  self.getUtxos({
    addresses: address.toString(),
  }, function(err, utxos) {
    if (err) return cb(err);
    return cb(null, _.sumBy(utxos, 'satoshis'));
  });
};

API.prototype.buildTxFromPrivateKey = function(privateKey, destinationAddress, opts, cb) {
  var self = this;

  opts = opts || {};

  var coin = opts.coin || 'btc';
  var B = Bitcore_[coin];
  var privateKey = B.PrivateKey(privateKey);
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
      var amount = _.sumBy(utxos, 'satoshis') - fee;
      if (amount <= 0) return next(new Errors.INSUFFICIENT_FUNDS);

      var tx;
      try {
        var toAddress = B.Address.fromString(destinationAddress);

        tx = new B.Transaction()
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
  if (this.supportStaffWalletId) {
    headers['x-wallet-id'] = this.supportStaffWalletId;
  }

  return headers;
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
API.prototype._doRequest = function(method, url, args, useSession, cb) {
  var self = this;

  var headers = self._getHeaders(method, url, args);

  if (self.credentials) {
    headers['x-identity'] = self.credentials.copayerId;

    if (useSession && self.session) {
      headers['x-session'] = self.session;
    } else {
      var reqSignature;
      var key = args._requestPrivKey || self.credentials.requestPrivKey;
      if (key) {
        delete args['_requestPrivKey'];
        reqSignature = API._signRequest(method, url, args, key);
      }
      headers['x-signature'] = reqSignature;
    }
  }

  var r = self.request[method](self.baseUrl + url);

  r.accept('json');

  _.each(headers, function(v, k) {
    if (v) r.set(k, v);
  });

  if (args) {
    if (method == 'post' || method == 'put') {
      r.send(args);

    } else {
      r.query(args);
    }
  }

  r.timeout(self.timeout);

  r.end(function(err, res) {
    if (!res) {
      return cb(new Errors.CONNECTION_ERROR);
    }

    if (res.body)

      log.debug(util.inspect(res.body, {
        depth: 10
      }));

    if (res.status !== 200) {
      if (res.status === 404)
        return cb(new Errors.NOT_FOUND);

      if (!res.status)
        return cb(new Errors.CONNECTION_ERROR);

      log.error('HTTP Error:' + res.status);

      if (!res.body)
        return cb(new Error(res.status));

      return cb(API._parseError(res.body));
    }

    if (res.body === '{"error":"read ECONNRESET"}')
      return cb(new Errors.ECONNRESET_ERROR(JSON.parse(res.body)));

    return cb(null, res.body, res.header);
  });
};

API.prototype._login = function(cb) {
  this._doPostRequest('/v1/login', {}, cb);
};

API.prototype._logout = function(cb) {
  this._doPostRequest('/v1/logout', {}, cb);
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
API.prototype._doRequestWithLogin = function(method, url, args, cb) {
  var self = this;

  function doLogin(cb) {
    self._login(function(err, s) {
      if (err) return cb(err);
      if (!s) return cb(new Errors.NOT_AUTHORIZED);
      self.session = s;
      cb();
    });
  };

  async.waterfall([

    function(next) {
      if (self.session) return next();
      doLogin(next);
    },
    function(next) {
      self._doRequest(method, url, args, true, function(err, body, header) {
        if (err && err instanceof Errors.NOT_AUTHORIZED) {
          doLogin(function(err) {
            if (err) return next(err);
            return self._doRequest(method, url, args, true, next);
          });
        }
        next(null, body, header);
      });
    },
  ], cb);
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
  return this._doRequest('post', url, args, false, cb);
};

API.prototype._doPutRequest = function(url, args, cb) {
  return this._doRequest('put', url, args, false, cb);
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
  return this._doRequest('get', url, {}, false, cb);
};

API.prototype._doGetRequestWithLogin = function(url, cb) {
  url += url.indexOf('?') > 0 ? '&' : '?';
  url += 'r=' + _.random(10000, 99999);
  return this._doRequestWithLogin('get', url, {}, cb);
};

/**
 * Do a DELETE request
 * @private
 *
 * @param {String} url
 * @param {Callback} cb
 */
API.prototype._doDeleteRequest = function(url, cb) {
  return this._doRequest('delete', url, {}, false, cb);
};

API._buildSecret = function(walletId, walletPrivKey, coin, network) {
  if (_.isString(walletPrivKey)) {
    walletPrivKey = Bitcore.PrivateKey.fromString(walletPrivKey);
  }
  var widHex = new Buffer(walletId.replace(/-/g, ''), 'hex');
  var widBase58 = new Bitcore.encoding.Base58(widHex).toString();
  return widBase58.padEnd(22, '0') + walletPrivKey.toWIF() + (network == 'testnet' ? 'T' : 'L') + coin;
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
    var secretSplit = split(secret, [22, 74, 75]);
    var widBase58 = secretSplit[0].replace(/0/g, '');
    var widHex = Bitcore.encoding.Base58.decode(widBase58).toString('hex');
    var walletId = split(widHex, [8, 12, 16, 20]).join('-');

    var walletPrivKey = Bitcore.PrivateKey.fromString(secretSplit[1]);
    var networkChar = secretSplit[2];
    var coin = secretSplit[3] || 'btc';

    return {
      walletId: walletId,
      walletPrivKey: walletPrivKey,
      coin: coin,
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
    $.checkState(i.path, "Input derivation path not available (signing transaction)")
    if (!derived[i.path]) {
      derived[i.path] = xpriv.deriveChild(i.path).privateKey;
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

API.prototype._signTxp = function(txp, password) {
  var derived = this.credentials.getDerivedXPrivKey(password);
  return API.signTxp(txp, derived);
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

  $.checkState(txp.coin);

  var bitcore = Bitcore_[txp.coin];


  var i = 0,
    x = new bitcore.HDPublicKey(xpub);

  _.each(signatures, function(signatureHex) {
    var input = txp.inputs[i];
    try {
      var signature = bitcore.crypto.Signature.fromString(signatureHex);
      var pub = x.deriveChild(txp.inputPaths[i]).publicKey;
      var s = {
        inputIndex: i,
        signature: signature,
        sigtype: bitcore.crypto.Signature.SIGHASH_ALL | bitcore.crypto.Signature.SIGHASH_FORKID,
        publicKey: pub,
      }
      ;
      t.inputs[i].addSignature(t, s);
      i++;
    } catch (e) {} ;
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
 * @param {String} opts.coin
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
    coin: opts.coin,
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
 * Is private key currently encrypted?
 *
 * @return {Boolean}
 */
API.prototype.isPrivKeyEncrypted = function() {
  return this.credentials && this.credentials.isPrivKeyEncrypted();
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
 * Returns unencrypted extended private key and mnemonics
 *
 * @param password
 */
API.prototype.getKeys = function(password) {
  return this.credentials.getKeys(password);
};


/**
 * Checks is password is valid
 * Returns null (keys not encrypted), true or false.
 *
 * @param password
 */
API.prototype.checkPassword = function(password) {
  if (!this.isPrivKeyEncrypted()) return;

  try {
    var keys = this.getKeys(password);
    return !!keys.xPrivKey;
  } catch (e) {
    return false;
  };
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
API.prototype.encryptPrivateKey = function(password, opts) {
  this.credentials.encryptPrivateKey(password, opts || API.privateKeyEncryptionOpts);
};

/**
 * disables encryption for private key.
 *
 * @param {String} password Password used to encrypt
 */
API.prototype.decryptPrivateKey = function(password) {
  return this.credentials.decryptPrivateKey(password);
};

/**
 * Get current fee levels for the specified network
 *
 * @param {string} coin - 'btc' (default) or 'bch'
 * @param {string} network - 'livenet' (default) or 'testnet'
 * @param {Callback} cb
 * @returns {Callback} cb - Returns error or an object with status information
 */
API.prototype.getFeeLevels = function(coin, network, cb) {
  var self = this;

  $.checkArgument(coin || config.chains[coin]);
  $.checkArgument(network || config.chains[coin][network]);

  self._doGetRequest('/v2/feelevels/?coin=' + (coin || 'btc') + '&network=' + (network || 'livenet'), function(err, result) {
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

API.prototype._checkKeyDerivation = function() {
  var isInvalid = (this.keyDerivationOk === false);
  if (isInvalid) {
    log.error('Key derivation for this device is not working as expected');
  }
  return !isInvalid;
};

/**
 *
 * Create a wallet.
 * @param {String} walletName
 * @param {String} copayerName
 * @param {Number} m
 * @param {Number} n
 * @param {object} opts (optional: advanced options)
 * @param {string} opts.coin[='btc'] - The coin for this wallet (btc, bch).
 * @param {string} opts.network[='livenet']
 * @param {string} opts.singleAddress[=false] - The wallet will only ever have one address.
 * @param {String} opts.walletPrivKey - set a walletPrivKey (instead of random)
 * @param {String} opts.id - set a id for wallet (instead of server given)
 * @param cb
 * @return {undefined}
 */
API.prototype.createWallet = function(walletName, copayerName, m, n, opts, cb) {
  var self = this;

  if (!self._checkKeyDerivation()) return cb(new Error('Cannot create new wallet'));

  if (opts) $.shouldBeObject(opts);
  opts = opts || {};

  var coin = opts.coin || 'btc';
  if (!config.chains[coin]) return cb(new Error('Invalid coin'));

  var network = opts.network || 'livenet';
  if (!config.chains[coin][network]) return cb(new Error('Invalid network'));

  if (!self.credentials) {
    log.info('Generating new keys');
    self.seedFromRandom({
      coin: coin,
      network: network
    });
  } else {
    log.info('Using existing keys');
  }

  if (coin != self.credentials.coin) {
    return cb(new Error('Existing keys were created for a different coin'));
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
    path: c.getBaseAddressDerivationPath(),
    coin: coin,
    chain: coin,
    network: network,
    singleAddress: !!opts.singleAddress,
    id: opts.id,
  };

  network = network || 'main';
  coin = coin.toUpperCase();
  var url = `api/${coin}/${network}/wallet/`;
  self._doPostRequest(url, args, function(err, res) {
    if (err) return cb(err);

    var walletId = res._id;
    c.addWalletInfo(walletId, walletName, m, n, copayerName);
    var secret = API._buildSecret(c.walletId, c.walletPrivKey, c.coin, c.network);

    return cb(null, n > 1 ? secret : null);
    /*
     *self._doJoinWallet(walletId, walletPrivKey, c.xPubKey, c.requestPubKey, copayerName, {
     *    coin: coin
     *  },
     *  function(err, wallet) {
     *    if (err) return cb(err);
     *    return cb(null, n > 1 ? secret : null);
     *  });
     */
  });
};

/**
 * Join an existent wallet
 *
 * @param {String} secret
 * @param {String} copayerName
 * @param {Object} opts
 * @param {string} opts.coin[='btc'] - The expected coin for this wallet (btc, bch).
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

  if (!self._checkKeyDerivation()) return cb(new Error('Cannot join wallet'));

  opts = opts || {};

  var coin = opts.coin || 'btc';
  if (!config.chains[coin]) return cb(new Error('Invalid coin'));

  try {
    var secretData = API.parseSecret(secret);
  } catch (ex) {
    return cb(ex);
  }

  if (!self.credentials) {
    self.seedFromRandom({
      coin: coin,
      network: secretData.network
    });
  }

  self.credentials.addWalletPrivateKey(secretData.walletPrivKey.toString());
  self._doJoinWallet(secretData.walletId, secretData.walletPrivKey, self.credentials.xPubKey, self.credentials.requestPubKey, copayerName, {
    coin: coin,
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
    var coin = c.coin;

    var args = {
      name: encWalletName,
      m: c.m,
      n: c.n,
      pubKey: walletPrivKey.toPublicKey().toString(),
      coin: c.coin,
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
          coin: c.coin,
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
 * @param {String} opts.lastNotificationId (optional) - The ID of the last received notification
 * @param {String} opts.timeSpan (optional) - A time window on which to look for notifications (in seconds)
 * @param {String} opts.includeOwn[=false] (optional) - Do not ignore notifications generated by the current copayer
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

  self._doGetRequestWithLogin(url, function(err, result) {
    if (err) return cb(err);

    var notifications = _.filter(result, function(notification) {
      return opts.includeOwn || (notification.creatorId != self.credentials.copayerId);
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
      result.wallet.secret = API._buildSecret(c.walletId, c.walletPrivKey, c.coin, c.network);
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
    coin: this.credentials.coin || 'btc',
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
  if(!opts.wallet){
    return cb(new Error("Wallet id is required"), null);
  }

  opts = opts || {};
  let {coin, network} = opts;
  if(!coin) {
    return cb(new Error("Coin is a required paramter"), null);
  }
  if(!network) {
    return cb(new Error("Network is a required paramter"), null);
  }
  coin = coin.toUpperCase();
  var url = `api/${coin}/${network}/wallet/${opts.wallet}/utxos/`;
  if (opts.addresses) {
    url += '?' + querystring.stringify({
      addresses: [].concat(opts.addresses).join(',')
    });
  }
  this._doGetRequest(url, cb);
};

API.prototype._getCreateTxProposalArgs = function(opts) {
  var self = this;

  var args = _.cloneDeep(opts);
  args.message = API._encryptMessage(opts.message, this.credentials.sharedEncryptingKey) || null;
  args.payProUrl = opts.payProUrl || null;
  _.each(args.outputs, function(o) {
    o.message = API._encryptMessage(o.message, self.credentials.sharedEncryptingKey) || null;
  });

  return args;
};

/**
 * Create a transaction proposal
 *
 * @param {Object} opts
 * @param {string} opts.txProposalId - Optional. If provided it will be used as this TX proposal ID. Should be unique in the scope of the wallet.
 * @param {Array} opts.outputs - List of outputs.
 * @param {string} opts.outputs[].toAddress - Destination address.
 * @param {number} opts.outputs[].amount - Amount to transfer in satoshi.
 * @param {string} opts.outputs[].message - A message to attach to this output.
 * @param {string} opts.message - A message to attach to this transaction.
 * @param {number} opts.feeLevel[='normal'] - Optional. Specify the fee level for this TX ('priority', 'normal', 'economy', 'superEconomy').
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
 * @returns {Callback} cb - Return error or the transaction proposal
 */
API.prototype.createTxProposal = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkState(this.credentials.sharedEncryptingKey);
  $.checkArgument(opts);

  var self = this;

  var args = self._getCreateTxProposalArgs(opts);

  self._doPostRequest('/v2/txproposals/', args, function(err, txp) {
    if (err) return cb(err);

    self._processTxps(txp);

    if (!Verifier.checkProposalCreation(args, txp, self.credentials.sharedEncryptingKey)) {
      return cb(new Errors.SERVER_COMPROMISED);
    }

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
    self._processTxps(txp);
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

  if (!cb) {
    cb = opts;
    opts = {};
    log.warn('DEPRECATED WARN: createAddress should receive 2 parameters.')
  }

  if (!self._checkKeyDerivation()) return cb(new Error('Cannot create new address for this wallet'));

  opts = opts || {};

  self._doPostRequest('/v3/addresses/', opts, function(err, address) {
    if (err) return cb(err);

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
      var fake = _.some(addresses, function(address) {
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
 * @param {String} opts.coin - Optional: defaults to current wallet coin
 * @param {Boolean} opts.twoStep[=false] - Optional: use 2-step balance computation for improved performance
 * @param {String} opts.wallet - Required: the wallet to lookup by id, TODO should be public key
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

  var args = [];
  if (opts.twoStep) args.push('?twoStep=1');
  if (opts.coin) {
    if (!config.chains[opts.coin]) return cb(new Error('Invalid coin'));
    args.push('coin=' + opts.coin);
  }
  var qs = '';
  if (args.length > 0) {
    qs = '?' + args.join('&');
  }

  if(!opts.wallet) {
    return cb(new Error("Wallet is a required paramter"), null);
  }

  let {coin, network} = opts;
  if(!coin) {
    return cb(new Error("Coin is a required paramter"), null);
  }
  if(!network) {
    return cb(new Error("Network is a required paramter"), null);
  }

  coin = coin.toUpperCase();
  var url = `api/${coin}/${network}/wallet/${opts.wallet}/balance`;
  this._doGetRequest(url, (err, resp) => {
    if(err) {
      return cb(err, null);
    }
   cb(null, {totalAmount: resp.balance, lockedAmount: -1});
  });
};

/**
 * Get list of transactions proposals
 *
 * @param {Object} opts
 * @param {Boolean} opts.doNotVerify
 * @param {Boolean} opts.forAirGapped
 * @param {Boolean} opts.doNotEncryptPkr
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
            encryptedPkr: opts.doNotEncryptPkr ? null : Utils.encryptMessage(JSON.stringify(self.credentials.publicKeyRing), self.credentials.personalEncryptingKey),
            unencryptedPkr: opts.doNotEncryptPkr ? JSON.stringify(self.credentials.publicKeyRing) : null,
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


//private?
API.prototype.getPayPro = function(txp, cb) {
  var self = this;
  if (!txp.payProUrl || this.doNotVerifyPayPro)
    return cb();

  PayPro.get({
    url: txp.payProUrl,
    http: self.payProHttp,
    coin: txp.coin || 'btc',
  }, function(err, paypro) {
    if (err) return cb(new Error('Cannot check transaction now:' + err));
    return cb(null, paypro);
  });
};


/**
 * Sign a transaction proposal
 *
 * @param {Object} txp
 * @param {String} password - (optional) A password to decrypt the encrypted private key (if encryption is set).
 * @param {Callback} cb
 * @return {Callback} cb - Return error or object
 */
API.prototype.signTxProposal = function(txp, password, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(txp.creatorId);

  if (_.isFunction(password)) {
    cb = password;
    password = null;
  }

  var self = this;

  if (!txp.signatures) {
    if (!self.canSign())
      return cb(new Errors.MISSING_PRIVATE_KEY);

    if (self.isPrivKeyEncrypted() && !password)
      return cb(new Errors.ENCRYPTED_PRIVATE_KEY);
  }

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
        signatures = self._signTxp(txp, password);
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
 * @param {String} password - (optional) A password to decrypt the encrypted private key (if encryption is set).
 * @return {Object} txp - Return transaction
 */
API.prototype.signTxProposalFromAirGapped = function(txp, encryptedPkr, m, n, password) {
  $.checkState(this.credentials);

  var self = this;

  if (!self.canSign())
    throw new Errors.MISSING_PRIVATE_KEY;

  if (self.isPrivKeyEncrypted() && !password)
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

  return self._signTxp(txp, password);
};


/**
 * Sign transaction proposal from AirGapped
 *
 * @param {String} key - A mnemonic phrase or an xprv HD private key
 * @param {Object} txp
 * @param {String} unencryptedPkr
 * @param {Number} m
 * @param {Number} n
 * @param {Object} opts
 * @param {String} opts.coin (default 'btc')
 * @param {String} opts.passphrase
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 * @return {Object} txp - Return transaction
 */
API.signTxProposalFromAirGapped = function(key, txp, unencryptedPkr, m, n, opts) {
  var self = this;
  opts = opts || {}

  var coin = opts.coin || 'btc';
  if (!config.chains[coin]) return cb(new Error('Invalid coin'));

  var publicKeyRing = JSON.parse(unencryptedPkr);

  if (!_.isArray(publicKeyRing) || publicKeyRing.length != n) {
    throw new Error('Invalid public key ring');
  }

  var newClient = new API({
    baseUrl: 'https://bws.example.com/bws/api'
  });

  if (key.slice(0, 4) === 'xprv' || key.slice(0, 4) === 'tprv') {
    if (key.slice(0, 4) === 'xprv' && txp.network == 'testnet') throw new Error("testnet HD keys must start with tprv");
    if (key.slice(0, 4) === 'tprv' && txp.network == 'livenet') throw new Error("livenet HD keys must start with xprv");
    newClient.seedFromExtendedPrivateKey(key, {
      'coin': coin,
      'account': opts.account,
      'derivationStrategy': opts.derivationStrategy
    });
  } else {
    newClient.seedFromMnemonic(key, {
      'coin': coin,
      'network': txp.network,
      'passphrase': opts.passphrase,
      'account': opts.account,
      'derivationStrategy': opts.derivationStrategy
    })
  }
  newClient.credentials.m = m;
  newClient.credentials.n = n;
  newClient.credentials.addressType = txp.addressType;
  newClient.credentials.addPublicKeyRing(publicKeyRing);

  if (!Verifier.checkTxProposalSignature(newClient.credentials, txp))
    throw new Error('Fake transaction proposal');

  return newClient._signTxp(txp);
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
    self._processTxps(txp);
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
        coin: txp.coin || 'btc',
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

/**
 * Adds access to the current copayer
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
    .deriveChild(this.credentials.getBaseAddressDerivationPath());
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
 * Get a note associated with the specified txid
 * @param {Object} opts
 * @param {string} opts.txid - The txid to associate this note with
 */
API.prototype.getTxNote = function(opts, cb) {
  $.checkState(this.credentials);

  var self = this;

  opts = opts || {};
  self._doGetRequest('/v1/txnotes/' + opts.txid + '/', function(err, note) {
    if (err) return cb(err);
    self._processTxNotes(note);
    return cb(null, note);
  });
};

/**
 * Edit a note associated with the specified txid
 * @param {Object} opts
 * @param {string} opts.txid - The txid to associate this note with
 * @param {string} opts.body - The contents of the note
 */
API.prototype.editTxNote = function(opts, cb) {
  $.checkState(this.credentials);

  var self = this;

  opts = opts || {};
  if (opts.body) {
    opts.body = API._encryptMessage(opts.body, this.credentials.sharedEncryptingKey);
  }
  self._doPutRequest('/v1/txnotes/' + opts.txid + '/', opts, function(err, note) {
    if (err) return cb(err);
    self._processTxNotes(note);
    return cb(null, note);
  });
};

/**
 * Get all notes edited after the specified date
 * @param {Object} opts
 * @param {string} opts.minTs - The starting timestamp
 */
API.prototype.getTxNotes = function(opts, cb) {
  $.checkState(this.credentials);

  var self = this;

  opts = opts || {};
  var args = [];
  if (_.isNumber(opts.minTs)) {
    args.push('minTs=' + opts.minTs);
  }
  var qs = '';
  if (args.length > 0) {
    qs = '?' + args.join('&');
  }

  self._doGetRequest('/v1/txnotes/' + qs, function(err, notes) {
    if (err) return cb(err);
    self._processTxNotes(notes);
    return cb(null, notes);
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
 * Subscribe to push notifications.
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
 * Unsubscribe from push notifications.
 * @param {String} token - Device token
 * @return {Callback} cb - Return error if exists
 */
API.prototype.pushNotificationsUnsubscribe = function(token, cb) {
  var url = '/v2/pushnotifications/subscriptions/' + token;
  this._doDeleteRequest(url, cb);
};

/**
 * Listen to a tx for its first confirmation.
 * @param {Object} opts
 * @param {String} opts.txid - The txid to subscribe to.
 * @returns {Object} response - Status of subscription.
 */
API.prototype.txConfirmationSubscribe = function(opts, cb) {
  var url = '/v1/txconfirmations/';
  this._doPostRequest(url, opts, function(err, response) {
    if (err) return cb(err);
    return cb(null, response);
  });
};

/**
 * Stop listening for a tx confirmation.
 * @param {String} txid - The txid to unsubscribe from.
 * @return {Callback} cb - Return error if exists
 */
API.prototype.txConfirmationUnsubscribe = function(txid, cb) {
  var url = '/v1/txconfirmations/' + txid;
  this._doDeleteRequest(url, cb);
};

/**
 * Returns send max information.
 * @param {String} opts
 * @param {number} opts.feeLevel[='normal'] - Optional. Specify the fee level ('priority', 'normal', 'economy', 'superEconomy').
 * @param {number} opts.feePerKb - Optional. Specify the fee per KB (in satoshi).
 * @param {Boolean} opts.excludeUnconfirmedUtxos - Indicates it if should use (or not) the unconfirmed utxos
 * @param {Boolean} opts.returnInputs - Indicates it if should return (or not) the inputs
 * @return {Callback} cb - Return error (if exists) and object result
 */
API.prototype.getSendMaxInfo = function(opts, cb) {
  var self = this;
  var args = [];
  opts = opts || {};

  if (opts.feeLevel) args.push('feeLevel=' + opts.feeLevel);
  if (opts.feePerKb != null) args.push('feePerKb=' + opts.feePerKb);
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

/**
 * Get wallet status based on a string identifier (one of: walletId, address, txid)
 *
 * @param {string} opts.identifier - The identifier
 * @param {Boolean} opts.twoStep[=false] - Optional: use 2-step balance computation for improved performance
 * @param {Boolean} opts.includeExtendedInfo (optional: query extended status)
 * @returns {Callback} cb - Returns error or an object with status information
 */
API.prototype.getStatusByIdentifier = function(opts, cb) {
  $.checkState(this.credentials);

  var self = this;
  opts = opts || {};

  var qs = [];
  qs.push('includeExtendedInfo=' + (opts.includeExtendedInfo ? '1' : '0'));
  qs.push('twoStep=' + (opts.twoStep ? '1' : '0'));

  self._doGetRequest('/v1/wallets/' + opts.identifier + '?' + qs.join('&'), function(err, result) {
    if (err || !result || !result.wallet) return cb(err);
    if (result.wallet.status == 'pending') {
      var c = self.credentials;
      result.wallet.secret = API._buildSecret(c.walletId, c.walletPrivKey, c.coin, c.network);
    }

    self._processStatus(result);

    return cb(err, result);
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
