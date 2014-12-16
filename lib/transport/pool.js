'use strict';

var dns = require('dns');
var EventEmitter = require('events').EventEmitter;
var Networks = require('../networks');
var sha256 = require('../crypto/hash').sha256;
var Peer = require('./peer');
var util = require('util');

function now() {
  return Math.floor(new Date().getTime() / 1000);
}

/**
 * A pool is a collection of Peers. A pool will discover peers from DNS seeds, and
 * collect information about new peers in the network. When a peer disconnects the pool
 * will connect to others that are available to maintain a max number of
 * ongoing peer connections. Peer events are relayed to the pool.
 *
 * @example
 *
 * var pool = new Pool(Networks.livenet);
 * pool.on('peerinv', function(peer, message) {
 *   // do something with the inventory announcement
 * });
 * pool.connect();
 *
 * @param {Network|String} network - The network to connect
 * @returns {Pool}
 * @constructor
 */
function Pool(network) {

  var self = this;

  this.network = Networks.get(network) || Networks.defaultNetwork;
  this.connectedPeers = {};
  this.addrs = [];
  this.keepalive = false;

  this.on('peeraddr', function peerAddrEvent(peer, message) {
    var addrs = message.addresses;
    var length = addrs.length;
    for (var i = 0; i < length; i++) {
      var addr = addrs[i];
      // In case of an invalid time, assume "5 days ago"
      if (addr.time <= 100000000 || addr.time > (now() + 10 * 60)) {
        addr.time = now() - 5 * 24 * 60 * 60;
      }
      this.addAddr(addr);
    }
  });

  this.on('seed', function seedEvent(ips) {
    ips.forEach(function(ip) {
      self.addAddr({
        ip: {
          v4: ip
        }
      });
    });
    if (self.keepalive) {
      self.fillConnections();
    }
  });

  this.on('peerdisconnect', function peerDisconnectEvent(peer, addr) {
    self.deprioritizeAddr(addr);
    self.removeConnectedPeer(addr);
    if (self.keepalive) {
      self.fillConnections();
    }
  });

  return this;

}

util.inherits(Pool, EventEmitter);

Pool.MaxConnectedPeers = 8;
Pool.RetrySeconds = 30;
Pool.PeerEvents = ['version', 'inv', 'getdata', 'ping', 'ping', 'addr',
  'getaddr', 'verack', 'reject', 'alert', 'headers', 'block',
  'tx', 'getblocks', 'getheaders'
];


/**
 * Will initiatiate connection to peers, if available peers have been added to
 * the pool, it will connect to those, otherwise will use DNS seeds to find
 * peers to connect. When a peer disconnects it will add another.
 */
Pool.prototype.connect = function connect() {
  this.keepalive = true;
  var self = this;
  if (self.addrs.length === 0) {
    self.addAddrsFromSeeds();
  } else {
    self.fillConnections();
  }
  return this;
};


/**
 * Will disconnect all peers that are connected.
 */
Pool.prototype.disconnect = function disconnect() {
  this.keepalive = false;
  for (var i in this.connectedPeers) {
    this.connectedPeers[i].disconnect();
  }
  return this;
};

/**
 * @returns {Boolean} If the pool has peers (addrs) available to connect.
 */
Pool.prototype.isAvailable = function isAvailable() {
  if (this.addrs.length > 0) {
    return true;
  }
  return false;
};

/**
 * @returns {Boolean} If there are peers connected.
 */
Pool.prototype.isConnected = function isConnected() {
  if (this.numberConnected() > 0) {
    return true;
  }
  return false;
};

/**
 * @returns {Number} The number of peers currently connected.
 */
Pool.prototype.numberConnected = function numberConnected() {
  return Object.keys(this.connectedPeers).length;
};

/**
 * Will fill the conneted peers to the maximum amount.
 */
Pool.prototype.fillConnections = function fillConnections() {
  var length = this.addrs.length;
  for (var i = 0; i < length; i++) {
    if (this.numberConnected() >= Pool.MaxConnectedPeers) {
      break;
    }
    var addr = this.addrs[i];
    if (!addr.retryTime || now() > addr.retryTime) {
      this.connectPeer(addr);
    }
  }
  return this;
};

