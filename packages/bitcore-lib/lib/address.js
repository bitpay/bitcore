'use strict';

var _ = require('lodash');
var $ = require('./util/preconditions');
var errors = require('./errors');
var Base58Check = require('./encoding/base58check');
var Bech32 = require('./encoding/bech32');
var Networks = require('./networks');
var Hash = require('./crypto/hash');
var JSUtil = require('./util/js');
var PublicKey = require('./publickey');

/**
 * Instantiate an address from an address String or Buffer, a public key or script hash Buffer,
 * or an instance of {@link PublicKey} or {@link Script}.
 *
 * This is an immutable class, and if the first parameter provided to this constructor is an
 * `Address` instance, the same argument will be returned.
 *
 * An address has two key properties: `network` and `type`. The type is one of
 * `Address.PayToPublicKeyHash` (value is the `'pubkeyhash'` string),
 * `Address.PayToScriptHash` (the string `'scripthash'`),
 * `Address.PayToWitnessPublicKeyHash` (the string `'witnesspubkeyhash'`),
 * or `Address.PayToWitnessScriptHash` (the string `'witnessscripthash'`).
 * The network is an instance of {@link Network}.
 * You can quickly check whether an address is of a given kind by using the methods
 * `isPayToPublicKeyHash`, `isPayToScriptHash`, `isPayToWitnessPublicKeyHash`,
 * and `isPayToWitnessScriptHash`.
 *
 * @example
 * ```javascript
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
 * ```
 *
 * @param {*} data - The encoded data in various formats
 * @param {Network|String|number=} network - The network: 'livenet' or 'testnet'
 * @param {string=} type - The type of address: 'scripthash', 'pubkeyhash', witnessscripthash, 'witnesspubkeyhash', or 'taproot'
 * @param {string=} multisigType - The type of multisig: 'scripthash' or 'witnessscripthash'
 * @returns {Address} A new valid and frozen instance of an Address
 * @constructor
 */
function Address(data, network, type, multisigType) {
  /* jshint maxcomplexity: 12 */
  /* jshint maxstatements: 20 */

  if (!(this instanceof Address)) {
    return new Address(data, network, type);
  }

  if (_.isArray(data) && _.isNumber(network)) {
    return Address.createMultisig(data, network, type, false, multisigType);
  }

  if (data instanceof Address) {
    // Immutable instance
    return data;
  }

  $.checkArgument(data, 'First argument is required, please include address data.', 'guide/address.html');

  if (network && !Networks.get(network)) {
    throw new TypeError('Second argument must be "livenet" or "testnet".');
  }

  if (type && (
    type !== Address.PayToPublicKeyHash
    && type !== Address.PayToScriptHash
    && type !== Address.PayToWitnessPublicKeyHash
    && type !== Address.PayToWitnessScriptHash
    && type !== Address.PayToTaproot)) {
    throw new TypeError('Third argument must be "pubkeyhash", "scripthash", "witnesspubkeyhash", "witnessscripthash", or "taproot".');
  }

  var info = this._classifyArguments(data, network, type);

  // set defaults if not set
  info.network = info.network || Networks.get(network) || Networks.defaultNetwork;
  info.type = info.type || type || Address.PayToPublicKeyHash;

  JSUtil.defineImmutable(this, {
    hashBuffer: info.hashBuffer,
    network: info.network,
    type: info.type
  });

  return this;
}

/**
 * Internal function used to split different kinds of arguments of the constructor
 * @param {*} data - The encoded data in various formats
 * @param {Network|String|number=} network - The network: 'livenet' or 'testnet'
 * @param {string=} type - The type of address: 'script' or 'pubkey'
 * @returns {Object} An "info" object with "type", "network", and "hashBuffer"
 */
Address.prototype._classifyArguments = function(data, network, type) {
  /* jshint maxcomplexity: 10 */
  // transform and validate input data
  if ((data instanceof Buffer || data instanceof Uint8Array) && (data.length === 20 || data.length === 32)) {
    return Address._transformHash(data, network, type);
  } else if ((data instanceof Buffer || data instanceof Uint8Array) && data.length >= 21) {
    return Address._transformBuffer(data, network, type);
  } else if (data instanceof PublicKey) {
    return Address._transformPublicKey(data, network, type);
  } else if (data instanceof Script) {
    return Address._transformScript(data, network);
  } else if (typeof(data) === 'string') {
    return Address._transformString(data, network, type);
  } else if (_.isObject(data)) {
    return Address._transformObject(data);
  } else {
    throw new TypeError('First argument is an unrecognized data format.');
  }
};

