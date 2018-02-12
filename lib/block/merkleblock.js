'use strict';

var _ = require('lodash');
var BlockHeader = require('./blockheader');
var BufferUtil = require('../util/buffer');
var BufferReader = require('../encoding/bufferreader');
var BufferWriter = require('../encoding/bufferwriter');
var Hash = require('../crypto/hash');
var JSUtil = require('../util/js');
var Transaction = require('../transaction');
var errors = require('../errors');
var $ = require('../util/preconditions');

/**
 * Instantiate a MerkleBlock from a Buffer, JSON object, or Object with
 * the properties of the Block
 *
 * @param {*} - A Buffer, JSON string, or Object representing a MerkleBlock
 * @returns {MerkleBlock}
 * @constructor
 */
function MerkleBlock(arg) {
  /* jshint maxstatements: 18 */

  if (!(this instanceof MerkleBlock)) {
    return new MerkleBlock(arg);
  }

  var info = {};
  if (BufferUtil.isBuffer(arg)) {
    info = MerkleBlock._fromBufferReader(BufferReader(arg));
  } else if (_.isObject(arg)) {
    var header;
    if(arg.header instanceof BlockHeader) {
      header = arg.header;
    } else {
      header = BlockHeader.fromObject(arg.header);
    }
    info = {
      /**
       * @name MerkleBlock#header
       * @type {BlockHeader}
       */
      header: header,
      /**
       * @name MerkleBlock#numTransactions
       * @type {Number}
       */
      numTransactions: arg.numTransactions,
      /**
       * @name MerkleBlock#hashes
       * @type {String[]}
       */
      hashes: arg.hashes,
      /**
       * @name MerkleBlock#flags
       * @type {Number[]}
       */
      flags: arg.flags
    };
  } else {
    throw new TypeError('Unrecognized argument for MerkleBlock');
  }
  _.extend(this,info);
  this._flagBitsUsed = 0;
  this._hashesUsed = 0;

  return this;
}

/**
 * @param {Buffer} - MerkleBlock data in a Buffer object
 * @returns {MerkleBlock} - A MerkleBlock object
 */
MerkleBlock.fromBuffer = function fromBuffer(buf) {
  return MerkleBlock.fromBufferReader(BufferReader(buf));
};

/**
 * @param {BufferReader} - MerkleBlock data in a BufferReader object
 * @returns {MerkleBlock} - A MerkleBlock object
 */
MerkleBlock.fromBufferReader = function fromBufferReader(br) {
  return new MerkleBlock(MerkleBlock._fromBufferReader(br));
};

/**
 * @returns {Buffer} - A buffer of the block
 */
MerkleBlock.prototype.toBuffer = function toBuffer() {
  return this.toBufferWriter().concat();
};

/**
 * @param {BufferWriter} - An existing instance of BufferWriter
 * @returns {BufferWriter} - An instance of BufferWriter representation of the MerkleBlock
 */
MerkleBlock.prototype.toBufferWriter = function toBufferWriter(bw) {
  if (!bw) {
    bw = new BufferWriter();
  }
  bw.write(this.header.toBuffer());
  bw.writeUInt32LE(this.numTransactions);
  bw.writeVarintNum(this.hashes.length);
  for (var i = 0; i < this.hashes.length; i++) {
    bw.write(Buffer.from(this.hashes[i], 'hex'));
  }
  bw.writeVarintNum(this.flags.length);
  for (i = 0; i < this.flags.length; i++) {
    bw.writeUInt8(this.flags[i]);
  }
  return bw;
};

/**
 * @returns {Object} - A plain object with the MerkleBlock properties
 */
MerkleBlock.prototype.toObject = MerkleBlock.prototype.toJSON = function toObject() {
  return {
    header: this.header.toObject(),
    numTransactions: this.numTransactions,
    hashes: this.hashes,
    flags: this.flags
  };
};

/**
 * Verify that the MerkleBlock is valid
 * @returns {Boolean} - True/False whether this MerkleBlock is Valid
 */
MerkleBlock.prototype.validMerkleTree = function validMerkleTree() {
  $.checkState(_.isArray(this.flags), 'MerkleBlock flags is not an array');
  $.checkState(_.isArray(this.hashes), 'MerkleBlock hashes is not an array');

  // Can't have more hashes than numTransactions
  if(this.hashes.length > this.numTransactions) {
    return false;
  }

  // Can't have more flag bits than num hashes
  if(this.flags.length * 8 < this.hashes.length) {
    return false;
  }

  var height = this._calcTreeHeight();
  var opts = { hashesUsed: 0, flagBitsUsed: 0 };
  var root = this._traverseMerkleTree(height, 0, opts);
  if(opts.hashesUsed !== this.hashes.length) {
    return false;
  }
  return BufferUtil.equals(root, this.header.merkleRoot);
};

/**
 * Return a list of all the txs hash that match the filter
 * @returns {Array} - txs hash that match the filter
 */
MerkleBlock.prototype.filterdTxsHash = function filterdTxsHash() {
  $.checkState(_.isArray(this.flags), 'MerkleBlock flags is not an array');
  $.checkState(_.isArray(this.hashes), 'MerkleBlock hashes is not an array');

  // Can't have more hashes than numTransactions
  if(this.hashes.length > this.numTransactions) {
    throw new errors.MerkleBlock.InvalidMerkleTree();
  }

  // Can't have more flag bits than num hashes
  if(this.flags.length * 8 < this.hashes.length) {
    throw new errors.MerkleBlock.InvalidMerkleTree();
  }

  // If there is only one hash the filter do not match any txs in the block
  if(this.hashes.length === 1) {
    return [];
  };

  var height = this._calcTreeHeight();
  var opts = { hashesUsed: 0, flagBitsUsed: 0 };
  var txs = this._traverseMerkleTree(height, 0, opts, true);
  if(opts.hashesUsed !== this.hashes.length) {
    throw new errors.MerkleBlock.InvalidMerkleTree();
  }
  return txs;
};

