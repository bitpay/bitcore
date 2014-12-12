'use strict';

var base58check = require('./encoding/base58check');
var Networks = require('./networks');
var Hash = require('./crypto/hash');
var JSUtil = require('./util/js');

/**
 * Instantiate an address from an address String or Buffer, a public key or script hash Buffer,
 * or an instance of PublicKey or Script.
 *
 * @example
 *
 * // validate that an input field is valid
 * var error = Address.getValidationError(input, 'testnet');
 * if (!error) {
 *   var address = Address(input, 'testnet');
 * } else {
 *   // invalid network or checksum (typo?)
 *   var message = error.messsage;
 * }
 *
 * // get an address from a public key
 * var address = Address(publicKey, 'testnet').toString();
 *
 *
 * @param {String} data - The encoded data in various formats
 * @param {String} [network] - The network: 'livenet' or 'testnet'
 * @param {String} [type] - The type of address: 'script' or 'pubkey'
 * @returns {Address} A new valid and frozen instance of an Address
 * @constructor
 */
function Address(data, network, type) {

  if (!(this instanceof Address)) {
    return new Address(data, network, type);
  }

  if (!data) {
    throw new TypeError('First argument is required, please include address data.');
  }

  if (network && !Networks.get(network)) {
    throw new TypeError('Second argument must be "livenet" or "testnet".');
  }

  if (type && (type !== Address.PayToPublicKeyHash && type !== Address.PayToScriptHash)) {
    throw new TypeError('Third argument must be "pubkeyhash" or "scripthash".');
  }

  var info;

  // transform and validate input data
  if ((data instanceof Buffer || data instanceof Uint8Array) && data.length === 20) {
    info = Address._transformHash(data);
  } else if ((data instanceof Buffer || data instanceof Uint8Array) && data.length === 21) {
    info = Address._transformBuffer(data, network, type);
  } else if (data.constructor && (data.constructor.name && data.constructor.name === 'PublicKey')) {
    info = Address._transformPublicKey(data);
  } else if (data.constructor && (data.constructor.name && data.constructor.name === 'Script')) {
    info = Address._transformScript(data);
  } else if (data instanceof Address) {
    return data;
  } else if (typeof(data) === 'string') {
    info = Address._transformString(data, network, type);
  } else {
    throw new TypeError('First argument is an unrecognized data format.');
  }

  // set defaults if not set
  info.network = info.network || Networks.get(network) || Networks.defaultNetwork;
  info.type = info.type || type || Address.PayToPublicKeyHash;

  Object.defineProperty(this, 'hashBuffer', {
    configurable: false,
    value: info.hashBuffer
  });

  Object.defineProperty(this, 'network', {
    configurable: false,
    value: info.network
  });

  Object.defineProperty(this, 'type', {
    configurable: false,
    value: info.type
  });

  return this;
}

Address.PayToPublicKeyHash = 'pubkeyhash';
Address.PayToScriptHash = 'scripthash';

/**
 * Internal function to transform a hash buffer
 *
 * @param {Buffer} hash - An instance of a hash Buffer
 * @returns {Object} An object with keys: hashBuffer
 * @private
 */
Address._transformHash = function(hash){
  var info = {};
  if (!(hash instanceof Buffer) && !(hash instanceof Uint8Array)) {
    throw new TypeError('Address supplied is not a buffer.');
  }
  if (hash.length !== 20) {
    throw new TypeError('Address hashbuffers must be exactly 20 bytes.');
  }
  info.hashBuffer = hash;
  return info;
};

/**
 * Internal function to discover the network and type
 *
 * @param {Buffer} buffer - An instance of a hex encoded address Buffer
 * @returns {Object} An object with keys: network and type
 * @private
 */
Address._classifyFromVersion = function(buffer){
  var version = {};
  switch(buffer[0]){ // the version byte
    case Networks.livenet.pubkeyhash:
      version.network = Networks.livenet;
      version.type = Address.PayToPublicKeyHash;
      break;

    case Networks.livenet.scripthash:
      version.network = Networks.livenet;
      version.type = Address.PayToScriptHash;
      break;

    case Networks.testnet.pubkeyhash:
      version.network = Networks.testnet;
      version.type = Address.PayToPublicKeyHash;
      break;

    case Networks.testnet.scripthash:
      version.network = Networks.testnet;
      version.type = Address.PayToScriptHash;
      break;
  }
  return version;
};

