'use strict';

var Put = require('bufferput');

var Block = require('../block');
var BufferReader = require('../encoding/bufferreader');
var BufferUtil = require('../util/buffer');
var Random = require('../crypto/random');

var CONNECTION_NONCE = Random.getPseudoRandomBuffer(8);
var PROTOCOL_VERSION = 70000;

var MESSAGES = {
  'version' : Version,
  'verack': VerAck,
  'inv': Inventory,
  'ping': Ping,
  'pong': Pong,
  'addr': Addresses,
  'getaddr': GetAddresses,
  'reject': Reject
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
  this.version = PROTOCOL_VERSION;
  this.subversion = subversion || '/BitcoinX:0.1/';
  this.nonce = nonce || CONNECTION_NONCE;
};

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
};

Version.prototype.serialize = function() {
  var put = new Put();
  put.word32le(this.version); // version
  put.word64le(1); // services
  put.word64le(Math.round(new Date().getTime() / 1000)); // timestamp
  put.pad(26); // addr_me
  put.pad(26); // addr_you
  put.put(this.nonce);
  put.varint(this.subversion.length);
  put.put(new Buffer(this.subversion, 'ascii'));
  put.word32le(0);

  return put.buffer();
};

module.exports.Version = Version;

// ====== INV/GETDATA MESSAGE ======
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
};

Inventory.prototype.serialize = function() {
  var put = new Put();
  
  put.varint(this.inventory.length);
  this.inventory.forEach(function(value) {
    value instanceof Block ? put.word32le(2) : put.word32le(1);
    put.put(value.getHash());
  });
  
  return put.buffer();
};

function GetData(inventory) {
  this.command = 'getdata';
  this.inventory = inventory || [];
}

GetData.fromBuffer = Inventory.fromBuffer;
GetData.prototype.serialize = Inventory.prototype.serialize;

// ====== PING/PONG MESSAGE ======
function Ping(nonce) {
  this.command = 'ping';
  this.nonce = nonce || CONNECTION_NONCE;
}

Ping.fromBuffer = function(payload) {
  var nonce = new BufferReader(payload).read(8);
  return new Ping(nonce);
};

Ping.prototype.serialize = function() {
  return this.nonce;
};

function Pong(nonce) {
  this.command = 'pong';
  this.nonce = nonce || CONNECTION_NONCE;
}

Pong.fromBuffer = Ping.fromBuffer;
Pong.prototype.serialize = Ping.prototype.serialize;


// ====== ADDR MESSAGE ======
function Addresses(nonce) {
  this.command = 'addr';
  this.addresses = [];
}

Address.fromBuffer = function(payload) {
  var message = new Address();

  var parser = new BufferReader(payload);
  var addrCount = Math.min(parser.readVarintNum(), 1000);

  message.addresses = [];
  for (var i = 0; i < addrCount; i++) {
    // TODO: Time actually depends on the version of the other peer (>=31402)
    message.addresses.push({
      time: parser.readUInt32LE(),
      services: parser.readUInt64LEBN(),
      ip: parser.read(16),
      port: parser.readUInt16BE()
    });
  }

  return message;
};

Address.prototype.serialize = function() {
  return BufferUtil.EMPTY_BUFFER; // TODO
};

// ====== GETADDR MESSAGE ======
function GetAddresses() {
  this.command = 'getaddr';
}

GetAddresses.fromBuffer = function() {
  return new GetAddresses();
};

GetAddresses.prototype.serialize = function() {
  return BufferUtil.EMPTY_BUFFER;
};


// ====== VERACK MESSAGE ======
function VerAck() {
  this.command = 'verack';
}

VerAck.fromBuffer = function() {
  return new VerAck();
};

VerAck.prototype.serialize = function() {
  return BufferUtil.EMPTY_BUFFER;
};

// ====== REJECT MESSAGE ======
// TODO: Parse REJECT message
function Reject() {
  this.command = 'reject';
}

Reject.fromBuffer = function() {
  return new Reject();
};

Reject.prototype.serialize = function() {
  return BufferUtil.EMPTY_BUFFER;
};

// ====== ALERT MESSAGE ======
function Alert(payload) {
  this.command = 'reject';
}

Alert.fromBuffer = function() {
  var message = new Alert();

  var parser = new BufferReader(payload);
  message.payload = parser.readVarintBuf(); // TODO: Use current format
  message.signature = parser.readVarintBuf();
  return message;
};

Alert.prototype.serialize = function() {
  return BufferUtil.EMPTY_BUFFER; // TODO: Serialize
};

// ====== HEADERS MESSAGE ======
function Headers(blockheaders) {
  this.command = 'headers';
  this.headers = blockheaders || [];
}

Headers.fromBuffer = function() {
  var message = new Headers();

  var parser = new BufferReader(payload);
  var count = parser.readVarintNum();

  message.headers = [];
  for (i = 0; i < count; i++) {
    var header = Block().fromBufferReader(parser);
    message.headers.push(header);
  }

  return message;
};

Headers.prototype.serialize = function() {
  return BufferUtil.EMPTY_BUFFER; // TODO: Serialize
};

// ====== BLOCK MESSAGE ======
function Block(block) {
  this.command = 'block';
  this.block = block;
}

Block.fromBuffer = function() {
  var parser = new BufferReader(payload);
  var block = Block().fromBufferReader(parser);
  return new Block(block);
};

Block.prototype.serialize = function() {
  return BufferUtil.EMPTY_BUFFER; // TODO: Serialize
};

// ====== TX MESSAGE ======
function Transaction(transaction) {
  this.command = 'tx';
  this.transaction = transaction;
}

Transaction.fromBuffer = function() {
  var parser = new BufferReader(payload);
  var transaction = Transaction().fromBufferReader(parser);
  return new Transaction(transaction);
};

Transaction.prototype.serialize = function() {
  return BufferUtil.EMPTY_BUFFER; // TODO: Serialize
};

// ====== GETBLOCKS/GETHEADERS MESSAGE ======
function GetBlocks(starts, stop) {
  this.command = 'getblocks';
  this.version = PROTOCOL_VERSION;
  this.starts = starts || [];
  this.stop = stop || BufferUtil.NULL_HASH;
}

GetBlocks.fromBuffer = function() {
  var message = new GetBlocks();

  var parser = new BufferReader(payload);
  message.version = parser.readUInt32LE();

  var startCount = Math.min(parser.readVarintNum(), 500);
  message.starts = [];
  for (var i = 0; i < startCount; i++) {
    message.starts.push(parser.read(32));
  }
  message.stop = parser.read(32);
};

GetBlocks.prototype.serialize = function() {
  var put = new Put();
  put.word32le(this.version);
  put.varint(this.starts.length);

  for (var i = 0; i < starts.length; i++) {
    if (this.starts[i].length != 32) {
      throw new Error('Invalid hash length');
    }
    put.put(this.starts[i]);
  }

  if (this.stop.length != 32) {
    throw new Error('Invalid hash length');
  }
  put.put(this.stop);

  return put.buffer();
};

function GetHeaders(starts, stop) {
  this.command = 'getheaders';
  this.version = PROTOCOL_VERSION;
  this.starts = starts || [];
  this.stop = stop || BufferUtil.NULL_HASH;
}

GetHeaders.fromBuffer = GetBlocks.fromBuffer;
GetHeaders.prototype.serialize = GetBlocks.prototype.serialize;


