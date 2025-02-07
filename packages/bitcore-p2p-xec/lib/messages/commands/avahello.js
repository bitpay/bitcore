'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('@bcpros/bitcore-lib-xec');
var BufferUtil = bitcore.util.buffer;

/**
 * Request information about active peers
 * @extends Message
 * @param {Object} options
 * @constructor
 */
function AvaHello(arg, options) {
  Message.call(this, options);
  this.command = 'avahello';
}
inherits(AvaHello, Message);

AvaHello.prototype.setPayload = function() {};

AvaHello.prototype.getPayload = function() {
};

module.exports = AvaHello;