/**
 * Internal function to transform a bitcoin address buffer
 *
 * @param {Buffer} buffer - An instance of a hex encoded address Buffer
 * @param {String} [network] - The network: 'livenet' or 'testnet'
 * @param {String} [type] - The type: 'pubkeyhash' or 'scripthash'
 * @returns {Object} An object with keys: hashBuffer, network and type
 * @private
 */
Address._transformBuffer = function(buffer, network, type){
  var info = {};
  if (!(buffer instanceof Buffer) && !(buffer instanceof Uint8Array)) {
    throw new TypeError('Address supplied is not a buffer.');
  }
  if (buffer.length !== 1 + 20) {
    throw new TypeError('Address buffers must be exactly 21 bytes.');
  }

  network = Networks.get(network);
  var bufferVersion = Address._classifyFromVersion(buffer);

  if (!bufferVersion.network || (network && network !== bufferVersion.network)) {
    throw new TypeError('Address has mismatched network type.');
  }

  if (!bufferVersion.type || ( type && type !== bufferVersion.type )) {
    throw new TypeError('Address has mismatched type.');
  }

  info.hashBuffer = buffer.slice(1);
  info.network = bufferVersion.network;
  info.type = bufferVersion.type;
  return info;
};

/**
 * Internal function to transform a PublicKey
 *
 * @param {PublicKey} pubkey - An instance of PublicKey
 * @returns {Object} An object with keys: hashBuffer, type
 * @private
 */
Address._transformPublicKey = function(pubkey){
  var info = {};
  if (!pubkey.constructor || (pubkey.constructor.name && pubkey.constructor.name !== 'PublicKey')) {
    throw new TypeError('Address must be an instance of PublicKey.');
  }
  info.hashBuffer = Hash.sha256ripemd160(pubkey.toBuffer());
  info.type = Address.PayToPublicKeyHash;
  return info;
};

/**
 * Internal function to transform a Script
 *
 * @param {Script} script - An instance of Script
 * @returns {Object} An object with keys: hashBuffer, type
 * @private
 */
Address._transformScript = function(script){
  var info = {};
  if (!script.constructor || (script.constructor.name && script.constructor.name !== 'Script')) {
    throw new TypeError('Address must be an instance of Script.');
  }
  info.hashBuffer = Hash.sha256ripemd160(script.toBuffer());
  info.type = Address.PayToScriptHash;
  return info;
};

/**
 * Internal function to transform a bitcoin address string
 *
 * @param {String} data - An instance of PublicKey
 * @param {String} [network] - The network: 'livenet' or 'testnet'
 * @param {String} [type] - The type: 'pubkeyhash' or 'scripthash'
 * @returns {Object} An object with keys: hashBuffer, network and type
 * @private
 */
Address._transformString = function(data, network, type){
  if( typeof(data) !== 'string' ) {
    throw new TypeError('Address supplied is not a string.');
  }
  var addressBuffer = base58check.decode(data);
  var info = Address._transformBuffer(addressBuffer, network, type);
  return info;
};

