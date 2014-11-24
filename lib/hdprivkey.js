'use strict';

var _ = require('lodash');
var BN = require('./crypto/bn');
var Base58 = require('./encoding/base58');
var Base58Check = require('./encoding/base58check');
var Hash = require('./crypto/hash');
var Network = require('./network');
var Point = require('./crypto/point');
var PrivateKey = require('./privkey');

var assert = require('assert');
var buffer = require('buffer');
var util = require('./util');

function HDPrivateKey(arg) {
  if (arg) {
    if (_.isString(arg) || arg instanceof buffer.Buffer) {
      if (HDPrivateKey.isValidSerialized(arg)) {
        this._buildFromSerialized(arg);
      } else if (util.isValidJson(arg)) {
        this._buildFromJson(arg);
      } else {
        throw new Error(HDPrivateKey.Errors.UnrecognizedArgument);
      }
    } else {
      if (_.isObject(arg)) {
        this.buildFromObject(arg);
      } else {
        throw new Error(HDPrivateKey.Errors.UnrecognizedArgument);
      }
    }
  } else {
    this._generateRandomly();
  }
}

HDPrivateKey.prototype.derive = function(arg, hardened) {
  if (_.isNumber(arg)) {
    return this._deriveWithNumber(arg, hardened);
  } else if (_.isString(arg)) {
    return this._deriveFromString(arg);
  } else {
    throw new Error(HDPrivateKey.Errors.InvalidDerivationArgument);
  }
};

HDPrivateKey.prototype._deriveWithNumber = function deriveWithNumber(index, hardened) {
  if (index >= HDPrivateKey.Hardened) {
    hardened = true;
  }

  var indexBuffer = util.integerAsBuffer(index);
  var data;
  if (hardened) {
    data = Buffer.concat([new Buffer([0]), this.privateKey.toBuffer(), indexBuffer]);
  } else {
    data = Buffer.concat([this.publicKey.toBuffer(), indexBuffer]);
  }
  var hash = Hash.sha512hmac(data, this.chainCode);
  var leftPart = BN().fromBuffer(hash.slice(0, 32), {size: 32});
  var chainCode = hash.slice(32, 64);

  var privateKey = leftPart.add(this.privateKey.toBigNumber()).mod(Point.getN());

  return new HDPrivateKey({
    network: this.network,
    depth: this.depth + 1,
    parentFingerPrint: this.fingerPrint,
    childIndex: index,
    chainCode: chainCode,
    privateKey: privateKey
  });
};

HDPrivateKey.prototype._deriveFromString = function deriveFromString(path) {
  var steps = path.split('/');

  // Special cases:
  if (_.contains(HDPrivateKey.RootElementAlias, path)) {
    return this;
  }
  if (!_.contains(HDPrivateKey.RootElementAlias, steps[0])) {
    throw new Error(HDPrivateKey.Errors.InvalidPath);
  }
  steps = steps.slice(1);

  var result = this;
  for (var step in steps) {
    var index = parseInt(step);
    var hardened = step !== index.toString();
    result = result.derive(index, hardened);
  }
  return result;
};

HDPrivateKey.prototype._buildFromJson = function buildFromJson(arg) {
  return this._buildFromObject(JSON.parse(arg));
};

HDPrivateKey.prototype._buildFromSerialized = function buildFromSerialized(arg) {
  var decoded = Base58Check.decode(arg);
  var buffers = {
    version: decoded.slice(HDPrivateKey.VersionStart, HDPrivateKey.VersionEnd),
    depth: decoded.slice(HDPrivateKey.DepthStart, HDPrivateKey.DepthEnd),
    parentFingerPrint: decoded.slice(HDPrivateKey.ParentFingerPrintStart,
                                     HDPrivateKey.ParentFingerPrintEnd),
    childIndex: decoded.slice(HDPrivateKey.ChildIndexStart, HDPrivateKey.ChildIndexEnd),
    chainCode: decoded.slice(HDPrivateKey.ChainCodeStart, HDPrivateKey.ChainCodeEnd),
    privateKey: decoded.slice(HDPrivateKey.PrivateKeyStart, HDPrivateKey.PrivateKeyEnd),
    checksum: decoded.slice(HDPrivateKey.ChecksumStart, HDPrivateKey.ChecksumEnd),
    xprivkey: decoded
  };
  return this._buildFromBuffers(buffers);
};

