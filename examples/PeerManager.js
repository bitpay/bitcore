'use strict';

var run = function() {
  // Replace '..' with 'bitcore' if you plan on using this code elsewhere.
  var networks = require('../networks');
  var Peer = require('../Peer');
  var PeerManager = require('soop').load('../PeerManager', {
    network: networks.testnet
  });

  var handleBlock = function(info) {
    console.log('** Block Received **');
    console.log(info.message);
  };

  var handleTx = function(info) {
    var tx = info.message.tx.getStandardizedObject();

    console.log('** TX Received **');
    console.log(tx);
  };

  var handleInv = function(info) {
    console.log('** Inv **');
    console.log(info.message);

    var invs = info.message.invs;
    info.conn.sendGetData(invs);
  };

  var peerman = new PeerManager();

  peerman.addPeer(new Peer('127.0.0.1', 18333));

  peerman.on('connection', function(conn) {
    conn.on('inv', handleInv);
    conn.on('block', handleBlock);
    conn.on('tx', handleTx);
  });

  peerman.start();
};

module.exports.run = run;
if (require.main === module) {
  run();
}
