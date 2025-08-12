'use strict';

import Mnemonic from 'bitcore-mnemonic';
import {
  BitcoreLib as Bitcore,
  Deriver,
  Transactions
} from 'crypto-wallet-core';
import { singleton } from 'preconditions';
import * as Uuid from 'uuid';
import { Constants, Encryption, Utils } from './common';
import { Credentials } from './credentials';
import { Errors } from './errors';
import log from './log';

const $ = singleton();

type Language = 'en' | 'es' | 'ja' | 'zh' | 'fr' | 'it';
const wordsForLang: Record<Language, Array<string>> = {
  en: Mnemonic.Words.ENGLISH,
  es: Mnemonic.Words.SPANISH,
  ja: Mnemonic.Words.JAPANESE,
  zh: Mnemonic.Words.CHINESE,
  fr: Mnemonic.Words.FRENCH,
  it: Mnemonic.Words.ITALIAN,
};

// we always set 'livenet' for xprivs. it has no consequences
// other than the serialization
const NETWORK: string = 'livenet';
const ALGOS_BY_CHAIN =  {
  default: Constants.ALGOS.ECDSA,
  sol: Constants.ALGOS.EDDSA,
};
const SUPPORTED_ALGOS = [Constants.ALGOS.ECDSA, Constants.ALGOS.EDDSA];
const ALGO_TO_KEY_TYPE = {
  [Constants.ALGOS.ECDSA]: 'Bitcoin',
  [Constants.ALGOS.EDDSA]: 'ed25519'
}
export type KeyAlgorithm = keyof typeof Constants.ALGOS;
type Nullish = null | undefined;
export type PasswordMaybe = string | Nullish;

export interface KeyOptions {
  id?: string;
  seedType: 'new' | 'extendedPrivateKey' | 'object' | 'mnemonic' | 'objectV1';
  seedData?: any;
  passphrase?: string; // seed passphrase
  password?: string; // encrypting password
  encryptionOpts?: { iter?: number; }; // options for encryption
  use0forBCH?: boolean;
  useLegacyPurpose?: boolean;
  useLegacyCoinType?: boolean;
  nonCompliantDerivation?: boolean;
  language?: Language;
  algo?: KeyAlgorithm; // eddsa or ecdsa (Bitcoin) by default
};

export interface ExportedKey {
  xPrivKey: string;
  mnemonic: string;
  mnemonicHasPassphrase: boolean;
  fingerPrintUpdated?: boolean;
};
interface AddKeyOptions {
  passphrase?: string;
  password?: PasswordMaybe;
  sjclOpts?: any;
  algo?: KeyAlgorithm;
  existingAlgo?: KeyAlgorithm;
}

interface SetFromMnemonicOptions {
  passphrase?: string;
  algo?: KeyAlgorithm;
  password?: PasswordMaybe;
  encryptionOpts?: KeyOptions['encryptionOpts'];
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
        $.checkArgument(typeof x === 'string', 'opts.seedData needs to be a string');
        this.setFromMnemonic(new Mnemonic(x), opts);
        break;
      case 'extendedPrivateKey':
        $.checkArgument(x, 'Need to provide opts.seedData');
        this.setFromExtendedPrivateKey(x, opts);
        break;
      case 'object':
        $.shouldBeObject(x, 'Need to provide an object at opts.seedData');
        $.shouldBeUndefined(opts.password, 'opts.password not allowed when opts.seedData is an object');

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
  // private setFromMnemonic(
  //   m,
  //   opts: { passphrase?: string; password?: PasswordMaybe; encryptionOpts?: KeyOptions['encryptionOpts'], algo?: KeyAlgorithm }
  // ) {
  //   for (const algo of SUPPORTED_ALGOS) {
      const xpriv = m.toHDPrivateKey(opts.passphrase, NETWORK, ALGO_TO_KEY_TYPE[algo]);
      this.#setFingerprint({ value: xpriv.fingerPrint.toString('hex'), algo });

