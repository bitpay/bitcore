'use strict';

var _ = require('lodash');
var BN = require('./crypto/bn');
var Base58 = require('./encoding/base58');
var Base58Check = require('./encoding/base58check');
var Hash = require('./crypto/hash');
var HDPrivateKey = require('./hdprivatekey');
var HDKeyCache = require('./hdkeycache');
var Network = require('./networks');
var Point = require('./crypto/point');
var PublicKey = require('./publickey');

var assert = require('assert');

var jsUtil = require('./util/js');
var bufferUtil = require('./util/buffer');

/**
 * The representation of an hierarchically derived public key.
 *
 * See https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
 *
 * @constructor
 * @param {Object|string|Buffer} arg
 */
function HDPublicKey(arg) {
  /* jshint maxcomplexity: 12 */
  /* jshint maxstatements: 20 */
  if (arg instanceof HDPublicKey) {
    return arg;
  }
  if (!(this instanceof HDPublicKey)) {
    return new HDPublicKey(arg);
  }
  if (arg) {
    if (_.isString(arg) || bufferUtil.isBuffer(arg)) {
      if (HDPublicKey.isValidSerialized(arg)) {
        return this._buildFromSerialized(arg);
      } else if (jsUtil.isValidJson(arg)) {
        return this._buildFromJson(arg);
      } else {
        var error = HDPublicKey.getSerializedError(arg);
        if (error === HDPublicKey.Errors.ArgumentIsPrivateExtended) {
          return new HDPrivateKey(arg).hdPublicKey;
        }
        throw new Error(error);
      }
    } else {
      if (_.isObject(arg)) {
        if (arg instanceof HDPrivateKey) {
          return this._buildFromPrivate(arg);
        } else {
          return this._buildFromObject(arg);
        }
      } else {
        throw new Error(HDPublicKey.Errors.UnrecognizedArgument);
      }
    }
  } else {
    throw new Error(HDPublicKey.Errors.MustSupplyArgument);
  }
}

/**
 * Get a derivated child based on a string or number.
 *
 * If the first argument is a string, it's parsed as the full path of
 * derivation. Valid values for this argument include "m" (which returns the
 * same private key), "m/0/1/40/2/1000".
 *
 * Note that hardened keys can't be derived from a public extended key.
 *
 * If the first argument is a number, the child with that index will be
 * derived. See the example usage for clarification.
 *
 * @example
 * var parent = new HDPublicKey('xpub...');
 * var child_0_1_2 = parent.derive(0).derive(1).derive(2);
 * var copy_of_child_0_1_2 = parent.derive("m/0/1/2");
 * assert(child_0_1_2.xprivkey === copy_of_child_0_1_2);
 *
 * @param {string|number} arg
 * @param {boolean?} hardened
 */
HDPublicKey.prototype.derive = function (arg, hardened) {
  if (_.isNumber(arg)) {
    return this._deriveWithNumber(arg, hardened);
  } else if (_.isString(arg)) {
    return this._deriveFromString(arg);
  } else {
    throw new Error(HDPublicKey.Errors.InvalidDerivationArgument);
  }
};

HDPublicKey.prototype._deriveWithNumber = function (index, hardened) {
  if (hardened || index >= HDPublicKey.Hardened) {
    throw new Error(HDPublicKey.Errors.InvalidIndexCantDeriveHardened);
  }
  var cached = HDKeyCache.get(this.xpubkey, index, hardened);
  if (cached) {
    return cached;
  }

  var indexBuffer = bufferUtil.integerAsBuffer(index);
  var data = bufferUtil.concat([this.publicKey.toBuffer(), indexBuffer]);
  var hash = Hash.sha512hmac(data, this._buffers.chainCode);
  var leftPart = BN().fromBuffer(hash.slice(0, 32), {size: 32});
  var chainCode = hash.slice(32, 64);

  var publicKey = PublicKey.fromPoint(Point.getG().mul(leftPart).add(this.publicKey.point));

  var derived = new HDPublicKey({
    network: this.network,
    depth: this.depth + 1,
    parentFingerPrint: this.fingerPrint,
    childIndex: index,
    chainCode: chainCode,
    publicKey: publicKey
  });
  HDKeyCache.set(this.xpubkey, index, hardened, derived);
  return derived;
};

HDPublicKey.prototype._deriveFromString = function (path) {
  /* jshint maxcomplexity: 8 */
  var steps = path.split('/');

  // Special cases:
  if (_.contains(HDPublicKey.RootElementAlias, path)) {
    return this;
  }
  if (!_.contains(HDPublicKey.RootElementAlias, steps[0])) {
    throw new Error(HDPublicKey.Errors.InvalidPath);
  }
  steps = steps.slice(1);

  var result = this;
  for (var step in steps) {
    var index = parseInt(steps[step]);
    var hardened = steps[step] !== index.toString();
    result = result._deriveWithNumber(index, hardened);
  }
  return result;
};

