'use strict';

var BN = require('./crypto/bn');
var Point = require('./crypto/point');
var Random = require('./crypto/random');
var networks = require('./networks');
var base58check = require('./encoding/base58check');
var Address = require('./address');
var PublicKey = require('./publickey');

var assert = require('assert');

var COMPRESSED_LENGTH = 34;
var UNCOMPRESSED_LENGTH = 33;
var RAW_LENGTH = 32;

/**
 *
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
 * var exported = key.toWIF(); 
 * 
 * // instantiate from the exported (and saved) private key
 * var imported = PrivateKey.fromWIF(exported);
 * 
 * @param {String} data - The encoded data in various formats
 * @param {String} [network] - Either "mainnet" or "testnet"
 * @param {Boolean} [compressed] - If the key is in compressed format
 * @returns {PrivateKey} A new valid instance of an PrivateKey
 * @constructor
 */
var PrivateKey = function PrivateKey(data, network, compressed) {

  if (!(this instanceof PrivateKey)) {
    return new PrivateKey(data, network, compressed);
  }

  network = network || 'livenet';
  var info = {
    compressed: typeof(compressed) !== 'undefined' ? compressed : true,
    network: network
  };

  // detect type of data
  if (!data){
    info.bn = PrivateKey._getRandomBN();
  } else if (data instanceof BN) {
    info.bn = data;
  } else if (data instanceof Buffer || data instanceof Uint8Array) {
    info = PrivateKey._transformBuffer(data, network, compressed);
  } else if (typeof(data) === 'string'){
    info = PrivateKey._transformWIF(data, network, compressed);
  } else {
    throw new TypeError('First argument is an unrecognized data type.');
  }

  // validation
  if (!info.bn.lt(Point.getN())) {
    throw new TypeError('Number must be less than N');
  }
  if (typeof(info.compressed) !== 'boolean') {
    throw new TypeError('Must specify whether the corresponding public key is compressed or not (true or false)');
  }

  this.bn = info.bn;
  this.compressed = info.compressed;
  this.network = info.network;
  this.publicKey = this.toPublicKey();

  return this;

};

/**
 *
 * Internal function to get a random BN
 *
 * @returns {Object} An object with keys: bn, network and compressed
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
 *
 * Internal function to transform a WIF Buffer into a private key 
 *
 * @param {Buffer} buf - An WIF string 
 * @param {String} [network] - Either "mainnet" or "testnet"
 * @param {String} [compressed] - If the private key is compressed
 * @returns {Object} An object with keys: bn, network and compressed
 * @private
 */
PrivateKey._transformBuffer = function(buf, network, compressed) {
  /* jshint maxcomplexity: 8 */

  var info = {};


  info.compressed = false;
  if (buf.length === COMPRESSED_LENGTH && buf[COMPRESSED_LENGTH-1] === 1) {
    info.compressed = true;
    assert(buf[0] === networks.get(network).privatekey, 'Network version mismatch');
  } else if (buf.length === RAW_LENGTH || buf.length === UNCOMPRESSED_LENGTH) {
    if (buf.length === UNCOMPRESSED_LENGTH) {
      assert(buf[0] === networks.get(network).privatekey, 'Network version mismatch');
      buf = buf.slice(1, RAW_LENGTH);
    }
  } else {
    throw new Error('Length of buffer must be 32 to 34 (plain, uncompressed, or compressed)');
  }

  if (typeof(compressed) !== 'undefined' && info.compressed !== compressed){
    throw TypeError('Private key compression mismatch');
  }
  info.bn = BN.fromBuffer(buf);
  return info;
};

/**
 *
 * Internal function to transform a WIF string into a private key 
 *
 * @param {String} buf - An WIF string 
 * @returns {Object} An object with keys: bn, network and compressed
 * @private
 */
PrivateKey._transformWIF = function(str, network, compressed) {
  return PrivateKey._transformBuffer(base58check.decode(str), network, compressed);
};

/**
 *
 * Instantiate a PrivateKey from a WIF string
 *
 * @param {String} str - The WIF encoded private key string
 * @returns {PrivateKey} A new valid instance of PrivateKey
 */
PrivateKey.fromWIF = function(str) {
  var info = PrivateKey._transformWIF(str);
  return new PrivateKey(info.bn, info.network, info.compressed);
};

