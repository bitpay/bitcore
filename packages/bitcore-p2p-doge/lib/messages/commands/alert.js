'use strict';

const Message = require('../message');
const inherits = require('util').inherits;
const bitcore = require('@bitpay-labs/bitcore-lib-doge');
const utils = require('../utils');

const BufferReader = bitcore.encoding.BufferReader;
const BufferWriter = bitcore.encoding.BufferWriter;

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
  this.payload = arg.payload || Buffer.alloc(32);
  this.signature = arg.signature || Buffer.alloc(32);
}
inherits(AlertMessage, Message);

AlertMessage.prototype.setPayload = function(payload) {
  const parser = new BufferReader(payload);
  this.payload = parser.readVarLengthBuffer();
  this.signature = parser.readVarLengthBuffer();
  utils.checkFinished(parser);
};

AlertMessage.prototype.getPayload = function() {
  const bw = new BufferWriter();
  bw.writeVarintNum(this.payload.length);
  bw.write(this.payload);

  bw.writeVarintNum(this.signature.length);
  bw.write(this.signature);

  return bw.concat();
};

module.exports = AlertMessage;
