'use strict';
var _ = require('lodash');

var BufferUtil = require('./util/buffer');

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
  xprivkey: 0x0488ade4,
  networkMagic: BufferUtil.integerAsBuffer(0xf9beb4d9),
  port: 8333,
  dnsSeeds: [
    'seed.bitcoin.sipa.be',
    'dnsseed.bluematt.me',
    'dnsseed.bitcoin.dashjr.org',
    'seed.bitcoinstats.com',
    'seed.bitnodes.io',
    'bitseed.xf2.org'
  ]
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
  xprivkey: 0x04358394,
  networkMagic: BufferUtil.integerAsBuffer(0x0b110907),
  port: 18333,
  dnsSeeds: [
    'testnet-seed.bitcoin.petertodd.org',
    'testnet-seed.bluematt.me'
  ],
});

var networkMaps = {};

_.each(_.values(livenet), function(value) {
  if (!_.isObject(value)) {
    networkMaps[value] = livenet;
  }
});
_.each(_.values(testnet), function(value) {
  if (!_.isObject(value)) {
    networkMaps[value] = testnet;
  }
});

/**
 * @function
 * @member Network#getNetwork
 * Retrieves the network associated with a magic number or string.
 * @param {string|number|Network} arg
 * @param {string} key - if set, only check if the magic number associated with this name matches
 * @return Network
 */
function getNetwork(arg, key) {
  if (arg === livenet || arg === testnet) {
    return arg;
  }
  if (key) {
    var networks = [livenet, testnet];
    for (var index in networks) {
      if (networks[index][key] === arg) {
        return networks[index];
      }
    }
    return undefined;
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
