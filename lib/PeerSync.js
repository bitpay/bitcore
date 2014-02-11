'use strict';
require('classtool');

function spec() {
  var fs = require('fs');
  var CoinConst = require('bitcore/const');
  var coinUtil = require('bitcore/util/util');
  var Sync = require('./Sync').class();
  var Peer = require('bitcore/Peer').class();
  var config = require('../config/config');
  var networks = require('bitcore/networks');

  var peerdb_fn = 'peerdb.json';

  function PeerSync() {}


  PeerSync.prototype.init = function(opts, cb) {
    if (!opts) opts = {};
    this.peerdb = undefined;
    this.allowReorgs = false;

    this.sync = new Sync();
    this.PeerManager = require('bitcore/PeerManager').createClass({
        network: (config.network === 'testnet' ? networks.testnet : networks.livenet)
    });
    this.peerman = new this.PeerManager();
    this.load_peers();
    this.sync.init(opts, function() {
      if (!cb) return;
      return cb();
    });
  };

  PeerSync.prototype.load_peers = function() {
    this.peerdb = [{
      ipv4: config.bitcoind.host,
      port: config.bitcoind.p2pPort
    }];

    fs.writeFileSync(peerdb_fn, JSON.stringify(this.peerdb));
  };

  PeerSync.prototype.handleInv = function(info) {
    var invs = info.message.invs;
    invs.forEach(function(inv) {
    console.log('[p2p_sync] Handle inv for a ' + CoinConst.MSG.to_str(inv.type));
    });
    // TODO: should limit the invs to objects we haven't seen yet
    info.conn.sendGetData(invs);
  };

  PeerSync.prototype.handleTx = function(info) {
    console.log(JSON.stringify(info.message));
    var tx = info.message.tx.getStandardizedObject();
    console.log('[p2p_sync] Handle tx: ' + tx.hash);

    this.sync.storeTxs([tx], function(err) {
      if (err) {
        console.log('[p2p_sync] Error in handle TX: ' + JSON.stringify(err));
      }
    });
  };

  PeerSync.prototype.handleBlock = function(info) {
    var self = this;
    var block = info.message.block;
    var blockHash = coinUtil.formatHashFull(block.calcHash());

    console.log('[p2p_sync] Handle block: %s (allowReorgs: %s)', blockHash, self.allowReorgs);

    var tx_hashes = block.txs.map(function(tx) {
      return coinUtil.formatHashFull(tx.hash);
    });

    this.sync.storeTipBlock({
      'hash': blockHash,
      'tx':   tx_hashes,
      'previousblockhash': coinUtil.formatHashFull(block.prev_hash),
    }, self.allowReorgs, function(err) {
      if (err) {
        console.log('[p2p_sync] Error in handle Block: ' + err);
      }
    });
  };

  PeerSync.prototype.handle_connected = function(data) {
    var peerman = data.pm;
    var peers_n = peerman.peers.length;
    console.log('[p2p_sync] Connected to ' + peers_n + ' peer' + (peers_n !== 1 ? 's': ''));
  };

  PeerSync.prototype.run = function() {
    var self = this;

    this.peerdb.forEach(function(datum) {
      var peer = new Peer(datum.ipv4, datum.port);
      self.peerman.addPeer(peer);
    });

    this.peerman.on('connection', function(conn) {
      conn.on('inv', self.handleInv.bind(self));
      conn.on('block', self.handleBlock.bind(self));
      conn.on('tx', self.handleTx.bind(self));
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

