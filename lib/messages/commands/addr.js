'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;

var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

function AddrMessage(options) {
  Message.call(this, options);
  this.command = 'addr';
  this.magicNumber = magicNumber;
  this.addresses = options.addresses;
};
inherits(AddrMessage, Message);

AddrMessage.fromObject = function(options) {
  return new AddrMessage(options);
};

AddrMessage.fromBuffer = function(payload) {
  var parser = new BufferReader(payload);

  var addrCount = parser.readVarintNum();

  var obj = {};
  obj.addresses = [];
  for (var i = 0; i < addrCount; i++) {
    // todo: time only available on versions >=31402
    var time = new Date(parser.readUInt32LE() * 1000);

    var addr = utils.parseAddr(parser);
    addr.time = time;
    obj.addresses.push(addr);
  }

  utils.checkFinished(parser);
  return AddrMessage.fromObject(obj);
};

AddrMessage.prototype.getPayload = function() {
  var bw = new BufferWriter();
  bw.writeVarintNum(this.addresses.length);

  for (var i = 0; i < this.addresses.length; i++) {
    var addr = this.addresses[i];
    bw.writeUInt32LE(addr.time.getTime() / 1000);
    utils.writeAddr(addr, bw);
  }

  return bw.concat();
};

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  return AddrMessage;
};
