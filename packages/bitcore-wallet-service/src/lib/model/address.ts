import {
  BitcoreLib,
  BitcoreLibCash,
  BitcoreLibDoge,
  BitcoreLibLtc,
  Deriver
} from 'crypto-wallet-core';
import _ from 'lodash';
import { singleton } from 'preconditions';
import { Common } from '../common';
import { AddressManager } from './addressmanager';

const $ = singleton();
const { Constants, Utils } = Common;

export interface IAddress {
  version: string;
  createdOn: number;
  address: string;
  walletId: string;
  isChange?: boolean;
  isEscrow?: boolean;
  path: string;
  publicKeys: Array<string>;
  coin: string;
  chain: string;
  network: string;
  type: string;
  hasActivity?: boolean;
  beRegistered?: boolean;
}

export class Address {
  version: string;
  createdOn: number;
  address: string;
  walletId: string;
  isChange: boolean;
  isEscrow: boolean;
  path: string;
  publicKeys: string[];
  coin: string;
  chain: string;
  network: string;
  type: string;
  hasActivity: boolean;
  beRegistered: boolean;

  static Bitcore = {
    btc: BitcoreLib,
    bch: BitcoreLibCash,
    doge: BitcoreLibDoge,
    ltc: BitcoreLibLtc
  };

  static create(opts) {
    opts = opts || {};

    const x = new Address();

    opts.chain = opts.chain || Utils.getChain(opts.coin); // getChain -> backwards compatibility
    $.checkArgument(Utils.checkValueInCollection(opts.chain, Constants.CHAINS));

    x.version = '1.0.0';
    x.createdOn = Math.floor(Date.now() / 1000);
    x.address = opts.address;
    x.walletId = opts.walletId;
    x.isChange = opts.isChange;
    x.isEscrow = opts.isEscrow;
    x.path = opts.path;
    x.publicKeys = opts.publicKeys;
    x.coin = opts.chain;
    x.chain = opts.chain;
    x.network = Address.Bitcore[opts.chain]
      ? Address.Bitcore[opts.chain].Address(x.address).toObject().network
      : opts.network;
    x.type = opts.type || Constants.SCRIPT_TYPES.P2SH;
    x.hasActivity = undefined;
    x.beRegistered = null;
    return x;
  }

  static fromObj(obj) {
    const x = new Address();

    x.version = obj.version;
    x.createdOn = obj.createdOn;
    x.address = obj.address;
    x.walletId = obj.walletId;
    x.coin = obj.chain || Utils.getChain(obj.coin);
    x.chain = x.coin;
    x.network = Utils.getNetworkName(x.chain, obj.network) || obj.network;
    x.isChange = obj.isChange;
    x.isEscrow = obj.isEscrow;
    x.path = obj.path;
    x.publicKeys = obj.publicKeys;
    x.type = obj.type || Constants.SCRIPT_TYPES.P2SH;
    x.hasActivity = obj.hasActivity;
    x.beRegistered = obj.beRegistered;
    return x;
  }

  static _deriveAddress(scriptType, publicKeyRing, path, m, chain, network, noNativeCashAddr, escrowInputs?, hardwareSourcePublicKey?, clientDerivedPublicKey?) {
    $.checkArgument(Utils.checkValueInCollection(scriptType, Constants.SCRIPT_TYPES));
    const externSourcePublicKey = hardwareSourcePublicKey || clientDerivedPublicKey;
    if (externSourcePublicKey) {
      let bitcoreAddress;
      try {
        bitcoreAddress = Deriver.deriveAddressWithPath(chain.toUpperCase(), network, externSourcePublicKey, path, scriptType);
      } catch {
        // some chains (e.g. SOL) cannot derive address along path from pub key.
        bitcoreAddress = Deriver.getAddress(chain.toUpperCase(), network, externSourcePublicKey, scriptType);
      }
      return {
        address: bitcoreAddress.toString(),
        path,
        publicKeys: [externSourcePublicKey]
      };
    }

    let publicKeys = (publicKeyRing || []).map(item => {
      const xpub = Address.Bitcore[chain]
        ? new Address.Bitcore[chain].HDPublicKey(item.xPubKey)
        : new Address.Bitcore.btc.HDPublicKey(item.xPubKey);
      return xpub.deriveChild(path).publicKey;
    });

    let bitcoreAddress;
    switch (scriptType) {
      case Constants.SCRIPT_TYPES.P2WSH:
        const nestedWitness = false;
        bitcoreAddress = Address.Bitcore[chain].Address.createMultisig(
          publicKeys,
          m,
          network,
          nestedWitness,
          'witnessscripthash'
        );
        break;
      case Constants.SCRIPT_TYPES.P2SH:
        if (escrowInputs) {
          const xpub = new Address.Bitcore[chain].HDPublicKey(publicKeyRing[0].xPubKey);
          const inputPublicKeys = escrowInputs.map(input => xpub.deriveChild(input.path).publicKey);
          bitcoreAddress = Address.Bitcore[chain].Address.createEscrow(inputPublicKeys, publicKeys[0], network);
          publicKeys = [publicKeys[0], ...inputPublicKeys];
        } else {
          bitcoreAddress = Address.Bitcore[chain].Address.createMultisig(publicKeys, m, network);
        }
        break;
      case Constants.SCRIPT_TYPES.P2WPKH:
        bitcoreAddress = Address.Bitcore[chain].Address.fromPublicKey(publicKeys[0], network, 'witnesspubkeyhash');
        break;
      case Constants.SCRIPT_TYPES.P2PKH:
        $.checkState(
          Array.isArray(publicKeys) && publicKeys.length == 1,
          'Failed state: publicKeys length < 1 or publicKeys not an array at <_deriveAddress()>'
        );

        if (Address.Bitcore[chain]) {
          bitcoreAddress = Address.Bitcore[chain].Address.fromPublicKey(publicKeys[0], network);
        } else {
          const { addressIndex, isChange } = new AddressManager().parseDerivationPath(path);
          const [{ xPubKey }] = publicKeyRing;
          bitcoreAddress = Deriver.deriveAddress(chain.toUpperCase(), network, xPubKey, addressIndex, isChange);
        }
        break;
      case Constants.SCRIPT_TYPES.P2TR:
        // TODO: add support for multisig taproot
        bitcoreAddress = Address.Bitcore[chain].Address.fromPublicKey(publicKeys[0], network, 'taproot');
        break;
    }

    let addrStr = bitcoreAddress.toString(true);
    if (noNativeCashAddr && chain == 'bch') {
      addrStr = bitcoreAddress.toLegacyAddress();
    }

    return {
      // bws still uses legacy addresses for BCH
      address: addrStr,
      path,
      publicKeys: publicKeys.map(pk => pk.toString())
    };
  }

  // noNativeCashAddr only for testing
  static derive(
    walletId,
    scriptType,
    publicKeyRing,
    path,
    m,
    coin,
    network,
    isChange,
    chain,
    noNativeCashAddr = false,
    escrowInputs?,
    hardwareSourcePublicKey?,
    clientDerivedPublicKey?
  ) {
    const raw = Address._deriveAddress(
      scriptType,
      publicKeyRing,
      path,
      m,
      chain || Utils.getChain(coin), // getChain -> backwards compatibility
      network,
      noNativeCashAddr,
      escrowInputs,
      hardwareSourcePublicKey,
      clientDerivedPublicKey
    );
    return Address.create(
      _.extend(raw, {
        coin,
        chain,
        network,
        walletId,
        type: scriptType,
        isChange,
        isEscrow: !!escrowInputs
      })
    );
  }
}
