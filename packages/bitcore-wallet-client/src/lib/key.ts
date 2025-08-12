'use strict';

import async from 'async'
import Mnemonic from 'bitcore-mnemonic';
import {
  BitcoreLib as Bitcore,
  Deriver,
  Transactions
} from 'crypto-wallet-core';
import { singleton } from 'preconditions';
import sjcl from 'sjcl';
import 'source-map-support/register';
import Uuid from 'uuid';
import { Constants, Utils } from './common';
import { Credentials } from './credentials';
import { Errors } from './errors';
import log from './log';

const $ = singleton();

const wordsForLang: any = {
  en: Mnemonic.Words.ENGLISH,
  es: Mnemonic.Words.SPANISH,
  ja: Mnemonic.Words.JAPANESE,
  zh: Mnemonic.Words.CHINESE,
  fr: Mnemonic.Words.FRENCH,
  it: Mnemonic.Words.ITALIAN
};

// we always set 'livenet' for xprivs. it has no consequences
// other than the serialization
const NETWORK: string = 'livenet';
const ALGOS_BY_CHAIN =  {
  default: Constants.ALGOS.ECDSA,
  sol: Constants.ALGOS.EDDSA,
}
const SUPPORTED_ALGOS = [Constants.ALGOS.ECDSA, Constants.ALGOS.EDDSA];
const ALGO_TO_KEY_TYPE = {
  ECDSA: 'Bitcoin',
  EDDSA: 'ed25519'
}

export interface KeyOptions {
  id?: string;
  seedType: string;
  seedData?: any;
  passphrase?: string; // seed passphrase
  password?: string; // encrypting password
  sjclOpts?: any; // options to SJCL encrypt
  use0forBCH?: boolean;
  useLegacyPurpose?: boolean;
  useLegacyCoinType?: boolean;
  nonCompliantDerivation?: boolean;
  language?: string;
  algo?: string; // eddsa or ecdsa (Bitcoin) by default
};
interface AddKeyOptions {
  passphrase?: string;
  password?: string;
  sjclOpts?: any;
  algo?: string;
  existingAlgo?: string;
}

interface SetFromMnemonicOptions {
  passphrase?: string;
  algo?: string;
  password?: string;
  sjclOpts?: any;
}

export class Key {
  // ecdsa
  #xPrivKey: string;
  #xPrivKeyEncrypted: string;
  // eddsa
  #xPrivKeyEDDSA: string;
  #xPrivKeyEDDSAEncrypted: string;
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
  public fingerPrintEDDSA: string
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
  