/**
 * Verifies that a given serialized private key in base58 with checksum format
 * is valid.
 *
 * @param {string|Buffer} data - the serialized private key
 * @param {string|Network=} network - optional, if present, checks that the
 *     network provided matches the network serialized.
 * @return {boolean}
 */
HDPublicKey.isValidSerialized = function (data, network) {
  return !HDPublicKey.getSerializedError(data, network);
};

/**
 * Checks what's the error that causes the validation of a serialized private key
 * in base58 with checksum to fail.
 *
 * @param {string|Buffer} data - the serialized private key
 * @param {string|Network=} network - optional, if present, checks that the
 *     network provided matches the network serialized.
 * @return {HDPublicKey.Errors|null}
 */
HDPublicKey.getSerializedError = function (data, network) {
  /* jshint maxcomplexity: 10 */
  /* jshint maxstatements: 20 */
  if (!(_.isString(data) || bufferUtil.isBuffer(data))) {
    return HDPublicKey.Errors.InvalidArgument;
  }
  if (!Base58.validCharacters(data)) {
    return HDPublicKey.Errors.InvalidB58Char;
  }
  try {
    data = Base58Check.decode(data);
  } catch (e) {
    return HDPublicKey.Errors.InvalidB58Checksum;
  }
  if (data.length !== 78) {
    return HDPublicKey.Errors.InvalidLength;
  }
  if (!_.isUndefined(network)) {
    var error = HDPublicKey._validateNetwork(data, network);
    if (error) {
      return error;
    }
  }
  network = Network.get(network) || Network.defaultNetwork;
  if (bufferUtil.integerFromBuffer(data.slice(0, 4)) === network.xprivkey) {
    return HDPublicKey.Errors.ArgumentIsPrivateExtended;
  }
  return null;
};

HDPublicKey._validateNetwork = function (data, network) {
  network = Network.get(network);
  if (!network) {
    return HDPublicKey.Errors.InvalidNetworkArgument;
  }
  var version = data.slice(HDPublicKey.VersionStart, HDPublicKey.VersionEnd);
  if (bufferUtil.integerFromBuffer(version) !== network.xpubkey) {
    return HDPublicKey.Errors.InvalidNetwork;
  }
  return null;
};

HDPublicKey.prototype._buildFromJson = function (arg) {
  return this._buildFromObject(JSON.parse(arg));
};

HDPublicKey.prototype._buildFromPrivate = function (arg) {
  var args = _.clone(arg._buffers);
  var point = Point.getG().mul(BN().fromBuffer(args.privateKey));
  args.publicKey = Point.pointToCompressed(point);
  args.version = bufferUtil.integerAsBuffer(Network.get(bufferUtil.integerFromBuffer(args.version)).xpubkey);
  args.privateKey = undefined;
  args.checksum = undefined;
  args.xprivkey = undefined;
  return this._buildFromBuffers(args);
};

HDPublicKey.prototype._buildFromObject = function (arg) {
  /* jshint maxcomplexity: 10 */
  // TODO: Type validation
  var buffers = {
    version: arg.network ? bufferUtil.integerAsBuffer(Network.get(arg.network).xpubkey) : arg.version,
    depth: bufferUtil.integerAsSingleByteBuffer(arg.depth),
    parentFingerPrint: _.isNumber(arg.parentFingerPrint) ? bufferUtil.integerAsBuffer(arg.parentFingerPrint) : arg.parentFingerPrint,
    childIndex: bufferUtil.integerAsBuffer(arg.childIndex),
    chainCode: _.isString(arg.chainCode) ? bufferUtil.hexToBuffer(arg.chainCode) : arg.chainCode,
    publicKey: _.isString(arg.publicKey) ? bufferUtil.hexToBuffer(arg.publicKey) :
      bufferUtil.isBuffer(arg.publicKey) ? arg.publicKey : arg.publicKey.toBuffer(),
    checksum: _.isNumber(arg.checksum) ? bufferUtil.integerAsBuffer(arg.checksum) : arg.checksum
  };
  return this._buildFromBuffers(buffers);
};

