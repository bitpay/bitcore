'use strict';
require('classtool');

function spec() {
  var fs = require('fs');
  var CoinConst = require('bitcore/const');
  var coinUtil = require('bitcore/util/util');
  var Sync = require('./Sync').class();
  var Peer = require('bitcore/Peer').class();
  var config = require('../config/config');

  var peerdb_fn = 'peerdb.json';

  function PeerSync() {}


  PeerSync.prototype.init = function(opts, cb) {
    if (!opts) opts = {};
    var network = opts && (opts.network || 'testnet');

    this.verbose = opts.verbose;
    this.peerdb = undefined;
    this.sync = new Sync({
      networkName: network
    });

    this.PeerManager = require('bitcore/PeerManager').createClass({
      opts: {
        network: network
      }
    });
    this.peerman = new this.PeerManager();
    this.load_peers();
    this.sync.init(opts, function() {
      return cb();
    });
  };

  PeerSync.prototype.load_peers = function() {
    this.peerdb = [{
      ipv4: config.bitcoind.host,
      port: config.bitcoind.p2p_port
    }];

    fs.writeFileSync(peerdb_fn, JSON.stringify(this.peerdb));
  };

  PeerSync.prototype.handle_inv = function(info) {
    var self = this;
    var invs = info.message.invs;
    invs.forEach(function(inv) {
      if (self.verbose) {
        console.log('[p2p_sync] Handle inv for a ' + CoinConst.MSG.to_str(inv.type));
      }
    });
    // TODO: should limit the invs to objects we haven't seen yet
    info.conn.sendGetData(invs);
  };

  PeerSync.prototype.handle_tx = function(info) {
    var tx = info.message.tx.getStandardizedObject();
    if (this.verbose) {
      console.log('[p2p_sync] Handle tx: ' + tx.hash);
    }
    this.sync.storeTxs([tx.hash], null, function(err) {
      if (err) {
        console.log('[PeerSync.js.71:err:]',err); //TODO
        console.log('[p2p_sync] Error in handle TX: ' + JSON.stringify(err));
      }
    });
  };

  PeerSync.prototype.handle_block = function(info) {
    var block = info.message.block;
    var blockHash = coinUtil.formatHashFull(block.calcHash());
    if (this.verbose) {
      console.log('[p2p_sync] Handle block: ' + blockHash);
    }


    var tx_hashes = block.txs.map(function(tx) {
      return coinUtil.formatHashFull(tx.hash);
    });

    this.sync.storeBlock({
      'hash': blockHash,
      'tx':   tx_hashes,
      // TODO NEXT BLOCK / PREV BLOCK?
    },
    function(err) {
      if (err) {
        console.log('[p2p_sync] Error in handle Block: ' + err);
      }
    });
  };

  PeerSync.prototype.handle_connected = function(data) {
    var peerman = data.pm;
    var peers_n = peerman.peers.length;
    if (this.verbose) {
      console.log('[p2p_sync] Connected to ' + peers_n + ' peer' + (peers_n !== 1 ? 's': ''));
    }
  };

  PeerSync.prototype.run = function() {
    var self = this;

    this.peerdb.forEach(function(datum) {
      var peer = new Peer(datum.ipv4, datum.port);
      self.peerman.addPeer(peer);
    });

    this.peerman.on('connection', function(conn) {
      conn.on('inv', self.handle_inv.bind(self));
      conn.on('block', self.handle_block.bind(self));
      conn.on('tx', self.handle_tx.bind(self));
    });
    this.peerman.on('connect', self.handle_connected.bind(self));

    this.peerman.start();
  };

  PeerSync.prototype.close = function() {
    this.sync.close();
  };


  return PeerSync;

}
module.defineClass(spec);

