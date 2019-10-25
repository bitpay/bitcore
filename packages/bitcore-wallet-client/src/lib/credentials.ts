'use strict';

import { BitcoreLib } from 'crypto-wallet-core';

import { Constants, Utils } from './common';
const $ = require('preconditions').singleton();
const _ = require('lodash');

const Bitcore = BitcoreLib;
const sjcl = require('sjcl');

export class Credentials {
  static FIELDS = [
    'coin',
    'network',
    'xPrivKey', // obsolete
    'xPrivKeyEncrypted', // obsolte
    'xPubKey',
    'requestPrivKey',
    'requestPubKey',
    'copayerId',
    'publicKeyRing',
    'walletId',
    'walletName',
    'm',
    'n',
    'walletPrivKey',
    'personalEncryptingKey',
    'sharedEncryptingKey',
    'copayerName',
    'externalSource',
    'mnemonic', // Obsolete
    'mnemonicEncrypted', // Obsolete
    'entropySource',
    'mnemonicHasPassphrase',
    'derivationStrategy',
    'account',
    'compliantDerivation',
    'addressType',
    'hwInfo', // Obsolete
    'entropySourcePath', // Obsolete
    'use145forBCH', // Obsolete
    'version',
    'rootPath', // this is only for information
    'keyId' // this is only for information
  ];
  version: number;
  account: number;
  walletPrivKey: any;
  sharedEncryptingKey: any;
  walletId: any;
  walletName: any;
  m: any;
  n: any;
  copayerName: any;
  xPubKey: any;
  requestPubKey: any;
  publicKeyRing: any;
  rootPath: any;
  derivationStrategy: any;
  network: string;
  coin: string;
  use145forBCH: any;
  addressType: string;
  keyId: string;

  externalSource?: boolean; // deprecated property?

  constructor() {
    this.version = 2;
    this.account = 0;
  }

  /*
   *coin, xPrivKey, account, network
   */

  static fromDerivedKey(opts) {
    $.shouldBeString(opts.coin);
    $.shouldBeString(opts.network);
    $.shouldBeNumber(opts.account, 'Invalid account');
    $.shouldBeString(opts.xPubKey, 'Invalid xPubKey');
    $.shouldBeString(opts.rootPath, 'Invalid rootPath');
    $.shouldBeString(opts.keyId, 'Invalid keyId');
    $.shouldBeString(opts.requestPrivKey, 'Invalid requestPrivKey');
    $.checkArgument(_.isUndefined(opts.nonCompliantDerivation));
    opts = opts || {};

    var x: any = new Credentials();
    x.coin = opts.coin;
    x.network = opts.network;
    x.account = opts.account;
    x.n = opts.n;
    x.xPubKey = opts.xPubKey;
    x.keyId = opts.keyId;

    // this allows to set P2SH in old n=1 wallets
    if (_.isUndefined(opts.addressType)) {
      x.addressType =
        opts.n == 1
          ? Constants.SCRIPT_TYPES.P2PKH
          : Constants.SCRIPT_TYPES.P2SH;
    } else {
      x.addressType = opts.addressType;
    }

    // Only  used for info
    x.rootPath = opts.rootPath;

    if (opts.walletPrivKey) {
      x.addWalletPrivateKey(opts.walletPrivKey);
    }
    x.requestPrivKey = opts.requestPrivKey;

    const priv = Bitcore.PrivateKey(x.requestPrivKey);
    x.requestPubKey = priv.toPublicKey().toString();

    const prefix = 'personalKey';
    const entropySource = Bitcore.crypto.Hash.sha256(priv.toBuffer()).toString(
      'hex'
    );
    const b = Buffer.from(entropySource, 'hex');
    const b2 = Bitcore.crypto.Hash.sha256hmac(b, Buffer.from(prefix));
    x.personalEncryptingKey = b2.slice(0, 16).toString('base64');
    x.copayerId = Utils.xPubToCopayerId(x.coin, x.xPubKey);
    x.publicKeyRing = [
      {
        xPubKey: x.xPubKey,
        requestPubKey: x.requestPubKey
      }
    ];

    return x;
  }
  getRootPath() {
    // This is for OLD v1.0 credentials only.
    var legacyRootPath = () => {
      // legacy base path schema
      var purpose;
      switch (this.derivationStrategy) {
        case Constants.DERIVATION_STRATEGIES.BIP45:
          return "m/45'";
        case Constants.DERIVATION_STRATEGIES.BIP44:
          purpose = '44';
          break;
        case Constants.DERIVATION_STRATEGIES.BIP48:
          purpose = '48';
          break;
      }

      var coin = '0';
      if (this.network != 'livenet' && this.coin !== 'eth') {
        coin = '1';
      } else if (this.coin == 'bch') {
        if (this.use145forBCH) {
          coin = '145';
        } else {
          coin = '0';
        }
      } else if (this.coin == 'btc') {
        coin = '0';
      } else if (this.coin == 'eth') {
        coin = '60';
      } else {
        throw new Error('unknown coin: ' + this.coin);
      }
      return 'm/' + purpose + "'/" + coin + "'/" + this.account + "'";
    };

    if (!this.rootPath) {
      this.rootPath = legacyRootPath();
    }
    return this.rootPath;
  }

  static fromObj(obj) {
    var x: any = new Credentials();

    if (!obj.version || obj.version < x.version) {
      throw new Error('Obsolete credentials version');
    }

    if (obj.version != x.version) {
      throw new Error('Bad credentials version');
    }

    _.each(Credentials.FIELDS, function (k) {
      x[k] = obj[k];
    });

    if (x.externalSource) {
      throw new Error('External Wallets are no longer supported');
    }

    x.coin = x.coin || 'btc';
    x.addressType = x.addressType || Constants.SCRIPT_TYPES.P2SH;
    x.account = x.account || 0;

    $.checkState(
      x.xPrivKey || x.xPubKey || x.xPrivKeyEncrypted,
      'invalid input'
    );
    return x;
  }

  toObj() {
    var self = this;

    var x = {};
    _.each(Credentials.FIELDS, function (k) {
      x[k] = self[k];
    });
    return x;
  }
  addWalletPrivateKey(walletPrivKey) {
    this.walletPrivKey = walletPrivKey;
    this.sharedEncryptingKey = Utils.privateKeyToAESKey(walletPrivKey);
  }

  addWalletInfo(walletId, walletName, m, n, copayerName, opts) {
    opts = opts || {};
    this.walletId = walletId;
    this.walletName = walletName;
    this.m = m;

    if (this.n != n && !opts.allowOverwrite) {
      // we always allow multisig n overwrite
      if (this.n == 1 || n == 1) {
        throw new Error(
          `Bad nr of copayers in addWalletInfo: this: ${this.n} got: ${n}`
        );
      }
    }

    this.n = n;

    if (copayerName) this.copayerName = copayerName;

    if (n == 1) {
      this.addPublicKeyRing([
        {
          xPubKey: this.xPubKey,
          requestPubKey: this.requestPubKey
        }
      ]);
    }
  }

  hasWalletInfo() {
    return !!this.walletId;
  }

  addPublicKeyRing(publicKeyRing) {
    this.publicKeyRing = _.clone(publicKeyRing);
  }

  isComplete() {
    if (!this.m || !this.n) return false;
    if (!this.publicKeyRing || this.publicKeyRing.length != this.n)
      return false;
    return true;
  }
}
