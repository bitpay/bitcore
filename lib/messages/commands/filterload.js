'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;
var BloomFilter = require('../../bloomfilter');
var $ = bitcore.util.preconditions;
var _ = bitcore.deps._;

/**
 * Request peer to send inv messages based on a bloom filter
 * @param {BloomFilter=} options.filter - An instance of BloomFilter
 * @param {Number} options.magicNumber
 * @extends Message
 * @constructor
 */
function FilterloadMessage(options) {
  Message.call(this, options);
  this.magicNumber = options.magicNumber;
  this.command = 'filterload';
  $.checkArgument(
    _.isUndefined(options.filter) || options.filter instanceof BloomFilter,
    'An instance of BloomFilter or undefined is expected'
  );
  this.filter = options.filter;
}
inherits(FilterloadMessage, Message);

FilterloadMessage.prototype.setPayload = function(payload) {
  this.filter = BloomFilter.fromBuffer(payload);
};

FilterloadMessage.prototype.getPayload = function() {
  if(this.filter) {
    return this.filter.toBuffer();
  } else {
    return BufferUtil.EMPTY_BUFFER;
  }
};

module.exports = FilterloadMessage;
