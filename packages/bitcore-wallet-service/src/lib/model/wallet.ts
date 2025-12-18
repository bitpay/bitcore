import {
  BitcoreLib,
  BitcoreLibCash,
  BitcoreLibDoge,
  BitcoreLibLtc,
} from 'crypto-wallet-core';
import { singleton } from 'preconditions';
import Uuid from 'uuid';
import config from '../../config';
import { Common } from '../common';
import logger from '../logger';
import { Address } from './address';
import { AddressManager, IAddressManager } from './addressmanager';
import { Copayer, ICopayer } from './copayer';

const $ = singleton();
const { Constants, Defaults, Utils } = Common;

const Bitcore = {
  btc: BitcoreLib,
  bch: BitcoreLibCash,
  eth: BitcoreLib,
  matic: BitcoreLib,
  arb: BitcoreLib,
  base: BitcoreLib,
  op: BitcoreLib,
  xrp: BitcoreLib,
  doge: BitcoreLibDoge,
  ltc: BitcoreLibLtc,
  sol: BitcoreLib,
};

export interface IWallet<isSharedT = boolean | (() => boolean)> {
  version: string;
  createdOn: number;
  id: string;
  name: string;
  m: number;
  n: number;
  singleAddress: boolean;
  status: string;
  publicKeyRing: Array<{ xPubKey: string; requestPubKey: string }>;
  hardwareSourcePublicKey?: string;
  clientDerivedPublicKey?: string;
  addressIndex: number;
  copayers: Array<ICopayer>;
  pubKey: string;
  coin: string;
  chain: string;
  network: string;
  derivationStrategy: string;
  addressType: string;
  addressManager: IAddressManager;
  scanStatus?: 'error' | 'success' | 'running';
  beRegistered: boolean; // Block explorer registered
  beAuthPrivateKey2?: string;
  beAuthPublicKey2?: string;
  nativeCashAddr?: boolean;
  isTestnet?: boolean;
  usePurpose48?: boolean;
  isShared?: isSharedT;
  tssVersion?: number;
  tssKeyId?: string;
};

export class Wallet implements IWallet<() => boolean> {
  version: string;
  createdOn: number;
  id: string;
  name: string;
  m: number;
  n: number;
  singleAddress: boolean;
  status: string;
  publicKeyRing: Array<{ xPubKey: string; requestPubKey: string }>;
  hardwareSourcePublicKey?: string;
  clientDerivedPublicKey?: string;
  addressIndex: number;
  copayers: Array<Copayer>;
  pubKey: string;
  coin: string;
  chain: string;
  network: string;
  derivationStrategy: string;
  addressType: string;
  addressManager: AddressManager;
  scanStatus?: 'error' | 'success' | 'running';
  beRegistered: boolean; // Block explorer registered
  beAuthPrivateKey2?: string;
  beAuthPublicKey2?: string;
  nativeCashAddr?: boolean;
  isTestnet?: boolean;
  usePurpose48?: boolean;
  scanning: boolean;
  tssVersion: number;
  tssKeyId: string;

  static COPAYER_PAIR_LIMITS = {};