  /**
   * @param {Object} opts
   * @param {String} opts.password   encrypting password
   * @param {String} seedType new|extendedPrivateKey|object|mnemonic
   * @param {String} seedData
   */
  constructor(opts: KeyOptions = { seedType: 'new' }) {
    this.#version = 1;
    this.id = opts.id || Uuid.v4();
    // bug backwards compatibility flags
    this.use0forBCH = opts.useLegacyCoinType;
    this.use44forMultisig = opts.useLegacyPurpose;
    this.compliantDerivation = !opts.nonCompliantDerivation;
    let x = opts.seedData;

    switch (opts.seedType) {
      case 'new':
        if (opts.language && !wordsForLang[opts.language])
          throw new Error('Unsupported language');

        let m = new Mnemonic(wordsForLang[opts.language]);
        while (!Mnemonic.isValid(m.toString())) {
          m = new Mnemonic(wordsForLang[opts.language]);
        }
        this.setFromMnemonic(m, opts);
        break;
      case 'mnemonic':
        $.checkArgument(x, 'Need to provide opts.seedData');
        $.checkArgument(typeof x === 'string', 'sourceData need to be a string');
        this.setFromMnemonic(new Mnemonic(x), opts);
        break;
      case 'extendedPrivateKey':
        $.checkArgument(x, 'Need to provide opts.seedData');
        this.setFromExtendedPrivateKey(x, opts);
        break;
      case 'object':
        $.shouldBeObject(x, 'Need to provide an object at opts.seedData');
        $.shouldBeUndefined(
          opts.password,
          'opts.password not allowed when source is object'
        );

        if (this.#version != x.version) {
          throw new Error('Bad Key version');
        }

        this.#xPrivKey = x.xPrivKey;
        this.#xPrivKeyEncrypted = x.xPrivKeyEncrypted;
        this.#xPrivKeyEDDSA = x.xPrivKeyEDDSA;
        this.#xPrivKeyEDDSAEncrypted = x.xPrivKeyEDDSAEncrypted;

        this.#mnemonic = x.mnemonic;
        this.#mnemonicEncrypted = x.mnemonicEncrypted;
        this.#mnemonicHasPassphrase = x.mnemonicHasPassphrase;
        this.#version = x.version;
        this.fingerPrint = x.fingerPrint;
        this.fingerPrintEDDSA = x.fingerPrintEDDSA;
        this.compliantDerivation = x.compliantDerivation;
        this.BIP45 = x.BIP45;
        this.id = x.id;
        this.use0forBCH = x.use0forBCH;
        this.use44forMultisig = x.use44forMultisig;

        $.checkState(
          this.#xPrivKey || this.#xPrivKeyEncrypted,
          'Failed state:  #xPrivKey || #xPrivKeyEncrypted at Key constructor'
        );
        break;

      case 'objectV1':
        // Default Values for V1
        this.use0forBCH = false;
        this.use44forMultisig = false;
        this.compliantDerivation = true;
        this.id = Uuid.v4();

        if (x.compliantDerivation != null)
          this.compliantDerivation = x.compliantDerivation;
        if (x.id != null) this.id = x.id;

        this.#xPrivKey = x.xPrivKey;
        this.#xPrivKeyEncrypted = x.xPrivKeyEncrypted;
        this.#xPrivKeyEDDSA = x.xPrivKeyEDDSA;
        this.#xPrivKeyEDDSAEncrypted = x.xPrivKeyEDDSAEncrypted;

        this.#mnemonic = x.mnemonic;
        this.#mnemonicEncrypted = x.mnemonicEncrypted;
        this.#mnemonicHasPassphrase = x.mnemonicHasPassphrase;
        this.#version = x.version || 1;
        this.fingerPrint = x.fingerPrint;
        this.fingerPrintEDDSA = x.fingerPrintEDDSA;

        // If the wallet was single seed... multisig walelts accounts
        // will be 48'
        this.use44forMultisig = x.n > 1 ? true : false;

        // if old credentials had use145forBCH...use it.
        // else,if the wallet is bch, set it to true.
        this.use0forBCH = x.use145forBCH
          ? false
          : x.coin == 'bch'
            ? true
            : false;

        this.BIP45 = x.derivationStrategy == 'BIP45';
        break;

      default:
        throw new Error('Unknown seed source: ' + opts.seedType);
    }
  }

  static match(a, b) {
    // fingerPrint is not always available (because xPriv could have been imported encrypted)
    return a.id == b.id || a.fingerPrint == b.fingerPrint || a.fingerPrintEDDSA == b.fingerPrintEDDSA;
  }

