'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore-lib');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;

function RejectMessage(arg, options) {
  Message.call(this, options);
  this.command = 'reject';
}
inherits(RejectMessage, Message);

RejectMessage.prototype.setPayload = function(payload) {
  var parser = new BufferReader(payload);
  this.message = parser.readVarLengthBuffer();
  this.ccode = parser.readUInt8();
  this.reason = parser.readVarLengthBuffer();
  this.data = parser.readAll();
  utils.checkFinished(parser);
};

RejectMessage.prototype.getPayload = function() {
  var bw = new BufferWriter();
  bw.writeVarintNum(this.message.length);
  bw.write(this.message);
  bw.writeUInt8(this.cccode);
  bw.writeVarintNum(this.reason.length);
  bw.write(this.reason);
  bw.write(this.data);
  return bw.toBuffer();
};

module.exports = RejectMessage;
