'use strict';

var _ = require('lodash');

var bitcore = require('bitcore');

var Base58 = bitcore.encoding.Base58;
var Base58Check = bitcore.encoding.Base58Check;
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var preconditions = bitcore.util.preconditions;

var PublicKey = bitcore.PublicKey;
var Networks = bitcore.Networks;


function StealthAddress(scanKey, spendKeys, signatures) {
  if (!(this instanceof StealthAddress)) {
    return new StealthAddress(scanKey, spendKeys, signatures);
  }

  if (spendKeys instanceof StealthAddress) {
    return spendKeys;
  }

  var info = this._classifyArguments(scanKey, spendKeys, signatures);

  if (info.signatures != 1 && info.signatures > info.spendKeys.length) {
    throw new Error('Invalid number of required signatures');
  }

  Object.defineProperty(this, 'network', {
    configurable: false,
    value: info.network
  });

  Object.defineProperty(this, 'reuseScan', {
    configurable: false,
    value: !!info.options
  });

  Object.defineProperty(this, 'scanKey', {
    configurable: false,
    value: info.scanKey
  });

  Object.defineProperty(this, 'spendKeys', {
    configurable: false,
    value: info.spendKeys
  });

  Object.defineProperty(this, 'signatures', {
    configurable: false,
    value: info.signatures
  });

  Object.defineProperty(this, 'prefix', {
    configurable: false,
    value: info.prefix
  });

}

/**
 * Internal function used to split different kinds of arguments of the constructor
 */
StealthAddress.prototype._classifyArguments = function(scanKey, spendKeys, signatures) {
  preconditions.checkArgument(scanKey);

  // Parse address string
  var isBase58 = _.isString(scanKey) && Base58.validCharacters(scanKey);
  if (isBase58 && !(spendKeys || signatures)) {
    return this._fromString(scanKey);
  }

  // Build stealth address info
  var info = {};
  info.scanKey = new PublicKey(scanKey);
  info.network = info.scanKey.network || Networks.livenet;
  info.options = spendKeys ? 0 : 1; // reuseScan
 
  spendKeys = spendKeys ? [].concat(spendKeys) : [];
  info.spendKeys = spendKeys.map(PublicKey);

  info.signatures = signatures || info.spendKeys.length || 1;
  info.prefix = '';

  return info;
};


StealthAddress.prototype._fromString = function(address) {
  var buffer = Base58Check(address).toBuffer();
  return this._fromBuffer(buffer);
};

StealthAddress.prototype._fromBuffer = function(buffer) {
  var reader = new BufferReader(buffer);
  var info = {};

  var version = reader.readUInt8();
  if (version != 42 && version != 43) {
    throw new Error('Invalid version number');
  }

  info.network = version == 42 ? Networks.livenet : Networks.testnet;
  info.options = reader.readUInt8();

  info.scanKey = PublicKey.fromBuffer(reader.read(33));
  var spendKeys = reader.readUInt8();
  info.spendKeys = [];
  for (var i = 0; i < spendKeys; i++) {
    info.spendKeys.push(PublicKey.fromBuffer(reader.read(33)));
  }

  info.signatures = reader.readUInt8();

  var prefix = reader.readUInt8();
  info.prefix = reader.read(prefix / 8).toString('hex');
  return info;
};

/**
 * Will return a buffer representation of the stealth address
 *
 * @returns {Buffer} stealth address buffer
 */
StealthAddress.prototype.toBuffer = function() {
  var version = this.network == Networks.livenet ? 42 : 43;

  var writer = new BufferWriter();
  writer.writeUInt8(version);

  var options = this.reuseScan ? 1 : 0;
  writer.writeUInt8(options);
  writer.write(this.scanKey.toBuffer());

  writer.writeUInt8(this.spendKeys.length);
  for (var i = 0; i < this.spendKeys.length; i++) {
    var spendKey = this.spendKeys[i];
    writer.write(spendKey.toBuffer());
  }
  writer.writeUInt8(this.signatures);
  writer.writeUInt8(this.prefix.length);
  writer.write(new Buffer(this.prefix, 'hex'));
  return writer.concat();
};

/**
 * @returns {Object} A plain object with the stealth address information
 */
StealthAddress.prototype.toObject = function toObject() {
  return {
    network: this.network.toString(),
    options: this.options,
    scanKey: this.scanKey,
    spendKeys: this.spendKeys,
    signatures: this.signatures,
    prefix: prefix
  };
};

/**
 * @returns {String} A JSON representation of a plain object with the stealth address information
 */
StealthAddress.prototype.toJSON = function toJSON() {
  return JSON.stringify(this.toObject());
};

/**
 * Will return a the string representation of the stealth address
 *
 * @returns {String} Stealth address
 */
StealthAddress.prototype.toString = function() {
  return Base58Check.encode(this.toBuffer());
};

/**
 * Will return a string formatted for the console
 *
 * @returns {String} Stealth address
 */
StealthAddress.prototype.inspect = function() {
  return '<Stealth Address: ' + this.toString() + ', network: ' + this.network + '>';
};

module.exports = StealthAddress;
