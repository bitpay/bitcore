'use strict';

var _ = require('lodash');

var Address = require('./address');
var base58check = require('./encoding/base58check');
var BN = require('./crypto/bn');
var JSUtil = require('./util/js');
var Networks = require('./networks');
var Point = require('./crypto/point');
var PublicKey = require('./publickey');
var Random = require('./crypto/random');

/**
 * Instantiate a PrivateKey from a BN, Buffer and WIF.
 *
 * @example
 *
 * // generate a new random key
 * var key = PrivateKey();
 *
 * // get the associated address
 * var address = key.toAddress();
 *
 * // encode into wallet export format
 * var exported = key.toWIF('livenet');
 *
 * // instantiate from the exported (and saved) private key
 * var wif = PrivateKey.fromWIF(exported);
 *
 * @param {String} data - The encoded data in various formats
 * @returns {PrivateKey} A new valid instance of an PrivateKey
 * @constructor
 */
var PrivateKey = function PrivateKey(data) {

  if (!(this instanceof PrivateKey)) {
    return new PrivateKey(data);
  }
  if (data instanceof PrivateKey) {
    return data;
  }

  var info = {
    compressed: true
  };

  // detect type of data
  if (_.isUndefined(data)){
    info.bn = PrivateKey._getRandomBN();
  } else if (data instanceof BN) {
    info.bn = data;
  } else if (data instanceof Buffer || data instanceof Uint8Array) {
    info.bn = BN(data);
  } else if (PrivateKey._isJSON(data)){
    info = PrivateKey._transformJSON(data);
  } else if (typeof(data) === 'string'){
    if (JSUtil.isHexa(data)) {
      info.bn = BN(new Buffer(data, 'hex'));
    } else {
      info = PrivateKey._transformBuffer(base58check.decode(data));
    }
  } else {
    throw new TypeError('First argument is an unrecognized data type.');
  }

  // validation
  if (!info.bn || info.bn.cmp(0) === 0){
    throw new TypeError('Number can not be equal to zero, undefined, null or false');
  }
  if (!info.bn.lt(Point.getN())) {
    throw new TypeError('Number must be less than N');
  }

  Object.defineProperty(this, 'bn', {
    configurable: false,
    value: info.bn
  });

  Object.defineProperty(this, 'compressed', {
    configurable: false,
    value: info.compressed
  });

  Object.defineProperty(this, 'publicKey', {
    configurable: false,
    get: this.toPublicKey.bind(this)
  });

  return this;

};

/**
 * Internal function to get a random BN
 *
 * @returns {BN} A new randomly generated BN
 * @private
 */
PrivateKey._getRandomBN = function(){
  var condition;
  var bn;
  do {
    var privbuf = Random.getRandomBuffer(32);
    bn = BN().fromBuffer(privbuf);
    condition = bn.lt(Point.getN());
  } while (!condition);
  return bn;
};

/**
 * Internal function to detect if a param is a JSON string or plain object
 *
 * @param {*} param - value to test
 * @returns {boolean}
 * @private
 */
PrivateKey._isJSON = function(json) {
  return JSUtil.isValidJSON(json) || (json.bn && json.compressed);
};

/**
 * Internal function to transform a WIF Buffer into a private key
 *
 * @param {Buffer} buf - An WIF string
 * @returns {Object} An object with keys: bn, network and compressed
 * @private
 */
PrivateKey._transformBuffer = function(buf) {
  var info = {};

  if (buf.length === 1 + 32 + 1 && buf[1 + 32 + 1 - 1] === 1) {
    info.compressed = true;
  } else if (buf.length === 1 + 32) {
    info.compressed = false;
  } else {
    throw new Error('Length of buffer must be 33 (uncompressed) or 34 (compressed)');
  }

  if (!Networks.get(buf[0], 'privatekey')) {
    throw new Error('Invalid network');
  }

  info.bn = BN.fromBuffer(buf.slice(1, 32 + 1));
  return info;
};

/**
 * Instantiate a PrivateKey from a JSON string
 *
 * @param {String} json - The JSON encoded private key string
 * @returns {PrivateKey} A new valid instance of PrivateKey
 */
PrivateKey.fromJSON = function(json) {
  if (!PrivateKey._isJSON(json)) {
    throw new TypeError('Must be a valid JSON string or plain object');
  }

  return new PrivateKey(json);
};


/**
 * Internal function to transform a JSON string on plain object into a private key
 *
 * @param {String} json - A JSON string or plain object
 * @returns {Object} An object with keys: bn and compressed
 * @private
 */
PrivateKey._transformJSON = function(json) {
  if (JSUtil.isValidJSON(json)) {
    json = JSON.parse(json);
  }
  var bn = BN(json.bn, 'hex');
  return {
    bn: bn,
    compressed: json.compressed
  }
};

