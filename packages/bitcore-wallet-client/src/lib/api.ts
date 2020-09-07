'use strict';

import * as CWC from 'crypto-wallet-core';
import { EventEmitter } from 'events';
import _ from 'lodash';
import sjcl from 'sjcl';
import { Constants, Utils } from './common';
import { Credentials } from './credentials';
import { Key } from './key';
import { PayPro } from './paypro';
import { PayProV2 } from './payproV2';
import { Request } from './request';
import { Verifier } from './verifier';

var $ = require('preconditions').singleton();
var util = require('util');
var async = require('async');
var events = require('events');
var Bitcore = CWC.BitcoreLib;
var Bitcore_ = {
  btc: CWC.BitcoreLib,
  bch: CWC.BitcoreLibCash,
  eth: CWC.BitcoreLib,
  xrp: CWC.BitcoreLib
};
var Mnemonic = require('bitcore-mnemonic');
var url = require('url');
var querystring = require('querystring');

var log = require('./log');
const Errors = require('./errors');

var BASE_URL = 'http://localhost:3232/bws/api';

// /**
// * @desc ClientAPI constructor.
// *
// * @param {Object} opts
// * @constructor
// */
export class API extends EventEmitter {
  doNotVerifyPayPro: any;
  timeout: any;
  logLevel: any;
  supportStaffWalletId: any;
  request: any;
  credentials: any;
  notificationIncludeOwn: boolean;
  lastNotificationId: any;
  notificationsIntervalId: any;
  keyDerivationOk: boolean;
  noSign: any;
  password: any;
  bp_partner: string;
  bp_partner_version: string;

  static PayProV2 = PayProV2;
  static PayPro = PayPro;
  static Key = Key;
  static Verifier = Verifier;
  static Core = CWC;
  static Utils = Utils;
  static sjcl = sjcl;
  static errors = Errors;

  // Expose bitcore
  static Bitcore = CWC.BitcoreLib;
  static BitcoreCash = CWC.BitcoreLibCash;

  constructor(opts?) {
    super();
    opts = opts || {};

    this.doNotVerifyPayPro = opts.doNotVerifyPayPro;
    this.timeout = opts.timeout || 50000;
    this.logLevel = opts.logLevel || 'silent';
    this.supportStaffWalletId = opts.supportStaffWalletId;

    this.bp_partner = opts.bp_partner;
    this.bp_partner_version = opts.bp_partner_version;

    this.request = new Request(opts.baseUrl || BASE_URL, {
      r: opts.request,
      supportStaffWalletId: opts.supportStaffWalletId
    });

    log.setLevel(this.logLevel);
  }

  static privateKeyEncryptionOpts = {
    iter: 10000
  };

  initNotifications(cb) {
    log.warn('DEPRECATED: use initialize() instead.');
    this.initialize({}, cb);
  }

  initialize(opts, cb) {
    $.checkState(this.credentials);

    this.notificationIncludeOwn = !!opts.notificationIncludeOwn;
    this._initNotifications(opts);
    return cb();
  }

  dispose(cb) {
    this._disposeNotifications();
    this.request.logout(cb);
  }

  _fetchLatestNotifications(interval, cb) {
    cb = cb || function() {};

    var opts: any = {
      lastNotificationId: this.lastNotificationId,
      includeOwn: this.notificationIncludeOwn
    };

    if (!this.lastNotificationId) {
      opts.timeSpan = interval + 1;
    }

    this.getNotifications(opts, (err, notifications) => {
      if (err) {
        log.warn('Error receiving notifications.');
        log.debug(err);
        return cb(err);
      }
      if (notifications.length > 0) {
        this.lastNotificationId = (_.last(notifications) as any).id;
      }

      _.each(notifications, notification => {
        this.emit('notification', notification);
      });
      return cb();
    });
  }

  _initNotifications(opts) {
    opts = opts || {};

    var interval = opts.notificationIntervalSeconds || 5;
    this.notificationsIntervalId = setInterval(() => {
      this._fetchLatestNotifications(interval, err => {
        if (err) {
          if (err instanceof Errors.NOT_FOUND || err instanceof Errors.NOT_AUTHORIZED) {
            this._disposeNotifications();
          }
        }
      });
    }, interval * 1000);
  }

  _disposeNotifications() {
    if (this.notificationsIntervalId) {
      clearInterval(this.notificationsIntervalId);
      this.notificationsIntervalId = null;
    }
  }

  // /**
  // * Reset notification polling with new interval
  // * @param {Numeric} notificationIntervalSeconds - use 0 to pause notifications
  // */
  setNotificationsInterval(notificationIntervalSeconds) {
    this._disposeNotifications();
    if (notificationIntervalSeconds > 0) {
      this._initNotifications({
        notificationIntervalSeconds
      });
    }
  }

  getRootPath() {
    return this.credentials.getRootPath();
  }

  // /**
  // * Encrypt a message
  // * @private
  // * @static
  // * @memberof Client.API
  // * @param {String} message
  // * @param {String} encryptingKey
  // */
  static _encryptMessage(message, encryptingKey) {
    if (!message) return null;
    return Utils.encryptMessage(message, encryptingKey);
  }

  _processTxNotes(notes) {
    if (!notes) return;

    var encryptingKey = this.credentials.sharedEncryptingKey;
    _.each([].concat(notes), note => {
      note.encryptedBody = note.body;
      note.body = Utils.decryptMessageNoThrow(note.body, encryptingKey);
      note.encryptedEditedByName = note.editedByName;
      note.editedByName = Utils.decryptMessageNoThrow(note.editedByName, encryptingKey);
    });
  }

  // /**
  // * Decrypt text fields in transaction proposals
  // * @private
  // * @static
  // * @memberof Client.API
  // * @param {Array} txps
  // * @param {String} encryptingKey
  // */
  _processTxps(txps) {
    if (!txps) return;

    var encryptingKey = this.credentials.sharedEncryptingKey;
    _.each([].concat(txps), txp => {
      txp.encryptedMessage = txp.message;
      txp.message = Utils.decryptMessageNoThrow(txp.message, encryptingKey) || null;
      txp.creatorName = Utils.decryptMessageNoThrow(txp.creatorName, encryptingKey);

      _.each(txp.actions, action => {
        // CopayerName encryption is optional (not available in older wallets)
        action.copayerName = Utils.decryptMessageNoThrow(action.copayerName, encryptingKey);

        action.comment = Utils.decryptMessageNoThrow(action.comment, encryptingKey);
        // TODO get copayerName from Credentials -> copayerId to copayerName
        // action.copayerName = null;
      });
      _.each(txp.outputs, output => {
        output.encryptedMessage = output.message;
        output.message = Utils.decryptMessageNoThrow(output.message, encryptingKey) || null;
      });
      txp.hasUnconfirmedInputs = _.some(txp.inputs, input => {
        return input.confirmations == 0;
      });
      this._processTxNotes(txp.note);
    });
  }

  validateKeyDerivation(opts, cb) {
    var _deviceValidated;

    opts = opts || {};

    var c = this.credentials;

    var testMessageSigning = (xpriv, xpub) => {
      var nonHardenedPath = 'm/0/0';
      var message =
        'Lorem ipsum dolor sit amet, ne amet urbanitas percipitur vim, libris disputando his ne, et facer suavitate qui. Ei quidam laoreet sea. Cu pro dico aliquip gubergren, in mundi postea usu. Ad labitur posidonium interesset duo, est et doctus molestie adipiscing.';
      var priv = xpriv.deriveChild(nonHardenedPath).privateKey;
      var signature = Utils.signMessage(message, priv);
      var pub = xpub.deriveChild(nonHardenedPath).publicKey;
      return Utils.verifyMessage(message, signature, pub);
    };

    var testHardcodedKeys = () => {
      var words = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      var xpriv = Mnemonic(words).toHDPrivateKey();

      if (
        xpriv.toString() !=
        'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu'
      )
        return false;

      xpriv = xpriv.deriveChild("m/44'/0'/0'");
      if (
        xpriv.toString() !=
        'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb'
      )
        return false;

      var xpub = Bitcore.HDPublicKey.fromString(
        'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj'
      );
      return testMessageSigning(xpriv, xpub);
    };

    // TODO => Key refactor to Key class.
    var testLiveKeys = () => {
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
    this.keyDerivationOk = hardcodedOk; // && liveOk;

    return cb(null, this.keyDerivationOk);
  }

  // /**
  // * toObj() wallet
  // *
  // * @param {Object} opts
  // */
  toObj() {
    $.checkState(this.credentials);
    return this.credentials.toObj();
  }

  // /**
  // * toString() wallet
  // *
  // * @param {Object} opts
  // */
  toString(opts) {
    $.checkState(this.credentials);
    $.checkArgument(!this.noSign, 'no Sign not supported');
    $.checkArgument(!this.password, 'password not supported');

    opts = opts || {};

    var output;
    output = JSON.stringify(this.toObj());
    return output;
  }

  fromObj(credentials) {
    $.checkArgument(_.isObject(credentials), 'Argument should be an object');

    try {
      credentials = Credentials.fromObj(credentials);
      this.credentials = credentials;
    } catch (ex) {
      log.warn(`Error importing wallet: ${ex}`);
      if (ex.toString().match(/Obsolete/)) {
        throw new Errors.OBSOLETE_BACKUP();
      } else {
        throw new Errors.INVALID_BACKUP();
      }
    }
    this.request.setCredentials(this.credentials);
  }

  // /**
  // * fromString wallet
  // *
  // * @param {Object} str - The serialized JSON created with #export
  // */
  fromString(credentials) {
    if (_.isObject(credentials)) {
      log.warn('WARN: Please use fromObj instead of fromString when importing strings');
      return this.fromObj(credentials);
    }
    let c;
    try {
      c = JSON.parse(credentials);
    } catch (ex) {
      log.warn(`Error importing wallet: ${ex}`);
      throw new Errors.INVALID_BACKUP();
    }
    return this.fromObj(c);
  }

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
    var addrBuff = Buffer.from(address, 'ascii');
    var actualChecksum = Bitcore.crypto.Hash.sha256sha256(addrBuff)
      .toString('hex')
      .substring(0, 8);
    var expectedChecksum = Bitcore.encoding.Base58Check.decode(encryptedPrivateKeyBase58)
      .toString('hex')
      .substring(6, 14);

    if (actualChecksum != expectedChecksum) return cb(new Error('Incorrect passphrase'));

    return cb(null, privateKeyWif);
  }