/** @static */
Address.PayToPublicKeyHash = 'pubkeyhash';
/** @static */
Address.PayToScriptHash = 'scripthash';
/** @static */
Address.PayToWitnessPublicKeyHash = 'witnesspubkeyhash';
/** @static */
Address.PayToWitnessScriptHash = 'witnessscripthash';
/** @static */
Address.PayToTaproot = 'taproot';

/**
 * @param {Buffer} hash - An instance of a hash Buffer
 * @param {string} type - either 'pubkeyhash', 'scripthash', 'witnesspubkeyhash', or 'witnessscripthash'
 * @param {Network=} network - the name of the network associated
 * @returns {Object} An object with keys: hashBuffer
 * @private
 */
Address._transformHash = function(hash, network, type) {
  var info = {};
  if (!(hash instanceof Buffer) && !(hash instanceof Uint8Array)) {
    throw new TypeError('Address supplied is not a buffer.');
  }
  if (hash.length !== 20 && hash.length !== 32) {
    throw new TypeError('Address hashbuffers must be either 20 or 32 bytes.');
  }
  info.hashBuffer = hash;
  info.network = Networks.get(network) || Networks.defaultNetwork;
  info.type = type;
  return info;
};

/**
 * Deserializes an address serialized through `Address#toObject()`
 * @param {Object} data
 * @param {string} data.hash - the hash that this address encodes
 * @param {string} data.type - either 'pubkeyhash', 'scripthash', 'witnesspubkeyhash', or 'witnessscripthash'
 * @param {Network=} data.network - the name of the network associated
 * @return {Address}
 */
Address._transformObject = function(data) {
  $.checkArgument(data.hash || data.hashBuffer, 'Must provide a `hash` or `hashBuffer` property');
  $.checkArgument(data.type, 'Must provide a `type` property');
  return {
    hashBuffer: data.hash ? Buffer.from(data.hash, 'hex') : data.hashBuffer,
    network: Networks.get(data.network) || Networks.defaultNetwork,
    type: data.type
  };
};

/**
 * Internal function to discover the network and type based on the first data byte
 *
 * @param {Buffer} buffer - An instance of a hex encoded address Buffer
 * @returns {Object} An object with keys: network and type
 * @private
 */
Address._classifyFromVersion = function(buffer) {
  var version = {};

  if (buffer.length > 21) {
    var info = Bech32.decode(buffer.toString('utf8'));
    if (info.version !== 0 && info.version !== 1) { // v1 == taproot
      throw new TypeError('Only witness v0 and v1 addresses are supported.');
    }

    if (info.version === 0) {
      if (info.data.length === 20) {
        version.type = Address.PayToWitnessPublicKeyHash;
      } else if (info.data.length === 32) {
        version.type = Address.PayToWitnessScriptHash;
      } else {
        throw new TypeError('Witness data must be either 20 or 32 bytes.')
      }
    } else if (info.version === 1) {
      if (info.data.length === 32) {
        version.type = Address.PayToTaproot;
      } else {
        throw new TypeError('Witness data must be 32 bytes for v1');
      }
    } else {
    }
    version.network = Networks.get(info.prefix, 'bech32prefix');
  } else {

    var pubkeyhashNetwork = Networks.get(buffer[0], 'pubkeyhash');
    var scripthashNetwork = Networks.get(buffer[0], 'scripthash');

    if (pubkeyhashNetwork) {
      version.network = pubkeyhashNetwork;
      version.type = Address.PayToPublicKeyHash;
    } else if (scripthashNetwork) {
      version.network = scripthashNetwork;
      version.type = Address.PayToScriptHash;
    }
  }

  return version;
};

/**
 * Internal function to transform a bitcoin address buffer
 *
 * @param {Buffer} buffer - An instance of a hex encoded address Buffer
 * @param {string=} network - The network: 'livenet' or 'testnet'
 * @param {string=} type - The type: 'pubkeyhash', 'scripthash', 'witnesspubkeyhash', or 'witnessscripthash'
 * @returns {Object} An object with keys: hashBuffer, network and type
 * @private
 */