HDPrivateKey.prototype._generateRandomly = function generateRandomly() {
};

/**
 * Receives a object with buffers in all the properties and populates the
 * internal structure
 *
 * @param {Object} arg
 * @param {Buffer} arg.version
 * @param {Buffer} arg.depth
 * @param {Buffer} arg.parentFingerPrint
 * @param {Buffer} arg.childIndex
 * @param {Buffer} arg.chainCode
 * @param {Buffer} arg.privateKey
 * @param {Buffer} arg.checksum
 * @param {string=} arg.xprivkey - if set, don't recalculate the base58
 *      representation
 * @return {HDPrivateKey} this
 */
HDPrivateKey.prototype._buildFromBuffers = function buildFromObject(arg) {

  HDPrivateKey._validateBufferArguments(arg);
  this._buffers = arg;

  if (!arg.xprivkey) {
    var sequence = [
      arg.version, arg.depth, arg.parentFingerPrint, arg.childIndex, arg.chainCode,
      util.emptyBuffer(1), arg.privateKey,
      arg.checksum
    ];
    this.xprivkey = Base58.encode(Buffer.concat(sequence));
  } else {
    this.xprivkey = arg.xprivkey;
  }

  // TODO:
  //  * Instantiate associated HDPublicKey

  this.privateKey = new PrivateKey(arg.privateKey);
  this.publicKey = this.privateKey.publicKey;
  this.fingerPrint = Base58Check.checksum(this.publicKey._value);

  return this;
};

HDPrivateKey._validateBufferArguments = function validateBufferArguments(arg) {
  var checkBuffer = function(name, size) {
    var buffer = arg[name];
    assert(buffer instanceof buffer.Buffer, name + ' argument is not a buffer');
    assert(
      buffer.length === size,
      name + ' has not the expected size: found ' + buffer.length + ', expected ' + size
    );
  };
  checkBuffer('version', HDPrivateKey.VersionSize);
  checkBuffer('depth', HDPrivateKey.DepthLength);
  checkBuffer('parentFingerPrint', HDPrivateKey.ParentFingerPrintSize);
  checkBuffer('childIndex', HDPrivateKey.ChildIndexSize);
  checkBuffer('chainCode', HDPrivateKey.ChainCodeSize);
  checkBuffer('privateKey', HDPrivateKey.PrivateKeySize);
  checkBuffer('checksum', HDPrivateKey.CheckSumSize);
};

HDPrivateKey.prototype.toString = function toString() {
  return this.xprivkey;
};

HDPrivateKey.prototype.toObject = function tObject() {
  return {
    network: Network.get(util.integerFromBuffer(this._buffers.version)),
    depth: util.integerFromBuffer(this._buffers.depth),
    fingerPrint: this.fingerPrint,
    parentFingerPrint: util.integerFromBuffer(this._buffers.parentFingerPrint),
    childIndex: util.integerFromBuffer(this._buffers.childIndex),
    chainCode: util.bufferToHex(this._buffers.chainCode),
    privateKey: this.privateKey.toString(),
    checksum: util.integerFromBuffer(this._buffers.checksum),
    xprivkey: this.xprivkey
  };
};

HDPrivateKey.prototype.toJson = function toJson() {
  return JSON.stringify(this.toObject());
};

HDPrivateKey.VersionSize = 4;
HDPrivateKey.DepthLength = 4;
HDPrivateKey.ParentFingerPrintSize = 4;
HDPrivateKey.ChildIndexSize = 4;
HDPrivateKey.ChainCodeSize = 32;
HDPrivateKey.PrivateKeySize = 32;
HDPrivateKey.CheckSumSize = 4;

HDPrivateKey.DefaultDepth = 0;
HDPrivateKey.DefaultFingerprint = 0;
HDPrivateKey.DefaultChildIndex = 0;
HDPrivateKey.DefaultNetwork = Network.livenet;
HDPrivateKey.Hardened = 0x80000000;
HDPrivateKey.RootElementAlias = ['m', 'M', 'm\'', 'M\''];