  getBalanceFromPrivateKey(privateKey, coin, cb) {
    if (_.isFunction(coin)) {
      cb = coin;
      coin = 'btc';
    }
    var B = Bitcore_[coin];

    var privateKey = new B.PrivateKey(privateKey);
    var address = privateKey.publicKey.toAddress().toString(true);

    this.getUtxos(
      {
        addresses: address
      },
      (err, utxos) => {
        if (err) return cb(err);
        return cb(null, _.sumBy(utxos, 'satoshis'));
      }
    );
  }

  buildTxFromPrivateKey(privateKey, destinationAddress, opts, cb) {
    opts = opts || {};

    var coin = opts.coin || 'btc';
    var signingMethod = opts.signingMethod || 'ecdsa';

    if (!_.includes(Constants.COINS, coin)) return cb(new Error('Invalid coin'));

    if (coin == 'eth') return cb(new Error('ETH not supported for this action'));

    var B = Bitcore_[coin];
    var privateKey = B.PrivateKey(privateKey);
    var address = privateKey.publicKey.toAddress().toString(true);

    async.waterfall(
      [
        next => {
          this.getUtxos(
            {
              addresses: address
            },
            (err, utxos) => {
              return next(err, utxos);
            }
          );
        },
        (utxos, next) => {
          if (!_.isArray(utxos) || utxos.length == 0) return next(new Error('No utxos found'));

          var fee = opts.fee || 10000;
          var amount = _.sumBy(utxos, 'satoshis') - fee;
          if (amount <= 0) return next(new Errors.INSUFFICIENT_FUNDS());

          var tx;
          try {
            var toAddress = B.Address.fromString(destinationAddress);

            tx = new B.Transaction()
              .from(utxos)
              .to(toAddress, amount)
              .fee(fee)
              .sign(privateKey, undefined, signingMethod);

            // Make sure the tx can be serialized
            tx.serialize();
          } catch (ex) {
            log.error('Could not build transaction from private key', ex);
            return next(new Errors.COULD_NOT_BUILD_TRANSACTION());
          }
          return next(null, tx);
        }
      ],
      cb
    );
  }

  // /**
  // * Open a wallet and try to complete the public key ring.
  // *
  // * @param {Callback} cb - The callback that handles the response. It returns a flag indicating that the wallet is complete.
  // * @fires API#walletCompleted
  // */
  openWallet(opts, cb) {
    if (_.isFunction(opts)) {
      cb = opts;
    }
    opts = opts || {};

    $.checkState(this.credentials);
    if (this.credentials.isComplete() && this.credentials.hasWalletInfo()) return cb(null, true);

    var qs = [];
    qs.push('includeExtendedInfo=1');
    qs.push('serverMessageArray=1');

    this.request.get('/v3/wallets/?' + qs.join('&'), (err, ret) => {
      if (err) return cb(err);
      var wallet = ret.wallet;

      this._processStatus(ret);

      if (!this.credentials.hasWalletInfo()) {
        var me = _.find(wallet.copayers, {
          id: this.credentials.copayerId
        });

        if (!me) return cb(new Error('Copayer not in wallet'));

        try {
          this.credentials.addWalletInfo(wallet.id, wallet.name, wallet.m, wallet.n, me.name, opts);
        } catch (e) {
          if (e.message) {
            log.info('Trying credentials...', e.message);
          }
          if (e.message && e.message.match(/Bad\snr/)) {
            return cb(new Errors.WALLET_DOES_NOT_EXIST());
          }
          throw e;
        }
      }
      if (wallet.status != 'complete') return cb(null, ret);

      if (this.credentials.walletPrivKey) {
        if (!Verifier.checkCopayers(this.credentials, wallet.copayers)) {
          return cb(new Errors.SERVER_COMPROMISED());
        }
      } else {
        // this should only happen in AIR-GAPPED flows
        log.warn('Could not verify copayers key (missing wallet Private Key)');
      }

      this.credentials.addPublicKeyRing(this._extractPublicKeyRing(wallet.copayers));
      this.emit('walletCompleted', wallet);

      return cb(null, ret);
    });
  }

  static _buildSecret(walletId, walletPrivKey, coin, network) {
    if (_.isString(walletPrivKey)) {
      walletPrivKey = Bitcore.PrivateKey.fromString(walletPrivKey);
    }
    var widHex = Buffer.from(walletId.replace(/-/g, ''), 'hex');
    var widBase58 = new Bitcore.encoding.Base58(widHex).toString();
    return _.padEnd(widBase58, 22, '0') + walletPrivKey.toWIF() + (network == 'testnet' ? 'T' : 'L') + coin;
  }