      if (opts.password) {
        this.#setPrivKeyEncrypted({
          value: JSON.stringify(Encryption.encryptWithPassword(
            xpriv.toString(),
            opts.password,
            opts.encryptionOpts
          )),
          algo
        });
        if (!this.#getPrivKeyEncrypted({ algo })) throw new Error('Could not encrypt');
        this.#mnemonicEncrypted = JSON.stringify(Encryption.encryptWithPassword(
          m.phrase,
          opts.password,
          opts.encryptionOpts
        ));
        if (!this.#mnemonicEncrypted) throw new Error('Could not encrypt');
      } else {
        this.#setPrivKey({ value: xpriv.toString(), algo });
        this.#mnemonic = m.phrase;
        this.#mnemonicHasPassphrase = !!opts.passphrase;
      }
    }
  }

  private setFromExtendedPrivateKey (extendedPrivateKey, opts: { password?: PasswordMaybe; algo?: KeyAlgorithm; encryptionOpts?: KeyOptions['encryptionOpts'] }) {
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
      const params = { algo };
      this.#setFingerprint({ value: xpriv.fingerPrint.toString('hex'),  ...params });
      if (opts.password) {
        this.#setPrivKeyEncrypted({
          value: JSON.stringify(Encryption.encryptWithPassword(
            xpriv.toString(),
            opts.password,
            opts.encryptionOpts
          )),
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
  addKeyByAlgorithm(algo: KeyAlgorithm, opts: AddKeyOptions = {}) {
    const existingAlgo = opts.existingAlgo || 'ECDSA';

    if (this.#mnemonic) {
      this.#addKeyFromMnemonic(algo, this.#mnemonic, opts);
      return;
    }
    if (this.#mnemonicEncrypted) {
      this.#validatePassword(opts.password);
      const mnemonic = Encryption.decryptWithPassword(this.#mnemonicEncrypted, opts.password);
      this.#addKeyFromMnemonic(algo, mnemonic.toString(), opts);
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
  #addKeyFromMnemonic(algo: KeyAlgorithm, mnemonic: string, opts: AddKeyOptions) {
    const mnemonicOpts: SetFromMnemonicOptions = { ...opts, algo };
    
    if (this.#mnemonicHasPassphrase) {
      this.#validatePassphrase(opts.passphrase);
      mnemonicOpts.passphrase = opts.passphrase;
    }
    
    this.setFromMnemonic(new Mnemonic(mnemonic), mnemonicOpts);
  }
  
  /**
   * Creates key from existing private key (encrypted or plain)
   */
  #addKeyFromExistingPrivateKey(algo: KeyAlgorithm, existingAlgo: KeyAlgorithm, opts: AddKeyOptions) {
    const encryptedPrivKey = this.#getPrivKeyEncrypted({ algo: existingAlgo });
    
    if (encryptedPrivKey) {
      this.#validatePassword(opts.password);
      const xPriv = Encryption.decryptWithPassword(encryptedPrivKey, opts.password);
      this.setFromExtendedPrivateKey(xPriv, { algo, password: opts.password });
    } else {
      const xPriv = this.#getPrivKey({ algo: existingAlgo });
      this.setFromExtendedPrivateKey(xPriv, { algo });
    }
  }
  
  #hasExistingPrivateKey(existingAlgo: KeyAlgorithm): boolean {
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

  isPrivKeyEncrypted(algo?: KeyAlgorithm) {
    switch (String(algo).toUpperCase()) {
      case (Constants.ALGOS.EDDSA):
        return !!this.#xPrivKeyEDDSAEncrypted && !this.#xPrivKeyEDDSA;
      default:
        return !!this.#xPrivKeyEncrypted && !this.#xPrivKey;
    }
  };

  checkPassword(password: string, algo?: KeyAlgorithm) {
    if (this.isPrivKeyEncrypted(algo)) {
      try {
        Encryption.decryptWithPassword(this.#getPrivKeyEncrypted({ algo }), password);
      } catch (ex) {
        return false;
      }
      return true;
    }
    return null;
  };

  get(password?: PasswordMaybe, algo?: KeyAlgorithm) {
    const key: ExportedKey = {
      xPrivKey: '',
      mnemonic: '',
      mnemonicHasPassphrase: this.#mnemonicHasPassphrase || false
    };

    if (this.isPrivKeyEncrypted(algo)) {
      $.checkArgument(password, 'Private keys are encrypted, a password is needed');
      try {
        const xPrivKeyEncrypted = this.#getPrivKeyEncrypted({ algo });
        key.xPrivKey = Encryption.decryptWithPassword(xPrivKeyEncrypted, password).toString();

        if (this.#mnemonicEncrypted) {
          key.mnemonic = Encryption.decryptWithPassword(this.#mnemonicEncrypted, password).toString();
        }
      } catch (ex) {
        throw new Error('Could not decrypt');
      }
    } else {
      key.xPrivKey = this.#getPrivKey({ algo });
      key.mnemonic = this.#mnemonic;
    }
    // update fingerPrint if not set.
    if (!this.#getFingerprint({ algo })) {
      const xpriv = new Bitcore.HDPrivateKey(key.xPrivKey);
      const fingerPrint = xpriv.fingerPrint.toString('hex');
      this.#setFingerprint({ value: fingerPrint, algo });
      key.fingerPrintUpdated = true;
    }
    key.mnemonicHasPassphrase = this.#mnemonicHasPassphrase || false;
    return key;
  };

  encrypt(password: string, opts?: { iter?: number; ks?: number }, algo?) {
    if (this.#getPrivKeyEncrypted({ algo }))
      throw new Error('Private key already encrypted');

    if (!this.#getPrivKey({ algo })) throw new Error('No private key to encrypt');

    const encryptedPrivKey = JSON.stringify(Encryption.encryptWithPassword(this.#getPrivKey({ algo }), password, opts));
    this.#setPrivKeyEncrypted({ algo, value: encryptedPrivKey });
    if (!this.#getPrivKeyEncrypted({ algo })) throw new Error('Could not encrypt');

    if (this.#mnemonic)
      this.#mnemonicEncrypted = JSON.stringify(Encryption.encryptWithPassword(this.#mnemonic, password, opts));

    this.#setPrivKey({ algo, value: null });
    this.#mnemonic = null;
  };

  decrypt(password, algo?) {
    if (!this.#getPrivKeyEncrypted({ algo }))
      throw new Error('Private key is not encrypted');

    try {
      const decryptedPrivKey = Encryption.decryptWithPassword(this.#getPrivKeyEncrypted({ algo }), password).toString();
      this.#setPrivKey({ algo, value: decryptedPrivKey });
      if (this.#mnemonicEncrypted) {
        this.#mnemonic = Encryption.decryptWithPassword(this.#mnemonicEncrypted, password).toString();
      }
      this.#setPrivKeyEncrypted({ algo, value: null })
      this.#mnemonicEncrypted = null;
    } catch (ex) {
      log.error('error decrypting:', ex);
      throw new Error('Could not decrypt');
    }
  };

  derive(password: PasswordMaybe, path: string, algo?: KeyAlgorithm): Bitcore.HDPrivateKey {
    $.checkArgument(path, 'no path at derive()');
    if (algo?.toUpperCase?.() === Constants.ALGOS.EDDSA) {
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
      const xPrivKey = new Bitcore.HDPrivateKey(
        this.get(password, algo).xPrivKey,
        NETWORK
      );
      const deriveFn = this.compliantDerivation
        ? xPrivKey.deriveChild.bind(xPrivKey)
        : xPrivKey.deriveNonCompliantChild.bind(xPrivKey);
      return deriveFn(path);
    }
  };

  _checkChain(chain: string) {
    if (!Constants.CHAINS.includes(chain))
      throw new Error('Invalid chain');
  };

  _checkNetwork(network: string) {
    if (!['livenet', 'testnet', 'regtest'].includes(network))
      throw new Error('Invalid network ' + network);
  };

  /*
   * No need to include/support BIP45
   */
  getBaseAddressDerivationPath(opts: {
    n: number;
    chain?: string;
    coin?: string;
    network?: string;
    addChange?: number;
    account?: number;
    use0forBCH?: boolean;
  }) {
    $.checkArgument(opts, 'Need to provide options');
    $.checkArgument(opts.n >= 1, 'n need to be >=1');

    const chain = opts.chain || Utils.getChain(opts.coin);
    let purpose = opts.n == 1 || this.use44forMultisig ? '44' : '48';
    let coinCode = '0';
    let changeCode = opts.addChange || 0;
    let addChange = !!opts.addChange;

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

  /**
   * Create a new set of credentials from this key
   */
  createCredentials(
    password?: PasswordMaybe,
    opts?: {
      coin?: string;
      chain?: string;
      network: string;
      account: number;
      n: number;
      addressType?: string;
      walletPrivKey?: string;
      algo?: KeyAlgorithm;
      tssXPubKey?: string;
    }
  ) {
    opts = opts || {} as any;
    opts.chain = (opts.chain || Utils.getChain(opts.coin)).toLowerCase();
    const algo = opts.algo || ALGOS_BY_CHAIN[opts.chain.toLowerCase()] || ALGOS_BY_CHAIN.default;

    if (password) $.shouldBeString(password, 'provide password');

    this._checkNetwork(opts.network);
    $.shouldBeNumber(opts.account, 'Invalid account');
    $.shouldBeNumber(opts.n, 'Invalid n');

    $.shouldBeUndefined(opts['useLegacyCoinType'], 'useLegacyCoinType is deprecated');
    $.shouldBeUndefined(opts['useLegacyPurpose'], 'useLegacyPurpose is deprecated');

    const path = this.getBaseAddressDerivationPath(opts);
    let xPrivKey = this.derive(password, path, algo);
    const requestPrivKey = this.derive(
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
      clientDerivedPublicKey: opts.tssXPubKey || (algo === Constants.ALGOS.EDDSA ? this.#getChildKeyEDDSA(password, path)?.pubKey : undefined),
    });
  };

  /**
   * Create a new access object for this key
   */
  createAccess(
    password: PasswordMaybe,
    opts: {
      path: string;
      requestPrivKey?: string | Bitcore.PrivateKey
    }
  ) {
    $.shouldBeString(opts.path);

    let requestPrivKey = new Bitcore.PrivateKey(opts.requestPrivKey || null);
    const requestPubKey = requestPrivKey.toPublicKey().toString();

    const xPriv = this.derive(password, opts.path);
    const signature = Utils.signRequestPubKey(requestPubKey, xPriv);
    requestPrivKey = requestPrivKey.toString();

    return {
      signature,
      requestPrivKey
    };
  };

  /**
   * Sign a transaction proposal
   * 
   * Why is this async?
   *  Because the underlying SOL library uses SubtleCrypto browser API. The SubtleCrypto API hands off
   *  cryptographic operations to a native thread so it doesn't block the JS event loop and is thus async.
   */
  async sign(
    rootPath: string,
    txp,
    password?: PasswordMaybe
  ): Promise<string[]> {
    $.shouldBeString(rootPath);
    if (this.isPrivKeyEncrypted() && !password) {
      throw new Errors.ENCRYPTED_PRIVATE_KEY();
    }
    const privs = [];
    const derived = this.derive(password, rootPath);
    const xpriv = new Bitcore.HDPrivateKey(derived);
    const t = Utils.buildTx(txp);
    const chain = txp.chain?.toLowerCase() || Utils.getChain(txp.coin); // getChain -> backwards compatibility

    if (Constants.UTXO_CHAINS.includes(chain)) {
      for (const i of txp.inputs) {
        $.checkState(i.path, 'Input derivation path not available (signing transaction)');
        if (!derived[i.path]) {
          derived[i.path] = xpriv.deriveChild(i.path).privateKey;
          privs.push(derived[i.path]);
        }
      };

      let signatures = privs.map(priv => t.getSignatures(priv, undefined, txp.signingMethod));
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
      const signatures = await Promise.all(
        txArray.map(rawTx => Transactions.getSignature({
          chain: chain.toUpperCase(),
          tx: rawTx,
          keys: [key]
        }))
      )
      return signatures;
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
      const signatures = [];
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

  #setPrivKey(params: { value: any; algo?: KeyAlgorithm; }) {
    const { value, algo } = params;
    switch (algo?.toUpperCase?.()) {
      case (Constants.ALGOS.EDDSA):
        this.#xPrivKeyEDDSA = value;
        break;
      default:
        this.#xPrivKey = value;
    }
  }

  #setPrivKeyEncrypted(params: { value: string; algo?: KeyAlgorithm; }) {
    const { value, algo } = params;
    switch (algo?.toUpperCase?.()) {
      case (Constants.ALGOS.EDDSA):
        this.#xPrivKeyEDDSAEncrypted = value;
        break;
      default:
        this.#xPrivKeyEncrypted = value;
    }
  }

  #setFingerprint(params: { value: string; algo?: KeyAlgorithm; }) {
    const { value, algo } = params;
    switch (algo?.toUpperCase?.()) {
      case (Constants.ALGOS.EDDSA):
        this.fingerPrintEDDSA = value;
        break;
      default:
        this.fingerPrint = value;
    }
  }

  #getPrivKey(params: { algo?: KeyAlgorithm; } = {}) {
    const { algo } = params;
    switch (algo?.toUpperCase?.()) {
      case (Constants.ALGOS.EDDSA):
        return this.#xPrivKeyEDDSA;
      default:
        return this.#xPrivKey;
    }
  }

  #getPrivKeyEncrypted(params: { algo?: KeyAlgorithm; } = {}) {
    const { algo } = params;
    switch (algo?.toUpperCase?.()) {
      case (Constants.ALGOS.EDDSA):
        return this.#xPrivKeyEDDSAEncrypted;
      default:
        return this.#xPrivKeyEncrypted;
    }
  }

  #getFingerprint(params: { algo?: KeyAlgorithm; } = {}) {
    const { algo } = params;
    switch (algo?.toUpperCase?.()) {
      case (Constants.ALGOS.EDDSA):
        return this.fingerPrintEDDSA;
      default:
        return this.fingerPrint;
    }
  }

  #getChildKeyEDDSA(password: PasswordMaybe, path: string) {
    const privKey = this.get(password, Constants.ALGOS.EDDSA).xPrivKey;
    return Deriver.derivePrivateKeyWithPath('SOL', null, privKey, path, null);
  }
}
