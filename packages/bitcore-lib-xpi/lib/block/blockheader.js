'use strict';

var _ = require('lodash');
var BN = require('../crypto/bn');
var BufferUtil = require('../util/buffer');
var BufferReader = require('../encoding/bufferreader');
var BufferWriter = require('../encoding/bufferwriter');
var Hash = require('../crypto/hash');
var JSUtil = require('../util/js');
var $ = require('../util/preconditions');

var GENESIS_BITS = 0x1d00ffff;

/**
 * Instantiate a BlockHeader from a Buffer, JSON object, or Object with
 * the properties of the BlockHeader
 *
 * @param {*} - A Buffer, JSON string, or Object
 * @returns {BlockHeader} - An instance of block header
 * @constructor
 */
var BlockHeader = function BlockHeader(arg) {
  if (!(this instanceof BlockHeader)) {
    return new BlockHeader(arg);
  }
  var info = BlockHeader._from(arg);

  this.prevHash = info.prevHash;
  this.bits = info.bits;
  this.time = info.time;
  this.timestamp = info.time;
  this.reserved = info.reserved || 0;
  this.nonce = info.nonce;
  this.version = info.version;
  this.size = info.size;
  this.height = info.height;
  this.epochBlock = info.epochBlock;
  this.merkleRoot = info.merkleRoot;
  this.extendedMetadata = info.extendedMetadata;

  if (info.hash) {
    $.checkState(
      this.hash === info.hash,
      'Argument object hash property does not match block hash.'
    );
  }

  return this;
};

/**
 * @param {*} - A Buffer, JSON string or Object
 * @returns {Object} - An object representing block header data
 * @throws {TypeError} - If the argument was not recognized
 * @private
 */
BlockHeader._from = function _from(arg) {
  var info = {};
  if (BufferUtil.isBuffer(arg)) {
    info = BlockHeader._fromBufferReader(BufferReader(arg));
  } else if (_.isObject(arg)) {
    info = BlockHeader._fromObject(arg);
  } else {
    throw new TypeError('Unrecognized argument for BlockHeader');
  }
  return info;
};

/**
 * @param {Object} - A JSON string
 * @returns {Object} - An object representing block header data
 * @private
 */
BlockHeader._fromObject = function _fromObject(data) {
  $.checkArgument(data, 'data is required');
  var prevHash = data.prevHash;
  var merkleRoot = data.merkleRoot;
  var epochBlock = data.epochBlock;
  var extendedMetadata = data.extendedMetadata;
  var nonce = data.nonce;
  var size = data.size;
  if (_.isString(data.prevHash)) {
    prevHash = BufferUtil.reverse(Buffer.from(data.prevHash, 'hex'));
  }
  if (_.isString(data.merkleRoot)) {
    merkleRoot = BufferUtil.reverse(Buffer.from(data.merkleRoot, 'hex'));
  }
  if (_.isString(data.epochBlock)) {
    epochBlock = BufferUtil.reverse(Buffer.from(data.epochBlock, 'hex'));
  }
  if (_.isString(data.extendedMetadata)) {
    extendedMetadata = BufferUtil.reverse(Buffer.from(data.extendedMetadata, 'hex'));
  }
  if (_.isString(data.nonce)) {
    nonce = BN.fromString(data.nonce);
  }
  if (_.isNumber(data.size)) {
    size = BN.fromNumber(data.size);
  }

  var info = {
    hash: data.hash,
    prevHash: prevHash,
    bits: data.bits,
    timestamp: data.time,
    reserved: data.reserved,
    nonce: nonce,
    version: data.version,
    size: size,
    height: data.height,
    epochBlock: epochBlock,
    merkleRoot: merkleRoot,
    extendedMetadata: extendedMetadata,
    time: data.time
  };

  return info;
};

/**
 * @param {Object} - A plain JavaScript object
 * @returns {BlockHeader} - An instance of block header
 */
BlockHeader.fromObject = function fromObject(obj) {
  var info = BlockHeader._fromObject(obj);
  return new BlockHeader(info);
};

/**
 * @param {Binary} - Raw block binary data or buffer
 * @returns {BlockHeader} - An instance of block header
 */
