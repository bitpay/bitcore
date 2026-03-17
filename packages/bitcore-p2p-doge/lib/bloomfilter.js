'use strict';

const bitcore = require('@bitpay-labs/bitcore-lib-doge');
const BloomFilter = require('bloom-filter');

const BufferReader = bitcore.encoding.BufferReader;
const BufferWriter = bitcore.encoding.BufferWriter;

/**
 * A constructor for Bloom Filters
 * @see https://github.com/bitpay/bloom-filter
 * @param {Buffer} - payload
 */
BloomFilter.fromBuffer = function fromBuffer(payload) {
  const obj = {};
  const parser = new BufferReader(payload);
  const length = parser.readVarintNum();
  obj.vData = [];
  for (let i = 0; i < length; i++) {
    obj.vData.push(parser.readUInt8());
  }
  obj.nHashFuncs = parser.readUInt32LE();
  obj.nTweak = parser.readUInt32LE();
  obj.nFlags = parser.readUInt8();
  return new BloomFilter(obj);
};

/**
 * @returns {Buffer}
 */
BloomFilter.prototype.toBuffer = function toBuffer() {
  const bw = new BufferWriter();
  bw.writeVarintNum(this.vData.length);
  for (let i = 0; i < this.vData.length; i++) {
    bw.writeUInt8(this.vData[i]);
  }
  bw.writeUInt32LE(this.nHashFuncs);
  bw.writeUInt32LE(this.nTweak);
  bw.writeUInt8(this.nFlags);
  return bw.concat();
};

module.exports = BloomFilter;
