
// Replace path '..' to 'bitcore' if you are using this example
// in a different project
var networks = require('../networks');
var Peer = require('../Peer').class();
var PeerManager = require('../PeerManager').createClass({
  network: networks.testnet
});


var handleBlock = function(b) {
  console.log('block received:', b);
};

var handleTx = function(b) {
  console.log('block tx:', b);
};

var peerman = new PeerManager();
peerman.addPeer( new Peer('127.0.0.1',18333) );
peerman.on('connect', function(conn) {
  conn.on('block', handleBlock);
  conn.on('tx', handleTx);
});
peerman.start();

