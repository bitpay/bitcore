'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferWriter = bitcore.encoding.BufferWriter;
var BufferReader = bitcore.encoding.BufferReader;
var _ = bitcore.deps._;
var BN = bitcore.crypto.BN;

var utils = require('../utils');
var packageInfo = require('../../../package.json');

/**
 * The version message is used on connection creation to advertise
 * the type of node. The remote node will respond with its version, and no
 * communication is possible until both peers have exchanged their versions.
 *
 * @see https://en.bitcoin.it/wiki/Protocol_documentation#version
 * @param {Object=} obj - properties for the version
 * @param {Buffer=} obj.nonce - a random 8 byte buffer
 * @param {String=} obj.subversion - version of the client
 * @param {BN=} obj.services
 * @param {Date=} obj.timestamp
 * @param {Number=} obj.startHeight
 * @param {Number} obj.magicNumber
 * @extends Message
 * @constructor
 */
function VersionMessage(obj) {
  /* jshint maxcomplexity: 10 */
  Message.call(this, obj);
  this.command = 'version';
  _.assign(this, obj);
  this.magicNumber = obj.magicNumber;
  this.version = obj.version;
  this.nonce = this.nonce || utils.getNonce();
  this.services = this.services || new BN(1, 10);
  this.timestamp = this.timestamp || new Date();
  this.subversion = this.subversion || '/bitcore:' + packageInfo.version + '/';
  this.startHeight = this.startHeight || 0;
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
