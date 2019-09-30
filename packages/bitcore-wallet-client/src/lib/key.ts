'use strict';

var $ = require('preconditions').singleton();
import * as _ from 'lodash';
import { Constants, Utils } from './common';
import { Credentials } from './credentials';

import { BitcoreLib, Transactions } from 'crypto-wallet-core';

var Bitcore = BitcoreLib;
var Mnemonic = require('bitcore-mnemonic');
var sjcl = require('sjcl');
var log = require('./log');
const async = require('async');
const Uuid = require('uuid');

var Errors = require('./errors');

const wordsForLang: any = {
  en: Mnemonic.Words.ENGLISH,
  es: Mnemonic.Words.SPANISH,
  ja: Mnemonic.Words.JAPANESE,
  zh: Mnemonic.Words.CHINESE,
  fr: Mnemonic.Words.FRENCH,
  it: Mnemonic.Words.ITALIAN
};

// we always set 'livenet' for xprivs. it has not consecuences
// other than the serialization
const NETWORK: string = 'livenet';
export class Key {
  version: number;
  use0forBCH: boolean;
  use44forMultisig: boolean;
  compliantDerivation: boolean;
  id: any;

  static FIELDS = [
    'xPrivKey', // obsolte
    'xPrivKeyEncrypted', // obsolte
    'mnemonic',
    'mnemonicEncrypted',
    'mnemonicHasPassphrase',
    'fingerPrint', // BIP32  32bit fingerprint
    'compliantDerivation',
    'BIP45',

    // data for derived credentials.
    'use0forBCH', // use the 0 coin' path element in BCH  (legacy)
    'use44forMultisig', // use the purpose 44' for multisig wallts (legacy)
    'version',
    'id'
  ];
  constructor() {
    this.version = 1;
    this.use0forBCH = false;
    this.use44forMultisig = false;
    this.compliantDerivation = true;
    this.id = Uuid.v4();
  }

  static match(a, b) {
    return a.id == b.id;
  }

  static create = function (opts) {
    opts = opts || {};
    if (opts.language && !wordsForLang[opts.language])
      throw new Error('Unsupported language');

    var m = new Mnemonic(wordsForLang[opts.language]);
    while (!Mnemonic.isValid(m.toString())) {
      m = new Mnemonic(wordsForLang[opts.language]);
    }

    let x: any = new Key();
    let xpriv = m.toHDPrivateKey(opts.passphrase, NETWORK);
    x.xPrivKey = xpriv.toString();
    x.fingerPrint = xpriv.fingerPrint.toString('hex');

    x.mnemonic = m.phrase;
    x.mnemonicHasPassphrase = !!opts.passphrase;

    // bug backwards compatibility flags
    x.use0forBCH = opts.useLegacyCoinType;
    x.use44forMultisig = opts.useLegacyPurpose;

    x.compliantDerivation = !opts.nonCompliantDerivation;

    return x;
  };

  static fromMnemonic = function (words, opts) {
    $.checkArgument(words);
    if (opts) $.shouldBeObject(opts);
    opts = opts || {};

    var m = new Mnemonic(words);
    var x: any = new Key();
    let xpriv = m.toHDPrivateKey(opts.passphrase, NETWORK);
    x.xPrivKey = xpriv.toString();
    x.fingerPrint = xpriv.fingerPrint.toString('hex');
    x.mnemonic = words;
    x.mnemonicHasPassphrase = !!opts.passphrase;

    x.use0forBCH = opts.useLegacyCoinType;
    x.use44forMultisig = opts.useLegacyPurpose;

    x.compliantDerivation = !opts.nonCompliantDerivation;

    return x;
  };

  static fromExtendedPrivateKey = function (xPriv, opts) {
    $.checkArgument(xPriv);
    opts = opts || {};

    let xpriv;
    try {
      xpriv = new Bitcore.HDPrivateKey(xPriv);
    } catch (e) {
      throw new Error('Invalid argument');
    }

    var x: any = new Key();
    x.xPrivKey = xpriv.toString();
    x.fingerPrint = xpriv.fingerPrint.toString('hex');

    x.mnemonic = null;
    x.mnemonicHasPassphrase = null;

    x.use44forMultisig = opts.useLegacyPurpose;
    x.use0forBCH = opts.useLegacyCoinType;

    x.compliantDerivation = !opts.nonCompliantDerivation;
    return x;
  };