/**
 * Instantiate an address from a PublicKey instance
 *
 * @param {PublicKey} data - An instance of PublicKey
 * @param {String} network - The network: 'livenet' or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromPublicKey = function(data, network){
  var info = Address._transformPublicKey(data);
  network = network || Networks.defaultNetwork;
  return new Address(info.hashBuffer, network, info.type);
};

/**
 * Instantiate an address from a ripemd160 public key hash
 *
 * @param {Buffer} hash - An instance of buffer of the hash
 * @param {String} network - The network: 'livenet' or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromPublicKeyHash = function(hash, network) {
  var info = Address._transformHash(hash);
  return new Address(info.hashBuffer, network, Address.PayToPublicKeyHash);
};

/**
 * Instantiate an address from a ripemd160 script hash
 *
 * @param {Buffer} hash - An instance of buffer of the hash
 * @param {String} network - The network: 'livenet' or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromScriptHash = function(hash, network) {
  var info = Address._transformHash(hash);
  return new Address(info.hashBuffer, network, Address.PayToScriptHash);
};

/**
 * Instantiate an address from a Script
 *
 * @param {Script} script - An instance of Script
 * @param {String} network - The network: 'livenet' or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromScript = function(script, network) {
  var info = Address._transformScript(script);
  return new Address(info.hashBuffer, network, info.type);
};

/**
 * Instantiate an address from a buffer of the address
 *
 * @param {Buffer} buffer - An instance of buffer of the address
 * @param {String} [network] - The network: 'livenet' or 'testnet'
 * @param {String} [type] - The type of address: 'script' or 'pubkey'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromBuffer = function(buffer, network, type) {
  var info = Address._transformBuffer(buffer, network, type);
  return new Address(info.hashBuffer, info.network, info.type);
};

/**
 * Instantiate an address from an address string
 *
 * @param {String} str - An string of the bitcoin address
 * @param {String} [network] - The network: 'livenet' or 'testnet'
 * @param {String} [type] - The type of address: 'script' or 'pubkey'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromString = function(str, network, type) {
  var info = Address._transformString(str, network, type);
  return new Address(info.hashBuffer, info.network, info.type);
};

/**
 * Instantiate an address from JSON
 *
 * @param {String} json - An JSON string or Object with keys: hash, network and type
 * @returns {Address} A new valid instance of an Address
 */
Address.fromJSON = function fromJSON(json) {
  if (JSUtil.isValidJson(json)) {
    json = JSON.parse(json);
  }
  var hashBuffer = new Buffer(json.hash, 'hex');
  return new Address(hashBuffer, json.network, json.type);
};

/**
 * Will return a validation error if exists
 *
 * @example
 *
 * var error = Address.getValidationError('15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2', 'testnet');
 * // a network mismatch error
 *
 * @param {String} data - The encoded data
 * @param {String} network - The network: 'livenet' or 'testnet'
 * @param {String} type - The type of address: 'script' or 'pubkey'
 * @returns {null|Error} The corresponding error message
 */
Address.getValidationError = function(data, network, type) {
  var error;
  try {
    new Address(data, network, type);
  } catch (e) {
    error = e;
  }
  return error;
};

/**
 * Will return a boolean if an address is valid
 *
 * @example
 *
 * var valid = Address.isValid('15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2', 'livenet');
 * // true
 *
 * @param {String} data - The encoded data
 * @param {String} network - The network: 'livenet' or 'testnet'
 * @param {String} type - The type of address: 'script' or 'pubkey'
 * @returns {boolean} The corresponding error message
 */
Address.isValid = function(data, network, type) {
  return !Address.getValidationError(data, network, type);
};

/**
 * Returns true if an address is of pay to public key hash type
 * @return boolean
 */
Address.prototype.isPayToPublicKeyHash = function() {
  return this.type === Address.PayToPublicKeyHash;
};

/**
 * Returns true if an address is of pay to script hash type
 * @return boolean
 */
Address.prototype.isPayToScriptHash = function() {
  return this.type === Address.PayToScriptHash;
};

/**
 * Will return a buffer representation of the address
 *
 * @returns {Buffer} Bitcoin address buffer
 */
Address.prototype.toBuffer = function() {
  var version = new Buffer([this.network[this.type]]);
  var buf = Buffer.concat([version, this.hashBuffer]);
  return buf;
};

/**
 * @returns {Object} An object of the address
 */
Address.prototype.toJSON = function toJSON() {
  return {
    hash: this.hashBuffer.toString('hex'),
    type: this.type,
    network: this.network.toString()
  };
};

/**
 * Will return a the string representation of the address
 *
 * @returns {String} Bitcoin address
 */
Address.prototype.toString = function() {
  return base58check.encode(this.toBuffer());
};

/**
 * Will return a string formatted for the console
 *
 * @returns {String} Bitcoin address
 */
Address.prototype.inspect = function() {
  return '<Address: ' + this.toString() + ', type: '+this.type+', network: '+this.network+'>';
};

module.exports = Address;
