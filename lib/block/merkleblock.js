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
