'use strict';

var Buffers = require('./buffers');
var EventEmitter = require('events').EventEmitter;
var Net = require('net');
var Socks5Client = require('socks5-client');
var bitcore = require('bitcore');
var Networks = bitcore.Networks;
var Messages = require('./messages');
var $ = bitcore.util.preconditions;
var util = require('util');

/**
 * A Peer instance represents a remote bitcoin node and allows to communicate
 * with it using the standard messages of the bitcoin p2p protocol.
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
function Peer(options) {
  /* jshint maxstatements: 20 */
  /* jshint maxcomplexity: 8 */

  if (!(this instanceof Peer)) {
    return new Peer(options);
  }

  this.host = options.host || 'localhost';
  this.status = Peer.STATUS.DISCONNECTED;
  this.port = options.port;


  this.network = Networks.get(options.network) || Networks.defaultNetwork;
  if (!this.port) {
    this.port = this.network.port;
  }

  this.messages = options.messages || new Messages({
    magicNumber: this.network.networkMagic.readUInt32LE(0),
    Block: bitcore.Block,
    Transaction: bitcore.Transaction
  });

  this.dataBuffer = new Buffers();

  this.version = 0;
  this.bestHeight = 0;
  this.subversion = null;
  this.relay = options.relay === false ? false : true;

  // set message handlers
  var self = this;
  this.on('verack', function() {
    self.status = Peer.STATUS.READY;
    self.emit('ready');
  });

  this.on('version', function(message) {
    self.version = message.version;
    self.subversion = message.subversion;
    self.bestHeight = message.startHeight;
  });

  this.on('ping', function(message) {
    self._sendPong(message.nonce);
  });

}
util.inherits(Peer, EventEmitter);

Peer.MAX_RECEIVE_BUFFER = 10000000;
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
  $.checkState(this.status === Peer.STATUS.DISCONNECTED);

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

  this.socket.on('error', self._onError.bind(this));
  this.socket.on('end', self.disconnect.bind(this));

  this.socket.on('data', function(data) {
    self.dataBuffer.push(data);

    if (self.dataBuffer.length > Peer.MAX_RECEIVE_BUFFER) {
      // TODO: handle this case better
      return self.disconnect();
    }
    self._readMessage();
  });

  this.socket.connect(this.port, this.host);
  return this;
};

Peer.prototype._onError = function(e) {
  this.emit('error', e);
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
  this.socket.write(message.toBuffer());
};

/**
 * Internal function that sends VERSION message to the remote peer.
 */
Peer.prototype._sendVersion = function() {
  // todo: include sending ip address
  var message = this.messages.build('version', {
    relay: this.relay
  });
  this.sendMessage(message);
};

/**
 * Send a PONG message to the remote peer.
 */
Peer.prototype._sendPong = function(nonce) {
  var message = this.messages.build('pong', {
    nonce: nonce
  });
  this.sendMessage(message);
};

/**
 * Internal function that tries to read a message from the data buffer
 */
Peer.prototype._readMessage = function() {
  var message = this.messages.parseBuffer(this.dataBuffer);
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
