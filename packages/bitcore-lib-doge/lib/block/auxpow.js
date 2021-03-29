'use strict';

const BufferReader = require('../encoding/bufferreader');
const BufferWriter = require('../encoding/bufferwriter');
const $ = require('../util/preconditions');
const BufferUtil = require('../util/buffer');
const Transaction = require('../transaction/transaction');
const BlockHeader = require('./blockheader');

/**
 * Parse the Aux Proof-of-Work block in the block header
 * Ref: https://en.bitcoin.it/wiki/Merged_mining_specification#Aux_proof-of-work_block
 * @param {BlockHeader} header - BlockHeader this is attached to
 * @param {BufferReader} br - BufferReader containing the header
 */
function AuxPow(header, data) {
  if (!(this instanceof AuxPow)) {
    return new AuxPow(header, data);
  }

  $.checkArgument(header && header.version, 'version is missing from header')
  if (!(header.version & (1 << 8))) {
    return;
  }

  const info = this._from(data);
  this.coinbaseTxn      = info.coinbaseTxn;
  this.coinbaseBranch   = info.coinbaseBranch;
  this.blockchainBranch = info.blockchainBranch;
  // Note: the blockhash is only used when re-serializing. Otherwise, use the parent block hash
  this._blockHash       = info.blockHashBuf;
  this._parentBlock     = info.parentBlockBuf;

  return this;
};


Object.defineProperty(AuxPow.prototype, 'parentBlock', {
  enumerable: true,
  configurable: true,
  get: function() {
    return new BlockHeader(this._parentBlock);  
  }
});


Object.defineProperty(AuxPow.prototype, 'blockHash', {
  enumerable: true,
  configurable: false,
  get: function() {
    // Note that the blockhash taken from the header is not a reliable value, so use the parentBlock.hash instead.
    // See https://en.bitcoin.it/wiki/Merged_mining_specification#Aux_proof-of-work_block
    // "Note that the block_hash element is not needed as you have the full parent_block header element and can calculate the hash from that. [...]some AuxPOW blocks have it little-endian, and some have it big-endian."
    return this.parentBlock.hash;
  }
});


/**
 * @param {*} - A Buffer or BufferReader
 * @returns {Object} - An object representing block header data
 * @throws {TypeError} - If the argument was not recognized
 * @private
 */
AuxPow.prototype._from = function(data) {
  let info = {};
  if (data instanceof BufferReader || (BufferUtil.isBuffer(data.buf) && !isNaN(data.pos))) {
    info = this._fromBufferReader(data);
  } else if (BufferUtil.isBuffer(data)) {
    data = BufferReader(data);
    info = this._fromBufferReader(data);
  // TODO
  // } else if (_.isObject(data)) {
  //   info = AuxPow._fromObject(data);
  } else {
    throw new TypeError('Unrecognized argument for AuxPow');
  }

  return info;
};


/**
 * @param {BufferReader} - A BufferReader of the auxpow block header
 * @returns {Object} - An object representing auxpow block header data
 * @private
 */
AuxPow.prototype._fromBufferReader = function(br) {
  $.checkArgument(br && br instanceof BufferReader, 'A bufferreader is required')

  const info = {
    coinbaseTxn      : new Transaction().fromBufferReader(br),
    blockHashBuf     : br.read(32),
    coinbaseBranch   : this._getMerkleBranch(br),
    blockchainBranch : this._getMerkleBranch(br),
    parentBlockBuf   : br.read(80)
  }
  return info;
};


/**
 * @param {BufferReader} br
 * @returns 
 */
AuxPow.prototype._getMerkleBranch = function(br) {
  const branchLen = br.readVarintNum();
  const branchHashes = [];
  for (let j = 0; j < branchLen; j++) {
    branchHashes.push(br.readReverse(32));
  }
  const branchSideMask = br.readInt32LE();
  return {
    branchLen,
    branchHashes,
    branchSideMask
  };
};


/**
 * @returns {Buffer} - A Buffer of the AuxPow header
 */
AuxPow.prototype.toBuffer = function() {
  const bw = this.toBufferWriter();
  return bw.concat();
};


/**
 * @param {BufferWriter} - (optional) An existing instance BufferWriter
 * @returns {BufferWriter} - An instance of BufferWriter representation of the BlockHeader
 */
AuxPow.prototype.toBufferWriter = function(bw) {
  if (!bw) {
    bw = new BufferWriter();
  }
  // Coinbase Transaction
  this.coinbaseTxn.toBufferWriter(bw);
  // Block Hash
  bw.write(this._blockHash);
  // Coinbase Branch
  bw.writeVarintNum(this.coinbaseBranch.branchLen);
  for (let branchHash of this.coinbaseBranch.branchHashes) {
    bw.writeReverse(branchHash);
  }
  bw.writeInt32LE(this.coinbaseBranch.branchSideMask);
  // Blockchain Branch
  bw.writeVarintNum(this.blockchainBranch.branchLen);
  for (let branchHash of this.blockchainBranch.branchHashes) {
    bw.writeReverse(branchHash);
  }
  bw.writeInt32LE(this.blockchainBranch.branchSideMask);
  // ParentBlock
  bw.write(this._parentBlock);

  return bw;
};


module.exports = AuxPow;
