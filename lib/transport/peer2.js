'use strict';

var util = require('util');
var Net = require('net');
var Put = require('bufferput');
var Buffers = require('buffers');
var buffertools = require('buffertools');
var Socks5Client = require('socks5-client');
var EventEmitter = require('events').EventEmitter;

var Networks = require('../networks');
var Hash = require('../crypto/hash');
var Message = require('./message');

var MAX_RECEIVE_BUFFER = 10000000;

/**
 * A Peer instance represents a remote bitcoin node and allows to communicate
 * with it using the standar messages of the bitcoin p2p protocol.
 *
 * @example
 * 
 * var peer = new Peer('127.0.0.1').setProxy('127.0.0.1', 9050);
 * peer.on('tx', function(tx) {
 *  console.log('New transaction: ', tx.id);
 * });
 * peer.connect();
 *
 * @param {String} host - IP address of the remote host
 * @param {Number} [port] - Port number of the remote host
 * @param {Network} [network] - The context for this communication
 * @returns {Peer} A new instance of Peer.
 * @constructor
 */
function Peer(host, port, network) {
  if (!(this instanceof Peer)) {
    return new Peer(host, port, network);
  }

  // overloading stuff
  if (port instanceof Object && !network) {
    network = port;
    port = undefined;
  }
  
  this.host = host;
  this.status = Peer.STATUS.DISCONNECTED;
  this.network = network || Networks.livenet;
  this.port = port || this.network.port;

  this.dataBuffer = new Buffers();

  this.version = 0;
  this.bestHeight = 0;
  this.subversion = null;

  // set message handlers
  var self = this;
  this.on('verack', function() {
    self.status = Peer.STATUS.READY;
    self.emit('ready');
  });

  this.on('version', function(message) {
    self.version = message.version;
    self.subversion = message.subversion;
    self.bestHeight = message.start_height
  });

  this.on('ping', function(message) {
    self.sendPong(message.nonce);
  });

}
util.inherits(Peer, EventEmitter);

Peer.STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  READY: 'ready'
};

/**
 * Set a socks5 proxy for the connection. Enables the use of the TOR network.
 *
 * @param {String} host - IP address of the proxy
 * @param {Number} port - Port number of the proxy
 * @returns {Peer} The same Peer instance.
 */
Peer.prototype.setProxy = function(host, port) {
  if (this.status != Peer.STATUS.DISCONNECTED) {
    throw Error('Invalid State');
  }

  this.proxy = {
    host: host,
    port: port
  };
  return this;
};

/**
 * Init the connection with the remote peer.
 *
 * @returns {Socket} The same peer instance.
 */
Peer.prototype.connect = function() {
  this.socket = this._getSocket();
  this.status = Peer.STATUS.CONNECTING;

  var self = this;
  this.socket.on('connect', function(ev) {
    self.status = Peer.STATUS.CONNECTED;
    self.emit('connect');
    self._sendVersion();
  });

  this.socket.on('error', self.disconnect.bind(this));
  this.socket.on('end', self.disconnect.bind(this));

  this.socket.on('data', function(data) {
    self.dataBuffer.push(data);
    
    if (self.dataBuffer.length > MAX_RECEIVE_BUFFER) return self.disconnect();
    self._readMessage();
  });

  this.socket.connect(this.port, this.host);
  return this;
};

/**
 * Disconnects the remote connection.
 *
 * @returns {Socket} The same peer instance.
 */
Peer.prototype.disconnect = function() {
  this.status = Peer.STATUS.DISCONNECTED;
  this.socket.destroy();
  this.emit('disconnect');
  return this;
};

/**
 * Internal function that tries to read a message from the data buffer
 */
