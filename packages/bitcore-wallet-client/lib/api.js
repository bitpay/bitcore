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
  eth: Bitcore
};
var Mnemonic = require('bitcore-mnemonic');
var sjcl = require('sjcl');
var url = require('url');
var querystring = require('querystring');

var Common = require('./common');
var Constants = Common.Constants;
var Defaults = Common.Defaults;
var Utils = Common.Utils;

var PayPro = require('./paypro');
var log = require('./log');
const Credentials = require('./credentials');
const Key = require('./key');
const Verifier = require('./verifier');
const Errors = require('./errors');
const Request = require('./request');

var BASE_URL = 'http://localhost:3232/bws/api';

/**
 * @desc ClientAPI constructor.
 *
 * @param {Object} opts
 * @constructor
 */
function API(opts) {
  opts = opts || {};

  this.doNotVerifyPayPro = opts.doNotVerifyPayPro;
  this.timeout = opts.timeout || 50000;
  this.logLevel = opts.logLevel || 'silent';
  this.supportStaffWalletId = opts.supportStaffWalletId;

  this.request = new Request(opts.baseUrl || BASE_URL, {r: opts.request});
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
  self.request.logout(cb);
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

API.prototype.getRootPath = function() {
  return this.credentials.getRootPath();
}

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

API.prototype._processTxNotes = function(notes) {
  var self = this;

  if (!notes) return;

  var encryptingKey = self.credentials.sharedEncryptingKey;
  _.each([].concat(notes), function(note) {
    note.encryptedBody = note.body;
    note.body = Utils.decryptMessageNoThrow(note.body, encryptingKey);
    note.encryptedEditedByName = note.editedByName;
    note.editedByName = Utils.decryptMessageNoThrow(note.editedByName, encryptingKey);
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
    txp.message = Utils.decryptMessageNoThrow(txp.message, encryptingKey) || null;
    txp.creatorName = Utils.decryptMessageNoThrow(txp.creatorName, encryptingKey);

    _.each(txp.actions, function(action) {

      // CopayerName encryption is optional (not available in older wallets)
      action.copayerName = Utils.decryptMessageNoThrow(action.copayerName, encryptingKey);

      action.comment = Utils.decryptMessageNoThrow(action.comment, encryptingKey);
      // TODO get copayerName from Credentials -> copayerId to copayerName
      // action.copayerName = null;
    });
    _.each(txp.outputs, function(output) {
      output.encryptedMessage = output.message;
      output.message = Utils.decryptMessageNoThrow(output.message, encryptingKey) || null;
    });
    txp.hasUnconfirmedInputs = _.some(txp.inputs, function(input) {
      return input.confirmations == 0;
    });
    self._processTxNotes(txp.note);
  });
};

var _deviceValidated;

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

  // TODO => Key refactor to Key class.
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

  // TODO
//  var liveOk = (c.canSign() && !c.isPrivKeyEncrypted()) ? testLiveKeys() : true;
  self.keyDerivationOk = hardcodedOk; // && liveOk;

  return cb(null, self.keyDerivationOk);
};

/**
 * toString() wallet
 *
 * @param {Object} opts
 */
API.prototype.toString = function(opts) {
  $.checkState(this.credentials);
  $.checkArgument(!this.noSign, 'no Sign not supported');
  $.checkArgument(!this.password, 'password not supported');

  opts = opts || {};

  var output;
  var c = Credentials.fromObj(this.credentials);
  output = JSON.stringify(c.toObj());
  return output;
};


/**
 * fromString wallet
 *
 * @param {Object} str - The serialized JSON created with #export
 */
API.prototype.fromString = function(credentials) {
  try {
    if ( !_.isObject(credentials) || ! credentials.xPubKey) {
      credentials = Credentials.fromObj(JSON.parse(credentials));
    }
    this.credentials = credentials;
  } catch (ex) {
    log.warn(`Error importing wallet: ${ex}`);
    if (ex.toString().match(/Obsolete/)) {
      throw new Errors.OBSOLETE_BACKUP;
    } else {
      throw new Errors.INVALID_BACKUP;
    }
  }
  this.request.setCredentials(this.credentials);
};


