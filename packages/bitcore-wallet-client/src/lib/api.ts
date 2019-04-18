'use strict';

import { EventEmitter } from 'events';
import * as _ from 'lodash';

var $ = require('preconditions').singleton();
var async = require('async');
var Bitcore = require('bitcore-lib');
var Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash'),
};
var Mnemonic = require('bitcore-mnemonic');
var sjcl = require('sjcl');
var querystring = require('querystring');

var Common = require('./common');
var Constants = Common.Constants;
var Utils = Common.Utils;

var PayPro = require('./paypro');
var log = require('./log');
var Credentials = require('./credentials');
var Verifier = require('./verifier');
var Errors = require('./errors');
const Request = require('./request');

var BASE_URL = 'http://localhost:3232/bws/api';

/**
 * @desc ClientAPI constructor.
 *
 * @param {Object} opts
 * @constructor
 */
export class API extends EventEmitter {
  doNotVerifyPayPro: any;
  timeout: any;
  logLevel: any;
  supportStaffWalletId: any;
  request: any;
  credentials: any;
  notificationIncludeOwn: boolean;
  lastNotificationId: any;
  notificationsIntervalId: NodeJS.Timeout;
  _deviceValidated: any;
  keyDerivationOk: any;
  privateKeyEncryptionOpts = {
    iter: 10000
  };


  constructor(opts) {
    super();
    opts = opts || {};

    this.doNotVerifyPayPro = opts.doNotVerifyPayPro;
    this.timeout = opts.timeout || 50000;
    this.logLevel = opts.logLevel || 'silent';
    this.supportStaffWalletId = opts.supportStaffWalletId;

    this.request = new Request(opts.baseUrl || BASE_URL, { r: opts.request });
    log.setLevel(this.logLevel);
  };

  initNotifications(cb) {
    log.warn('DEPRECATED: use initialize() instead.');
    this.initialize({}, cb);
  };

  initialize(opts, cb) {
    $.checkState(this.credentials);


    this.notificationIncludeOwn = !!opts.notificationIncludeOwn;
    this._initNotifications(opts);
    return cb();
  };

  dispose(cb) {
    this._disposeNotifications();
    this.request.logout(cb);
  };

  _fetchLatestNotifications(interval, cb) {

    cb = cb || function () { };

    var opts: any = {
      lastNotificationId: this.lastNotificationId,
      includeOwn: this.notificationIncludeOwn,
    };

    if (!this.lastNotificationId) {
      opts.timeSpan = interval + 1;
    }

    this.getNotifications(opts, function (err, notifications) {
      if (err) {
        log.warn('Error receiving notifications.');
        log.debug(err);
        return cb(err);
      }
      if (notifications.length > 0) {
        this.lastNotificationId = _.last(notifications).id;
      }

      _.each(notifications, function (notification) {
        this.emit('notification', notification);
      });
      return cb();
    });
  };

  _initNotifications(opts) {

    opts = opts || {};

    var interval = opts.notificationIntervalSeconds || 5;
    this.notificationsIntervalId = setInterval(function () {
      this._fetchLatestNotifications(interval, function (err) {
        if (err) {
          if (err instanceof Errors.NOT_FOUND || err instanceof Errors.NOT_AUTHORIZED) {
            this._disposeNotifications();
          }
        }
      });
    }, interval * 1000);
  };

  _disposeNotifications() {

    if (this.notificationsIntervalId) {
      clearInterval(this.notificationsIntervalId);
      this.notificationsIntervalId = null;
    }
  };


