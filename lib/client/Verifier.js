var $ = require('preconditions').singleton();
var _ = require('lodash');

var BitcoinUtils = require('../bitcoinutils')

function Verifier(opts) {};

Verifier.checkAddress = function(data, address) {
    var local =  BitcoinUtils.deriveAddress(data.publicKeyRing, address.path, data.m, data.network);
    return (local.address == address.address 
        && JSON.stringify(local.publicKeys) == JSON.stringify(address.publicKeys));
};

module.exports = Verifier;
