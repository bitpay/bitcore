'use strict';

// 90.2% typed (by google's closure-compiler account)

var preconditions = require('preconditions').singleton();
var _ = require('lodash');

/**
 * @namespace
 * @desc
 * HDPath contains helper functions to handle BIP32 branches as
 * Copay uses them.
 * Based on https://github.com/maraoz/bips/blob/master/bip-NNNN.mediawiki
 * <pre>
 * m / purpose' / copayerIndex / change:boolean / addressIndex
 * </pre>
 */
var HDPath = {};

/**
 * @desc Copay's BIP45 purpose code
 * @const
 * @type number
 */
HDPath.PURPOSE = 45;

/**
 * @desc Maximum number for non-hardened values (BIP32)
 * @const
 * @type number
 */
HDPath.MAX_NON_HARDENED = 0x80000000 - 1;

/**
 * @desc Shared Index: used for creating addresses for no particular purpose
 * @const
 * @type number
 */
HDPath.SHARED_INDEX = HDPath.MAX_NON_HARDENED - 0;

/**
 * @desc ???
 * @const
 * @type number
 */
HDPath.ID_INDEX = HDPath.MAX_NON_HARDENED - 1;

/**
 * @desc BIP45 prefix for COPAY
 * @const
 * @type string
 */
HDPath.BIP45_PUBLIC_PREFIX = 'm/' + HDPath.PURPOSE + '\'';

/**
 * @desc Retrieve a string to be used with bitcore representing a Copay branch
 * @param {number} addressIndex - the last value of the HD derivation
 * @param {boolean} isChange - whether this is a change address or a receive
 * @param {number} copayerIndex - the index of the copayer in the pubkeyring
 * @return {string} - the path for the HD derivation
 */
HDPath.Branch = function(addressIndex, isChange, copayerIndex) {
  preconditions.checkArgument(_.isNumber(addressIndex));
  preconditions.checkArgument(_.isBoolean(isChange));

  var ret = 'm/' +
    (typeof copayerIndex !== 'undefined' ? copayerIndex : HDPath.SHARED_INDEX) + '/' +
    (isChange ? 1 : 0) + '/' +
    addressIndex;
  return ret;
};

/**
 * @desc ???
 * @param {number} addressIndex - the last value of the HD derivation
 * @param {boolean} isChange - whether this is a change address or a receive
 * @param {number} copayerIndex - the index of the copayer in the pubkeyring
 * @return {string} - the path for the HD derivation
 */
HDPath.FullBranch = function(addressIndex, isChange, copayerIndex) {
  preconditions.checkArgument(_.isNumber(addressIndex));
  preconditions.checkArgument(_.isBoolean(isChange));

  var sub = HDPath.Branch(addressIndex, isChange, copayerIndex);
  sub = sub.substring(2);
  return HDPath.BIP45_PUBLIC_PREFIX + '/' + sub;
};

/**
 * @desc
 * Decompose a string and retrieve its arguments as if it where a Copay address.
 * @param {string} path - the HD path
 * @returns {Object} an object with three keys: addressIndex, isChange, and
 *                   copayerIndex
 */
HDPath.indexesForPath = function(path) {
  preconditions.checkArgument(_.isString(path));

  var s = path.split('/');
  return {
    isChange: s[3] === '1',
    addressIndex: parseInt(s[4], 10),
    copayerIndex: parseInt(s[2], 10)
  };
};

/**
 * @desc The ID for a shared branch
 */
HDPath.IdFullBranch = HDPath.FullBranch(0, false, HDPath.ID_INDEX);
/**
 * @desc Partial ID for a shared branch
 */
HDPath.IdBranch = HDPath.Branch(0, false, HDPath.ID_INDEX);

module.exports = HDPath;
