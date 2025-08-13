'use strict';

import async from 'async';
import Mnemonic from 'bitcore-mnemonic';
import * as CWC from 'crypto-wallet-core';
import { EventEmitter } from 'events';
import { singleton } from 'preconditions';
import querystring from 'querystring';
import sjcl from 'sjcl';
import Uuid from 'uuid';
import { BulkClient } from './bulkclient';
import { Constants, Utils } from './common';
import { Credentials } from './credentials';
import { Errors } from './errors';
import { Key } from './key';
import log from './log';
import { PayPro } from './paypro';
import { PayProV2 } from './payproV2';
import { Request } from './request';
import { Verifier } from './verifier';

const $ = singleton();

const Bitcore = CWC.BitcoreLib;
const Bitcore_ = {
  btc: CWC.BitcoreLib,
  bch: CWC.BitcoreLibCash,
  eth: CWC.BitcoreLib,
  matic: CWC.BitcoreLib,
  arb: CWC.BitcoreLib,
  base: CWC.BitcoreLib,
  op: CWC.BitcoreLib,
  xrp: CWC.BitcoreLib,
  doge: CWC.BitcoreLibDoge,
  ltc: CWC.BitcoreLibLtc,
  sol: CWC.BitcoreLib,
};

const NetworkChar = {
  livenet: 'L',
  testnet: 'T',
  regtest: 'R'
};
for (const network in NetworkChar) { // invert NetworkChar
  NetworkChar[NetworkChar[network]] = network;
}

const BASE_URL = 'http://localhost:3232/bws/api';

export class API extends EventEmitter {
  doNotVerifyPayPro: any;
  timeout: any;
  logLevel: any;
  supportStaffWalletId: any;
  request: any;
  bulkClient: any;
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
  static BitcoreDoge = CWC.BitcoreLibDoge;
  static BitcoreLtc = CWC.BitcoreLibLtc;

  /**
   * ClientAPI constructor.
   * @param {Object} [opts]
   * @param {boolean} [opts.doNotVerifyPayPro]
   * @param {number} [opts.timeout] Default: 50000
   * @param {string} [opts.logLevel] Default: 'silent'
   * @param {string} [opts.supportStaffWalletId]
   * @param {string} [opts.baseUrl] Default: 'http://localhost:3232/bws/api'
   * @param {Object} [opts.request] Request library instance
   * @param {string} [opts.bp_partner] PayPro BitPay Partner
   * @param {string} [opts.bp_partner_version] PayPro BitPay Partner version
   */
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

