'use strict';
var util = require('util');
var cluster = require('cluster');
var EventEmitter = require('events').EventEmitter;
var bcoin = require('bcoin');
var Peer = bcoin.peer;
var NetAddress = bcoin.netaddress;
var Network = bcoin.network;
var network = Network.get('main');

var addr = NetAddress.fromHostname('127.0.0.1', 'main');


var P2pService = function() {
  this.peer = Peer.fromOptions({
    network: 'main',
    agent: 'fullNodePlus',
    hasWitness: function(){
      return false;
    }
  });
};

util.inherits(P2pService, EventEmitter);

P2pService.prototype.start = function(ready) {
  var self = this;
  if (cluster.isWorker){
    return setImmediate(ready);
  }
  this.peer.on('packet', function(msg){
    if(msg.cmd === 'block') {
      var block = msg.block.toBlock();
      var rhash = block.rhash();
      self.emit(block.rhash(), block);
      return;
    }
    if(msg.cmd === 'headers') {
      self.emit('headers', msg.items);
      return;
    }

    if(msg.cmd === 'inv') {
      self.emit('inv', msg.items);
      return;
    }
  });
  this.peer.connect(addr);
  this.peer.tryOpen();
  this.peer.on('open', function(){
    ready();
  });
};

P2pService.prototype.stop = function() {

};

P2pService.prototype.getPeerHeight = function() {
  return this.peer.height;
};

P2pService.prototype.getHeaders = function(candidateHashes, callback) {
  candidateHashes = candidateHashes.map(function(candidateHash){
    return bcoin.util.revHex(candidateHash);
  });
  this.peer.sendGetHeaders(candidateHashes);
  this.once('headers', function(headers){
    headers.map(function(header){
      return header.getJSON();
    });
    callback(null, headers);
  });
};

P2pService.prototype.getBlock = function(hash, callback) {
  var self = this;
  self.peer.getBlock([hash]);
  var rhash = bcoin.util.revHex(hash);
  self.once(rhash, function(block){
    callback(null, block);
  });
};


module.exports = new P2pService();