Address._transformBuffer = function(buffer, network, type) {
  /* jshint maxcomplexity: 9 */
  var info = {};
  if (!(buffer instanceof Buffer) && !(buffer instanceof Uint8Array)) {
    throw new TypeError('Address supplied is not a buffer.');
  }

  if (buffer.length < 21) {
    throw new TypeError('Address buffer is incorrect length.');
  }

  var networkObj = Networks.get(network);
  var bufferVersion = Address._classifyFromVersion(buffer);

  if (network && !networkObj) {
    throw new TypeError('Unknown network');
  }

  if (!bufferVersion.network || (networkObj && networkObj.xpubkey !== bufferVersion.network.xpubkey)) {
    throw new TypeError('Address has mismatched network type.');
  }

  if (!bufferVersion.type || (type && type !== bufferVersion.type)) {
    throw new TypeError('Address has mismatched type.');
  }

  if (buffer.length > 21) {
    info.hashBuffer = Bech32.decode(buffer.toString('utf8')).data;
  } else {
    info.hashBuffer = buffer.slice(1);
  }
  info.network = bufferVersion.network;
  info.type = bufferVersion.type;
  return info;
};

/**
 * Internal function to transform a {@link PublicKey}
 *
 * @param {PublicKey} pubkey - An instance of PublicKey
 * @param {string} type - Either 'pubkeyhash', 'witnesspubkeyhash', 'scripthash', or 'taproot'
 * @returns {Object} An object with keys: hashBuffer, type
 * @private
 */
Address._transformPublicKey = function(pubkey, network, type) {
  var info = {};
  if (!(pubkey instanceof PublicKey)) {
    throw new TypeError('Address must be an instance of PublicKey.');
  }
  if (type && type !== Address.PayToScriptHash && type !== Address.PayToWitnessPublicKeyHash && type !== Address.PayToPublicKeyHash && type !== Address.PayToTaproot) {
    throw new TypeError('Type must be either pubkeyhash, witnesspubkeyhash, scripthash, or taproot to transform public key.');
  }
  if (!pubkey.compressed && (type === Address.PayToScriptHash || type === Address.PayToWitnessPublicKeyHash)) {
    throw new TypeError('Witness addresses must use compressed public keys.');
  }
  if (type === Address.PayToScriptHash) {
    info.hashBuffer = Hash.sha256ripemd160(Script.buildWitnessV0Out(pubkey).toBuffer());
  } else if (type === Address.PayToTaproot) {
    info.hashBuffer = Hash.sha256ripemd160(Script.buildWitnessV1Out(pubkey).toBuffer());
  } else {
    info.hashBuffer = Hash.sha256ripemd160(pubkey.toBuffer());
  }
  info.type = type || Address.PayToPublicKeyHash;
  return info;
};

/**
 * Internal function to transform a {@link Script} into a `info` object.
 *
 * @param {Script} script - An instance of Script
 * @returns {Object} An object with keys: hashBuffer, type
 * @private
 */
Address._transformScript = function(script, network) {
  $.checkArgument(script instanceof Script, 'script must be a Script instance');
  var info = script.getAddressInfo(network);
  if (!info) {
    throw new errors.Script.CantDeriveAddress(script);
  }
  return info;
};

/**
 * Creates a P2SH address from a set of public keys and a threshold.
 *
 * The addresses will be sorted lexicographically, as that is the trend in bitcoin.
 * To create an address from unsorted public keys, use the {@link Script#buildMultisigOut}
 * interface.
 *
 * @param {Array} publicKeys - a set of public keys to create an address
 * @param {number} threshold - the number of signatures needed to release the funds
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
 * @param {boolean=} nestedWitness - if the address uses a nested p2sh witness
 * @param {string} type - Either 'scripthash' or 'witnessscripthash'. If nestedWitness is set, then this is ignored
 * @return {Address}
 */