HDPrivateKey.VersionStart = 0;
HDPrivateKey.VersionEnd = HDPrivateKey.DepthStart = 4;
HDPrivateKey.DepthEnd = HDPrivateKey.ParentFingerPrintStart = 8;
HDPrivateKey.ParentFingerPrintEnd = HDPrivateKey.ChildIndexStart = 12;
HDPrivateKey.ChildIndexEnd = HDPrivateKey.ChainCodeStart = 16;
HDPrivateKey.ChainCodeEnd = 32;
HDPrivateKey.PrivateKeyStart = 33;
HDPrivateKey.PrivateKeyEnd = HDPrivateKey.ChecksumStart = 65;
HDPrivateKey.ChecksumEnd = 69;

HDPrivateKey.Errors = {};
HDPrivateKey.Errors.InvalidArgument = 'Invalid argument, expected string or Buffer';
HDPrivateKey.Errors.InvalidB58Char = 'Invalid Base 58 character';
HDPrivateKey.Errors.InvalidB58Checksum = 'Invalid Base 58 checksum';
HDPrivateKey.Errors.InvalidChildIndex = 'Invalid Child Index - must be a number';
HDPrivateKey.Errors.InvalidConstant = 'Unrecognized xprivkey version';
HDPrivateKey.Errors.InvalidDepth = 'Invalid depth parameter - must be a number';
HDPrivateKey.Errors.InvalidDerivationArgument = 'Invalid argument, expected number and boolean or string';
HDPrivateKey.Errors.InvalidLength = 'Invalid length for xprivkey format';
HDPrivateKey.Errors.InvalidNetwork = 'Unexpected version for network';
HDPrivateKey.Errors.InvalidNetworkArgument = 'Network argument must be \'livenet\' or \'testnet\'';
HDPrivateKey.Errors.InvalidParentFingerPrint = 'Invalid Parent Fingerprint - must be a number';
HDPrivateKey.Errors.InvalidPath = 'Invalid path for derivation: must start with "m"';
HDPrivateKey.Errors.UnrecognizedArgument = 'Creating a HDPrivateKey requires a string, a buffer, a json, or an object';

/**
 * Verifies that a given serialized private key in base58 with checksum format
 * is valid.
 *
 * @param {string|Buffer} data - the serialized private key
 * @param {string|Network=} network - optional, if present, checks that the
 *     network provided matches the network serialized.
 * @return {boolean}
 */
HDPrivateKey.isValidSerialized = function isValidSerialized(data, network) {
  return !HDPrivateKey.geSerializedError(data, network);
};

/**
 * Checks what's the error that causes the validation of a serialized private key
 * in base58 with checksum to fail.
 *
 * @param {string|Buffer} data - the serialized private key
 * @param {string|Network=} network - optional, if present, checks that the
 *     network provided matches the network serialized.
 * @return {HDPrivateKey.Errors|null}
 */
HDPrivateKey.getSerializedError = function getSerializedError(data, network) {
  if (!(_.isString(data) || data instanceof buffer.Buffer)) {
    return HDPrivateKey.Errors.InvalidArgument;
  }
  if (_.isString(data)) {
    data = new Buffer(data);
  }
  if (!Base58.validCharacters(data)) {
    return HDPrivateKey.Errors.InvalidB58Char;
  }
  if (!Base58Check.validChecksum(data)) {
    return HDPrivateKey.Errors.InvalidB58Checksum;
  }
  if (data.length !== 78) {
    return HDPrivateKey.Errors.InvalidLength;
  }
  if (!_.isUndefined(network)) {
    network = Network.get(network);
    if (!network) {
      return HDPrivateKey.Errors.InvalidNetworkArgument;
    }
    var version = data.slice(4);
    if (version.toString() !== network.xprivkey.toString()) {
      return HDPrivateKey.Errors.InvalidNetwork;
    }
  }
  return null;
};

module.exports = HDPrivateKey;
