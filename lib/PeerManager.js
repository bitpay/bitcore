var log = require('../util/log');
var bitcoreDefaults = require('../config');
var Connection = require('./Connection');
var Peer = require('./Peer');
var async = require('async');
var dns = require('dns');
var networks = require('../networks');
var util = require('util');

GetAdjustedTime = function() {
  // TODO: Implement actual adjustment
  return Math.floor(new Date().getTime() / 1000);
};

function PeerManager(config) {
  // extend defaults with config
  this.config = config || {};
  for (var i in bitcoreDefaults)
    if (bitcoreDefaults.hasOwnProperty(i) && this.config[i] === undefined)
      this.config[i] = bitcoreDefaults[i];

  this.active = false;
  this.timer = null;

  this.peers = [];
  this.pool = [];
  this.connections = [];
  this.isConnected = false;
  this.peerDiscovery = false;

  // Move these to the Node's settings object
  this.interval = 5000;
  this.minConnections = 8;
  this.minKnownPeers = 10;

  // keep track of tried seeds and results
  this.seeds = {
    resolved: [],
    failed: []
  };
}

var EventEmitter = require('events').EventEmitter;
util.inherits(PeerManager, EventEmitter);
PeerManager.Connection = Connection;

PeerManager.prototype.start = function() {
  this.active = true;
  if (!this.timer) {
    this.timer = setInterval(this.checkStatus.bind(this), this.interval);
  }
};

PeerManager.prototype.stop = function() {
  this.active = false;
  if (this.timer) {
    clearInterval(this.timer);
    this.timer = null;
  }
  for (var i = 0; i < this.connections.length; i++) {
    this.connections[i].socket.end();
  };
};

PeerManager.prototype.addPeer = function(peer, port) {
  if (peer instanceof Peer) {
    this.peers.push(peer);
  } else if ("string" == typeof peer) {
    this.addPeer(new Peer(peer, port));
  } else {
    log.err('Node.addPeer(): Invalid value provided for peer', {
      val: peer
    });
    throw 'Node.addPeer(): Invalid value provided for peer.';
  }
};

PeerManager.prototype.removePeer = function(peer) {
  var index = this.peers.indexOf(peer);
  var exists = !!~index;
  if (exists) this.peers.splice(index, 1);
  return exists;
};

PeerManager.prototype.checkStatus = function checkStatus() {
  // Make sure we are connected to all forcePeers
  if (this.peers.length) {
    var peerIndex = {};
    this.peers.forEach(function(peer) {
      peerIndex[peer.toString()] = peer;
    });

    // Ignore the ones we're already connected to
    this.connections.forEach(function(conn) {
      var peerName = conn.peer.toString();
      if ("undefined" !== peerIndex[peerName]) {
        delete peerIndex[peerName];
      }
    });

    // for debug purposes, print how many of our peers are actually connected
    var connected = 0
    this.peers.forEach(function(p) {
      if (p.connection && !p.connection._connecting) connected++
    });
    log.debug(connected + ' of ' + this.peers.length + ' peers connected');

    Object.keys(peerIndex).forEach(function(i) {
      this.connectTo(peerIndex[i]);
    }.bind(this));
  }
};

PeerManager.prototype.connectTo = function(peer) {
  log.info('connecting to ' + peer);
  try {
    return this.addConnection(peer.createConnection(), peer);
  } catch (e) {
    log.err('creating connection', e);
    return null;
  }
};

PeerManager.prototype.addConnection = function(socketConn, peer) {
  var conn = new Connection(socketConn, peer, this.config);
  this.connections.push(conn);
  this.emit('connection', conn);

  conn.addListener('version', this.handleVersion.bind(this));
  conn.addListener('verack', this.handleReady.bind(this));
  conn.addListener('addr', this.handleAddr.bind(this));
  conn.addListener('getaddr', this.handleGetAddr.bind(this));
  conn.addListener('error', this.handleError.bind(this));
  conn.addListener('disconnect', this.handleDisconnect.bind(this));

  return conn;
};

PeerManager.prototype.handleVersion = function(e) {
  e.peer.version = e.message.version;
  e.peer.start_height = e.message.start_height;

  if (!e.conn.inbound) {
    // TODO: Advertise our address (if listening)
  }
  // Get recent addresses
  if (this.peerDiscovery &&
    (e.message.version >= 31402 || this.peers.length < 1000)) {
    e.conn.sendGetAddr();
    e.conn.getaddr = true;
  }
};