HDPublicKey.prototype._buildFromSerialized = function (arg) {
  var decoded = Base58Check.decode(arg);
  var buffers = {
    version: decoded.slice(HDPublicKey.VersionStart, HDPublicKey.VersionEnd),
    depth: decoded.slice(HDPublicKey.DepthStart, HDPublicKey.DepthEnd),
    parentFingerPrint: decoded.slice(HDPublicKey.ParentFingerPrintStart,
                                     HDPublicKey.ParentFingerPrintEnd),
    childIndex: decoded.slice(HDPublicKey.ChildIndexStart, HDPublicKey.ChildIndexEnd),
    chainCode: decoded.slice(HDPublicKey.ChainCodeStart, HDPublicKey.ChainCodeEnd),
    publicKey: decoded.slice(HDPublicKey.PublicKeyStart, HDPublicKey.PublicKeyEnd),
    checksum: decoded.slice(HDPublicKey.ChecksumStart, HDPublicKey.ChecksumEnd),
    xpubkey: arg
  };
  return this._buildFromBuffers(buffers);
};

/**
 * Receives a object with buffers in all the properties and populates the
 * internal structure
 *
 * @param {Object} arg
 * @param {buffer.Buffer} arg.version
 * @param {buffer.Buffer} arg.depth
 * @param {buffer.Buffer} arg.parentFingerPrint
 * @param {buffer.Buffer} arg.childIndex
 * @param {buffer.Buffer} arg.chainCode
 * @param {buffer.Buffer} arg.publicKey
 * @param {buffer.Buffer} arg.checksum
 * @param {string=} arg.xpubkey - if set, don't recalculate the base58
 *      representation
 * @return {HDPublicKey} this
 */
HDPublicKey.prototype._buildFromBuffers = function (arg) {
  /* jshint maxcomplexity: 8 */
  /* jshint maxstatements: 20 */

  HDPublicKey._validateBufferArguments(arg);
  this._buffers = arg;

  var sequence = [
    arg.version, arg.depth, arg.parentFingerPrint, arg.childIndex, arg.chainCode,
    arg.publicKey
  ];
  var concat = bufferUtil.concat(sequence);
  var checksum = Base58Check.checksum(concat);
  if (!arg.checksum || !arg.checksum.length) {
    arg.checksum = checksum;
  } else {
    if (arg.checksum.toString('hex') !== checksum.toString('hex')) {
      throw new Error(HDPublicKey.Errors.InvalidB58Checksum);
    }
  }

  if (!arg.xpubkey) {
    this.xpubkey = Base58Check.encode(bufferUtil.concat(sequence));
  } else {
    this.xpubkey = arg.xpubkey;
  }

  this.network = Network.get(bufferUtil.integerFromBuffer(arg.version));
  this.depth = bufferUtil.integerFromSingleByteBuffer(arg.depth);
  this.publicKey = PublicKey.fromString(arg.publicKey);
  this.fingerPrint = Hash.sha256ripemd160(this.publicKey.toBuffer()).slice(0, HDPublicKey.ParentFingerPrintSize);

  return this;
};

HDPublicKey._validateBufferArguments = function (arg) {
  var checkBuffer = function(name, size) {
    var buff = arg[name];
    assert(bufferUtil.isBuffer(buff), name + ' argument is not a buffer, it\'s ' + typeof buff);
    assert(
      buff.length === size,
      name + ' has not the expected size: found ' + buff.length + ', expected ' + size
    );
  };
  checkBuffer('version', HDPublicKey.VersionSize);
  checkBuffer('depth', HDPublicKey.DepthSize);
  checkBuffer('parentFingerPrint', HDPublicKey.ParentFingerPrintSize);
  checkBuffer('childIndex', HDPublicKey.ChildIndexSize);
  checkBuffer('chainCode', HDPublicKey.ChainCodeSize);
  checkBuffer('publicKey', HDPublicKey.PublicKeySize);
  if (arg.checksum && arg.checksum.length) {
    checkBuffer('checksum', HDPublicKey.CheckSumSize);
  }
};

/**
 * Returns the base58 checked representation of the public key
 * @return {string} a string starting with "xpub..." in livenet
 */
HDPublicKey.prototype.toString = function () {
  return this.xpubkey;
};

/**
 * Returns a plain javascript object with information to reconstruct a key.
 *
 * Fields are:
 *  * network: 'livenet' or 'testnet'
 *  * depth: a number from 0 to 255, the depth to the master extended key
 *  * fingerPrint: a number of 32 bits taken from the hash of the public key
 *  * fingerPrint: a number of 32 bits taken from the hash of this key's
 *        parent's public key
 *  * childIndex: index with which this key was derived
 *  * chainCode: string in hexa encoding used for derivation
 *  * publicKey: string, hexa encoded, in compressed key format
 *  * checksum: bufferUtil.integerFromBuffer(this._buffers.checksum),
 *  * xpubkey: the string with the base58 representation of this extended key
 *  * checksum: the base58 checksum of xpubkey
 */
