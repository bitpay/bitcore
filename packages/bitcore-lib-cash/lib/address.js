'use strict';

var _ = require('lodash');
var $ = require('./util/preconditions');
var errors = require('./errors');
var Base58Check = require('./encoding/base58check');
var Networks = require('./networks');
var Hash = require('./crypto/hash');
var JSUtil = require('./util/js');
var PublicKey = require('./publickey');
var BN = require('./crypto/bn');

var base32 = require('./util/base32');
var convertBits = require('./util/convertBits');

/**
 * Instantiate an address from an address String or Buffer, a public key or script hash Buffer,
 * or an instance of {@link PublicKey} or {@link Script}.
 *
 * This is an immutable class, and if the first parameter provided to this constructor is an
 * `Address` instance, the same argument will be returned.
 *
 * An address has two key properties: `network` and `type`. The type is either
 * `Address.PayToPublicKeyHash` (value is the `'pubkeyhash'` string)
 * or `Address.PayToScriptHash` (the string `'scripthash'`). The network is an instance of {@link Network}.
 * You can quickly check whether an address is of a given kind by using the methods
 * `isPayToPublicKeyHash` and `isPayToScriptHash`
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
 * @param {string=} type - The type of address: 'script' or 'pubkey'
 * @returns {Address} A new valid and frozen instance of an Address
 * @constructor
 */
