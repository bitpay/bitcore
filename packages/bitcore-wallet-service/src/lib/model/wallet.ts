import _ from 'lodash';
import { ChainService } from '../chain/index';
import logger from '../logger';
import { Address } from './address';
import { AddressManager } from './addressmanager';
import { Copayer } from './copayer';

const $ = require('preconditions').singleton();
const Uuid = require('uuid');
const config = require('../../config');
const Common = require('../common');
const Constants = Common.Constants,
  Defaults = Common.Defaults,
  Utils = Common.Utils;
const Bitcore = {
  btc: require('bitcore-lib'),
  bch: require('bitcore-lib-cash'),
  eth: require('bitcore-lib'),
  xrp: require('bitcore-lib')
};

export interface IWallet {
  version: string;
  createdOn: number;
  id: number;
  name: string;
  m: number;
  n: number;
  singleAddress: boolean;
  status: string;
  publicKeyRing: Array<{ xPubKey: string; requestPubKey: string }>;
  addressIndex: number;
  copayers: string[];
  pubKey: string;
  coin: string;
  network: string;
  derivationStrategy: string;
  addressType: string;
  addressManager: string;
  scanStatus: 'error' | 'success';
  beRegistered: boolean; // Block explorer registered
  beAuthPrivateKey2: string;
  beAuthPublicKey2: string;
  nativeCashAddr: boolean;
  isTestnet?: boolean;
  usePurpose48?: boolean;
}

export class Wallet {
  version: string;
  createdOn: number;
  id: number;
  name: string;
  m: number;
  n: number;
  singleAddress: boolean;
  status: string;
  publicKeyRing: Array<{ xPubKey: string; requestPubKey: string }>;
  addressIndex: number;
  copayers: Array<Copayer>;
  pubKey: string;
  coin: string;
  network: string;
  derivationStrategy: string;
  addressType: string;
  addressManager: AddressManager;
  scanStatus: 'error' | 'success';
  beRegistered: boolean; // Block explorer registered
  beAuthPrivateKey2: string;
  beAuthPublicKey2: string;
  nativeCashAddr: boolean;
  isTestnet?: boolean;
  usePurpose48?: boolean;

  scanning: boolean;
  static COPAYER_PAIR_LIMITS = {};

  static create(opts) {
    opts = opts || {};

    let x = new Wallet();

    $.shouldBeNumber(opts.m);
    $.shouldBeNumber(opts.n);
    $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.COINS));
    $.checkArgument(Utils.checkValueInCollection(opts.network, Constants.NETWORKS));

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
    x.nativeCashAddr = _.isUndefined(opts.nativeCashAddr) ? (x.coin == 'bch' ? true : null) : opts.nativeCashAddr;

    return x;
  }

  static fromObj(obj: IWallet) {
    let x = new Wallet();

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
    x.copayers = _.map(obj.copayers, copayer => {
      return Copayer.fromObj(copayer);
    });
    x.pubKey = obj.pubKey;
    x.coin = obj.coin || Defaults.COIN;
    x.network = obj.network;
    if (!x.network) {
      x.network = obj.isTestnet ? 'testnet' : 'livenet';
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

    return x;
  }

  toObject() {
    let x: any = _.cloneDeep(this);
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

  isUTXOCoin() {
    return !!Constants.UTXO_COINS[this.coin.toUpperCase()];
  }

  updateBEKeys() {
    $.checkState(this.isComplete(), 'Failed state: wallet incomplete at <updateBEKeys()>');

    const chain = ChainService.getChain(this.coin).toLowerCase();
    const bitcore = Bitcore[chain];
    const salt = config.BE_KEY_SALT || Defaults.BE_KEY_SALT;

    var seed =
      _.map(this.copayers, 'xPubKey')
        .sort()
        .join('') +
      this.network +
      this.coin +
      salt;
    seed = bitcore.crypto.Hash.sha256(new Buffer(seed));
    const priv = bitcore.PrivateKey(seed, this.network);

    this.beAuthPrivateKey2 = priv.toString();
    // WARN!! => this will generate an uncompressed pub key.
    this.beAuthPublicKey2 = priv.toPublicKey().toString();
  }

  _updatePublicKeyRing() {
    this.publicKeyRing = _.map(this.copayers, copayer => {
      return _.pick(copayer, ['xPubKey', 'requestPubKey']);
    });
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

  createAddress(isChange, step) {
    $.checkState(this.isComplete(), 'Failed state: this.isComplete() at <createAddress()>');

    const path = this.addressManager.getNewAddressPath(isChange, step);
    logger.debug('Deriving addr:' + path);
    const address = Address.derive(
      this.id,
      this.addressType,
      this.publicKeyRing,
      path,
      this.m,
      this.coin,
      this.network,
      isChange,
      !this.nativeCashAddr
    );
    return address;
  }

  /// Only for power scan
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
      next.isChange
    );
    return address;
  }
}