/**
 * Instantiate a PrivateKey from a BN hex string
 *
 * @param {String} str - The BN hex string
 * @returns {PrivateKey} A new valid instance of PrivateKey
 */
PrivateKey.fromString = function(str) {
  if (!JSUtil.isHexa(str)) {
    throw new TypeError('Must be a valid hex string');
  }

  return new PrivateKey(str);
};

/**
 * Instantiate a PrivateKey from random bytes
 *
 * @returns {PrivateKey} A new valid instance of PrivateKey
 */
PrivateKey.fromRandom = function() {
  var bn = PrivateKey._getRandomBN();
  return new PrivateKey(bn);
};

/**
 * Check if there would be any errors when initializing a PrivateKey
 *
 * @param {String} data - The encoded data in various formats
 * @returns {null|Error} An error if exists
 */

PrivateKey.getValidationError = function(data) {
  var error;
  try {
    new PrivateKey(data);
  } catch (e) {
    error = e;
  }
  return error;
};

/**
 * Check if the parameters are valid
 *
 * @param {String} data - The encoded data in various formats
 * @returns {Boolean} If the private key is would be valid
 */
PrivateKey.isValid = function(data){
  return !PrivateKey.getValidationError(data);
};

/**
 * Check if the WIF str is valid
 *
 * @param {String} data - The encoded WIF string
 * @param {String} [network] - Either "livenet" or "testnet"
 * @returns {Boolean}
 */
PrivateKey.isValidWIF = function(data, network){
  network = Networks.get(network) || Networks.defaultNetwork;

  try {
    var wif = PrivateKey.fromWIF(data);
    if (wif.network !== network) return false;
  } catch (e) {
    return false;
  }

  return true;
};

/**
 * Parse a WIF format into and object with the private key and netwokr
 *
 * @param {String} data - The encoded data WIF format
 * @returns {Object} An object with the PrivateKey and network
 */
PrivateKey.fromWIF = function(str) {
  var buffer = base58check.decode(str);
  var network = Networks.get(buffer[0], 'privatekey');

  if (!network) {
    throw new Error('Invalid network');
  }

  return {
    privateKey: new PrivateKey(str),
    network: network
  };
};

/**
 * Will output the PrivateKey to a WIF string
 *
 * @returns {String} A WIP representation of the private key
 */
 PrivateKey.prototype.toWIF = function(network) {
  var network = network ? Networks.get(network) : Networks.defaultNetwork;
  var compressed = this.compressed;

  var buf;
  if (compressed) {
    buf = Buffer.concat([new Buffer([network.privatekey]),
                         this.bn.toBuffer({size: 32}),
                         new Buffer([0x01])]);
  } else {
    buf = Buffer.concat([new Buffer([network.privatekey]),
                         this.bn.toBuffer({size: 32})]);
  }

  return base58check.encode(buf);
};

/**
 * Will output the private key BN in hex
 *
 * @returns {String} A hex representation of the BN
 */
PrivateKey.prototype.toString = function() {
  return this.bn.toString('hex');
}

/**
 * Will return the private key as a BN instance
 *
 * @returns {BN} A BN instance of the private key
 */
PrivateKey.prototype.toBigNumber = function(){
  return this.bn;
};

/**
 * Will return the private key as a BN buffer
 *
 * @returns {Buffer} A buffer of the private key
 */
PrivateKey.prototype.toBuffer = function(){
  return this.bn.toBuffer();
};

/**
 * Will return the corresponding public key
 *
 * @returns {PublicKey} A public key generated from the private key
 */
PrivateKey.prototype.toPublicKey = function(){
  if (!this._pubkey) {
    this._pubkey = PublicKey.fromPrivateKey(this);
  }
  return this._pubkey;
};

/**
 * Will return an address for the private key
 *
 * @returns {Address} An address generated from the private key
 */
PrivateKey.prototype.toAddress = function(network) {
  var pubkey = this.toPublicKey();
  return Address.fromPublicKey(pubkey, network);
};

/**
 * @returns {Object} A plain object representation
 */
PrivateKey.prototype.toObject = function toObject() {
  return {
    bn: this.bn.toString('hex'),
    compressed: this.compressed
  };
};

PrivateKey.prototype.toJSON = function toJSON() {
  return JSON.stringify(this.toObject());
};

/**
 * Will return a string formatted for the console
 *
 * @returns {String} Private key
 */
PrivateKey.prototype.inspect = function() {
  var uncompressed = !this.compressed ? ', uncompressed' : '';
  return '<PrivateKey: ' + this.toString() + uncompressed + '>';
};

module.exports = PrivateKey;
