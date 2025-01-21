'use strict';
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
    if (!Array.isArray(keys)) {
      keys = [keys];
    }
    for (const index in networks) {
      if (keys.some(key => networks[index][key] === arg)) {
        return networks[index];
      }
    }
    return undefined;
  }
  if (networkMaps[arg] && networkMaps[arg].length >= 1) {
    return networkMaps[arg][0];
  } else {
    return networkMaps[arg];
  }
}

/**
 * @function
 * @member Networks#is
 * Returns true if the string is the network name or alias
 * @param {string} str - A string to check
 * @return boolean
 */
function is(str) {
  return this.name == str || this.alias == str;
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
 * @param {Array}  data.variants - An array of variants
 * @param {string} data.variants.name - The name of the variant
 * @param {Number} data.variants.networkMagic - The network magic number
 * @param {Number} data.variants.port - The network port
 * @param {Array}  data.variants.dnsSeeds - An array of dns seeds
 * @return Network
 */
function addNetwork(data) {
  var network = new Network();

  JSUtil.defineImmutable(network, {
    name: data.name,
    alias: data.alias,
    is: data.is,
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

  for (const value of Object.values(network)) {
    if (value != null && typeof value !== 'object') {
      if (!networkMaps[value]) {
        networkMaps[value] = [];
      }
      networkMaps[value].push(network);
    }
  };

  networks.push(network);

  for (const variant of data.variants || []) {
    addNetwork({
      ...data,
      variants: undefined,
      ...variant,
    });
  }

  return network;
}

/**
 * @function
 * @member Networks#remove
 * Will remove a custom network
 * @param {Network} network
 */
function removeNetwork(network) {
  if (typeof network !== 'object') {
    network = get(network);
  }
  for (var i = 0; i < networks.length; i++) {
    if (networks[i] === network) {
      networks.splice(i, 1);
    }
  }
  for (var key in networkMaps) {
    if (networkMaps[key].length) {
      const index = networkMaps[key].indexOf(network);
      if (index >= 0) {
        networkMaps[key].splice(index, 1);
      }
      if (networkMaps[key].length === 0) {
        delete networkMaps[key];
      }
    } else if (networkMaps[key] === network) {
      delete networkMaps[key];
    }
  }
}

addNetwork({
  name: 'livenet',
  alias: 'mainnet',
  is,
  pubkeyhash: 0x00,
  privatekey: 0x80,
  scripthash: 0x05,
  bech32prefix: 'bc',
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
  ]
});

/**
 * @instance
 * @member Networks#livenet
 */
var livenet = get('livenet');

addNetwork({
  name: 'testnet',
  alias: 'testnet',
  is,
  pubkeyhash: 0x6f,
  privatekey: 0xef,
  scripthash: 0xc4,
  bech32prefix: 'tb',
  xpubkey: 0x043587cf,
  xprivkey: 0x04358394,
  variants: [{
    name: 'testnet3',
    networkMagic: 0x0b110907,
    port: 18333,
    dnsSeeds: [
      'testnet-seed.bitcoin.petertodd.org',
      'testnet-seed.bluematt.me',
      'testnet-seed.alexykot.me',
      'testnet-seed.bitcoin.schildbach.de'
    ]
  }, {
    name: 'signet',
    networkMagic: 0x0a03cf40,
    port: 38333,
    dnsSeeds: [
      '178.128.221.177',
      '103.16.128.63',
      '153.126.143.201',
      '192.241.163.142'
    ]
  }, {
    name: 'testnet4',
    networkMagic: 0x1c163f28,
    port: 48333,
    dnsSeeds: [
      '18.189.156.102',
      '18.201.207.55',
      '51.158.248.8',
      '57.128.176.163',
      '82.67.102.15',
      '88.99.248.50',
      '95.217.73.162',
      '103.99.171.212',
      '103.165.192.210',
    ]
  }]
});

/**
 * @instance
 * @member Networks#testnet
 */
var testnet = get('testnet');
var testnet3 = get('testnet3');
var signet = get('signet');

addNetwork({
  name: 'regtest',
  alias: 'dev',
  is,
  pubkeyhash: 0x6f,
  privatekey: 0xef,
  scripthash: 0xc4,
  bech32prefix: 'bcrt',
  xpubkey: 0x043587cf,
  xprivkey: 0x04358394,
  networkMagic: 0xfabfb5da,
  port: 18444,
  dnsSeeds: []
});

/**
 * @instance
 * @member Networks#regtest
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
  testnet3: testnet3,
  signet: signet,
  regtest: regtest,
  get: get,
  enableRegtest: enableRegtest,
  disableRegtest: disableRegtest
};
