'use strict';
/**
 * @namespace P2P.Message
 */
/* jshint curly: false */

var Buffers = require('buffers');
var Put = require('bufferput');
var util = require('util');

var bitcore = require('bitcore');

var BlockHeaderModel = bitcore.BlockHeader;
var BlockModel = bitcore.Block;
var BufferReader = bitcore.encoding.BufferReader;
var BufferUtil = bitcore.util.buffer;
var Hash = bitcore.crypto.Hash;
var Random = bitcore.crypto.Random;
var TransactionModel = bitcore.Transaction;

var CONNECTION_NONCE = Random.getPseudoRandomBuffer(8);
var PROTOCOL_VERSION = 70000;

/**
 * Static helper for consuming a data buffer until the next message.
 *
 * @name P2P.Message#parseMessage
 * @param{Network} network - the network object
 * @param{Buffer} dataBuffer - the buffer to read from
 * @returns{Message|undefined} A message or undefined if there is nothing to read.
 */
var parseMessage = function(network, dataBuffer) {
  if (dataBuffer.length < 20) return;

  // Search the next magic number
  if (!discardUntilNextMessage(network, dataBuffer)) return;

  var PAYLOAD_START = 16;
  var payloadLen = (dataBuffer.get(PAYLOAD_START)) +
    (dataBuffer.get(PAYLOAD_START + 1) << 8) +
    (dataBuffer.get(PAYLOAD_START + 2) << 16) +
    (dataBuffer.get(PAYLOAD_START + 3) << 24);

  var messageLength = 24 + payloadLen;
  if (dataBuffer.length < messageLength) return;

  var command = dataBuffer.slice(4, 16).toString('ascii').replace(/\0+$/, '');
  var payload = dataBuffer.slice(24, messageLength);
  var checksum = dataBuffer.slice(20, 24);

  var checksumConfirm = Hash.sha256sha256(payload).slice(0, 4);
  if (!BufferUtil.equals(checksumConfirm, checksum)) {
    dataBuffer.skip(messageLength);
    return;
  }

  dataBuffer.skip(messageLength);
  return Message.buildMessage(command, payload);
};

module.exports.parseMessage = parseMessage;

/**
 * @desc Internal function that discards data until another message is found.
 * @name P2P.Message#discardUntilNextMessage
 */
function discardUntilNextMessage(network, dataBuffer) {
  var magicNumber = network.networkMagic;

  var i = 0;
  for (;;) {
    // check if it's the beginning of a new message
    var packageNumber = dataBuffer.slice(0, 4);
    if (BufferUtil.equals(packageNumber, magicNumber)) {
      dataBuffer.skip(i);
      return true;
    }

    // did we reach the end of the buffer?
    if (i > (dataBuffer.length - 4)) {
      dataBuffer.skip(i);
      return false;
    }

    i++; // continue scanning
  }
}

/**
 * Abstract Message that knows how to parse and serialize itself.
 * Concret subclases should implement {fromBuffer} and {getPayload} methods.
 * @name P2P.Message
 */
function Message() {}

/**
 * @value
 * @name P2P.Message.COMMANDS
 */
Message.COMMANDS = {};

/**
 * Look up a message type by command name and instantiate the correct Message
 * @name P2P.Message#buildMessage
 */
Message.buildMessage = function(command, payload) {
  try {
    var CommandClass = Message.COMMANDS[command];
    return new CommandClass().fromBuffer(payload);
  } catch (err) {
    console.log('Error while parsing message', err);
  }
};

/**
 * Parse instance state from buffer.
 *
 * @param{Buffer} payload - the buffer to read from
 * @returns{Message} The same message instance
 */
Message.prototype.fromBuffer = function(payload) {
  /* jshint unused: false */
  return this;
};

/**
 * Serialize the payload into a buffer.
 *
 * @returns{Buffer} the serialized payload
 */
Message.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

/**
 * Serialize the message into a buffer.
 *
 * @returns{Buffer} the serialized message
 */
Message.prototype.serialize = function(network) {
  var magic = network.networkMagic;
  var commandBuf = new Buffer(this.command, 'ascii');
  if (commandBuf.length > 12) throw 'Command name too long';

  var payload = this.getPayload();
  var checksum = Hash.sha256sha256(payload).slice(0, 4);

  // -- HEADER --
  var message = new Put();
  message.put(magic);
  message.put(commandBuf);
  message.pad(12 - commandBuf.length); // zero-padded
  message.word32le(payload.length);
  message.put(checksum);

  // -- BODY --
  message.put(payload);

  return message.buffer();
};

module.exports.Message = Message;

