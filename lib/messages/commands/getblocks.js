'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore-lib');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var $ = bitcore.util.preconditions;

/**
 * Query another peer about blocks. It can query for multiple block hashes,
 * and the response will contain all the chains of blocks starting from those
 * hashes.
 * @param {Object=} arg
 * @param {Array=} arg.starts - Array of buffers or strings with the starting block hashes
 * @param {Buffer=} arg.stop - Hash of the last block
 * @param {Object} options
 * @extends Message
 * @constructor
 */
function GetblocksMessage(arg, options) {
  Message.call(this, options);
  this.command = 'getblocks';
  this.version = options.protocolVersion;
  if (!arg) {
    arg = {};
  }
  arg = utils.sanitizeStartStop(arg);
  this.starts = arg.starts;
  this.stop = arg.stop;
}
inherits(GetblocksMessage, Message);

GetblocksMessage.prototype.setPayload = function(payload) {
  var parser = new BufferReader(payload);
  $.checkArgument(!parser.finished(), 'No data received in payload');

  this.version = parser.readUInt32LE();
  var startCount = parser.readVarintNum();

  this.starts = [];
  for (var i = 0; i < startCount; i++) {
    this.starts.push(parser.read(32));
  }
  this.stop = parser.read(32);
  utils.checkFinished(parser);
};

GetblocksMessage.prototype.getPayload = function() {
  var bw = new BufferWriter();
  bw.writeUInt32LE(this.version);
  bw.writeVarintNum(this.starts.length);
  for (var i = 0; i < this.starts.length; i++) {
    bw.write(this.starts[i]);
  }
  if (this.stop.length !== 32) {
    throw new Error('Invalid hash length: ' + this.stop.length);
  }
  bw.write(this.stop);
  return bw.concat();
};

module.exports = GetblocksMessage;
