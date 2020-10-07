'use strict';
var _ = require('lodash');

var BufferUtil = require('./util/buffer');
var JSUtil = require('./util/js');
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
 * @param {string|Array} keys - if set, only check if the magic number associated with this name matches
 * @return Network
 */
function get(arg, keys) {
  if (~networks.indexOf(arg)) {
    return arg;
  }
  if (keys) {
    if (!_.isArray(keys)) {
      keys = [keys];
    }
    var containsArg = function(key) {
      return networks[index][key] === arg;
    };
    for (var index in networks) {
      if (_.some(keys, containsArg)) {
        return networks[index];
      }
    }
    return undefined;
  }
  if(networkMaps[arg] && networkMaps[arg].length >= 1) {
    return networkMaps[arg][0];
  } else {
    return networkMaps[arg];
  }
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
 * @param {string} data.bech32prefix - The native segwit prefix
 * @param {Number} data.xpubkey - The extended public key magic
 * @param {Number} data.xprivkey - The extended private key magic
 * @param {Number} data.networkMagic - The network magic number
 * @param {Number} data.port - The network port
 * @param {Array}  data.dnsSeeds - An array of dns seeds
 * @return Network
 */
function addNetwork(data) {

  var network = new Network();

  JSUtil.defineImmutable(network, {
    name: data.name,
    alias: data.alias,
    pubkeyhash: data.pubkeyhash,
    privatekey: data.privatekey,
    scripthash: data.scripthash,
    bech32prefix: data.bech32prefix,
    xpubkey: data.xpubkey,
    xprivkey: data.xprivkey
  });

  if (data.networkMagic) {
    JSUtil.defineImmutable(network, {
      networkMagic: BufferUtil.integerAsBuffer(data.networkMagic)
    });
  }

  if (data.port) {
    JSUtil.defineImmutable(network, {
      port: data.port
    });
  }

  if (data.dnsSeeds) {
    JSUtil.defineImmutable(network, {
      dnsSeeds: data.dnsSeeds
    });
  }
  _.each(network, function(value) {
    if (!_.isUndefined(value) && !_.isObject(value)) {
      if(!networkMaps[value]) {
        networkMaps[value] = [];
      }
      networkMaps[value].push(network);
    }
  });

  networks.push(network);

  return network;

}

/**
 * @function
 * @member Networks#remove
 * Will remove a custom network
 * @param {Network} network
 */
function removeNetwork(network) {
  for (var i = 0; i < networks.length; i++) {
    if (networks[i] === network) {
      networks.splice(i, 1);
    }
  }
  for (var key in networkMaps) {
    const index = networkMaps[key].indexOf(network);
    if (index >= 0) {
      delete networkMaps[key][index];
    }
  }
}

addNetwork({
  name: 'livenet',
  alias: 'mainnet',
  pubkeyhash: 0x30,
  privatekey: 0xb0,
  scripthash: 0x32,
  bech32prefix: 'ltc',
  xpubkey: 0x019da462,
  xprivkey: 0x019d9cfe,
  networkMagic: 0xfbc0b6db,
  port: 9333,
  dnsSeeds: [
    'dnsseed.litecointools.com',
    'dnsseed.litecoinpool.org',
    'dnsseed.ltc.xurious.com',
    'dnsseed.koin-project.com',
    'seed-a.litecoin.loshan.co.uk',
    'dnsseed.thrasher.io'
  ]
});

/**
 * @instance
 * @member Networks#livenet
 */
var livenet = get('livenet');

addNetwork({
  name: 'testnet',
  alias: 'test',
  pubkeyhash: 0x6f,
  privatekey: 0xef,
  scripthash: 0x3a,
  bech32prefix: 'tltc',
  xpubkey: 0x0436f6e1,
  xprivkey: 0x0436ef7d,
  networkMagic: 0xfdd2c8f1,
  port: 19333,
  dnsSeeds: [
    'testnet-seed.litecointools.com',
    'seed-b.litecoin.loshan.co.uk'
  ]
});

/**
 * @instance
 * @member Networks#testnet
 */
var testnet = get('testnet');

addNetwork({
  name: 'testnet',
  alias: 'test',
  pubkeyhash: 0x6f,
  privatekey: 0xef,
  scripthash: 0x3a,
  bech32prefix: 'tltc',
  xpubkey: 0x0436f6e1,
  xprivkey: 0x0436ef7d,
  networkMagic: 0xfabfb5da,
  port: 19444,
  dnsSeeds: [
    'testnet-seed.litecointools.com',
    'seed-b.litecoin.loshan.co.uk'
  ]
});

/**
 * @instance
 * @member Networks#testnet
 */
var regtest = get('regtest');

/**
 * @function
 * @deprecated
 * @member Networks#enableRegtest
 * Will enable regtest features for testnet
 */
function enableRegtest() {
  testnet.regtestEnabled = true;
}

/**
 * @function
 * @deprecated
 * @member Networks#disableRegtest
 * Will disable regtest features for testnet
 */
function disableRegtest() {
  testnet.regtestEnabled = false;
}

/**
 * @namespace Networks
 */
module.exports = {
  add: addNetwork,
  remove: removeNetwork,
  defaultNetwork: livenet,
  livenet: livenet,
  mainnet: livenet,
  testnet: testnet,
  regtest: regtest,
  get: get,
  enableRegtest: enableRegtest,
  disableRegtest: disableRegtest
};
