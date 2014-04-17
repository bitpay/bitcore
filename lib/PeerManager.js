

var imports         = require('soop').imports();
var log             = imports.log || require('../util/log');
var bitcoreDefaults = imports.config || require('../config');
var Connection      = imports.Connection || require ('./Connection');

var Peer            = imports.Peer || require('./Peer');

GetAdjustedTime = imports.GetAdjustedTime || function () {
  // TODO: Implement actual adjustment
  return Math.floor(new Date().getTime() / 1000);
};

function PeerManager(config) {
  this.config = config || bitcoreDefaults;
  this.active = false;
  this.timer = null;

  this.peers = [];
  this.connections = [];
  this.isConnected = false;
  this.peerDiscovery = false;

  // Move these to the Node's settings object
  this.interval = 5000;
  this.minConnections = 8;
  this.minKnownPeers = 10;
}

PeerManager.parent = imports.parent || require('events').EventEmitter;
PeerManager.Connection = Connection;

PeerManager.prototype.start = function() {
  this.active = true;
  if(!this.timer) {
    this.timer = setInterval(this.checkStatus.bind(this), this.interval);
  }
};

PeerManager.prototype.stop = function() {
  this.active = false;
  if(this.timer) {
    clearInterval(this.timer);
    this.timer = null;
  }
  for(var i=0; i<this.connections.length; i++) {
    this.connections[i].socket.end();
  };
};

PeerManager.prototype.addPeer = function(peer, port) {
  if(peer instanceof Peer) {
    this.peers.push(peer);
  } else if ("string" == typeof peer) {
    this.addPeer(new Peer(peer, port));
  } else {
    log.err('Node.addPeer(): Invalid value provided for peer',
                {val: peer});
    throw 'Node.addPeer(): Invalid value provided for peer.';
  }
};

PeerManager.prototype.checkStatus = function checkStatus() {
  // Make sure we are connected to all forcePeers
  if(this.peers.length) {
    var peerIndex = {};
    this.peers.forEach(function(peer) {
      peerIndex[peer.toString()] = peer;
    });

    // Ignore the ones we're already connected to
    this.connections.forEach(function(conn) {
      var peerName = conn.peer.toString();
      if("undefined" !== peerIndex[peerName]) {
        delete peerIndex[peerName];
      }
    });

    Object.keys(peerIndex).forEach(function(i) {
      this.connectTo(peerIndex[i]);
    }.bind(this));
  }
};

PeerManager.prototype.connectTo = function(peer) {
  log.info('connecting to '+peer);
  try {
    return this.addConnection(peer.createConnection(), peer);
  } catch (e) {
    log.err('creating connection',e);
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
  if(this.peerDiscovery &&
      (e.message.version >= 31402 || this.peers.length < 1000)) {
    e.conn.sendGetAddr();
    e.conn.getaddr = true;
  }
};

PeerManager.prototype.handleReady = function (e) {
  log.info('connected to '+e.conn.peer.host+':'+e.conn.peer.port);
  this.emit('connect', {
    pm: this,
    conn: e.conn,
    socket: e.socket,
    peer: e.peer
  });

  if(this.isConnected == false) {
    this.emit('netConnected', e);
    this.isConnected = true;
  }
};

PeerManager.prototype.handleAddr = function (e) {
  if(!this.peerDiscovery) return;

  var now = GetAdjustedTime();
  e.message.addrs.forEach(function (addr) {
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
    } catch(e) {
      log.warn("Invalid addr received: "+e.message);
    }
  }.bind(this));
  if (e.message.addrs.length < 1000 ) {
    e.conn.getaddr = false;
  }
};

PeerManager.prototype.handleGetAddr = function(e) {
  // TODO: Reply with addr message.
};

PeerManager.prototype.handleError = function(e) {
  log.err('unkown error with peer '+e.peer+' (disconnecting): '+e.err);
  this.handleDisconnect.apply(this, [].slice.call(arguments));
};

PeerManager.prototype.handleDisconnect = function(e) {
  log.info('disconnected from peer '+e.peer);
  var i = this.connections.indexOf(e.conn);
  if(i != -1) this.connections.splice(i, 1);

  if(!this.connections.length) {
    this.emit('netDisconnected');
    this.isConnected = false;
  }
};

PeerManager.prototype.getActiveConnection = function () {
  var activeConnections = this.connections.filter(function (conn) {
    return conn.active;
  });

  if (activeConnections.length) {
    var randomIndex = Math.floor(Math.random()*activeConnections.length);
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

PeerManager.prototype.getActiveConnections = function () {
  return this.connections.slice(0);
};

module.exports = require('soop')(PeerManager);
