'use strict';

var _ = require('lodash');
var BlockHeader = require('./blockheader');
var BN = require('./crypto/bn');
var bu = require('./util/buffer');
var BufferReader = require('./encoding/bufferreader');
var BufferWriter = require('./encoding/bufferwriter');
var Hash = require('./crypto/hash');
var ju = require('./util/js');
var Transaction = require('./transaction');
var Varint = require('./encoding/varint');

/**
 * Instantiate a Block from a Buffer, JSON object, or Object with
 * the properties of the Block
 *
 * @param {*} - A Buffer, JSON string, or Object
 * @returns {Block} - An instance of Block
 * @constructor
 */
var Block = function Block(arg) {
  if (!(this instanceof Block)) {
    return new Block(arg);
  }
  _.extend(this, Block._from(arg));
  return this;
};

/**
 * @param {*} - A Buffer, JSON string or Object
 * @returns {Object} - An object representing block data
 * @throws {TypeError} - If the argument was not recognized
 * @private
 */
Block._from = function _from(arg) {
  var info = {};
  if (bu.isBuffer(arg)) {
    info = Block._fromBufferReader(BufferReader(arg));
  } else if (ju.isValidJson(arg)) {
    info = Block._fromJSON(arg);
  } else if (_.isObject(arg)) {
    info = {
      magicnum: arg.magicnum,
      blocksize: arg.blocksize,
      blockheader: arg.blockheader,
      txsvi: arg.txsvi,
      txs: arg.txs
    };
  } else {
    throw new TypeError('Unrecognized argument for Block');
  }
  return info;
};

/**
 * @param {String|Object} - A JSON string or object
 * @returns {Object} - An object representing block data
 * @private
 */
Block._fromJSON = function _fromJSON(data) {
  if (ju.isValidJson(data)) {
    data = JSON.parse(data);
  }
  var txs = [];
  data.txs.forEach(function(tx) {
    txs.push(Transaction().fromJSON(tx));
  });
  var info = {
    magicnum: data.magicnum,
    blocksize: data.blocksize,
    blockheader: BlockHeader.fromJSON(data.blockheader),
    txsvi: Varint().fromJSON(data.txsvi),
    txs: txs
  };
  return info;
};

/**
 * @param {String|Object} - A JSON string or object
 * @returns {Block} - An instance of block
 */
Block.fromJSON = function fromJSON(json) {
  var info = Block._fromJSON(json);
  return new Block(info);
};

/**
 * @param {BufferReader} - Block data
 * @returns {Object} - An object representing the block data
 * @private
 */
Block._fromBufferReader = function _fromBufferReader(br) {
  var info = {};
  info.magicnum = br.readUInt32LE();
  info.blocksize = br.readUInt32LE();
  info.blockheader = BlockHeader.fromBufferReader(br);
  info.txsvi = Varint(br.readVarintBuf());
  var txslen = info.txsvi.toNumber();
  info.txs = [];
  for (var i = 0; i < txslen; i++) {
    info.txs.push(Transaction().fromBufferReader(br));
  }
  return info;
};

/**
 * @param {BufferReader} - A buffer reader of the block
 * @returns {Block} - An instance of block
 */
Block.fromBufferReader = function fromBufferReader(br) {
  var info = Block._fromBufferReader(br);
  return new Block(info);
};

/**
 * @param {Buffer} - A buffer of the block
 * @returns {Block} - An instance of block
 */
Block.fromBuffer = function fromBuffer(buf) {
  return Block.fromBufferReader(BufferReader(buf));
};

/**
 * @param {Binary} - Raw block binary data or buffer
 * @returns {Block} - An instance of block
 */
Block.fromRawBlock = function fromRawBlock(data) {
  if (!bu.isBuffer(data)) {
    data = new Buffer(data, 'binary');
  }
  var br = BufferReader(data);
  var info = Block._fromBufferReader(br);
  return new Block(info);
};

/**
 * @returns {Object} - A JSON object with the block properties
 */
Block.prototype.toJSON = function toJSON() {
  var txs = [];
  this.txs.forEach(function(tx) {
    txs.push(tx.toJSON());
  });
  return {
    magicnum: this.magicnum,
    blocksize: this.blocksize,
    blockheader: this.blockheader.toJSON(),
    txsvi: this.txsvi.toJSON(),
    txs: txs
  };
};

/**
 * @returns {Buffer} - A buffer of the block
 */
Block.prototype.toBuffer = function toBuffer() {
  return this.toBufferWriter().concat();
};

/**
 * @param {BufferWriter} - An existing instance of BufferWriter
 * @returns {BufferWriter} - An instance of BufferWriter representation of the Block
 */
Block.prototype.toBufferWriter = function toBufferWriter(bw) {
  if (!bw) {
    bw = new BufferWriter();
  }
  bw.writeUInt32LE(this.magicnum);
  bw.writeUInt32LE(this.blocksize);
  bw.write(this.blockheader.toBuffer());
  bw.write(this.txsvi.buf);
  var txslen = this.txsvi.toNumber();
  for (var i = 0; i < txslen; i++) {
    this.txs[i].toBufferWriter(bw);
  }
  return bw;
};

/**
 * Will iterate through each transaction and return an array of hashes
 * @returns {Array} - An array with transaction hashes
 */
Block.prototype.getTransactionHashes = function getTransactionHashes() {
  var hashes = [];
  if (this.txs.length === 0) {
    return [Block.Values.NULL_HASH];
  }
  for (var t = 0; t < this.txs.length; t++) {
    hashes.push(this.txs[t]._getHash());
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
  for (var size = this.txs.length; size > 1; size = Math.floor((size + 1) / 2)) {
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
 * Verifies that the transactions in the block match the blockheader merkle root
 * @returns {Boolean} - If the merkle roots match
 */
Block.prototype.validMerkleRoot = function validMerkleRoot() {

  var h = new BN(this.blockheader.merklerootbuf.toString('hex'), 'hex');
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
  return this.blockheader._getHash();
};

var idProperty = {
  configurable: false,
  writeable: false,
  /**
   * @returns {string} - The big endian hash buffer of the header
   */
  get: function() {
    if (!this._id) {
      this._id = this.blockheader.id;
    }
    return this._id;
  },
  set: _.noop
};
Object.defineProperty(Block.prototype, 'id', idProperty);
Object.defineProperty(Block.prototype, 'hash', idProperty);

/**
 * @returns {String} - A string formated for the console
 */
Block.prototype.inspect = function inspect() {
  return '<Block ' + this.id + '>';
};

Block.Values = {
  NULL_HASH: new Buffer('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
};

module.exports = Block;