  private setFromMnemonic(m, opts: SetFromMnemonicOptions) {
    const algos = opts.algo ? [opts.algo] : SUPPORTED_ALGOS;
    for (const algo of algos) {
      const xpriv = m.toHDPrivateKey(opts.passphrase, NETWORK, ALGO_TO_KEY_TYPE[algo]);
      this.#setFingerprint({ value: xpriv.fingerPrint.toString('hex'), algo });

      if (opts.password) {
        this.#setPrivKeyEncrypted({
          value: sjcl.encrypt(
            opts.password,
            xpriv.toString(),
            opts.sjclOpts),
          algo
        });
        if (!this.#getPrivKeyEncrypted({ algo })) throw new Error('Could not encrypt');
        this.#mnemonicEncrypted = sjcl.encrypt(
          opts.password,
          m.phrase,
          opts.sjclOpts
        );
        if (!this.#mnemonicEncrypted) throw new Error('Could not encrypt');
      } else {
        this.#setPrivKey({ value: xpriv.toString(), algo });
        this.#mnemonic = m.phrase;
        this.#mnemonicHasPassphrase = !!opts.passphrase;
      }
    }
  }

  private setFromExtendedPrivateKey (extendedPrivateKey, opts: { password?: string; algo?: string }) {
    let xpriv;
    if (this.#mnemonic || this.#mnemonicEncrypted) {
      throw new Error('Set key from existing mnemonic')
    }
    try {
      xpriv = new Bitcore.HDPrivateKey(extendedPrivateKey);
    } catch (e) {
      throw new Error('Invalid argument');
    }
    const algos = opts.algo ? [opts.algo] : SUPPORTED_ALGOS;
    for (const algo of algos) {
      const params = { algo }
      this.#setFingerprint({ value: xpriv.fingerPrint.toString('hex'),  ...params });
      if (opts.password) {
        this.#setPrivKeyEncrypted({
          value: sjcl.encrypt(
            opts.password,
            xpriv.toString(),
            opts
          ),
          ...params
        });
        const xPrivKeyEncrypted = this.#getPrivKeyEncrypted(params);
        if (!xPrivKeyEncrypted) throw new Error('Could not encrypt');
      } else {
        this.#setPrivKey({ value: xpriv.toString(), ...params }); 
      }
    }
    this.#mnemonic = null;
    this.#mnemonicHasPassphrase = null;
  }
  
  /**
   * Adds an additional supported key to the object
   * By default it creates the new key based on the existing bitcoin key (ECDSA)
   */
  addKeyByAlgorithm(algo: string, opts: AddKeyOptions = {}) {
    const existingAlgo = opts.existingAlgo || 'ECDSA';

    if (this.#mnemonic) {
      this.#addKeyFromMnemonic(algo, this.#mnemonic, opts);
      return;
    }
    if (this.#mnemonicEncrypted) {
      this.#validatePassword(opts.password);
      this.#addKeyFromMnemonic(algo, this.#mnemonicEncrypted, opts);
      return;
    }
    if (this.#hasExistingPrivateKey(existingAlgo)) {
      this.#addKeyFromExistingPrivateKey(algo, existingAlgo, opts);
      return;
    }

    throw new Error(`No key source available. Missing private key for algorithm: ${existingAlgo}`);
  }
  
  /**
   * Creates key from plain mnemonic
   */
  #addKeyFromMnemonic(algo: string, mnemonic: string, opts: AddKeyOptions) {
    const mnemonicOpts: SetFromMnemonicOptions = { algo, ...opts };
    
    if (this.#mnemonicHasPassphrase) {
      this.#validatePassphrase(opts.passphrase);
      mnemonicOpts.passphrase = opts.passphrase;
    }
    
    this.setFromMnemonic(new Mnemonic(mnemonic), mnemonicOpts);
  }
  
  /**
   * Creates key from existing private key (encrypted or plain)
   */
  #addKeyFromExistingPrivateKey(algo: string, existingAlgo: string, opts: AddKeyOptions) {
    const encryptedPrivKey = this.#getPrivKeyEncrypted({ algo: existingAlgo });
    
    if (encryptedPrivKey) {
      this.#validatePassword(opts.password);
      const xPriv = sjcl.decrypt(opts.password!, encryptedPrivKey);
      this.setFromExtendedPrivateKey(xPriv, { algo, password: opts.password });
    } else {
      const xPriv = this.#getPrivKey({ algo: existingAlgo });
      this.setFromExtendedPrivateKey(xPriv, { algo });
    }
  }
  
  #hasExistingPrivateKey(existingAlgo: string): boolean {
    return !!(this.#getPrivKeyEncrypted({ algo: existingAlgo }) || this.#getPrivKey({ algo: existingAlgo }));
  }
  
  #validatePassword(password?: string) {
    if (!password) {
      throw new Error('Password is required for encrypted content');
    }
  }

  #validatePassphrase(passphrase?: string) {
    if (!passphrase) {
      throw new Error('Passphrase is required for mnemonic with passphrase');
    }
  }

  toObj() {
    const ret = {
      xPrivKey: this.#xPrivKey,
      xPrivKeyEncrypted: this.#xPrivKeyEncrypted,
      xPrivKeyEDDSA: this.#xPrivKeyEDDSA,
      xPrivKeyEDDSAEncrypted: this.#xPrivKeyEDDSAEncrypted,
      mnemonic: this.#mnemonic,
      mnemonicEncrypted: this.#mnemonicEncrypted,
      version: this.#version,
      mnemonicHasPassphrase: this.#mnemonicHasPassphrase,
      fingerPrint: this.fingerPrint, //  32bit fingerprint
      fingerPrintEDDSA: this.fingerPrintEDDSA,
      compliantDerivation: this.compliantDerivation,
      BIP45: this.BIP45,

      // data for derived credentials.
      use0forBCH: this.use0forBCH,
      use44forMultisig: this.use44forMultisig,
      id: this.id
    };
    return JSON.parse(JSON.stringify(ret));
  };

  isPrivKeyEncrypted(algo?) {
    switch (String(algo).toUpperCase()) {
      case (Constants.ALGOS.EDDSA):
        return !!this.#xPrivKeyEDDSAEncrypted && !this.#xPrivKeyEDDSA;
      default:
        return !!this.#xPrivKeyEncrypted && !this.#xPrivKey;
    }
  };

  checkPassword(password, algo?) {
    if (this.isPrivKeyEncrypted(algo)) {
      try {
        sjcl.decrypt(password, this.#getPrivKeyEncrypted({ algo }));
      } catch (ex) {
        return false;
      }
      return true;
    }
    return null;
  };

  get(password, algo?) {
    let keys: any = {};

    if (this.isPrivKeyEncrypted(algo)) {
      $.checkArgument(
        password,
        'Private keys are encrypted, a password is needed'
      );
      try {
        const xPrivKeyEncrypted = this.#getPrivKeyEncrypted({ algo });
        keys.xPrivKey = sjcl.decrypt(password, xPrivKeyEncrypted);

        if (this.#mnemonicEncrypted) {
          keys.mnemonic = sjcl.decrypt(password, this.#mnemonicEncrypted);
        }
      } catch (ex) {
        throw new Error('Could not decrypt');
      }
    } else {
      keys.xPrivKey = this.#getPrivKey({ algo });
      keys.mnemonic = this.#mnemonic;
    }
    // update fingerPrint if not set.
    if (!this.#getFingerprint({ algo })) {
      const xpriv = new Bitcore.HDPrivateKey(keys.xPrivKey);
      const fingerPrint = xpriv.fingerPrint.toString('hex');
      this.#setFingerprint({ value: fingerPrint, algo });
      keys.fingerPrintUpdated = true;keys.fingerPrintUpdated = true;
    }
    keys.mnemonicHasPassphrase = this.#mnemonicHasPassphrase || false;
    return keys;
  };

  encrypt(password, opts, algo?) {
    if (this.#getPrivKeyEncrypted({ algo }))
      throw new Error('Private key already encrypted');

    if (!this.#getPrivKey({ algo })) throw new Error('No private key to encrypt');

    const encryptedPrivKey = sjcl.encrypt(password, this.#getPrivKey({ algo }), opts);
    this.#setPrivKeyEncrypted({ algo, value: encryptedPrivKey });
    if (!this.#getPrivKeyEncrypted({ algo })) throw new Error('Could not encrypt');

    if (this.#mnemonic)
      this.#mnemonicEncrypted = sjcl.encrypt(password, this.#mnemonic, opts);

    this.#setPrivKey({ algo, value: null });
    this.#mnemonic = null;
  };

  decrypt(password, algo?) {
    if (!this.#getPrivKeyEncrypted({ algo }))
      throw new Error('Private key is not encrypted');

    try {
      const decryptedPrivKey = sjcl.decrypt(password, this.#getPrivKeyEncrypted({ algo }));
      this.#setPrivKey({ algo, value: decryptedPrivKey });
      if (this.#mnemonicEncrypted) {
        this.#mnemonic = sjcl.decrypt(password, this.#mnemonicEncrypted);
      }
      this.#setPrivKeyEncrypted({ algo, value: null })
      this.#mnemonicEncrypted = null;
    } catch (ex) {
      log.error('error decrypting:', ex);
      throw new Error('Could not decrypt');
    }
  };

  derive(password, path, algo?): Bitcore.HDPrivateKey {
    $.checkArgument(path, 'no path at derive()');
    if (String(algo).toUpperCase() === Constants.ALGOS.EDDSA) {
      const key = this.#getChildKeyEDDSA(password, path);
      return new Bitcore.HDPrivateKey({
        network: NETWORK,
        depth: 1,
        parentFingerPrint: Buffer.from(this.#getFingerprint({ algo }), 'hex'),
        childIndex: 0,
        chainCode: Buffer.from(key.pubKey, 'hex'),
        privateKey: Bitcore.encoding.Base58.decode(key.privKey),
      });
    } else {
      let xPrivKey = new Bitcore.HDPrivateKey(
        this.get(password, algo).xPrivKey,
        NETWORK
      );
      const deriveFn = this.compliantDerivation
      ? xPrivKey.deriveChild.bind(xPrivKey)
      : xPrivKey.deriveNonCompliantChild.bind(xPrivKey);
      return deriveFn(path);
    }
  };

  _checkChain(chain) {
    if (!Constants.CHAINS.includes(chain)) throw new Error('Invalid chain');
  };

  _checkNetwork(network) {
    if (!['livenet', 'testnet', 'regtest'].includes(network))
      throw new Error('Invalid network ' + network);
  };

  /*
   * This is only used on "create"
   * no need to include/support
   * BIP45
   */

  getBaseAddressDerivationPath(opts) {
    $.checkArgument(opts, 'Need to provide options');
    $.checkArgument(opts.n >= 1, 'n need to be >=1');

    const chain = opts.chain || Utils.getChain(opts.coin);
    let purpose = opts.n == 1 || this.use44forMultisig ? '44' : '48';
    let coinCode = '0';
    let changeCode = opts.addChange || 0;
    let addChange = opts.addChange;

    // checking in chains for simplicity
    if (
      ['testnet', 'regtest]'].includes(opts.network) &&
      Constants.UTXO_CHAINS.includes(chain)
    ) {
      coinCode = '1';
    } else if (chain == 'bch') {
      if (this.use0forBCH || opts.use0forBCH) {
        coinCode = '0';
      } else {
        coinCode = '145';
      }
    } else if (chain == 'btc') {
      coinCode = '0';
    } else if (chain == 'eth') {
      coinCode = '60';
    } else if (chain == 'matic') {
      coinCode = '60'; // the official matic derivation path is 966 but users will expect address to be same as ETH
    } else if (chain == 'arb') {
      coinCode = '60';
    } else if (chain == 'op') {
      coinCode = '60';
    } else if (chain == 'base') {
      coinCode = '60';
    } else if (chain == 'xrp') {
      coinCode = '144';
    } else if (chain == 'doge') {
      coinCode = '3';
    } else if (chain == 'ltc') {
      coinCode = '2';
    } else if (chain == 'sol') {
      coinCode = '501';
      addChange = true; // Solana does not use change addresses. Standard is keeping this at 0
    } else {
      throw new Error('unknown chain: ' + chain);
    }
    const basePath = `m/${purpose}'/${coinCode}'/${opts.account}'`;
    return addChange ? `${basePath}/${changeCode}'` : basePath;
  };

  /*
   * opts.chain
   * opts.network
   * opts.account
   * opts.n
   * opts.algo
   */

  createCredentials(password, opts) {
    opts = opts || {};
    opts.chain = opts.chain || Utils.getChain(opts.coin);
    const algo = opts.algo || (ALGOS_BY_CHAIN[opts.chain.toLowerCase()] || ALGOS_BY_CHAIN['default']);

    if (password) $.shouldBeString(password, 'provide password');

    this._checkNetwork(opts.network);
    $.shouldBeNumber(opts.account, 'Invalid account');
    $.shouldBeNumber(opts.n, 'Invalid n');

    $.shouldBeUndefined(opts.useLegacyCoinType);
    $.shouldBeUndefined(opts.useLegacyPurpose);

    const path = this.getBaseAddressDerivationPath(opts);
    let xPrivKey = this.derive(password, path, algo);
    let requestPrivKey = this.derive(
      password,
      Constants.PATHS.REQUEST_KEY,
    ).privateKey.toString();

    if (['testnet', 'regtest'].includes(opts.network)) {
      // Hacky: BTC/BCH xPriv depends on network: This code is to
      // convert a livenet xPriv to a testnet/regtest xPriv
      let x = xPrivKey.toObject();
      x.network = opts.network;
      delete x.xprivkey;
      delete x.checksum;
      x.privateKey = x.privateKey.padStart(64, '0');
      xPrivKey = new Bitcore.HDPrivateKey(x);
    }

    return Credentials.fromDerivedKey({
      xPubKey: xPrivKey.hdPublicKey.toString(),
      coin: opts.coin,
      chain: opts.chain?.toLowerCase() || Utils.getChain(opts.coin), // getChain -> backwards compatibility
      network: opts.network,
      account: opts.account,
      n: opts.n,
      rootPath: path,
      keyId: this.id,
      requestPrivKey,
      addressType: opts.addressType,
      walletPrivKey: opts.walletPrivKey,
      clientDerivedPublicKey: algo === Constants.ALGOS.EDDSA ? this.#getChildKeyEDDSA(password, path)?.pubKey : undefined,
    });
  };

  /**
   * @param {string} password
   * @param {Object} opts
   * @param {string} opts.path
   * @param {string|PrivateKey} [opts.requestPrivKey]
   */
  createAccess(password, opts) {
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

  sign(rootPath, txp, password, cb) {
    $.shouldBeString(rootPath);
    if (this.isPrivKeyEncrypted() && !password) {
      return cb(new Errors.ENCRYPTED_PRIVATE_KEY());
    }
    var privs = [];
    var derived: any = {};

    var derived = this.derive(password, rootPath);
    var xpriv = new Bitcore.HDPrivateKey(derived);

    var t = Utils.buildTx(txp);

    var chain = txp.chain?.toLowerCase() || Utils.getChain(txp.coin); // getChain -> backwards compatibility

    if (Constants.UTXO_CHAINS.includes(chain)) {
      for (const i of txp.inputs) {
        $.checkState(
          i.path,
          'Input derivation path not available (signing transaction)'
        );
        if (!derived[i.path]) {
          derived[i.path] = xpriv.deriveChild(i.path).privateKey;
          privs.push(derived[i.path]);
        }
      };

      var signatures = privs.map(function(priv, i) {
        return t.getSignatures(priv, undefined, txp.signingMethod);
      });

      signatures = signatures.flat().sort((a, b) => a.inputIndex - b.inputIndex);
      // DEBUG
      // for (let sig of signatures) {
      //   if (!t.isValidSignature(sig)) {
      //     throw new Error('INVALID SIGNATURE');
      //   }
      // }
      signatures = signatures.map(sig => sig.signature.toDER().toString('hex'));

      return signatures;
    } else if (Constants.SVM_CHAINS.includes(chain)) {
      let tx = t.uncheckedSerialize();
      tx = typeof tx === 'string' ? [tx] : tx;
      const txArray = Array.isArray(tx) ? tx : [tx];
      const isChange = false;
      const addressIndex = 0;
      const xPrivKey = this.get(password, Constants.ALGOS.EDDSA).xPrivKey
      const key = Deriver.derivePrivateKey(
        chain.toUpperCase(),
        txp.network,
        xPrivKey, // derived
        addressIndex,
        isChange
      );
      async.map(
        txArray,
        function addSignatures(rawTx, next) {
          (Transactions.getSignature({
            chain: chain.toUpperCase(),
            tx: rawTx,
            keys: [key]
          }) as any)
          .then(signatures => {
            next(null, signatures);
          })
          .catch(err => {
            next(err);
          });
        },
        function(err, signatures) {
           try {
            if (err)  return cb(err);
            return cb(null, signatures);
          } catch (e) {
            throw new Error('Missing Callback', e)
          }
        }
      );
    } else {
      let tx = t.uncheckedSerialize();
      tx = typeof tx === 'string' ? [tx] : tx;
      const txArray = Array.isArray(tx) ? tx : [tx];
      const isChange = false;
      const addressIndex = 0;
      const { privKey, pubKey } = Deriver.derivePrivateKey(
        chain.toUpperCase(),
        txp.network,
        derived,
        addressIndex,
        isChange
      );
      let signatures = [];
      for (const rawTx of txArray) {
        const signed = Transactions.getSignature({
          chain: chain.toUpperCase(),
          tx: rawTx,
          key: { privKey, pubKey }
        });
        signatures.push(signed);
      }
      return signatures;
    }
  };

  #setPrivKey(params: { algo?: string; value: any; }) {
    const { value, algo } = params;
    switch (String(algo).toUpperCase()) {
      case (Constants.ALGOS.EDDSA):
        this.#xPrivKeyEDDSA = value;
        break;
      default:
        this.#xPrivKey = value;
    }
  }

  #setPrivKeyEncrypted(params: { value: any; algo?: string; }) {
    const { value, algo } = params;
    switch (String(algo).toUpperCase()) {
      case (Constants.ALGOS.EDDSA):
        this.#xPrivKeyEDDSAEncrypted = value;
        break;
      default:
        this.#xPrivKeyEncrypted = value;
    }
  }

  #setFingerprint(params: { value: any; algo?: string; }) {
    const { value, algo } = params;
    switch (String(algo).toUpperCase()) {
      case (Constants.ALGOS.EDDSA):
        this.fingerPrintEDDSA = value;
        break;
      default:
        this.fingerPrint = value;
    }
  }

  #getPrivKey(params: { algo?: string; } = {}) {
    switch (String(params?.algo).toUpperCase()) {
      case (Constants.ALGOS.EDDSA):
        return this.#xPrivKeyEDDSA;
      default:
        return this.#xPrivKey;
    }
  }

  #getPrivKeyEncrypted(params: { algo?: string; } = {}) {
    switch (String(params?.algo).toUpperCase()) {
      case (Constants.ALGOS.EDDSA):
        return this.#xPrivKeyEDDSAEncrypted;
      default:
        return this.#xPrivKeyEncrypted;
    }
  }

  #getFingerprint(params: { algo?: string; } = {}) {
    switch (String(params?.algo).toUpperCase()) {
      case (Constants.ALGOS.EDDSA):
        return this.fingerPrintEDDSA;
      default:
        return this.fingerPrint;
    }
  }

  #getChildKeyEDDSA(password, path) {
    const privKey = this.get(password, Constants.ALGOS.EDDSA).xPrivKey;
    return Deriver.derivePrivateKeyWithPath('SOL', null, privKey, path, null);
  }
}
