'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var util = require('util');
var async = require('async');
var log = require('npmlog');
var events = require('events');
log.debug = log.verbose;
var Bitcore = require('bitcore')
var WalletUtils = require('bitcore-wallet-utils');

var Credentials = require('./credentials');
var Verifier = require('./verifier');
var ServerCompromisedError = require('./servercompromisederror');
var ClientError = require('./clienterror');

function AirGapped(opts) {
  this.verbose = !!opts.verbose;
  if (this.verbose) {
    log.level = 'debug';
  } else {
    log.level = 'info';
  }
  this.credentials = Credentials.create(opts.network || 'livenet');
};

util.inherits(AirGapped, events.EventEmitter);

AirGapped.prototype.getSeed = function() {
  return {
    xPubKey: this.credentials.xPubKey,
    requestPrivKey: this.credentials.requestPrivKey,
  };
};

AirGapped.prototype.signTxProposal = function(txp, encryptedPkr, m, n) {
  var self = this;

  var publicKeyRing;
  try {
    publicKeyRing = JSON.parse(WalletUtils.decryptMessage(encryptedPkr, self.credentials.personalEncryptingKey));
  } catch (ex) {
    console.log(ex);
    throw new Error('Could not decrypt public key ring');
  }

  if (!_.isArray(publicKeyRing) || publicKeyRing.length != n) {
    throw new Error('Invalid public key ring');
  }

  self.credentials.m = m;
  self.credentials.n = n;
  self.credentials.addPublicKeyRing(publicKeyRing);

  if (!Verifier.checkTxProposal(self.credentials, txp)) {
    throw new Error('Fake transaction proposal');
  }
  return WalletUtils.signTxp(txp, self.credentials.xPrivKey);
};

module.exports = AirGapped;
