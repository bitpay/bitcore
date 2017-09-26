'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore-lib-cash');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var _ = bitcore.deps._;

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

  var parser = new BufferReader(payload);
  var count = parser.readVarintNum();
  for (var i = 0; i < count; i++) {
    var type = parser.readUInt32LE();
    var hash = parser.read(32);
    this.inventory.push({type: type, hash: hash});
  }

  utils.checkFinished(parser);
};

GetdataMessage.prototype.getPayload = function() {
  var bw = new BufferWriter();
  utils.writeInventory(this.inventory, bw);
  return bw.concat();
};

module.exports = GetdataMessage;
