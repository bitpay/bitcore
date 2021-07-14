'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore-lib-cash');
var BufferWriter = bitcore.encoding.BufferWriter;
var BufferReader = bitcore.encoding.BufferReader;
var BN = bitcore.crypto.BN;

var utils = require('../utils');
var packageInfo = require('../../../package.json');

/**
 * The version message is used on connection creation to advertise
 * the type of node. The remote node will respond with its version, and no
 * communication is possible until both peers have exchanged their versions.
 *
 * @see https://en.bitcoin.it/wiki/Protocol_documentation#version
 * @param {Object=} arg - properties for the version message
 * @param {Buffer=} arg.nonce - a random 8 byte buffer
 * @param {Number=} arg.version - protocol version of the client
 * @param {String=} arg.subversion - subversion (user agent) of the client
 * @param {BN=} arg.services - bitfield of features enabled for this connection
 * @param {Date=} arg.timestamp
 * @param {Number=} arg.startHeight
 * @param {Object} options
 * @extends Message
 * @constructor
 */
function VersionMessage(arg, options) {
  /* jshint maxcomplexity: 10 */
  if (!arg) {
    arg = {};
  }
  Message.call(this, options);
  this.command = 'version';
  this.version = arg.version || options.protocolVersion;
  this.nonce = arg.nonce || utils.getNonce();
  this.services = arg.services || new BN(1, 10);
  this.timestamp = arg.timestamp || new Date();
  this.subversion = arg.subversion || '/bitcore:' + packageInfo.version + '/';
  this.startHeight = arg.startHeight || 0;
  this.relay = arg.relay === false ? false : true;
}
inherits(VersionMessage, Message);

VersionMessage.prototype.setPayload = function(payload) {
  var parser = new BufferReader(payload);
  this.version = parser.readUInt32LE();
  this.services = parser.readUInt64LEBN();
  this.timestamp = new Date(parser.readUInt64LEBN().toNumber() * 1000);

  this.addrMe = {
    services: parser.readUInt64LEBN(),
    ip: utils.parseIP(parser),
    port: parser.readUInt16BE()
  };
  this.addrYou = {
    services: parser.readUInt64LEBN(),
    ip: utils.parseIP(parser),
    port: parser.readUInt16BE()
  };
  this.nonce = parser.read(8);
  this.subversion = parser.readVarLengthBuffer().toString();
  this.startHeight = parser.readUInt32LE();

  if(parser.finished()) {
    this.relay = true;
  } else {
    this.relay = !!parser.readUInt8();
  }
  utils.checkFinished(parser);
};

VersionMessage.prototype.getPayload = function() {
  var bw = new BufferWriter();
  bw.writeUInt32LE(this.version);
  bw.writeUInt64LEBN(this.services);

  var timestampBuffer = new Buffer(Array(8));
  timestampBuffer.writeUInt32LE(Math.round(this.timestamp.getTime() / 1000), 0);
  bw.write(timestampBuffer);

  utils.writeAddr(this.addrMe, bw);
  utils.writeAddr(this.addrYou, bw);
  bw.write(this.nonce);
  bw.writeVarintNum(this.subversion.length);
  bw.write(new Buffer(this.subversion, 'ascii'));
  bw.writeUInt32LE(this.startHeight);
  bw.writeUInt8(this.relay);

  return bw.concat();
};

module.exports = VersionMessage;