/**
 * Will remove a peer from the list of connected peers.
 * @param {Object} addr - An addr from the list of addrs
 */
Pool.prototype.removeConnectedPeer = function removeConnectedPeer(addr) {
  if (this.connectedPeers[addr.hash].status !== Peer.STATUS.DISCONNECTED) {
    this.connectedPeers[addr.hash].disconnect();
  } else {
    delete this.connectedPeers[addr.hash];
  }
  return this;
};

/**
 * Will connect a peer and add to the list of connected peers.
 * @param {Object} addr - An addr from the list of addrs
 */
Pool.prototype.connectPeer = function connectPeer(addr) {
  var self = this;

  function addConnectedPeer(addr) {
    var port = addr.port || self.network.port;
    var ip = addr.ip.v4 || addr.ip.v6;
    var peer = new Peer(ip, port, self.network);
    peer.on('disconnect', function peerDisconnect() {
      self.emit('peerdisconnect', peer, addr);
    });
    peer.on('ready', function peerReady() {
      self.emit('peerready', peer, addr);
    });
    Pool.PeerEvents.forEach(function addPeerEvents(event) {
      peer.on(event, function peerEvent(message) {
        self.emit('peer' + event, peer, message);
      });
    });
    peer.connect();
    self.connectedPeers[addr.hash] = peer;
  }

  if (!this.connectedPeers[addr.hash]) {
    addConnectedPeer(addr);
  }

  return this;
};

/**
 * Will deprioritize an addr in the list of addrs by moving it to the end
 * of the array, and setting a retryTime
 * @param {Object} addr - An addr from the list of addrs
 */
Pool.prototype.deprioritizeAddr = function deprioritizeAddr(addr) {
  for (var i = 0; i < this.addrs.length; i++) {
    if (this.addrs[i].hash === addr.hash) {
      var middle = this.addrs[i];
      middle.retryTime = now() + Pool.RetrySeconds;
      var beginning = this.addrs.splice(0, i);
      var end = this.addrs.splice(i + 1, this.addrs.length);
      var combined = beginning.concat(end);
      this.addrs = combined.concat([middle]);
    }
  }
  return this;
};

/**
 * Will add an addr to the beginning of the addrs array
 * @param {Object}
 */
Pool.prototype.addAddr = function addAddr(addr) {

  // make a unique key
  addr.hash = sha256(new Buffer(addr.ip.v6 + addr.ip.v4 + addr.port)).toString('hex');

  var length = this.addrs.length;
  var exists = false;
  for (var i = 0; i < length; i++) {
    if (this.addrs[i].hash === addr.hash) {
      exists = true;
    }
  }
  if (!exists) {
    this.addrs.unshift(addr);
  }
  return this;
};

/**
 * Will add addrs to the list of addrs from a DNS seed
 * @param {String} seed - A domain name to resolve known peers
 * @param {Function} done
 */
Pool.prototype.addAddrsFromSeed = function addAddrsFromSeed(seed) {
  var self = this;
  dns.resolve(seed, function(err, ips) {
    if (err) {
      self.emit('seederror', err);
      return;
    }
    if (!ips || !ips.length) {
      self.emit('seederror', new Error('No IPs found from seed lookup.'));
      return;
    }
    // announce to pool
    self.emit('seed', ips);
  });
  return this;
};

/**
 * Will add addrs to the list of addrs from network DNS seeds
 * @param {Function} done
 */
Pool.prototype.addAddrsFromSeeds = function addAddrsFromSeeds() {
  var self = this;
  var seeds = this.network.dnsSeeds;
  seeds.forEach(function(seed) {
    self.addAddrsFromSeed(seed);
  });
  return this;
};

/**
 * @returns {String} A string formatted for the console
 */
Pool.prototype.inspect = function inspect() {
  return '<Pool network: ' +
    this.network + ', connected: ' +
    this.numberConnected() + ', available: ' +
    this.addrs.length + '>';
};

module.exports = Pool;