'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;

var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

function InvMessage(options) {
  Message.call(this, options);
  this.command = 'inv';
  this.magicNumber = magicNumber;
  this.inventory = options.inventory;
}
inherits(InvMessage, Message);

InvMessage.fromObject = function(options) {
  return new InvMessage(options);
};

InvMessage.prototype.getPayload = function() {
  var bw = new BufferWriter();
  utils.writeInventory(this.inventory, bw);
  return bw.concat();
};

InvMessage.fromBuffer = function(payload) {
  var obj = {
    inventory: []
  };
  
  var parser = new BufferReader(payload);
  var count = parser.readVarintNum();
  for (var i = 0; i < count; i++) {
    var type = parser.readUInt32LE();
    var hash = parser.read(32);
    obj.inventory.push({type: type, hash: hash});
  }
  
  utils.checkFinished(parser);
  return InvMessage.fromObject(obj);
};

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  return InvMessage;
};
