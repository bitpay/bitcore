'use strict';
var _ = require('lodash');

/**
 * A network is merely a map containing values that correspond to version
 * numbers for each bitcoin network. Currently only supporting "livenet"
 * (a.k.a. "mainnet") and "testnet".
 * @constructor
 */
function Network() {}

Network.prototype.toString = function toString() {
  return this.name;
};

/**
 * @instance
 * @member Network#livenet
 */
var livenet = new Network();
_.extend(livenet, {
  name: 'livenet',
  alias: 'mainnet',
  pubkeyhash: 0x00,
  privatekey: 0x80,
  scripthash: 0x05,
  xpubkey:  0x0488b21e,
  xprivkey: 0x0488ade4
});

/**
 * @instance
 * @member Network#testnet
 */
var testnet = new Network();
_.extend(testnet, {
  name: 'testnet',
  alias: 'testnet',
  pubkeyhash: 0x6f,
  privatekey: 0xef,
  scripthash: 0xc4,
  xpubkey: 0x043587cf,
  xprivkey: 0x04358394
});

var networkMaps = {};

_.each(_.values(livenet), function(value) {
  networkMaps[value] = livenet;
});
_.each(_.values(testnet), function(value) {
  networkMaps[value] = testnet;
});

/**
 * @function
 * @member Network#getNetwork
 * Retrieves the network associated with a magic number or string.
 * @param {string|number|Network} arg
 * @return Network
 */
function getNetwork(arg) {
  if (arg === livenet || arg === testnet) {
    return arg;
  }
  return networkMaps[arg];
}

/**
 * @namespace Network
 */
module.exports = {
  defaultNetwork: livenet,
  livenet: livenet,
  mainnet: livenet,
  testnet: testnet,
  get: getNetwork
};
