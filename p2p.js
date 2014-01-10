'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var fs = require('fs');
var HeaderDB = require('./HeaderDB').class();
var Block = require('bitcore/Block').class();
var CoinConst = require('bitcore/const');
var coinUtil = require('bitcore/util/util');
var networks = require('bitcore/networks');
var Parser = require('bitcore/util/BinaryParser').class();
var async = require('async');
var Sync = require('./lib/Sync').class();

var peerdb_fn = 'peerdb.json';

var peerdb = undefined;
var hdrdb = undefined;
var network = networks.testnet;
var config = {
  network: network.name
};
var PeerManager = require('bitcore/PeerManager').createClass({
  config: config
});
var Peer = require('bitcore/Peer').class();

function peerdb_load() {
  try {
    peerdb = JSON.parse(fs.readFileSync(peerdb_fn));
  } catch(d) {
    console.warn('Unable to read peer db', peerdb_fn, 'creating new one.');
    peerdb = [{
      ipv4: '127.0.0.1',
      port: 18333
    },
    ];

    fs.writeFileSync(peerdb_fn, JSON.stringify(peerdb));
  }
}

function hdrdb_load() {
  hdrdb = new HeaderDB({
    network: network
  });
}

function get_more_headers(info) {
  var conn = info.conn;
  var loc = hdrdb.locator();
  conn.sendGetHeaders(loc, coinUtil.NULL_HASH);
}

function add_header(info, block) {
  var hashStr = coinUtil.formatHashFull(block.calcHash());

  try {
    hdrdb.add(block);
  } catch(e) {
    return;
  }
}

function handle_headers(info) {
  console.log('handle headers');
  var headers = info.message.headers;

  headers.forEach(function(hdr) {
    add_header(info, hdr);
  });

  // We persist the header DB after each batch
  //hdrdb.writeFile(hdrdb_fn);
  // Only one request per batch of headers we receive.
  get_more_headers(info);
}

function handle_verack(info) {
  var inv = {
    type: CoinConst.MSG.BLOCK,
    hash: network.genesisBlock.hash,
  };
  var invs = [inv];

  // Asks for the genesis block
  // console.log('p2psync: Asking for the genesis block');
  // info.conn.sendGetData(invs);
}

function handle_inv(info) {
  // TODO: should limit the invs to objects we haven't seen yet
  var invs = info.message.invs;
  invs.forEach(function(inv) {
    console.log('Handle inv for a ' + CoinConst.MSG.to_str(inv.type));
  });
  info.conn.sendGetData(invs);
}

var sync = new Sync({
  networkName: networks.testnet
});
sync.init();

function handle_tx(info) {
  var tx = info.message.tx.getStandardizedObject();
  console.log('Handle tx: ' + tx.hash);
  sync.storeTxs([tx.hash], function(err) {
    if (err) {
      console.log('error in handle TX: ' + err);
    }
  });
}

function handle_block(info) {
  var block = info.message.block;
  var now = Math.round(new Date().getTime() / 1000);
  var blockHash = coinUtil.formatHashFull(block.calcHash());
  console.log('Handle block: ' + blockHash);
  sync.storeBlock({
    'hash': blockHash,
    'time': now
  },
  function(err) {
    if (err) {
      console.log('error in handle Block: ' + err);
    } else {
      var hashes = block.txs.map(function(tx) {
        return coinUtil.formatHashFull(tx.hash);
      });
      sync.storeTxs(hashes, function() {});
    }
  });

}

function handle_connected(data) {
  var peerman = data.pm;
  var peers_n = peerman.peers.length;
  console.log('p2psync: Connected to ' + peers_n + ' peer' + (peers_n !== 1 ? 's': ''));
}

function p2psync() {
  var peerman = new PeerManager();

  peerdb.forEach(function(datum) {
    var peer = new Peer(datum.ipv4, datum.port);
    peerman.addPeer(peer);
  });

  peerman.on('connection', function(conn) {
    conn.on('verack', handle_verack);
    conn.on('block', handle_block);
    conn.on('headers', handle_headers);
    conn.on('inv', handle_inv);
    conn.on('tx', handle_tx);
  });
  peerman.on('connect', handle_connected);

  peerman.start();
}

function main() {
  peerdb_load();
  hdrdb_load();

  p2psync();
}

main();