PeerManager.prototype.handleReady = function(e) {
  log.info('connected to ' + e.conn.peer.host + ':' + e.conn.peer.port);
  this.emit('connect', {
    pm: this,
    conn: e.conn,
    socket: e.socket,
    peer: e.peer
  });

  if (this.isConnected == false) {
    this.emit('netConnected', e);
    this.isConnected = true;
  }
};

PeerManager.prototype.handleAddr = function(e) {
  if (!this.peerDiscovery) return;

  var now = GetAdjustedTime();
  e.message.addrs.forEach(function(addr) {
    try {
      // In case of an invalid time, assume "5 days ago"
      if (addr.time <= 100000000 || addr.time > (now + 10 * 60)) {
        addr.time = now - 5 * 24 * 60 * 60;
      }
      var peer = new Peer(addr.ip, addr.port, addr.services);
      peer.lastSeen = addr.time;

      // TODO: Handle duplicate peers
      this.peers.push(peer);

      // TODO: Handle addr relay
    } catch (e) {
      log.warn("Invalid addr received: " + e.message);
    }
  }.bind(this));
  if (e.message.addrs.length < 1000) {
    e.conn.getaddr = false;
  }
};

PeerManager.prototype.handleGetAddr = function(e) {
  // TODO: Reply with addr message.
};

PeerManager.prototype.handleError = function(e) {
  log.err('unkown error with peer ' + e.peer + ' (disconnecting): ' + e.err);
  this.handleDisconnect.apply(this, [].slice.call(arguments));
};

PeerManager.prototype.handleDisconnect = function(e) {
  log.info('disconnected from peer ' + e.peer);
  var i = this.connections.indexOf(e.conn);
  if (i != -1) this.connections.splice(i, 1);

  this.removePeer(e.peer);
  if (this.pool.length) {
    log.info('replacing peer using the pool of ' + this.pool.length + ' seeds');
    this.addPeer(this.pool.pop());
  }

  if (!this.connections.length) {
    this.emit('netDisconnected');
    this.isConnected = false;
  }
};

PeerManager.prototype.getActiveConnection = function() {
  var activeConnections = this.connections.filter(function(conn) {
    return conn.active;
  });

  if (activeConnections.length) {
    var randomIndex = Math.floor(Math.random() * activeConnections.length);
    var candidate = activeConnections[randomIndex];
    if (candidate.socket.writable) {
      return candidate;
    } else {
      // Socket is not writable, remove it from active connections
      activeConnections.splice(randomIndex, 1);

      // Then try again
      // TODO: This causes an infinite recursion when all connections are dead,
      //       although it shouldn't.
      return this.getActiveConnection();
    }
  } else {
    return null;
  }
};

PeerManager.prototype.getActiveConnections = function() {
  return this.connections.slice(0);
};

PeerManager.prototype.discover = function(options, callback) {
  var self = this;
  var seeds = networks[self.config.network].dnsSeeds;

  self.limit = options.limit || 12;

  var dnsExecutor = seeds.map(function(seed) {
    return function(done) {
      // have we already resolved this seed?
      if (~self.seeds.resolved.indexOf(seed)) {
        // if so, just pass back cached peer list
        return done(null, self.seeds.results[seed]);
      }

      // has this seed failed to resolve?
      if (~self.seeds.failed.indexOf(seed)) {
        // if so, pass back empty results
        return done(null, []);
      }

      log.info('resolving dns seed ' + seed);

      dns.resolve(seed, function(err, peers) {
        if (err) {
          log.err('failed to resolve dns seed ' + seed, err);
          self.seeds.failed.push(seed);
          return done(null, []);
        }

        log.info('found ' + peers.length + ' peers from ' + seed);
        self.seeds.resolved.push(seed);

        // transform that list into a list of Peer instances
        peers = peers.map(function(ip) {
          return new Peer(ip, networks[self.config.network].defaultClientPort);
        });

        peers.forEach(function(p) {
          if (self.peers.length < self.limit) self.addPeer(p);
          else self.pool.push(p);
        });

        self.emit('peers', peers);

        return done(null, peers);
      });

    };
  });

  // try resolving all seeds
  async.parallel(dnsExecutor, function(err, results) {
    var peers = [];

    // consolidate all resolved peers into one list
    results.forEach(function(peerlist) {
      peers = peers.concat(peerlist);
    });

    if (typeof callback === 'function') callback(null, peers);
  });

  return self;
};

module.exports = PeerManager;
