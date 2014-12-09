'use strict';

var Put = require('bufferput');

var Random = require('../crypto/random');
var BufferReader = require('../encoding/bufferreader');
var Block = require('../block');

var CONNECTION_NONCE = Random.getPseudoRandomBuffer(8);
var PROTOCOL_VERSION = 70000;

var MESSAGES = {
  'version' : Version,
  'verack': VerAck,
  'inv': Inventory,
  'ping': Ping,
  'pong': Pong
}

module.exports.buildMessage = function(command, payload) {
  var Message = MESSAGES[command];
  try {
    console.log('Message Class', Message);
    return Message.fromBuffer(payload);
  } catch (err) {
    console.log('Error while parrsing message', command);
    console.log(err);
  }
}

// ====== VERSION MESSAGE ======
function Version(subversion, nonce) {
  this.command = 'version';
  this.subversion = subversion || '/BitcoinX:0.1/';
  this.nonce = nonce || CONNECTION_NONCE;
}

Version.fromBuffer = function(payload) {
  var message = new Version();

  var parser = new BufferReader(payload);
  message.version = parser.readUInt32LE();
  message.services = parser.readUInt64LEBN();
  message.timestamp = parser.readUInt64LEBN();
  message.addr_me = parser.read(26);
  message.addr_you = parser.read(26);
  message.nonce = parser.read(8);
  message.subversion = parser.readVarintBuf();
  message.start_height = parser.readUInt32LE();

  return message;
}

Version.prototype.serialize = function() {
  var put = new Put();
  put.word32le(PROTOCOL_VERSION); // version
  put.word64le(1); // services
  put.word64le(Math.round(new Date().getTime() / 1000)); // timestamp
  put.pad(26); // addr_me
  put.pad(26); // addr_you
  put.put(this.nonce);
  put.varint(this.subversion.length);
  put.put(new Buffer(this.subversion, 'ascii'));
  put.word32le(0);

  return put.buffer();
}

module.exports.Version = Version;

// ====== INV MESSAGE ======
function Inventory(inventory) {
  this.command = 'inv';
  this.inventory = inventory || [];
}

Inventory.fromBuffer = function(payload) {
  var message = new Inventory();

  var parser = new BufferReader(payload);
  var count = parser.readVarintNum();
  for (var i = 0; i < count; i++) {
    message.inventory.push({
      type: parser.readUInt32LE(),
      hash: parser.read(32)
    });
  }

  return message;
}

Inventory.prototype.serialize = function() {
  var put = new Put();
  
  put.varint(this.inventory.length);
  this.inventory.forEach(function(value) {
    value instanceof Block ? put.word32le(2) : put.word32le(1);
    put.put(value.getHash());
  });
  
  return put.buffer();
}


// ====== PING/PONG MESSAGE ======
function Ping(nonce) {
  this.command = 'ping';
  this.nonce = nonce || CONNECTION_NONCE;
}

Ping.fromBuffer = function(payload) {
  var nonce = new BufferReader(payload).read(8);
  return new Ping(nonce);
}

Ping.prototype.serialize = function() {
  return this.nonce;
}

function Pong(nonce) {
  this.command = 'pong';
  this.nonce = nonce || CONNECTION_NONCE;
}

Pong.fromBuffer = Ping.fromBuffer;
Pong.prototype.serialize = Ping.prototype.serialize;


// ====== VARIOUS MESSAGE ======



function GetAddr() {};

function VerAck() {};
VerAck.fromBuffer = function() {
  return new VerAck();
}

function Reject() {};

function Ping(payload) {
  var parser = new BufferReader(payload);

  this.nonce = parser.read(8);
};

// ====== PING MESSAGE ======
function Address(payload) {
  var parser = new BufferReader(payload);

  var addrCount = parser.readVarintNum();
  addrCount = Math.min(addrCount, 1000);

  this.addresses = [];
  for (i = 0; i < addrCount; i++) {
    // TODO: Time actually depends on the version of the other peer (>=31402)
    this.addresses.push({
      time: parser.readUInt32LE(),
      services: parser.readUInt64LEBN(),
      ip: parser.read(16), // TODO: Parse IP Address
      port: parser.readUInt16BE()
    });
  }
};

function GetHeaders(payload) {
  var parser = new BufferReader(payload);

  this.version = parser.readUInt32LE();

  var startCount = parser.readVarintNum();
  startCount = Math.min(startCount, 500);

  this.starts = [];
  for (i = 0; i < startCount; i++) {
    this.starts.push(parser.read(32));
  }

  this.stop = parser.read(32);
}

