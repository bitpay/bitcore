'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var Inventory = require('../../inventory');
var _ = bitcore.deps._;

var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

function GetdataMessage(options) {
  if (!(this instanceof GetdataMessage)) {
    return new GetdataMessage(options);
  }
  if(!options) {
    options = {};
  }
  Message.call(this, options);
  this.command = 'getdata';
  this.magicNumber = magicNumber;

  var inventory;
  if (_.isArray(options)) {
    inventory = options;
  } else {
    inventory = options.inventory;
  }

  utils.checkInventory(inventory);
  this.inventory = inventory;
}
inherits(GetdataMessage, Message);

GetdataMessage.forTransaction = function(hash) {
  return new GetdataMessage([Inventory.forTransaction(hash)]);
};

GetdataMessage.forBlock = function(hash) {
  return new GetdataMessage([Inventory.forBlock(hash)]);
};

GetdataMessage.forFilteredBlock = function(hash) {
  return new GetdataMessage([Inventory.forFilteredBlock(hash)]);
};

GetdataMessage.fromObject = function(options) {
  return new GetdataMessage(options);
};

GetdataMessage.fromBuffer = function(payload) {
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
  return GetdataMessage.fromObject(obj);
};

GetdataMessage.prototype.getPayload = function() {
  var bw = new BufferWriter();
  utils.writeInventory(this.inventory, bw);
  return bw.concat();
};

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  return GetdataMessage;
};