  static fromObj = function (obj) {
    $.shouldBeObject(obj);

    var x: any = new Key();
    if (obj.version != x.version) {
      throw new Error('Bad Key version');
    }

    _.each(Key.FIELDS, function (k) {
      x[k] = obj[k];
    });

    $.checkState(x.xPrivKey || x.xPrivKeyEncrypted, 'invalid input');
    return x;
  };

  toObj = function () {
    var self = this;

    var x = {};
    _.each(Key.FIELDS, function (k) {
      x[k] = self[k];
    });
    return x;
  };

  isPrivKeyEncrypted = function () {
    return !!this.xPrivKeyEncrypted && !this.xPrivKey;
  };

  checkPassword = function (password) {
    if (this.isPrivKeyEncrypted()) {
      try {
        sjcl.decrypt(password, this.xPrivKeyEncrypted);
      } catch (ex) {
        return false;
      }
      return true;
    }
    return null;
  };

  get = function (password) {
    var keys: any = {};
    let fingerPrintUpdated = false;

    if (this.isPrivKeyEncrypted()) {
      $.checkArgument(
        password,
        'Private keys are encrypted, a password is needed'
      );
      try {
        keys.xPrivKey = sjcl.decrypt(password, this.xPrivKeyEncrypted);

        // update fingerPrint if not set.
        if (!this.fingerPrint) {
          let xpriv = new Bitcore.HDPrivateKey(keys.xPrivKey);
          this.fingerPrint = xpriv.fingerPrint.toString('hex');
          fingerPrintUpdated = true;
        }

        if (this.mnemonicEncrypted) {
          keys.mnemonic = sjcl.decrypt(password, this.mnemonicEncrypted);
        }
      } catch (ex) {
        throw new Error('Could not decrypt');
      }
    } else {
      keys.xPrivKey = this.xPrivKey;
      keys.mnemonic = this.mnemonic;
      if (fingerPrintUpdated) {
        keys.fingerPrintUpdated = true;
      }
    }
    return keys;
  };

  encrypt = function (password, opts) {
    if (this.xPrivKeyEncrypted)
      throw new Error('Private key already encrypted');

    if (!this.xPrivKey) throw new Error('No private key to encrypt');

    this.xPrivKeyEncrypted = sjcl.encrypt(password, this.xPrivKey, opts);
    if (!this.xPrivKeyEncrypted) throw new Error('Could not encrypt');

    if (this.mnemonic)
      this.mnemonicEncrypted = sjcl.encrypt(password, this.mnemonic, opts);

    delete this.xPrivKey;
    delete this.mnemonic;
  };

  decrypt = function (password) {
    if (!this.xPrivKeyEncrypted)
      throw new Error('Private key is not encrypted');

    try {
      this.xPrivKey = sjcl.decrypt(password, this.xPrivKeyEncrypted);
      if (this.mnemonicEncrypted) {
        this.mnemonic = sjcl.decrypt(password, this.mnemonicEncrypted);
      }
      delete this.xPrivKeyEncrypted;
      delete this.mnemonicEncrypted;
    } catch (ex) {
      log.error('error decrypting:', ex);
      throw new Error('Could not decrypt');
    }
  };

  derive = function (password, path) {
    $.checkArgument(path, 'no path at derive()');
    var xPrivKey = new Bitcore.HDPrivateKey(
      this.get(password).xPrivKey,
      NETWORK
    );
    var deriveFn = this.compliantDerivation
      ? _.bind(xPrivKey.deriveChild, xPrivKey)
      : _.bind(xPrivKey.deriveNonCompliantChild, xPrivKey);
    return deriveFn(path);
  };

  _checkCoin(coin) {
    if (!_.includes(Constants.COINS, coin)) throw new Error('Invalid coin');
  }

  _checkNetwork(network) {
    if (!_.includes(['livenet', 'testnet'], network))
      throw new Error('Invalid network');
  }

  /*
   * This is only used on "create"
   * no need to include/support
   * BIP45
   */

