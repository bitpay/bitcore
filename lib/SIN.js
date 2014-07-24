'use strict';
var VersionedData = require('../util/VersionedData');
var EncodedData = require('../util/EncodedData');
var util = require('util');
var coinUtil = require('../util');

function SIN(type, payload) {
  if (typeof type != 'number') {
    SIN.super_.call(this, type, payload);
    return;
  }
  if (!Buffer.isBuffer(payload) || payload.length != 20)
    throw new Error('Payload must be 20 bytes');

  this.data = new Buffer(1 + 1 + payload.length);
  this.converters = this.encodings['binary'].converters;
  this._encoding = this.encodings['binary']._encoding;
  this.encoding('binary');
  this.prefix(0x0F); // SIN magic number, in numberspace
  this.type(type);
  this.payload(payload);
};

util.inherits(SIN, VersionedData);
EncodedData.applyEncodingsTo(SIN);

SIN.SIN_PERSIST_MAINNET = 0x01; // associated with sacrifice TX
SIN.SIN_PERSIST_TESTNET = 0x11; // associated with sacrifice TX
SIN.SIN_EPHEM = 0x02; // generate off-net at any time

// get or set the prefix data (the first byte of the address)
SIN.prototype.prefix = function(num) {
  if (num || (num === 0)) {
    this.doAsBinary(function() {
      this.data.writeUInt8(num, 0);
    });
    return num;
  }
  return this.as('binary').readUInt8(0);
};

// get or set the SIN-type data (the second byte of the address)
SIN.prototype.type = function(num) {
  if (num || (num === 0)) {
    this.doAsBinary(function() {
      this.data.writeUInt8(num, 1);
    });
    return num;
  }
  return this.as('binary').readUInt8(1);
};

// get or set the payload data (as a Buffer object)
SIN.prototype.payload = function(data) {
  if (data) {
    this.doAsBinary(function() {
      data.copy(this.data, 2);
    });
    return data;
  }
  return this.as('binary').slice(1);
};

SIN.prototype.validate = function() {
  this.doAsBinary(function() {
    SIN.super_.prototype.validate.call(this);
    if (this.data.length != 22) throw new Error('invalid data length');
  });
};


// create a SIN from a public key
SIN.fromPubKey = function(pubKey, type) {
  if (!type)
    type = SIN.SIN_EPHEM;

  if (!Buffer.isBuffer(pubKey) || (pubKey.length !== 33 && pubKey.length != 65))
    throw new Error('Invalid public key');

  var hash = coinUtil.sha256ripe160(pubKey);
  return new SIN(hash, type);
};

module.exports = SIN;
