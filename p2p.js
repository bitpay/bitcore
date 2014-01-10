#! /usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var fs = require('fs');
var HeaderDB = require('./HeaderDB').class();
var Block = require('bitcore/Block').class();
var CoinConst = require('bitcore/const');
var coinUtil = require('bitcore/util/util');
var networks = require('bitcore/networks');
var Parser = require('bitcore/util/BinaryParser').class();
var Sync = require('./lib/Sync').class();
var Peer = require('bitcore/Peer').class();

var peerdb_fn = 'peerdb.json';
var peerdb = undefined;

var PROGRAM_VERSION = '0.1';
var program = require('commander');

program
  .version(PROGRAM_VERSION)
  .option('-N --network [testnet]', 'Set bitcoin network [testnet]', 'testnet')
  .parse(process.argv);

var sync = new Sync({
  networkName: program.network
});
sync.init();

var PeerManager = require('bitcore/PeerManager').createClass({
  config: {
    network: program.network
  }
});

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

function handle_inv(info) {
  // TODO: should limit the invs to objects we haven't seen yet
  var invs = info.message.invs;
  invs.forEach(function(inv) {
    console.log('Handle inv for a ' + CoinConst.MSG.to_str(inv.type));
  });
  // this is not needed right now, but it's left in case
  // we need to store more info in the future
  info.conn.sendGetData(invs);
}

function handle_tx(info) {
  var tx = info.message.tx.getStandardizedObject();
  console.log('Handle tx: ' + tx.hash);
  sync.storeTxs([tx.hash], function(err) {
    if (err) {
      console.log('Error in handle TX: ' + err);
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
      console.log('Error in handle Block: ' + err);
    } else {
      // if no errors importing block, import the transactions
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
    conn.on('inv', handle_inv);
    conn.on('block', handle_block);
    conn.on('tx', handle_tx);
  });
  peerman.on('connect', handle_connected);

  peerman.start();
}

function main() {
  peerdb_load();
  p2psync();
}

main();