    this.bulkClient = new BulkClient(opts.baseUrl || BASE_URL, {
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
    $.checkState(
      this.credentials,
      'Failed state: this.credentials at <initialize()>'
    );

    this.notificationIncludeOwn = !!opts.notificationIncludeOwn;
    this._initNotifications(opts);
    return cb();
  }

  dispose(cb) {
    this._disposeNotifications();
    this.request.logout(cb);
  }

  _fetchLatestNotifications(interval, cb) {
    cb = cb || function() { };

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
        this.lastNotificationId = notifications.slice(-1)[0].id;
      }

      for (const notification of notifications) {
        this.emit('notification', notification);
      }
      return cb();
    });
  }

  _initNotifications(opts) {
    opts = opts || {};

    var interval = opts.notificationIntervalSeconds || 5;
    this.notificationsIntervalId = setInterval(() => {
      this._fetchLatestNotifications(interval, err => {
        if (err) {
          if (
            err instanceof Errors.NOT_FOUND ||
            err instanceof Errors.NOT_AUTHORIZED
          ) {
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

  /**
   * Reset notification polling with new interval
   * @param {number} notificationIntervalSeconds - use 0 to pause notifications
   */
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

  /**
   * Encrypt a message
   * @private
   * @param {string} message
   * @param {string} encryptingKey
   */
  static _encryptMessage(message, encryptingKey) {
    if (!message) return null;
    return Utils.encryptMessage(message, encryptingKey);
  }

  _processTxNotes(notes) {
    if (!notes) return;

    const encryptingKey = this.credentials.sharedEncryptingKey;
    for (const note of [].concat(notes)) {
      note.encryptedBody = note.body;
      note.body = Utils.decryptMessageNoThrow(note.body, encryptingKey);
      note.encryptedEditedByName = note.editedByName;
      note.editedByName = Utils.decryptMessageNoThrow(
        note.editedByName,
        encryptingKey
      );
    }
  }

  /**
   * Decrypt text fields in transaction proposals
   * @private
   * @param {Array} txps
   */
  _processTxps(txps) {
    if (!txps) return;

    var encryptingKey = this.credentials.sharedEncryptingKey;
    for (const txp of [].concat(txps)) {
      txp.encryptedMessage = txp.message;
      txp.message =
        Utils.decryptMessageNoThrow(txp.message, encryptingKey) || null;
      txp.creatorName = Utils.decryptMessageNoThrow(
        txp.creatorName,
        encryptingKey
      );

      for (const action of txp.actions || []) {
        // CopayerName encryption is optional (not available in older wallets)
        action.copayerName = Utils.decryptMessageNoThrow(action.copayerName, encryptingKey);
        action.comment = Utils.decryptMessageNoThrow(action.comment, encryptingKey);
        // TODO get copayerName from Credentials -> copayerId to copayerName
        // action.copayerName = null;
      }
      for (const output of txp.outputs || []) {
        output.encryptedMessage = output.message;
        output.message = Utils.decryptMessageNoThrow(output.message, encryptingKey) || null;
      }
      txp.hasUnconfirmedInputs = (txp.inputs || []).some(input => input.confirmations == 0);
      this._processTxNotes(txp.note);
    }
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
      var words =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
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
    if (!_deviceValidated && !opts.skipDeviceValidation) {
      hardcodedOk = testHardcodedKeys();
      _deviceValidated = true;
    }

    // TODO
    //  var liveOk = (c.canSign() && !c.isPrivKeyEncrypted()) ? testLiveKeys() : true;
    this.keyDerivationOk = hardcodedOk; // && liveOk;

    return cb(null, this.keyDerivationOk);
  }

  /**
   * Convert credentials to a plain object
   */
  toObj() {
    $.checkState(this.credentials, 'Failed state: this.credentials at <toObj()>');
    return this.credentials.toObj();
  }

  /**
   * Convert this to a stringified JSON
   */
  toString() {
    $.checkState(this.credentials, 'Failed state: this.credentials at <toString()>');
    $.checkArgument(!this.noSign, 'no Sign not supported');
    $.checkArgument(!this.password, 'password not supported');

    const output = JSON.stringify(this.toObj());
    return output;
  }

  fromObj(credentials) {
    $.checkArgument(credentials && typeof credentials === 'object' && !Array.isArray(credentials), 'Argument should be an object');

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
    return this;
  }

  /**
   * Import credentials from a string
   * @param {string} credentials The serialized JSON created with #export
   */
  fromString(credentials) {
    $.checkArgument(credentials, 'Missing argument: credentials at <fromString>');
    if (typeof credentials === 'object') {
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

  toClone() {
    $.checkState(this.credentials, 'Failed state: this.credentials at <toClone()>');
    const clone = new API(Object.assign({}, this, { request: this.request.r, baseUrl: this.request.baseUrl }));
    clone.fromObj(this.toObj());
    return clone;
  }

  static clone(api: API) {
    const clone = new API(Object.assign({}, api, { request: api.request.r, baseUrl: api.request.baseUrl }));
    if (api.credentials) {
      clone.fromObj(api.toObj());
    }
    return clone;
  }

  decryptBIP38PrivateKey(encryptedPrivateKeyBase58, passphrase, progressCallback, cb) {
    var Bip38 = require('bip38');
    var bip38 = new Bip38();

    var privateKeyWif;
    try {
      privateKeyWif = bip38.decrypt(encryptedPrivateKeyBase58, passphrase, progressCallback);
    } catch (ex) {
      return cb(new Error('Could not decrypt BIP38 private key' + ex));
    }

    var privateKey = new Bitcore.PrivateKey(privateKeyWif);
    var address = privateKey.publicKey.toAddress().toString();
    var addrBuff = Buffer.from(address, 'ascii');
    var actualChecksum = Bitcore.crypto.Hash.sha256sha256(addrBuff)
      .toString('hex')
      .substring(0, 8);
    var expectedChecksum = Bitcore.encoding.Base58Check.decode(
      encryptedPrivateKeyBase58
    )
      .toString('hex')
      .substring(6, 14);

    if (actualChecksum != expectedChecksum)
      return cb(new Error('Incorrect passphrase'));

    return cb(null, privateKeyWif);
  }

  getBalanceFromPrivateKey(privateKey, chain, cb) {
    if (typeof chain === 'function') {
      cb = chain;
      chain = 'btc';
    }
    var B = Bitcore_[chain];

    var privateKey = new B.PrivateKey(privateKey);
    var address = privateKey.publicKey.toAddress().toString(true);

    this.getUtxos(
      {
        addresses: address
      },
      (err, utxos) => {
        if (err) return cb(err);
        return cb(null, (utxos || []).reduce((sum, u) => sum += u.satoshis, 0));
      }
    );
  }

  buildTxFromPrivateKey(privateKey, destinationAddress, opts, cb) {
    opts = opts || {};

    var chain = opts.chain?.toLowerCase() || Utils.getChain(opts.coin); // getChain -> backwards compatibility
    var signingMethod = opts.signingMethod || 'ecdsa';

    if (!Constants.CHAINS.includes(chain))
      return cb(new Error('Invalid chain'));

    if (Constants.EVM_CHAINS.includes(chain))
      return cb(new Error('EVM based chains not supported for this action'));

    var B = Bitcore_[chain];
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
          if (!Array.isArray(utxos) || utxos.length == 0)
            return next(new Error('No utxos found'));

          const fee = opts.fee || 10000;
          const utxoSum = (utxos || []).reduce((sum, u) => sum += u.satoshis, 0);
          const amount = utxoSum - fee;
          if (amount <= 0) return next(new Errors.INSUFFICIENT_FUNDS());

          try {
            const toAddress = B.Address.fromString(destinationAddress);
            const tx = new B.Transaction()
              .from(utxos)
              .to(toAddress, amount)
              .fee(fee)
              .sign(privateKey, undefined, signingMethod);

            // Make sure the tx can be serialized
            tx.serialize();
            return next(null, tx);
          } catch (ex) {
            log.error('Could not build transaction from private key', ex);
            return next(new Errors.COULD_NOT_BUILD_TRANSACTION());
          }
        }
      ],
      cb
    );
  }

  /**
   * Open a wallet and try to complete the public key ring.
   * @param {function} cb Callback function in the standard form (err, wallet)
   * @returns {API} Returns instance of API wallet
   */
  openWallet(opts, cb) {
    if (typeof opts === 'function') {
      cb = opts;
    }
    opts = opts || {};

    $.checkState(this.credentials, 'Failed state: this.credentials at <openWallet()>');
    if (this.credentials.isComplete() && this.credentials.hasWalletInfo())
      return cb(null, true);

    const qs = [];
    qs.push('includeExtendedInfo=1');
    qs.push('serverMessageArray=1');

    this.request.get('/v3/wallets/?' + qs.join('&'), (err, ret) => {
      if (err) return cb(err);
      var wallet = ret.wallet;

      this._processStatus(ret);

      if (!this.credentials.hasWalletInfo()) {
        const me = (wallet.copayers || []).find(c => c.id === this.credentials.copayerId);
        if (!me) return cb(new Error('Copayer not in wallet'));

        try {
          this.credentials.addWalletInfo(
            wallet.id,
            wallet.name,
            wallet.m,
            wallet.n,
            me.name,
            opts
          );
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

      this.credentials.addPublicKeyRing(
        this._extractPublicKeyRing(wallet.copayers)
      );
      this.emit('walletCompleted', wallet);

      return cb(null, ret);
    });
  }

  static _buildSecret(walletId, walletPrivKey, chain, network) {
    if (typeof walletPrivKey === 'string') {
      walletPrivKey = Bitcore.PrivateKey.fromString(walletPrivKey);
    }
    var widHex = Buffer.from(walletId.replace(/-/g, ''), 'hex');
    var widBase58 = new Bitcore.encoding.Base58(widHex).toString();
    const networkChar = NetworkChar[network] || 'L';
    return (
      widBase58.padEnd(22, '0') +
      walletPrivKey.toWIF() +
      networkChar +
      chain
    );
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

      const walletPrivKey = Bitcore.PrivateKey.fromString(secretSplit[1]);
      const network = NetworkChar[secretSplit[2]] || 'livenet';
      const coin = secretSplit[3] || 'btc';

      return {
        walletId,
        walletPrivKey,
        coin,
        network
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
    var acceptedActions = (txp.actions || []).filter(a => a.type === 'accept');

    return acceptedActions.map(x => ({
      signatures: x.signatures,
      xpub: x.xpub
    }));
  }

  _addSignaturesToBitcoreTxBitcoin(txp, t, signatures, xpub) {
    $.checkState(
      txp.coin,
      'Failed state: txp.coin undefined at _addSignaturesToBitcoreTxBitcoin'
    );
    $.checkState(
      txp.signingMethod,
      'Failed state: txp.signingMethod undefined at _addSignaturesToBitcoreTxBitcoin'
    );

    var chain = txp.chain?.toLowerCase() || Utils.getChain(txp.coin); // getChain -> backwards compatibility
    const bitcore = Bitcore_[chain];
    if (signatures.length != txp.inputs.length)
      throw new Error('Number of signatures does not match number of inputs');

    let i = 0;
    const x = new bitcore.HDPublicKey(xpub);

    for (const signatureHex of signatures) {
      try {
        const signature = bitcore.crypto.Signature.fromString(signatureHex);
        const pub = x.deriveChild(txp.inputPaths[i]).publicKey;
        const s = {
          inputIndex: i,
          signature,
          sigtype:
            // tslint:disable-next-line:no-bitwise
            bitcore.crypto.Signature.SIGHASH_ALL |
            bitcore.crypto.Signature.SIGHASH_FORKID,
          publicKey: pub
        };
        t.inputs[i].addSignature(t, s, txp.signingMethod);
        i++;
      } catch (e) { }
    }

    if (i != txp.inputs.length) throw new Error('Wrong signatures');
  }

  _addSignaturesToBitcoreTx(txp, t, signatures, xpub) {
    const { chain, network } = txp;
    switch (chain.toLowerCase()) {
      case 'xrp':
      case 'eth':
      case 'matic':
      case 'arb':
      case 'base':
      case 'op':
      case 'sol':
        const unsignedTxs = t.uncheckedSerialize();
        const signedTxs = [];
        for (let index = 0; index < signatures.length; index++) {
          const signed = CWC.Transactions.applySignature({
            chain: chain.toUpperCase(),
            tx: unsignedTxs[index],
            signature: signatures[index]
          });
          signedTxs.push(signed);

          // bitcore users id for txid...
          t.id = CWC.Transactions.getHash({
            tx: signed,
            chain: chain.toUpperCase(),
            network
          });
        }
        t.uncheckedSerialize = () => signedTxs;
        t.serialize = () => signedTxs;
        break;
      default:
        return this._addSignaturesToBitcoreTxBitcoin(txp, t, signatures, xpub);
    }
  }

  _applyAllSignatures(txp, t) {
    $.checkState(
      txp.status == 'accepted',
      'Failed state: txp.status at _applyAllSignatures'
    );

    var sigs = this._getCurrentSignatures(txp);
    for (const x of sigs) {
      this._addSignaturesToBitcoreTx(txp, t, x.signatures, x.xpub);
    }
  }

  /**
   * Join a multisig wallet
   * @private
   * @param {string} walletId
   * @param {string} walletPrivKey
   * @param {string} xPubKey
   * @param {string} requestPubKey
   * @param {string} copayerName
   * @param {Object} [opts]
   * @param {string} [opts.customData]
   * @param {string} [opts.coin]
   * @param {string} [opts.hardwareSourcePublicKey]
   * @param {string} [opts.clientDerivedPublicKey]
   * @param {function} cb Callback function in the standard form (err, wallet)
   * @returns {API} Returns instance of API wallet
   */
  _doJoinWallet(
    walletId,
    walletPrivKey,
    xPubKey,
    requestPubKey,
    copayerName,
    opts,
    cb
  ) {
    $.shouldBeFunction(cb);

    opts = opts || {};

    // Adds encrypted walletPrivateKey to CustomData
    opts.customData = opts.customData || {};
    opts.customData.walletPrivKey = walletPrivKey.toString();
    const encCustomData = Utils.encryptMessage(JSON.stringify(opts.customData), this.credentials.personalEncryptingKey);
    const encCopayerName = Utils.encryptMessage(copayerName, this.credentials.sharedEncryptingKey);

    const args: any = {
      walletId,
      coin: opts.coin,
      chain: opts.chain,
      name: encCopayerName,
      xPubKey,
      requestPubKey,
      customData: encCustomData,
      hardwareSourcePublicKey: opts.hardwareSourcePublicKey,
      clientDerivedPublicKey: opts.clientDerivedPublicKey
    };
    if (opts.dryRun) args.dryRun = true;

    if ([true, false].includes(opts.supportBIP44AndP2PKH))
      args.supportBIP44AndP2PKH = opts.supportBIP44AndP2PKH;

    const hash = Utils.getCopayerHash(
      args.name,
      args.xPubKey,
      args.requestPubKey
    );
    args.copayerSignature = Utils.signMessage(hash, walletPrivKey);

    const url = '/v2/wallets/' + walletId + '/copayers';
    this.request.post(url, args, (err, body) => {
      if (err) return cb(err);
      this._processWallet(body.wallet);
      return cb(null, body.wallet);
    });
  }

  /**
   * Checks if wallet is complete
   * @returns {boolean}
   */
  isComplete() {
    return this.credentials && this.credentials.isComplete();
  }

  _extractPublicKeyRing(copayers) {
    return (copayers || []).map(copayer => ({
      xPubKey: copayer.xPubKey,
      requestPubKey: copayer.requestPubKey,
      copayerName: copayer.name
    }));
  }

  /**
   * Get current fee levels for the specified network
   * @param {string} chain 'btc' (default) or 'bch'
   * @param {string} network 'livenet' (default) or 'testnet'
   * @param {function} cb Callback function in the standard form (err, levels)
   * @returns {object} An object with fee level information
   */
  getFeeLevels(chain, network, cb) {
    $.checkArgument(chain || Constants.CHAINS.includes(chain));
    $.checkArgument(network || ['livenet', 'testnet'].includes(network));

    this.request.get(
      '/v2/feelevels/?coin=' +
      (chain || 'btc') +
      '&network=' +
      (network || 'livenet'),
      (err, result) => {
        if (err) return cb(err);
        return cb(err, result);
      }
    );
  }

  clearCache(opts, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    const qs = Object.entries(opts || {}).map(([key, value]) => `${key}=${value}`).join('&');
    this.request.post('/v1/clearcache/' + (qs ? '?' + qs : ''), {}, (err, res) => {
      return cb(err, res);
    });
  }

  /**
   * Get service version
   * @param {function} cb Callback function in the standard form (err, version)
   */
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

  /**
   * Create a wallet
   * @param {string} walletName
   * @param {string} copayerName
   * @param {number} m
   * @param {number} n
   * @param {Object} [opts] (optional: advanced options)
   * @param {string} [opts.coin] The coin for this wallet (btc, bch). Default: btc
   * @param {string} [opts.chain] The chain for this wallet (btc, bch). Default: btc
   * @param {string} [opts.network] Default: livenet
   * @param {boolean} [opts.singleAddress] The wallet will only ever have one address. Default: false
   * @param {string} [opts.walletPrivKey] Set a walletPrivKey (instead of random)
   * @param {string} [opts.id] Set an id for wallet (instead of server given)
   * @param {boolean} [opts.useNativeSegwit] Set addressType to P2WPKH, P2WSH, or P2TR (segwitVersion = 1)
   * @param {number} [opts.segwitVersion] 0 (default) = P2WPKH, P2WSH; 1 = P2TR
   * @param {function} cb Callback function in the standard form (err, joinSecret)
   * @return {null|string} Returns null for a single-sig wallet, or the join secret for a multi-sig wallet
   */
  createWallet(walletName, copayerName, m, n, opts, cb) {
    if (!this._checkKeyDerivation())
      return cb(new Error('Cannot create new wallet'));

    if (opts) $.shouldBeObject(opts);
    opts = opts || {};

    var coin = opts.coin || 'btc';
    var chain = opts.chain?.toLowerCase() || coin;

    // checking in chains for simplicity
    if (!Constants.CHAINS.includes(chain))
      return cb(new Error('Invalid chain'));

    var network = opts.network || 'livenet';
    if (!['testnet', 'livenet', 'regtest'].includes(network))
      return cb(new Error('Invalid network: ' + network));

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
      chain,
      coin,
      network,
      singleAddress: !!opts.singleAddress,
      id: opts.id,
      usePurpose48: n > 1,
      useNativeSegwit: !!opts.useNativeSegwit,
      segwitVersion: opts.segwitVersion,
      hardwareSourcePublicKey: c.hardwareSourcePublicKey,
      clientDerivedPublicKey: c.clientDerivedPublicKey
    };
    this.request.post('/v2/wallets/', args, (err, res) => {
      if (err) return cb(err);

      var walletId = res.walletId;
      c.addWalletInfo(walletId, walletName, m, n, copayerName, {
        useNativeSegwit: opts.useNativeSegwit,
        segwitVersion: opts.segwitVersion
      });
      var secret = API._buildSecret(
        c.walletId,
        c.walletPrivKey,
        c.coin,
        c.network
      );

      this._doJoinWallet(
        walletId,
        walletPrivKey,
        c.xPubKey,
        c.requestPubKey,
        copayerName,
        {
          coin,
          chain,
          hardwareSourcePublicKey: c.hardwareSourcePublicKey,
          clientDerivedPublicKey: c.clientDerivedPublicKey
        },
        (err, wallet) => {
          if (err) return cb(err);
          return cb(null, n > 1 ? secret : null);
        }
      );
    });
  }

  /**
   * Join an existent wallet
   * @param {string} secret
   * @param {string} copayerName
   * @param {Object} [opts]
   * @param {string} [opts.coin] The expected coin for this wallet (btc, bch). Default: btc
   * @param {boolean} [opts.dryRun] Simulate wallet join. Default: false
   * @param {function} cb Callback function in the standard form (err, wallet)
   * @returns {API} Returns instance of API wallet
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
    var chain = opts.chain || coin;

    if (!Constants.CHAINS.includes(chain))
      return cb(new Error('Invalid chain'));

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
        chain,
        dryRun: !!opts.dryRun
      },
      (err, wallet) => {
        if (err) return cb(err);
        if (!opts.dryRun) {
          this.credentials.addWalletInfo(
            wallet.id,
            wallet.name,
            wallet.m,
            wallet.n,
            copayerName,
            {
              useNativeSegwit: Utils.isNativeSegwit(wallet.addressType),
              segwitVersion: Utils.getSegwitVersion(wallet.addressType),
              allowOverwrite: true
            }
          );
        }
        return cb(null, wallet);
      }
    );
  }

  /**
   * Recreates a wallet, given credentials (with wallet id)
   * @param {function} cb Callback function in the standard form (err)
   * @returns {undefined} No return value
   */
  recreateWallet(cb) {
    $.checkState(this.credentials, 'Failed state: this.credentials at <recreateWallet()>');
    $.checkState(this.credentials.isComplete());
    $.checkState(this.credentials.walletPrivKey);

    // First: Try to get the wallet with current credentials
    this.getStatus({ includeExtendedInfo: true }, err => {
      if (!err) {
        // No error? -> Wallet is ready.
        log.info('Wallet is already created');
        return cb();
      }

      var c = this.credentials;
      var walletPrivKey = Bitcore.PrivateKey.fromString(c.walletPrivKey);
      var walletId = c.walletId;
      var useNativeSegwit = Utils.isNativeSegwit(c.addressType);
      var segwitVersion = Utils.getSegwitVersion(c.addressType);
      var supportBIP44AndP2PKH = c.derivationStrategy != Constants.DERIVATION_STRATEGIES.BIP45;
      var encWalletName = Utils.encryptMessage(
        c.walletName || 'recovered wallet',
        c.sharedEncryptingKey
      );

      var args = {
        name: encWalletName,
        m: c.m,
        n: c.n,
        pubKey: walletPrivKey.toPublicKey().toString(),
        coin: c.coin,
        chain: c.chain,
        network: c.network,
        id: walletId,
        usePurpose48: c.n > 1,
        useNativeSegwit,
        segwitVersion
      };

      if (!!supportBIP44AndP2PKH) {
        args['supportBIP44AndP2PKH'] = supportBIP44AndP2PKH;
      }

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
        var opts = {
          coin: c.coin,
          chain: c.chain
        };
        if (!!supportBIP44AndP2PKH)
          opts['supportBIP44AndP2PKH'] = supportBIP44AndP2PKH;

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
              opts,
              err => {
                // Ignore error if copayer is already in wallet
                if (err instanceof Errors.COPAYER_IN_WALLET)
                  return next();
                return next(err);
              }
            );
          },
          cb
        );
      });
    });
  }

  _processWallet(wallet) {
    var encryptingKey = this.credentials.sharedEncryptingKey;

    var name = Utils.decryptMessageNoThrow(wallet.name, encryptingKey);
    if (name != wallet.name) {
      wallet.encryptedName = wallet.name;
    }
    wallet.name = name;
    for (const copayer of wallet.copayers || []) {
      var name = Utils.decryptMessageNoThrow(copayer.name, encryptingKey);
      if (name != copayer.name) {
        copayer.encryptedName = copayer.name;
      }
      copayer.name = name;
      for (const access of copayer.requestPubKeys || []) {
        if (!access.name) continue;

        var name = Utils.decryptMessageNoThrow(access.name, encryptingKey);
        if (name != access.name) {
          access.encryptedName = access.name;
        }
        access.name = name;
      }
    }
  }

  _processStatus(status) {
    var processCustomData = data => {
      const copayers = data.wallet.copayers;
      if (!copayers) return;

      const me = copayers.find(c => c.id === this.credentials.copayerId);
      if (!me || !me.customData) return;

      var customData;
      try {
        customData = JSON.parse(
          Utils.decryptMessage(
            me.customData,
            this.credentials.personalEncryptingKey
          )
        );
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
   * @param {Object} [opts]
   * @param {string} [opts.lastNotificationId] The ID of the last received notification
   * @param {string} [opts.timeSpan] A time window on which to look for notifications (in seconds)
   * @param {string} [opts.includeOwn] Do not ignore notifications generated by the current copayer. Default: false
   * @param {function} cb Callback function in the standard form (err, notifications)
   * @returns {Array<any>} Returns an array of notifications
   */
  getNotifications(opts, cb) {
    $.checkState(this.credentials, 'Failed state: this.credentials at <getNotifications()>');

    opts = opts || {};

    var url = '/v1/notifications/';
    if (opts.lastNotificationId) {
      url += '?notificationId=' + opts.lastNotificationId;
    } else if (opts.timeSpan) {
      url += '?timeSpan=' + opts.timeSpan;
    }

    this.request.getWithLogin(url, (err, result) => {
      if (err) return cb(err);
      result = result || [];
      const notifications = opts.includeOwn ? result : result.filter(notification => notification.creatorId != this.credentials.copayerId);
      return cb(null, notifications);
    });
  }

  /**
   * Get status of the wallet
   * @param {Object} [opts]
   * @param {boolean} [opts.twoStep] Use 2-step balance computation for improved performance. Default: false
   * @param {boolean} [opts.includeExtendedInfo] Query extended status. Default: false
   * @param {string} [opts.tokenAddress] ERC20 Token Contract Address
   * @param {string} [opts.multisigContractAddress] MULTISIG ETH Contract Address
   * @param {function} cb Callback function in the standard form (err, status)
   * @returns {Object} Returns an object with status information
   */
  getStatus(opts, cb) {
    $.checkState(this.credentials, 'Failed state: this.credentials at <getStatus()>');

    if (!cb) {
      cb = opts;
      opts = {};
      log.warn('DEPRECATED WARN: getStatus should receive 2 parameters.');
    }

    opts = opts || {};

    const qs = [];
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
        result.wallet.secret = API._buildSecret(
          c.walletId,
          c.walletPrivKey,
          c.coin,
          c.network
        );
      }

      this._processStatus(result);

      return cb(err, result);
    });
  }

  /**
   * Get copayer preferences
   * @param {function} cb Callback function in the standard form (err, preferences)
   * @return {Object} Returns a preferences object
   */
  getPreferences(cb) {
    $.checkState(this.credentials, 'Failed state: this.credentials at <getPreferences()>');
    $.checkArgument(cb);

    this.request.get('/v1/preferences/', (err, preferences) => {
      if (err) return cb(err);
      return cb(null, preferences);
    });
  }

  /**
   * Save copayer preferences
   * @param {Object} preferences Preferences to be saved
   * @param {function} cb Callback function in the standard form (err, preferences)
   * @return {Object} Returns saved preferences object
   */
  savePreferences(preferences, cb) {
    $.checkState(
      this.credentials,
      'Failed state: this.credentials at <savePreferences()>'
    );
    $.checkArgument(cb);

    this.request.put('/v1/preferences/', preferences, cb);
  }

  /**
   * Fetch PayPro invoice
   * @param {Object} opts
   * @param {string} opts.payProUrl PayPro request URL
   * @param {function} cb Callback function in the standard form (err, paypro)
   * @returns {{ amount, toAddress, memo }} Parsed payment protocol request
   */
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

  /**
   * Gets list of utxos
   * @param {Object} [opts]
   * @param {Array<string>} [opts.addresses] List of addresses from where to fetch UTXOs
   * @param {function} cb Callback function in the standard form (err, utxos)
   * @returns {Array<any>} Returns an array of utxos
   */
  getUtxos(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <getUtxos()>');
    opts = opts || {};
    let url = '/v1/utxos/';
    if (opts.addresses) {
      url +=
        '?' +
        querystring.stringify({
          addresses: [].concat(opts.addresses).join(',')
        });
    }
    this.request.get(url, cb);
  }

  /**
   * Gets list of coins
   * @param {Object} opts
   * @param {string} [opts.coin] Chain to query (DEPRECATED - use `opts.chain`)
   * @param {string} opts.chain Chain to query
   * @param {string} opts.network Network to query
   * @param {string} opts.txId Transaction ID to query
   * @param {function} cb Callback function in the standard form (err, coins) 
   * @returns {Array<any>} Returns an array of coins
   */
  getCoinsForTx(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <getCoinsForTx()>');
    $.checkArgument(opts && (opts.coin || opts.chain) && opts.network && opts.txId, 'Missing required parameter(s)');
    opts.chain = opts.chain || opts.coin; // backwards compatibility
    let url = '/v1/txcoins/';
    url +=
      '?' +
      querystring.stringify({
        coin: opts.chain,
        network: opts.network,
        txId: opts.txId
      });
    this.request.get(url, cb);
  }

  _getCreateTxProposalArgs(opts) {
    const args = JSON.parse(JSON.stringify(opts));
    args.message = API._encryptMessage(opts.message, this.credentials.sharedEncryptingKey) || null;
    args.payProUrl = opts.payProUrl || null;
    args.isTokenSwap = opts.isTokenSwap || null;
    args.replaceTxByFee = opts.replaceTxByFee || null;
    for (const o of args.outputs) {
      o.message = API._encryptMessage(o.message, this.credentials.sharedEncryptingKey) || null;
    }
    return args;
  }

  /**
   * Create a transaction proposal
   *
   * @param {Object} opts
   * @param {string} [opts.txProposalId] If provided it will be used as this TX proposal ID. Should be unique in the scope of the wallet
   * @param {Array} opts.outputs Array of outputs
   * @param {string} opts.outputs[].toAddress Destination address
   * @param {number} opts.outputs[].amount Amount to transfer in satoshi
   * @param {string} [opts.outputs[].message] A message to attach to this output
   * @param {string} [opts.message] A message to attach to this transaction
   * @param {number} [opts.feeLevel] Specify the fee level for this TX ('priority', 'normal', 'economy', 'superEconomy'). Default: normal
   * @param {number} [opts.feePerKb] Specify the fee per KB for this TX (in satoshi)
   * @param {string} [opts.changeAddress] Use this address as the change address for the tx. The address should belong to the wallet. In the case of singleAddress wallets, the first main address will be used
   * @param {boolean} [opts.sendMax] Send maximum amount of funds that make sense under the specified fee/feePerKb conditions. Default: false
   * @param {string} [opts.payProUrl] Paypro URL for peers to verify TX
   * @param {boolean} [opts.excludeUnconfirmedUtxos] Do not use UTXOs of unconfirmed transactions as inputs. Default: false
   * @param {boolean} [opts.dryRun] Simulate the action but do not change server state. Default: false
   * @param {Array} [opts.inputs] Inputs for this TX
   * @param {number} [opts.fee] Use a fixed fee for this TX (only when opts.inputs is specified)
   * @param {boolean} [opts.noShuffleOutputs] If set, TX outputs won't be shuffled. Default: false
   * @param {string} [opts.signingMethod] If set, force signing method (ecdsa or schnorr) otherwise use default for chain
   * @param {boolean} [opts.isTokenSwap] To specify if we are trying to make a token swap
   * @param {boolean} [opts.enableRBF] Enable BTC Replace-By-Fee
   * @param {string} [opts.multiSendContractAddress] Use this address to interact with the MultiSend contract that is used to send EVM based txp's with outputs > 1
   * @param {string} [opts.tokenAddress] Use this address to reference a token an a given chain
   * @param {boolean} [opts.replaceTxByFee] Ignore locked utxos check ( used for replacing a transaction designated as RBF)
   * @param {function} cb Callback function in the standard form (err, txp)
   * @param {string} [baseUrl] ONLY FOR TESTING
   * @returns {Object} Returns the transaction proposal
   */
  createTxProposal(opts, cb, baseUrl) {
    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <createTxProposal()>');
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
      if (
        !Verifier.checkProposalCreation(
          args,
          txp,
          this.credentials.sharedEncryptingKey
        )
      ) {
        return cb(new Errors.SERVER_COMPROMISED());
      }

      return cb(null, txp);
    });
  }

  /**
   * Publish a transaction proposal
   * @param {Object} opts
   * @param {Object} opts.txp The transaction proposal object returned by the API#createTxProposal method
   * @param {function} cb Callback function in the standard form (err, null)
   * @returns {null}
   */
  publishTxProposal(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <publishTxProposal()>');
    $.checkArgument(opts?.txp, 'No txp was given to publish');

    $.checkState(parseInt(opts.txp.version) >= 3);

    var t = Utils.buildTx(opts.txp);
    var hash = t.uncheckedSerialize();
    var args = {
      proposalSignature: Utils.signMessage(
        hash,
        this.credentials.requestPrivKey
      )
    };

    var url = '/v2/txproposals/' + opts.txp.id + '/publish/';
    this.request.post(url, args, (err, txp) => {
      if (err) return cb(err);
      this._processTxps(txp);
      return cb(null, txp);
    });
  }

  /**
   * Create a new address
   * @param {Object} [opts]
   * @param {boolean} [opts.ignoreMaxGap] Default: false
   * @param {boolean} [opts.isChange] Default: false
   * @param {function} cb Callback function in the standard form (err, address)
   * @returns {{ address, type, path }}  Returns the new address object
   */
  createAddress(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <createAddress()>');

    if (!cb) {
      cb = opts;
      opts = {};
      log.warn('DEPRECATED WARN: createAddress should receive 2 parameters.');
    }

    if (!this._checkKeyDerivation())
      return cb(new Error('Cannot create new address for this wallet'));

    opts = opts || {};

    this.request.post('/v4/addresses/', opts, (err, address) => {
      if (err) return cb(err);

      if (!Verifier.checkAddress(this.credentials, address)) {
        return cb(new Errors.SERVER_COMPROMISED());
      }

      return cb(null, address);
    });
  }

  /**
   * Get your main addresses
   * @param {Object} [opts]
   * @param {boolean} [opts.doNotVerify] Do not verify the addresses. Default: false
   * @param {number} [opts.limit] Limit the resultset. Return all addresses by default
   * @param {boolean} [opts.reverse] Reverse the order. Default: false
   * @param {function} cb Callback function in the standard form (err, addresses)
   * @returns {{ address, type, path }} Returns an array of addresses
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

    this.request.get(url, (err, addresses) => {
      if (err) return cb(err);

      if (!opts.doNotVerify) {
        const fake = (addresses || []).some(address => !Verifier.checkAddress(this.credentials, address));
        if (fake) return cb(new Errors.SERVER_COMPROMISED());
      }
      return cb(null, addresses);
    });
  }

  /**
   * Update wallet balance
   * @param {Object} [opts]
   * @param {String} [opts.coin] Defaults to current wallet chain (DEPRECATED - use opts.chain)
   * @param {String} [opts.chain] Defaults to current wallet chain
   * @param {String} [opts.tokenAddress] ERC20 token contract address
   * @param {String} [opts.multisigContractAddress] MULTISIG ETH Contract Address
   * @param {function} cb Callback function in the standard form (err, balance)
   * @returns {Object} Returns the wallet balance
   */
  getBalance(opts, cb) {
    if (!cb) {
      cb = opts;
      opts = {};
      log.warn('DEPRECATED WARN: getBalance should receive 2 parameters.');
    }

    opts = opts || {};

    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <getBalance()>');

    opts.chain = opts.chain || opts.coin; // backwards compatibility
    var args = [];
    if (opts.coin) {
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

  /**
   * Get list of transactions proposals
   * @param {Object} [opts]
   * @param {boolean} [opts.doNotVerify] Do not verify the transactions. Default: false
   * @param {boolean} [opts.forAirGapped] This is for an air-gapped wallet
   * @param {boolean} [opts.doNotEncryptPkr] Do not encrypt the public key ring
   * @param {function} cb Callback function in the standard form (err, txps)
   * @return {Array<any>} Return an array of transactions proposals
   */
  getTxProposals(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <getTxProposals()>');

    opts = opts || {};

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
              return cb(err);
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
              unencryptedPkr: opts.doNotEncryptPkr
                ? JSON.stringify(this.credentials.publicKeyRing)
                : null,
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
        if (err)
          return cb(
            new Error(
              'Could not fetch invoice:' + (err.message ? err.message : err)
            )
          );
        return cb(null, paypro);
      }
    );
  }

  getPayProV2(txp) {
    if (!txp.payProUrl || this.doNotVerifyPayPro) return Promise.resolve();

    const chain = txp.chain || Utils.getChain(txp.coin); // getChain -> backwards compatibility
    const currency = Utils.getCurrencyCodeFromCoinAndChain(txp.coin, chain);
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

  /**
   * Push transaction proposal signatures
   * @param {Object} txp Transaction proposal to sign
   * @param {Array} signatures Array of signatures
   * @param {function} cb Callback function in the standard form (err, txp)
   * @param {string} baseUrl ONLY FOR TESTING
   * @return {Object} Returns txp object
   */
  pushSignatures(txp, signatures, cb, baseUrl) {
    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <pushSignatures()>');
    $.checkArgument(txp.creatorId);

    if (!signatures?.length) {
      return cb('No signatures to push. Sign the transaction with Key first');
    }

    this.getPayProV2(txp)
      .then(paypro => {
        const isLegit = Verifier.checkTxProposal(this.credentials, txp, { paypro });
        if (!isLegit) return cb(new Errors.SERVER_COMPROMISED());

        baseUrl = baseUrl || '/v2/txproposals/';
        const url = baseUrl + txp.id + '/signatures/';
        const args = { signatures };
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
   * @param {Object} [opts]
   * @param {function} cb Callback function in the standard form (err, advertisement)
   * @returns {Object} Returns the created advertisement
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
   * @param {Object} [opts]
   * @param {boolean} [opts.testing] If true, fetches testing advertisements
   * @param {function} cb Callback function in the standard form (err, advertisements)
   * @returns {Array<any>} Returns an array of advertisements
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
   * @param {Object} [opts]
   * @param {string} [opts.country] If set, fetches ads by Country
   * @param {function} cb Callback function in the standard form (err, advertisements)
   * @returns {Array<any>} Returns an array of advertisements
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
   * @param {Object} opts
   * @param {string} opts.adId - Advertisement ID
   * @param {function} cb Callback function in the standard form (err, advertisement)
   * @returns {Object} Returns the advertisement
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
   * @param {Object} opts
   * @param {string} opts.adId - Advertisement ID
   * @param {function} cb Callback function in the standard form (err, advertisement)
   * @returns {Object} Returns the activated advertisement
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
   * @param {Object} opts
   * @param {string} opts.adId - Advertisement ID
   * @param {function} cb Callback function in the standard form (err, advertisement)
   * @returns {Object} Returns the deactivated advertisement
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
   * @param {Object} opts
   * @param {string} opts.adId - Advertisement ID
   * @param {function} cb Callback function in the standard form (err, advertisement)
   * @returns {Object} Returns the deleted advertisement
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

  /**
   * Sign transaction proposal from AirGapped
   * @param {Object} txp Transaction proposal to sign
   * @param {string} encryptedPkr An encrypted string with the wallet's public key ring
   * @param {number} m Number of required signatures
   * @param {number} n Number of total signers
   * @param {string} [password] A password to decrypt the encrypted private key (if encryption is set).
   * @return {Object} Returns signed transaction
   */
  signTxProposalFromAirGapped(txp, encryptedPkr, m, n, password?) {
    throw new Error('signTxProposalFromAirGapped not yet implemented');
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

    // if (!Array.isArray(publicKeyRing) || publicKeyRing.length != n) {
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

  /**
   * Sign transaction proposal from AirGapped
   * @param {string} key A mnemonic phrase or an xprv HD private key
   * @param {Object} txp Transaction proposal to sign
   * @param {string} unencryptedPkr An unencrypted string with the wallet's public key ring
   * @param {number} m Number of required signatures
   * @param {number} n Number of total signers
   * @param {Object} [opts]
   * @param {string} [opts.coin] Default: 'btc' (DEPRECATED - use opts.chain)
   * @param {string} [opts.chain] Default: 'btc'
   * @param {string} [opts.passphrase]
   * @param {number} [opts.account] Default: 0
   * @param {string} [opts.derivationStrategy] Default: 'BIP44'
   * @return {Object} Return transaction proposal
   */
  static signTxProposalFromAirGapped(key, txp, unencryptedPkr, m, n, opts, cb) {
    opts = opts || {};

    const chain = opts.chain || opts.coin || 'btc';
    // checking in chains for simplicity
    if (!Constants.CHAINS.includes(chain))
      return cb(new Error('Invalid coin'));

    var publicKeyRing = JSON.parse(unencryptedPkr);

    if (!Array.isArray(publicKeyRing) || publicKeyRing.length != n) {
      throw new Error('Invalid public key ring');
    }

    const newClient: any = new API({
      baseUrl: 'https://bws.example.com/bws/api'
    });

    // TODO TODO TODO
    if (key.slice(0, 4) === 'xprv' || key.slice(0, 4) === 'tprv') {
      if (key.slice(0, 4) === 'xprv' && txp.network == 'testnet')
        throw new Error('testnet HD keys must start with tprv');
      if (key.slice(0, 4) === 'tprv' && txp.network == 'livenet')
        throw new Error('livenet HD keys must start with xprv');
      newClient.seedFromExtendedPrivateKey(key, {
        coin: chain,
        account: opts.account,
        derivationStrategy: opts.derivationStrategy
      });
    } else {
      newClient.seedFromMnemonic(key, {
        coin: chain,
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

    if (!Verifier.checkTxProposalSignature(newClient.credentials, txp))
      throw new Error('Fake transaction proposal');

    return newClient._signTxp(txp);
  }

  /**
   * Reject a transaction proposal
   * @param {Object} txp Transaction proposal to reject
   * @param {string} reason Rejection reason
   * @param {function} cb Callback function in the standard form (err, txp)
   * @return {Object} Returns rejected txp
   */
  rejectTxProposal(txp, reason, cb) {
    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <rejectTxProposal()>');
    $.checkArgument(cb);

    var url = '/v1/txproposals/' + txp.id + '/rejections/';
    var args = {
      reason:
        API._encryptMessage(reason, this.credentials.sharedEncryptingKey) || ''
    };
    this.request.post(url, args, (err, txp) => {
      if (err) return cb(err);
      this._processTxps(txp);
      return cb(null, txp);
    });
  }

  /**
   * Broadcast raw transaction
   * @param {Object} [opts]
   * @param {string} [opts.network]
   * @param {string} [opts.rawTx]
   * @param {function} cb Callback function in the standard form (err, txid)
   * @return {string} Returns a txid
   */
  broadcastRawTx(opts, cb) {
    $.checkState(this.credentials, 'Failed state: this.credentials at <broadcastRawTx()>');
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

  /**
   * Broadcast a transaction proposal
   * @param {Object} txp Transaction proposal to broadcast
   * @param {function} cb Callback function in the standard form (err, txp, memo?)
   * @return {Object, string} Return txp object, and (if a paypro broadcast) possibly a memo string
   */
  broadcastTxProposal(txp, cb) {
    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <broadcastTxProposal()>');

    this.getPayProV2(txp)
      .then(paypro => {
        if (paypro) {
          var t = Utils.buildTx(txp);
          const rawTxUnsigned = t.uncheckedSerialize();

          this._applyAllSignatures(txp, t);

          const chain = txp.chain || Utils.getChain(txp.coin); // getChain -> backwards compatibility
          const currency = Utils.getCurrencyCodeFromCoinAndChain(
            txp.coin,
            chain
          );
          const serializedTx = t.serialize({
            disableSmallFees: true,
            disableLargeFees: true,
            disableDustOutputs: true
          });
          const unsignedTransactions = [];
          const signedTransactions = [];

          // Convert string to array if string
          const unserializedTxs =
            typeof rawTxUnsigned === 'string' ? [rawTxUnsigned] : rawTxUnsigned;
          const serializedTxs =
            typeof serializedTx === 'string' ? [serializedTx] : serializedTx;

          const weightedSize = [];

          let isSegwit =
            (txp.coin == 'btc' || txp.coin == 'ltc') &&
            (txp.addressType == 'P2WSH' || txp.addressType == 'P2WPKH');

          let i = 0;
          for (const unsigned of unserializedTxs) {
            let size;
            if (isSegwit) {
              // we dont have a fast way to calculate weigthedSize`
              size = Math.floor((txp.fee / txp.feePerKb) * 1000) - 10;
            } else {
              size = serializedTxs[i].length / 2;
            }
            unsignedTransactions.push({
              tx: unsigned,
              weightedSize: size
            });
            weightedSize.push(size);

            i++;
          }
          i = 0;
          for (const signed of serializedTxs) {
            signedTransactions.push({
              tx: signed,
              weightedSize: weightedSize[i++],
              escrowReclaimTx: txp.escrowReclaimTx
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

  /**
   * Remove a transaction proposal
   *
   * @param {Object} txp
   * @param {Callback} cb
   * @return {Callback} cb - Return error or empty
   */
  removeTxProposal(txp, cb) {
    $.checkState(
      this.credentials && this.credentials.isComplete(),
      'Failed state: this.credentials at <removeTxProposal()>'
    );

    var url = '/v1/txproposals/' + txp.id;
    this.request.delete(url, err => {
      return cb(err);
    });
  }

  /**
   * Get transaction history
   * @param {Object} [opts]
   * @param {number} [opts.skip] Default: 0
   * @param {number} [opts.limit]
   * @param {string} [opts.tokenAddress]
   * @param {string} [opts.multisigContractAddress] MULTISIG ETH Contract Address
   * @param {boolean} [opts.includeExtendedInfo]
   * @param {function} cb Callback function in the standard form (err, txs)
   * @return {Array<any>} Returns an array of transactions
   */
  getTxHistory(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <getTxHistory()>');

    var args = [];
    if (opts) {
      if (opts.skip) args.push('skip=' + opts.skip);
      if (opts.limit) args.push('limit=' + opts.limit);
      if (opts.tokenAddress) args.push('tokenAddress=' + opts.tokenAddress);
      if (opts.multisigContractAddress)
        args.push('multisigContractAddress=' + opts.multisigContractAddress);
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

  /**
   * Get Tranaction by txid
   * @param {string} txid Transaction ID to query
   * @param {function} cb Callback function in the standard form (err, tx)
   * @return {Object} Returns a transaction object
   */
  getTxByHash(txid, cb) {
    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <getTxByHash()>');

    const url = '/v1/txproposalsbyhash/' + txid;
    this.request.get(url, (err, txp) => {
      if (err) return cb(err);

      this._processTxps(txp);
      return cb(null, txp);
    });
  }

  /**
   * Get Transaction Proposal by id
   * @param {string} txProposalId
   * @param {function} cb Callback function in the standard form (err, txp)
   * @return {Object} Returns a transaction proposal object
   */
  getTx(txProposalId, cb) {
    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <getTx()>');

    var url = '/v1/txproposals/' + txProposalId;
    this.request.get(url, (err, txp) => {
      if (err) return cb(err);

      this._processTxps(txp);
      return cb(null, txp);
    });
  }

  /**
   * Start an address scanning process.
   * When finished, the scanning process will send a notification 'ScanFinished' to all copayers.
   * @param {Object} opts
   * @param {boolean} [opts.includeCopayerBranches] Default: false
   * @param {number} [opts.startIdx] Address derivation path start index (support agents only)
   * @param {function} cb Callback function in the standard form (err, void)
   * @return {void}
   */
  startScan(opts, cb) {
    $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <startScan()>');

    const args = {
      includeCopayerBranches: opts.includeCopayerBranches,
      startIdx: opts.startIdx
    };

    this.request.post('/v1/addresses/scan', args, err => {
      return cb(err);
    });
  }

  /**
   * Adds access to the current copayer
   * @param {Object} opts
   * @param {string} opts.requestPrivKey
   * @param {string} opts.signature Signature of the private key, from master key.
   * @param {string} [opts.restrictions]
   *    - cannotProposeTXs
   *    - cannotXXX TODO
   * @param {string} [opts.name] Name for the new access
   * @param {function} cb Callback function in the standard form (err, wallet, requestPrivateKey)
   * @returns {Object, string} Returns the wallet, requestPrivateKey
   */
  addAccess(opts, cb) {
    $.checkState(this.credentials, 'Failed state: no this.credentials at <addAccess()>');
    $.shouldBeString(opts?.requestPrivKey, 'Failed state: no requestPrivKey at addAccess()');
    $.shouldBeString(opts?.signature, 'Failed state: no signature at addAccess()');

    var requestPubKey = new Bitcore.PrivateKey(opts.requestPrivKey)
      .toPublicKey()
      .toString();
    var copayerId = this.credentials.copayerId;
    var encCopayerName = opts.name
      ? Utils.encryptMessage(opts.name, this.credentials.sharedEncryptingKey)
      : null;

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

  /**
   * Get a note associated with the specified txid
   * @param {Object} opts
   * @param {string} opts.txid The txid associated with the note
   * @param {function} cb Callback function in the standard form (err, note)
   * @return {Object} Returns the note
   */
  getTxNote(opts, cb) {
    $.checkState(this.credentials, 'Failed state: this.credentials at <getTxNote()>');
    $.checkArgument(opts?.txid, 'Missing argument: txid at <getTxNote()>');

    this.request.get('/v1/txnotes/' + opts.txid + '/', (err, note) => {
      if (err) return cb(err);
      this._processTxNotes(note);
      return cb(null, note);
    });
  }

  /**
   * Edit a note associated with the specified txid
   * @param {Object} opts
   * @param {string} opts.txid The txid associated with the note
   * @param {string} opts.body The contents of the note
   * @param {function} cb Callback function in the standard form (err, note)
   * @return {Object} Returns the edited note
   */
  editTxNote(opts, cb) {
    $.checkState(this.credentials, 'Failed state: this.credentials at <editTxNote()>');
    $.checkArgument(opts?.txid, 'Missing argument: txid at <editTxNote()>');

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

  /**
   * Get all notes edited after the specified date
   * @param {Object} [opts]
   * @param {string} [opts.minTs] The starting timestamp
   * @param {function} cb Callback function in the standard form (err, notes)
   * @return {Array<any>} Returns an array of notes
   */
  getTxNotes(opts, cb) {
    $.checkState(this.credentials, 'Failed state: this.credentials at <getTxNotes()>');

    opts = opts || {};
    var args = [];
    if (opts.minTs != null && !isNaN(opts.minTs)) {
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

  /**
   * Returns exchange rate for the specified currency & timestamp.
   * @param {Object} opts
   * @param {string} opts.code Currency ISO code
   * @param {Date|number} [opts.ts] A timestamp to base the rate on. Default: Date.now()
   * @param {string} [opts.coin] Default: 'btc'
   * @returns {Object} Returns exchange rates object
   */
  getFiatRate(opts, cb) {
    $.checkArgument(opts?.code, 'Missing argument: code at <getFiatRate()>');
    $.checkArgument(cb);

    const args = [];
    if (opts.ts) args.push('ts=' + opts.ts);
    if (opts.coin) args.push('coin=' + opts.coin);
    let qs = '';
    if (args.length > 0) {
      qs = '?' + args.join('&');
    }

    this.request.get('/v1/fiatrates/' + opts.code + '/' + qs, (err, rates) => {
      if (err) return cb(err);
      return cb(null, rates);
    });
  }

  /**
   * Subscribe to push notifications
   * @param {Object} opts
   * @param {string} opts.type Device type (ios or android)
   * @param {string} opts.externalUserId Device token // Braze
   * @param {function} cb Callback function in the standard form (err, response)
   * @returns {Object} Status of subscription
   */
  pushNotificationsSubscribe(opts, cb) {
    var url = '/v2/pushnotifications/subscriptions/';
    this.request.post(url, opts, (err, response) => {
      if (err) return cb(err);
      return cb(null, response);
    });
  }

  /**
   * Unsubscribe from push notifications
   * @param {string} externalUserId Device token // Braze
   * @param {function} cb Callback function in the standard form (err)
   * @return {void}
   */
  pushNotificationsUnsubscribe(externalUserId, cb) {
    var url = '/v3/pushnotifications/subscriptions/' + externalUserId;
    this.request.delete(url, cb);
  }

  /**
   * Listen to a tx for its first confirmation
   * @param {Object} opts
   * @param {String} opts.txid The txid to subscribe to
   * @returns {Object} Status of subscription
   */
  txConfirmationSubscribe(opts, cb) {
    $.checkArgument(opts?.txid, 'Missing argument: txid at <txConfirmationSubscribe()>');
    const url = '/v1/txconfirmations/';
    this.request.post(url, opts, (err, response) => {
      if (err) return cb(err);
      return cb(null, response);
    });
  }

  /**
   * Stop listening for a tx confirmation
   * @param {string} txid The txid to unsubscribe from
   * @param {function} cb Callback function in the standard form (err)
   * @return {void}
   */
  txConfirmationUnsubscribe(txid, cb) {
    $.checkArgument(txid, 'Missing argument: txid at <txConfirmationUnsubscribe()>');
    this.request.delete('/v1/txconfirmations/' + txid, cb);
  }

  /**
   * Returns send max information
   * @param {Object} opts
   * @param {number} [opts.feeLevel] Specify the fee level ('priority', 'normal', 'economy', 'superEconomy'). Default: normal
   * @param {number} [opts.feePerKb] Specify the fee per KB (in satoshi)
   * @param {boolean} [opts.excludeUnconfirmedUtxos] Indicates it if should use (or not) the unconfirmed utxos
   * @param {boolean} [opts.returnInputs] Return the inputs used to build the tx
   * @param {function} cb Callback function in the standard form (err, result)
   * @return {Object} Returns object result
   */
  getSendMaxInfo(opts, cb) {
    opts = opts || {};

    const args = [];
    if (opts.feeLevel) args.push('feeLevel=' + opts.feeLevel);
    if (opts.feePerKb != null) args.push('feePerKb=' + opts.feePerKb);
    if (opts.excludeUnconfirmedUtxos) args.push('excludeUnconfirmedUtxos=1');
    if (opts.returnInputs) args.push('returnInputs=1');

    let qs = '';
    if (args.length > 0) qs = '?' + args.join('&');

    const url = '/v1/sendmaxinfo/' + qs;
    this.request.get(url, (err, result) => {
      if (err) return cb(err);
      return cb(null, result);
    });
  }

  /**
   * Returns gas limit estimate
   * @param {Object} opts Tx object
   * @param {function} cb Callback function in the standard form (err, gasLimit)
   * @return {number} Returns the gas limit
   */
  getEstimateGas(opts, cb) {
    var url = '/v3/estimateGas/';
    this.request.post(url, opts, (err, gasLimit) => {
      if (err) return cb(err);
      return cb(null, gasLimit);
    });
  }

  /**
   * Returns nonce
   * @param {Object} opts - chain, coin, network
   * @param {string} opts.chain EVM based chain or 'xrp'
   * @param {string} opts.network Network name (e.g. 'livenet', 'sepolia', etc.)
   * @param {string} opts.address Address to get nonce for
   * @param {function} cb Callback function in the standard form (err, nonce)
   * @return {number} Returns the nonce
   */
  getNonce(opts, cb) {
    $.checkArgument([...Constants.EVM_CHAINS, 'xrp'].includes(opts?.chain), 'Invalid chain: must be XRP or EVM based');
    $.checkArgument(opts?.network, 'Missing argument: network at <getNonce()>');
    $.checkArgument(opts?.address, 'Missing argument: address at <getNonce()>');

    const qs = [];
    qs.push(`coin=${opts.coin}`); // TODO Remove? opts.chain is enforced, so need to verify server's handling of coin vs chain
    qs.push(`chain=${opts.chain}`);
    qs.push(`network=${opts.network}`);

    const url = `/v1/nonce/${opts.address}?${qs.join('&')}`;
    this.request.get(url, (err, nonce) => {
      if (err) return cb(err);
      return cb(null, nonce);
    });
  }

  /**
   * Returns contract instantiation info. (All contract addresses instantiated by that sender with the current transaction hash and block number)
   * @param {Object} opts
   * @param {string} opts.sender Sender wallet address
   * @param {string} opts.coin Chain name. Default: 'eth'
   * @param {string} opts.txId Instantiation transaction id
   * @param {function} cb Callback function in the standard form (err, instantiationInfo)
   * @return {Object} Returns instantiation info object
   */
  getMultisigContractInstantiationInfo(opts, cb) {
    opts.network = this.credentials.network;
    this.request.post('/v1/multisig/', opts, (err, contractInstantiationInfo) => {
      if (err) return cb(err);
      return cb(null, contractInstantiationInfo);
    });
  }

  /**
   * Returns contract info
   * @param {Object} opts
   * @param {string} opts.multisigContractAddress MultiSig contract address
   * @param {string} opts.coin Chain name. Default: 'eth'
   * @param {function} cb Callback function in the standard form (err, contractInfo)
   * @return {Object} Returns contract info object (owners addresses and required number of confirmations)
   */
  getMultisigContractInfo(opts, cb) {
    var url = '/v1/multisig/info';
    opts.network = this.credentials.network;
    this.request.post(url, opts, (err, contractInfo) => {
      if (err) return cb(err);
      return cb(null, contractInfo);
    });
  }

  /**
   * Returns contract info
   * @param {Object} opts
   * @param {string} opts.tokenAddress Token contract address
   * @param {string} opts.chain Chain name. Default: 'eth'
   * @param {function} cb Callback function in the standard form (err, contractInfo)
   * @return {{ name, symbol, precision }} Returns contract info object
   */
  getTokenContractInfo(opts, cb) {
    var url = '/v1/token/info';
    opts.network = this.credentials.network;
    this.request.post(url, opts, (err, contractInfo) => {
      if (err) return cb(err);
      return cb(null, contractInfo);
    });
  }

  /**
   * Get wallet status based on a string identifier
   * @param {Object} opts
   * @param {string} opts.identifier The wallet identifier (one of: walletId, address, txid)
   * @param {boolean} [opts.includeExtendedInfo] Query extended status
   * @param {boolean} [opts.walletCheck] Run server-side walletCheck if wallet is found
   * @param {function} cb Callback function in the standard form (err, status)
   * @returns {Object} Returns an object with status information
   */
  getStatusByIdentifier(opts, cb) {
    $.checkState(this.credentials, 'Failed state: this.credentials at <getStatusByIdentifier()>');
    $.checkArugment(opts?.identifier, 'Missing argument: identifier at <getStatusByIdentifier()>');

    const qs = [];
    qs.push('includeExtendedInfo=' + (opts.includeExtendedInfo ? '1' : '0'));
    qs.push('walletCheck=' + (opts.walletCheck ? '1' : '0'));

    this.request.get('/v1/wallets/' + opts.identifier + '?' + qs.join('&'), (err, result) => {
      if (err || !result?.wallet) return cb(err);
      if (result.wallet.status == 'pending') {
        var c = this.credentials;
        result.wallet.secret = API._buildSecret(
          c.walletId,
          c.walletPrivKey,
          c.coin,
          c.network
        );
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
    } catch (e) { }
    return ret;
  }

  getWalletIdsFromOldCopay(username, password, blob): any[] {
    var p = this._oldCopayDecrypt(username, password, blob);
    if (!p) return null;
    var ids = p.walletIds.concat(Object.keys(p.focusedTimestamps));
    return Array.from(new Set(ids));
  }

  /**
   * Upgrade Credentials V1 to Key and Credentials V2 object
   * @param {Object} v1 Credentials V1 Object
   * @returns {{ key, credentials }}
   */
  static upgradeCredentialsV1(v1) {
    $.shouldBeObject(v1);

    if (
      v1.version != null ||
      (!v1.xPrivKey && !v1.xPrivKeyEncrypted && !v1.xPubKey)
    ) {
      throw new Error('Could not recognize old version');
    }

    let k;
    if (v1.xPrivKey || v1.xPrivKeyEncrypted) {
      k = new Key({ seedData: v1, seedType: 'objectV1' });
    } else {
      // RO credentials
      k = false;
    }

    const obsoleteFields = {
      version: true,
      xPrivKey: true,
      xPrivKeyEncrypted: true,
      hwInfo: true,
      entropySourcePath: true,
      mnemonic: true,
      mnemonicEncrypted: true
    };

    const c = new Credentials();
    for (const i of Credentials.FIELDS) {
      if (!obsoleteFields[i]) {
        c[i] = v1[i];
      }
    }
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

  /**
   * Upgrade multiple Credentials V1 to Keys and Credentials V2 objects
   * Duplicate keys will be identified and merged.
   * @param {Array<Object>} v1 Credentials V1 Object
   * @returns {{ keys, credentials }}
   */

  static upgradeMultipleCredentialsV1(v1: Credentials[]) {
    let newKeys = [];
    const newCrededentials: Credentials[] = [];
    // Try to migrate to Credentials 2.0
    for (const credentials of v1) {
      if (!credentials.version || credentials.version < 2) {
        log.info('About to migrate : ' + credentials.walletId);

        const migrated = API.upgradeCredentialsV1(credentials);
        newCrededentials.push(migrated.credentials);

        if (migrated.key) {
          log.info(`Wallet ${credentials.walletId} key's extracted`);
          newKeys.push(migrated.key);
        } else {
          log.info(`READ-ONLY Wallet ${credentials.walletId} migrated`);
        }
      }
    }

    if (newKeys.length > 0) {
      // Find and merge dup keys.
      const credGroups: { [key: string]: Credentials[] } = {};
      for (const x of newCrededentials) {
        $.checkState(x.xPubKey, 'Failed state: no xPubKey at credentials!');
        const xpub = new Bitcore.HDPublicKey(x.xPubKey);
        const fingerPrint = xpub.fingerPrint.toString('hex');
        credGroups[fingerPrint] = credGroups[fingerPrint] || [];
        credGroups[fingerPrint].push(x);
      }

      if (Object.keys(credGroups).length < newCrededentials.length) {
        log.info('Found some wallets using the SAME key. Merging...');

        const uniqIds = {};

        for (const credList of Object.values(credGroups)) {
          const toKeep = credList.shift();
          if (!toKeep.keyId) continue;
          uniqIds[toKeep.keyId] = true;

          if (!credList.length) continue;
          log.info(`Merging ${credList.length} keys to ${toKeep.keyId}`);
          for (const x of credList) {
            log.info(`\t${x.keyId} is now ${toKeep.keyId}`);
            x.keyId = toKeep.keyId;
          }
        }

        newKeys = newKeys.filter(x => uniqIds[x.id]);
      }
    }

    return {
      keys: newKeys,
      credentials: newCrededentials
    };
  }

  /**
   * Imports existing wallets against BWS and return key & clients[] for each account / coin
   * @param {Object} opts
   * @param {string} opts.words Mnemonic
   * @param {string} opts.xPrivKey Extended Private Key
   * @param {string} [opts.passphrase] Mnemonic's passphrase
   * @param {boolean} [opts.includeTestnetWallets] Include testnet wallets
   * @param {boolean} [opts.includeLegacyWallets] Search legacy wallets
   * @param {Object} clientOpts BWS connection options (see ClientAPI constructor)
   * @param {function} callback Callback function in the standard form (err, key, clients)
   * @returns {key, clients[]} Returns key, clients[]
   */
  static serverAssistedImport(opts, clientOpts, callback) {
    $.checkArgument(opts.words || opts.xPrivKey, 'Missing argument: words or xPrivKey at <serverAssistedImport()>');

    let client = clientOpts instanceof API ? API.clone(clientOpts) : new API(clientOpts);
    let includeTestnetWallets = opts.includeTestnetWallets;
    let includeLegacyWallets = opts.includeLegacyWallets;
    let credentials = [];
    let copayerIdAlreadyTested = {};
    let keyCredentialIndex = [];
    let clients = [];
    let k;
    let sets = [
      {
        // current wallets: /[44,48]/[0,145]'/
        nonCompliantDerivation: false,
        useLegacyCoinType: false,
        useLegacyPurpose: false
      }
    ];

    if (includeLegacyWallets) {
      const legacyOpts = [
        {
          // old bch wallets: /[44,48]/[0,0]'/
          nonCompliantDerivation: false,
          useLegacyCoinType: true,
          useLegacyPurpose: false
        },
        {
          // old BTC/BCH  multisig wallets: /[44]/[0,145]'/
          nonCompliantDerivation: false,
          useLegacyCoinType: false,
          useLegacyPurpose: true
        },
        {
          // old multisig BCH wallets: /[44]/[0]'/
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
      // @ts-ignore
      sets = sets.concat(legacyOpts);
    }

    const generateCredentials = (key, opts) => {
      let c = key.createCredentials(null, {
        coin: opts.coin,
        chain: opts.chain?.toLowerCase() || opts.coin, // chain === coin IS NO LONGER TRUE for Arbitrum, Base, Optimisim
        network: opts.network,
        account: opts.account,
        n: opts.n,
        use0forBCH: opts.use0forBCH, // only used for server assisted import
        algo: opts.algo
      });

      if (copayerIdAlreadyTested[c.copayerId + ':' + opts.n]) {
        return;
      } else {
        copayerIdAlreadyTested[c.copayerId + ':' + opts.n] = true;
      }

      keyCredentialIndex.push({ credentials: c, key, opts });
      credentials.push(c);
    };

    const checkKey = key => {
      let opts = [
        // coin, chain, network,  multisig
        ['btc', 'btc', 'livenet'],
        ['bch', 'bch', 'livenet'],
        ['bch', 'bch', 'livenet', false, true], // check for prefork bch wallet
        ['eth', 'eth', 'livenet'],
        ['matic', 'matic', 'livenet'],
        ['eth', 'arb', 'livenet'],
        ['eth', 'base', 'livenet'],
        ['eth', 'op', 'livenet'],
        ['xrp', 'xrp', 'livenet'],
        ['sol', 'sol', 'livenet'],
        ['doge', 'doge', 'livenet'],
        ['ltc', 'ltc', 'livenet'],
        ['btc', 'btc', 'livenet', true],
        ['bch', 'bch', 'livenet', true],
        ['doge', 'doge', 'livenet', true],
        ['ltc', 'ltc', 'livenet', true]
      ];
      if (key.use44forMultisig) {
        //  testing old multi sig
        opts = opts.filter(x => x[3]);
      }

      if (key.use0forBCH) {
        //  testing BCH, old coin=0 wallets
        opts = opts.filter(x => x[0] == 'bch');
      }

      if (!key.nonCompliantDerivation && includeTestnetWallets) {
        const testnet = JSON.parse(JSON.stringify(opts));
        for (const x of testnet) {
          x[2] = 'testnet';
        }
        opts = opts.concat(testnet);
      }
      if (key.nonCompliantDerivation) {
        //  leave only BTC, and no testnet
        opts = opts.filter(x => x[0] == 'btc');
      }

      for (let i = 0; i < opts.length; i++) {
        let opt = opts[i];
        let optsObj = {
          coin: opt[0],
          chain: opt[1],
          network: opt[2],
          account: 0,
          n: opt[3] ? 2 : 1,
          use0forBCH: opt[4],
          algo: opt[5],
        };
        generateCredentials(key, optsObj);
      }
    };

    const addWalletInfo = (combined, foundWallets, cb) => {
      async.each(
        combined,
        (item, cb2) => {
          let credentials = item.credentials;
          var wallet = item.status.wallet;
          client.fromString(credentials);
          client._processStatus(item.status);

          if (!credentials.hasWalletInfo()) {
            const me = (wallet.copayers || []).find(c => c.id === credentials.copayerId);
            if (!me) return cb2(null, new Error('Copayer not in wallet'));

            try {
              credentials.addWalletInfo(
                wallet.id,
                wallet.name,
                wallet.m,
                wallet.n,
                me.name,
                {}
              );
            } catch (e) {
              if (e.message) {
                log.info('Trying credentials...', e.message);
              }
              if (e.message && e.message.match(/Bad\snr/)) {
                return cb2(null, new Errors.WALLET_DOES_NOT_EXIST());
              }
            }
          }
          if (wallet.status != 'complete') return cb2(null, item);

          if (item.status.customData?.walletPrivKey) {
            credentials.addWalletPrivateKey(
              item.status.customData.walletPrivKey
            );
          }

          if (credentials.walletPrivKey) {
            if (!Verifier.checkCopayers(credentials, wallet.copayers)) {
              return cb2(null, new Errors.SERVER_COMPROMISED());
            }
          } else {
            // this should only happen in AIR-GAPPED flows
            log.warn(
              'Could not verify copayers key (missing wallet Private Key)'
            );
          }

          credentials.addPublicKeyRing(
            client._extractPublicKeyRing(wallet.copayers)
          );
          client.emit('walletCompleted', wallet);

          foundWallets.push(item);
          cb2();
        },
        err => {
          cb(err);
        }
      );
    };

    const getClientsFromWallets = (err, res) => {
      if (err) {
        return callback(err);
      }

      // marry all found wallets and keyCredentialIndex entries for simplicity
      let combined = keyCredentialIndex
        .map((x, i) => {
          if (res[i].success) {
            x.status = res[i].status;
            return x;
          }
        })
        .filter(x => x);

      let foundWallets = [];
      addWalletInfo(combined, foundWallets, err => {
        if (err) return callback(err);
        checkForOtherAccounts(foundWallets);
      });
    };

    const getNextBatch = (key, settings) => {
      let accountKeyCredentialIndex = [];
      let credBatch = [];
      // add potential wallet account credentials
      for (let i = 0; i < 5; i++) {
        settings.account++;
        const clonedSettings = JSON.parse(JSON.stringify(settings));
        let c = key.createCredentials(null, {
          coin: clonedSettings.coin, // base currency used for fees. Helpful for UI
          chain: clonedSettings.chain || clonedSettings.coin,
          network: clonedSettings.network,
          account: clonedSettings.account,
          n: clonedSettings.n,
          use0forBCH: opts.use0forBCH // only used for server assisted import
        });

        accountKeyCredentialIndex.push({
          credentials: c,
          key,
          opts: clonedSettings
        });
        credBatch.push(c);
      }
      return { credentials: credBatch, accountKeyCredentialIndex };
    };

    const checkForOtherAccounts = foundWallets => {
      let addtFoundWallets = [];
      async.each(
        foundWallets,
        (wallet, next2) => {
          k = wallet.key;
          let mostRecentResults = [{ success: true }];
          async.whilst(
            () => mostRecentResults.every(x => x.success),
            next => {
              let { credentials, accountKeyCredentialIndex } = getNextBatch(
                k,
                wallet.opts
              );
              client.bulkClient.getStatusAll(
                credentials,
                {
                  silentFailure: true,
                  twoStep: true,
                  includeExtendedInfo: true,
                  ignoreIncomplete: true
                },
                (err, response) => {
                  mostRecentResults = response;
                  let combined = accountKeyCredentialIndex
                    .map((x, i) => {
                      if (response[i].success) {
                        x.status = response[i].status;
                        return x;
                      }
                    })
                    .filter(x => x);
                  addWalletInfo(combined, addtFoundWallets, next);
                }
              );
            },
            err => {
              next2(err);
            }
          );
        },
        err => {
          if (err) return callback(err);
          const allWallets = foundWallets.concat(addtFoundWallets);
          // generate clients
          async.each(
            allWallets,
            async (wallet, next) => {
              if (
                wallet.opts.coin == 'btc' &&
                (wallet.status.wallet.addressType == 'P2WPKH' ||
                  wallet.status.wallet.addressType == 'P2WSH')
              ) {
                client.credentials.addressType =
                  wallet.status.wallet.n == 1
                    ? Constants.SCRIPT_TYPES.P2WPKH
                    : Constants.SCRIPT_TYPES.P2WSH;
              }
              if (wallet.opts.coin === 'btc' && wallet.status.wallet.addressType === 'P2TR') {
                client.credentials.addressType = Constants.SCRIPT_TYPES.P2TR;
              }
              // add client to list
              let newClient = client.toClone();
              // newClient.credentials = settings.credentials;
              newClient.fromString(wallet.credentials);
              clients.push(newClient);

              async function handleChainTokensAndMultisig(chain, tokenAddresses, multisigInfo, tokenOpts, tokenUrlPath) {
                // Handle importing of tokens
                if (tokenAddresses?.length) {
                  async function getNetworkTokensData() {
                    return new Promise((resolve, reject) => {
                      newClient.request.get(`/v1/service/oneInch/getTokens/${tokenUrlPath}`, (err, data) => {
                        if (err) return reject(err);
                        return resolve(data);
                      });
                    });
                  }

                  let customTokensData;
                  try {
                    customTokensData = await getNetworkTokensData();
                  } catch (error) {
                    log.warn(`getNetworkTokensData err for ${chain}`, error);
                    customTokensData = null;
                  }

                  for (const t of tokenAddresses) {
                    const token = tokenOpts[t] || (customTokensData && customTokensData[t]);
                    if (!token) {
                      log.warn(`Token ${t} unknown on ${chain}`);
                      continue;
                    }
                    log.info(`Importing token: ${token.name} on ${chain}`);
                    const tokenCredentials = newClient.credentials.getTokenCredentials(token, chain);
                    const tokenClient = newClient.toClone();
                    tokenClient.credentials = tokenCredentials;
                    clients.push(tokenClient);
                  }
                }

                // Handle importing of multisig wallets
                for (const info of (multisigInfo || [])) {
                  log.info(`Importing multisig wallet on ${chain}. Address: ${info.multisigContractAddress} - m: ${info.m} - n: ${info.n}`);
                  const multisigCredentials = newClient.credentials.getMultisigEthCredentials({
                    walletName: info.walletName,
                    multisigContractAddress: info.multisigContractAddress,
                    n: info.n,
                    m: info.m
                  });
                  let multisigClient = newClient.toClone();
                  multisigClient.credentials = multisigCredentials;
                  clients.push(multisigClient);

                  const multisigTokenAddresses = info.tokenAddresses || [];
                  for (const t of multisigTokenAddresses) {
                    const token = tokenOpts[t];
                    if (!token) {
                      log.warn(`Token ${t} unknown in multisig on ${chain}`);
                      continue;
                    }
                    log.info(`Importing multisig token: ${token.name} on ${chain}`);
                    const tokenCredentials = multisigClient.credentials.getTokenCredentials(token, chain);
                    const tokenClient = multisigClient.toClone();
                    tokenClient.credentials = tokenCredentials;
                    clients.push(tokenClient);
                  }
                }
              }

              const chainConfigurations = [
                { chain: 'eth', tokenAddresses: wallet.status.preferences.tokenAddresses, multisigInfo: wallet.status.preferences.multisigEthInfo, tokenOpts: Constants.ETH_TOKEN_OPTS, tokenUrlPath: 'eth' },
                { chain: 'matic', tokenAddresses: wallet.status.preferences.maticTokenAddresses, multisigInfo: wallet.status.preferences.multisigMaticInfo, tokenOpts: Constants.MATIC_TOKEN_OPTS, tokenUrlPath: 'matic' },
                { chain: 'arb', tokenAddresses: wallet.status.preferences.arbTokenAddresses, multisigInfo: wallet.status.preferences.multisigArbInfo, tokenOpts: Constants.ARB_TOKEN_OPTS, tokenUrlPath: 'arb' },
                { chain: 'op', tokenAddresses: wallet.status.preferences.opTokenAddresses, multisigInfo: wallet.status.preferences.multisigOpInfo, tokenOpts: Constants.OP_TOKEN_OPTS, tokenUrlPath: 'op' },
                { chain: 'base', tokenAddresses: wallet.status.preferences.baseTokenAddresses, multisigInfo: wallet.status.preferences.multisigBaseInfo, tokenOpts: Constants.BASE_TOKEN_OPTS, tokenUrlPath: 'base' },
                { chain: 'sol', tokenAddresses: wallet.status.preferences.solTokenAddresses, multisigInfo: wallet.status.preferences.multisigSolInfo, tokenOpts: Constants.SOL_TOKEN_OPTS, tokenUrlPath: 'sol' },
              ];

              for (let config of chainConfigurations) {
                await handleChainTokensAndMultisig(config.chain, config.tokenAddresses, config.multisigInfo, config.tokenOpts, config.tokenUrlPath);
              }
              next();
            },
            err => {
              if (err) return callback(err);
              return callback(null, k, clients);
            }
          );
        }
      );
    };

    let id = Uuid.v4();
    for (let i = 0; i < sets.length; i++) {
      let set: any = sets[i];
      try {
        if (opts.words) {
          if (opts.passphrase) {
            set.passphrase = opts.passphrase;
          }

          k = new Key({ id, seedData: opts.words, seedType: 'mnemonic', ...set });
        } else {
          k = new Key({
            id,
            seedData: opts.xPrivKey,
            seedType: 'extendedPrivateKey',
            ...set
          });
        }
      } catch (e) {
        log.info('Backup error:', e);
        return callback(new Errors.INVALID_BACKUP());
      }
      checkKey(k);
    }

    // send batched calls to server
    client.bulkClient.getStatusAll(
      credentials,
      {
        silentFailure: true,
        twoStep: true,
        includeExtendedInfo: true,
        ignoreIncomplete: true
      },
      getClientsFromWallets
    );
  }

  banxaGetQuote(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/banxa/quote', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  banxaCreateOrder(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/banxa/createOrder', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  moonpayGetQuote(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/moonpay/quote', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  moonpayGetSellQuote(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/moonpay/sellQuote', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  moonpayGetSignedPaymentUrl(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post(
        '/v1/service/moonpay/signedPaymentUrl',
        data,
        (err, data) => {
          if (err) return reject(err);
          return resolve(data);
        }
      );
    });
  }

  moonpayGetSellSignedPaymentUrl(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post(
        '/v1/service/moonpay/sellSignedPaymentUrl',
        data,
        (err, data) => {
          if (err) return reject(err);
          return resolve(data);
        }
      );
    });
  }

  moonpayCancelSellTransaction(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/moonpay/cancelSellTransaction', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  rampGetQuote(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/ramp/quote', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  rampGetSellQuote(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/ramp/sellQuote', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  rampGetSignedPaymentUrl(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post(
        '/v1/service/ramp/signedPaymentUrl',
        data,
        (err, data) => {
          if (err) return reject(err);
          return resolve(data);
        }
      );
    });
  }

  sardineGetQuote(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/sardine/quote', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  sardineGetToken(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/sardine/getToken', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  simplexGetQuote(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/simplex/quote', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  simplexGetSellQuote(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/simplex/sellQuote', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  simplexPaymentRequest(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post(
        '/v1/service/simplex/paymentRequest',
        data,
        (err, data) => {
          if (err) return reject(err);
          return resolve(data);
        }
      );
    });
  }

  simplexSellPaymentRequest(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post(
        '/v1/service/simplex/sellPaymentRequest',
        data,
        (err, data) => {
          if (err) return reject(err);
          return resolve(data);
        }
      );
    });
  }

  simplexGetEvents(data): Promise<any> {
    return new Promise((resolve, reject) => {
      let qs = [];
      qs.push('env=' + data.env);

      this.request.get(
        '/v1/service/simplex/events/?' + qs.join('&'),
        (err, data) => {
          if (err) return reject(err);
          return resolve(data);
        }
      );
    });
  }

  thorswapGetSwapQuote(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/thorswap/getSwapQuote', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  transakGetAccessToken(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/transak/getAccessToken', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  transakGetQuote(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/transak/quote', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  transakGetSignedPaymentUrl(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/transak/signedPaymentUrl', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }

  wyreWalletOrderQuotation(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post(
        '/v1/service/wyre/walletOrderQuotation',
        data,
        (err, data) => {
          if (err) return reject(err);
          return resolve(data);
        }
      );
    });
  }

  wyreWalletOrderReservation(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post(
        '/v1/service/wyre/walletOrderReservation',
        data,
        (err, data) => {
          if (err) return reject(err);
          return resolve(data);
        }
      );
    });
  }

  changellyGetPairsParams(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post(
        '/v1/service/changelly/getPairsParams',
        data,
        (err, data) => {
          if (err) return reject(err);
          return resolve(data);
        }
      );
    });
  }

  changellyGetFixRateForAmount(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post(
        '/v1/service/changelly/getFixRateForAmount',
        data,
        (err, data) => {
          if (err) return reject(err);
          return resolve(data);
        }
      );
    });
  }

  changellyCreateFixTransaction(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post(
        '/v1/service/changelly/createFixTransaction',
        data,
        (err, data) => {
          if (err) return reject(err);
          return resolve(data);
        }
      );
    });
  }

  oneInchGetSwap(data): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.post('/v1/service/oneInch/getSwap', data, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  }
}
