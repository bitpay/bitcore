'use strict';

var bitcore = require('bitcore');
var BloomFilter = require('bloom-filter');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var $ = bitcore.util.preconditions;


BloomFilter.fromBuffer = function fromBuffer(payload) {
  var parser = new BufferReader(payload);
  var data = parser.readVarLengthBuffer();
  $.checkState(data.length <= BloomFilter.MAX_BLOOM_FILTER_SIZE,
    'Filter data must be <= MAX_BLOOM_FILTER_SIZE bytes');
  var nHashFuncs = parser.readUInt32LE();
  $.checkState(nHashFuncs <= BloomFilter.MAX_HASH_FUNCS,
    'Filter nHashFuncs must be <= MAX_HASH_FUNCS');
  var nTweak = parser.readUInt32LE();
  var nFlags = parser.readUInt8();

  var vData = [];
  var dataParser = new BufferReader(data);
  for(var i = 0; i < data.length; i++) {
    vData.push(dataParser.readUInt8());
  }

  return new BloomFilter({
    vData: vData,
    nHashFuncs: nHashFuncs,
    nTweak: nTweak,
    nFlags: nFlags
  });
}

BloomFilter.prototype.toBuffer = function toBuffer() {
  var bw = new BufferWriter();
  bw.writeVarintNum(this.vData.length);
  for(var i = 0; i < this.vData.length; i++) {
    bw.writeUInt8(this.vData[i]);
  }
  bw.writeUInt32LE(this.nHashFuncs);
  bw.writeUInt32LE(this.nTweak);
  bw.writeUInt8(this.nFlags);
  return bw.concat();
};

module.exports = BloomFilter;
