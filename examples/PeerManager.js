'use strict';

// Replace path '..' to 'bitcore' if you are using this example
// in a different project
var networks = require('../networks');
var Peer = require('../Peer').class();
var PeerManager = require('../PeerManager').createClass({
  network: networks.testnet
});

var util= require('util');


var handleBlock = function(b) {
  console.log('block received:', util.inspect(b.message,{depth:null}));
};

var handleTx = function(b) {
  console.log('block tx:',  util.inspect(b.message,{depth:null}));
};

var handleInv = function(b) {
  console.log('block inv:',  util.inspect(b.message,{depth:null}));
};


var peerman = new PeerManager();
peerman.addPeer( new Peer('127.0.0.1',18333) );
peerman.on('connection', function(conn) {
  conn.on('inv',  handleInv);
  conn.on('block', handleBlock);
  conn.on('tx', handleTx);
});
peerman.start();

