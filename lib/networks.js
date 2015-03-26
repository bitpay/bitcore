'use strict';
var _ = require('lodash');

var BufferUtil = require('./util/buffer');

var networks = [];
var networkMaps = {};

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
 * @function
 * @member Networks#get
 * Retrieves the network associated with a magic number or string.
 * @param {string|number|Network} arg
 * @param {string} key - if set, only check if the magic number associated with this name matches
 * @return Network
 */
function getNetwork(arg, key) {
  if (~networks.indexOf(arg)) {
    return arg;
  }
  if (key) {
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
 * @function
 * @member Networks#add
 * Will add a custom Network
 * @param {Object} data
 * @param {string} data.name - The name of the network
 * @param {string} data.alias - The aliased name of the network
 * @param {Number} data.pubkeyhash - The publickey hash prefix
 * @param {Number} data.privatekey - The privatekey prefix
 * @param {Number} data.scripthash - The scripthash prefix
 * @param {Number} data.xpubkey - The extended public key magic
 * @param {Number} data.xprivkey - The extended private key magic
 * @param {Number} data.networkMagic - The network magic number
 * @param {Number} data.port - The network port
 * @param {Array}  data.dnsSeeds - An array of dns seeds
 * @return Network
 */
function addNetwork(data) {

  var network = new Network();

  _.extend(network, {
    name: data.name,
    alias: data.alias,
    pubkeyhash: data.pubkeyhash,
    privatekey: data.privatekey,
    scripthash: data.scripthash,
    xpubkey: data.xpubkey,
    xprivkey: data.xprivkey,
    networkMagic: BufferUtil.integerAsBuffer(data.networkMagic),
    port: data.port,
    dnsSeeds: data.dnsSeeds,
    genesis: data.genesis,
  });

  _.each(_.values(network), function(value) {
    if (!_.isUndefined(value) && !_.isObject(value)) {
      networkMaps[value] = network;
    }
  });

  networks.push(network);

  return network;

}

addNetwork({
  name: 'livenet',
  alias: 'mainnet',
  pubkeyhash: 0x00,
  privatekey: 0x80,
  scripthash: 0x05,
  xpubkey: 0x0488b21e,
  xprivkey: 0x0488ade4,
  networkMagic: 0xf9beb4d9,
  port: 8333,
  dnsSeeds: [
    'seed.bitcoin.sipa.be',
    'dnsseed.bluematt.me',
    'dnsseed.bitcoin.dashjr.org',
    'seed.bitcoinstats.com',
    'seed.bitnodes.io',
    'bitseed.xf2.org'
  ],
  genesis: new Buffer('010000000000000000000000000000000000000000000000000000000000' +
    '0000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a5132' +
    '3a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c01010000000100000000' +
    '00000000000000000000000000000000000000000000000000000000ffff' +
    'ffff4d04ffff001d0104455468652054696d65732030332f4a616e2f3230' +
    '3039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f' +
    '6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01' +
    '000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a6' +
    '7962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b' +
    '8d578a4c702b6bf11d5fac00000000', 'hex')
});

addNetwork({
  name: 'testnet',
  alias: 'testnet',
  pubkeyhash: 0x6f,
  privatekey: 0xef,
  scripthash: 0xc4,
  xpubkey: 0x043587cf,
  xprivkey: 0x04358394,
  networkMagic: 0x0b110907,
  port: 18333,
  dnsSeeds: [
    'testnet-seed.bitcoin.petertodd.org',
    'testnet-seed.bluematt.me',
    'testnet-seed.alexykot.me',
    'testnet-seed.bitcoin.schildbach.de'
  ],
  genesis: '000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943'
});

/**
 * @instance
 * @member Networks#livenet
 */
var livenet = getNetwork('livenet');

/**
 * @instance
 * @member Networks#testnet
 */
var testnet = getNetwork('testnet');

/**
 * @namespace Networks
 */
module.exports = {
  add: addNetwork,
  defaultNetwork: livenet,
  livenet: livenet,
  mainnet: livenet,
  testnet: testnet,
  get: getNetwork
};
