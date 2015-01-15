'use strict';

var Buffers = require('buffers');
var EventEmitter = require('events').EventEmitter;
var Net = require('net');
var Socks5Client = require('socks5-client');
var util = require('util');

var Networks = require('../networks');
var Messages = require('./messages');

var MAX_RECEIVE_BUFFER = 10000000;

/**
 * A Peer instance represents a remote bitcoin node and allows to communicate
 * with it using the standar messages of the bitcoin p2p protocol.
 *
 * @example
 * ```javascript
 * 
 * var peer = new Peer('127.0.0.1').setProxy('127.0.0.1', 9050);
 * peer.on('tx', function(tx) {
 *  console.log('New transaction: ', tx.id);
 * });
 * peer.connect();
 * ```
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
    self._sendPong(message.nonce);
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
 * Send a Message to the remote peer.
 *
 * @param {Message} message - A message instance
 */
Peer.prototype.sendMessage = function(message) {
  this.socket.write(message.serialize(this.network));
};

/**
 * Internal function that sends VERSION message to the remote peer.
 */
Peer.prototype._sendVersion = function() {
  var message = new Messages.Version();
  this.sendMessage(message);
};

/**
 * Send a PONG message to the remote peer.
 */
Peer.prototype._sendPong = function(nonce) {
  var message = new Messages.Pong(nonce);
  this.sendMessage(message);
};

/**
 * Internal function that tries to read a message from the data buffer
 */
Peer.prototype._readMessage = function() {
  var message = Messages.parseMessage(this.network, this.dataBuffer);

  if (message) {
    this.emit(message.command, message);
    this._readMessage();
  }
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

module.exports = Peer;
