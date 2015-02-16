var $ = require('preconditions').singleton();
var _ = require('lodash');

var Bitcore = require('bitcore');
var BitcoinUtils = require('../bitcoinutils')

function Verifier(opts) {};

Verifier.checkAddress = function(data, address) {
    var local =  BitcoinUtils.deriveAddress(data.publicKeyRing, address.path, data.m, data.network);
    if (local.address != address.address || JSON.stringify(local.publicKeys)!= JSON.stringify(address.publicKeys))
      return cb('Server sent a fake address.');
};

module.exports = Verifier;