function Address(data, network, type) {
  /* jshint maxcomplexity: 12 */
  /* jshint maxstatements: 20 */

  if (!(this instanceof Address)) {
    return new Address(data, network, type);
  }

  if (_.isArray(data) && _.isNumber(network)) {
    return Address.createMultisig(data, network, type);
  }

  if (data instanceof Address) {
    // Immutable instance
    return data;
  }

  $.checkArgument(data, 'First argument is required, please include address data.', 'guide/address.html');

  if (network && !Networks.get(network)) {
    throw new TypeError('Second argument must be "livenet", "testnet", or "regtest".');
  }

  if (type && (type !== Address.PayToPublicKeyHash && type !== Address.PayToScriptHash)) {
    throw new TypeError('Third argument must be "pubkeyhash" or "scripthash".');
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
  if ((data instanceof Buffer || data instanceof Uint8Array) && data.length === 20) {
    return Address._transformHash(data);
  } else if ((data instanceof Buffer || data instanceof Uint8Array) && data.length === 21) {
    return Address._transformBuffer(data, network, type);
  } else if (data instanceof PublicKey) {
    return Address._transformPublicKey(data);
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

/**
 * @param {Buffer} hash - An instance of a hash Buffer
 * @returns {Object} An object with keys: hashBuffer
 * @private
 */
Address._transformHash = function(hash) {
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
 * Deserializes an address serialized through `Address#toObject()`
 * @param {Object} data
 * @param {string} data.hash - the hash that this address encodes
 * @param {string} data.type - either 'pubkeyhash' or 'scripthash'
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

  var pubkeyhashNetwork = Networks.get(buffer[0], 'pubkeyhash');
  var scripthashNetwork = Networks.get(buffer[0], 'scripthash');

  if (pubkeyhashNetwork) {
    version.network = pubkeyhashNetwork;
    version.type = Address.PayToPublicKeyHash;
  } else if (scripthashNetwork) {
    version.network = scripthashNetwork;
    version.type = Address.PayToScriptHash;
  }

  return version;
};

/**
 * Internal function to transform a bitcoin address buffer
 *
 * @param {Buffer} buffer - An instance of a hex encoded address Buffer
 * @param {string=} network - The network: 'livenet' or 'testnet'
 * @param {string=} type - The type: 'pubkeyhash' or 'scripthash'
 * @returns {Object} An object with keys: hashBuffer, network and type
 * @private
 */
Address._transformBuffer = function(buffer, network, type) {
  /* jshint maxcomplexity: 9 */
  var info = {};
  if (!(buffer instanceof Buffer) && !(buffer instanceof Uint8Array)) {
    throw new TypeError('Address supplied is not a buffer.');
  }
  if (buffer.length !== 1 + 20) {
    throw new TypeError('Address buffers must be exactly 21 bytes.');
  }

  var networkObj = Networks.get(network);
  var bufferVersion = Address._classifyFromVersion(buffer);

  if (network && !networkObj) {
    throw new TypeError('Unknown network');
  }

  if (!bufferVersion.network || (networkObj && networkObj !== bufferVersion.network)) {
    throw new TypeError('Address has mismatched network type.');
  }

  if (!bufferVersion.type || (type && type !== bufferVersion.type)) {
    throw new TypeError('Address has mismatched type.');
  }

  info.hashBuffer = buffer.slice(1);
  info.network = bufferVersion.network;
  info.type = bufferVersion.type;
  return info;
};

/**
 * Internal function to transform a {@link PublicKey}
 *
 * @param {PublicKey} pubkey - An instance of PublicKey
 * @returns {Object} An object with keys: hashBuffer, type
 * @private
 */
Address._transformPublicKey = function(pubkey) {
  var info = {};
  if (!(pubkey instanceof PublicKey)) {
    throw new TypeError('Address must be an instance of PublicKey.');
  }
  info.hashBuffer = Hash.sha256ripemd160(pubkey.toBuffer());
  info.type = Address.PayToPublicKeyHash;
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
 * @return {Address}
 */
Address.createMultisig = function(publicKeys, threshold, network) {
  network = network || publicKeys[0].network || Networks.defaultNetwork;
  return Address.payingTo(Script.buildMultisigOut(publicKeys, threshold), network);
};

function decodeCashAddress(address) {


  function hasSingleCase(string) {
    var lowerCase = string.toLowerCase();
    var upperCase = string.toUpperCase();
    var hasSingleCase  = string === lowerCase || string === upperCase;

    return hasSingleCase;
  }

  function validChecksum(prefix, payload) {
    function prefixToArray(prefix) {
      var result = [];
      for (var i=0; i<prefix.length; i++) {
        result.push(prefix.charCodeAt(i) & 31);
      }
      return result;
    }

    var prefixData = prefixToArray(prefix).concat([0]);
    return polymod(prefixData.concat(payload)) === 0;
  }

  $.checkArgument(hasSingleCase(address), 'Mixed case');
  address = address.toLowerCase();

  var pieces = address.split(':');
  $.checkArgument(pieces.length <= 2, 'Invalid format:'+ address);

  var prefix, encodedPayload;

  if (pieces.length === 2) {
    prefix = pieces[0];
    encodedPayload = pieces[1];
  } else {
    prefix = null;
    encodedPayload = pieces[0];
  }

  var payload = base32.decode(encodedPayload.toLowerCase());

  if (prefix) {
    $.checkArgument(validChecksum(prefix, payload), 'Invalid checksum:'+ address);
  } else {

    var netNames = ['livenet','testnet','regtest'];
    var i;

    while(!prefix && (i = netNames.shift())){
      var p  =  Networks.get(i).prefix;
      if(validChecksum(p, payload)) {
        prefix = p;
      }
    }
    $.checkArgument(prefix, 'Invalid checksum:'+ address);
  }

  var convertedBits = convertBits(payload.slice(0, -8), 5, 8, true);
  var versionByte = convertedBits.shift();
  var hash = convertedBits;

  $.checkArgument(getHashSize(versionByte) === hash.length * 8, 'Invalid hash size:'+ address);

  function getType(versionByte) {
    switch (versionByte & 120) {
    case 0:
      return 'pubkeyhash';
    case 8:
      return 'scripthash';
    default:
      throw new Error('Invalid address type in version byte:' + versionByte);
    }
  }


  var type = getType(versionByte);
  var network = Networks.get(prefix);
//console.log('[address.js.336:network:]',network); //TODO

  var info = {};

  //return { prefix, type, hash };
//console.log('[address.js.339]', hash); //TODO

  info.hashBuffer = Buffer.from(hash);
  info.network = network;
  info.type = type;
  return info;
}

Address._decodeCashAddress = decodeCashAddress

/**
 * Internal function to transform a bitcoin cash address string
 *
 * @param {string} data
 * @param {String|Network=} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string=} type - The type: 'pubkeyhash' or 'scripthash'
 * @returns {Object} An object with keys: hashBuffer, network and type
 * @private
 */
Address._transformString = function(data, network, type) {
  if (typeof(data) !== 'string') {
    throw new TypeError('data parameter supplied is not a string.');
  }
  if (data.length < 34){
    throw new Error('Invalid Address string provided');
  }

  if(data.length > 100) {
    throw new TypeError('address string is too long');
  }

  data = data.trim();
  var networkObj = Networks.get(network);

  if (network && !networkObj) {
    throw new TypeError('Unknown network');
  }

  if (data.length > 35){
    var info = decodeCashAddress(data);
    if (!info.network || (networkObj && networkObj.name !== info.network.name)) {
      throw new TypeError('Address has mismatched network type.');
    }
    if (!info.type || (type && type !== info.type)) {
      throw new TypeError('Address has mismatched type.');
    }
    return info;
  } else {
    var addressBuffer = Base58Check.decode(data);
    // Legacy addr
    return Address._transformBuffer(addressBuffer, network, type);
  }
};


/**
 * Instantiate an address from a PublicKey instance
 *
 * @param {PublicKey} data
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromPublicKey = function(data, network) {
  var info = Address._transformPublicKey(data);
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
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.fromScriptHash = function(hash, network) {
  $.checkArgument(hash, 'hash parameter is required');
  var info = Address._transformHash(hash);
  return new Address(info.hashBuffer, network, Address.PayToScriptHash);
};

/**
 * Builds a p2sh address paying to script. This will hash the script and
 * use that to create the address.
 * If you want to extract an address associated with a script instead,
 * see {{Address#fromScript}}
 *
 * @param {Script} script - An instance of Script
 * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
 * @returns {Address} A new valid and frozen instance of an Address
 */
Address.payingTo = function(script, network) {
  $.checkArgument(script, 'script is required');
  $.checkArgument(script instanceof Script, 'script must be instance of Script');

  return Address.fromScriptHash(Hash.sha256ripemd160(script.toBuffer()), network);
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
 * Will return a buffer representation of the address
 *
 * @returns {Buffer} Bitcoin address buffer
 */
Address.prototype.toBuffer = function() {
  var version = Buffer.from([this.network[this.type]]);
  var buf = Buffer.concat([version, this.hashBuffer]);
  return buf;
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
 * Will return a string formatted for the console
 *
 * @returns {string} Bitcoin address
 */
Address.prototype.inspect = function() {
  return '<Address: ' + this.toString() + ', type: ' + this.type + ', network: ' + this.network + '>';
};

/***
 * @license
 * https://github.com/bitcoincashjs/cashaddr
 * Copyright (c) 2017 Emilio Almansi
 * Distributed under the MIT software license, see the accompanying
 * file LICENSE or http://www.opensource.org/licenses/mit-license.php.
 */

Address.prototype.toCashBuffer = function() {
  var version = Buffer.from([this.network[this.type]]);
  var buf = Buffer.concat([version, this.hashBuffer]);
  return buf;
};

/**
 * Will return a the base58 (legacy) string representation of the address
 *
 * @returns {string} Bitcoin address
 */
Address.prototype.toLegacyAddress = function () {
  return Base58Check.encode(this.toBuffer());
};

/**
 * Will return a cashaddr representation of the address. Always return lower case
 * Can be converted by the caller to uppercase is needed (still valid).
 *
 * @returns {string} Bitcoin Cash address
 */


Address.prototype.toCashAddress = function(stripPrefix) {
  function getTypeBits(type) {
    switch (type) {
      case 'pubkeyhash':
        return 0;
      case 'scripthash':
        return 8;
      default:
        throw new Error('Invalid type:'+ type);
    }
  }

  function getHashSizeBits(hash) {
    switch (hash.length * 8) {
      case 160:
        return 0;
      case 192:
        return 1;
      case 224:
        return 2;
      case 256:
        return 3;
      case 320:
        return 4;
      case 384:
        return 5;
      case 448:
        return 6;
      case 512:
        return 7;
      default:
        throw new Error('Invalid hash size:'+ hash.length);
      }
  }

  var eight0 = [0,0,0,0, 0,0,0,0];
  var prefixData = this.network.prefixArray.concat([0]);
  var versionByte = getTypeBits(this.type) + getHashSizeBits(this.hashBuffer);
  var arr =  Array.prototype.slice.call(this.hashBuffer, 0);
  var payloadData = convertBits([versionByte].concat(arr), 8, 5);
  var checksumData = prefixData.concat(payloadData).concat(eight0);
  var payload = payloadData.concat(checksumToArray(polymod(checksumData)));
  if(stripPrefix === true) {
    return base32.encode(payload);
  } else {
    return this.network.prefix+ ':' + base32.encode(payload);
  }
};

/**
 * Will return a string representation of the address (defaults to CashAddr format)
 *
 * @returns {string} address
 */
Address.prototype.toString = Address.prototype.toCashAddress;

/***
 * Retrieves the the length in bits of the encoded hash from its bit
 * representation within the version byte.
 *
 * @param {number} versionByte
 */
function getHashSize(versionByte) {
  switch (versionByte & 7) {
  case 0:
    return 160;
  case 1:
    return 192;
  case 2:
    return 224;
  case 3:
    return 256;
  case 4:
    return 320;
  case 5:
    return 384;
  case 6:
    return 448;
  case 7:
    return 512;
  }
}


/***
 * Returns an array representation of the given checksum to be encoded
 * within the address' payload.
 *
 * @param {number} checksum Computed checksum.
 */
function checksumToArray(checksum) {
  var result = [];
  for (var i = 0; i < 8; ++i) {
    result.push(checksum & 31);
    checksum /= 32;
  }
  return result.reverse();
}

/***
 * Computes a checksum from the given input data as specified for the CashAddr
 * format: https://github.com/Bitcoin-UAHF/spec/blob/master/cashaddr.md.
 *
 * @param {Array} data Array of 5-bit integers over which the checksum is to be computed.
 */
var GENERATOR1 = [0x98, 0x79, 0xf3, 0xae, 0x1e];
var GENERATOR2 = [0xf2bc8e61, 0xb76d99e2, 0x3e5fb3c4, 0x2eabe2a8, 0x4f43e470];

function polymod(data) {
  // Treat c as 8 bits + 32 bits
  var c0 = 0, c1 = 1, C = 0;
  for (var j = 0; j < data.length; j++) {
    // Set C to c shifted by 35
    C = c0 >>> 3;
    // 0x[07]ffffffff
    c0 &= 0x07;
    // Shift as a whole number
    c0 <<= 5;
    c0 |= c1 >>> 27;
    // 0xffffffff >>> 5
    c1 &= 0x07ffffff;
    c1 <<= 5;
    // xor the last 5 bits
    c1 ^= data[j];
    for (var i = 0; i < GENERATOR1.length; ++i) {
      if (C & (1 << i)) {
        c0 ^= GENERATOR1[i];
        c1 ^= GENERATOR2[i];
      }
    }
  }
  c1 ^= 1;
  // Negative numbers -> large positive numbers
  if (c1 < 0) {
    c1 ^= 1 << 31;
    c1 += (1 << 30) * 2;
  }
  // Unless bitwise operations are used,
  // numbers are consisting of 52 bits, except
  // the sign bit. The result is max 40 bits,
  // so it fits perfectly in one number!
  return c0 * (1 << 30) * 4 + c1;
}

module.exports = Address;

var Script = require('./script');