/**
 * The version message(`ver`) is used on connection creation, to advertise
 * the type of node.The remote node will respond with its version, and no
 * communication is possible until both peers have exchanged their versions.
 * By default, bitcore advertises itself as named `bitcore:0.8`.
 *
 * @name P2P.Message.Version
 * @param{string} subversion - version of the client
 * @param{Buffer} nonce - a random 8 bytes buffer
 */
function Version(subversion, nonce) {
  var packageInfo = require('../package.json');
  this.command = 'version';
  this.version = PROTOCOL_VERSION;
  this.subversion = subversion || '/bitcore:' + packageInfo.version + '/';
  this.nonce = nonce || CONNECTION_NONCE;
}
util.inherits(Version, Message);

Version.prototype.fromBuffer = function(payload) {
  var parser = new BufferReader(payload);

  /**
   * @type {number}
   * @desc The version of the bitcoin protocol
   */
  this.version = parser.readUInt32LE();
  /**
   * @type {BN}
   * @desc A mapbit with service bits: what features are supported by the peer
   */
  this.services = parser.readUInt64LEBN();
  /**
   * @type {BN}
   * @desc The time this message was sent
   */
  this.timestamp = parser.readUInt64LEBN();
  /**
   * @type {Buffer}
   * @desc IPv4/6 address of the interface used to connect to this peer
   */
  this.addr_me = parser.read(26);
  /**
   * @type {Buffer}
   * @desc IPv4/6 address of the peer
   */
  this.addr_you = parser.read(26);
  /**
   * @type {Buffer}
   * @desc A random number
   */
  this.nonce = parser.read(8);
  /**
   * @desc A random number
   * @type {string}
   */
  this.subversion = parser.readVarintBuf().toString();
  /**
   * @desc The height of the last block accepted in the blockchain by this peer
   * @type {number}
   */
  this.start_height = parser.readUInt32LE();

  return this;
};

