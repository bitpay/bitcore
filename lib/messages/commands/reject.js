'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore-lib');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;

/**
 * The reject message is sent when messages are rejected.
 *
 * @see https://en.bitcoin.it/wiki/Protocol_documentation#reject
 * @param {Object=} arg - properties for the reject message
 * @param {String=} arg.message - type of message rejected
 * @param {Number=} arg.ccode - code relating to rejected message
 * @param {String=} arg.reason - text version of reason for rejection
 * @param {Buffer=} arg.data - Optional extra data provided by some errors.
 * @param {Object} options
 * @extends Message
 * @constructor
 */
function RejectMessage(arg, options) {
  if (!arg) {
    arg = {};
  }
  Message.call(this, options);
  this.command = 'reject';
  this.message = arg.message;
  this.ccode = arg.ccode;
  this.reason = arg.reason;
  this.data = arg.data;
}
inherits(RejectMessage, Message);

RejectMessage.CCODE = {
  REJECT_MALFORMED: 0x01,
  REJECT_INVALID: 0x10,
  REJECT_OBSOLETE: 0x11,
  REJECT_DUPLICATE: 0x12,
  REJECT_NONSTANDARD: 0x40,
  REJECT_DUST: 0x41,
  REJECT_INSUFFICIENTFEE: 0x42,
  REJECT_CHECKPOINT: 0x43
};

RejectMessage.prototype.setPayload = function(payload) {
  var parser = new BufferReader(payload);
  this.message = parser.readVarLengthBuffer().toString('utf-8');
  this.ccode = parser.readUInt8();
  this.reason = parser.readVarLengthBuffer().toString('utf-8');
  this.data = parser.readAll();
  utils.checkFinished(parser);
};

RejectMessage.prototype.getPayload = function() {
  var bw = new BufferWriter();
  bw.writeVarintNum(this.message.length);
  bw.write(new Buffer(this.message, 'utf-8'));
  bw.writeUInt8(this.ccode);
  bw.writeVarintNum(this.reason.length);
  bw.write(new Buffer(this.reason, 'utf-8'));
  bw.write(this.data);
  return bw.toBuffer();
};

module.exports = RejectMessage;
