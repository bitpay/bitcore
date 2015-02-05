'use strict';

var _ = require('lodash');
var util = require('util');

var Bitcore = require('bitcore');
var HDPublicKey = Bitcore.HDPublicKey;

var AddressManager = require('./addressmanager');


var VERSION = '1.0.0';
var MESSAGE_SIGNING_PATH = "m/1/0";

function Copayer(opts) {
  opts = opts || {};
  opts.copayerIndex = opts.copayerIndex || 0;

  this.version = VERSION;
  this.createdOn = Math.floor(Date.now() / 1000);
  this.id = opts.id;
  this.name = opts.name;
  this.xPubKey = opts.xPubKey;
  this.xPubKeySignature = opts.xPubKeySignature; // So third parties can check independently
  this.signingPubKey = this.getSigningPubKey();
  this.addressManager = new AddressManager({ copayerIndex: opts.copayerIndex });
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

module.exports = Copayer;
