'use strict';

var BN = require('./crypto/bn');
var Point = require('./crypto/point');
var Random = require('./crypto/random');
var networks = require('./networks');
var base58check = require('./encoding/base58check');
var Address = require('./address');
var Pubkey = require('./pubkey');

/**
 *
 * Bitcore Privkey
 *
 * Instantiate a Privkey from a BN, Buffer and WIF.
 *
 * @example
 *
 * var privkey = new Privkey();
 *
 * @param {String} data - The encoded data in various formats
 * @param {String} [network] - Either "mainnet" or "testnet"
 * @param {Boolean} [compressed] - If the key is in compressed format
 * @returns {Privkey} A new valid instance of an Privkey
 */
var Privkey = function Privkey(data, network, compressed) {

  if (!(this instanceof Privkey)) {
    return new Privkey(data, network, compressed);
  }

  var info = {
    compressed: typeof(compressed) !== 'undefined' ? compressed : true,
    network: network || 'mainnet'
  };

  // detect type of data
  if (!data){
    info.bn = Privkey._getRandomBN();
  } else if (data instanceof BN) {
    info.bn = data;
  } else if (data instanceof Buffer) {
    info = Privkey._transformBuffer(data, network, compressed);
  } else if (typeof(data) === 'string'){
    info = Privkey._transformWIF(data, network, compressed);
  } else {
    throw new TypeError('First argument is an unrecognized data type.');
  }

  // validation
  if (!info.bn.lt(Point.getN())) {
    throw new TypeError('Number must be less than N');
  }
  if (typeof(networks[info.network]) === 'undefined') {
    throw new TypeError('Must specify the network ("mainnet" or "testnet")');
  }
  if (typeof(info.compressed) !== 'boolean') {
    throw new TypeError('Must specify whether the corresponding public key is compressed or not (true or false)');
  }

  this.bn = info.bn;
  this.compressed = info.compressed;
  this.network = info.network;

  return this;

};

/**
 *
 * Internal function to get a random BN
 *
 * @returns {Object} An object with keys: bn, network and compressed
 */
Privkey._getRandomBN = function(){
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
 */
Privkey._transformBuffer = function(buf, network, compressed) {

  var info = {};

  if (buf.length === 1 + 32 + 1 && buf[1 + 32 + 1 - 1] === 1) {
    info.compressed = true;
  } else if (buf.length === 1 + 32) {
    info.compressed = false;
  } else {
    throw new Error('Length of buffer must be 33 (uncompressed) or 34 (compressed)');
  }

  if (buf[0] === networks.mainnet.privkey) {
    info.network = 'mainnet';
  } else if (buf[0] === networks.testnet.privkey) {
    info.network = 'testnet';
  } else {
    throw new Error('Invalid network');
  }

  if (network && info.network !== network){
    throw TypeError('Private key network mismatch');
  }

  if (typeof(compressed) !== 'undefined' && info.compressed !== compressed){
    throw TypeError('Private key compression mismatch');
  }
  
  info.bn = BN.fromBuffer(buf.slice(1, 32 + 1));

  return info;

};

/**
 *
 * Internal function to transform a WIF string into a private key 
 *
 * @param {String} buf - An WIF string 
 * @returns {Object} An object with keys: bn, network and compressed
 */
Privkey._transformWIF = function(str, network, compressed) {
  return Privkey._transformBuffer(base58check.decode(str), network, compressed);
};

/**
 *
 * Instantiate a Privkey from a WIF string
 *
 * @param {String} str - The WIF encoded private key string
 * @returns {Privkey} A new valid instance of Privkey
 */
Privkey.fromWIF = function(str) {
  var info = Privkey._transformWIF(str);
  return new Privkey(info.bn, info.network, info.compressed);
};

/**
 *
 * Instantiate a Privkey from a WIF JSON string
 *
 * @param {String} str - The WIF encoded private key string
 * @returns {Privkey} A new valid instance of Privkey
 */
Privkey.fromJSON = function(json) {
  var info = Privkey._transformWIF(json);
  return new Privkey(info.bn, info.network, info.compressed);
};

/**
 *
 * Instantiate a Privkey from random bytes
 *
 * @param {String} [network] - Either "mainnet" or "testnet"
 * @param {String} [compressed] - If the private key is compressed
 * @returns {Privkey} A new valid instance of Privkey
 */
Privkey.fromRandom = function(network, compressed) {
  var bn = Privkey._getRandomBN();
  return new Privkey(bn, network, compressed);
};

/**
 *
 * Instantiate a Privkey from a WIF string
 *
 * @param {String} str - The WIF encoded private key string
 * @returns {Privkey} A new valid instance of Privkey
 */
Privkey.fromString = function(str) {
  var info = Privkey._transformWIF(str);
  return new Privkey(info.bn, info.network, info.compressed);
};

/**
 *
 * Check if there would be any errors when initializing a Privkey
 *
 * @param {String} data - The encoded data in various formats
 * @param {String} [network] - Either "mainnet" or "testnet"
 * @param {String} [compressed] - If the private key is compressed
 * @returns {null|Error} An error if exists
 */

Privkey.getValidationError = function(data, network, compressed) {
  var error;
  try {
    new Privkey(data, network, compressed);
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
Privkey.isValid = function(data, network, compressed){
  return !Privkey.getValidationError(data, network, compressed);
};

/**
 *
 * Will output the Privkey to a WIF string
 *
 * @returns {String} A WIP representation of the private key
 */
Privkey.prototype.toWIF = function() {
  var network = this.network;
  var compressed = this.compressed;

  var buf;
  if (compressed) {
    buf = Buffer.concat([new Buffer([networks[network].privkey]), 
                         this.bn.toBuffer({size: 32}), 
                         new Buffer([0x01])]);
  } else {
    buf = Buffer.concat([new Buffer([networks[network].privkey]), 
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
Privkey.prototype.toBigNumber = function(){
  return this.bn;
};

/**
 *
 * Will return the private key as a BN buffer
 *
 * @returns {Buffer} A buffer of the private key
 */
Privkey.prototype.toBuffer = function(){
  return this.bn.toBuffer();
};

/**
 *
 * Will return the corresponding public key
 *
 * @returns {Pubkey} A public key generated from the private key
 */
Privkey.prototype.toPubkey = function(){
  return Pubkey.fromPrivkey(this);
};

/**
 *
 * Will return an address for the private key
 *
 * @returns {Address} An address generated from the private key
 */
Privkey.prototype.toAddress = function() {
  var pubkey = this.toPubkey();
  return Address.fromPubkey(pubkey, this.network);
};

/**
 *
 * Will output the Privkey to a WIF string
 *
 * @returns {String} A WIF representation of the private key
 */
Privkey.prototype.toJSON = function() {
  return this.toString();
};

/**
 *
 * Will output the Privkey to a WIF string
 *
 * @returns {String} A WIF representation of the private key
 */
Privkey.prototype.toString = function() {
  return this.toWIF();
};

/**
 *
 * Will return a string formatted for the console
 *
 * @returns {String} Private key
 */
Privkey.prototype.inspect = function() {
  return '<Privkey: ' + this.toString() + ', compressed: '+this.compressed+', network: '+this.network+'>';
};

module.exports = Privkey;