  getBaseAddressDerivationPath(opts) {
    $.checkArgument(opts, 'Need to provide options');
    $.checkArgument(opts.n >= 1, 'n need to be >=1');

    let purpose = opts.n == 1 || this.use44forMultisig ? '44' : '48';
    var coinCode = '0';

    if (opts.network == 'testnet' && opts.coin !== 'eth') {
      coinCode = '1';
    } else if (opts.coin == 'bch') {
      if (this.use0forBCH) {
        coinCode = '0';
      } else {
        coinCode = '145';
      }
    } else if (opts.coin == 'btc') {
      coinCode = '0';
    } else if (opts.coin == 'eth') {
      coinCode = '60';
    } else {
      throw new Error('unknown coin: ' + opts.coin);
    }

    return 'm/' + purpose + "'/" + coinCode + "'/" + opts.account + "'";
  }

  /*
   * opts.coin
   * opts.network
   * opts.account
   * opts.n
   */

  createCredentials = function (password, opts) {
    opts = opts || {};

    if (password) $.shouldBeString(password, 'provide password');

    this._checkCoin(opts.coin);
    this._checkNetwork(opts.network);
    $.shouldBeNumber(opts.account, 'Invalid account');
    $.shouldBeNumber(opts.n, 'Invalid n');

    $.shouldBeUndefined(opts.useLegacyCoinType);
    $.shouldBeUndefined(opts.useLegacyPurpose);

    let path = this.getBaseAddressDerivationPath(opts);
    let xPrivKey = this.derive(password, path);
    let requestPrivKey = this.derive(
      password,
      Constants.PATHS.REQUEST_KEY
    ).privateKey.toString();

    if (opts.network == 'testnet') {
      // Hacky: BTC/BCH xPriv depends on network: This code is to
      // convert a livenet xPriv to a testnet xPriv
      let x = xPrivKey.toObject();
      x.network = 'testnet';
      delete x.xprivkey;
      delete x.checksum;
      x.privateKey = _.padStart(x.privateKey, 64, '0');
      xPrivKey = new Bitcore.HDPrivateKey(x);
    }

    return Credentials.fromDerivedKey({
      xPubKey: xPrivKey.hdPublicKey.toString(),
      coin: opts.coin,
      network: opts.network,
      account: opts.account,
      n: opts.n,
      rootPath: path,
      keyId: this.id,
      requestPrivKey,
      addressType: opts.addressType,
      walletPrivKey: opts.walletPrivKey
    });
  };

  /*
   * opts
   * opts.path
   * opts.requestPrivKey
   */

  createAccess = function (password, opts) {
    opts = opts || {};
    $.shouldBeString(opts.path);

    var requestPrivKey = new Bitcore.PrivateKey(opts.requestPrivKey || null);
    var requestPubKey = requestPrivKey.toPublicKey().toString();

    var xPriv = this.derive(password, opts.path);
    var signature = Utils.signRequestPubKey(requestPubKey, xPriv);
    requestPrivKey = requestPrivKey.toString();

    return {
      signature,
      requestPrivKey
    };
  };

  sign = function (rootPath, txp, password, cb) {
    $.shouldBeString(rootPath);
    if (this.isPrivKeyEncrypted() && !password) {
      return cb(new Errors.ENCRYPTED_PRIVATE_KEY());
    }
    var privs = [];
    var derived: any = {};

    var derived = this.derive(password, rootPath);
    var xpriv = new Bitcore.HDPrivateKey(derived);

    var t = Utils.buildTx(txp);

    if (Constants.UTXO_COINS.includes(txp.coin)) {
      _.each(txp.inputs, function (i) {
        $.checkState(i.path, 'Input derivation path not available (signing transaction)');
        if (!derived[i.path]) {
          derived[i.path] = xpriv.deriveChild(i.path).privateKey;
          privs.push(derived[i.path]);
        }
      });

      var signatures = _.map(privs, function (priv, i) {
        return t.getSignatures(priv);
      });

      signatures = _.map(_.sortBy(_.flatten(signatures), 'inputIndex'), function (s) {
        return s.signature.toDER().toString('hex');
      });

      return signatures;
    } else {
      const addressPath = Constants.PATHS.SINGLE_ADDRESS;
      const privKey = xpriv.deriveChild(addressPath).privateKey;
      const tx = t.uncheckedSerialize();
      const signature = Transactions.getSignature({
        chain: txp.coin.toUpperCase(),
        tx,
        key: { privKey: privKey.toString('hex') },
      });

      return [signature];
    }
  };
}
