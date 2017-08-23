'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');

var Bitcore = {
  'btc': require('bitcore-lib'),
  'bch': require('bitcore-lib-cash'),
};
var Common = require('../common');
var Constants = Common.Constants,
  Defaults = Common.Defaults,
  Utils = Common.Utils;

function Address() {};

Address.create = function(opts) {
  opts = opts || {};

  var x = new Address();

  $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.COINS));

  x.version = '1.0.0';
  x.createdOn = Math.floor(Date.now() / 1000);
  x.address = opts.address;
  x.walletId = opts.walletId;
  x.isChange = opts.isChange;
  x.path = opts.path;
  x.publicKeys = opts.publicKeys;
  x.coin = opts.coin;
  x.network = Bitcore[opts.coin].Address(x.address).toObject().network;
  x.type = opts.type || Constants.SCRIPT_TYPES.P2SH;
  x.hasActivity = undefined;
  return x;
};

Address.fromObj = function(obj) {
  var x = new Address();

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
  return x;
};

Address._deriveAddress = function(scriptType, publicKeyRing, path, m, coin, network) {
  $.checkArgument(Utils.checkValueInCollection(scriptType, Constants.SCRIPT_TYPES));

  var publicKeys = _.map(publicKeyRing, function(item) {
    var xpub = new Bitcore[coin].HDPublicKey(item.xPubKey);
    return xpub.deriveChild(path).publicKey;
  });

  var bitcoreAddress;
  switch (scriptType) {
    case Constants.SCRIPT_TYPES.P2SH:
      bitcoreAddress = Bitcore[coin].Address.createMultisig(publicKeys, m, network);
      break;
    case Constants.SCRIPT_TYPES.P2PKH:
      $.checkState(_.isArray(publicKeys) && publicKeys.length == 1);
      bitcoreAddress = Bitcore[coin].Address.fromPublicKey(publicKeys[0], network);
      break;
  }

  return {
    address: bitcoreAddress.toString(),
    path: path,
    publicKeys: _.invoke(publicKeys, 'toString'),
  };
};

Address.derive = function(walletId, scriptType, publicKeyRing, path, m, coin, network, isChange) {
  var raw = Address._deriveAddress(scriptType, publicKeyRing, path, m, coin, network);
  return Address.create(_.extend(raw, {
    coin: coin,
    walletId: walletId,
    type: scriptType,
    isChange: isChange,
  }));
};


module.exports = Address;