Address.createMultisig = function(publicKeys, threshold, network, nestedWitness, type) {
  network = network || publicKeys[0].network || Networks.defaultNetwork;
  if (type && type !== Address.PayToScriptHash && type !== Address.PayToWitnessScriptHash) {
    throw new TypeError('Type must be either scripthash or witnessscripthash to create multisig.');
  }
  if (nestedWitness || type === Address.PayToWitnessScriptHash) {
    publicKeys = _.map(publicKeys, PublicKey);
    for (var i = 0; i < publicKeys.length; i++) {
      if (!publicKeys[i].compressed) {
        throw new TypeError('Witness addresses must use compressed public keys.');
      }
    }
  }
  var redeemScript = Script.buildMultisigOut(publicKeys, threshold);
  if (nestedWitness) {
    return Address.payingTo(Script.buildWitnessMultisigOutFromScript(redeemScript), network);
  }
  return Address.payingTo(redeemScript, network, type);
};

/**
 * Internal function to transform a bitcoin address string
 *
 * @param {string} data
 * @param {String|Network=} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string=} type - The type: 'pubkeyhash', 'scripthash', 'witnesspubkeyhash', or 'witnessscripthash'
 * @returns {Object} An object with keys: hashBuffer, network and type
 * @private
 */
Address._transformString = function(data, network, type) {
  if (typeof(data) !== 'string') {
    throw new TypeError('data parameter supplied is not a string.');
  }

  if(data.length > 100) {
    throw new TypeError('address string is too long');
  }

  if (network && !Networks.get(network)) {
    throw new TypeError('Unknown network');
  }

  data = data.trim();

  try {
    var info = Address._transformBuffer(Buffer.from(data, 'utf8'), network, type);
    return info;
  } catch (e) {
    if (type === Address.PayToWitnessPublicKeyHash || type === Address.PayToWitnessScriptHash || type === Address.PayToTaproot) {
      throw e;
    }
  }

  var addressBuffer = Base58Check.decode(data);
  var info = Address._transformBuffer(addressBuffer, network, type);
  return info;
};

/**
 * Instantiate an address from a PublicKey instance
 *
 * @param {PublicKey} data
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string} type - Either 'pubkeyhash', 'witnesspubkeyhash', or 'scripthash'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromPublicKey = function(data, network, type) {
  var info = Address._transformPublicKey(data, network, type);
  network = network || Networks.defaultNetwork;
  return new Address(info.hashBuffer, network, info.type);
};

/**
 * Instantiate an address from a ripemd160 public key hash
 *
 * @param {Buffer} hash - An instance of buffer of the hash
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
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
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string} type - Either 'scripthash' or 'witnessscripthash'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromScriptHash = function(hash, network, type) {
  $.checkArgument(hash, 'hash parameter is required');
  var info = Address._transformHash(hash);
  if (type === Address.PayToWitnessScriptHash && hash.length !== 32) {
      throw new TypeError('Address hashbuffer must be exactly 32 bytes for v0 witness script hash.');
  }
  var type = type || Address.PayToScriptHash;
  return new Address(info.hashBuffer, network, type);
};

/**
 * Builds a p2sh address paying to script. This will hash the script and
 * use that to create the address.
 * If you want to extract an address associated with a script instead,
 * see {{Address#fromScript}}
 *
 * @param {Script} script - An instance of Script
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string} type - Either 'scripthash' or 'witnessscripthash'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.payingTo = function(script, network, type) {
  $.checkArgument(script, 'script is required');
  $.checkArgument(script instanceof Script, 'script must be instance of Script');
  var hash;
  if (type === Address.PayToWitnessScriptHash) {
    hash = Hash.sha256(script.toBuffer());
  } else {
    hash = Hash.sha256ripemd160(script.toBuffer());
  }
  var type = type || Address.PayToScriptHash;
  return Address.fromScriptHash(hash, network, type);
};

/**
 * Extract address from a Script. The script must be of one
 * of the following types: p2pkh input, p2pkh output, p2sh input
 * or p2sh output.
 * This will analyze the script and extract address information from it.
 * If you want to transform any script to a p2sh Address paying
 * to that script's hash instead, use {{Address#payingTo}}
 *
 * @param {Script} script - An instance of Script
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromScript = function(script, network) {
  $.checkArgument(script instanceof Script, 'script must be a Script instance');
  var info = Address._transformScript(script, network);
  return new Address(info.hashBuffer, network, info.type);
};

/**
 * Instantiate an address from a buffer of the address
 *
 * @param {Buffer} buffer - An instance of buffer of the address
 * @param {String|Network=} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string=} type - The type of address: 'script' or 'pubkey'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromBuffer = function(buffer, network, type) {
  var info = Address._transformBuffer(buffer, network, type);
  return new Address(info.hashBuffer, info.network, info.type);
};

/**
 * Instantiate an address from an address string
 *
 * @param {string} str - An string of the bitcoin address
 * @param {String|Network=} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string=} type - The type of address: 'script' or 'pubkey'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromString = function(str, network, type) {
  var info = Address._transformString(str, network, type);
  return new Address(info.hashBuffer, info.network, info.type);
};

/**
 * Instantiate an address from an Object
 *
 * @param {string} json - An JSON string or Object with keys: hash, network and type
 * @returns {Address} A new valid instance of an Address
 */
