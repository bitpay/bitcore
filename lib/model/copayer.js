'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var util = require('util');

var Bitcore = require('bitcore');
var HDPublicKey = Bitcore.HDPublicKey;
var Uuid = require('uuid');
var AddressManager = require('./addressmanager');
var WalletUtils = require('bitcore-wallet-utils');


function Copayer() {
  this.version = '1.0.0';
};

Copayer.create = function(opts) {
  opts = opts || {};
  $.checkArgument(opts.xPubKey, 'Missing extended public key');
  $.checkArgument(opts.requestPubKey, 'Missing request public key');

  opts.copayerIndex = opts.copayerIndex || 0;

  var x = new Copayer();
  x.createdOn = Math.floor(Date.now() / 1000);

  x.xPubKey = opts.xPubKey;

  x.id = WalletUtils.xPubToCopayerId(x.xPubKey);
  x.name = opts.name;
  x.xPubKeySignature = opts.xPubKeySignature; // So third parties can check independently
  x.requestPubKey = opts.requestPubKey;
  x.addressManager = AddressManager.create({
    copayerIndex: opts.copayerIndex
  });

  return x;
};

Copayer.fromObj = function(obj) {
  var x = new Copayer();

  x.createdOn = obj.createdOn;
  x.id = obj.id;
  x.name = obj.name;
  x.xPubKey = obj.xPubKey;
  x.xPubKeySignature = obj.xPubKeySignature;
  x.requestPubKey = obj.requestPubKey;
  x.addressManager = AddressManager.fromObj(obj.addressManager);

  return x;
};


module.exports = Copayer;
