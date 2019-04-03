var $ = require('preconditions').singleton();
import CWC from 'crypto-wallet-core';
import * as _ from 'lodash';
var Common = require('../common');
var Constants = Common.Constants,
  Defaults = Common.Defaults,
  Utils = Common.Utils;

export interface IAddress {
  version: string;
  createdOn: number;
  address: string;
  walletId: string;
  isChange: boolean;
  path: string;
  publicKeys: string[];
  coin: string;
  network: string;
  type: string;
  hasActivity: boolean;
  beRegistered: boolean;
}

export class Address {
  version: string;
  createdOn: number;
  address: string;
  walletId: string;
  isChange: boolean;
  path: string;
  publicKeys: string[];
  coin: string;
  network: string;
  type: string;
  hasActivity: boolean;
  beRegistered: boolean;

  static Bitcore = {
    btc: require('bitcore-lib'),
    bch: require('bitcore-lib-cash')
  };

  static create(opts) {
    opts = opts || {};

    const x = new Address();

    $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.COINS));

    x.version = '1.0.0';
    x.createdOn = Math.floor(Date.now() / 1000);
    x.address = opts.address;
    x.walletId = opts.walletId;
    x.isChange = opts.isChange;
    x.path = opts.path;
    x.publicKeys = opts.publicKeys;
    x.coin = opts.coin;
    x.network = Address.Bitcore.btc
      .Address(x.address)
      .toObject().network;
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
    x.coin = obj.coin || Defaults.COIN;
    x.network = obj.network;
    x.isChange = obj.isChange;
    x.path = obj.path;
    x.publicKeys = obj.publicKeys;
    x.type = obj.type || Constants.SCRIPT_TYPES.P2SH;
    x.hasActivity = obj.hasActivity;
    x.beRegistered = obj.beRegistered;
    return x;
  }

  static _deriveAddress(
    scriptType,
    publicKeyRing,
    path,
    m,
    coin,
    network,
    noNativeCashAddr
  ) {
    $.checkArgument(
      Utils.checkValueInCollection(scriptType, Constants.SCRIPT_TYPES)
    );
    var bitcoreAddress;
    var publicKeys = _.map(publicKeyRing, function(item) {
      var xpub = new Address.Bitcore.btc.HDPublicKey(item.xPubKey);
      return xpub.deriveChild(path).publicKey;
    });
    // if (coin === 'eth') {
    //   const pathIndex = /\/([0-9]*)*/;
    //   const [_purpose, _account, changeIndex, addressIndex] = path.match(pathIndex).group;
    // } else {
    switch (scriptType) {
      case Constants.SCRIPT_TYPES.P2SH:
        bitcoreAddress = Address.Bitcore.btc.Address.createMultisig(
          publicKeys,
          m,
          network
        );
        break;
      case Constants.SCRIPT_TYPES.P2PKH:
        $.checkState(_.isArray(publicKeys) && publicKeys.length == 1);
        bitcoreAddress = Address.Bitcore.btc.Address.fromPublicKey(
          publicKeys[0],
          network
        );
        break;
    }
    bitcoreAddress = CWC.deriver.deriveAddress('ETH', 'mainnet', '17VZNX1SN5NtKa8UQFxwQbFeFc3iqRYhem', 0, false);
    console.log(bitcoreAddress);
    // let addrStr = bitcoreAddress.toString(true);
    // if (noNativeCashAddr && coin == 'bch') {
    //   addrStr = bitcoreAddress.toLegacyAddress();
    // }

    return {
      // bws still use legacy addresses for BCH
      address: `0x${bitcoreAddress}`,
      path,
      publicKeys: _.invokeMap(publicKeys, 'toString')
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
    noNativeCashAddr = false
  ) {
    const raw = Address._deriveAddress(
      scriptType,
      publicKeyRing,
      path,
      m,
      coin,
      network,
      noNativeCashAddr
    );
    return Address.create(
      _.extend(raw, {
        coin,
        walletId,
        type: scriptType,
        isChange
      })
    );
  }
}