Address.fromObject = function fromObject(obj) {
  $.checkState(
    JSUtil.isHexa(obj.hash),
    'Unexpected hash property, "' + obj.hash + '", expected to be hex.'
  );
  var hashBuffer = Buffer.from(obj.hash, 'hex');
  return new Address(hashBuffer, obj.network, obj.type);
};

/**
 * Will return a validation error if exists
 *
 * @example
 * ```javascript
 * // a network mismatch error
 * var error = Address.getValidationError('15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2', 'testnet');
 * ```
 *
 * @param {string} data - The encoded data
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string} type - The type of address: 'script' or 'pubkey'
 * @returns {null|Error} The corresponding error message
 */
Address.getValidationError = function(data, network, type) {
  var error;
  try {
    /* jshint nonew: false */
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
 * ```javascript
 * assert(Address.isValid('15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2', 'livenet'));
 * ```
 *
 * @param {string} data - The encoded data
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string} type - The type of address: 'script' or 'pubkey'
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
 * Returns true if an address is of pay to witness public key hash type
 * @return boolean
 */
Address.prototype.isPayToWitnessPublicKeyHash = function() {
  return this.type === Address.PayToWitnessPublicKeyHash;
};

/**
 * Returns true if an address is of pay to witness script hash type
 * @return boolean
 */
Address.prototype.isPayToWitnessScriptHash = function() {
  return this.type === Address.PayToWitnessScriptHash;
};

/**
 * Returns true if an address is of pay to Taproot script hash type
 * @returns {boolean}
 */
Address.prototype.isPayToTaproot = function() {
  return this.type === Address.PayToTaproot;
}

/**
 * Will return a buffer representation of the address
 *
 * @returns {Buffer} Bitcoin address buffer
 */
Address.prototype.toBuffer = function() {
  if (this.isPayToWitnessPublicKeyHash() || this.isPayToWitnessScriptHash()) {
    return Buffer.from(this.toString(), 'utf8')
  }
  var version = Buffer.from([this.network[this.type]]);
  return Buffer.concat([version, this.hashBuffer]);
};

/**
 * @returns {Object} A plain object with the address information
 */
Address.prototype.toObject = Address.prototype.toJSON = function toObject() {
  return {
    hash: this.hashBuffer.toString('hex'),
    type: this.type,
    network: this.network.toString()
  };
};

/**
 * Will return a the string representation of the address
 *
 * @returns {string} Bitcoin address
 */
Address.prototype.toString = function() {
  if (this.isPayToWitnessPublicKeyHash() || this.isPayToWitnessScriptHash() || this.isPayToTaproot()) {
    let prefix = this.network.bech32prefix;
    let version = 0;
    let encoding = Bech32.encodings.BECH32;
    if (this.isPayToTaproot()) {
      version = 1;
      encoding = Bech32.encodings.BECH32M;
    }
    return Bech32.encode(prefix, version, this.hashBuffer, encoding);
  }
  return Base58Check.encode(this.toBuffer());
};

/**
 * Will return a string formatted for the console
 *
 * @returns {string} Bitcoin address
 */
Address.prototype.inspect = function() {
  return '<Address: ' + this.toString() + ', type: ' + this.type + ', network: ' + this.network + '>';
};

module.exports = Address;

var Script = require('./script');
