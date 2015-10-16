'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore-lib');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;

/**
 * @param {Object=} arg
 * @param {Buffer=} arg.payload
 * @param {Buffer=} arg.signature
 * @param {Object} options
 * @extends Message
 * @constructor
 */
function AlertMessage(arg, options) {
  Message.call(this, options);
  this.command = 'alert';
  if (!arg) {
    arg = {};
  }
  this.payload = arg.payload || new Buffer(32);
  this.signature = arg.signature || new Buffer(32);
}
inherits(AlertMessage, Message);

AlertMessage.prototype.setPayload = function(payload) {
  var parser = new BufferReader(payload);
  this.payload = parser.readVarLengthBuffer();
  this.signature = parser.readVarLengthBuffer();
  utils.checkFinished(parser);
};

AlertMessage.prototype.getPayload = function() {
  var bw = new BufferWriter();
  bw.writeVarintNum(this.payload.length);
  bw.write(this.payload);

  bw.writeVarintNum(this.signature.length);
  bw.write(this.signature);

  return bw.concat();
};

module.exports = AlertMessage;