  static create(opts: {
    id: string;
    name: string;
    m: number;
    n: number;
    coin: string;
    chain: string; // chain === coin for stored wallets
    network: string;
    pubKey: string;
    singleAddress: boolean;
    derivationStrategy: string;
    addressType: string;
    nativeCashAddr?: boolean;
    usePurpose48?: boolean;
    hardwareSourcePublicKey?: string;
    clientDerivedPublicKey?: string;
    tssVersion?: number;
    tssKeyId?: string;
  }) {
    opts = opts || {} as any;

    const chain = opts.chain || opts.coin;
    const x = new Wallet();

    $.shouldBeNumber(opts.m);
    $.shouldBeNumber(opts.n);
    $.checkArgument(Utils.checkValueInCollection(chain, Constants.CHAINS)); // checking in chains for simplicity
    $.checkArgument(Utils.checkValueInCollection(opts.network, Constants.NETWORKS[chain]));

    x.version = '1.0.0';
    x.createdOn = Math.floor(Date.now() / 1000);
    x.id = opts.id || Uuid.v4();
    x.name = opts.name;
    x.m = opts.m;
    x.n = opts.n;
    x.singleAddress = !!opts.singleAddress;
    x.status = 'pending';
    x.publicKeyRing = [];
    x.addressIndex = 0;
    x.copayers = [];
    x.pubKey = opts.pubKey;
    x.coin = opts.coin;
    x.chain = opts.chain || Utils.getChain(x.coin);
    x.network = opts.network;
    x.derivationStrategy = opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
    x.addressType = opts.addressType || Constants.SCRIPT_TYPES.P2SH;

    x.addressManager = AddressManager.create({
      derivationStrategy: x.derivationStrategy
    });
    x.usePurpose48 = opts.usePurpose48;

    x.scanStatus = null;

    // v8 related
    x.beRegistered = false; // Block explorer registered
    x.beAuthPrivateKey2 = null;
    x.beAuthPublicKey2 = null;

    // x.nativeCashAddr opts is only for testing
    x.nativeCashAddr = opts.nativeCashAddr == null ? (x.chain == 'bch' ? true : null) : opts.nativeCashAddr;

    // hardware wallet related
    x.hardwareSourcePublicKey = opts.hardwareSourcePublicKey;
    // client derived
    x.clientDerivedPublicKey = opts.clientDerivedPublicKey;

    // Threshold signatures
    x.tssVersion = opts.tssVersion;
    x.tssKeyId = opts.tssKeyId;

    return x;
  }

  static fromObj(obj: IWallet) {
    const x = new Wallet();

    $.shouldBeNumber(obj.m);
    $.shouldBeNumber(obj.n);

    x.version = obj.version;
    x.createdOn = obj.createdOn;
    x.id = obj.id;
    x.name = obj.name;
    x.m = obj.m;
    x.n = obj.n;
    x.singleAddress = !!obj.singleAddress;
    x.status = obj.status;
    x.publicKeyRing = obj.publicKeyRing;
    x.copayers = (obj.copayers || []).map(copayer => Copayer.fromObj(copayer));
    x.pubKey = obj.pubKey;
    x.coin = obj.coin || Defaults.COIN;
    x.chain = obj.chain || Utils.getChain(x.coin); // getChain -> backwards compatibility;
    x.network = obj.network;
    if (!x.network) {
      x.network = obj.isTestnet ? Utils.getNetworkName(x.chain, 'testnet') : 'livenet';
    }
    x.derivationStrategy = obj.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
    x.addressType = obj.addressType || Constants.SCRIPT_TYPES.P2SH;
    x.addressManager = AddressManager.fromObj(obj.addressManager);
    x.scanStatus = obj.scanStatus;
    x.beRegistered = obj.beRegistered;
    x.beAuthPrivateKey2 = obj.beAuthPrivateKey2;
    x.beAuthPublicKey2 = obj.beAuthPublicKey2;

    x.nativeCashAddr = obj.nativeCashAddr;
    x.usePurpose48 = obj.usePurpose48;

    // hardware wallet related
    x.hardwareSourcePublicKey = obj.hardwareSourcePublicKey;
    // client derived
    x.clientDerivedPublicKey = obj.clientDerivedPublicKey;

    // Threshold signatures
    x.tssVersion = obj.tssVersion;
    x.tssKeyId = obj.tssKeyId;

    return x;
  }

  toObject() {
    const x: IWallet = JSON.parse(JSON.stringify(this));
    x.isShared = this.isShared();
    return x;
  }

