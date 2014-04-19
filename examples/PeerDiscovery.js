var PeerManager = require('../lib/PeerManager');
var peerman     = new PeerManager();

peerman.discoverPeers(function(err, peers) {
  // we can use this array of peers to add to the manager
  // but let's limit it to 6 connections for this example
  var p = 0;
  do { peerman.addPeer(peers[p]); p++; } while (p <= 6);
  // then we can start the manager
  peerman.start();
});