Version.prototype.getPayload = function() {
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

module.exports.Version = Message.COMMANDS.version = Version;

/**
 * From the bitcoin protocol spec: "Allows a node to advertise its knowledge of
 * one or more objects. It can be received unsolicited, or in reply to
 * getblocks.".
 *
 * @name P2P.Message.Inventory
 * @param{Array} inventory - reported elements
 */
function Inventory(inventory) {
  this.command = 'inv';
  /**
   * @name P2P.Message.Inventory.inventory
   * @desc An array of objects with `{type: int, hash: buffer}` signature
   * @type {Array.Buffer}
   */
  this.inventory = inventory || [];
}
util.inherits(Inventory, Message);

Inventory.prototype.fromBuffer = function(payload) {
  var parser = new BufferReader(payload);
  var count = parser.readVarintNum();
  for (var i = 0; i < count; i++) {
    this.inventory.push({
      type: parser.readUInt32LE(),
      hash: parser.read(32)
    });
  }

  return this;
};

Inventory.prototype.getPayload = function() {
  var put = new Put();
  
  put.varint(this.inventory.length);
  this.inventory.forEach(function(value) {
    put.word32le(value.type);
    put.put(value.hash);
  });
  
  return put.buffer();
};

module.exports.Inventory = Message.COMMANDS.inv = Inventory;

/**
 * getdata is used in response to inv, to retrieve the content of a specific
 * object, and is usually sent after receiving an inv packet, after filtering
 * known elements. It can be used to retrieve transactions, but only if they
 * are in the memory pool or relay set - arbitrary access to transactions in the
 * chain is not allowed to avoid having clients start to depend on nodes having
 * full transaction indexes (which modern nodes do not).
 *
 * (taken from bitcoin's protocol spec)
 *
 * @name P2P.Message.GetData
 * @param{Array} inventory - requested elements
 */
function GetData(inventory) {
  this.command = 'getdata';
  this.inventory = inventory || [];
}

util.inherits(GetData, Inventory);
module.exports.GetData = GetData;

/**
 * Sent to another peer mainly to check the connection is still alive.
 *
 * @name P2P.Message.Ping
 * @param{Buffer} nonce - a random 8 bytes buffer
 */
function Ping(nonce) {
  this.command = 'ping';
  /**
   * @desc A random number that should be returned by the peer in a pong message 
   * @type {number}
   */
  this.nonce = nonce || CONNECTION_NONCE;
}
util.inherits(Ping, Message);

Ping.prototype.fromBuffer = function(payload) {
  this.nonce = new BufferReader(payload).read(8);
  return this;
};

Ping.prototype.getPayload = function() {
  return this.nonce;
};

module.exports.Ping = Message.COMMANDS.ping = Ping;

/**
 * Sent in response to a Ping message
 *
 * @name P2P.Message.Pong
 * @param{Buffer} nonce - a random 8 bytes buffer
 */
function Pong(nonce) {
  this.command = 'pong';
  /**
   * @desc A random number that must match the one sent in the corresponding `ping` message 
   * @type {number}
   */
  this.nonce = nonce || CONNECTION_NONCE;
}

util.inherits(Pong, Ping);
module.exports.Pong = Message.COMMANDS.pong = Pong;

/**
 * Message used to notify about known addresses.
 *
 * @name P2P.Message.Addressess
 * @param{Array} addresses - array of know addresses
 */
function Addresses(addresses) {
  this.command = 'addr';
  /**
   * @type {Array.Buffer}
   * @desc An array of ipv4/6 addresses
   */
  this.addresses = addresses || [];
}
util.inherits(Addresses, Message);

Addresses.prototype.fromBuffer = function(payload) {
  var parser = new BufferReader(payload);
  var addrCount = Math.min(parser.readVarintNum(), 1000);

  this.addresses = [];
  for (var i = 0; i < addrCount; i++) {
    // TODO: Time actually depends on the version of the other peer (>=31402)

    var time = parser.readUInt32LE();
    var services = parser.readUInt64LEBN();

    // parse the ipv6 to a string
    var ipv6 = [];
    for (var a = 0; a < 6; a++) {
      ipv6.push(parser.read(2).toString('hex'));
    }
    ipv6 = ipv6.join(':');

    // parse the ipv4 to a string
    var ipv4 = [];
    for (var b = 0; b < 4; b++) {
      ipv4.push(parser.read(1)[0]);
    }
    ipv4 = ipv4.join('.');

    var port = parser.readUInt16BE();

    this.addresses.push({
      time: time,
      services: services,
      ip: { v6: ipv6, v4: ipv4 },
      port: port
    });
  }

  return this;
};

Addresses.prototype.getPayload = function() {
  var put = new Put();
  put.varint(this.addresses.length);

  for (var i = 0; i < this.addresses.length; i++) {
    put.word32le(this.addresses[i].time);
    put.word64le(this.addresses[i].services);
    put.put(this.addresses[i].ip);
    put.word16be(this.addresses[i].port);
  }

  return put.buffer();
};

module.exports.Addresses = Message.COMMANDS.addr = Addresses;

/**
 * Query another node for known IPV4/6 addresses.
 *
 * @name P2P.Message.GetAddresses
 */
function GetAddresses() {
  this.command = 'getaddr';
}

util.inherits(GetAddresses, Message);
module.exports.GetAddresses = Message.COMMANDS.getaddr = GetAddresses;

/**
 * Finishes the connection handshake started by the `ver` message.
 *
 * @name P2P.Message.VerAck
 */
function VerAck() {
  this.command = 'verack';
}

util.inherits(VerAck, Message);
module.exports.VerAck = Message.COMMANDS.verack = VerAck;

/**
 * A reject message should be sent when a message is not supported or
 * interpreted as invalid.
 *
 * @name P2P.Message.Reject
 */
function Reject() {
  this.command = 'reject';
}
util.inherits(Reject, Message);

// TODO: Parse REJECT message

module.exports.Reject = Message.COMMANDS.reject = Reject;

/**
 * Used to send a message signed by a developer of the bitcoin project.
 *
 * @name P2P.Message.Alert
 */
function Alert(payload, signature) {
  this.command = 'alert';
  this.payload = payload || new Buffer(32);
  this.signature = signature || new Buffer(32);
}
util.inherits(Alert, Message);

Alert.prototype.fromBuffer = function(payload) {
  var parser = new BufferReader(payload);
  this.payload = parser.readVarintBuf(); // TODO: Use current format
  this.signature = parser.readVarintBuf();
  return this;
};

Alert.prototype.getPayload = function() {
  var put = new Put();
  put.varint(this.payload.length);
  put.put(this.payload);

  put.varint(this.signature.length);
  put.put(this.signature);

  return put.buffer();
};

module.exports.Alert = Message.COMMANDS.alert = Alert;

/**
 * Sent in response to a `getheaders` message. It contains information about
 * block headers.
 *
 * @name P2P.Message.Headers
 * @param{Array} blockheaders - array of block headers
 */
function Headers(blockheaders) {
  this.command = 'headers';
  /**
   * @type {Array.BlockHeader}
   * @desc An array of `BlockHeader`
   */
  this.headers = blockheaders || [];
}
util.inherits(Headers, Message);

Headers.prototype.fromBuffer = function(payload) {
  var parser = new BufferReader(payload);
  var count = parser.readVarintNum();

  this.headers = [];
  for (var i = 0; i < count; i++) {
    var header = BlockHeaderModel._fromBufferReader(parser);
    this.headers.push(header);
  }

  return this;
};

Headers.prototype.getPayload = function() {
  var put = new Put();
  put.varint(this.headers.length);

  for (var i = 0; i < this.headers.length; i++) {
    var buffer = this.headers[i].toBuffer();
    put.put(buffer);
  }

  return put.buffer();
};

module.exports.Headers = Message.COMMANDS.headers = Headers;

/**
 * Contains information about a Block
 *
 * @name P2P.Message.Block
 * @param {Block} block
 */
function Block(block) {
  this.command = 'block';

  /**
   * @type {Block}
   * @desc The block received
   */
  this.block = block;
}
util.inherits(Block, Message);

Block.prototype.fromBuffer = function(payload) {
  this.block = BlockModel(payload);
  return this;
};

Block.prototype.getPayload = function() {
  return this.block.toBuffer();
};

module.exports.Block = Message.COMMANDS.block = Block;

/**
 * Contains information about a transaction
 *
 * @name P2P.Message.Transaction
 * @param{Transaction} transaction
 */
function Transaction(transaction) {
  this.command = 'tx';
  /**
   * @type {Transaction}
   */
  this.transaction = transaction;
}
util.inherits(Transaction, Message);

Transaction.prototype.fromBuffer = function(payload) {
  this.transaction = TransactionModel(payload);
  return this;
};

Transaction.prototype.getPayload = function() {
  return this.transaction.toBuffer();
};

module.exports.Transaction = Message.COMMANDS.tx = Transaction;

/**
 * Query another peer about blocks. It can query for multiple block hashes,
 * and the response will contain all the chains of blocks starting from those
 * hashes.
 *
 * @name P2P.Message.GetBlocks
 * @param{Array} starts - array of buffers with the starting block hashes
 * @param{Buffer} [stop] - hash of the last block
 */
function GetBlocks(starts, stop) {
  this.command = 'getblocks';
  /**
   * @type {number}
   */
  this.version = PROTOCOL_VERSION;
  /**
   * @type {Array.Buffer}
   */
  this.starts = starts || [];
  /**
   * @type {Array.Buffer}
   * @desc Hashes to limit the amount of blocks to be sent
   */
  this.stop = stop || BufferUtil.NULL_HASH;
}
util.inherits(GetBlocks, Message);

GetBlocks.prototype.fromBuffer = function(payload) {
  var parser = new BufferReader(payload);
  this.version = parser.readUInt32LE();

  var startCount = Math.min(parser.readVarintNum(), 500);
  this.starts = [];
  for (var i = 0; i < startCount; i++) {
    this.starts.push(parser.read(32));
  }
  this.stop = parser.read(32);

  return this;
};

GetBlocks.prototype.getPayload = function() {
  var put = new Put();
  put.word32le(this.version);
  put.varint(this.starts.length);

  for (var i = 0; i < this.starts.length; i++) {
    if (this.starts[i].length !== 32) {
      throw new Error('Invalid hash length');
    }
    put.put(this.starts[i]);
  }

  if (this.stop.length !== 32) {
    throw new Error('Invalid hash length');
  }
  put.put(this.stop);

  return put.buffer();
};

module.exports.GetBlocks = Message.COMMANDS.getblocks = GetBlocks;

/**
 * Request block headers starting from a hash
 *
 * @name P2P.Message.GetHeaders
 * @param{Array} starts - array of buffers with the starting block hashes
 * @param{Buffer} [stop] - hash of the last block
 */
function GetHeaders(starts, stop) {
  this.command = 'getheaders';
  /**
   * @type {number}
   */
  this.version = PROTOCOL_VERSION;
  /**
   * @type {Array.Buffer}
   */
  this.starts = starts || [];
  /**
   * @type {Array.Buffer}
   */
  this.stop = stop || BufferUtil.NULL_HASH;
}

util.inherits(GetHeaders, GetBlocks);
module.exports.GetHeaders = Message.COMMANDS.getheaders = GetHeaders;

/**
 * Request for transactions on the mempool
 *
 * @name P2P.Message.GetMempool
 */
function GetMempool() {
  this.command = 'mempool';
}

util.inherits(GetMempool, Message);
module.exports.GetMempool = Message.COMMANDS.mempool = GetMempool;

// TODO: Remove this PATCH (yemel)
Buffers.prototype.skip = function (i) {
  if (i === 0) return;

  if (i === this.length) {
    this.buffers = [];
    this.length = 0;
    return;
  }

  var pos = this.pos(i);
  this.buffers = this.buffers.slice(pos.buf);
  this.buffers[0] = new Buffer(this.buffers[0].slice(pos.offset));
  this.length -= i;
};
