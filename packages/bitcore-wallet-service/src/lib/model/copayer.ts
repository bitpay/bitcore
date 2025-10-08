import { singleton } from 'preconditions';
import sjcl from 'sjcl';
import { Common } from '../common';
import { Address } from './address';
import { AddressManager, IAddressManager } from './addressmanager';

const $ = singleton();
const {
  Constants,
  Defaults,
  Utils
} = Common;

export interface ICopayer {
  version: number;
  createdOn: number;
  coin: string;
  xPubKey: string;
  id: string;
  name: string;
  requestPubKey: string;
  signature: string;
  requestPubKeys: Array<{
    key: string;
    signature: string;
  }>;
  customData?: any;
  walletId: string;
  isSupportStaff?: boolean;
  isMarketingStaff?: boolean;
  addressManager?: IAddressManager;
}

export class Copayer {
  version: number;
  createdOn: number;
  coin: string;
  chain: string;
  xPubKey: string;
  hardwareSourcePublicKey: string;
  clientDerivedPublicKey: string;
  id: string;
  name: string;
  requestPubKey: string;
  signature: string;
  requestPubKeys: Array<{
    key: string;
    signature: string;
  }>;
  customData?: any;
  addressManager: AddressManager;
  walletId: string;
  isSupportStaff?: boolean;
  isMarketingStaff?: boolean;

  static xPubToCopayerId(coin, xpub) {
    const str = coin == Defaults.COIN ? xpub : coin + xpub;
    const hash = sjcl.hash.sha256.hash(str);
    return sjcl.codec.hex.fromBits(hash);
  }

  static create(opts) {
    opts = opts || {};
    if (!opts.hardwareSourcePublicKey && !opts.clientDerivedPublicKey) {
      $.checkArgument(opts.xPubKey, 'Missing copayer extended public key')
    }
    $.checkArgument(opts.requestPubKey, 'Missing copayer request public key')
      .checkArgument(opts.signature, 'Missing copayer request public key signature');

    $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.CHAINS));

    opts.copayerIndex = opts.copayerIndex || 0;

    const x = new Copayer();

    x.version = 2;
    x.createdOn = Math.floor(Date.now() / 1000);
    x.coin = opts.coin;
    x.chain = opts.chain || opts.coin;
    x.xPubKey = opts.xPubKey;
    x.hardwareSourcePublicKey = opts.hardwareSourcePublicKey;
    x.clientDerivedPublicKey = opts.clientDerivedPublicKey;
    x.id = Copayer.xPubToCopayerId(opts.chain, x.xPubKey);
    x.name = opts.name;
    x.requestPubKey = opts.requestPubKey;
    x.signature = opts.signature;
    x.requestPubKeys = [
      {
        key: opts.requestPubKey,
        signature: opts.signature
      }
    ];

    const derivationStrategy = opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
    if (AddressManager.supportsCopayerBranches(derivationStrategy)) {
      x.addressManager = AddressManager.fromObj({
        derivationStrategy,
        copayerIndex: opts.copayerIndex
      });
    }

    x.customData = opts.customData;

    return x;
  }

  static fromObj(obj) {
    const x = new Copayer();

    x.version = obj.version;
    x.createdOn = obj.createdOn;
    x.coin = obj.coin || Defaults.COIN;
    x.chain = obj.chain || x.coin;
    x.id = obj.id || obj.copayerId;
    x.name = obj.name;
    x.xPubKey = obj.xPubKey;
    x.hardwareSourcePublicKey = obj.hardwareSourcePublicKey;
    x.clientDerivedPublicKey = obj.clientDerivedPublicKey;
    x.requestPubKey = obj.requestPubKey;
    x.signature = obj.signature;

    if (parseInt(x.version?.toString()) == 1) {
      x.requestPubKeys = [
        {
          key: x.requestPubKey,
          signature: x.signature
        }
      ];
      x.version = 2;
    } else {
      x.requestPubKeys = obj.requestPubKeys;
    }

    if (obj.addressManager) {
      x.addressManager = AddressManager.fromObj(obj.addressManager);
    }
    x.customData = obj.customData;
    x.walletId = obj.walletId;
    x.isSupportStaff = obj.isSupportStaff;
    x.isMarketingStaff = obj.isMarketingStaff;

    return x;
  }

  createAddress(wallet, isChange) {
    $.checkState(wallet.isComplete(), 'Failed state: wallet incomplete at <createAddress()>');

    const path = this.addressManager.getNewAddressPath(isChange);
    const address = Address.derive(
      wallet.id,
      wallet.addressType,
      wallet.publicKeyRing,
      path,
      wallet.m,
      wallet.coin,
      wallet.network,
      isChange,
      wallet.chain
    );
    return address;
  }
}
