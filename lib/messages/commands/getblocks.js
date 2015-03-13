'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var $ = bitcore.util.preconditions;

var protocolVersion = 70000;
var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

/**
 * Query another peer about blocks. It can query for multiple block hashes,
 * and the response will contain all the chains of blocks starting from those
 * hashes.
 *
 * @param{Array} starts - array of buffers or strings with the starting block hashes
 * @param{Buffer} [stop] - hash of the last block
 */
function GetblocksMessage(options) {
  if (!(this instanceof GetblocksMessage)) {
    return new GetblocksMessage(options);
  }
  Message.call(this, options);
  this.command = 'getblocks';
  this.version = protocolVersion;
  this.magicNumber = magicNumber;

  options = utils.sanitizeStartStop(options);
  this.starts = options.starts;
  this.stop = options.stop;

};
inherits(GetblocksMessage, Message);

GetblocksMessage.fromObject = function(obj) {
  return new GetblocksMessage(obj);
};

GetblocksMessage.fromBuffer = function(payload) {
  var obj = {};
  var parser = new BufferReader(payload);
  $.checkArgument(!parser.finished(), 'No data received in payload');

  obj.version = parser.readUInt32LE();
  var startCount = parser.readVarintNum();

  obj.starts = [];
  for (var i = 0; i < startCount; i++) {
    obj.starts.push(parser.read(32));
  }
  obj.stop = parser.read(32);
  utils.checkFinished(parser);
  return GetblocksMessage.fromObject(obj);
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

module.exports = function(options) {
  protocolVersion = options.protocolVersion || protocolVersion;
  magicNumber = options.magicNumber || magicNumber;
  return GetblocksMessage;
};
