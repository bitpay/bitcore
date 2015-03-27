'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var $ = bitcore.util.preconditions;

/**
 * Sent in response to a `getheaders` message. It contains information about
 * block headers.
 * @param {Object=} options
 * @param {Array=} options.headers - array of block headers
 * @param {Number} options.magicNumber
 * @param {Function} options.BlockHeader - a BlockHeader constructor
 * @extends Message
 * @constructor
 */
function HeadersMessage(options) {
  Message.call(this, options);
  this.BlockHeader = options.BlockHeader;
  this.magicNumber = options.magicNumber;
  this.command = 'headers';
  this.headers = options.headers;
}
inherits(HeadersMessage, Message);

HeadersMessage.prototype.setPayload = function(payload) {
  $.checkArgument(payload && payload.length > 0, 'No data found to create Headers message');
  var parser = new BufferReader(payload);
  var count = parser.readVarintNum();

  this.headers = [];
  for (var i = 0; i < count; i++) {
    var header = this.BlockHeader.fromBufferReader(parser);
    this.headers.push(header);
    var txn_count = parser.readUInt8();
    $.checkState(txn_count === 0, 'txn_count should always be 0');
  }
  utils.checkFinished(parser);
};

HeadersMessage.prototype.getPayload = function() {
  var bw = new BufferWriter();
  bw.writeVarintNum(this.headers.length);
  for (var i = 0; i < this.headers.length; i++) {
    var buffer = this.headers[i].toBuffer();
    bw.write(buffer);
    bw.writeUInt8(0);
  }
  return bw.concat();
};

module.exports = HeadersMessage;
