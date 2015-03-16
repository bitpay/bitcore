'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferWriter = bitcore.encoding.BufferWriter;
var BufferReader = bitcore.encoding.BufferReader;
var _ = bitcore.deps._;
var BN = bitcore.crypto.BN;

var utils = require('../utils');
var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);
var protocolVersion = 70000;
var packageInfo = require('../../../package.json');

/**
 * The version message is used on connection creation to advertise
 * the type of node. The remote node will respond with its version, and no
 * communication is possible until both peers have exchanged their versions.
 *
 * @see https://en.bitcoin.it/wiki/Protocol_documentation#version
 * @param{Object} [obj] - properties for the version
 * @param{Buffer} [obj.nonce] - a random 8 byte buffer
 * @param{String} [obj.subversion] - version of the client
 * @param{BN} [obj.services]
 * @param{Date} [obj.timestamp]
 * @param{Number} [obj.startHeight]
 * @extends Message
 * @constructor
 */
function VersionMessage(obj) {
  if (!(this instanceof VersionMessage)) {
    return new VersionMessage(obj);
  }
  /* jshint maxcomplexity: 10 */
  Message.call(this, obj);
  this.command = 'version';
  _.assign(this, obj);
  this.magicNumber = magicNumber;
  this.nonce = this.nonce || utils.getNonce();
  this.services = this.services || new BN(1, 10);
  this.timestamp = this.timestamp || new Date();
  this.version = this.version || protocolVersion;
  this.subversion = this.subversion || '/bitcore:' + packageInfo.version + '/';
  this.startHeight = this.startHeight || 0;
}
inherits(VersionMessage, Message);

VersionMessage.fromObject = function(obj) {
  return new VersionMessage(obj);
};

VersionMessage.fromBuffer = function(payload) {
  var parser = new BufferReader(payload);
  var obj = {};
  obj.version = parser.readUInt32LE();
  obj.services = parser.readUInt64LEBN();
  obj.timestamp = new Date(parser.readUInt64LEBN().toNumber() * 1000);

  obj.addrMe = {
    services: parser.readUInt64LEBN(),
    ip: utils.parseIP(parser),
    port: parser.readUInt16BE()
  };
  obj.addrYou = {
    services: parser.readUInt64LEBN(),
    ip: utils.parseIP(parser),
    port: parser.readUInt16BE()
  };
  obj.nonce = parser.read(8);
  obj.subversion = parser.readVarLengthBuffer().toString();
  obj.startHeight = parser.readUInt32LE();

  if(parser.finished()) {
    obj.relay = true;
  } else {
    obj.relay = !!parser.readUInt8();
  }
  utils.checkFinished(parser);

  return VersionMessage.fromObject(obj);
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

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  protocolVersion = options.protocolVersion || protocolVersion;
  return VersionMessage;
};