/**
 *
 * Instantiate a PrivateKey from a WIF JSON string
 *
 * @param {String} str - The WIF encoded private key string
 * @returns {PrivateKey} A new valid instance of PrivateKey
 */
PrivateKey.fromJSON = function(json) {
  var info = PrivateKey._transformWIF(json);
  return new PrivateKey(info.bn, info.network, info.compressed);
};

/**
 *
 * Instantiate a PrivateKey from random bytes
 *
 * @param {String} [network] - Either "mainnet" or "testnet"
 * @param {String} [compressed] - If the private key is compressed
 * @returns {PrivateKey} A new valid instance of PrivateKey
 */
PrivateKey.fromRandom = function(network, compressed) {
  var bn = PrivateKey._getRandomBN();
  return new PrivateKey(bn, network, compressed);
};

/**
 *
 * Instantiate a PrivateKey from a WIF string
 *
 * @param {String} str - The WIF encoded private key string
 * @returns {PrivateKey} A new valid instance of PrivateKey
 */
PrivateKey.fromString = function(str) {
  var info = PrivateKey._transformWIF(str);
  return new PrivateKey(info.bn, info.network, info.compressed);
};

/**
 *
 * Check if there would be any errors when initializing a PrivateKey
 *
 * @param {String} data - The encoded data in various formats
 * @param {String} [network] - Either "mainnet" or "testnet"
 * @param {String} [compressed] - If the private key is compressed
 * @returns {null|Error} An error if exists
 */

PrivateKey.getValidationError = function(data, network, compressed) {
  var error;
  try {
    new PrivateKey(data, network, compressed);
  } catch (e) {
    error = e;
  }
  return error;
};

/**
 *
 * Check if the parameters are valid
 *
 * @param {String} data - The encoded data in various formats
 * @param {String} [network] - Either "mainnet" or "testnet"
 * @param {String} [compressed] - If the private key is compressed
 * @returns {Boolean} If the private key is would be valid
 */
PrivateKey.isValid = function(data, network, compressed){
  return !PrivateKey.getValidationError(data, network, compressed);
};

/**
 *
 * Will output the PrivateKey to a WIF string
 *
 * @returns {String} A WIP representation of the private key
 */
PrivateKey.prototype.toWIF = function() {
  var network = this.network;
  var compressed = this.compressed;

  var buf;
  if (compressed) {
    buf = Buffer.concat([new Buffer([networks[network].privatekey]), 
                         this.bn.toBuffer({size: 32}), 
                         new Buffer([0x01])]);
  } else {
    buf = Buffer.concat([new Buffer([networks[network].privatekey]), 
                         this.bn.toBuffer({size: 32})]);
  }

  return base58check.encode(buf);
};

/**
 *
 * Will return the private key as a BN instance
 *
 * @returns {BN} A BN instance of the private key
 */
PrivateKey.prototype.toBigNumber = function(){
  return this.bn;
};

/**
 *
 * Will return the private key as a BN buffer
 *
 * @returns {Buffer} A buffer of the private key
 */
PrivateKey.prototype.toBuffer = function(){
  return this.bn.toBuffer();
};

/**
 *
 * Will return the corresponding public key
 *
 * @returns {PublicKey} A public key generated from the private key
 */
PrivateKey.prototype.toPublicKey = function(){
  return PublicKey.fromPrivateKey(this);
};

/**
 *
 * Will return an address for the private key
 *
 * @returns {Address} An address generated from the private key
 */
PrivateKey.prototype.toAddress = function() {
  var pubkey = this.toPublicKey();
  return Address.fromPublicKey(pubkey, this.network);
};

/**
 *
 * Will output the PrivateKey to a WIF string
 *
 * @returns {String} A WIF representation of the private key
 */
PrivateKey.prototype.toJSON = function() {
  return this.toString();
};

/**
 *
 * Will output the PrivateKey to a WIF string
 *
 * @returns {String} A WIF representation of the private key
 */
PrivateKey.prototype.toString = function() {
  return this.toWIF();
};

/**
 *
 * Will return a string formatted for the console
 *
 * @returns {String} Private key
 */
PrivateKey.prototype.inspect = function() {
  return '<PrivateKey: ' + this.toString() + ', compressed: '+this.compressed+', network: '+this.network+'>';
};

module.exports = PrivateKey;
