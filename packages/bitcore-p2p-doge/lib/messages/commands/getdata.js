'use strict';

const Message = require('../message');
const inherits = require('util').inherits;
const bitcore = require('@bitpay-labs/bitcore-lib-doge');
const utils = require('../utils');

const BufferReader = bitcore.encoding.BufferReader;
const BufferWriter = bitcore.encoding.BufferWriter;

/**
 * @param {Object|Array=} - options - If options is an array will use as "inventory"
 * @param {Array=} options.inventory - An array of inventory items
 * @extends Message
 * @constructor
 */
function GetdataMessage(arg, options) {
  Message.call(this, options);
  this.command = 'getdata';
  utils.checkInventory(arg);
  this.inventory = arg;
}
inherits(GetdataMessage, Message);

GetdataMessage.prototype.setPayload = function(payload) {
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

GetdataMessage.prototype.getPayload = function() {
  const bw = new BufferWriter();
  utils.writeInventory(this.inventory, bw);
  return bw.concat();
};

module.exports = GetdataMessage;