BlockHeader.fromRawBlock = function fromRawBlock(data) {
  if (!BufferUtil.isBuffer(data)) {
    data = Buffer.from(data, 'binary');
  }
  var br = BufferReader(data);
  br.pos = BlockHeader.Constants.START_OF_HEADER;
  var info = BlockHeader._fromBufferReader(br);
  return new BlockHeader(info);
};

/**
 * @param {Buffer} - A buffer of the block header
 * @returns {BlockHeader} - An instance of block header
 */
BlockHeader.fromBuffer = function fromBuffer(buf) {
  var info = BlockHeader._fromBufferReader(BufferReader(buf));
  return new BlockHeader(info);
};

/**
 * @param {string} - A hex encoded buffer of the block header
 * @returns {BlockHeader} - An instance of block header
 */
BlockHeader.fromString = function fromString(str) {
  var buf = Buffer.from(str, 'hex');
  return BlockHeader.fromBuffer(buf);
};

/**
 * @param {BufferReader} - A BufferReader of the block header
 * @returns {Object} - An object representing block header data
 * @private
 */
BlockHeader._fromBufferReader = function _fromBufferReader(br) {
  var info = {};
  info.prevHash = br.read(32);
  info.bits = br.readUInt32LE();
  info.time = br.readUInt48LE();
  info.reserved = br.readUInt16LE();
  info.nonce = br.readUInt64LEBN();
  info.version = br.readUInt8();
  info.size = br.readUInt56LEBN();
  info.height = br.readUInt32LE();
  info.epochBlock = br.read(32);
  info.merkleRoot = br.read(32);
  info.extendedMetadata = br.read(32);
  
  return info;
};

/**
 * @param {BufferReader} - A BufferReader of the block header
 * @returns {BlockHeader} - An instance of block header
 */
BlockHeader.fromBufferReader = function fromBufferReader(br) {
  var info = BlockHeader._fromBufferReader(br);
  return new BlockHeader(info);
};

/**
 * @returns {Object} - A plain object of the BlockHeader
 */
BlockHeader.prototype.toObject = BlockHeader.prototype.toJSON = function toObject() {
  return {
    hash: this.hash,
    prevHash: BufferUtil.reverse(this.prevHash).toString('hex'),
    bits: this.bits,
    time: this.time,
    reserved: this.reserved,
    nonce: this.nonce.toString(10),
    version: this.version,
    size: this.size.toNumber(10),
    height: this.height,
    epochBlock: BufferUtil.reverse(this.epochBlock).toString('hex'),
    merkleRoot: BufferUtil.reverse(this.merkleRoot).toString('hex'),
    extendedMetadata: BufferUtil.reverse(this.extendedMetadata).toString('hex')
  };
};

/**
 * @returns {Buffer} - A Buffer of the BlockHeader
 */
BlockHeader.prototype.toBuffer = function toBuffer() {
  return this.toBufferWriter().concat();
};

/**
 * @returns {string} - A hex encoded string of the BlockHeader
 */
BlockHeader.prototype.toString = function toString() {
  return this.toBuffer().toString('hex');
};

/**
 * @param {BufferWriter} - An existing instance BufferWriter
 * @returns {BufferWriter} - An instance of BufferWriter representation of the BlockHeader
 */
BlockHeader.prototype.toBufferWriter = function toBufferWriter(bw) {
  if (!bw) {
    bw = new BufferWriter();
  }
  bw.write(this.prevHash);
  bw.writeUInt32LE(this.bits);
  bw.writeUInt48LE(this.time);
  bw.writeUInt16LE(this.reserved);
  bw.writeUInt64LEBN(this.nonce);
  bw.writeUInt8(this.version);
  bw.writeUInt56LEBN(this.size);
  bw.writeUInt32LE(this.height);
  bw.write(this.epochBlock);
  bw.write(this.merkleRoot);
  bw.write(this.extendedMetadata);
  return bw;
};

/**
 * Returns the target difficulty for this block
 * @param {Number} bits
 * @returns {BN} An instance of BN with the decoded difficulty bits
 */