  /**
   * Get the maximum allowed number of required copayers.
   * This is a limit imposed by the maximum allowed size of the scriptSig.
   * @param {number} totalCopayers - the total number of copayers
   * @return {number}
   */
  static getMaxRequiredCopayers(totalCopayers) {
    return Wallet.COPAYER_PAIR_LIMITS[totalCopayers];
  }

  static verifyCopayerLimits(m, n) {
    return n >= 1 && n <= 15 && m >= 1 && m <= n;
  }

  isShared() {
    return this.n > 1;
  }

  isUTXOChain() {
    return !!Constants.UTXO_CHAINS[this.chain.toUpperCase()];
  }

  updateBEKeys() {
    $.checkState(this.isComplete(), 'Failed state: wallet incomplete at <updateBEKeys()>');

    const chain = this.chain || Utils.getChain(this.coin); // getChain -> backwards compatibility
    const bitcore = Bitcore[chain];
    const salt = config.BE_KEY_SALT || Defaults.BE_KEY_SALT;

    let seed = (this.copayers || []).map(c => c.xPubKey)
      .sort()
      .join('') +
      Utils.getGenericName(this.network) + // Maintaining compatibility with previous versions
      this.coin +
      salt;
    seed = bitcore.crypto.Hash.sha256(Buffer.from(seed));
    const priv = bitcore.PrivateKey(seed, this.network);

    this.beAuthPrivateKey2 = priv.toString();
    // WARN!! => this will generate an uncompressed pub key.
    this.beAuthPublicKey2 = priv.toPublicKey().toString();
  }

  _updatePublicKeyRing() {
    this.publicKeyRing = (this.copayers || []).map(c => Utils.pick(c, ['xPubKey', 'requestPubKey']) as { xPubKey: string; requestPubKey: string });
  }

  addCopayer(copayer) {
    $.checkState(copayer.coin == this.coin, 'Failed state: copayer.coin not equal to this.coin at <addCopayer()>');

    this.copayers.push(copayer);
    if (this.copayers.length < this.n) return;

    this.status = 'complete';
    this._updatePublicKeyRing();
  }

  addCopayerRequestKey(copayerId, requestPubKey, signature, restrictions, name) {
    $.checkState(
      this.copayers.length == this.n,
      'Failed state: this.copayers.length == this.n at addCopayerRequestKey()'
    );

    const c: any = this.getCopayer(copayerId);

    // new ones go first
    c.requestPubKeys.unshift({
      key: requestPubKey.toString(),
      signature,
      selfSigned: true,
      restrictions: restrictions || {},
      name: name || null
    });
  }

  getCopayer(copayerId): Copayer {
    return this.copayers.find(c => c.id == copayerId);
  }

  isComplete() {
    return this.status == 'complete';
  }

  isScanning() {
    return this.scanning;
  }

  isZceCompatible() {
    return this.coin === 'bch' && this.addressType === 'P2PKH';
  }

  createAddress(isChange, step?, escrowInputs?) {
    $.checkState(this.isComplete(), 'Failed state: this.isComplete() at <createAddress()>');

    const path = this.addressManager.getNewAddressPath(isChange, step);
    logger.debug('Deriving addr:' + path);
    const scriptType = escrowInputs ? 'P2SH' : this.addressType;
    return Address.derive(
      this.id,
      scriptType,
      this.publicKeyRing,
      path,
      this.m,
      this.coin,
      this.network,
      isChange,
      this.chain,
      !this.nativeCashAddr,
      escrowInputs,
      this.hardwareSourcePublicKey,
      this.clientDerivedPublicKey
    );
  }

  // Only for power scan
  getSkippedAddress() {
    $.checkState(this.isComplete(), 'Failed state: this.isComplete() at <getSkipeedAddress()>');

    const next = this.addressManager.getNextSkippedPath();
    if (!next) return;
    const address = Address.derive(
      this.id,
      this.addressType,
      this.publicKeyRing,
      next.path,
      this.m,
      this.coin,
      this.network,
      next.isChange,
      this.chain
    );
    return address;
  }
}