HDPublicKey.prototype.toObject = function () {
  return {
    network: Network.get(bufferUtil.integerFromBuffer(this._buffers.version)).name,
    depth: bufferUtil.integerFromSingleByteBuffer(this._buffers.depth),
    fingerPrint: bufferUtil.integerFromBuffer(this.fingerPrint),
    parentFingerPrint: bufferUtil.integerFromBuffer(this._buffers.parentFingerPrint),
    childIndex: bufferUtil.integerFromBuffer(this._buffers.childIndex),
    chainCode: bufferUtil.bufferToHex(this._buffers.chainCode),
    publicKey: this.publicKey.toString(),
    checksum: bufferUtil.integerFromBuffer(this._buffers.checksum),
    xpubkey: this.xpubkey
  };
};

/**
 * Returns the JSON representation of this key's <tt>toObject</tt> result
 *
 * @see {HDPublicKey#toObject}
 * @return {string}
 */
HDPublicKey.prototype.toJson = function () {
  return JSON.stringify(this.toObject());
};

HDPublicKey.Hardened = 0x80000000;
HDPublicKey.RootElementAlias = ['m', 'M'];

HDPublicKey.VersionSize = 4;
HDPublicKey.DepthSize = 1;
HDPublicKey.ParentFingerPrintSize = 4;
HDPublicKey.ChildIndexSize = 4;
HDPublicKey.ChainCodeSize = 32;
HDPublicKey.PublicKeySize = 33;
HDPublicKey.CheckSumSize = 4;

HDPublicKey.SerializedByteSize = 82;

HDPublicKey.VersionStart           = 0;
HDPublicKey.VersionEnd             = HDPublicKey.VersionStart + HDPublicKey.VersionSize;
HDPublicKey.DepthStart             = HDPublicKey.VersionEnd;
HDPublicKey.DepthEnd               = HDPublicKey.DepthStart + HDPublicKey.DepthSize;
HDPublicKey.ParentFingerPrintStart = HDPublicKey.DepthEnd;
HDPublicKey.ParentFingerPrintEnd   = HDPublicKey.ParentFingerPrintStart + HDPublicKey.ParentFingerPrintSize;
HDPublicKey.ChildIndexStart        = HDPublicKey.ParentFingerPrintEnd;
HDPublicKey.ChildIndexEnd          = HDPublicKey.ChildIndexStart + HDPublicKey.ChildIndexSize;
HDPublicKey.ChainCodeStart         = HDPublicKey.ChildIndexEnd;
HDPublicKey.ChainCodeEnd           = HDPublicKey.ChainCodeStart + HDPublicKey.ChainCodeSize;
HDPublicKey.PublicKeyStart         = HDPublicKey.ChainCodeEnd;
HDPublicKey.PublicKeyEnd           = HDPublicKey.PublicKeyStart + HDPublicKey.PublicKeySize;
HDPublicKey.ChecksumStart          = HDPublicKey.PublicKeyEnd;
HDPublicKey.ChecksumEnd            = HDPublicKey.ChecksumStart + HDPublicKey.CheckSumSize;

assert(HDPublicKey.ChecksumEnd === HDPublicKey.SerializedByteSize);

HDPublicKey.Errors = {};
HDPublicKey.Errors.ArgumentIsPrivateExtended = 'Argument starts with xpriv..., it\'s a private key';
HDPublicKey.Errors.InvalidArgument = 'Invalid argument, expected string or Buffer';
HDPublicKey.Errors.InvalidB58Char = 'Invalid Base 58 character';
HDPublicKey.Errors.InvalidB58Checksum = 'Invalid Base 58 checksum';
HDPublicKey.Errors.InvalidChildIndex = 'Invalid Child Index - must be a number';
HDPublicKey.Errors.InvalidConstant = 'Unrecognized xpubkey version';
HDPublicKey.Errors.InvalidDepth = 'Invalid depth parameter - must be a number';
HDPublicKey.Errors.InvalidDerivationArgument = 'Invalid argument, expected number and boolean or string';
HDPublicKey.Errors.InvalidEntropyArg = 'Invalid argument: entropy must be an hexa string or binary buffer';
HDPublicKey.Errors.InvalidLength = 'Invalid length for xpubkey format';
HDPublicKey.Errors.InvalidNetwork = 'Unexpected version for network';
HDPublicKey.Errors.InvalidNetworkArgument = 'Network argument must be \'livenet\' or \'testnet\'';
HDPublicKey.Errors.InvalidParentFingerPrint = 'Invalid Parent Fingerprint - must be a number';
HDPublicKey.Errors.InvalidPath = 'Invalid path for derivation: must start with "m"';
HDPublicKey.Errors.MustSupplyArgument = 'Must supply an argument for the constructor';
HDPublicKey.Errors.UnrecognizedArgument = 'Creating a HDPublicKey requires a string, a buffer, a json, or an object';

module.exports = HDPublicKey;

