'use strict';
var _ = require('lodash');
var BlockHeader = require('./blockheader');
var BufferUtil = require('../util/buffer');
var BufferReader = require('../encoding/bufferreader');
var BufferWriter = require('../encoding/bufferwriter');
var Hash = require('../crypto/hash');
var JSUtil = require('../util/js');
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
  if (!(this instanceof MerkleBlock)) {
    return new MerkleBlock(arg);
  }

  var info = {};
  if (BufferUtil.isBuffer(arg)) {
    info = MerkleBlock._fromBufferReader(BufferReader(arg));
  } else if (JSUtil.isValidJSON(arg)) {
    info = MerkleBlock._fromJSON(arg);
  } else if (_.isObject(arg)) {
    var header;
    if(arg.header instanceof BlockHeader) {
      header = arg.header
    } else {
      header = BlockHeader.fromJSON(JSON.stringify(arg.header));
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
    throw new TypeError('Unrecognized argument for Block');
  }
  _.extend(this,info);
  this._validMerkleTree = null;
  return this;
}

/**
 * @param {Buffer} - MerkleBlock data in a Buffer object
 * @returns {MerkleBlock} - A MerkleBlock object
 */
MerkleBlock.fromBuffer = function fromBuffer(buf) {
  return MerkleBlock.fromBufferReader(BufferReader(buf));
}

/**
 * @param {BufferReader} - MerkleBlock data in a BufferReader object
 * @returns {MerkleBlock} - A MerkleBlock object
 */
MerkleBlock.fromBufferReader = function fromBufferReader(br) {
  return new MerkleBlock(MerkleBlock._fromBufferReader(br));
}

/**
 * @param {String|Object} - A JSON String or Object
 * @returns {MerkleBlock} - A MerkleBlock object
 */
MerkleBlock.fromJSON = function fromJSON(buf) {
  return new MerkleBlock(MerkleBlock._fromJSON(buf));
}

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
    bw.write(new Buffer(this.hashes[i], 'hex'));
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
MerkleBlock.prototype.toObject = function toObject() {
  return {
    header: this.header.toObject(),
    numTransactions: this.numTransactions,
    hashes: this.hashes,
    flags: this.flags
  };
};

/**
 * @returns {String} - A JSON string of a MerkleBlock
 */
MerkleBlock.prototype.toJSON = function toJSON() {
  return JSON.stringify(this.toObject());
};

/**
 * Verify that the MerkleBlock is valid
 * @returns {Bool} - True/False whether this MerkleBlock is Valid
 */
MerkleBlock.prototype.validMerkleTree = function validMerkleTree() {
  var self = this;
  if(this._validMerkleTree === true) {
    return true;
  } else if (this._validMerkleTree === false) {
    return false;
  }

  // Can't have more hashes than numTransactions
  // TODO: Test for this condition
  if(this.hashes.length.length > this.numTransactions) {
    return this._setValidMerkleTree(false);
  }

  // Can't have more flag bits than num hashes
  // TODO: Test for this condition
  if(this.flags.length * 8 < this.hashes.length) {
    return this._setValidMerkleTree(false);
  }

  // Calculate height of tree
  // From Bitcoin Core merkleblock.h CalcTreeWidth() + CPartialMerkleTree
  var height = 0;
  while (calcTreeWidth(height) > 1) {
    height++;
  }

  var txs = [];
  var flagBitsUsed = 0;
  var hashesUsed = 0;

  var root = traverse(height, 0);
  if(hashesUsed !== this.hashes.length) {
    return this._setValidMerkleTree(false);
  }
  return this._setValidMerkleTree(BufferUtil.equals(root, this.header.merkleRoot));

  // Modeled after Bitcoin Core merkleblock.cpp TraverseAndExtract()
  function traverse(depth, pos) {
    if(flagBitsUsed > self.flags.length * 8) {
      return null;
    }
    var isParentOfMatch = (self.flags[flagBitsUsed >> 3] >>> (flagBitsUsed++ & 7)) & 1;
    if(depth === 0 || !isParentOfMatch) {
      if(hashesUsed >= self.hashes.length) {
        return null;
      }
      var hash = self.hashes[hashesUsed++];
      if (depth === 0 && isParentOfMatch) {
        txs.push(hash)
      }
      return new Buffer(hash, 'hex');
    } else {
      var left = traverse(depth-1, pos*2);
      var right;
      if(pos*2+1 < calcTreeWidth(depth-1)) {
        right = traverse(depth-1, pos*2+1);
      } else {
        right = left;
      }
      return Hash.sha256sha256(new Buffer.concat([left, right]));
    }
  }

  function calcTreeWidth(height) {
    return (self.numTransactions + (1 << height) - 1) >> height;
  }
}

/**
 * @param {Bool} - set the merkle tree validity
 * @returns {Bool} - return true/false
 * @private
 */
MerkleBlock.prototype._setValidMerkleTree = function(valid) {
  this._validMerkleTree = valid;
  return valid;
}


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
 * @param {String|Object} - A JSON or String Object
 * @returns {Object} - An Object representing merkleblock data
 * @private
 */
MerkleBlock._fromJSON = function _fromJSON(data) {
  if (JSUtil.isValidJSON(data)) {
    data = JSON.parse(data);
  }
  var info = {
    header: BlockHeader.fromJSON(data.header),
    numTransactions: data.numTransactions,
    hashes: data.hashes,
    flags: data.flags,
  };
  return info;
};

module.exports = MerkleBlock;
