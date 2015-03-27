'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;

/**
 * @param {Object=} options
 * @param {Buffer=} options.payload
 * @param {Buffer=} options.signature
 * @param {Number} options.magicNumber
 * @extends Message
 * @constructor
 */
function AlertMessage(options) {
  Message.call(this, options);
  this.magicNumber = options.magicNumber;
  this.command = 'alert';

  this.payload = options.payload || new Buffer(32);
  this.signature = options.signature || new Buffer(32);
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
