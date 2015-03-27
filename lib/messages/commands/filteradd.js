'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferUtil = bitcore.util.buffer;
var BufferWriter = bitcore.encoding.BufferWriter;
var BufferReader = bitcore.encoding.BufferReader;
var $ = bitcore.util.preconditions;

/**
 * Request peer to add data to a bloom filter already set by 'filterload'
 * @param {Object=} options
 * @param {Buffer=} options.data - Array of bytes representing bloom filter data
 * @param {Number} options.magicNumber
 * @extends Message
 * @constructor
 */
function FilteraddMessage(options) {
  Message.call(this, options);
  this.magicNumber = options.magicNumber;
  this.command = 'filteradd';
  this.data = options.data || BufferUtil.EMPTY_BUFFER;
}
inherits(FilteraddMessage, Message);

FilteraddMessage.prototype.setPayload = function(payload) {
  $.checkArgument(payload);
  var parser = new BufferReader(payload);
  this.data = parser.readVarLengthBuffer();
  utils.checkFinished(parser);
};

FilteraddMessage.prototype.getPayload = function() {
  var bw = new BufferWriter();
  bw.writeVarintNum(this.data.length);
  bw.write(this.data);
  return bw.concat();
};

module.exports = FilteraddMessage;
