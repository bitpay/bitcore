'use strict';

import { BitcoreLib as Bitcore } from '@bitpay-labs/crypto-wallet-core';
import { singleton } from 'preconditions';
import { Constants, Utils } from './common';

const $ = singleton();

export class Credentials {
  static FIELDS = [
    'coin',
    'chain',
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
    'keyId', // this is only for information
    'token', // this is for a ERC20 token
    'multisigEthInfo', // this is for a MULTISIG eth wallet
    'hardwareSourcePublicKey', // public key from a hardware device for this copayer
    'clientDerivedPublicKey', // for public keys generated client side
    'tssKeyId', // for TSS wallets
  ];
  version: number;
  account: number;
  walletPrivKey: string;
  personalEncryptingKey: string;
  sharedEncryptingKey: string;
  walletId: string;
  walletName: string;
  m: number;
  n: number;
  copayerName: string;
  copayerId: string;
  xPrivKey: string;
  xPrivKeyEncrypted: string;
  xPubKey: string;
  requestPubKey: string;
  requestPrivKey: string;
  publicKeyRing: Array<{
    requestPubKey: string;
    xPubKey: string;
    copayerName?: string;
  }>;
  rootPath: string;
  derivationStrategy: string;
  network: string;
  coin: string;
  chain: string;
  use145forBCH: boolean;
  addressType: string;
  keyId: string;
  token?: {
    name: string;
    symbol: string;
    address: string;
  };
  multisigEthInfo?: {
    multisigContractAddress: string;
    walletName: string;
    n: string | number;
    m: string | number;
  };
  externalSource?: boolean; // deprecated property?
  hardwareSourcePublicKey: string;
  clientDerivedPublicKey: string;
  tssKeyId: string; // for TSS wallets

  constructor() {
    this.version = 2;
    this.account = 0;
  }

  /**
   * Create credentials from a derived key
   */
  static fromDerivedKey(opts: {
    /** @deprecated use `chain` */
    coin?: string;
    chain: string;
    network: string;
    account: number;
    xPubKey: string;
    rootPath: string;
    keyId: string;
    requestPrivKey: string;
    /** Multisig: minimum number of cosigners */
    m?: number;
    /** Multisig: total number of cosigners */
    n?: number;
    addressType?: string;
    walletPrivKey?: string;
    copayerName?: string;
    use145forBCH?: boolean;
    nonCompliantDerivation?: boolean;
    clientDerivedPublicKey?: string;
  }) {
    $.shouldBeString(opts.chain);
    $.shouldBeString(opts.network);
    $.shouldBeNumber(opts.account, 'Invalid account');
    $.shouldBeString(opts.xPubKey, 'Invalid xPubKey');
    $.shouldBeString(opts.rootPath, 'Invalid rootPath');
    $.shouldBeString(opts.keyId, 'Invalid keyId');
    $.shouldBeString(opts.requestPrivKey, 'Invalid requestPrivKey');
    $.checkArgument(opts.nonCompliantDerivation == null);

    const x = new Credentials();
    x.chain = opts.chain;
    x.coin = opts.coin || opts.chain;
    x.network = opts.network;
    x.account = opts.account;
    x.m = opts.m;
    x.n = opts.n;
    x.xPubKey = opts.xPubKey;
    x.keyId = opts.keyId;
    x.copayerName = opts.copayerName;

    // this allows to set P2SH in old n=1 wallets
    if (opts.addressType == null) {
      x.addressType =
        opts.n == 1
          ? Constants.SCRIPT_TYPES.P2PKH
          : Constants.SCRIPT_TYPES.P2SH;
    } else {
      x.addressType = opts.addressType;
    }

    // Only used for info
    x.rootPath = opts.rootPath;

    if (opts.walletPrivKey) {
      x.addWalletPrivateKey(opts.walletPrivKey);
    }
    x.requestPrivKey = opts.requestPrivKey;

    const priv = Bitcore.PrivateKey(x.requestPrivKey);
    x.requestPubKey = priv.toPublicKey().toString();

    const prefix = 'personalKey';
    const entropySource = Bitcore.crypto.Hash.sha256(priv.toBuffer()).toString('hex');
    const b = Buffer.from(entropySource, 'hex');
    const b2: Buffer = Bitcore.crypto.Hash.sha256hmac(b, Buffer.from(prefix));
    x.personalEncryptingKey = Buffer.from(b2.subarray(0, 16)).toString('base64');
    x.copayerId = Utils.xPubToCopayerId(x.chain, x.xPubKey);
    x.publicKeyRing = [
      {
        xPubKey: x.xPubKey,
        requestPubKey: x.requestPubKey
      }
    ];
    x.clientDerivedPublicKey = opts.clientDerivedPublicKey;
    return x;
  }

  /*
   * creates an ERC20 wallet from a ETH wallet
   */
  getTokenCredentials(
    token: {
      name: string;
      symbol: string;
      address: string;
    },
    chain: string
  ) {
    const ret = Credentials.fromObj(this.toObj());
    ret.walletId = `${ret.walletId}-${token.address}`;
    ret.coin = token.symbol.toLowerCase();
    ret.chain = chain;
    ret.walletName = token.name;
    ret.token = token;

    return ret;
  }