BlockHeader.prototype.getTargetDifficulty = function getTargetDifficulty(bits) {
  bits = bits || this.bits;

  var target = new BN(bits & 0xffffff);
  var mov = 8 * ((bits >>> 24) - 3);
  while (mov-- > 0) {
    target = target.mul(new BN(2));
  }
  return target;
};

/**
 * @link https://en.bitcoin.it/wiki/Difficulty
 * @return {Number}
 */
BlockHeader.prototype.getDifficulty = function getDifficulty() {
  var difficulty1TargetBN = this.getTargetDifficulty(GENESIS_BITS).mul(new BN(Math.pow(10, 8)));
  var currentTargetBN = this.getTargetDifficulty();

  var difficultyString = difficulty1TargetBN.div(currentTargetBN).toString(10);
  var decimalPos = difficultyString.length - 8;
  difficultyString = difficultyString.slice(0, decimalPos) + '.' + difficultyString.slice(decimalPos);

  return parseFloat(difficultyString);
};

/**
 * @returns {Buffer} - The little endian hash buffer of the header
 */
BlockHeader.prototype._getHash = function hash() {
  var bw = new BufferWriter();

  var layer3Hash = this._getLayer3Hash();
  var layer2Hash = this._getLayer2Hash(layer3Hash);

  bw.write(this.prevHash);
  bw.write(layer2Hash);

  var buf = bw.toBuffer();
  return Hash.sha256(buf);
};

/**
 * @returns {Buffer} - The little endian hash buffer of the layer3 of the header
 */
 BlockHeader.prototype._getLayer3Hash = function hash() {
  var bw = new BufferWriter();

  bw.writeUInt8(this.version);
  bw.writeUInt56LEBN(this.size)
  bw.writeUInt32LE(this.height);
  bw.write(this.epochBlock);
  bw.write(this.merkleRoot);
  bw.write(this.extendedMetadata);

  var buf = bw.toBuffer();
  return Hash.sha256(buf);
};

/**
 * @returns {Buffer} - The little endian hash buffer of the layer2 of the header
 */
 BlockHeader.prototype._getLayer2Hash = function hash(layer3Hash) {
  var bw = new BufferWriter();

  bw.writeUInt32LE(this.bits);
  bw.writeUInt48LE(this.time);
  bw.writeUInt16LE(this.reserved);
  bw.writeUInt64LEBN(this.nonce);
  bw.write(layer3Hash);

  var buf = bw.toBuffer();
  return Hash.sha256(buf);
};

var idProperty = {
  configurable: false,
  enumerable: true,
  /**
   * @returns {string} - The big endian hash buffer of the header
   */
  get: function() {
    if (!this._id) {
      this._id = BufferReader(this._getHash()).readReverse().toString('hex');
    }
    return this._id;
  },
  set: _.noop
};
Object.defineProperty(BlockHeader.prototype, 'id', idProperty);
Object.defineProperty(BlockHeader.prototype, 'hash', idProperty);

/**
 * @returns {Boolean} - If timestamp is not too far in the future
 */
BlockHeader.prototype.validTimestamp = function validTimestamp() {
  var currentTime = Math.round(new Date().getTime() / 1000);
  if (this.time > currentTime + BlockHeader.Constants.MAX_TIME_OFFSET) {
    return false;
  }
  return true;
};

/**
 * @returns {Boolean} - If the proof-of-work hash satisfies the target difficulty
 */
BlockHeader.prototype.validProofOfWork = function validProofOfWork() {
  var pow = new BN(this.id, 'hex');
  var target = this.getTargetDifficulty();

  if (pow.cmp(target) > 0) {
    return false;
  }
  return true;
};

/**
 * @returns {string} - A string formatted for the console
 */
BlockHeader.prototype.inspect = function inspect() {
  return '<BlockHeader ' + this.id + '>';
};

BlockHeader.Constants = {
  START_OF_HEADER: 0, // Start buffer position in raw block data
  MAX_TIME_OFFSET: 2 * 60 * 60, // The max a timestamp can be in the future
  LARGEST_HASH: new BN('10000000000000000000000000000000000000000000000000000000000000000', 'hex')
};

module.exports = BlockHeader;
