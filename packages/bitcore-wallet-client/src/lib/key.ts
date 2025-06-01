'use strict';

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

const wordsForLang = {
  en: Mnemonic.Words.ENGLISH as Array<string>,
  es: Mnemonic.Words.SPANISH as Array<string>,
  ja: Mnemonic.Words.JAPANESE as Array<string>,
  zh: Mnemonic.Words.CHINESE as Array<string>,
  fr: Mnemonic.Words.FRENCH as Array<string>,
  it: Mnemonic.Words.ITALIAN as Array<string>,
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
  [Constants.ALGOS.ECDSA]: 'Bitcoin',
  [Constants.ALGOS.EDDSA]: 'ed25519'
}
type KeyAlgorithm = keyof typeof Constants.ALGOS;
type Nullish = null | undefined;
type PasswordMaybe = string | Nullish;

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
  language?: keyof typeof wordsForLang;
  algo?: KeyAlgorithm; // eddsa or ecdsa (Bitcoin) by default
};

export interface ExportedKey {
  xPrivKey: string;
  mnemonic: string;
  mnemonicHasPassphrase: boolean;
  fingerPrintUpdated?: boolean;
};

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

        let xpriv;
        try {
          xpriv = new Bitcore.HDPrivateKey(x);
        } catch (e) {
          throw new Error('Invalid argument');
        }
        for (const algo of SUPPORTED_ALGOS) {
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

  private setFromMnemonic(
    m,
    opts: { passphrase?: string; password?: PasswordMaybe; sjclOpts?: any, algo?: KeyAlgorithm }
  ) {
    for (const algo of SUPPORTED_ALGOS) {
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
        sjcl.decrypt(password, this.#getPrivKeyEncrypted({ algo }));
      } catch (ex) {
        return false;
      }
      return true;
    }
    return null;
  };

  get(password: PasswordMaybe, algo?: KeyAlgorithm) {
    const key: ExportedKey = {
      xPrivKey: '',
      mnemonic: '',
      mnemonicHasPassphrase: this.#mnemonicHasPassphrase || false
    };

    if (this.isPrivKeyEncrypted(algo)) {
      $.checkArgument(password, 'Private keys are encrypted, a password is needed');
      try {
        const xPrivKeyEncrypted = this.#getPrivKeyEncrypted({ algo });
        key.xPrivKey = sjcl.decrypt(password, xPrivKeyEncrypted);

        if (this.#mnemonicEncrypted) {
          key.mnemonic = sjcl.decrypt(password, this.#mnemonicEncrypted);
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

  encrypt(password: string, opts) {
    if (this.#xPrivKeyEncrypted)
      throw new Error('Private key already encrypted');

    if (!this.#xPrivKey) throw new Error('No private key to encrypt');

    this.#xPrivKeyEncrypted = sjcl.encrypt(password, this.#xPrivKey, opts);
    if (!this.#xPrivKeyEncrypted) throw new Error('Could not encrypt');

    if (this.#mnemonic)
      this.#mnemonicEncrypted = sjcl.encrypt(password, this.#mnemonic, opts);

    this.#xPrivKey = null;
    this.#mnemonic = null;
  };

  decrypt(password: string) {
    if (!this.#xPrivKeyEncrypted)
      throw new Error('Private key is not encrypted');

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
   * @param {PasswordMaybe} [password]
   * @param {object} [opts]
   * @param {string} [opts.chain]
   * @param {string} [opts.network]
   * @param {number} [opts.account]
   * @param {number} [opts.n]
   * @param {string} [opts.algo]
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
    }
  ) {
    opts = opts || {} as any;
    opts.chain = opts.chain || Utils.getChain(opts.coin);
    const algo = opts.algo || ALGOS_BY_CHAIN[opts.chain.toLowerCase()] || ALGOS_BY_CHAIN.default;

    if (password) $.shouldBeString(password, 'provide password');

    this._checkNetwork(opts.network);
    $.shouldBeNumber(opts.account, 'Invalid account');
    $.shouldBeNumber(opts.n, 'Invalid n');

    $.shouldBeUndefined(opts['useLegacyCoinType']);
    $.shouldBeUndefined(opts['useLegacyPurpose']);

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
   * @param {PasswordMaybe} password
   * @param {object} opts
   * @param {string} opts.path
   * @param {string|PrivateKey} [opts.requestPrivKey]
   */
  createAccess(
    password: PasswordMaybe,
    opts: { path: string; requestPrivKey?: string | Bitcore.PrivateKey }
  ) {
    opts = opts || {} as any;
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
   * @param {string} rootPath 
   * @param {object} txp 
   * @param {PasswordMaybe} [password]
   * @returns {Promise<string[]>} Array of signatures
   */
  async sign(rootPath: string, txp, password?: PasswordMaybe): Promise<string[]> {
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

  #setPrivKeyEncrypted(params: { value: any; algo?: KeyAlgorithm; }) {
    const { value, algo } = params;
    switch (algo?.toUpperCase?.()) {
      case (Constants.ALGOS.EDDSA):
        this.#xPrivKeyEDDSAEncrypted = value;
        break;
      default:
        this.#xPrivKeyEncrypted = value;
    }
  }

  #setFingerprint(params: { value: any; algo?: KeyAlgorithm; }) {
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