  /**
   * Reset notification polling with new interval
   * @param {Numeric} notificationIntervalSeconds - use 0 to pause notifications
   */
  setNotificationsInterval(notificationIntervalSeconds) {
    this._disposeNotifications();
    if (notificationIntervalSeconds > 0) {
      this._initNotifications({
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
  _encryptMessage(message, encryptingKey) {
    if (!message) return null;
    return Utils.encryptMessage(message, encryptingKey);
  };

  _processTxNotes(notes) {

    if (!notes) return;

    var encryptingKey = this.credentials.sharedEncryptingKey;
    _.each([].concat(notes), function (note) {
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
  _processTxps(txps) {
    if (!txps) return;

    var encryptingKey = this.credentials.sharedEncryptingKey;
    _.each([].concat(txps), function (txp) {
      txp.encryptedMessage = txp.message;
      txp.message = Utils.decryptMessageNoThrow(txp.message, encryptingKey) || null;
      txp.creatorName = Utils.decryptMessageNoThrow(txp.creatorName, encryptingKey);

      _.each(txp.actions, function (action) {

        // CopayerName encryption is optional (not available in older wallets)
        action.copayerName = Utils.decryptMessageNoThrow(action.copayerName, encryptingKey);

        action.comment = Utils.decryptMessageNoThrow(action.comment, encryptingKey);
        // TODO get copayerName from Credentials -> copayerId to copayerName
        // action.copayerName = null;
      });
      _.each(txp.outputs, function (output) {
        output.encryptedMessage = output.message;
        output.message = Utils.decryptMessageNoThrow(output.message, encryptingKey) || null;
      });
      txp.hasUnconfirmedInputs = _.some(txp.inputs, function (input) {
        return input.confirmations == 0;
      });
      this._processTxNotes(txp.note);
    });
  };

  /**
   * Seed from random
   *
   * @param {Object} opts
   * @param {String} opts.coin - default 'btc'
   * @param {String} opts.network - default 'livenet'
   */
  seedFromRandom(opts) {
    $.checkArgument(arguments.length <= 1, 'DEPRECATED: only 1 argument accepted.');
    $.checkArgument(_.isUndefined(opts) || _.isObject(opts), 'DEPRECATED: argument should be an options object.');

    opts = opts || {};
    this.credentials = Credentials.create(opts.coin || 'btc', opts.network || 'livenet');

    this.request.setCredentials(this.credentials);
  };


  // var _deviceValidated;

  /**
   * Seed from random
   *
   * @param {Object} opts
   * @param {String} opts.passphrase
   * @param {Boolean} opts.skipDeviceValidation
   */
  validateKeyDerivation(opts, cb) {

    opts = opts || {};

    var c = this.credentials;

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
      } catch (ex) { }

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
    if (!this._deviceValidated && !opts.skipDeviceValidation) {
      hardcodedOk = testHardcodedKeys();
      this._deviceValidated = true;
    }

    var liveOk = (c.canSign() && !c.isPrivKeyEncrypted()) ? testLiveKeys() : true;

    this.keyDerivationOk = hardcodedOk && liveOk;

    return cb(null, this.keyDerivationOk);
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
  seedFromRandomWithMnemonic(opts) {
    $.checkArgument(arguments.length <= 1, 'DEPRECATED: only 1 argument accepted.');
    $.checkArgument(_.isUndefined(opts) || _.isObject(opts), 'DEPRECATED: argument should be an options object.');

    opts = opts || {};
    this.credentials = Credentials.createWithMnemonic(opts.coin || 'btc', opts.network || 'livenet', opts.passphrase, opts.language || 'en', opts.account || 0);
    this.request.setCredentials(this.credentials);
  };

  getMnemonic() {
    return this.credentials.getMnemonic();
  };

  mnemonicHasPassphrase() {
    return this.credentials.mnemonicHasPassphrase;
  };



  clearMnemonic() {
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
  seedFromExtendedPrivateKey(xPrivKey, opts) {
    opts = opts || {};
    this.credentials = Credentials.fromExtendedPrivateKey(opts.coin || 'btc', xPrivKey, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44, opts);
    this.request.setCredentials(this.credentials);
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
  seedFromMnemonic(words, opts) {
    $.checkArgument(_.isUndefined(opts) || _.isObject(opts), 'DEPRECATED: second argument should be an options object.');

    opts = opts || {};
    this.credentials = Credentials.fromMnemonic(opts.coin || 'btc', opts.network || 'livenet', words, opts.passphrase, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44, opts);
    this.request.setCredentials(this.credentials);
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
  seedFromExtendedPublicKey(xPubKey, source, entropySourceHex, opts) {
    $.checkArgument(_.isUndefined(opts) || _.isObject(opts));

    opts = opts || {};
    this.credentials = Credentials.fromExtendedPublicKey(opts.coin || 'btc', xPubKey, source, entropySourceHex, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44);
    this.request.setCredentials(this.credentials);
  };


  /**
   * Export wallet
   *
   * @param {Object} opts
   * @param {Boolean} opts.password
   * @param {Boolean} opts.noSign
   */
  export(opts) {
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
  import(str) {
    try {
      var credentials = Credentials.fromObj(JSON.parse(str));
      this.credentials = credentials;
    } catch (ex) {
      throw new Errors.INVALID_BACKUP;
    }
    this.request.setCredentials(this.credentials);
  };

  _import(cb) {
    $.checkState(this.credentials);


    // First option, grab wallet info from BWS.
    this.openWallet(function (err, ret) {

      // it worked?
      if (!err) return cb(null, ret);

      // Is the error other than "copayer was not found"? || or no priv key.
      if (err instanceof Errors.NOT_AUTHORIZED || this.isPrivKeyExternal())
        return cb(err);

      //Second option, lets try to add an access
      log.info('Copayer not found, trying to add access');
      this.addAccess({}, function (err) {
        if (err) {
          return cb(new Errors.WALLET_DOES_NOT_EXIST);
        }

        this.openWallet(cb);
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
  importFromMnemonic(words, opts, cb) {
    log.debug('Importing from Mnemonic');


    opts = opts || {};

    function derive(nonCompliantDerivation) {
      return Credentials.fromMnemonic(opts.coin || 'btc', opts.network || 'livenet', words, opts.passphrase, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44, {
        nonCompliantDerivation: nonCompliantDerivation,
        entropySourcePath: opts.entropySourcePath,
        walletPrivKey: opts.walletPrivKey,
      });
    };

    try {
      this.credentials = derive(false);
    } catch (e) {
      log.info('Mnemonic error:', e);
      return cb(new Errors.INVALID_BACKUP);
    }
    this.request.setCredentials(this.credentials);

    this._import(function (err, ret) {
      if (!err) return cb(null, ret);
      if (err instanceof Errors.INVALID_BACKUP) return cb(err);
      if (err instanceof Errors.NOT_AUTHORIZED || err instanceof Errors.WALLET_DOES_NOT_EXIST) {
        var altCredentials = derive(true);
        if (altCredentials.xPubKey.toString() == this.credentials.xPubKey.toString()) return cb(err);
        this.credentials = altCredentials;
        this.request.setCredentials(this.credentials);
        return this._import(cb);
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
  importFromExtendedPrivateKey(xPrivKey, opts, cb) {
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
  importFromExtendedPublicKey(xPubKey, source, entropySourceHex, opts, cb) {
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

  decryptBIP38PrivateKey(encryptedPrivateKeyBase58, passphrase, opts, cb) {
    var Bip38 = require('bip38');
    var bip38 = new Bip38();

    var privateKeyWif;
    try {
      privateKeyWif = bip38.decrypt(encryptedPrivateKeyBase58, passphrase);
    } catch (ex) {
      return cb(new Error('Could not decrypt BIP38 private key' + ex));
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

  getBalanceFromPrivateKey(privateKey, coin, cb) {

    if (_.isFunction(coin)) {
      cb = coin;
      coin = 'btc';
    }
    var B = Bitcore_[coin];

    var privateKey = new B.PrivateKey(privateKey);
    var address = privateKey.publicKey.toAddress();
    this.getUtxos({
      addresses: coin == 'bch' ? address.toLegacyAddress() : address.toString(),
    }, function (err, utxos) {
      if (err) return cb(err);
      return cb(null, _.sumBy(utxos, 'satoshis'));
    });
  };

  buildTxFromPrivateKey(privateKey, destinationAddress, opts, cb) {

    opts = opts || {};

    var coin = opts.coin || 'btc';
    var B = Bitcore_[coin];
    var privateKey = B.PrivateKey(privateKey);
    var address = privateKey.publicKey.toAddress();

    async.waterfall([

      function (next) {
        this.getUtxos({
          addresses: coin == 'bch' ? address.toLegacyAddress() : address.toString(),
        }, function (err, utxos) {
          return next(err, utxos);
        });
      },
      function (utxos, next) {
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
  openWallet(cb) {
    $.checkState(this.credentials);
    if (this.credentials.isComplete() && this.credentials.hasWalletInfo())
      return cb(null, true);

    var qs = [];
    qs.push('includeExtendedInfo=1');
    qs.push('serverMessageArray=1');

    this.request.get('/v3/wallets/?' + qs.join('&'), function (err, ret) {
      if (err) return cb(err);
      var wallet = ret.wallet;

      this._processStatus(ret);

      if (!this.credentials.hasWalletInfo()) {
        var me = _.find(wallet.copayers, {
          id: this.credentials.copayerId
        });
        this.credentials.addWalletInfo(wallet.id, wallet.name, wallet.m, wallet.n, me.name);
      }

      if (wallet.status != 'complete')
        return cb();

      if (this.credentials.walletPrivKey) {
        if (!Verifier.checkCopayers(this.credentials, wallet.copayers)) {
          return cb(new Errors.SERVER_COMPROMISED);
        }
      } else {
        // this should only happen in AIR-GAPPED flows
        log.warn('Could not verify copayers key (missing wallet Private Key)');
      }

      this.credentials.addPublicKeyRing(this._extractPublicKeyRing(wallet.copayers));

      this.emit('walletCompleted', wallet);

      return cb(null, ret);
    });
  };


  _buildSecret(walletId, walletPrivKey, coin, network) {
    if (_.isString(walletPrivKey)) {
      walletPrivKey = Bitcore.PrivateKey.fromString(walletPrivKey);
    }
    var widHex = new Buffer(walletId.replace(/-/g, ''), 'hex');
    var widBase58 = new Bitcore.encoding.Base58(widHex).toString();
    return _.padEnd(widBase58, 22, '0') + walletPrivKey.toWIF() + (network == 'testnet' ? 'T' : 'L') + coin;
  };

  parseSecret(secret) {
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

  getRawTx(txp) {
    var t = Utils.buildTx(txp);
    return t.uncheckedSerialize();
  };

  signTxp(txp, derivedXPrivKey) {
    //Derive proper key to sign, for each input
    var privs = [];
    var derived = {};

    var xpriv = new Bitcore.HDPrivateKey(derivedXPrivKey);

    _.each(txp.inputs, function (i) {
      $.checkState(i.path, "Input derivation path not available (signing transaction)")
      if (!derived[i.path]) {
        derived[i.path] = xpriv.deriveChild(i.path).privateKey;
        privs.push(derived[i.path]);
      }
    });

    var t = Utils.buildTx(txp);

    var signatures = _.map(privs, function (priv, i) {
      return t.getSignatures(priv);
    });

    signatures = _.map(_.sortBy(_.flatten(signatures), 'inputIndex'), function (s) {
      return s.signature.toDER().toString('hex');
    });

    return signatures;
  };

  _signTxp(txp, password?) {
    var derived = this.credentials.getDerivedXPrivKey(password);
    return this.signTxp(txp, derived);
  };

  _getCurrentSignatures(txp) {
    var acceptedActions = _.filter(txp.actions, {
      type: 'accept'
    });

    return _.map(acceptedActions, function (x) {
      return {
        signatures: x.signatures,
        xpub: x.xpub,
      };
    });
  };

  _addSignaturesToBitcoreTx(txp, t, signatures, xpub) {
    if (signatures.length != txp.inputs.length)
      throw new Error('Number of signatures does not match number of inputs');

    $.checkState(txp.coin);

    var bitcore = Bitcore_[txp.coin];


    var i = 0,
      x = new bitcore.HDPublicKey(xpub);

    _.each(signatures, function (signatureHex) {
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
      } catch (e) { };
    });

    if (i != txp.inputs.length)
      throw new Error('Wrong signatures');
  };


  _applyAllSignatures(txp, t) {

    $.checkState(txp.status == 'accepted');

    var sigs = this._getCurrentSignatures(txp);
    _.each(sigs, function (x) {
      this._addSignaturesToBitcoreTx(txp, t, x.signatures, x.xpub);
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
  _doJoinWallet(walletId, walletPrivKey, xPubKey, requestPubKey, copayerName, opts, cb) {
    $.shouldBeFunction(cb);

    opts = opts || {};

    // Adds encrypted walletPrivateKey to CustomData
    opts.customData = opts.customData || {};
    opts.customData.walletPrivKey = walletPrivKey.toString();
    var encCustomData = Utils.encryptMessage(JSON.stringify(opts.customData), this.credentials.personalEncryptingKey);
    var encCopayerName = Utils.encryptMessage(copayerName, this.credentials.sharedEncryptingKey);

    var args: any = {
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
    this.request.post(url, args, function (err, body) {
      if (err) return cb(err);
      this._processWallet(body.wallet);
      return cb(null, body.wallet);
    });
  };

  /**
   * Return if wallet is complete
   */
  isComplete() {
    return this.credentials && this.credentials.isComplete();
  };

  /**
   * Is private key currently encrypted?
   *
   * @return {Boolean}
   */
  isPrivKeyEncrypted() {
    return this.credentials && this.credentials.isPrivKeyEncrypted();
  };

  /**
   * Is private key external?
   *
   * @return {Boolean}
   */
  isPrivKeyExternal() {
    return this.credentials && this.credentials.hasExternalSource();
  };

  /**
   * Get external wallet source name
   *
   * @return {String}
   */
  getPrivKeyExternalSourceName() {
    return this.credentials ? this.credentials.getExternalSourceName() : null;
  };

  /**
   * Returns unencrypted extended private key and mnemonics
   *
   * @param password
   */
  getKeys(password) {
    return this.credentials.getKeys(password);
  };


  /**
   * Checks is password is valid
   * Returns null (keys not encrypted), true or false.
   *
   * @param password
   */
  checkPassword(password) {
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
  canSign() {
    return this.credentials && this.credentials.canSign();
  };


  _extractPublicKeyRing(copayers) {
    return _.map(copayers, function (copayer) {
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
  encryptPrivateKey(password, opts) {
    this.credentials.encryptPrivateKey(password, opts || this.privateKeyEncryptionOpts);
  };

  /**
   * disables encryption for private key.
   *
   * @param {String} password Password used to encrypt
   */
  decryptPrivateKey(password) {
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
  getFeeLevels(coin, network, cb) {

    $.checkArgument(coin || _.includes(['btc', 'bch'], coin));
    $.checkArgument(network || _.includes(['livenet', 'testnet'], network));

    this.request.get('/v2/feelevels/?coin=' + (coin || 'btc') + '&network=' + (network || 'livenet'), function (err, result) {
      if (err) return cb(err);
      return cb(err, result);
    });
  };

  /**
   * Get service version
   *
   * @param {Callback} cb
   */
  getVersion(cb) {
    this.request.get('/v1/version/', cb);
  };

  _checkKeyDerivation() {
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
  createWallet(walletName, copayerName, m, n, opts, cb) {

    if (!this._checkKeyDerivation()) return cb(new Error('Cannot create new wallet'));

    if (opts) $.shouldBeObject(opts);
    opts = opts || {};

    var coin = opts.coin || 'btc';
    if (!_.includes(['btc', 'bch'], coin)) return cb(new Error('Invalid coin'));

    var network = opts.network || 'livenet';
    if (!_.includes(['testnet', 'livenet'], network)) return cb(new Error('Invalid network'));

    if (!this.credentials) {
      log.info('Generating new keys');
      this.seedFromRandom({
        coin: coin,
        network: network
      });
    } else {
      log.info('Using existing keys');
    }

    if (coin != this.credentials.coin) {
      return cb(new Error('Existing keys were created for a different coin'));
    }

    if (network != this.credentials.network) {
      return cb(new Error('Existing keys were created for a different network'));
    }

    var walletPrivKey = opts.walletPrivKey || new Bitcore.PrivateKey();

    var c = this.credentials;
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
    };
    this.request.post('/v2/wallets/', args, function (err, res) {
      if (err) return cb(err);

      var walletId = res.walletId;
      c.addWalletInfo(walletId, walletName, m, n, copayerName);
      var secret = this._buildSecret(c.walletId, c.walletPrivKey, c.coin, c.network);

      this._doJoinWallet(walletId, walletPrivKey, c.xPubKey, c.requestPubKey, copayerName, {
        coin: coin
      },
        function (err, wallet) {
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
  joinWallet(secret, copayerName, opts, cb) {

    if (!cb) {
      cb = opts;
      opts = {};
      log.warn('DEPRECATED WARN: joinWallet should receive 4 parameters.');
    }

    if (!this._checkKeyDerivation()) return cb(new Error('Cannot join wallet'));

    opts = opts || {};

    var coin = opts.coin || 'btc';
    if (!_.includes(['btc', 'bch'], coin)) return cb(new Error('Invalid coin'));

    try {
      var secretData = this.parseSecret(secret);
    } catch (ex) {
      return cb(ex);
    }

    if (!this.credentials) {
      this.seedFromRandom({
        coin: coin,
        network: secretData.network
      });
    }

    this.credentials.addWalletPrivateKey(secretData.walletPrivKey.toString());
    this._doJoinWallet(secretData.walletId, secretData.walletPrivKey, this.credentials.xPubKey, this.credentials.requestPubKey, copayerName, {
      coin: coin,
      dryRun: !!opts.dryRun,
    }, function (err, wallet) {
      if (err) return cb(err);
      if (!opts.dryRun) {
        this.credentials.addWalletInfo(wallet.id, wallet.name, wallet.m, wallet.n, copayerName);
      }
      return cb(null, wallet);
    });
  };

  /**
   * Recreates a wallet, given credentials (with wallet id)
   *
   * @returns {Callback} cb - Returns the wallet
   */
  recreateWallet(cb) {
    $.checkState(this.credentials);
    $.checkState(this.credentials.isComplete());
    $.checkState(this.credentials.walletPrivKey);
    //$.checkState(this.credentials.hasWalletInfo());

    // First: Try to get the wallet with current credentials
    this.getStatus({
      includeExtendedInfo: true
    }, function (err) {
      // No error? -> Wallet is ready.
      if (!err) {
        log.info('Wallet is already created');
        return cb();
      };

      var c = this.credentials;
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

      this.request.post('/v2/wallets/', args, function (err, body) {
        if (err) {
          if (!(err instanceof Errors.WALLET_ALREADY_EXISTS))
            return cb(err);

          return this.addAccess({}, function (err) {
            if (err) return cb(err);
            this.openWallet(function (err) {
              return cb(err);
            });
          });
        }

        if (!walletId) {
          walletId = body.walletId;
        }

        var i = 1;
        async.each(this.credentials.publicKeyRing, function (item, next) {
          var name = item.copayerName || ('copayer ' + i++);
          this._doJoinWallet(walletId, walletPrivKey, item.xPubKey, item.requestPubKey, name, {
            coin: c.coin,
            supportBIP44AndP2PKH: supportBIP44AndP2PKH,
          }, function (err) {
            //Ignore error is copayer already in wallet
            if (err && err instanceof Errors.COPAYER_IN_WALLET) return next();
            return next(err);
          });
        }, cb);
      });
    });
  };

  _processWallet(wallet) {

    var encryptingKey = this.credentials.sharedEncryptingKey;

    var name = Utils.decryptMessageNoThrow(wallet.name, encryptingKey);
    if (name != wallet.name) {
      wallet.encryptedName = wallet.name;
    }
    wallet.name = name;
    _.each(wallet.copayers, function (copayer) {
      var name = Utils.decryptMessageNoThrow(copayer.name, encryptingKey);
      if (name != copayer.name) {
        copayer.encryptedName = copayer.name;
      }
      copayer.name = name;
      _.each(copayer.requestPubKeys, function (access) {
        if (!access.name) return;

        var name = Utils.decryptMessageNoThrow(access.name, encryptingKey);
        if (name != access.name) {
          access.encryptedName = access.name;
        }
        access.name = name;
      });
    });
  };

  _processStatus(status) {

    function processCustomData(data) {
      var copayers = data.wallet.copayers;
      if (!copayers) return;

      var me = _.find(copayers, {
        'id': this.credentials.copayerId
      });
      if (!me || !me.customData) return;

      var customData;
      try {
        customData = JSON.parse(Utils.decryptMessage(me.customData, this.credentials.personalEncryptingKey));
      } catch (e) {
        log.warn('Could not decrypt customData:', me.customData);
      }
      if (!customData) return;

      // Add it to result
      data.customData = customData;

      // Update walletPrivateKey
      if (!this.credentials.walletPrivKey && customData.walletPrivKey)
        this.credentials.addWalletPrivateKey(customData.walletPrivKey);
    };

    processCustomData(status);
    this._processWallet(status.wallet);
    this._processTxps(status.pendingTxps);
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
  getNotifications(opts, cb) {
    $.checkState(this.credentials);

    opts = opts || {};

    var url = '/v1/notifications/';
    if (opts.lastNotificationId) {
      url += '?notificationId=' + opts.lastNotificationId;
    } else if (opts.timeSpan) {
      url += '?timeSpan=' + opts.timeSpan;
    }

    this.request.getWithLogin(url, function (err, result) {
      if (err) return cb(err);

      var notifications = _.filter(result, function (notification) {
        return opts.includeOwn || (notification.creatorId != this.credentials.copayerId);
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
  getStatus(opts, cb) {
    $.checkState(this.credentials);

    if (!cb) {
      cb = opts;
      opts = {};
      log.warn('DEPRECATED WARN: getStatus should receive 2 parameters.')
    }

    opts = opts || {};

    var qs = [];
    qs.push('includeExtendedInfo=' + (opts.includeExtendedInfo ? '1' : '0'));
    qs.push('twoStep=' + (opts.twoStep ? '1' : '0'));
    qs.push('serverMessageArray=1');

    this.request.get('/v3/wallets/?' + qs.join('&'), function (err, result) {
      if (err) return cb(err);
      if (result.wallet.status == 'pending') {
        var c = this.credentials;
        result.wallet.secret = this._buildSecret(c.walletId, c.walletPrivKey, c.coin, c.network);
      }

      this._processStatus(result);

      return cb(err, result);
    });
  };

  /**
   * Get copayer preferences
   *
   * @param {Callback} cb
   * @return {Callback} cb - Return error or object
   */
  getPreferences(cb) {
    $.checkState(this.credentials);
    $.checkArgument(cb);

    this.request.get('/v1/preferences/', function (err, preferences) {
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
  savePreferences(preferences, cb) {
    $.checkState(this.credentials);
    $.checkArgument(cb);

    this.request.put('/v1/preferences/', preferences, cb);
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
  fetchPayPro(opts, cb) {
    $.checkArgument(opts)
      .checkArgument(opts.payProUrl);

    PayPro.get({
      url: opts.payProUrl,
      coin: this.credentials.coin || 'btc',
      network: this.credentials.network || 'livenet',

      // for testing
      request: this.request,
    }, function (err, paypro) {
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
  getUtxos(opts, cb) {
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

  _getCreateTxProposalArgs(opts) {

    var args = _.cloneDeep(opts);
    args.message = this._encryptMessage(opts.message, this.credentials.sharedEncryptingKey) || null;
    args.payProUrl = opts.payProUrl || null;
    _.each(args.outputs, function (o) {
      o.message = this._encryptMessage(o.message, this.credentials.sharedEncryptingKey) || null;
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
  createTxProposal(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());
    $.checkState(this.credentials.sharedEncryptingKey);
    $.checkArgument(opts);


    var args = this._getCreateTxProposalArgs(opts);

    this.request.post('/v2/txproposals/', args, function (err, txp) {
      if (err) return cb(err);

      this._processTxps(txp);
      if (!Verifier.checkProposalCreation(args, txp, this.credentials.sharedEncryptingKey)) {
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
  publishTxProposal(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());
    $.checkArgument(opts)
      .checkArgument(opts.txp);

    $.checkState(parseInt(opts.txp.version) >= 3);


    var t = Utils.buildTx(opts.txp);
    var hash = t.uncheckedSerialize();
    var args = {
      proposalSignature: Utils.signMessage(hash, this.credentials.requestPrivKey)
    };

    var url = '/v1/txproposals/' + opts.txp.id + '/publish/';
    this.request.post(url, args, function (err, txp) {
      if (err) return cb(err);
      this._processTxps(txp);
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
  createAddress(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());


    if (!cb) {
      cb = opts;
      opts = {};
      log.warn('DEPRECATED WARN: createAddress should receive 2 parameters.')
    }

    if (!this._checkKeyDerivation()) return cb(new Error('Cannot create new address for this wallet'));

    opts = opts || {};

    this.request.post('/v3/addresses/', opts, function (err, address) {
      if (err) return cb(err);

      if (!Verifier.checkAddress(this.credentials, address)) {
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
  getMainAddresses(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());


    opts = opts || {};

    var args = [];
    if (opts.limit) args.push('limit=' + opts.limit);
    if (opts.reverse) args.push('reverse=1');
    var qs = '';
    if (args.length > 0) {
      qs = '?' + args.join('&');
    }
    var url = '/v1/addresses/' + qs;

    this.request.get(url, function (err, addresses) {
      if (err) return cb(err);

      if (!opts.doNotVerify) {
        var fake = _.some(addresses, function (address) {
          return !Verifier.checkAddress(this.credentials, address);
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
  getBalance(opts, cb) {
    if (!cb) {
      cb = opts;
      opts = {};
      log.warn('DEPRECATED WARN: getBalance should receive 2 parameters.')
    }

    opts = opts || {};

    $.checkState(this.credentials && this.credentials.isComplete());

    var args = [];
    if (opts.coin) {
      if (!_.includes(['btc', 'bch'], opts.coin)) return cb(new Error('Invalid coin'));
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
  getTxProposals(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());


    this.request.get('/v1/txproposals/', function (err, txps) {
      if (err) return cb(err);

      this._processTxps(txps);
      async.every(txps,
        function (txp, acb) {
          if (opts.doNotVerify) return acb(true);
          this.getPayPro(txp, function (err, paypro) {
            var isLegit = Verifier.checkTxProposal(this.credentials, txp, {
              paypro: paypro,
            });

            return acb(isLegit);
          });
        },
        function (isLegit) {
          if (!isLegit)
            return cb(new Errors.SERVER_COMPROMISED);

          var result;
          if (opts.forAirGapped) {
            result = {
              txps: JSON.parse(JSON.stringify(txps)),
              encryptedPkr: opts.doNotEncryptPkr ? null : Utils.encryptMessage(JSON.stringify(this.credentials.publicKeyRing), this.credentials.personalEncryptingKey),
              unencryptedPkr: opts.doNotEncryptPkr ? JSON.stringify(this.credentials.publicKeyRing) : null,
              m: this.credentials.m,
              n: this.credentials.n,
            };
          } else {
            result = txps;
          }
          return cb(null, result);
        });
    });
  };


  //private?
  getPayPro(txp, cb) {
    if (!txp.payProUrl || this.doNotVerifyPayPro)
      return cb();

    PayPro.get({
      url: txp.payProUrl,
      coin: txp.coin || 'btc',
      network: txp.network || 'livenet',

      // for testing
      request: this.request,
    }, function (err, paypro) {
      if (err) return cb(new Error('Could not fetch invoice:' + (err.message ? err.message : err)));
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
  signTxProposal(txp, password, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());
    $.checkArgument(txp.creatorId);

    if (_.isFunction(password)) {
      cb = password;
      password = null;
    }


    if (!txp.signatures) {
      if (!this.canSign())
        return cb(new Errors.MISSING_PRIVATE_KEY);

      if (this.isPrivKeyEncrypted() && !password)
        return cb(new Errors.ENCRYPTED_PRIVATE_KEY);
    }

    this.getPayPro(txp, function (err, paypro) {
      if (err) return cb(err);

      var isLegit = Verifier.checkTxProposal(this.credentials, txp, {
        paypro: paypro,
      });

      if (!isLegit)
        return cb(new Errors.SERVER_COMPROMISED);

      var signatures = txp.signatures;

      if (_.isEmpty(signatures)) {
        try {
          signatures = this._signTxp(txp, password);
        } catch (ex) {
          log.error('Error signing tx', ex);
          return cb(ex);
        }
      }

      var url = '/v1/txproposals/' + txp.id + '/signatures/';
      var args = {
        signatures: signatures
      };

      this.request.post(url, args, function (err, txp) {
        if (err) return cb(err);
        this._processTxps(txp);
        return cb(null, txp);
      });
    });
  };

  // /**
  //  * Sign transaction proposal from AirGapped
  //  *
  //  * @param {Object} txp
  //  * @param {String} encryptedPkr
  //  * @param {Number} m
  //  * @param {Number} n
  //  * @param {String} password - (optional) A password to decrypt the encrypted private key (if encryption is set).
  //  * @return {Object} txp - Return transaction
  //  */
  // signTxProposalFromAirGapped(txp, encryptedPkr, m, n, password) {
  //   $.checkState(this.credentials);


  //   if (!this.canSign())
  //     throw new Errors.MISSING_PRIVATE_KEY;

  //   if (this.isPrivKeyEncrypted() && !password)
  //     throw new Errors.ENCRYPTED_PRIVATE_KEY;

  //   var publicKeyRing;
  //   try {
  //     publicKeyRing = JSON.parse(Utils.decryptMessage(encryptedPkr, this.credentials.personalEncryptingKey));
  //   } catch (ex) {
  //     throw new Error('Could not decrypt public key ring');
  //   }

  //   if (!_.isArray(publicKeyRing) || publicKeyRing.length != n) {
  //     throw new Error('Invalid public key ring');
  //   }

  //   this.credentials.m = m;
  //   this.credentials.n = n;
  //   this.credentials.addressType = txp.addressType;
  //   this.credentials.addPublicKeyRing(publicKeyRing);

  //   if (!Verifier.checkTxProposalSignature(this.credentials, txp))
  //     throw new Error('Fake transaction proposal');

  //   return this._signTxp(txp, password);
  // };


  // /**
  //  * Sign transaction proposal from AirGapped
  //  *
  //  * @param {String} key - A mnemonic phrase or an xprv HD private key
  //  * @param {Object} txp
  //  * @param {String} unencryptedPkr
  //  * @param {Number} m
  //  * @param {Number} n
  //  * @param {Object} opts
  //  * @param {String} opts.coin (default 'btc')
  //  * @param {String} opts.passphrase
  //  * @param {Number} opts.account - default 0
  //  * @param {String} opts.derivationStrategy - default 'BIP44'
  //  * @return {Object} txp - Return transaction
  //  */
  // signTxProposalFromAirGapped(key, txp, unencryptedPkr, m, n, opts) {
  //   opts = opts || {}

  //   var coin = opts.coin || 'btc';
  //   if (!_.includes(['btc', 'bch'], coin)) return cb(new Error('Invalid coin'));

  //   var publicKeyRing = JSON.parse(unencryptedPkr);

  //   if (!_.isArray(publicKeyRing) || publicKeyRing.length != n) {
  //     throw new Error('Invalid public key ring');
  //   }

  //   var newClient = new API({
  //     baseUrl: 'https://bws.example.com/bws/api'
  //   });

  //   if (key.slice(0, 4) === 'xprv' || key.slice(0, 4) === 'tprv') {
  //     if (key.slice(0, 4) === 'xprv' && txp.network == 'testnet') throw new Error("testnet HD keys must start with tprv");
  //     if (key.slice(0, 4) === 'tprv' && txp.network == 'livenet') throw new Error("livenet HD keys must start with xprv");
  //     newClient.seedFromExtendedPrivateKey(key, {
  //       'coin': coin,
  //       'account': opts.account,
  //       'derivationStrategy': opts.derivationStrategy
  //     });
  //   } else {
  //     newClient.seedFromMnemonic(key, {
  //       'coin': coin,
  //       'network': txp.network,
  //       'passphrase': opts.passphrase,
  //       'account': opts.account,
  //       'derivationStrategy': opts.derivationStrategy
  //     })
  //   }
  //   newClient.credentials.m = m;
  //   newClient.credentials.n = n;
  //   newClient.credentials.addressType = txp.addressType;
  //   newClient.credentials.addPublicKeyRing(publicKeyRing);

  //   if (!Verifier.checkTxProposalSignature(newClient.credentials, txp))
  //     throw new Error('Fake transaction proposal');

  //   return newClient._signTxp(txp);
  // };


  /**
   * Reject a transaction proposal
   *
   * @param {Object} txp
   * @param {String} reason
   * @param {Callback} cb
   * @return {Callback} cb - Return error or object
   */
  rejectTxProposal(txp, reason, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());
    $.checkArgument(cb);


    var url = '/v1/txproposals/' + txp.id + '/rejections/';
    var args = {
      reason: this._encryptMessage(reason, this.credentials.sharedEncryptingKey) || '',
    };
    this.request.post(url, args, function (err, txp) {
      if (err) return cb(err);
      this._processTxps(txp);
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
  broadcastRawTx(opts, cb) {
    $.checkState(this.credentials);
    $.checkArgument(cb);


    opts = opts || {};

    var url = '/v1/broadcast_raw/';
    this.request.post(url, opts, function (err, txid) {
      if (err) return cb(err);
      return cb(null, txid);
    });
  };

  _doBroadcast(txp, cb) {
    var url = '/v1/txproposals/' + txp.id + '/broadcast/';
    this.request.post(url, {}, function (err, txp) {
      if (err) return cb(err);
      this._processTxps(txp);
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
  broadcastTxProposal(txp, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());


    this.getPayPro(txp, function (err, paypro) {
      if (err) return cb(err);

      if (paypro) {

        var t_unsigned = Utils.buildTx(txp);
        var t = Utils.buildTx(txp);
        this._applyAllSignatures(txp, t);

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
          request: this.request,
        }, function (err, ack, memo) {
          if (err) {
            return cb(err);
          }

          if (memo) {
            log.debug('Merchant memo:', memo);
          }
          this._doBroadcast(txp, function (err2, txp) {
            return cb(err2, txp, memo, err);
          });
        });
      } else {
        this._doBroadcast(txp, cb);
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
  removeTxProposal(txp, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());


    var url = '/v1/txproposals/' + txp.id;
    this.request.delete(url, function (err) {
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
  getTxHistory(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());

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
    this.request.get(url, function (err, txs) {
      if (err) return cb(err);
      this._processTxps(txs);
      return cb(null, txs);
    });
  };

  /**
   * getTx
   *
   * @param {String} TransactionId
   * @return {Callback} cb - Return error or transaction
   */
  getTx(id, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());

    var url = '/v1/txproposals/' + id;
    this.request.get(url, function (err, txp) {
      if (err) return cb(err);

      this._processTxps(txp);
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
  startScan(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());


    var args = {
      includeCopayerBranches: opts.includeCopayerBranches,
    };

    this.request.post('/v1/addresses/scan', args, function (err) {
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
  addAccess(opts, cb) {
    $.checkState(this.credentials && this.credentials.canSign());

    opts = opts || {};

    var reqPrivKey = new Bitcore.PrivateKey(opts.generateNewKey ? null : this.credentials.requestPrivKey);
    var requestPubKey = reqPrivKey.toPublicKey().toString();

    var xPriv = new Bitcore.HDPrivateKey(this.credentials.xPrivKey)
      .deriveChild(this.credentials.getBaseAddressDerivationPath());
    var sig = Utils.signRequestPubKey(requestPubKey, xPriv);
    var copayerId = this.credentials.copayerId;

    var encCopayerName = opts.name ? Utils.encryptMessage(opts.name, this.credentials.sharedEncryptingKey) : null;

    var opts: any = {
      copayerId: copayerId,
      requestPubKey: requestPubKey,
      signature: sig,
      name: encCopayerName,
      restrictions: opts.restrictions,
    };

    this.request.put('/v1/copayers/' + copayerId + '/', opts, function (err, res) {
      if (err) return cb(err);
      return cb(null, res.wallet, reqPrivKey);
    });
  };

  /**
   * Get a note associated with the specified txid
   * @param {Object} opts
   * @param {string} opts.txid - The txid to associate this note with
   */
  getTxNote(opts, cb) {
    $.checkState(this.credentials);


    opts = opts || {};
    this.request.get('/v1/txnotes/' + opts.txid + '/', function (err, note) {
      if (err) return cb(err);
      this._processTxNotes(note);
      return cb(null, note);
    });
  };

  /**
   * Edit a note associated with the specified txid
   * @param {Object} opts
   * @param {string} opts.txid - The txid to associate this note with
   * @param {string} opts.body - The contents of the note
   */
  editTxNote(opts, cb) {
    $.checkState(this.credentials);


    opts = opts || {};
    if (opts.body) {
      opts.body = this._encryptMessage(opts.body, this.credentials.sharedEncryptingKey);
    }
    this.request.put('/v1/txnotes/' + opts.txid + '/', opts, function (err, note) {
      if (err) return cb(err);
      this._processTxNotes(note);
      return cb(null, note);
    });
  };

  /**
   * Get all notes edited after the specified date
   * @param {Object} opts
   * @param {string} opts.minTs - The starting timestamp
   */
  getTxNotes(opts, cb) {
    $.checkState(this.credentials);


    opts = opts || {};
    var args = [];
    if (_.isNumber(opts.minTs)) {
      args.push('minTs=' + opts.minTs);
    }
    var qs = '';
    if (args.length > 0) {
      qs = '?' + args.join('&');
    }

    this.request.get('/v1/txnotes/' + qs, function (err, notes) {
      if (err) return cb(err);
      this._processTxNotes(notes);
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
  getFiatRate(opts, cb) {
    $.checkArgument(cb);


    var opts = opts || {};

    var args = [];
    if (opts.ts) args.push('ts=' + opts.ts);
    if (opts.provider) args.push('provider=' + opts.provider);
    var qs = '';
    if (args.length > 0) {
      qs = '?' + args.join('&');
    }

    this.request.get('/v1/fiatrates/' + opts.code + '/' + qs, function (err, rates) {
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
  pushNotificationsSubscribe(opts, cb) {
    var url = '/v1/pushnotifications/subscriptions/';
    this.request.post(url, opts, function (err, response) {
      if (err) return cb(err);
      return cb(null, response);
    });
  };

  /**
   * Unsubscribe from push notifications.
   * @param {String} token - Device token
   * @return {Callback} cb - Return error if exists
   */
  pushNotificationsUnsubscribe(token, cb) {
    var url = '/v2/pushnotifications/subscriptions/' + token;
    this.request.delete(url, cb);
  };

  /**
   * Listen to a tx for its first confirmation.
   * @param {Object} opts
   * @param {String} opts.txid - The txid to subscribe to.
   * @returns {Object} response - Status of subscription.
   */
  txConfirmationSubscribe(opts, cb) {
    var url = '/v1/txconfirmations/';
    this.request.post(url, opts, function (err, response) {
      if (err) return cb(err);
      return cb(null, response);
    });
  };

  /**
   * Stop listening for a tx confirmation.
   * @param {String} txid - The txid to unsubscribe from.
   * @return {Callback} cb - Return error if exists
   */
  txConfirmationUnsubscribe(txid, cb) {
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
  getSendMaxInfo(opts, cb) {
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

    this.request.get(url, function (err, result) {
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
  getStatusByIdentifier(opts, cb) {
    $.checkState(this.credentials);

    opts = opts || {};

    var qs = [];
    qs.push('includeExtendedInfo=' + (opts.includeExtendedInfo ? '1' : '0'));
    qs.push('walletCheck=' + (opts.walletCheck ? '1' : '0'));

    this.request.get('/v1/wallets/' + opts.identifier + '?' + qs.join('&'), function (err, result) {
      if (err || !result || !result.wallet) return cb(err);
      if (result.wallet.status == 'pending') {
        var c = this.credentials;
        result.wallet.secret = this._buildSecret(c.walletId, c.walletPrivKey, c.coin, c.network);
      }

      this._processStatus(result);

      return cb(err, result);
    });
  };


  /*
   *
   * Compatibility Functions
   *
   */

  _oldCopayDecrypt(username, password, blob) {
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
    } catch (e) { };
    return ret;
  };


  getWalletIdsFromOldCopay(username, password, blob) {
    var p = this._oldCopayDecrypt(username, password, blob);
    if (!p) return null;
    var ids = p.walletIds.concat(_.keys(p.focusedTimestamps));
    return _.uniq(ids);
  };

  PayPro = PayPro;
}