/**
 * Traverse a the tree in this MerkleBlock, validating it along the way
 * Modeled after Bitcoin Core merkleblock.cpp TraverseAndExtract()
 * @param {Number} - depth - Current height
 * @param {Number} - pos - Current position in the tree
 * @param {Object} - opts - Object with values that need to be mutated throughout the traversal
 * @param {Boolean} - checkForTxs - if true return opts.txs else return the Merkle Hash
 * @param {Number} - opts.flagBitsUsed - Number of flag bits used, should start at 0
 * @param {Number} - opts.hashesUsed - Number of hashes used, should start at 0
 * @param {Array} - opts.txs - Will finish populated by transactions found during traversal that match the filter
 * @returns {Buffer|null} - Buffer containing the Merkle Hash for that height
 * @returns {Array} - transactions found during traversal that match the filter
 * @private
 */
MerkleBlock.prototype._traverseMerkleTree = function traverseMerkleTree(depth, pos, opts, checkForTxs) {
  /* jshint maxcomplexity:  12*/
  /* jshint maxstatements: 20 */

  opts = opts || {};
  opts.txs = opts.txs || [];
  opts.flagBitsUsed = opts.flagBitsUsed || 0;
  opts.hashesUsed = opts.hashesUsed || 0;
  var checkForTxs = checkForTxs || false;

  if(opts.flagBitsUsed > this.flags.length * 8) {
    return null;
  }
  var isParentOfMatch = (this.flags[opts.flagBitsUsed >> 3] >>> (opts.flagBitsUsed++ & 7)) & 1;
  if(depth === 0 || !isParentOfMatch) {
    if(opts.hashesUsed >= this.hashes.length) {
      return null;
    }
    var hash = this.hashes[opts.hashesUsed++];
    if(depth === 0 && isParentOfMatch) {
      opts.txs.push(hash);
    }
    return Buffer.from(hash, 'hex');
  } else {
    var left = this._traverseMerkleTree(depth-1, pos*2, opts);
    var right = left;
    if(pos*2+1 < this._calcTreeWidth(depth-1)) {
      right = this._traverseMerkleTree(depth-1, pos*2+1, opts);
    }
    if (checkForTxs){
      return opts.txs;
    } else {
      return Hash.sha256sha256(new Buffer.concat([left, right]));
    };
  }
};

/** Calculates the width of a merkle tree at a given height.
 *  Modeled after Bitcoin Core merkleblock.h CalcTreeWidth()
 * @param {Number} - Height at which we want the tree width
 * @returns {Number} - Width of the tree at a given height
 * @private
 */
MerkleBlock.prototype._calcTreeWidth = function calcTreeWidth(height) {
  return (this.numTransactions + (1 << height) - 1) >> height;
};

/** Calculates the height of the merkle tree in this MerkleBlock
 * @param {Number} - Height at which we want the tree width
 * @returns {Number} - Height of the merkle tree in this MerkleBlock
 * @private
 */
MerkleBlock.prototype._calcTreeHeight = function calcTreeHeight() {
  var height = 0;
  while (this._calcTreeWidth(height) > 1) {
    height++;
  }
  return height;
};

/**
 * @param {Transaction|String} - Transaction or Transaction ID Hash
 * @returns {Boolean} - return true/false if this MerkleBlock has the TX or not
 * @private
 */
MerkleBlock.prototype.hasTransaction = function hasTransaction(tx) {
  $.checkArgument(!_.isUndefined(tx), 'tx cannot be undefined');
  $.checkArgument(tx instanceof Transaction || typeof tx === 'string',
      'Invalid tx given, tx must be a "string" or "Transaction"');

  var hash = tx;
  if(tx instanceof Transaction) {
    // We need to reverse the id hash for the lookup
    hash = BufferUtil.reverse(Buffer.from(tx.id, 'hex')).toString('hex');
  }

  var txs = [];
  var height = this._calcTreeHeight();
  this._traverseMerkleTree(height, 0, { txs: txs });
  return txs.indexOf(hash) !== -1;
};

/**
 * @param {Buffer} - MerkleBlock data
 * @returns {Object} - An Object representing merkleblock data
 * @private
 */
MerkleBlock._fromBufferReader = function _fromBufferReader(br) {
  $.checkState(!br.finished(), 'No merkleblock data received');
  var info = {};
  info.header = BlockHeader.fromBufferReader(br);
  info.numTransactions = br.readUInt32LE();
  var numHashes = br.readVarintNum();
  info.hashes = [];
  for (var i = 0; i < numHashes; i++) {
    info.hashes.push(br.read(32).toString('hex'));
  }
  var numFlags = br.readVarintNum();
  info.flags = [];
  for (i = 0; i < numFlags; i++) {
    info.flags.push(br.readUInt8());
  }
  return info;
};

/**
 * @param {Object} - A plain JavaScript object
 * @returns {Block} - An instance of block
 */
MerkleBlock.fromObject = function fromObject(obj) {
  return new MerkleBlock(obj);
};

module.exports = MerkleBlock;
