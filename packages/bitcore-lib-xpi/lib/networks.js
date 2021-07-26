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
function Network() { }

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
    for (var i = 0; i < networks.length; i++) {
      var network = networks[i];
      var filteredNet = _.pick(network, keys);
      var netValues = _.values(filteredNet);
      if (~netValues.indexOf(arg)) {
        return network;
      }
    }
    return undefined;
  }
  return networkMaps[arg];
}

/***
 * Derives an array from the given prefix to be used in the computation
 * of the address' checksum.
 *
 * @param {string} prefix Network prefix. E.g.: 'bitcoincash'.
 */
function prefixToArray(prefix) {
  var result = [];
  for (var i = 0; i < prefix.length; i++) {
    result.push(prefix.charCodeAt(i) & 31);
  }
  return result;
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

  JSUtil.defineImmutable(network, {
    name: data.name,
    alias: data.alias,
    pubkeyhash: data.pubkeyhash,
    privatekey: data.privatekey,
    scripthash: data.scripthash,
    xpubkey: data.xpubkey,
    xprivkey: data.xprivkey,
  });

  var indexBy = data.indexBy || Object.keys(data);

  if (data.prefix) {
    _.extend(network, {
      prefix: data.prefix,
      prefixArray: prefixToArray(data.prefix),
    });
  }

  if (data.networkbyte) {
    _.extend(network, {
      networkbyte: data.networkbyte
    });
  }

  if (data.networkMagic) {
    _.extend(network, {
      networkMagic: BufferUtil.integerAsBuffer(data.networkMagic)
    });
  }

  if (data.port) {
    _.extend(network, {
      port: data.port
    });
  }

  if (data.dnsSeeds) {
    _.extend(network, {
      dnsSeeds: data.dnsSeeds
    });
  }
  networks.push(network);
  indexNetworkBy(network, indexBy);
  return network;
}

function indexNetworkBy(network, keys) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var networkValue = network[key];
    if (!_.isUndefined(networkValue) && !_.isObject(networkValue)) {
      networkMaps[networkValue] = network;
    }
  }
}

function unindexNetworkBy(network, values) {
  for (var index = 0; index < values.length; index++) {
    var value = values[index];
    if (networkMaps[value] === network) {
      delete networkMaps[value];
    }
  }
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
  unindexNetworkBy(network, Object.keys(networkMaps));
}

// from https://github.com/Bitcoin-ABC/bitcoin-abc/blob/master/src/chainparams.cpp#L212
var dnsSeeds = [
  'mainnet.seeds.cash',
  'seed.be.cash'
];

var liveNetwork = {
  name: 'livenet',
  alias: 'mainnet',
  prefix: 'bitcoincash',
  networkbyte: '_',
  pubkeyhash: 0,
  privatekey: 0x80,
  scripthash: 5,
  xpubkey: 0x0488b21e,
  xprivkey: 0x0488ade4,
  networkMagic: 0xece7eff3,
  port: 10605,
  dnsSeeds: dnsSeeds
};

var testNetwork = {
  name: 'testnet',
  prefix: 'bchtest',
  networkbyte: 'T',
  pubkeyhash: 0x6f,
  privatekey: 0xef,
  scripthash: 0xc4,
  xpubkey: 0x043587cf,
  xprivkey: 0x04358394,
  networkMagic: 0xecf4f3f4,
  port: 11605,
  dnsSeeds: dnsSeeds
};

var regtestNetwork = {
  name: 'regtest',
  prefix: 'bchreg',
  networkbyte: 'R',
  pubkeyhash: 0x6f,
  privatekey: 0xef,
  scripthash: 0xc4,
  xpubkey: 0x043587cf,
  xprivkey: 0x04358394,
  networkMagic: 0xecf2e5e7,
  port: 12605,
  dnsSeeds: [],
  indexBy: [
    'port',
    'name',
    'prefix',
    'networkMagic'
  ]
};


// Add configurable values for testnet/regtest


addNetwork(testNetwork);
addNetwork(regtestNetwork);
addNetwork(liveNetwork);

var livenet = get('livenet');
var regtest = get('regtest');
var testnet = get('testnet');

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
