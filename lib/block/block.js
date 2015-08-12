'use strict';

var _ = require('lodash');
var BlockHeader = require('./blockheader');
var BN = require('../crypto/bn');
var BufferUtil = require('../util/buffer');
var BufferReader = require('../encoding/bufferreader');
var BufferWriter = require('../encoding/bufferwriter');
var Hash = require('../crypto/hash');
var Transaction = require('../transaction');
var $ = require('../util/preconditions');

/**
 * Instantiate a Block from a Buffer, JSON object, or Object with
 * the properties of the Block
 *
 * @param {*} - A Buffer, JSON string, or Object
 * @returns {Block}
 * @constructor
 */
function Block(arg) {
  if (!(this instanceof Block)) {
    return new Block(arg);
  }
  _.extend(this, Block._from(arg));
  return this;
}

// https://github.com/bitcoin/bitcoin/blob/b5fa132329f0377d787a4a21c1686609c2bfaece/src/primitives/block.h#L14
Block.MAX_BLOCK_SIZE = 1000000;

/**
 * @param {*} - A Buffer, JSON string or Object
 * @returns {Object} - An object representing block data
 * @throws {TypeError} - If the argument was not recognized
 * @private
 */
Block._from = function _from(arg) {
  var info = {};
  if (BufferUtil.isBuffer(arg)) {
    info = Block._fromBufferReader(BufferReader(arg));
  } else if (_.isObject(arg)) {
    info = Block._fromObject(arg);
  } else {
    throw new TypeError('Unrecognized argument for Block');
  }
  return info;
};

/**
 * @param {Object} - A plain JavaScript object
 * @returns {Object} - An object representing block data
 * @private
 */
Block._fromObject = function _fromObject(data) {
  var transactions = [];
  data.transactions.forEach(function(tx) {
    if (tx instanceof Transaction) {
      transactions.push(tx);
    } else {
      transactions.push(Transaction().fromObject(tx));
    }
  });
  var info = {
    header: BlockHeader.fromObject(data.header),
    transactions: transactions
  };
  return info;
};

/**
 * @param {Object} - A plain JavaScript object
 * @returns {Block} - An instance of block
 */
Block.fromObject = function fromObject(obj) {
  var info = Block._fromObject(obj);
  return new Block(info);
};

/**
 * @param {BufferReader} - Block data
 * @returns {Object} - An object representing the block data
 * @private
 */
Block._fromBufferReader = function _fromBufferReader(br) {
  var info = {};
  $.checkState(!br.finished(), 'No block data received');
  info.header = BlockHeader.fromBufferReader(br);
  var transactions = br.readVarintNum();
  info.transactions = [];
  for (var i = 0; i < transactions; i++) {
    info.transactions.push(Transaction().fromBufferReader(br));
  }
  return info;
};

/**
 * @param {BufferReader} - A buffer reader of the block
 * @returns {Block} - An instance of block
 */
Block.fromBufferReader = function fromBufferReader(br) {
  $.checkArgument(br, 'br is required');
  var info = Block._fromBufferReader(br);
  return new Block(info);
};

/**
 * @param {Buffer} - A buffer of the block
 * @returns {Block} - An instance of block
 */
Block.fromBuffer = function fromBuffer(buf) {
  return Block.fromBufferReader(new BufferReader(buf));
};

/**
 * @param {string} - str - A hex encoded string of the block
 * @returns {Block} - A hex encoded string of the block
 */
Block.fromString = function fromString(str) {
  var buf = new Buffer(str, 'hex');
  return Block.fromBuffer(buf);
};

/**
 * @param {Binary} - Raw block binary data or buffer
 * @returns {Block} - An instance of block
 */
Block.fromRawBlock = function fromRawBlock(data) {
  if (!BufferUtil.isBuffer(data)) {
    data = new Buffer(data, 'binary');
  }
  var br = BufferReader(data);
  br.pos = Block.Values.START_OF_BLOCK;
  var info = Block._fromBufferReader(br);
  return new Block(info);
};

