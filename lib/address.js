'use strict';

var base58check = require('./encoding/base58check');
var networks = require('./networks');
var Hash = require('./crypto/hash');

/**
 *
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

  if (network && (network !== 'livenet' && network !== 'testnet')) {
    throw new TypeError('Second argument must be "livenet" or "testnet".');
  }

  if (type && (type !== 'pubkeyhash' && type !== 'scripthash')) {
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
  } else if (typeof(data) === 'string') {
    info = Address._transformString(data, network, type);
  } else {
    throw new TypeError('First argument is an unrecognized data format.');
  }

  // set defaults if not set
  info.network = info.network || network || 'livenet';
  info.type = info.type || type || 'pubkeyhash';

  // set the validated values
  this.hashBuffer = info.hashBuffer;
  this.network = info.network;
  this.type = info.type;

  return this;

}

/**
 *
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
 *
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

  var bufNetwork = false;
  var bufType = false;

  switch(buffer[0]){ // the version byte
    case networks.livenet.pubkeyhash:
      bufNetwork = 'livenet';
      bufType = 'pubkeyhash';
      break;

    case networks.livenet.scripthash:
      bufNetwork = 'livenet';
      bufType = 'scripthash';
      break;
    
    case networks.testnet.pubkeyhash:
      bufNetwork = 'testnet';
      bufType = 'pubkeyhash';
      break;

    case networks.testnet.scripthash:
      bufNetwork = 'testnet';
      bufType = 'scripthash';
      break;
  }
  
  if (!bufNetwork || (network && network !== bufNetwork)) {
    throw new TypeError('Address has mismatched network type.');
  }

  if (!bufType || ( type && type !== bufType )) {
    throw new TypeError('Address has mismatched type.');
  }

  info.hashBuffer = buffer.slice(1);
  info.network = bufNetwork;
  info.type = bufType;
  return info;
};

/**
 *
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
  info.type = 'pubkeyhash';
  return info;
};

/**
 *
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
  info.type = 'scripthash';
  return info;
};

/**
 *
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
 *
 * Instantiate an address from a PublicKey instance
 *
 * @param {String} data - An instance of PublicKey
 * @param {String} network - The network: 'livenet' or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromPublicKey = function(data, network){
  var info = Address._transformPublicKey(data);
  return new Address(info.hashBuffer, network, info.type);
};

/**
 *
 * Instantiate an address from a ripemd160 public key hash
 *
 * @param {Buffer} hash - An instance of buffer of the hash
 * @param {String} network - The network: 'livenet' or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromPublicKeyHash = function(hash, network) {
  var info = Address._transformHash(hash);
  return new Address(info.hashBuffer, network, 'pubkeyhash');
};

/**
 *
 * Instantiate an address from a ripemd160 script hash
 *
 * @param {Buffer} hash - An instance of buffer of the hash
 * @param {String} network - The network: 'livenet' or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromScriptHash = function(hash, network) {
  var info = Address._transformHash(hash);
  return new Address(info.hashBuffer, network, 'scripthash');
};

/**
 *
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
 *
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
 *
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
 *
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
 *
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
 * @returns {null|Error} The corresponding error message
 */
Address.isValid = function(data, network, type) {
  return !Address.getValidationError(data, network, type);
};

/**
 *
 * Will return a buffer representation of the address
 *
 * @returns {Buffer} Bitcoin address buffer
 */
Address.prototype.toBuffer = function() {
  var version = new Buffer([networks[this.network][this.type]]);
  var buf = Buffer.concat([version, this.hashBuffer]);
  return buf;
};

/**
 *
 * Will return a the string representation of the address
 *
 * @returns {String} Bitcoin address
 */
Address.prototype.toString = function() {
  return base58check.encode(this.toBuffer());
};

/**
 *
 * Will return a string formatted for the console
 *
 * @returns {String} Bitcoin address
 */
Address.prototype.inspect = function() {
  return '<Address: ' + this.toString() + ', type: '+this.type+', network: '+this.network+'>';
};

module.exports = Address;