/**
 * Import from Mnemonics (language autodetected)
 * Can throw an error if mnemonic is invalid
 * Will try compilant and non-compliantDerivation
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
  $.checkState(false, 'not supported');

  log.debug('Importing from Mnemonic');

  var self = this;

  opts = opts || {};
  opts.coin = opts.coin || 'btc';

  function derive(nonCompliantDerivation, useLegacyCoinType) {
    return Credentials.fromMnemonic(opts.coin, opts.network || 'livenet', words, opts.passphrase, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44, {
      nonCompliantDerivation: nonCompliantDerivation,
      entropySourcePath: opts.entropySourcePath,
      walletPrivKey: opts.walletPrivKey,
      useLegacyCoinType, 
    });
  };

  try {
    self.credentials = derive();
  } catch (e) {
    log.info('Mnemonic error:', e);
    return cb(new Errors.INVALID_BACKUP);
  }
  this.request.setCredentials(this.credentials);
 
  self._import(function(err, ret) {
    if (!err) return cb(null, ret);
    if (err instanceof Errors.INVALID_BACKUP) return cb(err);
    if (err instanceof Errors.NOT_AUTHORIZED || err instanceof Errors.WALLET_DOES_NOT_EXIST) {

      var altCredentials;
      // Only BTC wallets can be nonCompliantDerivation
      switch(opts.coin) {
        case 'btc':
          // try using nonCompliantDerivation
          altCredentials = derive(true);
          break;
        case 'bch':
          // try using 0 as coin for BCH (old wallets)
          altCredentials = derive(false, true);
          break;
        default:
          return cb(err);
      }

      if (altCredentials.xPubKey.toString() == self.credentials.xPubKey.toString()) 
        return cb(err);

      self.credentials = altCredentials;
      self.request.setCredentials(self.credentials);
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
  $.checkState(false, 'not supported');
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

  this.request.setCredentials(this.credentials);
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
  $.checkState(false, 'not supported');
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

  this.request.setCredentials(this.credentials);
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
  var addrBuff = Buffer.from(address, 'ascii');
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
  var address = privateKey.publicKey.toAddress().toString(true);

  self.getUtxos({
    addresses: address,
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
  var address = privateKey.publicKey.toAddress().toString(true);

  async.waterfall([

    function(next) {
      self.getUtxos({
        addresses: address,
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
API.prototype.openWallet = function(opts, cb) {
  if (_.isFunction(opts)) {
    cb = opts
  }
  opts = opts || {};

  $.checkState(this.credentials);
  var self = this;
  if (self.credentials.isComplete() && self.credentials.hasWalletInfo())
    return cb(null, true);

    var qs = [];
    qs.push('includeExtendedInfo=1');
    qs.push('serverMessageArray=1');

  self.request.get('/v3/wallets/?' + qs.join('&'), function(err, ret) {
    if (err) return cb(err);
    var wallet = ret.wallet;

    self._processStatus(ret);

    if (!self.credentials.hasWalletInfo()) {
      var me = _.find(wallet.copayers, {
        id: self.credentials.copayerId
      });

      if(!me) return cb(new Error('Copayer not in wallet'));

      try {
        self.credentials.addWalletInfo(wallet.id, wallet.name, wallet.m, wallet.n, me.name, opts);
      } catch (e) {
        if (e.message) {
          log.info('Trying credentials...', e.message); 
        }
        if (e.message && e.message.match(/Bad\snr/)) {
          return cb(new Errors.WALLET_DOES_NOT_EXIST);
        }
        throw e;
      }
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


API._buildSecret = function(walletId, walletPrivKey, coin, network) {
  if (_.isString(walletPrivKey)) {
    walletPrivKey = Bitcore.PrivateKey.fromString(walletPrivKey);
  }
  var widHex = Buffer.from(walletId.replace(/-/g, ''), 'hex');
  var widBase58 = new Bitcore.encoding.Base58(widHex).toString();
  return _.padEnd(widBase58, 22, '0') + walletPrivKey.toWIF() + (network == 'testnet' ? 'T' : 'L') + coin;
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
  this.request.post(url, args, function(err, body) {
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

API._extractPublicKeyRing = function(copayers) {
  return _.map(copayers, function(copayer) {
    var pkr = _.pick(copayer, ['xPubKey', 'requestPubKey']);
    pkr.copayerName = copayer.name;
    return pkr;
  });
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

  $.checkArgument(coin || _.includes(Constants.COINS, coin));
  $.checkArgument(network || _.includes(['livenet', 'testnet'], network));

  self.request.get('/v2/feelevels/?coin=' + (coin || 'btc') + '&network=' + (network || 'livenet'), function(err, result) {
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
  this.request.get('/v1/version/', cb);
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
  if (!_.includes(Constants.COINS, coin)) return cb(new Error('Invalid coin'));

  var network = opts.network || 'livenet';
  if (!_.includes(['testnet', 'livenet'], network)) return cb(new Error('Invalid network'));

  if (!self.credentials) {
    return cb(new Error('Import credentials first with setCredentials()'));
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
    coin: coin,
    network: network,
    singleAddress: !!opts.singleAddress,
    id: opts.id,
    usePurpose48: n>1,
  };
  self.request.post('/v2/wallets/', args, function(err, res) {
    if (err) return cb(err);

    var walletId = res.walletId;
    c.addWalletInfo(walletId, walletName, m, n, copayerName);
    var secret = API._buildSecret(c.walletId, c.walletPrivKey, c.coin, c.network);

    self._doJoinWallet(walletId, walletPrivKey, c.xPubKey, c.requestPubKey, copayerName, {
        coin: coin
      },
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
  if (!_.includes(Constants.COINS, coin)) return cb(new Error('Invalid coin'));

  try {
    var secretData = API.parseSecret(secret);
  } catch (ex) {
    return cb(ex);
  }

  if (!self.credentials) {
    return cb(new Error('Import credentials first with setCredentials()'));
  }

  self.credentials.addWalletPrivateKey(secretData.walletPrivKey.toString());
  self._doJoinWallet(secretData.walletId, secretData.walletPrivKey, self.credentials.xPubKey, self.credentials.requestPubKey, copayerName, {
    coin: coin,
    dryRun: !!opts.dryRun,
  }, function(err, wallet) {
    if (err) return cb(err);
    if (!opts.dryRun) {
      self.credentials.addWalletInfo(wallet.id, wallet.name, wallet.m, wallet.n, copayerName, {allowOverwrite: true});
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

    self.request.post('/v2/wallets/', args, function(err, body) {
      if (err) {
        // return all errors. Can't call addAccess.
        log.info('openWallet error' + err);
        return cb(new Errors.WALLET_DOES_NOT_EXIST);
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

  var name = Utils.decryptMessageNoThrow(wallet.name, encryptingKey);
  if (name != wallet.name) {
    wallet.encryptedName = wallet.name;
  }
  wallet.name = name;
  _.each(wallet.copayers, function(copayer) {
    var name = Utils.decryptMessageNoThrow(copayer.name, encryptingKey);
    if (name != copayer.name) {
      copayer.encryptedName = copayer.name;
    }
    copayer.name = name;
    _.each(copayer.requestPubKeys, function(access) {
      if (!access.name) return;

      var name = Utils.decryptMessageNoThrow(access.name, encryptingKey);
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

  self.request.getWithLogin(url, function(err, result) {
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
  qs.push('serverMessageArray=1');

  self.request.get('/v3/wallets/?' + qs.join('&'), function(err, result) {
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
  self.request.get('/v1/preferences/', function(err, preferences) {
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
  self.request.put('/v1/preferences/', preferences, cb);
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
    coin: this.credentials.coin || 'btc',
    network: this.credentials.network || 'livenet',

    // for testing
    request: this.request,
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
  this.request.get(url, cb);
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

  self.request.post('/v3/txproposals/', args, function(err, txp) {
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

  var url = '/v2/txproposals/' + opts.txp.id + '/publish/';
  self.request.post(url, args, function(err, txp) {
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

  self.request.post('/v4/addresses/', opts, function(err, address) {
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

  self.request.get(url, function(err, addresses) {
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
  if (opts.coin) {
    if (!_.includes(Constants.COINS, opts.coin)) return cb(new Error('Invalid coin'));
    args.push('coin=' + opts.coin);
  }
  var qs = '';
  if (args.length > 0) {
    qs = '?' + args.join('&');
  }

  var url = '/v1/balance/' + qs;
  this.request.get(url, cb);
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

  self.request.get('/v2/txproposals/', function(err, txps) {
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
    coin: txp.coin || 'btc',
    network: txp.network || 'livenet',

    // for testing
    request: self.request,
  }, function(err, paypro) {
    if (err) return cb(new Error('Could not fetch invoice:' + (err.message? err.message : err)));
    return cb(null, paypro);
  });
};


/**
 * push transaction proposal signatures
 *
 * @param {Object} txp
 * @param {Array} signatures
 * @param {Callback} cb
 * @return {Callback} cb - Return error or object
 */