Peer.prototype._readMessage = function() {
  if (this.dataBuffer.length < 20) return;
  var magic = this.network.networkMagic;

  // Search the next magic number
  if (!this._discardUntilNextMessage()) return;

  var PAYLOAD_START = 16;
  var payloadLen = (this.dataBuffer.get(PAYLOAD_START)) +
    (this.dataBuffer.get(PAYLOAD_START + 1) << 8) +
    (this.dataBuffer.get(PAYLOAD_START + 2) << 16) +
    (this.dataBuffer.get(PAYLOAD_START + 3) << 24);

  var messageLength = 24 + payloadLen;
  if (this.dataBuffer.length < messageLength) return;

  var command = this.dataBuffer.slice(4, 16).toString('ascii').replace(/\0+$/, '');
  var payload = this.dataBuffer.slice(24, messageLength);
  var checksum = this.dataBuffer.slice(20, 24);

  var checksumConfirm = Hash.sha256sha256(payload).slice(0, 4);
  if (buffertools.compare(checksumConfirm, checksum) !== 0) {
    this.dataBuffer.skip(messageLength);
    return;
  }

  console.log('we have a message:', command);
  var message = Message.buildMessage(command, payload);
  if (message) this.emit(command, message);
  console.log('Emiting message', command, message);

  this.dataBuffer.skip(messageLength);
  this._readMessage();
};

/**
 * Internal function that discards data until founds the next message.
 */
Peer.prototype._discardUntilNextMessage = function() {
  var magicNumber = this.network.networkMagic;

  var i = 0;
  for (;;) {
    // check if it's the beginning of a new message
    var packageNumber = this.dataBuffer.slice(0, 4);
    if (buffertools.compare(packageNumber, magicNumber) == 0) {
      this.dataBuffer.skip(i);
      return true;
    }

    // did we reach the end of the buffer?
    if (i > (this.dataBuffer.length - 4)) {
      this.dataBuffer.skip(i);
      return false;
    }

    i++; // continue scanning
  }
}

/**
 * Internal function that sends VERSION message to the remote peer.
 */
Peer.prototype._sendVersion = function() {
  var message = new Message.Version();
  this._sendMessage(message.command, message.serialize());
};

/**
 * Send a PING message to the remote peer.
 */
Peer.prototype.sendPing = function(nonce) {
  var message = new Message.Pong(nonce);
  this._sendMessage(message.command, message.serialize());
};

/**
 * Send a PONG message to the remote peer.
 */
Peer.prototype.sendPong = function(nonce) {
  var message = new Message.Pong(nonce);
  this._sendMessage(message.command, message.serialize());
};

/**
 * Internal function that sends a message to the remote peer.
 */
Peer.prototype._sendMessage = function(command, payload) {
  var magic = this.network.networkMagic;
  var commandBuf = new Buffer(command, 'ascii');
  if (commandBuf.length > 12) throw 'Command name too long';

  var checksum = Hash.sha256sha256(payload).slice(0, 4);

  // -- HEADER --
  var message = new Put();
  message.put(magic); // magic bytes
  message.put(commandBuf); // command name
  message.pad(12 - commandBuf.length); // zero-padded
  message.word32le(payload.length); // payload length
  message.put(checksum); // checksum

  // -- BODY --
  message.put(payload); // payload data

  this.socket.write(message.buffer());
};

/**
 * Internal function that creates a socket using a proxy if neccesary.
 *
 * @returns {Socket} A Socket instance not yet connected.
 */
Peer.prototype._getSocket = function() {
  if (this.proxy) {
    return new Socks5Client(this.proxy.host, this.proxy.port);
  }

  return new Net.Socket();
};


// TODO: Remove this PATCH (yemel)
Buffers.prototype.skip = function (i) {
  if (i == 0) return;

  if (i == this.length) {
    this.buffers = [];
    this.length = 0;
    return;
  }

  var pos = this.pos(i);
  this.buffers = this.buffers.slice(pos.buf);
  this.buffers[0] = new Buffer(this.buffers[0].slice(pos.offset));
  this.length -= i;
};

module.exports = Peer;
