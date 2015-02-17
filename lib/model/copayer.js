'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var util = require('util');

var Bitcore = require('bitcore');
var HDPublicKey = Bitcore.HDPublicKey;
var Uuid = require('uuid');
var AddressManager = require('./addressmanager');
var Utils = require('../walletutils');


var VERSION = '1.0.0';
var MESSAGE_SIGNING_PATH = "m/1/0";

function Copayer() {
  this.version = VERSION;
};

Copayer.create = function(opts) {
  $.checkArgument(opts && opts.xPubKey, 'need to provide an xPubKey');

  opts.copayerIndex = opts.copayerIndex || 0;

  var x = new Copayer();
  x.createdOn = Math.floor(Date.now() / 1000);

  x.xPubKey = opts.xPubKey;

  x.id = Utils.xPubToCopayerId(x.xPubKey);
  x.name = opts.name;
  x.xPubKeySignature = opts.xPubKeySignature; // So third parties can check independently
  x.signingPubKey = x.getSigningPubKey();
  x.addressManager = new AddressManager({
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
  x.signingPubKey = obj.signingPubKey;
  x.addressManager = AddressManager.fromObj(obj.addressManager);

  return x;
};

Copayer.prototype.getPublicKey = function(path) {
  return HDPublicKey
    .fromString(this.xPubKey)
    .derive(path)
    .publicKey
    .toString();
};

Copayer.prototype.getSigningPubKey = function() {
  return this.getPublicKey(MESSAGE_SIGNING_PATH);
};

module.exports = Copayer;
