'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var $ = bitcore.util.preconditions;

var BlockHeader = bitcore.BlockHeader;
var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

/**
 * Sent in response to a `getheaders` message. It contains information about
 * block headers.
 *
 * @param{Array} blockheaders - array of block headers
 */
function HeadersMessage(options) {
  Message.call(this, options);
  this.magicNumber = magicNumber;
  this.command = 'headers';
  this.headers = options.headers;
};
inherits(HeadersMessage, Message);

HeadersMessage.fromObject = function(options) {
  return new HeadersMessage(options);
};

HeadersMessage.fromBuffer = function(payload) {
  var obj = {};

  $.checkArgument(payload && payload.length > 0, 'No data found to create Headers message');
  var parser = new BufferReader(payload);
  var count = parser.readVarintNum();

  obj.headers = [];
  for (var i = 0; i < count; i++) {
    var header = BlockHeader.fromBufferReader(parser);
    obj.headers.push(header);
    var txn_count = parser.readUInt8();
    $.checkState(txn_count === 0, 'txn_count should always be 0');
  }
  utils.checkFinished(parser);

  return HeadersMessage.fromObject(obj);
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

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  return HeadersMessage;
};
