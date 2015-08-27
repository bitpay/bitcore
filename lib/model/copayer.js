'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var util = require('util');

var Uuid = require('uuid');

var Address = require('./address');
var AddressManager = require('./addressmanager');
var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var HDPublicKey = Bitcore.HDPublicKey;

function Copayer() {};

Copayer.create = function(opts) {
  opts = opts || {};
  $.checkArgument(opts.xPubKey, 'Missing copayer extended public key')
    .checkArgument(opts.requestPubKey, 'Missing copayer request public key')
    .checkArgument(opts.signature, 'Missing copayer request public key signature');

  opts.copayerIndex = opts.copayerIndex || 0;

  var x = new Copayer();

  x.version = 2;
  x.createdOn = Math.floor(Date.now() / 1000);
  x.xPubKey = opts.xPubKey;
  x.id = WalletUtils.xPubToCopayerId(x.xPubKey);
  x.name = opts.name;
  x.requestPubKey = opts.requestPubKey;
  x.signature = opts.signature;
  x.requestPubKeys = [{
    key: opts.requestPubKey,
    signature: opts.signature,
  }];

  x.addressManager = AddressManager.create({
    derivationStrategy: 'BIP45',
    copayerIndex: opts.copayerIndex,
  });

  x.customData = opts.customData;

  return x;
};

Copayer.fromObj = function(obj) {
  var x = new Copayer();

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.id = obj.id;
  x.name = obj.name;
  x.xPubKey = obj.xPubKey;
  x.requestPubKey = obj.requestPubKey;
  x.signature = obj.signature;

  if (parseInt(x.version) == 1) {
    x.requestPubKeys = [{
      key: x.requestPubKey,
      signature: x.signature,
    }];
    x.version = 2;
  } else {
    x.requestPubKeys = obj.requestPubKeys;
  }

  x.addressManager = AddressManager.fromObj(obj.addressManager);
  x.customData = obj.customData;

  return x;
};

Copayer.prototype.createAddress = function(wallet, isChange) {
  $.checkState(wallet.isComplete());

  var path = this.addressManager.getNewAddressPath(isChange);
  var raw = Address.create(WalletUtils.deriveAddress(wallet.publicKeyRing, path, wallet.m, wallet.network));
  var address = Address.create(_.extend(raw, {
    walletId: wallet.id,
  }));

  address.isChange = isChange;
  return address;
};

module.exports = Copayer;
