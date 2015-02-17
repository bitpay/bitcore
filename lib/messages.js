'use strict';
/**
 * @namespace P2P.Message
 */
/* jshint curly: false */

var Buffers = require('buffers');
var Put = require('bufferput');
var util = require('util');

var bitcore = require('bitcore');
var _ = bitcore.deps._;

var BlockHeaderModel = bitcore.BlockHeader;
var BlockModel = bitcore.Block;
var BufferReader = bitcore.encoding.BufferReader;
var BufferUtil = bitcore.util.buffer;
var $ = bitcore.util.preconditions;
var Hash = bitcore.crypto.Hash;
var Random = bitcore.crypto.Random;
var TransactionModel = bitcore.Transaction;

var CONNECTION_NONCE = Random.getPseudoRandomBuffer(8);
var PROTOCOL_VERSION = 70000;

/**
 * @desc Internal function that discards data until another message is found.
 * @name P2P.Message#discardUntilNextMessage
 */
var discardUntilNextMessage = function(network, dataBuffer) {
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
};

/**
 * Abstract Message this knows how to parse and serialize itself.
 * Concrete subclasses should implement {fromBuffer} and {getPayload} methods.
 * @name P2P.Message
 */
function Message() {}

/**
 * @value
 * @name P2P.Message.COMMANDS
 */
Message.COMMANDS = {};

var PAYLOAD_START = 16;
/**
 * Static helper for consuming a data buffer until the next message.
 *
 * @name P2P.Message#parseMessage
 * @param{Network} network - the network object
 * @param{Buffer} dataBuffer - the buffer to read from
 * @returns{Message|undefined} A message or undefined if there is nothing to read.
 */
