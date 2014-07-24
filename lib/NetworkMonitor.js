var log = require('../util/log');
var networks = require('../networks');
var Address = require('./Address');
var Peer = require('./Peer');
var PeerManager = require('./PeerManager');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var preconditions = require('preconditions').singleton();

var NetworkMonitor = function(peerman) {
  preconditions.checkArgument(peerman);
  this.peerman = peerman;
  this.networkName = peerman.config.network;
  this.init();
}

util.inherits(NetworkMonitor, EventEmitter);

NetworkMonitor.create = function(config) {
  this.config = config;
  var peerman = new PeerManager({
    network: config.networkName
  });

  peerman.addPeer(new Peer(config.host, config.port));
  return new NetworkMonitor(peerman);
};

NetworkMonitor.prototype.init = function() {
  var self = this;
  var handleInv = function(info) {
    var invs = info.message.invs;
    info.conn.sendGetData(invs);
  };

  var handleBlock = function(info) {
    self.emit('block', info.message);
  };

  var handleTx = function(info) {
    var tx = info.message.tx;
    self.emit('tx', tx);
    
    var from = tx.getSendingAddresses(self.networkName);
    for (var i = 0; i < from.length; i++) {
      var addr = from[i];
      self.emit('out:'+addr, tx);
    }
    var to = tx.getReceivingAddresses(self.networkName); 
    for (var i = 0; i < to.length; i++) {
      var addr = to[i];
      self.emit('in:'+addr, tx);
    }
  };

  this.peerman.on('connection', function(conn) {
    if (self.connection) throw new Error('Cant handle more than one connection');
    self.connection = conn;
    conn.on('inv', handleInv);
    conn.on('block', handleBlock);
    conn.on('tx', handleTx);
  });
};

NetworkMonitor.prototype.incoming = function(addrStr, callback) {
  preconditions.checkArgument(Address.validate(addrStr));
  this.on('in:'+addrStr, callback);
};

NetworkMonitor.prototype.outgoing = function(addrStr, callback) {
  preconditions.checkArgument(Address.validate(addrStr));
  this.on('out:'+addrStr, callback);
};

NetworkMonitor.prototype.start = function() {
  this.peerman.start();
};

NetworkMonitor.prototype.stop = function() {
  this.peerman.stop();
};

module.exports = NetworkMonitor;
