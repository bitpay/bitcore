'use strict';

var base58check = require('./encoding/base58check');
var networks = require('./networks');
var Hash = require('./crypto/hash');

/**
 *
 * Bitcore Address
 *
 * Instantiate an address from an address String or Buffer, a public key or script hash Buffer,
 * or an instance of Pubkey or Script.
 *
 * @example
 *
 * var address = new Address(keypair.pubkey, 'testnet').toString();
 *
 * @param {String} data - The encoded data in various formats
 * @param {String} [network] - The network: 'mainnet' or 'testnet'
 * @param {String} [type] - The type of address: 'script' or 'pubkey'
 * @returns {Address} A new valid and frozen instance of an Address
 */
function Address(data, network, type) {

  if (!data) {
    throw Error('Please include address data');
  }

  if (network && (network !== 'mainnet' && network !== 'testnet')) {
    throw new Error('Network must be "mainnet" or "testnet"');
  }

  if (type && (type !== 'pubkeyhash' && type !== 'scripthash')) {
    throw new Error('Type must be "pubkeyhash" or "scripthash"');
  }

  var info;

  // transform and validate input data
  if (data instanceof Buffer && data.length === 20) {
    info = Address._transformHash(data);
  } else if (data instanceof Buffer && data.length === 21) {
    info = Address._transformBuffer(data, network, type);
  } else if (data.constructor && (data.constructor.name && data.constructor.name === 'Pubkey')) {
    info = Address._transformPubkey(data);
  } else if (data.constructor && (data.constructor.name && data.constructor.name === 'Script')) {
    info = Address._transformScript(data);
  } else if (typeof(data) === 'string') {
    info = Address._transformString(data, network, type);
  } else {
    throw new Error('Unrecognized data format');
  }

  // set defaults is not set
  info.network = info.network || network || 'mainnet';
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
 */
Address._transformHash = function(hash){
  var info = {};
  if (!hash instanceof Buffer) {
    throw new Error('Address supplied is not a buffer');
  }
  if (hash.length !== 20) {
    throw new Error('Address hashbuffers must be exactly a 20 bytes');
  }
  info.hashBuffer = hash;
  return info;
}

/**
 *
 * Internal function to transform a bitcoin address buffer
 *
 * @param {Buffer} buffer - An instance of a hex encoded address Buffer
 * @param {String} [network] - The network: 'mainnet' or 'testnet'
 * @param {String} [type] - The type: 'pubkeyhash' or 'scripthash'
 * @returns {Object} An object with keys: hashBuffer, network and type
 */
Address._transformBuffer = function(buffer, network, type){
  var info = {};
  if (!buffer instanceof Buffer) {
    throw new Error('Address supplied is not a buffer');
  }
  if (buffer.length !== 1 + 20) {
    throw new Error('Address buffers must be exactly 21 bytes');
  }

  var bufNetwork = false;
  var bufType = false;

  switch(buffer[0]){ // the version byte
  case networks.mainnet.pubkeyhash:
    bufNetwork = 'mainnet';
    bufType = 'pubkeyhash';
    break;

  case networks.mainnet.scripthash:
    bufNetwork = 'mainnet';
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
    throw new Error('Address has mismatched network type');
  }

  if (!bufType || ( type && type !== bufType )) {
    throw new Error('Address has mismatched type');
  }

  info.hashBuffer = buffer.slice(1);
  info.network = bufNetwork;
  info.type = bufType;
  return info;
}

/**
 *
 * Internal function to transform a Pubkey
 *
 * @param {Pubkey} pubkey - An instance of Pubkey
 * @returns {Object} An object with keys: hashBuffer, type
 */
Address._transformPubkey = function(pubkey){
  var info = {};
  if (!pubkey.constructor || (pubkey.constructor.name && pubkey.constructor.name !== 'Pubkey')) {
    throw new Error('Address must be an instance of Pubkey');
  }
  info.hashBuffer = Hash.sha256ripemd160(pubkey.toBuffer());
  info.type = 'pubkeyhash';
  return info;
}

/**
 *
 * Internal function to transform a Script
 *
 * @param {Script} script - An instance of Script
 * @returns {Object} An object with keys: hashBuffer, type
 */
Address._transformScript = function(script){
  var info = {};
  if (!script.constructor || (script.constructor.name && script.constructor.name !== 'Script')) {
    throw new Error('Address must be an instance of Script');
  }
  info.hashBuffer = Hash.sha256ripemd160(script.toBuffer());
  info.type = 'scripthash';
  return info;
}

/**
 *
 * Internal function to transform a bitcoin address string
 *
 * @param {String} data - An instance of Pubkey
 * @param {String} [network] - The network: 'mainnet' or 'testnet'
 * @param {String} [type] - The type: 'pubkeyhash' or 'scripthash'
 * @returns {Object} An object with keys: hashBuffer, network and type
 */
Address._transformString = function(data, network, type){
  if( typeof(data) !== 'string' ) {
    throw Error('Address supplied is not a string');
  }
  var addressBuffer = base58check.decode(data);
  var info = Address._transformBuffer(addressBuffer, network, type);
  return info;
}

/**
 *
 * Instantiate an address from a Pubkey instance
 *
 * @param {String} data - An instance of Pubkey
 * @param {String} network - The network: 'mainnet' or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromPubkey = function(data, network){
  var info = Address._transformPubkey(data);
  return new Address(info.hashBuffer, network, info.type);
};

/**
 *
 * Instantiate an address from a ripemd160 public key hash
 *
 * @param {Buffer} hash - An instance of buffer of the hash
 * @param {String} network - The network: 'mainnet' or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromPubkeyHash = function(hash, network) {
  var info = Address._transformHash(hash);
  return new Address(info.hashBuffer, network, 'pubkeyhash');
};

/**
 *
 * Instantiate an address from a ripemd160 script hash
 *
 * @param {Buffer} hash - An instance of buffer of the hash
 * @param {String} network - The network: 'mainnet' or 'testnet'
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
 * @param {String} network - The network: 'mainnet' or 'testnet'
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
 * @param {String} [network] - The network: 'mainnet' or 'testnet'
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
 * @param {String} [network] - The network: 'mainnet' or 'testnet'
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
 * @param {String} network - The network: 'mainnet' or 'testnet'
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
 * var valid = Address.isValid('15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2', 'mainnet');
 * // true
 *
 * @param {String} data - The encoded data
 * @param {String} network - The network: 'mainnet' or 'testnet'
 * @param {String} type - The type of address: 'script' or 'pubkey'
 * @returns {null|Error} The corresponding error message
 */
Address.isValid = function(data, network, type) {
  var error = Address.getValidationError(data, network, type);
  if (error) {
    return false;
  } else {
    return true;
  }
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

module.exports = Address;
