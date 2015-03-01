'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var util = require('util');
var async = require('async');
var log = require('npmlog');
var events = require('events');
log.debug = log.verbose;
var Bitcore = require('bitcore')

var Credentials = require('./credentials');
var WalletUtils = require('../walletutils');
var Verifier = require('./verifier');
var ServerCompromisedError = require('./servercompromisederror');
var ClientError = require('../clienterror');

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
  var cred = this.credentials;

  return {
    network: cred.network,
    xPubKey: cred.xPubKey,
    requestPrivKey: cred.requestPrivKey,
  };
};

AirGapped.prototype.signTxProposals = function(txps, cb) {
  return cb(null, _.map(txps, function(txp) {
    return {};
  }));
};

module.exports = AirGapped;
