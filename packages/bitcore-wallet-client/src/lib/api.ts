'use strict';

import async from 'async';
import Mnemonic from 'bitcore-mnemonic';
import * as CWC from 'crypto-wallet-core';
import { EventEmitter } from 'events';
import { singleton } from 'preconditions';
import querystring from 'querystring';
import * as Uuid from 'uuid';
import { BulkClient } from './bulkclient';
import { Constants, Encryption, Utils } from './common';
import { Credentials } from './credentials';
import { Errors } from './errors';
import { Key, PasswordMaybe } from './key';
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
  doNotVerifyPayPro: boolean;
  timeout: any;
  logLevel: string;
  supportStaffWalletId: string;
  request: Request;
  bulkClient: BulkClient;
  credentials: Credentials;
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
  static Encryption = Encryption;
  static errors = Errors;

  // Expose bitcore
  static Bitcore = CWC.BitcoreLib;
  static BitcoreCash = CWC.BitcoreLibCash;
  static BitcoreDoge = CWC.BitcoreLibDoge;
  static BitcoreLtc = CWC.BitcoreLibLtc;

  /**
   * ClientAPI constructor.
   * @param {object} [opts]
   * @param {boolean} [opts.doNotVerifyPayPro]
   * @param {number} [opts.timeout] Default: 50000
   * @param {string} [opts.logLevel] Default: 'silent'
   * @param {string} [opts.supportStaffWalletId]
   * @param {string} [opts.baseUrl] Default: 'http://localhost:3232/bws/api'
   * @param {object} [opts.request] Request library instance
   * @param {string} [opts.bp_partner] PayPro BitPay Partner
   * @param {string} [opts.bp_partner_version] PayPro BitPay Partner version
   */
  constructor(opts?: {
    /**
     * The base URL for the Bitcore Wallet Service API.
     * @default 'http://localhost:3232/bws/api'
     */
    baseUrl?: string;
    /**
     * Do not verify PayPro responses
     */
    doNotVerifyPayPro?: boolean;
    /**
     * Timeout for requests in milliseconds
     * @default 50000
     */
    timeout?: number;
    /**
     * Logging level for the client API.
     * @default 'silent'
     */
    logLevel?: string;
    /**
     * Support agent's wallet ID
     */
    supportStaffWalletId?: string;
    /**
     * Request library instance to use for API calls.
     * For testing only to pass a mock request object.
     */
    request?: Request;
    /**
     * PayPro BitPay Partner
     */
    bp_partner?: string;
    /**
     * PayPro BitPay Partner version
     */
    bp_partner_version?: string;
  }) {
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

  async initialize(
    opts,
    /** @deprecated */
    cb?: (err?: Error) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: initialize will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials, 'Failed state: this.credentials at <initialize()>');

      this.notificationIncludeOwn = !!opts.notificationIncludeOwn;
      this._initNotifications(opts);
      if (cb) { cb(); }
      return this;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  async dispose(
    /** @deprecated */
    cb?: (err?: Error) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: dispose will remove callback support in the future.');
    }
    try {
      this._disposeNotifications();
      await this.request.logout();
      if (cb) { cb(); }
      return;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  async _fetchLatestNotifications(
    interval: number,
    /** @deprecated */
    cb?: (err?: Error) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: _fetchLatestNotifications will remove callback support in the future.');
    }
    try {
      const opts = {
        lastNotificationId: this.lastNotificationId,
        includeOwn: this.notificationIncludeOwn,
        timeSpan: undefined
      };

      if (!this.lastNotificationId) {
        opts.timeSpan = interval + 1;
      }

      const notifications = await this.getNotifications(opts).catch(err => {
        log.warn('Error receiving notifications.');
        log.debug(err);
        throw err;
      });

      if (notifications.length > 0) {
        this.lastNotificationId = notifications.slice(-1)[0].id;
      }

      for (const notification of notifications) {
        this.emit('notification', notification);
      }
      if (cb) { cb(); }
      return;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
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
   */
  setNotificationsInterval(
    /** Use 0 to pause notifications */
    notificationIntervalSeconds: number
  ) {
    this._disposeNotifications();
    if (notificationIntervalSeconds > 0) {
      this._initNotifications({ notificationIntervalSeconds });
    }
  }

  getRootPath() {
    return this.credentials.getRootPath();
  }

  /**
   * Encrypt a message
   * @private
   */
  static _encryptMessage(message: string, encryptingKey: string) {
    if (!message) return null;
    return Utils.encryptMessage(message, encryptingKey);
  }

  _processTxNotes(notes: Note | Array<Note>) {
    if (!notes) return;
    if (!Array.isArray(notes)) {
      notes = [notes];
    }

    const encryptingKey = this.credentials.sharedEncryptingKey;
    for (const note of notes) {
      note.encryptedBody = note.body;
      note.body = Utils.decryptMessageNoThrow(note.body, encryptingKey);
      note.encryptedEditedByName = note.editedByName;
      note.editedByName = Utils.decryptMessageNoThrow(note.editedByName, encryptingKey);
    }
  }

  /**
   * Decrypt text fields in transaction proposals
   * @private
   */
  _processTxps(txps: Txp | Array<Txp>) {
    if (!txps) return;
    if (!Array.isArray(txps)) {
      txps = [txps];
    }

    const encryptingKey = this.credentials.sharedEncryptingKey;
    for (const txp of txps) {
      txp.encryptedMessage = txp.message;
      txp.message = Utils.decryptMessageNoThrow(txp.message, encryptingKey) || null;
      txp.creatorName = Utils.decryptMessageNoThrow(txp.creatorName, encryptingKey);

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

  validateKeyDerivation(
    opts?: {
      skipDeviceValidation?: boolean;
    },
    /** @deprecated */
    cb?: (err?: Error, keyDerivationOk?: boolean) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: validateKeyDerivation will remove callback support in the future.');
    }
    try {
      opts = opts || {};

      const testMessageSigning = (xpriv, xpub) => {
        const nonHardenedPath = 'm/0/0';
        const message = 'Lorem ipsum dolor sit amet, ne amet urbanitas percipitur vim, libris disputando his ne, et facer suavitate qui. Ei quidam laoreet sea. Cu pro dico aliquip gubergren, in mundi postea usu. Ad labitur posidonium interesset duo, est et doctus molestie adipiscing.';
        const priv = xpriv.deriveChild(nonHardenedPath).privateKey;
        const signature = Utils.signMessage(message, priv);
        const pub = xpub.deriveChild(nonHardenedPath).publicKey;
        return Utils.verifyMessage(message, signature, pub);
      };

      const testHardcodedKeys = () => {
        const words = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
        let xpriv = Mnemonic(words).toHDPrivateKey();

        if (xpriv.toString() !== 'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu')
          return false;

        xpriv = xpriv.deriveChild("m/44'/0'/0'");
        if (xpriv.toString() !== 'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb')
          return false;

        const xpub = Bitcore.HDPublicKey.fromString('xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj');
        return testMessageSigning(xpriv, xpub);
      };

      const hardcodedOk = opts.skipDeviceValidation ? true : testHardcodedKeys();
      const _deviceValidated = !opts.skipDeviceValidation;

      // TODO
      //  var liveOk = (c.canSign() && !c.isPrivKeyEncrypted()) ? testLiveKeys() : true;
      this.keyDerivationOk = hardcodedOk; // && liveOk;

      if (cb) { cb(null, this.keyDerivationOk); }
      return this.keyDerivationOk;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
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

  decryptBIP38PrivateKey(
    encryptedPrivateKeyBase58,
    passphrase,
    progressCallback,
    /** @deprecated */
    cb?: (err?: Error, privateKeyWif?: string) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: decryptBIP38PrivateKey will remove callback support in the future.');
    }
    try {
      const Bip38 = require('bip38');
      const bip38 = new Bip38();

      let privateKeyWif;
      try {
        privateKeyWif = bip38.decrypt(encryptedPrivateKeyBase58, passphrase, progressCallback);
      } catch (ex) {
        throw new Error('Could not decrypt BIP38 private key' + ex);
      }

      const privateKey = new Bitcore.PrivateKey(privateKeyWif);
      const address = privateKey.publicKey.toAddress().toString();
      const addrBuff = Buffer.from(address, 'ascii');
      const actualChecksum = Bitcore.crypto.Hash.sha256sha256(addrBuff)
        .toString('hex')
        .substring(0, 8);
      const expectedChecksum = Bitcore.encoding.Base58Check.decode(
        encryptedPrivateKeyBase58
      )
        .toString('hex')
        .substring(6, 14);

      if (actualChecksum != expectedChecksum)
        throw new Error('Incorrect passphrase');

      if (cb) { cb(null, privateKeyWif); }
      return privateKeyWif;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  async getBalanceFromPrivateKey(
    privateKey: string | CWC.BitcoreLib.PrivateKey,
    chain: string,
    /** @deprecated */
    cb?: (err?: Error, balance?: number) => void
  ) {
    if (typeof chain === 'function') {
      cb = chain;
      chain = 'btc';
    }
    if (cb) {
      log.warn('DEPRECATED: getBalanceFromPrivateKey will remove callback support in the future.');
    }
    try {
      const B = Bitcore_[chain];
      privateKey = new B.PrivateKey(privateKey);
      const address = privateKey.publicKey.toAddress().toString(true);

      const utxos = await this.getUtxos({ addresses: address });
      const balance = (utxos || []).reduce((sum, u) => sum += u.satoshis, 0)
      if (cb) { cb(null, balance); }
      return balance;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  async buildTxFromPrivateKey(
    privateKey: string | CWC.BitcoreLib.PrivateKey,
    destinationAddress: string,
    opts?: {
      chain?: string;
      /** In satoshis */
      fee?: number;
      /** Default: 'ecdsa' */
      signingMethod?: 'ecdsa' | 'schnorr';
      /** @deprecated For backwards compatibility, use `chain` instead */
      coin?: string;
    },
    /** @deprecated */
    cb?: (err?: Error, tx?: CWC.BitcoreLib.Transaction) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: buildTxFromPrivateKey will remove callback support in the future.');
    }
    try {
      opts = opts || {};

      const chain = opts.chain?.toLowerCase() || Utils.getChain(opts.coin); // getChain -> backwards compatibility
      const signingMethod = opts.signingMethod || 'ecdsa';

      if (!Constants.CHAINS.includes(chain))
        throw new Error('Invalid chain');

      if (Constants.EVM_CHAINS.includes(chain))
        throw new Error('EVM based chains not supported for this action');

      const B = Bitcore_[chain];
      privateKey = B.PrivateKey(privateKey);
      const address = privateKey.publicKey.toAddress().toString(true);

      const utxos = await this.getUtxos({ addresses: address });
      if (!Array.isArray(utxos) || utxos.length == 0)
        throw new Error('No utxos found');

      const fee = opts.fee || 10000;
      const utxoSum = (utxos || []).reduce((sum, u) => sum += u.satoshis, 0);
      const amount = utxoSum - fee;
      if (amount <= 0) throw new Errors.INSUFFICIENT_FUNDS();

      try {
        const toAddress = B.Address.fromString(destinationAddress);
        const tx = new B.Transaction()
          .from(utxos)
          .to(toAddress, amount)
          .fee(fee)
          .sign(privateKey, undefined, signingMethod);

        // Make sure the tx can be serialized
        tx.serialize();
        if (cb) { cb(null, tx); }
        return tx;
      } catch (ex) {
        log.error('Could not build transaction from private key', ex);
        throw new Errors.COULD_NOT_BUILD_TRANSACTION();
      }
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Open a wallet and try to complete the public key ring.
   */
  async openWallet(
    opts?: {
      useNativeSegwit?: boolean;
      segwitVersion?: number;
      tssKeyid?: string;
      allowOverwrite?: boolean;
    },
    /** @deprecated */
    cb?: (err?: Error, status?: any) => void
  ) {
    try {
      if (typeof opts === 'function') {
        cb = opts as (err?: Error, status?: any) => void;
        opts = null;
      }
      if (cb) {
        log.warn('DEPRECATED: openWallet will remove callback support in the future.');
      }
      opts = opts || {};

      $.checkState(this.credentials, 'Failed state: this.credentials at <openWallet()>');
      if (this.credentials.isComplete() && this.credentials.hasWalletInfo()) {
        if (cb) { cb(null, true); }
        return true; // ?? TODO: should return status?
      }

      const { body: status } = await this.request.get('/v3/wallets/?includeExtendedInfo=1&serverMessageArray=1');
      const wallet = status.wallet;
      this._processStatus(status);

      if (!this.credentials.hasWalletInfo()) {
        const me = (wallet.copayers || []).find(c => c.id === this.credentials.copayerId);
        if (!me) throw new Error('Copayer not in wallet');

        try {
          this.credentials.addWalletInfo(
            wallet.id,
            wallet.name,
            wallet.m,
            wallet.n,
            me.name,
            { ...opts, tssKeyId: wallet.tssKeyId }
          );
        } catch (e) {
          if (e.message) {
            log.info('Trying credentials...', e.message);
          }
          if (e.message && e.message.match(/Bad\snr/)) {
            throw new Errors.WALLET_DOES_NOT_EXIST();
          }
          throw e;
        }
      }
      if (wallet.status != 'complete') {
        if (cb) { cb(null, status); }
        return status;
      }

      if (this.credentials.walletPrivKey) {
        if (!Verifier.checkCopayers(this.credentials, wallet.copayers, { isTss: !!wallet.tssKeyId })) {
          throw new Errors.SERVER_COMPROMISED();
        }
      } else {
        // this should only happen in AIR-GAPPED flows
        log.warn('Could not verify copayers key (missing wallet Private Key)');
      }

      this.credentials.addPublicKeyRing(
        this._extractPublicKeyRing(wallet.copayers)
      );
      this.emit('walletCompleted', wallet);

      if (cb) { cb(null, status); }
      return status;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
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
    const acceptedActions = (txp.actions || []).filter(a => a.type === 'accept');

    return acceptedActions.map(x => ({
      signatures: x.signatures,
      xpub: x.xpub
    }));
  }

  _addSignaturesToBitcoreTxBitcoin(txp, t, signatures, xpub) {
    $.checkState(txp.coin, 'Failed state: txp.coin undefined at _addSignaturesToBitcoreTxBitcoin');
    $.checkState(txp.signingMethod, 'Failed state: txp.signingMethod undefined at _addSignaturesToBitcoreTxBitcoin');

    const chain = txp.chain?.toLowerCase() || Utils.getChain(txp.coin); // getChain -> backwards compatibility
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
    $.checkState(txp.status == 'accepted', 'Failed state: txp.status at _applyAllSignatures');

    const sigs = this._getCurrentSignatures(txp);
    for (const x of sigs) {
      this._addSignaturesToBitcoreTx(txp, t, x.signatures, x.xpub);
    }
  }

  /**
   * Join a multisig wallet
   * @private
   */
  async _doJoinWallet(
    walletId: string,
    walletPrivKey: string,
    xPubKey: string,
    requestPubKey: string,
    copayerName: string,
    opts?: {
      customData?: any;
      coin?: string;
      chain?: string;
      hardwareSourcePublicKey?: string;
      clientDerivedPublicKey?: string;
      dryRun?: boolean;
      supportBIP44AndP2PKH?: boolean;
    },
  ) {
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
    const { body } = await this.request.post(url, args);
    this._processWallet(body.wallet);
    return body.wallet;
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
   * @param {function} [cb] DEPRECATED: Callback function in the standard form (err, levels)
   * @returns {object} An object with fee level information
   */
  async getFeeLevels(
    chain,
    network,
    /** @deprecated */
    cb?: (err?: Error, levels?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getFeeLevels will remove callback support in the future.');
    }

    try {
      $.checkArgument(chain || Constants.CHAINS.includes(chain));
      $.checkArgument(network || ['livenet', 'testnet'].includes(network));

      const { body: result } = await this.request.get(`/v2/feelevels/?coin=${chain || 'btc'}&network=${network || 'livenet'}`);
      if (cb) { cb(null, result); }
      return result;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  async clearCache(
    opts?: {
      tokenAddress?: string;
    },
    /** @deprecated */
    cb?: (err?: Error, res?: any) => void
  ) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    if (cb) {
      log.warn('DEPRECATED: clearCache will remove callback support in the future.');
    }
    try {
      const qs = opts.tokenAddress ? `tokenAddress=${opts.tokenAddress}` : null;
      const { body: result } = await this.request.post('/v1/clearcache/' + (qs ? '?' + qs : ''), {});
      if (cb) { cb(null, result); }
      return result;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get service version
   */
  async getVersion(
    /** @deprecated */
    cb?: (err?: Error, version?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getVersion will remove callback support in the future.');
    }
    try {
      const { body: version } = await this.request.get<number>('/v1/version/');
      if (cb) { cb(null, version); }
      return version;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
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
   */
  async createWallet(
    /** The wallet name */
    walletName: string,
    /** The copayer name */
    copayerName: string,
    /** The required number of signatures */
    m: number,
    /** The total number of copayers */
    n: number,
    /** Options for creating the wallet */
    opts?: CreateWalletOpts,
    /**
     * @deprecated
     */
    cb?: (err?: Error, secret?: string, wallet?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: createWallet will remove callback support in the future.');
    }
    try {
      if (!this._checkKeyDerivation())
        throw new Error('Cannot create new wallet');

      if (opts) $.shouldBeObject(opts);
      opts = opts || {};

      const chain = opts.chain?.toLowerCase() || opts.coin || 'btc';
      const coin = opts.coin || chain;
      const network = opts.network || 'livenet';

      // checking in chains for simplicity
      if (!Constants.CHAINS.includes(chain))
        throw new Error('Invalid chain');

      if (!['testnet', 'livenet', 'regtest'].includes(network))
        throw new Error('Invalid network: ' + network);

      if (!this.credentials) {
        throw new Error('Import credentials first with setCredentials()');
      }

      if (coin != this.credentials.coin) {
        throw new Error('Existing keys were created for a different coin');
      }

      if (network != this.credentials.network) {
        throw new Error('Existing keys were created for a different network');
      }

      // Note: this is NOT the main wallet private key.
      // This is a throw-away key for the multisig join secret
      // and is not used beyond the initial joining of the wallet.
      const walletPrivKey = opts.walletPrivKey || new Bitcore.PrivateKey();

      const c = this.credentials;
      c.addWalletPrivateKey(walletPrivKey.toString());
      const encWalletName = Utils.encryptMessage(walletName, c.sharedEncryptingKey);

      const args = {
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
        clientDerivedPublicKey: c.clientDerivedPublicKey,
        tssVersion: opts.tssVersion,
        tssKeyId: opts.tssKeyId
      };
      const { body: res } = await this.request.post('/v2/wallets/', args);

      const walletId = res.walletId;
      c.addWalletInfo(walletId, walletName, m, n, copayerName, {
        useNativeSegwit: opts.useNativeSegwit,
        segwitVersion: opts.segwitVersion,
        allowOverwrite: !!opts.tssKeyId,
      });
      const secret = API._buildSecret(
        c.walletId,
        c.walletPrivKey,
        c.coin,
        c.network
      );

      const wallet = await this._doJoinWallet(
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
        }
      );

      if (c.isComplete()) {
        this.emit('walletCompleted', wallet);
      }

      const retval = {
        wallet,
        secret: n > 1 ? secret : null
      };
      if (cb) { cb(null, n > 1 ? secret : null, wallet); }
      return retval;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Join an existent wallet
   */
  async joinWallet(
    /** The wallet join secret */
    secret: string,
    /** The copayer name */
    copayerName: string,
    opts?: {
      /** The expected coin for this wallet. Usually same as `chain` except on L2 chains when the base currency is different. Default: btc */
      coin?: string;
      /** The expected chain for this wallet (e.g. btc, bch, eth, arb). Default: btc */
      chain?: string;
      /** Simulate wallet join. Default: false */
      dryRun?: boolean;
    },
    /**
     * @deprecated
     */
    cb?: (err?: Error, wallet?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: joinWallet will remove callback support in the future.');
    }

    try {
      if (!this._checkKeyDerivation()) throw new Error('Cannot join wallet');

      opts = opts || {};

      const coin = opts.coin || 'btc';
      const chain = opts.chain || coin;

      if (!Constants.CHAINS.includes(chain))
        throw new Error('Invalid chain');

      const secretData = API.parseSecret(secret);

      if (!this.credentials) {
        throw new Error('Import credentials first with setCredentials()');
      }

      this.credentials.addWalletPrivateKey(secretData.walletPrivKey.toString());
      const wallet = await this._doJoinWallet(
        secretData.walletId,
        secretData.walletPrivKey,
        this.credentials.xPubKey,
        this.credentials.requestPubKey,
        copayerName,
        {
          coin,
          chain,
          dryRun: !!opts.dryRun
        }
      );
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
      if (cb) { cb(null, wallet); }
      return wallet;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Recreates a wallet, given credentials (with wallet id)
   */
  async recreateWallet(
    /** @deprecated */
    cb?: (err?: Error) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: recreateWallet will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials, 'Failed state: this.credentials at <recreateWallet()>');
      $.checkState(this.credentials.isComplete());
      $.checkState(this.credentials.walletPrivKey);

      // First: Try to get the wallet with current credentials
      try {
        await this.getStatus({ includeExtendedInfo: true });
        // No error? -> Wallet is ready.
        log.info('Wallet is already created');
        if (cb) { cb(); }
        return;
      } catch {}

      const c = this.credentials;
      const walletPrivKey = Bitcore.PrivateKey.fromString(c.walletPrivKey);
      const useNativeSegwit = Utils.isNativeSegwit(c.addressType);
      const segwitVersion = Utils.getSegwitVersion(c.addressType);
      const supportBIP44AndP2PKH = c.derivationStrategy != Constants.DERIVATION_STRATEGIES.BIP45;
      const encWalletName = Utils.encryptMessage(c.walletName || 'recovered wallet', c.sharedEncryptingKey);
      let walletId = c.walletId;

      const args = {
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

      const { body } = await this.request.post('/v2/wallets/', args).catch(err => {
        // return all errors. Can't call addAccess.
        log.info('openWallet error' + err);
        throw new Errors.WALLET_DOES_NOT_EXIST();
      });

      if (!walletId) {
        walletId = body.walletId;
      }

      let i = 1;
      const opts = {
        coin: c.coin,
        chain: c.chain
      };
      if (!!supportBIP44AndP2PKH)
        opts['supportBIP44AndP2PKH'] = supportBIP44AndP2PKH;

      for (const item of this.credentials.publicKeyRing) {
        try {
          const name = item.copayerName || 'copayer ' + i++;
          await this._doJoinWallet(
            walletId,
            walletPrivKey,
            item.xPubKey,
            item.requestPubKey,
            name,
            opts,
          );
        } catch (err) {
          // Ignore error if copayer is already in wallet
          if (!(err instanceof Errors.COPAYER_IN_WALLET))
            throw err
        }
      }
      if (cb) { cb(); }
      return;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  _processWallet(wallet) {
    const encryptingKey = this.credentials.sharedEncryptingKey;

    let name = Utils.decryptMessageNoThrow(wallet.name, encryptingKey);
    if (name != wallet.name) {
      wallet.encryptedName = wallet.name;
    }
    wallet.name = name;
    for (const copayer of wallet.copayers || []) {
      name = Utils.decryptMessageNoThrow(copayer.name, encryptingKey);
      if (name != copayer.name) {
        copayer.encryptedName = copayer.name;
      }
      copayer.name = name;
      for (const access of copayer.requestPubKeys || []) {
        if (!access.name) continue;

        name = Utils.decryptMessageNoThrow(access.name, encryptingKey);
        if (name != access.name) {
          access.encryptedName = access.name;
        }
        access.name = name;
      }
    }
  }

  _processStatus(status) {
    const copayers = status.wallet.copayers;
    if (copayers) {
      const me = copayers.find(c => c.id === this.credentials.copayerId);
      if (me?.customData) {
        let customData;
        try {
          customData = JSON.parse(Utils.decryptMessage(me.customData, this.credentials.personalEncryptingKey));
        } catch (e) {
          log.warn('Could not decrypt customData:', me.customData);
        }
        if (customData) {
          // Add it to result
          status.customData = customData;

          // Update walletPrivateKey
          if (!this.credentials.walletPrivKey && customData.walletPrivKey) {
            this.credentials.addWalletPrivateKey(customData.walletPrivKey);
          }
        }
      }
    };

    this._processWallet(status.wallet);
    this._processTxps(status.pendingTxps);
  }

  /**
   * Get latest notifications
   * @returns {Array<any>} Returns an array of notifications
   */
  async getNotifications(
    opts?: {
      /** The ID of the last received notification */
      lastNotificationId?: string;
      /** A time window on which to look for notifications (in seconds) */
      timeSpan?: string;
      /** Include notifications generated by the current copayer */
      includeOwn?: boolean;
    },
    /** @deprecated */
    cb?: (err?: Error, notifications?: any[]) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getNotifications will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials, 'Failed state: this.credentials at <getNotifications()>');

      opts = opts || {};

      let url = '/v1/notifications/';
      if (opts.lastNotificationId) {
        url += '?notificationId=' + opts.lastNotificationId;
      } else if (opts.timeSpan) {
        url += '?timeSpan=' + opts.timeSpan;
      }

      let { body: result } = await this.request.getWithLogin(url);
      result = result || [];
      const notifications = opts.includeOwn ? result : result.filter(notification => notification.creatorId != this.credentials.copayerId);
      if (cb) { cb(null, notifications); }
      return notifications;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get status of the wallet
   */
  async getStatus(
    opts?: {
      /** Use 2-step balance computation for improved performance. Default: false */
      twoStep?: boolean;
      /** Query extended status. Default: false */
      includeExtendedInfo?: boolean;
      /** ERC20 Token Contract Address */
      tokenAddress?: string;
      /** MULTISIG ETH Contract Address */
      multisigContractAddress?: string;
    },
    /** @deprecated */
    cb?: (err?: Error, status?: Status) => void
  ): Promise<Status> {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    if (cb) {
      log.warn('DEPRECATED: getStatus will remove callback support in the future.');
    }

    try {
      $.checkState(this.credentials, 'Failed state: this.credentials at <getStatus()>');
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

      const { body } = await this.request.get('/v3/wallets/?' + qs.join('&'));
      if (body.wallet.status == 'pending') {
        var c = this.credentials;
        body.wallet.secret = API._buildSecret(
          c.walletId,
          c.walletPrivKey,
          c.coin,
          c.network
        );
      }

      this._processStatus(body);

      if (cb) { cb(null, body); }
      return body;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get copayer preferences
   */
  async getPreferences(
    /** @deprecated */
    cb?: (err?: Error, preferences?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getPreferences will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials, 'Failed state: this.credentials at <getPreferences()>');

      const { body: preferences } = await this.request.get('/v1/preferences/');
      if (cb) { cb(null, preferences); }
      return preferences;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Save copayer preferences
   */
  async savePreferences(
    /** Preferences to be saved */
    preferences: any, // TODO: define type
    /** @deprecated */
    cb?: (err?: Error, preferences?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: savePreferences will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials, 'Failed state: this.credentials at <savePreferences()>');
      const { body } = await this.request.put('/v1/preferences/', preferences);
      if (cb) { cb(null, body); }
      return body;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Fetch PayPro invoice
   * @returns {{ amount, toAddress, memo }} Parsed payment protocol request
   */
  async fetchPayPro(
    opts: {
      /** PayPro request URL */
      payProUrl: string;
    },
    /** @deprecated */
    cb?: (err?: Error, paypro?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: fetchPayPro will remove callback support in the future.');
    }
    try {
      $.checkArgument(opts).checkArgument(opts.payProUrl);

      const paypro = await new Promise((resolve, reject) => PayPro.get(
        {
          url: opts.payProUrl,
          coin: this.credentials.coin || 'btc',
          network: this.credentials.network || 'livenet',

          // for testing
          request: this.request
        },
        (err, paypro) => {
          if (err) {
            return reject(err);
          }

          return resolve(paypro);
        }
      ));

      if (cb) { cb(null, paypro); }
      return paypro;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Gets list of utxos
   */
  async getUtxos(
    /** Options object */
    opts?: {
      /** List of addresses from where to fetch UTXOs */
      addresses?: Array<string> | string;
    },
    /** @deprecated */
    cb?: (err?: Error, utxos?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getUtxos will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <getUtxos()>');
      opts = opts || {};
      let url = '/v1/utxos/';
      if (opts.addresses) {
        url += '?addresses=' + (Array.isArray(opts.addresses) ? opts.addresses.join(',') : opts.addresses);
      }
      const { body: utxos } = await this.request.get(url);
      if (cb) { cb(null, utxos); }
      return utxos;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Gets list of coins
   */
  async getCoinsForTx(
    opts: {
      /** @deprecated use `chain` */
      coin?: string;
      /** Chain to query */
      chain: string;
      /** Network to query */
      network: string;
      /** Transaction ID to query */
      txId: string;
    },
    /** @deprecated */
    cb?: (err?: Error, coins?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getCoinsForTx will remove callback support in the future.');
    }
    try {
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
      const { body: coins } = await this.request.get(url);
      if (cb) { cb(null, coins); }
      return coins;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  _getCreateTxProposalArgs(opts) {
    const args = JSON.parse(JSON.stringify(opts, (key, value) => typeof value === 'bigint' ? value.toString() : value));
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
   */
  async createTxProposal(
    /** Txp object */
    opts: {
      /** If provided it will be used as this TX proposal ID. Should be unique in the scope of the wallet. */
      txProposalId?: string;
      /** Transaction outputs. */
      outputs: Array<{
        /** Destination address. */
        toAddress: string;
        /** Amount to transfer in satoshis. */
        amount: number | bigint;
        /** A message to attach to this output. */
        message?: string;
      }>;
      /** A message to attach to this transaction. */
      message?: string;
      /** Specify the fee level for this TX. Default: normal */
      feeLevel?: 'priority' | 'normal' | 'economy' | 'superEconomy';
      /** Specify the fee per kilobyte for this tx (in satoshis). */
      feePerKb?: number | bigint;
      /** Use this address as the change address for the tx. The address should belong to the wallet. In the case of singleAddress wallets, the first main address will be used. */
      changeAddress?: string;
      /** Send maximum amount of funds that make sense under the specified fee/feePerKb conditions. */
      sendMax?: boolean;
      /** Paypro URL for peers to verify TX */
      payProUrl?: string;
      /** Do not use UTXOs of unconfirmed transactions as inputs. */
      excludeUnconfirmedUtxos?: boolean;
      /** Simulate the action but do not change server state. */
      dryRun?: boolean;
      /** Inputs for this TX */
      inputs?: Array<any>; // TODO
      /** Use a fixed fee for this TX (only when opts.inputs is specified). */
      fee?: number | bigint;
      /** If set, TX outputs won't be shuffled. */
      noShuffleOutputs?: boolean;
      /** Specify signing method (ecdsa or schnorr) otherwise use default for chain. Only applies to BCH */
      signingMethod?: string;
      /** Specify if we are trying to make a token swap */
      isTokenSwap?: boolean;
      /** Set the BTC Replace-By-Fee flag. Note: BTC now ignores this and any tx can be replaced by a higher fee. */
      enableRBF?: boolean;
      /** Use this address to interact with the MultiSend contract that is used to send EVM based txp's with outputs > 1 */
      multiSendContractAddress?: string;
      /** Use this address to reference a token on a given chain */
      tokenAddress?: string;
      /** Ignore locked utxos check (used for replacing a transaction designated as RBF) */
      replaceTxByFee?: boolean;
    },
    /** @deprecated */
    cb?: (err?: Error, txp?: any) => void,
    /** ONLY FOR TESTING */
    baseUrl?: string
  ) {
    if (typeof cb === 'function') {
      log.warn('DEPRECATED: createTxProposal will remove callback support in the future.');
    } else if (typeof cb === 'string') {
      baseUrl = cb;
    }
    try {
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <createTxProposal()>');
      $.checkState(this.credentials.sharedEncryptingKey);
      $.checkArgument(opts);

      // BCH schnorr deployment
      if (!opts.signingMethod && this.credentials.coin == 'bch') {
        opts.signingMethod = 'schnorr';
      }

      const args = this._getCreateTxProposalArgs(opts);
      baseUrl = baseUrl || '/v3/txproposals/';
      // baseUrl = baseUrl || '/v4/txproposals/'; // DISABLED 2020-04-07

      const { body: txp } = await this.request.post<any, Txp>(baseUrl, args);
      this._processTxps(txp);
      if (!Verifier.checkProposalCreation(args, txp, this.credentials.sharedEncryptingKey)) {
        throw new Errors.SERVER_COMPROMISED();
      }

      if (cb) { cb(null, txp); }
      return txp;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Publish a transaction proposal
   */
  async publishTxProposal(
    opts: {
      /** The transaction proposal object returned by the API#createTxProposal method */
      txp: Txp;
    },
    /** @deprecated */
    cb?: (err?: Error, txp?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: publishTxProposal will remove callback support in the future.');
    }

    try {
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <publishTxProposal()>');
      $.checkArgument(opts?.txp, 'No txp was given to publish');
      $.checkState(opts.txp.version >= 3);

      const t = Utils.buildTx(opts.txp);
      const hash = t.uncheckedSerialize();
      const args = {
        proposalSignature: Utils.signMessage(hash, this.credentials.requestPrivKey)
      };

      const url = '/v2/txproposals/' + opts.txp.id + '/publish/';
      const { body: txp } = await this.request.post<object, PublishedTxp>(url, args);
      this._processTxps(txp);
      if (cb) { cb(null, txp); }
      return txp;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Create a new address
   */
  async createAddress(
    opts?: {
      /** Ignore the BWS-enforced protection against too many unused addresses */
      ignoreMaxGap?: boolean;
      /** Specifies a change address */
      isChange?: boolean;
    },
    /** @deprecated */
    cb?: (err?: Error, address?: any) => void
  ) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    if (cb) {
      log.warn('DEPRECATED: createAddress will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <createAddress()>');
      opts = opts || {};

      if (!this._checkKeyDerivation()) {
        throw new Error('Cannot create new address for this wallet');
      }

      const { body: address } = await this.request.post<typeof opts, Address>('/v4/addresses/', opts);
      
      if (!Verifier.checkAddress(this.credentials, address)) {
        throw new Errors.SERVER_COMPROMISED();
      }

      if (cb) { cb(null, address); }
      return address;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get your main addresses (i.e. non-change addresses)
   */
  async getMainAddresses(
    opts?: {
      /** Limit the resultset. Return all addresses by default */
      limit?: number;
      /** Skip the first N addresses. Default: 0 */
      skip?: number;
      /** Reverse the order. Default: false */
      reverse?: boolean;
      /** Do not verify the addresses. Default: false */
      doNotVerify?: boolean;
    },
    /** @deprecated */
    cb?: (err?: Error, addresses?: any[]) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getMainAddresses will remove callback support in the future.');
    }
    try { 
      opts = opts || {};

      const addresses = await this.getAddresses({ ...opts, noChange: true });
      if (cb) { cb(null, addresses); }
      return addresses;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get your addresses
   */
  async getAddresses(
    opts?: {
      /** Limit the resultset. Return all addresses by default */
      limit?: number;
      /** Skip the first N addresses. Default: 0 */
      skip?: number;
      /** Reverse the order. Default: false */
      reverse?: boolean;
      /** Do not verify the addresses. Default: false */
      doNotVerify?: boolean;
      /** Only return the specified addresses */
      addresses?: Array<string>;
      /** Filter out change addresses */
      noChange?: boolean;
    },
  ) {
    $.checkState(this.credentials && this.credentials.isComplete());
    opts = opts || {};

    const args = [];
    if (opts.limit) args.push('limit=' + opts.limit);
    if (opts.skip) args.push('skip=' + opts.skip);
    if (opts.reverse) args.push('reverse=1');
    if (opts.noChange) args.push('noChange=1');
    if (Array.isArray(opts.addresses) && opts.addresses.length > 0) {
      args.push('addresses=' + opts.addresses.join(','));
    }
    const { body: addresses } = await this.request.get<Array<Address>>(`/v1/addresses${args.length ? '?' + args.join('&') : ''}`);

    if (!opts.doNotVerify) {
      const fake = (addresses || []).some(address => !Verifier.checkAddress(this.credentials, address));
      if (fake) throw new Errors.SERVER_COMPROMISED();
    }
    return addresses;
  }

  /**
   * Update wallet balance
   */
  async getBalance(
    opts?: {
      /** @deprecated Backward compatibility. Use `chain` instead */
      coin?: string;
      /** Defaults to current wallet chain */
      chain?: string;
      /** ERC20 token contract address */
      tokenAddress?: string;
      /** MULTISIG ETH Contract Address */
      multisigContractAddress?: string;
    },
    /** @deprecated */
    cb?: (err?: Error, balance?: any) => void
  ) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    if (cb) {
      log.warn('DEPRECATED: getBalance will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <getBalance()>');
      opts = opts || {};

      opts.chain = opts.chain || opts.coin; // backwards compatibility
      const args = [];
      if (opts.coin) {
        args.push('coin=' + opts.coin);
      }
      if (opts.tokenAddress) {
        args.push('tokenAddress=' + opts.tokenAddress);
      }
      if (opts.multisigContractAddress) {
        args.push('multisigContractAddress=' + opts.multisigContractAddress);
      }
      let qs = '';
      if (args.length > 0) {
        qs = '?' + args.join('&');
      }

      const { body } = await this.request.get('/v1/balance/' + qs);
      if (cb) { cb(null, body); }
      return body;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get list of transactions proposals
   */
  async getTxProposals(
    opts?: {
      /** Do not verify the transactions. Default: false */
      doNotVerify?: boolean;
      /** This is for an air-gapped wallet */
      forAirGapped?: boolean;
      /** Do not encrypt the public key ring */
      doNotEncryptPkr?: boolean;
    },
    /** @deprecated */
    cb?: (err?: Error, txps?: any[]) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getTxProposals will remove callback support in the future.');
    }

    try { 
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <getTxProposals()>');

      opts = opts || {};
      const { doNotVerify, forAirGapped, doNotEncryptPkr } = opts;

      const { body: txps } = await this.request.get('/v2/txproposals/');
      this._processTxps(txps);
      
      if (!doNotVerify) {
        for (const txp of txps) {
          const paypro = await this.getPayProV2(txp);
          const isLegit = Verifier.checkTxProposal(this.credentials, txp, {
            paypro
          });
          if (!isLegit) {
            throw new Errors.SERVER_COMPROMISED();
          }
        }
      }

      let result;
      if (forAirGapped) {
        result = {
          txps: JSON.parse(JSON.stringify(txps)),
          encryptedPkr: doNotEncryptPkr
            ? null
            : Utils.encryptMessage(
                JSON.stringify(this.credentials.publicKeyRing),
                this.credentials.personalEncryptingKey
              ),
          unencryptedPkr: doNotEncryptPkr
            ? JSON.stringify(this.credentials.publicKeyRing)
            : null,
          m: this.credentials.m,
          n: this.credentials.n
        };
      } else {
        result = txps;
      }

      if (cb) { cb(null, result); }
      return result;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  // private?
  async getPayPro(
    txp: Txp,
    /** @deprecated */
    cb?: (err?: Error, paypro?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getPayPro will remove callback support in the future.');
    }
    try {
      if (!txp.payProUrl || this.doNotVerifyPayPro) {
        if (cb) cb();
        return;
      }

      const paypro = await new Promise((resolve, reject) => PayPro.get(
        {
          url: txp.payProUrl,
          coin: txp.coin || 'btc',
          network: txp.network || 'livenet',

          // for testing
          request: this.request
        },
        (err, paypro) => {
          if (err)
            return reject(new Error('Could not fetch invoice:' + (err.message ? err.message : err)));
          return resolve(paypro);
        }
      ));
      if (cb) { cb(null, paypro); }
      return paypro;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  async getPayProV2(txp: Txp) {
    if (!txp.payProUrl || this.doNotVerifyPayPro) return;

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
   */
  async pushSignatures(
    /** Transaction proposal to sign */
    txp: Txp,
    /** Array of signatures */
    signatures: Array<string>,
    /** @deprecated */
    cb?: (err?: Error, txp?: Txp) => void,
    /** ONLY FOR TESTING */
    baseUrl?: string
  ) {
    if (cb) {
      log.warn('DEPRECATED: pushSignatures will remove callback support in the future.');
    } else if (typeof cb === 'string') {
      baseUrl = cb;
    }
    try {
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <pushSignatures()>');
      $.checkArgument(txp.creatorId);

      if (!signatures?.length) {
        throw new Error('No signatures to push. Sign the transaction with Key first');
      }

      const paypro = await this.getPayProV2(txp);
      const isLegit = Verifier.checkTxProposal(this.credentials, txp, { paypro });
      if (!isLegit) throw new Errors.SERVER_COMPROMISED();

      baseUrl = baseUrl || '/v2/txproposals/';
      const url = `${baseUrl}${txp.id}/signatures/`;
      const args = { signatures };
      const { body: signedTxp } = await this.request.post<object, Txp>(url, args);
      this._processTxps(signedTxp);
      if (cb) { cb(null, signedTxp); }
      return signedTxp;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Create advertisement for bitpay app - (limited to marketing staff)
   * @returns {object} Returns the created advertisement
   */
  async createAdvertisement(
    opts,
    /** @deprecated */
    cb?: (err?: Error, advertisement?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: createAdvertisement will remove callback support in the future.');
    }
    try {
      // TODO add check for preconditions of title, imgUrl, linkUrl
      const { body: createdAd } = await this.request.post('/v1/advertisements/', opts);
      if (cb) { cb(null, createdAd); }
      return createdAd;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get advertisements for bitpay app - (limited to marketing staff)
   * @returns {Array<any>} Returns an array of advertisements
   */
  async getAdvertisements(
    opts?: {
      /** If true, fetches testing advertisements */
      testing?: boolean;
    },
    /** @deprecated */
    cb?: (err?: Error, advertisements?: any[]) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getAdvertisements will remove callback support in the future.');
    }
    try {
      opts = opts || {};

      const { body: ads } = await this.request.get(`/v1/advertisements/${opts.testing ? '?testing=true' : ''}`);
      if (cb) { cb(null, ads); }
      return ads;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get advertisements for bitpay app, for specified country - (limited to marketing staff)
   * @returns {Array<any>} Returns an array of advertisements
   */
  async getAdvertisementsByCountry(
    opts?: {
      /** If set, fetches ads by Country */
      country?: string;
    },
    /** @deprecated */
    cb?: (err?: Error, advertisements?: any[]) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getAdvertisementsByCountry will remove callback support in the future.');
    }
    try {
      opts = opts || {};
      const { body: ads } = await this.request.get(`/v1/advertisements/country/${opts.country}`);
      if (cb) { cb(null, ads); }
      return ads;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get Advertisement
   * @returns {object} Returns the advertisement
   */
  async getAdvertisement(
    opts: {
      /** Advertisement ID */
      adId: string; // Advertisement ID
    },
    /** @deprecated */
    cb?: (err?: Error, advertisement?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getAdvertisement will remove callback support in the future.');
    }
    try {
      const { body } = await this.request.get(`/v1/advertisements/${opts.adId}`);
      if (cb) { cb(null, body); }
      return body;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Activate Advertisement
   * @returns {object} Returns the activated advertisement
   */
  async activateAdvertisement(
    opts: {
      /** Advertisement ID */
      adId: string;
    },
    /** @deprecated */
    cb?: (err?: Error, advertisement?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: activateAdvertisement will remove callback support in the future.');
    }
    try {
      const { body } = await this.request.post(`/v1/advertisements/${opts.adId}/activate`, opts);
      if (cb) { cb(null, body); }
      return body;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Deactivate Advertisement
   * @returns {object} Returns the deactivated advertisement
   */
  async deactivateAdvertisement(
    opts: {
      /** Advertisement ID */
      adId: string;
    },
    /** @deprecated */
    cb?: (err?: Error, advertisement?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: deactivateAdvertisement will remove callback support in the future.');
    }
    try {
      const { body } = await this.request.post(`/v1/advertisements/${opts.adId}/deactivate`, opts);
      if (cb) { cb(null, body); }
      return body;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Delete Advertisement
   * @returns {object} Returns the deleted advertisement
   */
  async deleteAdvertisement(
    opts: {
      /** Advertisement ID */
      adId: string;
    },
    /** @deprecated */
    cb?: (err?: Error, advertisement?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: deleteAdvertisement will remove callback support in the future.');
    }
    try {
      const { body } = await this.request.delete('/v1/advertisements/' + opts.adId);
      if (cb) { cb(null, body); }
      return body;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Sign transaction proposal from AirGapped
   */
  signTxProposalFromAirGapped(
    /** Transaction proposal to sign */
    txp: Txp,
    /** An encrypted string with the wallet's public key ring */
    encryptedPkr: string,
    /** Number of required signatures */
    m: number,
    /** Number of total signers */
    n: number,
    /** A password to decrypt the encrypted private key (if encryption is set). */
    password?: PasswordMaybe
  ) {
    throw new Error('signTxProposalFromAirGapped not yet implemented');
    // return API.signTxProposalFromAirGapped(this.credentials, txp, encryptedPkr, m, n, { password });
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
   */
  static signTxProposalFromAirGapped(
    /** A mnemonic phrase or an xprv HD private key */
    key: string,
    /** Transaction proposal to sign */
    txp: Txp,
    /** An unencrypted string with the wallet's public key ring */
    unencryptedPkr: string,
    /** Number of required signatures */
    m: number,
    /** Number of total signers */
    n: number,
    opts?: {
      /** @deprecated Backward compatibility. Use `chain` instead */
      coin?: string;
      /** Chain to use. Default: 'btc' */
      chain?: string;
      /** Mnemonic passphrase */
      passphrase?: string;
      /** Account index. Default: 0 */
      account?: number;
      /** Derivation strategy. Default: 'BIP44' */
      derivationStrategy?: string;
    }
  ) {
    throw new Error('signTxProposalFromAirGapped not yet implemented');
    // opts = opts || {};

    // const chain = opts.chain || opts.coin || 'btc';
    // // checking in chains for simplicity
    // if (!Constants.CHAINS.includes(chain))
    //   throw new Error('Invalid coin');

    // const publicKeyRing = JSON.parse(unencryptedPkr);

    // if (!Array.isArray(publicKeyRing) || publicKeyRing.length != n) {
    //   throw new Error('Invalid public key ring');
    // }

    // const newClient: any = new API({
    //   baseUrl: 'https://bws.example.com/bws/api'
    // });

    // // TODO TODO TODO
    // if (key.slice(0, 4) === 'xprv' || key.slice(0, 4) === 'tprv') {
    //   if (key.slice(0, 4) === 'xprv' && txp.network == 'testnet')
    //     throw new Error('testnet HD keys must start with tprv');
    //   if (key.slice(0, 4) === 'tprv' && txp.network == 'livenet')
    //     throw new Error('livenet HD keys must start with xprv');
    //   newClient.seedFromExtendedPrivateKey(key, {
    //     coin: chain,
    //     account: opts.account,
    //     derivationStrategy: opts.derivationStrategy
    //   });
    // } else {
    //   newClient.seedFromMnemonic(key, {
    //     coin: chain,
    //     network: txp.network,
    //     passphrase: opts.passphrase,
    //     account: opts.account,
    //     derivationStrategy: opts.derivationStrategy
    //   });
    // }
    // newClient.credentials.m = m;
    // newClient.credentials.n = n;
    // newClient.credentials.addressType = txp.addressType;
    // newClient.credentials.addPublicKeyRing(publicKeyRing);

    // if (!Verifier.checkTxProposalSignature(newClient.credentials, txp))
    //   throw new Error('Fake transaction proposal');

    // return newClient._signTxp(txp);
  }

  /**
   * Reject a transaction proposal
   */
  async rejectTxProposal(
    /** Transaction proposal to reject */
    txp: Txp,
    /** Rejection reason */
    reason?: string,
    /** @deprecated */
    cb?: (err?: Error, txp?: Txp) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: rejectTxProposal will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <rejectTxProposal()>');

      const args = {
        reason: API._encryptMessage(reason, this.credentials.sharedEncryptingKey) || ''
      };
      const { body: rejectedTxp } = await this.request.post(`/v1/txproposals/${txp.id}/rejections/`, args);
      this._processTxps(rejectedTxp);
      if (cb) { cb(null, rejectedTxp); }
      return rejectedTxp;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Broadcast raw transaction
   */
  async broadcastRawTx(
    opts: {
      /** The raw transaction to broadcast */
      rawTx: string;
      /** Defaults to current wallet network */
      network?: string;
    },
    /** @deprecated */
    cb?: (err?: Error, txid?: string) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: broadcastRawTx will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials, 'Failed state: this.credentials at <broadcastRawTx()>');

      const { body: txid } = await this.request.post<typeof opts, string>('/v1/broadcast_raw/', opts);
      if (cb) { cb(null, txid); }
      return txid;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  async _doBroadcast(args: { id: string }) {
    const { id } = args;
    const { body: txp } = await this.request.post<object, Txp>(`/v1/txproposals/${id}/broadcast/`, {});
    this._processTxps(txp);
    return txp;
  }

  /**
   * Broadcast a transaction proposal
   */
  async broadcastTxProposal(
    /** Transaction proposal to broadcast */
    txp,
    /** @deprecated */
    cb?: (err?: Error, txp?: Txp, memo?: string) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: broadcastTxProposal will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <broadcastTxProposal()>');

      const paypro = await this.getPayProV2(txp)
      if (!paypro) {
        txp = await this._doBroadcast(txp);
        if (cb) { cb(null, txp); }
        return { txp };
      }
      const t = Utils.buildTx(txp);
      const rawTxUnsigned = t.uncheckedSerialize();

      this._applyAllSignatures(txp, t);

      const chain = txp.chain || Utils.getChain(txp.coin); // getChain -> backwards compatibility
      const currency = Utils.getCurrencyCodeFromCoinAndChain(txp.coin, chain);
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
      await PayProV2.verifyUnsignedPayment({
        paymentUrl: txp.payProUrl,
        chain,
        currency,
        unsignedTransactions
      });
        
      const payProDetails = await PayProV2.sendSignedPayment({
        paymentUrl: txp.payProUrl,
        chain,
        currency,
        signedTransactions,
        bpPartner: {
          bp_partner: this.bp_partner,
          bp_partner_version: this.bp_partner_version
        }
      });
      if (payProDetails.memo) {
        log.debug('Merchant memo:', payProDetails.memo);
      }

      if (cb) { cb(null, txp, payProDetails.memo); }
      return { txp, memo: payProDetails.memo };
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Remove a transaction proposal
   */
  async removeTxProposal(
    /** Transaction proposal to remove */
    txp: { id: string },
    /** @deprecated */
    cb?: (err?: Error) => void
  ): Promise<void> {
    if (cb) {
      log.warn('DEPRECATED: removeTxProposal will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <removeTxProposal()>');

      await this.request.delete('/v1/txproposals/' + txp.id);
      if (cb) { cb(); }
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get transaction history
   */
  async getTxHistory(
    opts?: {
      /** Skip this number of transactions. Default: 0 */
      skip?: number;
      /** Limit the number of transactions */
      limit?: number;
      /** ERC20 token contract address */
      tokenAddress?: string;
      /** MULTISIG ETH Contract Address */
      multisigContractAddress?: string;
      includeExtendedInfo?: boolean;
    },
    /** @deprecated */
    cb?: (err?: Error, txs?: any[]) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getTxHistory will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <getTxHistory()>');

      const args = [];
      if (opts) {
        if (opts.skip) args.push('skip=' + opts.skip);
        if (opts.limit) args.push('limit=' + opts.limit);
        if (opts.tokenAddress) args.push('tokenAddress=' + opts.tokenAddress);
        if (opts.multisigContractAddress)
          args.push('multisigContractAddress=' + opts.multisigContractAddress);
        if (opts.includeExtendedInfo) args.push('includeExtendedInfo=1');
      }
      let qs = '';
      if (args.length > 0) {
        qs = '?' + args.join('&');
      }

      const { body: txs } = await this.request.get<Array<any>>(`/v1/txhistory/${qs}`);
      this._processTxps(txs);
      if (cb) { cb(null, txs); }
      return txs;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get Transaction by txid
   */
  async getTxByHash(
    txid: string,
    /** @deprecated */
    cb?: (err?: Error, txp?: Txp) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getTxByHash will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <getTxByHash()>');

      const { body: txp } = await this.request.get(`/v1/txproposalsbyhash/${txid}`);
      this._processTxps(txp);
      if (cb) { cb(null, txp); }
      return txp;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get Transaction Proposal by id
   */
  async getTx(
    txProposalId: string,
    /** @deprecated */
    cb?: (err?: Error, txp?: Txp) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getTx will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <getTx()>');

      const { body: txp } = await this.request.get<Txp>(`/v1/txproposals/${txProposalId}`);
      this._processTxps(txp);
      if (cb) { cb(null, txp); }
      return txp;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Start an address scanning process.
   * When finished, the scanning process will send a notification 'ScanFinished' to all copayers.
   * @return {void}
   */
  async startScan(
    opts: {
      /** Default: false */
      includeCopayerBranches?: boolean;
      /** Address derivation path start index (support agents only) */
      startIdx?: number;
    },
    /** @deprecated */
    cb?: (err?: Error) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: startScan will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials && this.credentials.isComplete(), 'Failed state: this.credentials at <startScan()>');

      const args = {
        includeCopayerBranches: opts.includeCopayerBranches,
        startIdx: opts.startIdx
      };

      await this.request.post('/v1/addresses/scan', args);
      if (cb) { cb(); }
      return;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Adds access to the current copayer
   */
  async addAccess(
    opts: {
      requestPrivKey: string;
      /** Signature of the private key, from master key. */
      signature: string;
      /**
       * Restrictions for the new access.
       * - cannotProposeTXs
       * - cannotXXX TODO
       */
      restrictions?: string;
      /** Name for the new access. */
      name?: string;
    },
    /** @deprecated */
    cb?: (err?: Error, wallet?: any, requestPrivateKey?: string) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: addAccess will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials, 'Failed state: no this.credentials at <addAccess()>');
      $.shouldBeString(opts?.requestPrivKey, 'Failed state: no requestPrivKey at addAccess()');
      $.shouldBeString(opts?.signature, 'Failed state: no signature at addAccess()');

      const requestPubKey = new Bitcore.PrivateKey(opts.requestPrivKey)
        .toPublicKey()
        .toString();
      const copayerId = this.credentials.copayerId;
      const encCopayerName = opts.name
        ? Utils.encryptMessage(opts.name, this.credentials.sharedEncryptingKey)
        : null;

      const opts2 = {
        copayerId,
        requestPubKey,
        signature: opts.signature,
        name: encCopayerName,
        restrictions: opts.restrictions
      };

      const { body } = await this.request.put('/v1/copayers/' + copayerId + '/', opts2);
      // Do not set the key. Return it (for compatibility)
      // this.credentials.requestPrivKey = opts.requestPrivKey;
      if (cb) { cb(null, body.wallet, opts.requestPrivKey) };
      return { wallet: body.wallet, requestPrivateKey: opts.requestPrivKey };
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get a note associated with the specified txid
   */
  async getTxNote(
    opts: {
      /** The txid associated with the note */
      txid: string;
    },
    /** @deprecated */
    cb?: (err?: Error, note?: Note) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getTxNote will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials, 'Failed state: this.credentials at <getTxNote()>');
      $.checkArgument(opts?.txid, 'Missing argument: txid at <getTxNote()>');

      const { body: note } = await this.request.get<Note>('/v1/txnotes/' + opts.txid + '/');
      this._processTxNotes(note);
      if (cb) { cb(null, note); }
      return note;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Edit a note associated with the specified txid
   */
  async editTxNote(
    opts: {
      /** The txid associated with the note */
      txid: string;
      /** The contents of the note */
      body?: string;
    },
    /** @deprecated */
    cb?: (err?: Error, note?: Note) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: editTxNote will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials, 'Failed state: this.credentials at <editTxNote()>');
      $.checkArgument(opts?.txid, 'Missing argument: txid at <editTxNote()>');

      if (opts.body) {
        opts.body = API._encryptMessage(opts.body, this.credentials.sharedEncryptingKey);
      }
      const { body: note } = await this.request.put<typeof opts, Note>('/v1/txnotes/' + opts.txid + '/', opts);
      this._processTxNotes(note);
      if (cb) { cb(null, note); }
      return note;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get all notes edited after the specified date
   */
  async getTxNotes(
    opts?: {
      /** The starting timestamp */
      minTs?: number;
    },
    /** @deprecated */
    cb?: (err?: Error, notes?: Array<Note>) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getTxNotes will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials, 'Failed state: this.credentials at <getTxNotes()>');

      opts = opts || {};
      const args = [];
      if (opts.minTs != null && !isNaN(opts.minTs)) {
        args.push('minTs=' + opts.minTs);
      }
      let qs = '';
      if (args.length > 0) {
        qs = '?' + args.join('&');
      }

      const { body: notes } = await this.request.get<Array<Note>>('/v1/txnotes/' + qs);
      this._processTxNotes(notes);
      if (cb) { cb(null, notes); }
      return notes;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Returns exchange rate for the specified currency & timestamp.
   */
  async getFiatRate(
    opts: {
      /** The currency ISO code */
      code: string;
      /** Timestamp to base the rate on. Default: Date.now() */
      ts?: Date | number;
      /** The coin to get the rate for. Default: 'btc' */
      coin?: string;
    },
    /** @deprecated */
    cb?: (err?: Error, rates?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getFiatRate will remove callback support in the future.');
    }
    try {
      $.checkArgument(opts?.code, 'Missing argument: code at <getFiatRate()>');

      const args = [];
      if (opts.ts) args.push('ts=' + opts.ts);
      if (opts.coin) args.push('coin=' + opts.coin);
      let qs = '';
      if (args.length > 0) {
        qs = '?' + args.join('&');
      }

      const { body: rates } = await this.request.get('/v1/fiatrates/' + opts.code + '/' + qs);
      if (cb) { cb(null, rates); }
      return rates;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async pushNotificationsSubscribe(
    opts?: {
      /** Device type */
      type?: 'ios' | 'android';
      /** Device token // Braze */
      externalUserId?: string;
    },
    /** @deprecated */
    cb?: (err?: Error, response?: any) => void
  ) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    if (cb) {
      log.warn('DEPRECATED: pushNotificationsSubscribe will remove callback support in the future.');
    }
    try {
      const { body } = await this.request.post('/v2/pushnotifications/subscriptions/', opts);
      if (cb) { cb(null, body); }
      return body;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async pushNotificationsUnsubscribe(
    /** Device token // Braze */
    externalUserId: string,
    /** @deprecated */
    cb?: (err?: Error) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: pushNotificationsUnsubscribe will remove callback support in the future.');
    }
    try {
      await this.request.delete('/v3/pushnotifications/subscriptions/' + externalUserId);
      if (cb) { cb(); }
      return;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Listen to a tx for its first confirmation
   */
  async txConfirmationSubscribe(
    /** The txid to subscribe to */
    opts: {
      txid: string;
    },
    /** @deprecated */
    cb?: (err?: Error, response?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: txConfirmationSubscribe will remove callback support in the future.');
    }
    try {
      $.checkArgument(opts?.txid, 'Missing argument: txid at <txConfirmationSubscribe()>');
      const { body } = await this.request.post('/v1/txconfirmations/', opts);
      if (cb) { cb(null, body); }
      return body;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Stop listening for a tx confirmation
   */
  async txConfirmationUnsubscribe(
    /** The txid to unsubscribe from */
    txid: string,
    /** @deprecated */
    cb?: (err?: Error) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: txConfirmationUnsubscribe will remove callback support in the future.');
    }
    try {
      $.checkArgument(txid, 'Missing argument: txid at <txConfirmationUnsubscribe()>');
      await this.request.delete('/v1/txconfirmations/' + txid);
      if (cb) { cb(); }
      return;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Returns send max information
   * @param {object} opts
   * @param {function} [cb] DEPRECATED: Callback function in the standard form (err, result)
   * @return {object} Returns object result
   */
  async getSendMaxInfo(
    opts?: {
      /** Specify the fee level. Default: normal */
      feeLevel?: 'priority' | 'normal' | 'economy' | 'superEconomy';
      /** Specify the fee per KB (in satoshi) */
      feePerKb?: number;
      /** Indicates it if should use (or not) the unconfirmed utxos */
      excludeUnconfirmedUtxos?: boolean;
      /** Return the inputs used to build the tx */
      returnInputs?: boolean;
    },
    /** @deprecated */
    cb?: (err?: Error, result?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getSendMaxInfo will remove callback support in the future.');
    }
    try {
      opts = opts || {};

      const args = [];
      if (opts.feeLevel) args.push('feeLevel=' + opts.feeLevel);
      if (opts.feePerKb != null) args.push('feePerKb=' + opts.feePerKb);
      if (opts.excludeUnconfirmedUtxos) args.push('excludeUnconfirmedUtxos=1');
      if (opts.returnInputs) args.push('returnInputs=1');

      let qs = '';
      if (args.length > 0) qs = '?' + args.join('&');

      const { body: result } = await this.request.get('/v1/sendmaxinfo/' + qs);
      if (cb) { cb(null, result); }
      return result;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Returns gas limit estimate
   */
  async getEstimateGas(
    opts, // TODO define type
    /** @deprecated */
    cb?: (err?: Error, gasLimit?: number) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getEstimateGas will remove callback support in the future.');
    }
    try {
      const { body: gasLimit } = await this.request.post<typeof opts, number>('/v3/estimateGas/', opts);
      if (cb) { cb(null, gasLimit); }
      return gasLimit;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Returns nonce
   */
  async getNonce(
    opts: {
      /** EVM based chain or 'xrp' */
      chain: string;
      /** @deprecated Backwards compatibility. Use `chain` instead */
      coin?: string;
      /** Network name (e.g. 'livenet', 'sepolia', etc.) */
      network: string;
      /** Address to get nonce for */
      address: string;
    },
    /** @deprecated */
    cb?: (err?: Error, nonce?: number) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getNonce will remove callback support in the future.');
    }
    try {
      $.checkArgument([...Constants.EVM_CHAINS, 'xrp'].includes(opts?.chain), 'Invalid chain: must be XRP or EVM based');
      $.checkArgument(opts?.network, 'Missing argument: network at <getNonce()>');
      $.checkArgument(opts?.address, 'Missing argument: address at <getNonce()>');

      const qs = [];
      qs.push(`coin=${opts.coin}`); // TODO Remove? opts.chain is enforced, so need to verify server's handling of coin vs chain
      qs.push(`chain=${opts.chain}`);
      qs.push(`network=${opts.network}`);

      const { body: nonce } = await this.request.get<number>(`/v1/nonce/${opts.address}?${qs.join('&')}`);
      if (cb) { cb(null, nonce); }
      return nonce;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Returns contract instantiation info. (All contract addresses instantiated by that sender with the current transaction hash and block number)
   */
  async getMultisigContractInstantiationInfo(
    opts: {
      /** Sender wallet address */
      sender: string;
      /** Chain name. Default: 'eth' */
      coin?: string;
      /** Instantiation transaction id */
      txId: string;
    },
    /** @deprecated */
    cb?: (err?: Error, instantiationInfo?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getMultisigContractInstantiationInfo will remove callback support in the future.');
    }
    try {
    const args = { ...opts, network: this.credentials.network };
    const { body: contractInstantiationInfo } = await this.request.post('/v1/multisig/', args);
    if (cb) { cb(null, contractInstantiationInfo); }
    return contractInstantiationInfo;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Returns contract info
   */
  async getMultisigContractInfo(
    opts: {
      /** MultiSig contract address */
      multisigContractAddress: string;
      /** Chain name. Default: 'eth' */
      coin?: string;
    },
    /** @deprecated */
    cb?: (err?: Error, contractInfo?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getMultisigContractInfo will remove callback support in the future.');
    }
    try {
      const args = { ...opts, network: this.credentials.network };
      const { body: contractInfo } = await this.request.post('/v1/multisig/info', args);
      if (cb) { cb(null, contractInfo); }
      return contractInfo;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Returns contract info
   * @return {{ name, symbol, precision }} Returns contract info object
   */
  async getTokenContractInfo(
    opts: {
      /** Token contract address */
      tokenAddress: string;
      /** Chain name. Default: 'eth' */
      chain?: string;
    },
    /** @deprecated */
    cb?: (err?: Error, contractInfo?: any) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getTokenContractInfo will remove callback support in the future.');
    }
    try {
      const args = { ...opts, network: this.credentials.network };
      const { body: contractInfo } = await this.request.post<object, { name: string; symbol: string; precision: number }>('/v1/token/info', args);
      if (cb) { cb(null, contractInfo); }
      return contractInfo;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
  }

  /**
   * Get wallet status based on a string identifier
   */
  async getStatusByIdentifier(
    opts: {
      /** The wallet identifier (a walletId, address, or txid) */
      identifier: string;
      /** Query extended status */
      includeExtendedInfo?: boolean;
      /** Run server-side walletCheck if wallet is found */
      walletCheck?: boolean;
    },
    /** @deprecated */
    cb?: (err?: Error, status?: Status) => void
  ) {
    if (cb) {
      log.warn('DEPRECATED: getStatusByIdentifier will remove callback support in the future.');
    }
    try {
      $.checkState(this.credentials, 'Failed state: this.credentials at <getStatusByIdentifier()>');
      $.checkArugment(opts?.identifier, 'Missing argument: identifier at <getStatusByIdentifier()>');

      const qs = [];
      qs.push('includeExtendedInfo=' + (opts.includeExtendedInfo ? '1' : '0'));
      qs.push('walletCheck=' + (opts.walletCheck ? '1' : '0'));

      const { body: result } = await this.request.get<Status>(`/v1/wallets/${opts.identifier}?${qs.join('&')}`);
      if (!result?.wallet) return;
      if (result.wallet.status == 'pending') {
        const c = this.credentials;
        result.wallet.secret = API._buildSecret(
          c.walletId,
          c.walletPrivKey,
          c.coin,
          c.network
        );
      }
      this._processStatus(result);
      if (cb) { cb(null, result); }
      return result;
    } catch (err) {
      if (cb) cb(err);
      else throw err;
    }
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
      decrypted = Encryption.decryptWithPassword(blob, passphrase);
    } catch (e) {
      passphrase = username + SEP2 + password;
      try {
        decrypted = Encryption.decryptWithPassword(blob, passphrase);
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
   */
  static upgradeCredentialsV1(
    /** Credentials V1 object */
    v1: any
  ) {
    $.shouldBeObject(v1);

    if (
      v1.version != null ||
      (!v1.xPrivKey && !v1.xPrivKeyEncrypted && !v1.xPubKey)
    ) {
      throw new Error('Could not recognize old version');
    }

    let k: Key;
    if (v1.xPrivKey || v1.xPrivKeyEncrypted) {
      k = new Key({ seedData: v1, seedType: 'objectV1' });
    } else {
      // Read-only credentials
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
    c.keyId = k?.id;
    return { key: k, credentials: c };
  }

  /**
   * Upgrade multiple Credentials V1 to Keys and Credentials V2 objects
   * Duplicate keys will be identified and merged.
   */
  static upgradeMultipleCredentialsV1(
    /** Credentials V1 objects */
    v1: Credentials[]
  ) {
    let newKeys: Key[] = [];
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
   * @returns {key, clients[]} Returns key, clients[]
   */
  static serverAssistedImport(
    opts: {
      /** Mnemonic words */
      words?: string;
      /** Extended Private Key */
      xPrivKey?: string;
      /** Mnemonic's passphrase */
      passphrase?: string;
      /** Include testnet wallets */
      includeTestnetWallets?: boolean;
      /** Search legacy wallets */
      includeLegacyWallets?: boolean;
      /** Use 0 for BCH */
      use0forBCH?: boolean;
    },
    /** BWS connection options (see ClientAPI constructor) */
    clientOpts,
    /** Callback function in the standard form (err, key, clients) */
    callback: (err?: Error, key?: Key, clients?: API[]) => void
  ) {
    $.checkArgument(opts.words || opts.xPrivKey, 'Missing argument: words or xPrivKey at <serverAssistedImport()>');

    let client = clientOpts instanceof API ? API.clone(clientOpts) : new API(clientOpts);
    let includeTestnetWallets = opts.includeTestnetWallets;
    let includeLegacyWallets = opts.includeLegacyWallets;
    let credentials = [];
    let copayerIdAlreadyTested = {};
    let keyCredentialIndex: { credentials: Credentials; key: Key; opts: any; status?: string }[] = [];
    let clients = [];
    let k: Key;
    let sets = [
      {
        // current wallets: /[44,48]/[0,145]'/
        nonCompliantDerivation: false,
        useLegacyCoinType: false,
        useLegacyPurpose: false,
        passphrase: undefined // is set later
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
        m: opts.m,
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

    const checkKey = (key: Key) => {
      let opts = [
        // [coin, chain, network, multisig, preForkBchCheck]
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

      if (key.compliantDerivation && includeTestnetWallets) {
        const testnet = JSON.parse(JSON.stringify(opts));
        for (const x of testnet) {
          x[2] = 'testnet';
        }
        opts = opts.concat(testnet);
      }
      if (!key.compliantDerivation) {
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
          // If opt[3] == true then check for multisig address type.
          // The values of m & n don't actually matter (other than n being >1 and m being <= n)
          m: 1,
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
                {
                  allowOverwrite: !!wallet.tssKeyId
                }
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
            credentials.addWalletPrivateKey(item.status.customData.walletPrivKey);
          }

          if (credentials.walletPrivKey) {
            if (!Verifier.checkCopayers(credentials, wallet.copayers)) {
              return cb2(null, new Errors.SERVER_COMPROMISED());
            }
          } else {
            // this should only happen in AIR-GAPPED flows
            log.warn('Could not verify copayers key (missing wallet Private Key)');
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
          m: clonedSettings.m,
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

    const id = Uuid.v4();
    for (const set of sets) {
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

  async banxaGetQuote(data) {
    return this.request.post('/v1/service/banxa/quote', data);
  }

  async banxaCreateOrder(data) {
    return this.request.post('/v1/service/banxa/createOrder', data);
  }

  async moonpayGetQuote(data) {
    return this.request.post('/v1/service/moonpay/quote', data);
  }

  async moonpayGetSellQuote(data) {
    return this.request.post('/v1/service/moonpay/sellQuote', data);
  }

  async moonpayGetSignedPaymentUrl(data) {
    return this.request.post('/v1/service/moonpay/signedPaymentUrl', data);
  }

  async moonpayGetSellSignedPaymentUrl(data) {
    return this.request.post('/v1/service/moonpay/sellSignedPaymentUrl', data);
  }

  async moonpayCancelSellTransaction(data) {
    return this.request.post('/v1/service/moonpay/cancelSellTransaction', data);
  }

  async rampGetQuote(data) {
    return this.request.post('/v1/service/ramp/quote', data);
  }

  async rampGetSellQuote(data) {
    return this.request.post('/v1/service/ramp/sellQuote', data);
  }

  async rampGetSignedPaymentUrl(data) {
    return this.request.post('/v1/service/ramp/signedPaymentUrl', data);
  }

  async sardineGetQuote(data) {
    return this.request.post('/v1/service/sardine/quote', data);
  }

  async sardineGetToken(data) {
    return this.request.post('/v1/service/sardine/getToken', data);
  }

  async simplexGetQuote(data) {
    return this.request.post('/v1/service/simplex/quote', data);
  }

  async simplexGetSellQuote(data) {
    return this.request.post('/v1/service/simplex/sellQuote', data);
  }

  async simplexPaymentRequest(data) {
    return this.request.post('/v1/service/simplex/paymentRequest', data);
  }

  async simplexSellPaymentRequest(data) {
    return this.request.post('/v1/service/simplex/sellPaymentRequest', data);
  }

  async simplexGetEvents(data) {
    return this.request.get(`/v1/service/simplex/events/?env=${data.env}`);
  }

  async thorswapGetSwapQuote(data) {
    return this.request.post('/v1/service/thorswap/getSwapQuote', data);
  }

  async transakGetAccessToken(data) {
    return this.request.post('/v1/service/transak/getAccessToken', data);
  }

  async transakGetQuote(data) {
    return this.request.post('/v1/service/transak/quote', data);
  }

  async transakGetSignedPaymentUrl(data) {
    return this.request.post('/v1/service/transak/signedPaymentUrl', data);
  }

  async wyreWalletOrderQuotation(data) {
    return this.request.post('/v1/service/wyre/walletOrderQuotation', data);
  }

  async wyreWalletOrderReservation(data) {
    return this.request.post('/v1/service/wyre/walletOrderReservation', data);
  }

  async changellyGetPairsParams(data) {
    return this.request.post('/v1/service/changelly/getPairsParams', data);
  }

  async changellyGetFixRateForAmount(data) {
    return this.request.post('/v1/service/changelly/getFixRateForAmount', data);
  }

  async changellyCreateFixTransaction(data) {
    return this.request.post('/v1/service/changelly/createFixTransaction', data);
  }

  async oneInchGetSwap(data) {
    return this.request.post('/v1/service/oneInch/getSwap', data);
  }
};

export type Network = 'livenet' | 'testnet' | 'regtest';

export interface CreateWalletOpts {
  /**
   * The coin for this wallet (e.g. btc, bch, eth). Default: btc
   * Usually the same as chain, but can be different for some chains like Arbitrum, Base, Optimism where the base currency is ETH.
   */
  coin?: string;
  /**
   * The chain for this wallet (e.g. btc, bch, eth, arb). Default: btc
   */
  chain?: string;
  /**
   * The network for this wallet (livenet, testnet, regtest). Default: livenet
   */
  network?: Network;
  /**
   * The wallet will only ever have one address. Default: false
   */
  singleAddress?: boolean;
  /**
   * Set a walletPrivKey (instead of random).
   * Note: this is NOT the main wallet private key.
   * This is a throw-away key for the multisig join secret
   * and is not used beyond the initial joining of the wallet.
   */
  walletPrivKey?: string;
  /**
   * Set an id for wallet (instead of server given)
   */
  id?: string;
  /**
   * Set addressType to P2WPKH, P2WSH, or P2TR (segwitVersion = 1)
   */
  useNativeSegwit?: boolean;
  /**
   * 0 (default) = P2WPKH, P2WSH; 1 = P2TR
   */
  segwitVersion?: number;
  /**
   * Threshold signature scheme version
   */
  tssVersion?: number;
  /**
   * Threshold signature key id
   */
  tssKeyId?: string;
};

export interface Status {
  balance: {
    availableAmount: number;
    availableConfirmedAmount: number;
    lockedAmount: number;
    lockedConfirmedAmount: number;
    totalAmount: number;
    totalConfirmedAmount: number;
    byAddress: Array<{
      address: string;
      amount: number;
      path: string;
    }>
  };
  customData?: {
    walletPrivKey?: string; // used for multisig join secret
  };
  pendingTxps: Array<any>; // TOOD
  preferences: object; // TODO
  wallet: {
    addressType: string;
    beAuthPrivateKey2?: string;
    beAuthPublicKey2?: string;
    beRegistered?: boolean;
    chain: string;
    coin: string;
    copayers: Array<{
      chain: string;
      coin: string;
      createdOn: number;
      encryptedName: string;
      id: string;
      name: string;
      requestPubKeys: Array<{ name?: string; key: string; signature: string }>;
      version: number;
    }>;
    createdOn: number;
    derivationStrategy: string;
    encryptedName: string;
    id: string;
    m: number;
    n: number;
    name: string;
    network: string;
    publicKeyRing?: Array<any>;
    scanStatus?: string;
    secret?: string;
    singleAddress: boolean;
    status: string;
    tssKeyId?: string;
    usePurpose48: boolean;
    version: string;
  };
};


export interface Note {
  walletId: string;
  body: string;
  encryptedBody?: string; // is set equal to `body` before decryption in processTxps()
  createdOn?: number;
  editedBy?: string;
  editedByName?: string;
  editedOn?: number;
  encryptedEditedByName?: string; // is set equal to `editedByName` before decryption in processTxps()
  txid?: string; 
};

export interface Txp {
  actions?: Array<{
    type?: string;
    copayerName?: string;
    comment?: string;
  }>; // TODO
  addressType: string;
  amount: number;
  chain: string;
  coin: string;
  changeAddress?: {
    address: string;
    beRegistered?: boolean;
    chain: string;
    coin: string;
    createdOn: number;
    isChange: boolean;
    isEscrow: boolean;
    network: string;
    path: string;
    publicKeys: Array<string>;
    type: string;
    version: string;
    walletId: string;
  };
  createdOn: number;
  creatorId: string;
  creatorName?: string; // might be an encrypted object
  excludeUnconfirmedUtxos: boolean;
  fee: number;
  feeLevel: string;
  feePerKb: number;
  from?: string;
  hasUnconfirmedInputs?: boolean;
  id: string;
  inputPaths: Array<string>;
  inputs?: Array<{
    address: string;
    amount: number;
    confirmations: number;
    locked: boolean;
    path: string;
    publicKeys: Array<string>;
    satoshis: number;
    scriptPubKey: string;
    spent: boolean;
    txid: string;
    vout: number;
  }>;
  isTokenSwap?: boolean;
  message?: string; // might be an encrypted object
  encryptedMessage?: string; // is set equal to `message` before decryption in processTxps()
  network: string;
  nonce?: number;
  note?: Note;
  outputOrder: Array<number>;
  outputs?: Array<{
    amount: number;
    toAddress: string;
    message?: string; // might be an encrypted object
    encryptedMessage?: string; // is set equal to `message` before decryption in processTxps()
  }>;
  payProUrl?: string;
  replaceTxByFee?: boolean;
  requiredRejections: number;
  requiredSignatures: number;
  signingMethod: string;
  status: string;
  txid?: string;
  version: number;
  walletId: string;
  walletM: number;
  walletN: number;
};

export interface PublishedTxp extends Txp {
  blockHash?: string;
  blockHeight?: number;
  category?: string;
  computeUnits?: number; // ?
  customData?: string; // ?
  data?: string; // ?
  destinationTag?: string; // XRP
  enableRBF?: boolean; // Replace-By-Fee
  gasLimit?: number;
  gasPrice?: number;
  instantAcceptanceEscrow?: boolean; // BCH
  invoiceID?: string;
  maxGasFee?: number;
  multiSendContractAddress?: string;
  multisigContractAddress?: string;
  multiTx?: boolean; //
  nonceAddress?: string; // SOL
  priorityFee?: number;
  priorityGasFee?: number;
  proposalSignature: string;
  space?: any; // ?
  tokenAddress?: string;
  txType?: number; // or string?
};

export interface Address {
  address: string;
  type: string;
  path: string;
  isChange?: boolean;
};
