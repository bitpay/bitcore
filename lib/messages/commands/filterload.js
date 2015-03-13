'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;
var BloomFilter = require('../../bloomfilter');
var $ = bitcore.util.preconditions;
var _ = bitcore.deps._;

var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

function FilterloadMessage(options) {
  if (!(this instanceof FilterloadMessage)) {
    return new FilterloadMessage(options);
  }
  if(!options) {
    options = {};
  }
  Message.call(this, options);
  this.magicNumber = magicNumber;
  this.command = 'filterload';
  $.checkArgument(_.isUndefined(options.filter) || options.filter instanceof BloomFilter,
                  'BloomFilter object  or undefined required for FilterLoad');
  this.filter = options.filter;
}
inherits(FilterloadMessage, Message);

FilterloadMessage.fromObject = function(options) {
  return new FilterloadMessage(options);
};

FilterloadMessage.fromBuffer = function(payload) {
  var obj = {};
  obj.filter = BloomFilter.fromBuffer(payload);
  return FilterloadMessage.fromObject(obj);
};

FilterloadMessage.prototype.getPayload = function() {
  if(this.filter) {
    return this.filter.toBuffer();
  } else {
    return BufferUtil.EMPTY_BUFFER;
  }
};

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  return FilterloadMessage;
};