  static parseSecret(secret) {
    $.checkArgument(secret);

    var split = (str, indexes) => {
      var parts = [];
      indexes.push(str.length);
      var i = 0;
      while (i < indexes.length) {
        parts.push(str.substring(i == 0 ? 0 : indexes[i - 1], indexes[i]));
        i++;
      }
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
        walletId,
        walletPrivKey,
        coin,
        network: networkChar == 'T' ? 'testnet' : 'livenet'
      };
    } catch (ex) {
      throw new Error('Invalid secret');
    }
  }

  static getRawTx(txp) {
    var t = Utils.buildTx(txp);
    return t.uncheckedSerialize();
  }

  _getCurrentSignatures(txp) {
    var acceptedActions = _.filter(txp.actions, {
      type: 'accept'
    });

    return _.map(acceptedActions, x => {
      return {
        signatures: x.signatures,
        xpub: x.xpub
      };
    });
  }

  _addSignaturesToBitcoreTxBitcoin(txp, t, signatures, xpub) {
    $.checkState(txp.coin);
    $.checkState(txp.signingMethod);
    const bitcore = Bitcore_[txp.coin];
    if (signatures.length != txp.inputs.length) throw new Error('Number of signatures does not match number of inputs');

    let i = 0;
    const x = new bitcore.HDPublicKey(xpub);

    _.each(signatures, signatureHex => {
      try {
        const signature = bitcore.crypto.Signature.fromString(signatureHex);
        const pub = x.deriveChild(txp.inputPaths[i]).publicKey;
        const s = {
          inputIndex: i,
          signature,
          sigtype:
            // tslint:disable-next-line:no-bitwise
            bitcore.crypto.Signature.SIGHASH_ALL | bitcore.crypto.Signature.SIGHASH_FORKID,
          publicKey: pub
        };
        t.inputs[i].addSignature(t, s, txp.signingMethod);
        i++;
      } catch (e) {}
    });

    if (i != txp.inputs.length) throw new Error('Wrong signatures');
  }

  _addSignaturesToBitcoreTx(txp, t, signatures, xpub) {
    const { coin, network } = txp;
    const chain = Utils.getChain(coin);
    switch (chain) {
      case 'XRP':
      case 'ETH':
        const unsignedTxs = t.uncheckedSerialize();
        const signedTxs = [];
        for (let index = 0; index < signatures.length; index++) {
          const signed = CWC.Transactions.applySignature({
            chain,
            tx: unsignedTxs[index],
            signature: signatures[index]
          });
          signedTxs.push(signed);

          // bitcore users id for txid...
          t.id = CWC.Transactions.getHash({ tx: signed, chain, network });
        }
        t.uncheckedSerialize = () => signedTxs;
        t.serialize = () => signedTxs;
        break;
      default:
        return this._addSignaturesToBitcoreTxBitcoin(txp, t, signatures, xpub);
    }
  }

  _applyAllSignatures(txp, t) {
    $.checkState(txp.status == 'accepted');

    var sigs = this._getCurrentSignatures(txp);
    _.each(sigs, x => {
      this._addSignaturesToBitcoreTx(txp, t, x.signatures, x.xpub);
    });
  }

  // /**
  // * Join
  // * @private
  // *
  // * @param {String} walletId
  // * @param {String} walletPrivKey
  // * @param {String} xPubKey
  // * @param {String} requestPubKey
  // * @param {String} copayerName
  // * @param {Object} Optional args
  // * @param {String} opts.customData
  // * @param {String} opts.coin
  // * @param {Callback} cb
  // */
  _doJoinWallet(walletId, walletPrivKey, xPubKey, requestPubKey, copayerName, opts, cb) {
    $.shouldBeFunction(cb);

    opts = opts || {};

    // Adds encrypted walletPrivateKey to CustomData
    opts.customData = opts.customData || {};
    opts.customData.walletPrivKey = walletPrivKey.toString();
    var encCustomData = Utils.encryptMessage(JSON.stringify(opts.customData), this.credentials.personalEncryptingKey);
    var encCopayerName = Utils.encryptMessage(copayerName, this.credentials.sharedEncryptingKey);

    var args: any = {
      walletId,
      coin: opts.coin,
      name: encCopayerName,
      xPubKey,
      requestPubKey,
      customData: encCustomData
    };
    if (opts.dryRun) args.dryRun = true;

    if (_.isBoolean(opts.supportBIP44AndP2PKH)) args.supportBIP44AndP2PKH = opts.supportBIP44AndP2PKH;

    var hash = Utils.getCopayerHash(args.name, args.xPubKey, args.requestPubKey);
    args.copayerSignature = Utils.signMessage(hash, walletPrivKey);

    var url = '/v2/wallets/' + walletId + '/copayers';
    this.request.post(url, args, (err, body) => {
      if (err) return cb(err);
      this._processWallet(body.wallet);
      return cb(null, body.wallet);
    });
  }

  // /**
  // * Return if wallet is complete
  // */
  isComplete() {
    return this.credentials && this.credentials.isComplete();
  }

  _extractPublicKeyRing(copayers) {
    return _.map(copayers, copayer => {
      var pkr: any = _.pick(copayer, ['xPubKey', 'requestPubKey']);
      pkr.copayerName = copayer.name;
      return pkr;
    });
  }

  // /**
  // * Get current fee levels for the specified network
  // *
  // * @param {string} coin - 'btc' (default) or 'bch'
  // * @param {string} network - 'livenet' (default) or 'testnet'
  // * @param {Callback} cb
  // * @returns {Callback} cb - Returns error or an object with status information
  // */
  getFeeLevels(coin, network, cb) {
    $.checkArgument(coin || _.includes(Constants.COINS, coin));
    $.checkArgument(network || _.includes(['livenet', 'testnet'], network));

    const chain = Utils.getChain(coin).toLowerCase();

    this.request.get(
      '/v2/feelevels/?coin=' + (chain || 'btc') + '&network=' + (network || 'livenet'),
      (err, result) => {
        if (err) return cb(err);
        return cb(err, result);
      }
    );
  }

  // /**
  // * Get service version
  // *
  // * @param {Callback} cb
  // */
  getVersion(cb) {
    this.request.get('/v1/version/', cb);
  }

  _checkKeyDerivation() {
    var isInvalid = this.keyDerivationOk === false;
    if (isInvalid) {
      log.error('Key derivation for this device is not working as expected');
    }
    return !isInvalid;
  }

  // /**
  // *
  // * Create a wallet.
  // * @param {String} walletName
  // * @param {String} copayerName
  // * @param {Number} m
  // * @param {Number} n
  // * @param {object} opts (optional: advanced options)
  // * @param {string} opts.coin[='btc'] - The coin for this wallet (btc, bch).
  // * @param {string} opts.network[='livenet']
  // * @param {string} opts.singleAddress[=false] - The wallet will only ever have one address.
  // * @param {String} opts.walletPrivKey - set a walletPrivKey (instead of random)
  // * @param {String} opts.id - set a id for wallet (instead of server given)
  // * @param {Boolean} opts.useNativeSegwit - set addressType to P2WPKH or P2WSH
  // * @param cb
  // * @return {undefined}
  // */
  createWallet(walletName, copayerName, m, n, opts, cb) {
    if (!this._checkKeyDerivation()) return cb(new Error('Cannot create new wallet'));

    if (opts) $.shouldBeObject(opts);
    opts = opts || {};

    var coin = opts.coin || 'btc';
    if (!_.includes(Constants.COINS, coin)) return cb(new Error('Invalid coin'));

    var network = opts.network || 'livenet';
    if (!_.includes(['testnet', 'livenet'], network)) return cb(new Error('Invalid network'));

    if (!this.credentials) {
      return cb(new Error('Import credentials first with setCredentials()'));
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
      m,
      n,
      pubKey: new Bitcore.PrivateKey(walletPrivKey).toPublicKey().toString(),
      coin,
      network,
      singleAddress: !!opts.singleAddress,
      id: opts.id,
      usePurpose48: n > 1,
      useNativeSegwit: !!opts.useNativeSegwit
    };
    this.request.post('/v2/wallets/', args, (err, res) => {
      if (err) return cb(err);

      var walletId = res.walletId;
      c.addWalletInfo(walletId, walletName, m, n, copayerName, { useNativeSegwit: opts.useNativeSegwit });
      var secret = API._buildSecret(c.walletId, c.walletPrivKey, c.coin, c.network);

      this._doJoinWallet(
        walletId,
        walletPrivKey,
        c.xPubKey,
        c.requestPubKey,
        copayerName,
        {
          coin
        },
        (err, wallet) => {
          if (err) return cb(err);
          return cb(null, n > 1 ? secret : null);
        }
      );
    });
  }

  // /**
  // * Join an existent wallet
  // *
  // * @param {String} secret
  // * @param {String} copayerName
  // * @param {Object} opts
  // * @param {string} opts.coin[='btc'] - The expected coin for this wallet (btc, bch).
  // * @param {Boolean} opts.dryRun[=false] - Simulate wallet join
  // * @param {Callback} cb
  // * @returns {Callback} cb - Returns the wallet
  // */
  joinWallet(secret, copayerName, opts, cb) {
    if (!cb) {
      cb = opts;
      opts = {};
      log.warn('DEPRECATED WARN: joinWallet should receive 4 parameters.');
    }

    if (!this._checkKeyDerivation()) return cb(new Error('Cannot join wallet'));

    opts = opts || {};

    var coin = opts.coin || 'btc';
    if (!_.includes(Constants.COINS, coin)) return cb(new Error('Invalid coin'));

    try {
      var secretData = API.parseSecret(secret);
    } catch (ex) {
      return cb(ex);
    }

    if (!this.credentials) {
      return cb(new Error('Import credentials first with setCredentials()'));
    }

    this.credentials.addWalletPrivateKey(secretData.walletPrivKey.toString());
    this._doJoinWallet(
      secretData.walletId,
      secretData.walletPrivKey,
      this.credentials.xPubKey,
      this.credentials.requestPubKey,
      copayerName,
      {
        coin,
        dryRun: !!opts.dryRun
      },
      (err, wallet) => {
        if (err) return cb(err);
        if (!opts.dryRun) {
          this.credentials.addWalletInfo(wallet.id, wallet.name, wallet.m, wallet.n, copayerName, {
            useNativeSegwit: wallet.addressType === Constants.SCRIPT_TYPES.P2WSH,
            allowOverwrite: true
          });
        }
        return cb(null, wallet);
      }
    );
  }

  // /**
  // * Recreates a wallet, given credentials (with wallet id)
  // *
  // * @returns {Callback} cb - Returns the wallet
  // */
  recreateWallet(cb) {
    $.checkState(this.credentials);
    $.checkState(this.credentials.isComplete());
    $.checkState(this.credentials.walletPrivKey);
    // $.checkState(this.credentials.hasWalletInfo());

    // First: Try to get the wallet with current credentials
    this.getStatus(
      {
        includeExtendedInfo: true
      },
      err => {
        // No error? -> Wallet is ready.
        if (!err) {
          log.info('Wallet is already created');
          return cb();
        }

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
          supportBIP44AndP2PKH
        };

        this.request.post('/v2/wallets/', args, (err, body) => {
          if (err) {
            // return all errors. Can't call addAccess.
            log.info('openWallet error' + err);
            return cb(new Errors.WALLET_DOES_NOT_EXIST());
          }

          if (!walletId) {
            walletId = body.walletId;
          }

          var i = 1;
          async.each(
            this.credentials.publicKeyRing,
            (item, next) => {
              var name = item.copayerName || 'copayer ' + i++;
              this._doJoinWallet(
                walletId,
                walletPrivKey,
                item.xPubKey,
                item.requestPubKey,
                name,
                {
                  coin: c.coin,
                  supportBIP44AndP2PKH
                },
                err => {
                  // Ignore error is copayer already in wallet
                  if (err && err instanceof Errors.COPAYER_IN_WALLET) return next();
                  return next(err);
                }
              );
            },
            cb
          );
        });
      }
    );
  }

  _processWallet(wallet) {
    var encryptingKey = this.credentials.sharedEncryptingKey;

    var name = Utils.decryptMessageNoThrow(wallet.name, encryptingKey);
    if (name != wallet.name) {
      wallet.encryptedName = wallet.name;
    }
    wallet.name = name;
    _.each(wallet.copayers, copayer => {
      var name = Utils.decryptMessageNoThrow(copayer.name, encryptingKey);
      if (name != copayer.name) {
        copayer.encryptedName = copayer.name;
      }
      copayer.name = name;
      _.each(copayer.requestPubKeys, access => {
        if (!access.name) return;

        var name = Utils.decryptMessageNoThrow(access.name, encryptingKey);
        if (name != access.name) {
          access.encryptedName = access.name;
        }
        access.name = name;
      });
    });
  }

  _processStatus(status) {
    var processCustomData = data => {
      var copayers = data.wallet.copayers;
      if (!copayers) return;

      var me = _.find(copayers, {
        id: this.credentials.copayerId
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

  // /**
  // * Get latest notifications
  // *
  // * @param {object} opts
  // * @param {String} opts.lastNotificationId (optional) - The ID of the last received notification
  // * @param {String} opts.timeSpan (optional) - A time window on which to look for notifications (in seconds)
  // * @param {String} opts.includeOwn[=false] (optional) - Do not ignore notifications generated by the current copayer
  // * @returns {Callback} cb - Returns error or an array of notifications
  // */
  getNotifications(opts, cb) {
    $.checkState(this.credentials);

    opts = opts || {};

    var url = '/v1/notifications/';
    if (opts.lastNotificationId) {
      url += '?notificationId=' + opts.lastNotificationId;
    } else if (opts.timeSpan) {
      url += '?timeSpan=' + opts.timeSpan;
    }

    this.request.getWithLogin(url, (err, result) => {
      if (err) return cb(err);

      var notifications = _.filter(result, notification => {
        return opts.includeOwn || notification.creatorId != this.credentials.copayerId;
      });

      return cb(null, notifications);
    });
  }

  // /**
  // * Get status of the wallet
  // *
  // * @param {Boolean} opts.twoStep[=false] - Optional: use 2-step balance computation for improved performance
  // * @param {Boolean} opts.includeExtendedInfo (optional: query extended status)
  // * @param {String} opts.tokenAddress (optional: ERC20 Token Contract Address)
  // * @param {String} opts.multisigContractAddress (optional: MULTISIG ETH Contract Address)
  // * @returns {Callback} cb - Returns error or an object with status information
  // */
  getStatus(opts, cb) {
    $.checkState(this.credentials);

    if (!cb) {
      cb = opts;
      opts = {};
      log.warn('DEPRECATED WARN: getStatus should receive 2 parameters.');
    }

    opts = opts || {};

    var qs = [];
    qs.push('includeExtendedInfo=' + (opts.includeExtendedInfo ? '1' : '0'));
    qs.push('twoStep=' + (opts.twoStep ? '1' : '0'));
    qs.push('serverMessageArray=1');

    if (opts.tokenAddress) {
      qs.push('tokenAddress=' + opts.tokenAddress);
    }

    if (opts.multisigContractAddress) {
      qs.push('multisigContractAddress=' + opts.multisigContractAddress);
      qs.push('network=' + this.credentials.network);
    }

    this.request.get('/v3/wallets/?' + qs.join('&'), (err, result) => {
      if (err) return cb(err);
      if (result.wallet.status == 'pending') {
        var c = this.credentials;
        result.wallet.secret = API._buildSecret(c.walletId, c.walletPrivKey, c.coin, c.network);
      }

      this._processStatus(result);

      return cb(err, result);
    });
  }

  // /**
  // * Get copayer preferences
  // *
  // * @param {Callback} cb
  // * @return {Callback} cb - Return error or object
  // */
  getPreferences(cb) {
    $.checkState(this.credentials);
    $.checkArgument(cb);

    this.request.get('/v1/preferences/', (err, preferences) => {
      if (err) return cb(err);
      return cb(null, preferences);
    });
  }

  // /**
  // * Save copayer preferences
  // *
  // * @param {Object} preferences
  // * @param {Callback} cb
  // * @return {Callback} cb - Return error or object
  // */
  savePreferences(preferences, cb) {
    $.checkState(this.credentials);
    $.checkArgument(cb);

    this.request.put('/v1/preferences/', preferences, cb);
  }

  // /**
  // * fetchPayPro
  // *
  // * @param opts.payProUrl  URL for paypro request
  // * @returns {Callback} cb - Return error or the parsed payment protocol request
  // * Returns (err,paypro)
  // *  paypro.amount
  // *  paypro.toAddress
  // *  paypro.memo
  // */
  fetchPayPro(opts, cb) {
    $.checkArgument(opts).checkArgument(opts.payProUrl);

    PayPro.get(
      {
        url: opts.payProUrl,
        coin: this.credentials.coin || 'btc',
        network: this.credentials.network || 'livenet',

        // for testing
        request: this.request
      },
      (err, paypro) => {
        if (err) return cb(err);

        return cb(null, paypro);
      }
    );
  }

  // /**
  // * Gets list of utxos
  // *
  // * @param {Function} cb
  // * @param {Object} opts
  // * @param {Array} opts.addresses (optional) - List of addresses from where to fetch UTXOs.
  // * @returns {Callback} cb - Return error or the list of utxos
  // */
  getUtxos(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());
    opts = opts || {};
    var url = '/v1/utxos/';
    if (opts.addresses) {
      url +=
        '?' +
        querystring.stringify({
          addresses: [].concat(opts.addresses).join(',')
        });
    }
    this.request.get(url, cb);
  }

  // /**
  // * Gets list of coins
  // *
  // * @param {Function} cb
  // * @param {String} opts.coin - Current tx coin
  // * @param {String} opts.network - Current tx network
  // * @param {String} opts.txId - Current tx id
  // * @returns {Callback} cb - Return error or the list of coins
  // */
  getCoinsForTx(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());
    opts = opts || {};
    var url = '/v1/txcoins/';
    url +=
      '?' +
      querystring.stringify({
        coin: opts.coin,
        network: opts.network,
        txId: opts.txId
      });
    this.request.get(url, cb);
  }

  _getCreateTxProposalArgs(opts) {
    var args = _.cloneDeep(opts);
    args.message = API._encryptMessage(opts.message, this.credentials.sharedEncryptingKey) || null;
    args.payProUrl = opts.payProUrl || null;
    _.each(args.outputs, o => {
      o.message = API._encryptMessage(o.message, this.credentials.sharedEncryptingKey) || null;
    });

    return args;
  }

  // /**
  // * Create a transaction proposal
  // *
  // * @param {Object} opts
  // * @param {string} opts.txProposalId - Optional. If provided it will be used as this TX proposal ID. Should be unique in the scope of the wallet.
  // * @param {Array} opts.outputs - List of outputs.
  // * @param {string} opts.outputs[].toAddress - Destination address.
  // * @param {number} opts.outputs[].amount - Amount to transfer in satoshi.
  // * @param {string} opts.outputs[].message - A message to attach to this output.
  // * @param {string} opts.message - A message to attach to this transaction.
  // * @param {number} opts.feeLevel[='normal'] - Optional. Specify the fee level for this TX ('priority', 'normal', 'economy', 'superEconomy').
  // * @param {number} opts.feePerKb - Optional. Specify the fee per KB for this TX (in satoshi).
  // * @param {string} opts.changeAddress - Optional. Use this address as the change address for the tx. The address should belong to the wallet. In the case of singleAddress wallets, the first main address will be used.
  // * @param {Boolean} opts.sendMax - Optional. Send maximum amount of funds that make sense under the specified fee/feePerKb conditions. (defaults to false).
  // * @param {string} opts.payProUrl - Optional. Paypro URL for peers to verify TX
  // * @param {Boolean} opts.excludeUnconfirmedUtxos[=false] - Optional. Do not use UTXOs of unconfirmed transactions as inputs
  // * @param {Boolean} opts.validateOutputs[=true] - Optional. Perform validation on outputs.
  // * @param {Boolean} opts.dryRun[=false] - Optional. Simulate the action but do not change server state.
  // * @param {Array} opts.inputs - Optional. Inputs for this TX
  // * @param {number} opts.fee - Optional. Use an fixed fee for this TX (only when opts.inputs is specified)
  // * @param {Boolean} opts.noShuffleOutputs - Optional. If set, TX outputs won't be shuffled. Defaults to false
  // * @param {String} opts.signingMethod - Optional. If set, force signing method (ecdsa or schnorr) otherwise use default for coin
  // * @returns {Callback} cb - Return error or the transaction proposal
  // * @param {String} baseUrl - Optional. ONLY FOR TESTING
  // */
  createTxProposal(opts, cb, baseUrl) {
    $.checkState(this.credentials && this.credentials.isComplete());
    $.checkState(this.credentials.sharedEncryptingKey);
    $.checkArgument(opts);

    // BCH schnorr deployment
    if (!opts.signingMethod && this.credentials.coin == 'bch') {
      opts.signingMethod = 'schnorr';
    }

    var args = this._getCreateTxProposalArgs(opts);
    baseUrl = baseUrl || '/v3/txproposals/';
    // baseUrl = baseUrl || '/v4/txproposals/'; // DISABLED 2020-04-07

    this.request.post(baseUrl, args, (err, txp) => {
      if (err) return cb(err);

      this._processTxps(txp);
      if (!Verifier.checkProposalCreation(args, txp, this.credentials.sharedEncryptingKey)) {
        return cb(new Errors.SERVER_COMPROMISED());
      }

      return cb(null, txp);
    });
  }

  // /**
  // * Publish a transaction proposal
  // *
  // * @param {Object} opts
  // * @param {Object} opts.txp - The transaction proposal object returned by the API#createTxProposal method
  // * @returns {Callback} cb - Return error or null
  // */
  publishTxProposal(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());
    $.checkArgument(opts).checkArgument(opts.txp);

    $.checkState(parseInt(opts.txp.version) >= 3);

    var t = Utils.buildTx(opts.txp);
    var hash = t.uncheckedSerialize();
    var args = {
      proposalSignature: Utils.signMessage(hash, this.credentials.requestPrivKey)
    };

    var url = '/v2/txproposals/' + opts.txp.id + '/publish/';
    this.request.post(url, args, (err, txp) => {
      if (err) return cb(err);
      this._processTxps(txp);
      return cb(null, txp);
    });
  }

  // /**
  // * Create a new address
  // *
  // * @param {Object} opts
  // * @param {Boolean} opts.ignoreMaxGap[=false]
  // * @param {Callback} cb
  // * @returns {Callback} cb - Return error or the address
  // */
  createAddress(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());

    if (!cb) {
      cb = opts;
      opts = {};
      log.warn('DEPRECATED WARN: createAddress should receive 2 parameters.');
    }

    if (!this._checkKeyDerivation()) return cb(new Error('Cannot create new address for this wallet'));

    opts = opts || {};

    this.request.post('/v4/addresses/', opts, (err, address) => {
      if (err) return cb(err);

      if (!Verifier.checkAddress(this.credentials, address)) {
        return cb(new Errors.SERVER_COMPROMISED());
      }

      return cb(null, address);
    });
  }

  // /**
  // * Get your main addresses
  // *
  // * @param {Object} opts
  // * @param {Boolean} opts.doNotVerify
  // * @param {Numeric} opts.limit (optional) - Limit the resultset. Return all addresses by default.
  // * @param {Boolean} [opts.reverse=false] (optional) - Reverse the order of returned addresses.
  // * @param {Callback} cb
  // * @returns {Callback} cb - Return error or the array of addresses
  // */
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

    this.request.get(url, (err, addresses) => {
      if (err) return cb(err);

      if (!opts.doNotVerify) {
        var fake = _.some(addresses, address => {
          return !Verifier.checkAddress(this.credentials, address);
        });
        if (fake) return cb(new Errors.SERVER_COMPROMISED());
      }
      return cb(null, addresses);
    });
  }

  // /**
  // * Update wallet balance
  // *
  // * @param {String} opts.coin - Optional: defaults to current wallet coin
  // * @param {String} opts.tokenAddress - Optional: ERC20 token contract address
  // * @param {String} opts.multisigContractAddress optional: MULTISIG ETH Contract Address
  // * @param {Callback} cb
  // */
  getBalance(opts, cb) {
    if (!cb) {
      cb = opts;
      opts = {};
      log.warn('DEPRECATED WARN: getBalance should receive 2 parameters.');
    }

    opts = opts || {};

    $.checkState(this.credentials && this.credentials.isComplete());

    var args = [];
    if (opts.coin) {
      if (!_.includes(Constants.COINS, opts.coin)) return cb(new Error('Invalid coin'));
      args.push('coin=' + opts.coin);
    }
    if (opts.tokenAddress) {
      args.push('tokenAddress=' + opts.tokenAddress);
    }
    if (opts.multisigContractAddress) {
      args.push('multisigContractAddress=' + opts.multisigContractAddress);
    }
    var qs = '';
    if (args.length > 0) {
      qs = '?' + args.join('&');
    }

    var url = '/v1/balance/' + qs;
    this.request.get(url, cb);
  }

  // /**
  // * Get list of transactions proposals
  // *
  // * @param {Object} opts
  // * @param {Boolean} opts.doNotVerify
  // * @param {Boolean} opts.forAirGapped
  // * @param {Boolean} opts.doNotEncryptPkr
  // * @return {Callback} cb - Return error or array of transactions proposals
  // */
  getTxProposals(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());

    this.request.get('/v2/txproposals/', (err, txps) => {
      if (err) return cb(err);
      this._processTxps(txps);
      async.every(
        txps,
        (txp, acb) => {
          if (opts.doNotVerify) return acb(true);
          this.getPayProV2(txp)
            .then(paypro => {
              var isLegit = Verifier.checkTxProposal(this.credentials, txp, {
                paypro
              });

              return acb(isLegit);
            })
            .catch(err => {
              return acb(err);
            });
        },
        isLegit => {
          if (!isLegit) return cb(new Errors.SERVER_COMPROMISED());

          var result;
          if (opts.forAirGapped) {
            result = {
              txps: JSON.parse(JSON.stringify(txps)),
              encryptedPkr: opts.doNotEncryptPkr
                ? null
                : Utils.encryptMessage(
                    JSON.stringify(this.credentials.publicKeyRing),
                    this.credentials.personalEncryptingKey
                  ),
              unencryptedPkr: opts.doNotEncryptPkr ? JSON.stringify(this.credentials.publicKeyRing) : null,
              m: this.credentials.m,
              n: this.credentials.n
            };
          } else {
            result = txps;
          }
          return cb(null, result);
        }
      );
    });
  }

  // private?
  getPayPro(txp, cb) {
    if (!txp.payProUrl || this.doNotVerifyPayPro) return cb();

    PayPro.get(
      {
        url: txp.payProUrl,
        coin: txp.coin || 'btc',
        network: txp.network || 'livenet',

        // for testing
        request: this.request
      },
      (err, paypro) => {
        if (err) return cb(new Error('Could not fetch invoice:' + (err.message ? err.message : err)));
        return cb(null, paypro);
      }
    );
  }

  getPayProV2(txp) {
    if (!txp.payProUrl || this.doNotVerifyPayPro) return Promise.resolve();

    const chain = Utils.getChain(txp.coin);
    const currency = txp.coin.toUpperCase();
    const payload = {
      address: txp.from
    };

    return PayProV2.selectPaymentOption({
      paymentUrl: txp.payProUrl,
      chain,
      currency,
      payload
    });
  }

  // /**
  // * push transaction proposal signatures
  // *
  // * @param {Object} txp
  // * @param {Array} signatures
  // * @param {base} base url (ONLY FOR TESTING)
  // * @param {Callback} cb
  // * @return {Callback} cb - Return error or object
  // */
  pushSignatures(txp, signatures, cb, base) {
    $.checkState(this.credentials && this.credentials.isComplete());
    $.checkArgument(txp.creatorId);

    if (_.isEmpty(signatures)) {
      return cb('No signatures to push. Sign the transaction with Key first');
    }

    this.getPayProV2(txp)
      .then(paypro => {
        var isLegit = Verifier.checkTxProposal(this.credentials, txp, {
          paypro
        });

        if (!isLegit) return cb(new Errors.SERVER_COMPROMISED());

        let defaultBase = '/v2/txproposals/';
        base = base || defaultBase;
        //        base = base || '/v2/txproposals/'; // DISABLED 2020-04-07

        let url = base + txp.id + '/signatures/';

        var args = {
          signatures
        };
        this.request.post(url, args, (err, txp) => {
          if (err) return cb(err);
          this._processTxps(txp);
          return cb(null, txp);
        });
      })
      .catch(err => {
        return cb(err);
      });
  }

  /**
   * Create advertisement for bitpay app - (limited to marketing staff)
   * @param opts - options
   */
  createAdvertisement(opts, cb) {
    // TODO add check for preconditions of title, imgUrl, linkUrl

    var url = '/v1/advertisements/';
    let args = opts;

    this.request.post(url, args, (err, createdAd) => {
      if (err) {
        return cb(err);
      }
      return cb(null, createdAd);
    });
  }

  /**
   * Get advertisements for bitpay app - (limited to marketing staff)
   * @param opts - options
   * @param opts.testing - if set, fetches testing advertisements
   */
  getAdvertisements(opts, cb) {
    var url = '/v1/advertisements/';
    if (opts.testing === true) {
      url = '/v1/advertisements/' + '?testing=true';
    }

    this.request.get(url, (err, ads) => {
      if (err) {
        return cb(err);
      }
      return cb(null, ads);
    });
  }

  /**
   * Get advertisements for bitpay app, for specified country - (limited to marketing staff)
   * @param opts - options
   * @param opts.country - if set, fetches ads by Country
   */
  getAdvertisementsByCountry(opts, cb) {
    var url = '/v1/advertisements/country/' + opts.country;

    this.request.get(url, (err, ads) => {
      if (err) {
        return cb(err);
      }
      return cb(null, ads);
    });
  }

  /**
   * Get Advertisement
   * @param opts - options
   */
  getAdvertisement(opts, cb) {
    var url = '/v1/advertisements/' + opts.adId; // + adId or adTitle;
    this.request.get(url, (err, body) => {
      if (err) {
        return cb(err);
      }
      return cb(null, body);
    });
  }

  /**
   * Activate Advertisement
   * @param opts - options
   */
  activateAdvertisement(opts, cb) {
    var url = '/v1/advertisements/' + opts.adId + '/activate'; // + adId or adTitle;
    let args = opts;
    this.request.post(url, args, (err, body) => {
      if (err) {
        return cb(err);
      }
      return cb(null, body);
    });
  }

  /**
   * Deactivate Advertisement
   * @param opts - options
   */
  deactivateAdvertisement(opts, cb) {
    var url = '/v1/advertisements/' + opts.adId + '/deactivate'; // + adId or adTitle;
    let args = opts;
    this.request.post(url, args, (err, body) => {
      if (err) {
        return cb(err);
      }
      return cb(null, body);
    });
  }

  /**
   * Delete Advertisement
   * @param opts - options
   */
  deleteAdvertisement(opts, cb) {
    var url = '/v1/advertisements/' + opts.adId; // + adId or adTitle;
    this.request.delete(url, (err, body) => {
      if (err) {
        return cb(err);
      }
      return cb(null, body);
    });
  }

  /*

  // /**
  // * Sign transaction proposal from AirGapped
  // *
  // * @param {Object} txp
  // * @param {String} encryptedPkr
  // * @param {Number} m
  // * @param {Number} n
  // * @param {String} password - (optional) A password to decrypt the encrypted private key (if encryption is set).
  // * @return {Object} txp - Return transaction
  // */
  signTxProposalFromAirGapped(txp, encryptedPkr, m, n, password) {
    throw new Error('signTxProposalFromAirGapped not yet implemented in v9.0.0');
    // $.checkState(this.credentials);

    // if (!this.canSign())
    //   throw new Errors.MISSING_PRIVATE_KEY;

    // if (this.isPrivKeyEncrypted() && !password)
    //   throw new Errors.ENCRYPTED_PRIVATE_KEY;

    // var publicKeyRing;
    // try {
    //   publicKeyRing = JSON.parse(Utils.decryptMessage(encryptedPkr, this.credentials.personalEncryptingKey));
    // } catch (ex) {
    //   throw new Error('Could not decrypt public key ring');
    // }

    // if (!_.isArray(publicKeyRing) || publicKeyRing.length != n) {
    //   throw new Error('Invalid public key ring');
    // }

    // this.credentials.m = m;
    // this.credentials.n = n;
    // this.credentials.addressType = txp.addressType;
    // this.credentials.addPublicKeyRing(publicKeyRing);

    // if (!Verifier.checkTxProposalSignature(this.credentials, txp))
    //   throw new Error('Fake transaction proposal');

    // return this._signTxp(txp, password);
  }

  // /**
  // * Sign transaction proposal from AirGapped
  // *
  // * @param {String} key - A mnemonic phrase or an xprv HD private key
  // * @param {Object} txp
  // * @param {String} unencryptedPkr
  // * @param {Number} m
  // * @param {Number} n
  // * @param {Object} opts
  // * @param {String} opts.coin (default 'btc')
  // * @param {String} opts.passphrase
  // * @param {Number} opts.account - default 0
  // * @param {String} opts.derivationStrategy - default 'BIP44'
  // * @return {Object} txp - Return transaction
  // */
  static signTxProposalFromAirGapped(key, txp, unencryptedPkr, m, n, opts, cb) {
    opts = opts || {};

    var coin = opts.coin || 'btc';
    if (!_.includes(Constants.COINS, coin)) return cb(new Error('Invalid coin'));

    var publicKeyRing = JSON.parse(unencryptedPkr);

    if (!_.isArray(publicKeyRing) || publicKeyRing.length != n) {
      throw new Error('Invalid public key ring');
    }

    var newClient: any = new API({
      baseUrl: 'https://bws.example.com/bws/api'
    });

    // TODO TODO TODO
    if (key.slice(0, 4) === 'xprv' || key.slice(0, 4) === 'tprv') {
      if (key.slice(0, 4) === 'xprv' && txp.network == 'testnet')
        throw new Error('testnet HD keys must start with tprv');
      if (key.slice(0, 4) === 'tprv' && txp.network == 'livenet')
        throw new Error('livenet HD keys must start with xprv');
      newClient.seedFromExtendedPrivateKey(key, {
        coin,
        account: opts.account,
        derivationStrategy: opts.derivationStrategy
      });
    } else {
      newClient.seedFromMnemonic(key, {
        coin,
        network: txp.network,
        passphrase: opts.passphrase,
        account: opts.account,
        derivationStrategy: opts.derivationStrategy
      });
    }
    newClient.credentials.m = m;
    newClient.credentials.n = n;
    newClient.credentials.addressType = txp.addressType;
    newClient.credentials.addPublicKeyRing(publicKeyRing);

    if (!Verifier.checkTxProposalSignature(newClient.credentials, txp)) throw new Error('Fake transaction proposal');

    return newClient._signTxp(txp);
  }

  // /**
  // * Reject a transaction proposal
  // *
  // * @param {Object} txp
  // * @param {String} reason
  // * @param {Callback} cb
  // * @return {Callback} cb - Return error or object
  // */
  rejectTxProposal(txp, reason, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());
    $.checkArgument(cb);

    var url = '/v1/txproposals/' + txp.id + '/rejections/';
    var args = {
      reason: API._encryptMessage(reason, this.credentials.sharedEncryptingKey) || ''
    };
    this.request.post(url, args, (err, txp) => {
      if (err) return cb(err);
      this._processTxps(txp);
      return cb(null, txp);
    });
  }

  // /**
  // * Broadcast raw transaction
  // *
  // * @param {Object} opts
  // * @param {String} opts.network
  // * @param {String} opts.rawTx
  // * @param {Callback} cb
  // * @return {Callback} cb - Return error or txid
  // */
  broadcastRawTx(opts, cb) {
    $.checkState(this.credentials);
    $.checkArgument(cb);

    opts = opts || {};

    var url = '/v1/broadcast_raw/';
    this.request.post(url, opts, (err, txid) => {
      if (err) return cb(err);
      return cb(null, txid);
    });
  }

  _doBroadcast(txp, cb) {
    var url = '/v1/txproposals/' + txp.id + '/broadcast/';
    this.request.post(url, {}, (err, txp) => {
      if (err) return cb(err);
      this._processTxps(txp);
      return cb(null, txp);
    });
  }

  // /**
  // * Broadcast a transaction proposal
  // *
  // * @param {Object} txp
  // * @param {Callback} cb
  // * @return {Callback} cb - Return error or object
  // */
  broadcastTxProposal(txp, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());

    this.getPayProV2(txp)
      .then(paypro => {
        if (paypro) {
          var t_unsigned = Utils.buildTx(txp);
          var t = _.cloneDeep(t_unsigned);

          this._applyAllSignatures(txp, t);

          const chain = Utils.getChain(txp.coin);
          const currency = txp.coin.toUpperCase();
          const rawTxUnsigned = t_unsigned.uncheckedSerialize();
          const serializedTx = t.serialize({
            disableSmallFees: true,
            disableLargeFees: true,
            disableDustOutputs: true
          });
          const unsignedTransactions = [];
          const signedTransactions = [];

          // Convert string to array if string
          const unserializedTxs = typeof rawTxUnsigned === 'string' ? [rawTxUnsigned] : rawTxUnsigned;
          const serializedTxs = typeof serializedTx === 'string' ? [serializedTx] : serializedTx;

          let i = 0;

          let isBtcSegwit = txp.coin == 'btc' && (txp.addressType == 'P2WSH' || txp.addressType == 'P2WPKH');
          for (const unsigned of unserializedTxs) {
            let size = serializedTxs[i++].length / 2;
            if (isBtcSegwit) {
              let unsignedSize = unsigned.length / 2;
              size = Math.floor(size - (unsignedSize * 3) / 4);
            }
            unsignedTransactions.push({
              tx: unsigned,
              weightedSize: size
            });
          }
          for (const signed of serializedTxs) {
            signedTransactions.push({
              tx: signed,
              weightedSize: signed.length / 2
            });
          }
          PayProV2.verifyUnsignedPayment({
            paymentUrl: txp.payProUrl,
            chain,
            currency,
            unsignedTransactions
          })
            .then(() => {
              PayProV2.sendSignedPayment({
                paymentUrl: txp.payProUrl,
                chain,
                currency,
                signedTransactions,
                bpPartner: {
                  bp_partner: this.bp_partner,
                  bp_partner_version: this.bp_partner_version
                }
              })
                .then(payProDetails => {
                  if (payProDetails.memo) {
                    log.debug('Merchant memo:', payProDetails.memo);
                  }
                  return cb(null, txp, payProDetails.memo);
                })
                .catch(err => {
                  return cb(err);
                });
            })
            .catch(err => {
              return cb(err);
            });
        } else {
          this._doBroadcast(txp, cb);
        }
      })
      .catch(err => {
        return cb(err);
      });
  }

  // /**
  // * Remove a transaction proposal
  // *
  // * @param {Object} txp
  // * @param {Callback} cb
  // * @return {Callback} cb - Return error or empty
  // */
  removeTxProposal(txp, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());

    var url = '/v1/txproposals/' + txp.id;
    this.request.delete(url, err => {
      return cb(err);
    });
  }

  // /**
  // * Get transaction history
  // *
  // * @param {Object} opts
  // * @param {Number} opts.skip (defaults to 0)
  // * @param {Number} opts.limit
  // * @param {String} opts.tokenAddress
  // * @param {String} opts.multisigContractAddress (optional: MULTISIG ETH Contract Address)
  // * @param {Boolean} opts.includeExtendedInfo
  // * @param {Callback} cb
  // * @return {Callback} cb - Return error or array of transactions
  // */
  getTxHistory(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());

    var args = [];
    if (opts) {
      if (opts.skip) args.push('skip=' + opts.skip);
      if (opts.limit) args.push('limit=' + opts.limit);
      if (opts.tokenAddress) args.push('tokenAddress=' + opts.tokenAddress);
      if (opts.multisigContractAddress) args.push('multisigContractAddress=' + opts.multisigContractAddress);
      if (opts.includeExtendedInfo) args.push('includeExtendedInfo=1');
    }
    var qs = '';
    if (args.length > 0) {
      qs = '?' + args.join('&');
    }

    var url = '/v1/txhistory/' + qs;
    this.request.get(url, (err, txs) => {
      if (err) return cb(err);
      this._processTxps(txs);
      return cb(null, txs);
    });
  }

  // /**
  // * getTx
  // *
  // * @param {String} TransactionId
  // * @return {Callback} cb - Return error or transaction
  // */
  getTx(id, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());

    var url = '/v1/txproposals/' + id;
    this.request.get(url, (err, txp) => {
      if (err) return cb(err);

      this._processTxps(txp);
      return cb(null, txp);
    });
  }

  // /**
  // * Start an address scanning process.
  // * When finished, the scanning process will send a notification 'ScanFinished' to all copayers.
  // *
  // * @param {Object} opts
  // * @param {Boolean} opts.includeCopayerBranches (defaults to false)
  // * @param {Callback} cb
  // */
  startScan(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete());

    var args = {
      includeCopayerBranches: opts.includeCopayerBranches
    };

    this.request.post('/v1/addresses/scan', args, err => {
      return cb(err);
    });
  }

  // /**
  // * Adds access to the current copayer
  // * @param {Object} opts
  // * @param {bool} opts.reqPrivKey
  // * @param {bool} opts.signature of the private key, from master key.
  // * @param {string} opts.restrictions
  // *    - cannotProposeTXs
  // *    - cannotXXX TODO
  // * @param {string} opts.name  (name for the new access)
  // *
  // * return the accesses Wallet and the requestPrivateKey
  // */
  addAccess(opts, cb) {
    $.checkState(this.credentials);
    $.shouldBeString(opts.requestPrivKey, 'no requestPrivKey at addAccess() ');
    $.shouldBeString(opts.signature, 'no signature at addAccess()');

    opts = opts || {};
    var requestPubKey = new Bitcore.PrivateKey(opts.requestPrivKey).toPublicKey().toString();
    var copayerId = this.credentials.copayerId;
    var encCopayerName = opts.name ? Utils.encryptMessage(opts.name, this.credentials.sharedEncryptingKey) : null;

    var opts2 = {
      copayerId,
      requestPubKey,
      signature: opts.signature,
      name: encCopayerName,
      restrictions: opts.restrictions
    };

    this.request.put('/v1/copayers/' + copayerId + '/', opts2, (err, res) => {
      if (err) return cb(err);
      // Do not set the key. Return it (for compatibility)
      // this.credentials.requestPrivKey = opts.requestPrivKey;
      return cb(null, res.wallet, opts.requestPrivKey);
    });
  }

  // /**
  // * Get a note associated with the specified txid
  // * @param {Object} opts
  // * @param {string} opts.txid - The txid to associate this note with
  // */
  getTxNote(opts, cb) {
    $.checkState(this.credentials);

    opts = opts || {};
    this.request.get('/v1/txnotes/' + opts.txid + '/', (err, note) => {
      if (err) return cb(err);
      this._processTxNotes(note);
      return cb(null, note);
    });
  }

  // /**
  // * Edit a note associated with the specified txid
  // * @param {Object} opts
  // * @param {string} opts.txid - The txid to associate this note with
  // * @param {string} opts.body - The contents of the note
  // */
  editTxNote(opts, cb) {
    $.checkState(this.credentials);

    opts = opts || {};
    if (opts.body) {
      opts.body = API._encryptMessage(opts.body, this.credentials.sharedEncryptingKey);
    }
    this.request.put('/v1/txnotes/' + opts.txid + '/', opts, (err, note) => {
      if (err) return cb(err);
      this._processTxNotes(note);
      return cb(null, note);
    });
  }

  // /**
  // * Get all notes edited after the specified date
  // * @param {Object} opts
  // * @param {string} opts.minTs - The starting timestamp
  // */
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

    this.request.get('/v1/txnotes/' + qs, (err, notes) => {
      if (err) return cb(err);
      this._processTxNotes(notes);
      return cb(null, notes);
    });
  }

  // /**
  // * Returns exchange rate for the specified currency & timestamp.
  // * @param {Object} opts
  // * @param {string} opts.code - Currency ISO code.
  // * @param {Date} [opts.ts] - A timestamp to base the rate on (default Date.now()).
  // * @param {String} [opts.coin] - Coin (detault: 'btc')
  // * @returns {Object} rates - The exchange rate.
  // */
  getFiatRate(opts, cb) {
    $.checkArgument(cb);

    var opts = opts || {};

    var args = [];
    if (opts.ts) args.push('ts=' + opts.ts);
    if (opts.coin) args.push('coin=' + opts.coin);
    var qs = '';
    if (args.length > 0) {
      qs = '?' + args.join('&');
    }

    this.request.get('/v1/fiatrates/' + opts.code + '/' + qs, (err, rates) => {
      if (err) return cb(err);
      return cb(null, rates);
    });
  }

  // /**
  // * Subscribe to push notifications.
  // * @param {Object} opts
  // * @param {String} opts.type - Device type (ios or android).
  // * @param {String} opts.token - Device token.
  // * @returns {Object} response - Status of subscription.
  // */
  pushNotificationsSubscribe(opts, cb) {
    var url = '/v1/pushnotifications/subscriptions/';
    this.request.post(url, opts, (err, response) => {
      if (err) return cb(err);
      return cb(null, response);
    });
  }

  // /**
  // * Unsubscribe from push notifications.
  // * @param {String} token - Device token
  // * @return {Callback} cb - Return error if exists
  // */
  pushNotificationsUnsubscribe(token, cb) {
    var url = '/v2/pushnotifications/subscriptions/' + token;
    this.request.delete(url, cb);
  }

  // /**
  // * Listen to a tx for its first confirmation.
  // * @param {Object} opts
  // * @param {String} opts.txid - The txid to subscribe to.
  // * @returns {Object} response - Status of subscription.
  // */
  txConfirmationSubscribe(opts, cb) {
    var url = '/v1/txconfirmations/';
    this.request.post(url, opts, (err, response) => {
      if (err) return cb(err);
      return cb(null, response);
    });
  }

  // /**
  // * Stop listening for a tx confirmation.
  // * @param {String} txid - The txid to unsubscribe from.
  // * @return {Callback} cb - Return error if exists
  // */
  txConfirmationUnsubscribe(txid, cb) {
    var url = '/v1/txconfirmations/' + txid;
    this.request.delete(url, cb);
  }

  // /**
  // * Returns send max information.
  // * @param {String} opts
  // * @param {number} opts.feeLevel[='normal'] - Optional. Specify the fee level ('priority', 'normal', 'economy', 'superEconomy').
  // * @param {number} opts.feePerKb - Optional. Specify the fee per KB (in satoshi).
  // * @param {Boolean} opts.excludeUnconfirmedUtxos - Indicates it if should use (or not) the unconfirmed utxos
  // * @param {Boolean} opts.returnInputs - Indicates it if should return (or not) the inputs
  // * @return {Callback} cb - Return error (if exists) and object result
  // */
  getSendMaxInfo(opts, cb) {
    var args = [];
    opts = opts || {};

    if (opts.feeLevel) args.push('feeLevel=' + opts.feeLevel);
    if (opts.feePerKb != null) args.push('feePerKb=' + opts.feePerKb);
    if (opts.excludeUnconfirmedUtxos) args.push('excludeUnconfirmedUtxos=1');
    if (opts.returnInputs) args.push('returnInputs=1');

    var qs = '';

    if (args.length > 0) qs = '?' + args.join('&');

    var url = '/v1/sendmaxinfo/' + qs;

    this.request.get(url, (err, result) => {
      if (err) return cb(err);
      return cb(null, result);
    });
  }

  // /**
  // * Returns gas limit estimate.
  // * @param {Object} opts - tx Object
  // * @return {Callback} cb - Return error (if exists) and gas limit
  // */
  getEstimateGas(opts, cb) {
    var url = '/v3/estimateGas/';
    this.request.post(url, opts, (err, gasLimit) => {
      if (err) return cb(err);
      return cb(null, gasLimit);
    });
  }

  // /**
  // * Returns contract instantiation info. (All contract addresses instantiated by that sender with the current transaction hash and block number)
  // * @param {string} opts.sender - sender eth wallet address
  // * @param {string} opts.txId - instantiation transaction id
  // * @return {Callback} cb - Return error (if exists) instantiation info
  // */
  getMultisigContractInstantiationInfo(opts, cb) {
    var url = '/v1/ethmultisig/';
    opts.network = this.credentials.network;
    this.request.post(url, opts, (err, contractInstantiationInfo) => {
      if (err) return cb(err);
      return cb(null, contractInstantiationInfo);
    });
  }

  // /**
  // * Returns contract info. (owners addresses and required number of confirmations)
  // * @param {string} opts.multisigContractAddress - multisig contract address
  // * @return {Callback} cb - Return error (if exists) instantiation info
  // */
  getMultisigContractInfo(opts, cb) {
    var url = '/v1/ethmultisig/info';
    opts.network = this.credentials.network;
    this.request.post(url, opts, (err, contractInfo) => {
      if (err) return cb(err);
      return cb(null, contractInfo);
    });
  }

  // /**
  // * Get wallet status based on a string identifier (one of: walletId, address, txid)
  // *
  // * @param {string} opts.identifier - The identifier
  // * @param {Boolean} opts.includeExtendedInfo (optional: query extended status)
  // * @param {Boolean} opts.walletCheck (optional:  run v8 walletCheck if wallet found)
  // * @returns {Callback} cb - Returns error or an object with status information
  // */
  getStatusByIdentifier(opts, cb) {
    $.checkState(this.credentials);

    opts = opts || {};

    var qs = [];
    qs.push('includeExtendedInfo=' + (opts.includeExtendedInfo ? '1' : '0'));
    qs.push('walletCheck=' + (opts.walletCheck ? '1' : '0'));

    this.request.get('/v1/wallets/' + opts.identifier + '?' + qs.join('&'), (err, result) => {
      if (err || !result || !result.wallet) return cb(err);
      if (result.wallet.status == 'pending') {
        var c = this.credentials;
        result.wallet.secret = API._buildSecret(c.walletId, c.walletPrivKey, c.coin, c.network);
      }

      this._processStatus(result);

      return cb(err, result);
    });
  }

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
      }
    }

    if (!decrypted) return null;

    var ret;
    try {
      ret = JSON.parse(decrypted);
    } catch (e) {}
    return ret;
  }

  getWalletIdsFromOldCopay(username, password, blob): any[] {
    var p = this._oldCopayDecrypt(username, password, blob);
    if (!p) return null;
    var ids = p.walletIds.concat(_.keys(p.focusedTimestamps));
    return _.uniq(ids);
  }

  // /**
  // * upgradeCredentialsV1
  // * upgrade Credentials V1 to Key and Credentials V2 object
  // *
  // * @param {Object} x - Credentials V1 Object

  // * @returns {Callback} cb - Returns { err, {key, credentials} }
  // */

  static upgradeCredentialsV1(x) {
    $.shouldBeObject(x);

    if (!_.isUndefined(x.version) || (!x.xPrivKey && !x.xPrivKeyEncrypted && !x.xPubKey)) {
      throw new Error('Could not recognize old version');
    }

    let k;
    if (x.xPrivKey || x.xPrivKeyEncrypted) {
      k = new Key({ seedData: x, seedType: 'objectV1' });
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
      mnemonicEncrypted: true
    };

    var c = new Credentials();
    _.each(Credentials.FIELDS, i => {
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
    return { key: k, credentials: c };
  }

  // /**
  // * upgradeMultipleCredentialsV1
  // * upgrade multiple Credentials V1 and (opionally) keys to Key and Credentials V2 object
  // * Duplicate keys will be identified and merged.
  // *
  // * @param {Object} credentials - Credentials V1 Object
  // * @param {Object} keys - Key object
  // *

  // * @returns {Callback} cb - Returns { err, {keys, credentials} }
  // */

  static upgradeMultipleCredentialsV1(oldCredentials) {
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
      let credGroups = _.groupBy(newCrededentials, x => {
        $.checkState(x.xPubKey, 'no xPubKey at credentials!');
        let xpub = new Bitcore.HDPublicKey(x.xPubKey);
        let fingerPrint = xpub.fingerPrint.toString('hex');
        return fingerPrint;
      });

      if (_.keys(credGroups).length < newCrededentials.length) {
        log.info('Found some wallets using the SAME key. Merging...');

        let uniqIds = {};

        _.each(_.values(credGroups), credList => {
          let toKeep = credList.shift();
          if (!toKeep.keyId) return;
          uniqIds[toKeep.keyId] = true;

          if (!credList.length) return;
          log.info(`Merging ${credList.length} keys to ${toKeep.keyId}`);
          _.each(credList, x => {
            log.info(`\t${x.keyId} is now ${toKeep.keyId}`);
            x.keyId = toKeep.keyId;
          });
        });

        newKeys = _.filter(newKeys, x => uniqIds[x.id]);
      }
    }

    return {
      keys: newKeys,
      credentials: newCrededentials
    };
  }

  // /**
  // * serverAssistedImport
  // * Imports  EXISTING wallets against BWS and return key & clients[] for each account / coin
  // *
  // * @param {Object} opts
  // * @param {String} opts.words - mnemonic
  // * @param {String} opts.xPrivKey - extended Private Key
  // * @param {String} opts.passphrase - mnemonic's passphrase (optional)
  // * @param {Object} clientOpts  - BWS connection options (see ClientAPI constructor)

  // * @returns {Callback} cb - Returns { err, key, clients[] }
  // */

  static serverAssistedImport(opts, clientOpts, callback) {
    $.checkArgument(opts.words || opts.xPrivKey, 'provide opts.words or opts.xPrivKey');

    let copayerIdAlreadyTested = {};
    var checkCredentials = (key, opts, icb) => {
      let c = key.createCredentials(null, {
        coin: opts.coin,
        network: opts.network,
        account: opts.account,
        n: opts.n
      });

      if (copayerIdAlreadyTested[c.copayerId + ':' + opts.n]) {
        // console.log('[api.js.2226] ALREADY T:', opts.n); // TODO
        return icb();
      } else {
        copayerIdAlreadyTested[c.copayerId + ':' + opts.n] = true;
      }

      let client = clientOpts.clientFactory ? clientOpts.clientFactory() : new API(clientOpts);

      client.fromString(c);
      client.openWallet({}, (err, status) => {
        //        console.log(
        //          `PATH: ${c.rootPath} n: ${c.n}:`,
        //          err && err.message ? err.message : 'FOUND!'
        //        );

        // Exists
        if (!err) {
          if (opts.coin == 'btc' && (status.wallet.addressType == 'P2WPKH' || status.wallet.addressType == 'P2WSH')) {
            client.credentials.addressType =
              status.wallet.n == 1 ? Constants.SCRIPT_TYPES.P2WPKH : Constants.SCRIPT_TYPES.P2WSH;
          }
          let clients = [client];
          // Eth wallet with tokens?
          const tokenAddresses = status.preferences.tokenAddresses;
          if (!_.isEmpty(tokenAddresses)) {
            _.each(tokenAddresses, t => {
              const token = Constants.TOKEN_OPTS[t];
              if (!token) {
                log.warn(`Token ${t} unknown`);
                return;
              }
              log.info(`Importing token: ${token.name}`);
              const tokenCredentials = client.credentials.getTokenCredentials(token);
              let tokenClient = _.cloneDeep(client);
              tokenClient.credentials = tokenCredentials;
              clients.push(tokenClient);
            });
          }
          // Eth wallet with mulsig wallets?
          const multisigEthInfo = status.preferences.multisigEthInfo;
          if (!_.isEmpty(multisigEthInfo)) {
            _.each(multisigEthInfo, info => {
              log.info(
                `Importing multisig wallet. Address: ${info.multisigContractAddress} - m: ${info.m} - n: ${info.n}`
              );
              const multisigEthCredentials = client.credentials.getMultisigEthCredentials({
                walletName: info.walletName,
                multisigContractAddress: info.multisigContractAddress,
                n: info.n,
                m: info.m
              });
              let multisigEthClient = _.cloneDeep(client);
              multisigEthClient.credentials = multisigEthCredentials;
              clients.push(multisigEthClient);
              const tokenAddresses = info.tokenAddresses;
              if (!_.isEmpty(tokenAddresses)) {
                _.each(tokenAddresses, t => {
                  const token = Constants.TOKEN_OPTS[t];
                  if (!token) {
                    log.warn(`Token ${t} unknown`);
                    return;
                  }
                  log.info(`Importing multisig token: ${token.name}`);
                  const tokenCredentials = multisigEthClient.credentials.getTokenCredentials(token);
                  let tokenClient = _.cloneDeep(multisigEthClient);
                  tokenClient.credentials = tokenCredentials;
                  clients.push(tokenClient);
                });
              }
            });
          }
          return icb(null, clients);
        }
        if (err instanceof Errors.NOT_AUTHORIZED || err instanceof Errors.WALLET_DOES_NOT_EXIST) {
          return icb();
        }

        return icb(err);
      });
    };

    var checkKey = (key, cb) => {
      let opts = [
        // coin, network,  multisig
        ['btc', 'livenet'],
        ['bch', 'livenet'],
        ['eth', 'livenet'],
        ['eth', 'testnet'],
        ['xrp', 'livenet'],
        ['xrp', 'testnet'],
        ['btc', 'livenet', true],
        ['bch', 'livenet', true]
      ];
      if (key.use44forMultisig) {
        //  testing old multi sig
        opts = opts.filter(x => {
          return x[2];
        });
      }

      if (key.use0forBCH) {
        //  testing BCH, old coin=0 wallets
        opts = opts.filter(x => {
          return x[0] == 'bch';
        });
      }

      if (!key.nonCompliantDerivation) {
        // TESTNET
        let testnet = _.cloneDeep(opts);
        testnet.forEach(x => {
          x[1] = 'testnet';
        });
        opts = opts.concat(testnet);
      } else {
        //  leave only BTC, and no testnet
        opts = opts.filter(x => {
          return x[0] == 'btc';
        });
      }

      let clients = [];
      async.eachSeries(
        opts,
        (x, next) => {
          let optsObj = {
            coin: x[0],
            network: x[1],
            account: 0,
            n: x[2] ? 2 : 1
          };
          // console.log('[api.js.2287:optsObj:]',optsObj); // TODO
          // TODO OPTI: do not scan accounts if XX
          //
          // 1. check account 0
          checkCredentials(key, optsObj, (err, iclients) => {
            if (err) return next(err);
            if (_.isEmpty(iclients)) return next();
            clients = clients.concat(iclients);

            // Accounts not allowed?
            if (key.use0forBCH || !key.compliantDerivation || key.use44forMultisig || key.BIP45) return next();

            // Now, lets scan all accounts for the found client
            let cont = true,
              account = 1;
            async.whilst(
              () => {
                return cont;
              },
              icb => {
                optsObj.account = account++;

                checkCredentials(key, optsObj, (err, iclients) => {
                  if (err) return icb(err);
                  // we do not allow accounts nr gaps in BWS.
                  cont = !_.isEmpty(iclients);
                  if (cont) {
                    clients = clients.concat(iclients);
                  }
                  return icb();
                });
              },
              err => {
                return next(err);
              }
            );
          });
        },
        err => {
          if (err) return cb(err);
          return cb(null, clients);
        }
      );
    };

    let sets = [
      {
        // current wallets: /[44,48]/[0,145]'/
        nonCompliantDerivation: false,
        useLegacyCoinType: false,
        useLegacyPurpose: false
      },
      {
        // older bch wallets: /[44,48]/[0,0]'/
        nonCompliantDerivation: false,
        useLegacyCoinType: true,
        useLegacyPurpose: false
      },
      {
        // older BTC/BCH  multisig wallets: /[44]/[0,145]'/
        nonCompliantDerivation: false,
        useLegacyCoinType: false,
        useLegacyPurpose: true
      },
      {
        // not that // older multisig BCH wallets: /[44]/[0]'/
        nonCompliantDerivation: false,
        useLegacyCoinType: true,
        useLegacyPurpose: true
      },

      {
        // old BTC no-comp wallets: /44'/[0]'/
        nonCompliantDerivation: true,
        useLegacyPurpose: true
      }
    ];

    let s,
      resultingClients = [],
      k;
    async.whilst(
      () => {
        if (!_.isEmpty(resultingClients)) return false;

        s = sets.shift();
        if (!s) return false;

        try {
          if (opts.words) {
            if (opts.passphrase) {
              s.passphrase = opts.passphrase;
            }

            k = new Key({ seedData: opts.words, seedType: 'mnemonic', ...s });
          } else {
            k = new Key({ seedData: opts.xPrivKey, seedType: 'extendedPrivateKey', ...s });
          }
        } catch (e) {
          log.info('Backup error:', e);
          return callback(new Errors.INVALID_BACKUP());
        }
        return true;
      },
      icb => {
        checkKey(k, (err, clients) => {
          if (err) return icb(err);

          if (clients && clients.length) {
            resultingClients = clients;
          }
          return icb();
        });
      },
      err => {
        if (err) return callback(err);

        if (_.isEmpty(resultingClients)) k = null;
        return callback(null, k, resultingClients);
      }
    );
  }

  simplexGetQuote(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/simplex/quote', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  simplexPaymentRequest(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/simplex/paymentRequest', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  simplexGetEvents(data): Promise<any> {
    return new Promise((resolve, reject) => {
      let qs = [];
      qs.push('env=' + data.env);

      this.request.get('/v1/service/simplex/events/?' + qs.join('&'), (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  wyreWalletOrderQuotation(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/wyre/walletOrderQuotation', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  wyreWalletOrderReservation(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/wyre/walletOrderReservation', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }
}