var parseMessage = function(network, dataBuffer) {
  $.checkArgument(network);
  $.checkArgument(dataBuffer);
  /* jshint maxstatements: 18 */
  if (dataBuffer.length < 20) {
    return;
  }

  // Search the next magic number
  if (!discardUntilNextMessage(network, dataBuffer)) return;

  var payloadLen = (dataBuffer.get(PAYLOAD_START)) +
    (dataBuffer.get(PAYLOAD_START + 1) << 8) +
    (dataBuffer.get(PAYLOAD_START + 2) << 16) +
    (dataBuffer.get(PAYLOAD_START + 3) << 24);

  var messageLength = 24 + payloadLen;
  if (dataBuffer.length < messageLength) {
    return;
  }

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
 * Look up a message type by command name and instantiate the correct Message
 * @name P2P.Message#buildMessage
 */
Message.buildMessage = function(command, payload) {
  var CommandClass = Message.COMMANDS[command];
  $.checkState(CommandClass, 'Unsupported message command: ' + command);
  return new CommandClass().fromBuffer(payload);
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
  $.checkArgument(network, 'Must specify network for serialization');
  var commandBuf = new Buffer(this.command, 'ascii');
  $.checkState(commandBuf.length <= 12, 'Command name too long');
  var magic = network.networkMagic;

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

/**
 * check if parser has no more extra data
 */
Message.prototype._checkFinished = function(parser) {
  $.checkState(parser.finished(), 'data still available after parsing ' + this.constructor.name);
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
function Version(subversion, nonce, relay) {
  var packageInfo = require('../package.json');
  this.command = 'version';
  this.version = PROTOCOL_VERSION;
  this.subversion = subversion || '/bitcore:' + packageInfo.version + '/';
  this.nonce = nonce || CONNECTION_NONCE;
  this.relay = relay === false ? false : true;
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
  this.timestamp = new Date(parser.readUInt64LEBN().toNumber() * 1000);
  /**
   * @type {object}
   * @desc IPv4/6 address of the interface used to connect to this peer
   */
  var me_services = parser.readUInt64LEBN();
  var me_ip = Addresses.parseIP(parser);
  var me_port = parser.readUInt16BE();
  this.addr_me = {
    services: me_services,
    ip: me_ip,
    port: me_port
  };
  /**
   * @type {object}
   * @desc IPv4/6 address of the peer
   */
  var your_services = parser.readUInt64LEBN();
  var your_ip = Addresses.parseIP(parser);
  var your_port = parser.readUInt16BE();
  this.addr_you = {
    services: your_services,
    ip: your_ip,
    port: your_port
  };
  /**
   * @type {Buffer}
   * @desc A random number
   */
  this.nonce = parser.read(8);
  /**
   * @desc The node's user agent / subversion
   * @type {string}
   */
  this.subversion = parser.readVarLengthBuffer().toString();
  /**
   * @desc The height of the last block accepted in the blockchain by this peer
   * @type {number}
   */
  this.start_height = parser.readUInt32LE();

  /**
   * @desc Whether the remote peer should announce relayed transactions or not, see BIP 0037
   * @type {boolean}
   */
  // This field is optional, so should not always be read
  if(parser.finished()) {
    this.relay = true;
  } else {
    this.relay = !!parser.readUInt8();
  }

  this._checkFinished(parser);
  return this;
};

Version.prototype.getPayload = function() {
  var put = new Put();
  put.word32le(this.version);
  put.word64le(1); // services
  put.word64le(Math.round(new Date().getTime() / 1000)); // timestamp
  Addresses.writeAddr(this.addr_me, put);
  Addresses.writeAddr(this.addr_you, put);
  put.put(this.nonce);
  put.varint(this.subversion.length);
  put.put(new Buffer(this.subversion, 'ascii'));
  put.word32le(this.start_height);
  put.word8(this.relay);

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
  $.checkArgument(_.isUndefined(inventory) ||
    _.isArray(inventory), 'Inventory for ' +
    this.constructor.name + ' must be an array of objects');
  $.checkArgument(_.isUndefined(inventory) ||
    inventory.length === 0 ||
    (inventory[0] && !_.isUndefined(inventory[0].type) && !_.isUndefined(inventory[0].hash)),
    'Inventory for ' + this.constructor.name + ' must be an array of objects');
  this.command = 'inv';
  /**
   * @name P2P.Message.Inventory.inventory
   * @desc An array of objects with `{type: int, hash: Buffer}` signature
   * @type {Array.Buffer}
   */
  this.inventory = inventory || [];
}
util.inherits(Inventory, Message);

// https://en.bitcoin.it/wiki/Protocol_specification#Inventory_Vectors 
Inventory.TYPE = {};
Inventory.TYPE.ERROR = 0;
Inventory.TYPE.TX = 1;
Inventory.TYPE.BLOCK = 2;
Inventory.TYPE.FILTERED_BLOCK = 3;
Inventory.TYPE_NAME = [
  'ERROR',
  'TX',
  'BLOCK',
  'FILTERED_BLOCK'
];

Inventory.forItem = function(type, hash) {
  $.checkArgument(hash);
  if (_.isString(hash)) {
    hash = new Buffer(hash, 'hex');
    hash = BufferUtil.reverse(hash);
  }
  return {
    type: type,
    typeName: Inventory.TYPE_NAME[type],
    hash: hash
  };
};

Inventory.prototype.fromBuffer = function(payload) {
  var parser = new BufferReader(payload);
  var count = parser.readVarintNum();
  for (var i = 0; i < count; i++) {
    var type = parser.readUInt32LE();
    var hash = parser.read(32);
    this.inventory.push(Inventory.forItem(type, hash));
  }

  this._checkFinished(parser);
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

var creatorForItem = function(clazz, type) {
  return function(hash) {
    return new clazz([Inventory.forItem(type, hash)]);
  };
};

module.exports.Inventory = Message.COMMANDS.inv = Inventory;

/**
 * notfound is a response to a getdata, sent if any requested data
 * items could not be relayed, for example, because the requested
 * transaction was not in the memory pool or relay set.
 *
 * (from bitcoin's protocol spec)
 *
 * @name P2P.Message.NotFound
 * @param{Array} inventory - not found elements
 */
function NotFound(inventory) {
  Inventory.call(this, inventory);
  this.command = 'notfound';
}

util.inherits(NotFound, Inventory);
module.exports.NotFound = Message.COMMANDS.notfound = NotFound;

/**
 * getdata is used in response to inv, to retrieve the content of a specific
 * object, and is usually sent after receiving an inv packet, after filtering
 * known elements. It can be used to retrieve transactions, but only if they
 * are in the memory pool or relay set - arbitrary access to transactions in the
 * chain is not allowed to avoid having clients start to depend on nodes having
 * full transaction indexes (which modern nodes do not).
 *
 * (from bitcoin's protocol spec)
 *
 * @name P2P.Message.GetData
 * @param{Array} inventory - requested elements
 */
function GetData(inventory) {
  Inventory.call(this, inventory);
  this.command = 'getdata';
  this.inventory = inventory || [];
}


util.inherits(GetData, Inventory);
module.exports.GetData = Message.COMMANDS.getdata = GetData;

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
  var parser = new BufferReader(payload);
  this.nonce = parser.read(8);

  this._checkFinished(parser);
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

Addresses.writeAddr = function(addr, put) {
  if (_.isUndefined(addr)) {
    put.pad(26);
    return;
  }
  put.word64le(addr.services);
  Addresses.writeIP(addr.ip, put);
  put.word16be(addr.port);
};

Addresses.writeIP = function(ip, put) {
  $.checkArgument(ip.v6, 'Need ipv6 to write IP');
  var words = ip.v6.split(':').map(function(s) {
    return new Buffer(s, 'hex');
  });
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    put.put(word);
  }
};

// http://en.wikipedia.org/wiki/IPv6#IPv4-mapped_IPv6_addresses
Addresses.parseIP = function(parser) {
  var ipv6 = [];
  var ipv4 = [];
  for (var a = 0; a < 8; a++) {
    var word = parser.read(2);
    ipv6.push(word.toString('hex'));
    if (a >= 6) {
      ipv4.push(word[0]);
      ipv4.push(word[1]);
    }
  }
  ipv6 = ipv6.join(':');
  ipv4 = ipv4.join('.');

  return {
    v6: ipv6,
    v4: ipv4
  };
};

Addresses.parseAddr = function(parser) {
  var services = parser.readUInt64LEBN();
  var ip = Addresses.parseIP(parser);
  var port = parser.readUInt16BE();
  return {
    services: services,
    ip: ip,
    port: port
  };
};

Addresses.prototype.fromBuffer = function(payload) {
  var parser = new BufferReader(payload);
  var addrCount = Math.min(parser.readVarintNum(), 1000);

  this.addresses = [];
  for (var i = 0; i < addrCount; i++) {
    // TODO: Time actually depends on the version of the other peer (>=31402)
    var time = new Date(parser.readUInt32LE() * 1000);

    var addr = Addresses.parseAddr(parser);
    addr.time = time;

    this.addresses.push(addr);
  }

  this._checkFinished(parser);
  return this;
};

Addresses.prototype.getPayload = function() {
  var put = new Put();
  put.varint(this.addresses.length);

  for (var i = 0; i < this.addresses.length; i++) {
    var addr = this.addresses[i];
    put.word32le(addr.time);
    Addresses.writeAddr(addr, put);
    break;
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
  this.payload = parser.readVarLengthBuffer();
  this.signature = parser.readVarLengthBuffer();
  this._checkFinished(parser);
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
  $.checkArgument(payload && payload.length > 0, 'No data found to create Headers message');
  var parser = new BufferReader(payload);
  var count = parser.readVarintNum();

  this.headers = [];
  for (var i = 0; i < count; i++) {
    var header = BlockHeaderModel.fromBufferReader(parser);
    this.headers.push(header);
    var txn_count = parser.readUInt8();
    $.checkState(txn_count === 0, 'txn_count should always be 0');

  }
  this._checkFinished(parser);
  return this;
};

Headers.prototype.getPayload = function() {
  var put = new Put();
  put.varint(this.headers.length);

  for (var i = 0; i < this.headers.length; i++) {
    var buffer = this
      .headers[i]
      .toBuffer();
    put.put(buffer);
    put.varint(0);
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
  $.checkArgument(_.isUndefined(block) || block instanceof BlockModel);
  this.command = 'block';

  /**
   * @type {Block}
   * @desc The block received
   */
  this.block = block;
}
util.inherits(Block, Message);

Block.prototype.fromBuffer = function(payload) {
  $.checkArgument(BufferUtil.isBuffer(payload));
  var block = BlockModel(payload);
  return new Block(block);
};

Block.prototype.getPayload = function() {
  return this.block ? this.block.toBuffer() : new Buffer(0);
};

module.exports.Block = Message.COMMANDS.block = Block;

/**
 * Contains information about a transaction
 *
 * @name P2P.Message.Transaction
 * @param{Transaction} transaction
 */
function Transaction(transaction) {
  $.checkArgument(_.isUndefined(transaction) || transaction instanceof TransactionModel);
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
  return this.transaction ? this.transaction.toBuffer() : new Buffer(0);
};

module.exports.Transaction = Message.COMMANDS.tx = Transaction;

/**
 * Query another peer about blocks. It can query for multiple block hashes,
 * and the response will contain all the chains of blocks starting from those
 * hashes.
 *
 * @name P2P.Message.GetBlocks
 * @param{Array} starts - array of buffers or strings with the starting block hashes
 * @param{Buffer} [stop] - hash of the last block
 */
function GetBlocks(starts, stop) {
  $.checkArgument(_.isUndefined(starts) || _.isArray(starts));
  this.command = 'getblocks';
  /**
   * @type {number}
   */
  this.version = PROTOCOL_VERSION;

  starts = starts ? starts.map(function(hash) {
    return _.isString(hash) ? BufferUtil.reverse(new Buffer(hash, 'hex')) : hash;
  }) : undefined;
  /**
   * @type {Array.Buffer}
   */
  this.starts = starts || [];

  for (var i = 0; i < this.starts.length; i++) {
    if (this.starts[i].length !== 32) {
      throw new Error('Invalid hash ' + i + ' length: ' + this.starts[i].length);
    }
  }
  /**
   * @type {Array.Buffer}
   * @desc Hashes to limit the amount of blocks to be sent
   */
  this.stop = (_.isString(stop) ? BufferUtil.reverse(new Buffer(stop, 'hex')) : stop) || BufferUtil.NULL_HASH;
}
util.inherits(GetBlocks, Message);

GetBlocks.prototype.fromBuffer = function(payload) {
  var parser = new BufferReader(payload);
  $.checkArgument(!parser.finished(), 'No data received in payload');
  this.version = parser.readUInt32LE();

  var startCount = Math.min(parser.readVarintNum(), 500);
  this.starts = [];
  for (var i = 0; i < startCount; i++) {
    this.starts.push(parser.read(32));
  }
  this.stop = parser.read(32);
  this._checkFinished(parser);

  return this;
};

GetBlocks.prototype.getPayload = function() {
  var put = new Put();
  put.word32le(this.version);
  put.varint(this.starts.length);

  for (var i = 0; i < this.starts.length; i++) {
    put.put(this.starts[i]);
  }

  if (this.stop.length !== 32) {
    throw new Error('Invalid hash length: ' + this.stop.length);
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
  GetBlocks.call(this, starts, stop);
  this.command = 'getheaders';
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
Buffers.prototype.skip = function(i) {
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



[Inventory, GetData, NotFound].forEach(function(clazz) {
  clazz.forBlock = creatorForItem(clazz, Inventory.TYPE.BLOCK);
  clazz.forTransaction = creatorForItem(clazz, Inventory.TYPE.TX);
});
