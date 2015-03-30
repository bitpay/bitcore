'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var _ = bitcore.deps._;

/**
 * @param {Object|Array=} options - If options is an array will use as "inventory"
 * @param {Array=} options.inventory - An array of inventory items
 * @param {Number} options.magicNumber
 * @extends Message
 * @constructor
 */
function NotfoundMessage(options) {
  Message.call(this, options);
  this.command = 'notfound';
  this.magicNumber = options.magicNumber;

  var inventory;
  if (_.isArray(options)) {
    inventory = options;
  } else {
    inventory = options.inventory;
  }
  utils.checkInventory(inventory);
  this.inventory = inventory;
}
inherits(NotfoundMessage, Message);

NotfoundMessage.prototype.setPayload = function(payload) {
  this.inventory = [];

  var parser = new BufferReader(payload);
  var count = parser.readVarintNum();
  for (var i = 0; i < count; i++) {
    var type = parser.readUInt32LE();
    var hash = parser.read(32);
    this.inventory.push({type: type, hash: hash});
  }

  utils.checkFinished(parser);
};

NotfoundMessage.prototype.getPayload = function() {
  var bw = new BufferWriter();
  utils.writeInventory(this.inventory, bw);
  return bw.concat();
};

module.exports = NotfoundMessage;