  /*
   * creates a Multisig wallet from a ETH wallet
   */
  getMultisigEthCredentials(multisigEthInfo: Credentials['multisigEthInfo']) {
    const ret = Credentials.fromObj(this.toObj());
    ret.walletId = `${ret.walletId}-${multisigEthInfo.multisigContractAddress}`;
    ret.walletName = multisigEthInfo.walletName;
    ret.n = parseInt(multisigEthInfo.n as string);
    ret.m = parseInt(multisigEthInfo.m as string);
    ret.multisigEthInfo = multisigEthInfo;
    return ret;
  }

  getRootPath() {
    // This is for OLD v1.0 credentials only.
    const legacyRootPath = () => {
      // legacy base path schema
      let purpose;
      switch (this.derivationStrategy) {
        case Constants.DERIVATION_STRATEGIES.BIP45:
          return "m/45'";
        case Constants.DERIVATION_STRATEGIES.BIP44:
          purpose = '44';
          break;
        case Constants.DERIVATION_STRATEGIES.BIP48:
          purpose = '48';
          break;
        case Constants.DERIVATION_STRATEGIES.BIP84:
          purpose = '84';
          break;
      }

      let chainPath = '0';
      const chain = this.chain?.toLowerCase() || this.coin;
      // checking in chains for simplicity
      if (
        this.network != 'livenet' &&
        Constants.UTXO_CHAINS.includes(chain)
      ) {
        chainPath = '1';
      } else if (chain == 'bch') {
        if (this.use145forBCH) {
          chainPath = '145';
        } else {
          chainPath = '0';
        }
      } else if (chain == 'btc') {
        chainPath = '0';
      } else if (chain == 'eth') {
        chainPath = '60';
      } else if (chain == 'matic') {
        chainPath = '60'; // the official matic derivation path is 966 but users will expect address to be same as ETH
      } else if (chain == 'arb') {
        chainPath = '60';
      } else if (chain == 'base') {
        chainPath = '60';
      } else if (chain == 'op') {
        chainPath = '60';
      } else if (chain == 'xrp') {
        chainPath = '144';
      } else if (chain == 'doge') {
        chainPath = '3';
      } else if (chain == 'ltc') {
        chainPath = '2';
      } else if (chain == 'sol') {
        chainPath = '501';
      } else {
        throw new Error('unknown chain: ' + chain);
      }
      return 'm/' + purpose + "'/" + chainPath + "'/" + this.account + "'";
    };

    if (!this.rootPath) {
      this.rootPath = legacyRootPath();
    }
    return this.rootPath;
  }

  static fromObj(obj) {
    const x = new Credentials();

    if (!obj.version || obj.version < x.version) {
      throw new Error('Obsolete credentials version');
    }

    if (obj.version != x.version) {
      throw new Error('Bad credentials version');
    }

    for (const k of Credentials.FIELDS) {
      x[k] = obj[k];
    }

    if (x.externalSource) {
      throw new Error('External Wallets are no longer supported');
    }

    x.coin = x.coin || 'btc';
    x.chain = x.chain || Utils.getChain(x.coin); // getChain -> backwards compatibility
    x.addressType = x.addressType || Constants.SCRIPT_TYPES.P2SH;
    x.account = x.account || 0;

    $.checkState(
      x.xPrivKey || x.xPubKey || x.xPrivKeyEncrypted || x.hardwareSourcePublicKey || x.clientDerivedPublicKey,
      'Failed State: x.xPrivKey | x.xPubkey | x.xPrivKeyEncrypted | x.hardwareSourcePublicKey  | x.clientDerivedPublicKey at fromObj'
    );
    return x;
  }

  toObj() {
    const x = {};
    for (const k of Credentials.FIELDS) {
      x[k] = this[k];
    }
    return x as any;
  }

  addWalletPrivateKey(walletPrivKey) {
    this.walletPrivKey = walletPrivKey;
    this.sharedEncryptingKey = Utils.privateKeyToAESKey(walletPrivKey);
  }

  addWalletInfo(
    walletId: string,
    walletName: string,
    m: number,
    n: number,
    copayerName: string,
    opts?: {
      useNativeSegwit?: boolean;
      segwitVersion?: number;
      tssKeyId?: string;
      allowOverwrite?: boolean;
    }
  ) {
    opts = opts || {};
    this.walletId = walletId;
    this.walletName = walletName;
    this.m = m;

    if (opts.useNativeSegwit) {
      switch (Number(opts.segwitVersion)) {
        case 0:
        default:
          this.addressType = n == 1 ? Constants.SCRIPT_TYPES.P2WPKH : Constants.SCRIPT_TYPES.P2WSH;
          break;
        case 1:
          // Taproot is segwit v1
          this.addressType = Constants.SCRIPT_TYPES.P2TR;
          break;
      }
    }

    if (this.n != n && !opts.tssKeyId && !opts.allowOverwrite) {
      // we always allow overwrite for multisig and tss
      if (this.n == 1 || n == 1) {
        throw new Error(`Bad number of copayers in addWalletInfo: this: ${this.n} got: ${n}`);
      }
    }

    this.n = opts.tssKeyId ? 1 : n; // TSS always has n=1
    this.tssKeyId = opts.tssKeyId;

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
    this.publicKeyRing = JSON.parse(JSON.stringify(publicKeyRing));
  }

  isComplete() {
    if (!this.m || !this.n) return false;
    if (
      ['btc', 'bch', 'doge', 'ltc'].includes(this.chain) &&
      !this.tssKeyId && // TSS creds will have publicKeyRing.length > n
      (!this.publicKeyRing || this.publicKeyRing.length != this.n)
    )
      return false;
    return true;
  }
}