/**
 * @returns {Object} - A plain object with the block properties
 */
Block.prototype.toObject = Block.prototype.toJSON = function toObject() {
  var transactions = [];
  this.transactions.forEach(function(tx) {
    transactions.push(tx.toObject());
  });
  return {
    header: this.header.toObject(),
    transactions: transactions
  };
};

/**
 * @returns {Buffer} - A buffer of the block
 */
Block.prototype.toBuffer = function toBuffer() {
  return this.toBufferWriter().concat();
};

/**
 * @returns {string} - A hex encoded string of the block
 */
Block.prototype.toString = function toString() {
  return this.toBuffer().toString('hex');
};

/**
 * @param {BufferWriter} - An existing instance of BufferWriter
 * @returns {BufferWriter} - An instance of BufferWriter representation of the Block
 */
Block.prototype.toBufferWriter = function toBufferWriter(bw) {
  if (!bw) {
    bw = new BufferWriter();
  }
  bw.write(this.header.toBuffer());
  bw.writeVarintNum(this.transactions.length);
  for (var i = 0; i < this.transactions.length; i++) {
    this.transactions[i].toBufferWriter(bw);
  }
  return bw;
};

/**
 * Will iterate through each transaction and return an array of hashes
 * @returns {Array} - An array with transaction hashes
 */
Block.prototype.getTransactionHashes = function getTransactionHashes() {
  var hashes = [];
  if (this.transactions.length === 0) {
    return [Block.Values.NULL_HASH];
  }
  for (var t = 0; t < this.transactions.length; t++) {
    hashes.push(this.transactions[t]._getHash());
  }
  return hashes;
};

/**
 * Will build a merkle tree of all the transactions, ultimately arriving at
 * a single point, the merkle root.
 * @link https://en.bitcoin.it/wiki/Protocol_specification#Merkle_Trees
 * @returns {Array} - An array with each level of the tree after the other.
 */
Block.prototype.getMerkleTree = function getMerkleTree() {

  var tree = this.getTransactionHashes();

  var j = 0;
  for (var size = this.transactions.length; size > 1; size = Math.floor((size + 1) / 2)) {
    for (var i = 0; i < size; i += 2) {
      var i2 = Math.min(i + 1, size - 1);
      var buf = Buffer.concat([tree[j + i], tree[j + i2]]);
      tree.push(Hash.sha256sha256(buf));
    }
    j += size;
  }

  return tree;
};

/**
 * Calculates the merkleRoot from the transactions.
 * @returns {Buffer} - A buffer of the merkle root hash
 */
Block.prototype.getMerkleRoot = function getMerkleRoot() {
  var tree = this.getMerkleTree();
  return tree[tree.length - 1];
};

/**
 * Verifies that the transactions in the block match the header merkle root
 * @returns {Boolean} - If the merkle roots match
 */
Block.prototype.validMerkleRoot = function validMerkleRoot() {

  var h = new BN(this.header.merkleRoot.toString('hex'), 'hex');
  var c = new BN(this.getMerkleRoot().toString('hex'), 'hex');

  if (h.cmp(c) !== 0) {
    return false;
  }

  return true;
};

/**
 * @returns {Buffer} - The little endian hash buffer of the header
 */
Block.prototype._getHash = function() {
  return this.header._getHash();
};

var idProperty = {
  configurable: false,
  enumerable: true,
  /**
   * @returns {string} - The big endian hash buffer of the header
   */
  get: function() {
    if (!this._id) {
      this._id = this.header.id;
    }
    return this._id;
  },
  set: _.noop
};
Object.defineProperty(Block.prototype, 'id', idProperty);
Object.defineProperty(Block.prototype, 'hash', idProperty);

/**
 * @returns {string} - A string formatted for the console
 */
Block.prototype.inspect = function inspect() {
  return '<Block ' + this.id + '>';
};

Block.Values = {
  START_OF_BLOCK: 8, // Start of block in raw block data
  NULL_HASH: new Buffer('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
};

module.exports = Block;
