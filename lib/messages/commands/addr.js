'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;

/**
 * @param {Array=} arg - An array of addrs
 * @param {Object=} options
 * @param {Number} options.magicNumber
 * @extends Message
 * @constructor
 */
function AddrMessage(arg, options) {
  Message.call(this, arg, options);
  this.command = 'addr';
  this.magicNumber = options.magicNumber;
  this.addresses = arg;
}
inherits(AddrMessage, Message);

AddrMessage.prototype.setPayload = function(payload) {
  var parser = new BufferReader(payload);

  var addrCount = parser.readVarintNum();

  this.addresses = [];
  for (var i = 0; i < addrCount; i++) {
    // todo: time only available on versions >=31402
    var time = new Date(parser.readUInt32LE() * 1000);

    var addr = utils.parseAddr(parser);
    addr.time = time;
    this.addresses.push(addr);
  }

  utils.checkFinished(parser);
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

module.exports = AddrMessage;
