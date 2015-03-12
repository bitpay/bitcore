'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferUtil = bitcore.util.buffer;
var BufferWriter = bitcore.encoding.BufferWriter;
var BufferReader = bitcore.encoding.BufferReader;
var $ = bitcore.util.preconditions;

var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

/**
 * Request peer to add data to a bloom filter already set by 'filterload'
 *
 * @name P2P.Message.filteradd
 * @param{Buffer} data - Array of bytes representing bloom filter data
 */
function FilteraddMessage(options) {
  Message.call(this, options);
  this.magicNumber = magicNumber;
  this.command = 'filteradd';
  this.data = options.data || BufferUtil.EMPTY_BUFFER;
};
inherits(FilteraddMessage, Message);

FilteraddMessage.fromObject = function(options) {
  return new FilteraddMessage(options);
};

FilteraddMessage.fromBuffer = function(payload) {
  var obj = {};
  $.checkArgument(payload);
  var parser = new BufferReader(payload);
  obj.data = parser.readVarLengthBuffer();
  utils.checkFinished(parser);
  return FilteraddMessage.fromObject(obj);
};

FilteraddMessage.prototype.getPayload = function() {
  var bw = new BufferWriter();
  bw.writeVarintNum(this.data.length);
  bw.write(this.data);
  return bw.concat();
};

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  return FilteraddMessage;
};