API.prototype.pushSignatures = function(txp, signatures, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(txp.creatorId);
  var self = this;

  if (_.isEmpty(signatures)) {
    return cb('No signatures to push. Sign the transaction with Key first');
  }

  self.getPayPro(txp, function(err, paypro) {
    if (err) return cb(err);
 
    var isLegit = Verifier.checkTxProposal(self.credentials, txp, {
      paypro: paypro,
    });

    if (!isLegit)
      return cb(new Errors.SERVER_COMPROMISED);


    var url = '/v1/txproposals/' + txp.id + '/signatures/';
    var args = {
      signatures: signatures
    };

    self.request.post(url, args, function(err, txp) {
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
  throw new Error('signTxProposalFromAirGapped not yet implemented in v9.0.0');
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
  if (!_.includes(Constants.COINS, coin)) return cb(new Error('Invalid coin'));

  var publicKeyRing = JSON.parse(unencryptedPkr);

  if (!_.isArray(publicKeyRing) || publicKeyRing.length != n) {
    throw new Error('Invalid public key ring');
  }

  var newClient = new API({
    baseUrl: 'https://bws.example.com/bws/api'
  });

  // TODO TODO TODO
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
  self.request.post(url, args, function(err, txp) {
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
  self.request.post(url, opts, function(err, txid) {
    if (err) return cb(err);
    return cb(null, txid);
  });
};

API.prototype._doBroadcast = function(txp, cb) {
  var self = this;
  var url = '/v1/txproposals/' + txp.id + '/broadcast/';
  self.request.post(url, {}, function(err, txp) {
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
    if (err) return cb(err);

    if (paypro) {

      var t_unsigned = Utils.buildTx(txp);
      var t = Utils.buildTx(txp);
      self._applyAllSignatures(txp, t);

      PayPro.send({
        url: txp.payProUrl,
        amountSat: txp.amount,
        rawTxUnsigned: t_unsigned.uncheckedSerialize(),
        rawTx: t.serialize({
          disableSmallFees: true,
          disableLargeFees: true,
          disableDustOutputs: true
        }),
        coin: txp.coin || 'btc',
        network: txp.network || 'livenet',

        // for testing
        request: self.request,
      }, function(err, ack, memo) {
        if (err) {
          return cb(err);
        }

        if (memo) {
          log.debug('Merchant memo:', memo);
        }
        self._doBroadcast(txp, function(err2, txp) {
          return cb(err2, txp, memo, err);
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
  self.request.delete(url, function(err) {
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
  self.request.get(url, function(err, txs) {
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
  this.request.get(url, function(err, txp) {
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

  self.request.post('/v1/addresses/scan', args, function(err) {
    return cb(err);
  });
};



/**
 * Adds access to the current copayer
 * @param {Object} opts
 * @param {bool} opts.reqPrivKey
 * @param {bool} opts.signature of the private key, from master key.
 * @param {string} opts.restrictions
 *    - cannotProposeTXs
 *    - cannotXXX TODO
 * @param {string} opts.name  (name for the new access)
 *
 * return the accesses Wallet and the requestPrivateKey
 */
API.prototype.addAccess = function(opts, cb) {
  $.checkState(this.credentials);
  $.shouldBeString(opts.requestPrivKey, 'no requestPrivKey at addAccess() ');
  $.shouldBeString(opts.signature, 'no signature at addAccess()');

  var self = this;

  opts = opts || {};
  var requestPubKey = (new Bitcore.PrivateKey(opts.requestPrivKey)).toPublicKey().toString();
  var copayerId = this.credentials.copayerId;
  var encCopayerName = opts.name ? Utils.encryptMessage(opts.name, this.credentials.sharedEncryptingKey) : null;

  var opts2 = {
    copayerId: copayerId,
    requestPubKey: requestPubKey,
    signature: opts.signature,
    name: encCopayerName,
    restrictions: opts.restrictions,
  };

  this.request.put('/v1/copayers/' + copayerId + '/', opts2, function(err, res) {
    if (err) return cb(err);
    // Do not set the key. Return it (for compatibility)
    //self.credentials.requestPrivKey = opts.requestPrivKey;
    return cb(null, res.wallet, opts.requestPrivKey);
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
  self.request.get('/v1/txnotes/' + opts.txid + '/', function(err, note) {
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
  self.request.put('/v1/txnotes/' + opts.txid + '/', opts, function(err, note) {
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

  self.request.get('/v1/txnotes/' + qs, function(err, notes) {
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
 * @param {String} [opts.coin] - Coin (detault: 'btc')
 * @returns {Object} rates - The exchange rate.
 */
API.prototype.getFiatRate = function(opts, cb) {
  $.checkArgument(cb);

  var self = this;

  var opts = opts || {};

  var args = [];
  if (opts.ts) args.push('ts=' + opts.ts);
  if (opts.coin) args.push('coin=' + opts.coin);
  var qs = '';
  if (args.length > 0) {
    qs = '?' + args.join('&');
  }

  self.request.get('/v1/fiatrates/' + opts.code + '/' + qs, function(err, rates) {
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
  this.request.post(url, opts, function(err, response) {
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
  this.request.delete(url, cb);
};

/**
 * Listen to a tx for its first confirmation.
 * @param {Object} opts
 * @param {String} opts.txid - The txid to subscribe to.
 * @returns {Object} response - Status of subscription.
 */
API.prototype.txConfirmationSubscribe = function(opts, cb) {
  var url = '/v1/txconfirmations/';
  this.request.post(url, opts, function(err, response) {
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
  this.request.delete(url, cb);
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

  self.request.get(url, function(err, result) {
    if (err) return cb(err);
    return cb(null, result);
  });
};

/**
 * Get wallet status based on a string identifier (one of: walletId, address, txid)
 *
 * @param {string} opts.identifier - The identifier
 * @param {Boolean} opts.includeExtendedInfo (optional: query extended status)
 * @param {Boolean} opts.walletCheck (optional:  run v8 walletCheck if wallet found)
 * @returns {Callback} cb - Returns error or an object with status information
 */
API.prototype.getStatusByIdentifier = function(opts, cb) {
  $.checkState(this.credentials);

  var self = this;
  opts = opts || {};

  var qs = [];
  qs.push('includeExtendedInfo=' + (opts.includeExtendedInfo ? '1' : '0'));
  qs.push('walletCheck=' + (opts.walletCheck ? '1' : '0'));

  self.request.get('/v1/wallets/' + opts.identifier + '?' + qs.join('&'), function(err, result) {
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
 * upgradeCredentialsV1 
 * upgrade Credentials V1 to Key and Credentials V2 object
 *
 * @param {Object} x - Credentials V1 Object
 
 * @returns {Callback} cb - Returns { err, {key, credentials} }
 */

API.upgradeCredentialsV1 = function(x) {
  $.shouldBeObject(x);

  if (!_.isUndefined(x.version) || (!x.xPrivKey && !x.xPrivKeyEncrypted && !x.xPubKey)) {
    throw 'Could not recognize old version';
  }

  let k;
  if (x.xPrivKey || x.xPrivKeyEncrypted) {
    k = new Key();
    _.each(Key.FIELDS, (i) => {
      if (!_.isUndefined(x[i])) {
        k[i] = x[i];
      }
    });

    // If the wallet was single seed... multisig walelts accounts
    // will be 48'
    k.use44forMultisig = x.n > 1 ? true : false;

    // if old credentials had use145forBCH...use it.
    // else,if the wallet is bch, set it to true.
    k.use0forBCH = x.use145forBCH ? false : ( x.coin =='bch' ? true : false );

    k.BIP45 = x.derivationStrategy == 'BIP45';
  } else {
    // RO credentials
    k = false;
  }


  let obsoleteFields = {
    version: true,
    xPrivKey: true,
    xPrivKeyEncrypted: true,
    hwInfo: true,
    entropySourcePath: true,
    mnemonic: true,
    mnemonicEncrypted: true,
  };


  var c = new Credentials();
  _.each(Credentials.FIELDS, function(i) {
    if (!obsoleteFields[i]) {
      c[i] = x[i];
    }
  });
  if (c.externalSource) {
    throw new Error('External Wallets are no longer supported');
  }
  c.coin = c.coin || 'btc';
  c.addressType = c.addressType || Constants.SCRIPT_TYPES.P2SH;
  c.account = c.account || 0;
  c.rootPath = c.getRootPath();
  c.keyId = k.id;
  return {key: k, credentials: c};
};


/**
 * upgradeMultipleCredentialsV1 
 * upgrade multiple Credentials V1 and (opionally) keys to Key and Credentials V2 object
 * Duplicate keys will be identified and merged.
 *
 * @param {Object} credentials - Credentials V1 Object
 * @param {Object} keys - Key object
 *
 
 * @returns {Callback} cb - Returns { err, {keys, credentials} }
 */


API.upgradeMultipleCredentialsV1 = function(oldCredentials) {

  let newKeys = [],
    newCrededentials = [];
  // Try to migrate to Credentials 2.0
  _.each(oldCredentials, credentials => {
    let migrated;

    if (!credentials.version || credentials.version < 2) {
      log.info('About to migrate : ' + credentials.walletId);

      migrated = API.upgradeCredentialsV1(credentials);
      newCrededentials.push(migrated.credentials);

      if (migrated.key) {
        log.info(`Wallet ${credentials.walletId} key's extracted`);
        newKeys.push(migrated.key);
      } else {
        log.info(`READ-ONLY Wallet ${credentials.walletId} migrated`);
      }
    }
  });

  if (newKeys.length > 0) {
    // Find and merge dup keys.
    let credGroups = _.groupBy(newCrededentials, (x) => {
      $.checkState(x.xPubKey, 'no xPubKey at credentials!');
      let xpub = new Bitcore.HDPublicKey(x.xPubKey);
      let fingerPrint = xpub.fingerPrint.toString('hex');
      return fingerPrint;
    });

    if (_.keys(credGroups).length < newCrededentials.length) {
      log.info(`Found some wallets using the SAME key. Merging...`);

      let uniqIds = {};

      _.each(_.values(credGroups), credList => {
        let toKeep = credList.shift();
        if (!toKeep.keyId) return;
        uniqIds[toKeep.keyId]=true;

        if (!credList.length) return;
        log.info(`Merging ${credList.length} keys to ${toKeep.keyId}`);
        _.each(credList, x => {
          log.info(`\t${x.keyId} is now ${toKeep.keyId}`);
            x.keyId = toKeep.keyId;
        });
      });

      newKeys = _.filter(newKeys, x => uniqIds[x.id]);;
    }
  }

  return  {
    keys: newKeys,
    credentials: newCrededentials,
  };
};


/**
 * serverAssistedImport 
 * Imports  EXISTING wallets against BWS and return key & clients[] for each account / coin
 *
 * @param {Object} opts
 * @param {String} opts.words - mnemonic
 * @param {String} opts.xPrivKey - extended Private Key 
 * @param {String} opts.passphrase - mnemonic's passphrase (optional)
 * @param {Object} clientOpts  - BWS connection options (see ClientAPI constructor)
 
 * @returns {Callback} cb - Returns { err, key, clients[] }
 */

API.serverAssistedImport = (opts, clientOpts, callback) => {
  var self = this;

  $.checkArgument(opts.words || opts.xPrivKey, "provide opts.words or opts.xPrivKey");

  let copayerIdAlreadyTested = {};
  function checkCredentials(key, opts, icb) {
    let c = key.createCredentials(null, {
      coin: opts.coin, 
      network: opts.network, 
      account: opts.account, 
      n: opts.n,
    });


    if (copayerIdAlreadyTested[c.copayerId + ':' + opts.n]) {
//console.log('[api.js.2226] ALREADY T:', opts.n); // TODO
      return  icb();
    } else {
     copayerIdAlreadyTested[c.copayerId+ ':' + opts.n] = true;
    }

    let client  = clientOpts.clientFactory ?  clientOpts.clientFactory() :  new API(clientOpts);

    client.fromString(c);
    client.openWallet({}, function(err) {
      console.log(`PATH: ${c.rootPath} n: ${c.n}:`, (err && err.message) ? err.message : 'FOUND!'); // TODO
      // Exists
      if (!err) return icb(null, client);
      if (err instanceof Errors.NOT_AUTHORIZED || 
        err instanceof Errors.WALLET_DOES_NOT_EXIST) {
        return icb();
      }

      return icb(err);
    })
  };
  
  function checkKey(key, cb) {
    let opts = [

      //coin, network,  multisig
      ['btc', 'livenet', ],
      ['bch', 'livenet', ],
      ['eth', 'livenet', ],
      ['eth', 'testnet', ],
      ['btc', 'livenet', true ],
      ['bch', 'livenet', true ],
    ];
    if (key.use44forMultisig) {
      //  testing old multi sig
      opts = opts.filter((x) => {
        return x[2];
      });
    }

    if (key.use0forBCH) {
      //  testing BCH, old coin=0 wallets
      opts = opts.filter((x) => {
        return x[0] == 'bch';
      });
    }

    if (!key.nonCompliantDerivation) {
      // TESTNET
      let testnet = _.cloneDeep(opts);
      testnet.forEach((x) => { x[1] = 'testnet' });
      opts = opts.concat(testnet);
    } else {
      //  leave only BTC, and no testnet
      opts = opts.filter((x) => {
        return x[0] == 'btc';
      });
    }

    let clients = [];
    async.eachSeries(opts, 
      (x, next) => {
        let optsObj = {
          coin: x[0] ,
          network: x[1],
          account: 0,
          n: x[2] ? 2: 1,
        };
//console.log('[api.js.2287:optsObj:]',optsObj); // TODO
        // TODO OPTI: do not scan accounts if XX
        //
        // 1. check account 0
        checkCredentials(key, optsObj, (err, iclient) => {
          if (err) return next(err);
          if (!iclient) return next();
          clients.push(iclient);

          // Accounts not allowed?
          if (key.use0forBCH || !key.compliantDerivation || key.use44forMultisig || key.BIP45) 
            return next();

          // Now, lets scan all accounts for the found client
          let cont = true, account = 1;
          async.whilst(() => {
            return cont;
          }, (icb) => {
            optsObj.account = account++;

            checkCredentials(key, optsObj, (err, iclient) => {
              if (err) return icb(err);
              cont = !!iclient;
              if (iclient) {
               clients.push(iclient);
              } else {
                // we do not allow accounts nr gaps in BWS. 
                cont = false;
              };
              return icb();
            });
          }, (err) => {
            return next(err);
          });
        });
      }, 
      (err) => {
        if (err) return cb(err);
        return cb(null, clients);
      });
  };


  let sets = [ 
    {
      // current wallets: /[44,48]/[0,145]'/
      nonCompliantDerivation: false,
      useLegacyCoinType: false,
      useLegacyPurpose: false,
    },
    {
      // older bch wallets: /[44,48]/[0,0]'/
      nonCompliantDerivation: false,
      useLegacyCoinType: true,
      useLegacyPurpose: false,
    },
    {
      // older BTC/BCH  multisig wallets: /[44]/[0,145]'/
      nonCompliantDerivation: false,
      useLegacyCoinType: false,
      useLegacyPurpose: true,
    },
    {
      // not that // older multisig BCH wallets: /[44]/[0]'/
      nonCompliantDerivation: false,
      useLegacyCoinType: true,
      useLegacyPurpose: true,
    },
 
    {
      // old BTC no-comp wallets: /44'/[0]'/
      nonCompliantDerivation: true,
      useLegacyPurpose: true,
    },
  ];

  let s, resultingClients = [], k;
  async.whilst(() => {
    if (! _.isEmpty(resultingClients))
      return false;

    s = sets.shift();
    if (!s) 
      return false;


    try {
      if (opts.words) { 

        if (opts.passphrase) {
          s.passphrase = opts.passphrase;
        }

        k  = Key.fromMnemonic(opts.words, s);
      } else {
        k  = Key.fromExtendedPrivateKey(opts.xPrivKey, s);
      }
    } catch (e) {
      log.info('Backup error:', e);
      return callback(new Errors.INVALID_BACKUP);
    }
    return true;
  }, (icb) => {
    checkKey(k, (err, clients) => {
      if (err) return icb(err);

      if (clients && clients.length) {
        resultingClients = clients;
      }
      return icb();
    });
  }, (err) => {
    if (err) return callback(err);

    if (_.isEmpty(resultingClients)) 
      k=null;

    return callback(null, k, resultingClients);
  });
};



API.PayPro = PayPro;
API.Key = Key;
module.exports = API;
