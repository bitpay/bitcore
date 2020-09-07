'use strict';

var $ = require('preconditions').singleton();
import * as _ from 'lodash';
import { Constants, Utils } from './common';
import { Credentials } from './credentials';
import { BitcoreLib, BitcoreLibCash, Deriver, Transactions } from 'crypto-wallet-core';
import 'source-map-support/register';

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
  #xPrivKey: string;
  #xPrivKeyEncrypted: string;
  #version: number;
  #mnemonic: string;
  #mnemonicEncrypted: string;
  #mnemonicHasPassphrase: boolean;

  public id: any;
  public use0forBCH: boolean;
  public use44forMultisig: boolean;
  public compliantDerivation: boolean;
  public BIP45: boolean;

  public fingerPrint: string;

/*
 *  public readonly exportFields = {
 *    'xPrivKey': '#xPrivKey', 
 *    'xPrivKeyEncrypted': '#xPrivKeyEncrypted', 
 *    'mnemonic': '#mnemonic',
 *    'mnemonicEncrypted': '#mnemonicEncrypted',
 *    'version': '#version',
 *    'mnemonicHasPassphrase': 'mnemonicHasPassphrase',
 *    'fingerPrint': 'fingerPrint', //  32bit fingerprint
 *    'compliantDerivation': 'compliantDerivation',
 *    'BIP45': 'BIP45',
 *
 *    // data for derived credentials.
 *    'use0forBCH': 'use0forBCH', // use the 0 coin' path element in BCH  (legacy)
 *    'use44forMultisig': 'use44forMultisig', // use the purpose 44' for multisig wallts (legacy)
 *    'id': 'id',
 *  };
 */
  // *
  // * @param {Object} opts
  // * @param {String} opts.password   encrypting password
  // * @param {String} seedType new|extendedPrivateKey|object|mnemonic
  // * @param {String} seedData
  // */

  constructor(  opts: {
    seedType: string,
    seedData?: any,
    passphrase?: string, // seed passphrase
    password?: string, // encrypting password
    sjclOpts?: any, // options to SJCL encrypt
    use0forBCH?: boolean,
    useLegacyPurpose?: boolean,
    useLegacyCoinType?: boolean,
    nonCompliantDerivation?: boolean,
    language?: string,
  } = { seedType: 'new' } ,) {

    this.#version = 1;
    this.id = Uuid.v4();

    // bug backwards compatibility flags
    this.use0forBCH = opts.useLegacyCoinType;
    this.use44forMultisig = opts.useLegacyPurpose;
    this.compliantDerivation = !opts.nonCompliantDerivation;

    let x = opts.seedData;

    switch (opts.seedType) {
      case 'new':
        if (opts.language && !wordsForLang[opts.language]) throw new Error('Unsupported language');

        let m = new Mnemonic(wordsForLang[opts.language]);
        while (!Mnemonic.isValid(m.toString())) {
          m = new Mnemonic(wordsForLang[opts.language]);
        }
        this.setFromMnemonic(m, opts);
        break;
      case 'mnemonic':
        $.checkArgument(x, 'Need to provide opts.seedData');
        $.checkArgument(_.isString(x), 'sourceData need to be a string');
        this.setFromMnemonic(new Mnemonic(x), opts);
        break;
      case 'extendedPrivateKey':
        $.checkArgument(x, 'Need to provide opts.seedData');

        let xpriv;
        try {
          xpriv = new Bitcore.HDPrivateKey(x);
        } catch (e) {
          throw new Error('Invalid argument');
        }
        this.fingerPrint = xpriv.fingerPrint.toString('hex');

        if (opts.password) {
          this.#xPrivKeyEncrypted = sjcl.encrypt(opts.password, xpriv.toString(), opts);
          if (!this.#xPrivKeyEncrypted) throw new Error('Could not encrypt');
        } else {
          this.#xPrivKey = xpriv.toString();
        }
        this.#mnemonic = null;
        this.#mnemonicHasPassphrase = null;
        break;
      case 'object':
        $.shouldBeObject(x, 'Need to provide an object at opts.seedData');
        $.shouldBeUndefined(opts.password, 'opts.password not allowed when source is object');

        if (this.#version != x.version) {
          throw new Error('Bad Key version');
        }



        this.#xPrivKey = x.xPrivKey;
        this.#xPrivKeyEncrypted = x.xPrivKeyEncrypted;

        this.#mnemonic = x.mnemonic;
        this.#mnemonicEncrypted = x.mnemonicEncrypted;
        this.#mnemonicHasPassphrase = x.mnemonicHasPassphrase;
        this.#version = x.version;
        this.fingerPrint = x.fingerPrint;
        this.compliantDerivation = x.compliantDerivation;
        this.BIP45 = x.BIP45;
        this.id = x.id;
        this.use0forBCH = x.use0forBCH;
        this.use44forMultisig = x.use44forMultisig;
 
        $.checkState(this.#xPrivKey || this.#xPrivKeyEncrypted, 'invalid input');
        break;

      case 'objectV1':

        // Default Values for V1
        this.use0forBCH = false;
        this.use44forMultisig = false;
        this.compliantDerivation = true;
        this.id = Uuid.v4();

        if (!_.isUndefined(x.compliantDerivation))
          this.compliantDerivation =  x.compliantDerivation;
        if (!_.isUndefined(x.id))
          this.id = x.id;
 
        this.#xPrivKey = x.xPrivKey;
        this.#xPrivKeyEncrypted = x.xPrivKeyEncrypted;

        this.#mnemonic = x.mnemonic;
        this.#mnemonicEncrypted = x.mnemonicEncrypted;
        this.#mnemonicHasPassphrase = x.mnemonicHasPassphrase;
        this.#version = x.version || 1;
        this.fingerPrint = x.fingerPrint;

        // If the wallet was single seed... multisig walelts accounts
        // will be 48'
        this.use44forMultisig = x.n > 1 ? true : false;

        // if old credentials had use145forBCH...use it.
        // else,if the wallet is bch, set it to true.
        this.use0forBCH = x.use145forBCH ? false : x.coin == 'bch' ? true : false;

        this.BIP45 = x.derivationStrategy == 'BIP45';
        break;

      default:
        throw new Error('Unknown seed source: ' + opts.seedType);
    }
  }

  static match(a, b) {
    // fingerPrint is not always available (because xPriv could has
    // been imported encrypted)
    return (a.id == b.id || a.fingerPrint == b.fingerPrint);
  }

  private setFromMnemonic(m, opts: { passphrase?: string, password?: string, sjclOpts?: any }) {
    const xpriv = m.toHDPrivateKey(opts.passphrase, NETWORK);
    this.fingerPrint = xpriv.fingerPrint.toString('hex');

    if (opts.password) {
      this.#xPrivKeyEncrypted = sjcl.encrypt(opts.password, xpriv.toString(), opts.sjclOpts);
      if (!this.#xPrivKeyEncrypted) throw new Error('Could not encrypt');
      this.#mnemonicEncrypted = sjcl.encrypt(opts.password, m.phrase, opts.sjclOpts);
      if (!this.#mnemonicEncrypted) throw new Error('Could not encrypt');
    } else {
      this.#xPrivKey = xpriv.toString();
      this.#mnemonic = m.phrase;
      this.#mnemonicHasPassphrase = !!opts.passphrase;
    }
  }

  toObj = function() {
    const ret = {
      'xPrivKey': this.#xPrivKey, 
      'xPrivKeyEncrypted': this.#xPrivKeyEncrypted, 
      'mnemonic': this.#mnemonic,
      'mnemonicEncrypted': this.#mnemonicEncrypted,
      'version': this.#version,
      'mnemonicHasPassphrase': this.#mnemonicHasPassphrase,
      'fingerPrint': this.fingerPrint, //  32bit fingerprint
      'compliantDerivation': this.compliantDerivation,
      'BIP45': this.BIP45,

      // data for derived credentials.
      'use0forBCH': this.use0forBCH, 
      'use44forMultisig': this.use44forMultisig,
      'id': this.id,
    };
    return _.clone(ret);
  };

  isPrivKeyEncrypted = function() {
    return !!this.#xPrivKeyEncrypted && !this.#xPrivKey;
  };

  checkPassword = function(password) {
    if (this.isPrivKeyEncrypted()) {
      try {
        sjcl.decrypt(password, this.#xPrivKeyEncrypted);
      } catch (ex) {
        return false;
      }
      return true;
    }
    return null;
  };

  get = function(password) {
    let keys: any = {};
    let fingerPrintUpdated = false;

    if (this.isPrivKeyEncrypted()) {
      $.checkArgument(password, 'Private keys are encrypted, a password is needed');
      try {
        keys.xPrivKey = sjcl.decrypt(password, this.#xPrivKeyEncrypted);

        // update fingerPrint if not set.
        if (!this.fingerPrint) {
          let xpriv = new Bitcore.HDPrivateKey(keys.xPrivKey);
          this.fingerPrint = xpriv.fingerPrint.toString('hex');
          fingerPrintUpdated = true;
        }

        if (this.#mnemonicEncrypted) {
          keys.mnemonic = sjcl.decrypt(password, this.#mnemonicEncrypted);
        }
      } catch (ex) {
        throw new Error('Could not decrypt');
      }
    } else {

      keys.xPrivKey = this.#xPrivKey;
      keys.mnemonic = this.#mnemonic;
      if (fingerPrintUpdated) {
        keys.fingerPrintUpdated = true;
      }
    }
    return keys;
  };

  encrypt = function(password, opts) {
    if (this.#xPrivKeyEncrypted) throw new Error('Private key already encrypted');

    if (!this.#xPrivKey) throw new Error('No private key to encrypt');

    this.#xPrivKeyEncrypted = sjcl.encrypt(password, this.#xPrivKey, opts);
    if (!this.#xPrivKeyEncrypted) throw new Error('Could not encrypt');

    if (this.#mnemonic) this.#mnemonicEncrypted = sjcl.encrypt(password, this.#mnemonic, opts);

    this.#xPrivKey = null;
    this.#mnemonic = null;
  };

  decrypt = function(password) {
    if (!this.#xPrivKeyEncrypted) throw new Error('Private key is not encrypted');

    try {
      this.#xPrivKey = sjcl.decrypt(password, this.#xPrivKeyEncrypted);
      if (this.#mnemonicEncrypted) {
        this.#mnemonic = sjcl.decrypt(password, this.#mnemonicEncrypted);
      }
      this.#xPrivKeyEncrypted = null;
      this.#mnemonicEncrypted = null;
    } catch (ex) {
      log.error('error decrypting:', ex);
      throw new Error('Could not decrypt');
    }
  };

  derive = function(password, path) {
    $.checkArgument(path, 'no path at derive()');
    var xPrivKey = new Bitcore.HDPrivateKey(this.get(password).xPrivKey, NETWORK);
    var deriveFn = this.compliantDerivation
      ? _.bind(xPrivKey.deriveChild, xPrivKey)
      : _.bind(xPrivKey.deriveNonCompliantChild, xPrivKey);
    return deriveFn(path);
  };

  _checkCoin = function(coin) {
    if (!_.includes(Constants.COINS, coin)) throw new Error('Invalid coin');
  };

  _checkNetwork = function(network) {
    if (!_.includes(['livenet', 'testnet'], network)) throw new Error('Invalid network');
  };

  /*
   * This is only used on "create"
   * no need to include/support
   * BIP45
   */

  getBaseAddressDerivationPath = function(opts) {
    $.checkArgument(opts, 'Need to provide options');
    $.checkArgument(opts.n >= 1, 'n need to be >=1');

    let purpose = opts.n == 1 || this.use44forMultisig ? '44' : '48';
    var coinCode = '0';

    if (opts.network == 'testnet' && Constants.UTXO_COINS.includes(opts.coin)) {
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
    } else if (opts.coin == 'xrp') {
      coinCode = '144';
    } else {
      throw new Error('unknown coin: ' + opts.coin);
    }

    return 'm/' + purpose + "'/" + coinCode + "'/" + opts.account + "'";
  };

  /*
   * opts.coin
   * opts.network
   * opts.account
   * opts.n
   */

  createCredentials = function(password, opts) {
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
    let requestPrivKey = this.derive(password, Constants.PATHS.REQUEST_KEY).privateKey.toString();

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

  createAccess = function(password, opts) {
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

  sign = function(rootPath, txp, password, cb) {
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
      _.each(txp.inputs, function(i) {
        $.checkState(i.path, 'Input derivation path not available (signing transaction)');
        if (!derived[i.path]) {
          derived[i.path] = xpriv.deriveChild(i.path).privateKey;
          privs.push(derived[i.path]);
        }
      });

      var signatures = _.map(privs, function(priv, i) {
        return t.getSignatures(priv, undefined, txp.signingMethod);
      });

      signatures = _.map(_.sortBy(_.flatten(signatures), 'inputIndex'), function(s) {
        return s.signature.toDER(txp.signingMethod).toString('hex');
      });

      return signatures;
    } else {
      let tx = t.uncheckedSerialize();
      tx = typeof tx === 'string' ? [tx] : tx;
      const chain = Utils.getChain(txp.coin);
      const txArray = _.isArray(tx) ? tx : [tx];
      const isChange = false;
      const addressIndex = 0;
      const { privKey, pubKey } = Deriver.derivePrivateKey(chain, txp.network, derived, addressIndex, isChange);
      let signatures = [];
      for (const rawTx of txArray) {
        const signed = Transactions.getSignature({
          chain,
          tx: rawTx,
          key: { privKey, pubKey }
        });
        signatures.push(signed);
      }
      return signatures;
    }
  };
}
