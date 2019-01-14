'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var Bitcore = require('bitcore-lib-cash');
var Common = require('../common');
const Stealth = require('bitcore-stealth');
var Constants = Common.Constants,
  Defaults = Common.Defaults,
  Utils = Common.Utils;

function StealthAddress() {};

StealthAddress.create = function(opts) {
  opts = opts || {};

  var x = new StealthAddress();

  x.version = '1.0.0';
  x.createdOn = Math.floor(Date.now() / 1000);

  x.address = opts.address;
  x.walletId = opts.walletId;
  x.network = opts.network;

  x.scanPrivKey = opts.scanPrivKey;
  x.scanPubKey = opts.scanPubKey;
  x.spendPubKeys = opts.spendPubKeys;
  x.m = opts.m;

  return x;
};

StealthAddress.fromObj = function(obj) {
  var x = new StealthAddress();

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.address = obj.address;
  x.walletId = obj.walletId;
  x.network = obj.network;

  x.scanPrivKey = obj.scanPrivKey;
  x.scanPubKey = obj.scanPubKey;
  x.spendPubKeys = obj.spendPubKeys;
  x.m = obj.m;
  return x;
};

module.exports = StealthAddress;
