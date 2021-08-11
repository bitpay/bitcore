'use strict';
var _ = require('lodash');
var $ = require('./util/preconditions');
var errors = require('./errors');
var Base58 = require('./encoding/base58');
var Base58Check = require('./encoding/base58check');
var BufferReader = require('./encoding/bufferreader');
var BufferWriter = require('./encoding/bufferwriter');
var Networks = require('./networks');
var Hash = require('./crypto/hash');
var JSUtil = require('./util/js');
var BufferUtil = require('./util/buffer');
var PublicKey = require('./publickey');

var TOKEN_NAME = 'lotus';
var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function XAddress(data, network, type, prefix = TOKEN_NAME) {
  /* jshint maxcomplexity: 12 */
  /* jshint maxstatements: 20 */

  if (!(this instanceof XAddress)) {
    return new XAddress(data, network, type);
  }

  if (data instanceof XAddress) {
    // Immutable instance
    return data;
  }

  $.checkArgument(data, 'First argument is required, please include address data.', 'guide/address.html');

  if (network && !Networks.get(network)) {
    throw new TypeError('Second argument must be "livenet", "testnet", or "regtest".');
  }

  if (type && (type !== XAddress.PayToPublicKeyHash && type !== XAddress.PayToScriptHash)) {
    throw new TypeError('Third argument must be "pubkeyhash" or "scripthash".');
  }

  var info = this._classifyArguments(data, network, type, prefix);

  // set defaults if not set
  info.network = info.network || Networks.get(network) || Networks.defaultNetwork;
  info.type = info.type || type || XAddress.PayToPublicKeyHash;

  JSUtil.defineImmutable(this, {
    prefix: info.prefix,
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
 * @param {string=} type - The type of address: currently all are 'scriptpubkey'
 * @returns {Object} An "info" object with "type", "network", and "hashBuffer"
 */
XAddress.prototype._classifyArguments = function (data, network, type, prefix) {
  /* jshint maxcomplexity: 10 */
  // transform and validate input data
  if (typeof (data) === 'string') {
    return XAddress._transformString(data, network, type);
  } else if (data instanceof Buffer || data instanceof Uint8Array) {
    return XAddress._transformBuffer(data, network, type);
  } else if (_.isObject(data)) {
    return XAddress._transformObject(data);
  } else {
    throw new TypeError('First argument is an unrecognized data format.');
  }
};

/** @static */
XAddress.PayToPublicKeyHash = 'pubkeyhash';
/** @static */
XAddress.PayToScriptHash = 'scripthash';


/**
 * Deserializes an address serialized through `Address#toObject()`
 * @param {Object} data
 * @param {string} data.hash - the hash that this address encodes
 * @param {string} data.type - either 'pubkeyhash' or 'scripthash'
 * @param {Network=} data.network - the name of the network associated
 * @return {Address}
 */
XAddress._transformObject = function (data) {
  $.checkArgument(data.hash || data.hashBuffer, 'Must provide a `hash` or `hashBuffer` property');
  $.checkArgument(data.type, 'Must provide a `type` property');
  return {
    hashBuffer: data.hash ? Buffer.from(data.hash, 'hex') : data.hashBuffer,
    network: Networks.get(data.network) || Networks.defaultNetwork,
    type: data.type,
    prefix: data.prefix
  };
};

/**
 * Internal function to discover the network and type based on the first data byte
 *
 * @param {Buffer} buffer - An instance of a hex encoded address Buffer
 * @returns {Object} An object with keys: network and type
 * @private
 */
XAddress._classifyFromVersion = function (buffer) {

  // @TODO Currently incorrect, the format of xaddress is different
  var version = {};

  var pubkeyhashNetwork = Networks.get(buffer[0], 'pubkeyhash');
  var scripthashNetwork = Networks.get(buffer[0], 'scripthash');

  if (pubkeyhashNetwork) {
    version.network = pubkeyhashNetwork;
    version.type = XAddress.PayToPublicKeyHash;
  } else if (scripthashNetwork) {
    version.network = scripthashNetwork;
    version.type = XAddress.PayToScriptHash;
  }

  return version;
};

function createChecksum(prefix, networkByte, typeByte, payload) {
  var data = BufferUtil.concat([Buffer.from(prefix), networkByte, typeByte, payload]);
  return Hash.sha256(data).slice(0, 4);
}

function createChecksumLegacy(prefix, networkByte, typeByte, payload) {
  var bw = new BufferWriter();
  bw.writeVarintNum(prefix.length);
  bw.write(Buffer.from(prefix));
  bw.writeUInt8(networkByte);
  bw.writeUInt8(typeByte);
  bw.writeVarintNum(payload.length);
  bw.write(payload);
  var buf = bw.concat();
  return Hash.sha256(buf).slice(0, 4);
}


function getType(typeByte) {
  switch (typeByte) {
    case 0:
      return 'pubkeyhash';
  }
  return 'pubkeyhash'
}

function getTypeByte(type) {
  switch (type) {
    case 'pubkeyhash':
      return 0;
  }
  return 0;
}

function getNetwork(networkChar) {
  switch (networkChar) {
    case '_':
      return Networks.get('livenet');
    case 'T':
      return Networks.get('testnet');
    case 'R':
      return Networks.get('regtest');
    default:
      throw TypeError('Unknown network type');
  }
}

function getNetworkChar(network) {
  switch (network) {
    case Networks.livenet:
      return '_';
    case Networks.testnet:
      return 'T';
    case Networks.regtest:
      return 'R';
    default:
      throw TypeError('Unknown network');
  }
}

function encodePayload(typeByte, payload, checksum) {
  var bw = new BufferWriter();
  bw.writeUInt8(typeByte);
  bw.write(payload);
  bw.write(checksum);
  var buf = bw.concat();
  return Base58.encode(buf);
}

function decode(address) {

  var match = /[A-Z]|_/.exec(address);

  var splitLocation = match ? match.index : 0;

  var prefix, networkChar, networkByte, encodedPayload, decodedBytes, typeByte;

  prefix = address.substring(0, splitLocation);
  networkChar = address.substring(splitLocation, splitLocation + 1);
  networkByte = Buffer.from(networkChar);
  encodedPayload = address.substring(splitLocation + 1);
  decodedBytes = Base58.decode(encodedPayload);
  typeByte = decodedBytes.slice(0, 1);
  var payload = decodedBytes.slice(1, decodedBytes.length - 4);
  var decodedChecksum = decodedBytes.slice(decodedBytes.length - 4);

  var checksum = createChecksum(prefix, networkByte, typeByte, payload);
  var legacyChecksum = createChecksumLegacy(prefix, networkByte, typeByte, payload);

  $.checkArgument(checksum.toString('hex') === decodedChecksum.toString('hex') ||
    legacyChecksum.toString('hex') === decodedChecksum.toString('hex'), 'Invalid checksum: ' + address);

  var info = {};
  info.hashBuffer = payload;
  info.network = getNetwork(networkChar);
  info.type = getType(typeByte[0]);
  info.prefix = prefix;

  return info;
}

XAddress._decode = decode

/**
 * Internal function to transform a bitcoin cash address string
 *
 * @param {string} data
 * @param {String|Network=} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string=} type - The type: 'pubkeyhash' or 'scripthash'
 * @returns {Object} An object with keys: hashBuffer, network and type
 * @private
 */
XAddress._transformString = function (data, network, type) {
  if (typeof (data) !== 'string') {
    throw new TypeError('data parameter supplied is not a string.');
  }

  data = data.trim();
  var networkObj = Networks.get(network);

  if (network && !networkObj) {
    throw new TypeError('Unknown network');
  }

  var info = decode(data);
  if (!info.network || (networkObj && networkObj.name !== info.network.name)) {
    throw new TypeError('Address has mismatched network type.');
  }
  return info;
};

/**
 * Internal function to transform a lotus address buffer
 *
 * @param {Buffer} buffer - An instance of a hex encoded address Buffer
 * @param {string=} network - The network: 'livenet' or 'testnet'
 * @param {string=} type - The type: 'pubkeyhash' or 'scripthash'
 * @returns {Object} An object with keys: hashBuffer, network and type
 * @private
 */
XAddress._transformBuffer = function (buffer, network, type, prefix = TOKEN_NAME) {
  /* jshint maxcomplexity: 9 */
  var info = {};
  if (!(buffer instanceof Buffer) && !(buffer instanceof Uint8Array)) {
    throw new TypeError('XAddress supplied is not a buffer.');
  }

  var networkObj = Networks.get(network);

  if (network && !networkObj) {
    throw new TypeError('Unknown network');
  }

  if (type === undefined) {
    throw new TypeError('Unknown type.');
  }

  info.prefix = prefix;
  info.hashBuffer = buffer;
  info.network = network;
  info.type = type;
  return info;
}

/**
 * Instantiate an xaddress from an address string
 *
 * @param {string} str - An string of the lotus address
 * @param {String|Network=} network - either a Network instance, 'livenet', or 'testnet'
 * @param {string=} type - The type of address: 'script' or 'pubkey'
 * @returns {Address} A new valid and frozen instance of an Address
 */
XAddress.fromString = function (str, network, type) {
  var info = XAddress._transformString(str, network, type);
  return new XAddress(info.hashBuffer, info.network, info.type);
};


/**
 * Instantiate an xaddress from an Object
 *
 * @param {string} json - An JSON string or Object with keys: hash, network and type
 * @returns {Address} A new valid instance of an Address
 */
XAddress.fromObject = function fromObject(obj) {
  $.checkState(
    JSUtil.isHexa(obj.hash),
    'Unexpected hash property, "' + obj.hash + '", expected to be hex.'
  );
  var hashBuffer = Buffer.from(obj.hash, 'hex');
  return new XAddress(hashBuffer, obj.network, obj.type, obj.token);
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
XAddress.getValidationError = function (data, network, type) {
  var error;
  try {
    /* jshint nonew: false */
    new XAddress(data, network, type);
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
XAddress.isValid = function (data, network, type) {
  return !XAddress.getValidationError(data, network, type);
};

/**
 * Will return a buffer representation of the xaddress
 *
 * @returns {Buffer} Lotus xaddress buffer
 */
XAddress.prototype.toBuffer = function () {
  var version = Buffer.from([this.network[this.type]]);
  var buf = Buffer.concat([version, this.hashBuffer]);
  return buf;
};

/**
 * @returns {Object} A plain object with the xaddress information
 */
XAddress.prototype.toObject = XAddress.prototype.toJSON = function toObject() {
  return {
    prefix: this.prefix,
    hash: this.hashBuffer.toString('hex'),
    type: this.type,
    network: this.network.toString()
  };
};

XAddress.prototype.toXAddress = function () {
  var prefix = this.prefix;
  var networkChar = getNetworkChar(this.network);
  var networkByte = Buffer.from(networkChar);
  var typeByte = Buffer.from([getTypeByte(this.type)]);
  var payload = this.hashBuffer;
  var checksum = createChecksum(prefix, networkByte, typeByte, payload);
  var encodedPayload = encodePayload(typeByte, payload, checksum);
  return prefix + networkChar + encodedPayload;
}

XAddress.prototype.toString = XAddress.prototype.toXAddress;

/**
 * Will return a the base58 (legacy) string representation of the address
 *
 * @returns {string} Bitcoin address
 */
 XAddress.prototype.toLegacyAddress = function () {
  return Base58Check.encode(this.toBuffer());
};

/**
 * Will return a string formatted for the console
 *
 * @returns {string} Lotus address
 */
XAddress.prototype.inspect = function () {
  return '<XAddress: ' + this.toString() + ', prefix: ' + this.prefix + ', type: ' + this.type + ', network: ' + this.network + '>';
};


module.exports = XAddress;