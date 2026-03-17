'use strict';

const Message = require('../message');
const inherits = require('util').inherits;
const bitcore = require('@bitpay-labs/bitcore-lib');
const utils = require('../utils');

const BufferReader = bitcore.encoding.BufferReader;
const BufferWriter = bitcore.encoding.BufferWriter;

/**
 * @param {Array=} arg - An array of inventory
 * @param {Object} options
 * @param {Array=} options.inventory - An array of inventory items
 * @extends Message
 * @constructor
 */
function InvMessage(arg, options) {
  Message.call(this, options);
  this.command = 'inv';
  utils.checkInventory(arg);
  this.inventory = arg;
}
inherits(InvMessage, Message);

InvMessage.prototype.setPayload = function(payload) {
  this.inventory = [];

  const parser = new BufferReader(payload);
  const count = parser.readVarintNum();
  for (let i = 0; i < count; i++) {
    const type = parser.readUInt32LE();
    const hash = parser.read(32);
    this.inventory.push({ type: type, hash: hash });
  }

  utils.checkFinished(parser);
};

InvMessage.prototype.getPayload = function() {
  const bw = new BufferWriter();
  utils.writeInventory(this.inventory, bw);
  return bw.concat();
};

module.exports = InvMessage;
