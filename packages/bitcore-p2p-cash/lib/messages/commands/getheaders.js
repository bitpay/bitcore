'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore-lib-cash');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var $ = bitcore.util.preconditions;

/**
 * Query another peer about block headers. It can query for multiple block hashes,
 * and the response will contain all the chains of blocks starting from those
 * hashes.
 * @param {Object=} options
 * @param {Array=} options.starts - Array of buffers or strings with the starting block hashes
 * @param {Buffer=} options.stop - Hash of the last block
 * @extends Message
 * @constructor
 */
function GetheadersMessage(arg, options) {
  Message.call(this, options);
  this.command = 'getheaders';
  this.version = options.protocolVersion;
  if (!arg) {
    arg = {};
  }
  arg = utils.sanitizeStartStop(arg);
  this.starts = arg.starts;
  this.stop = arg.stop;
}
inherits(GetheadersMessage, Message);

GetheadersMessage.prototype.setPayload = function(payload) {
  var parser = new BufferReader(payload);
  $.checkArgument(!parser.finished(), 'No data received in payload');

  this.version = parser.readUInt32LE();
  var startCount = Math.min(parser.readVarintNum(), 500);

  this.starts = [];
  for (var i = 0; i < startCount; i++) {
    this.starts.push(parser.read(32));
  }
  this.stop = parser.read(32);
  utils.checkFinished(parser);
};

GetheadersMessage.prototype.getPayload = function() {
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

module.exports = GetheadersMessage;
