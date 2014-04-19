var PeerManager = require('../lib/PeerManager');
var peerman     = new PeerManager();

peerman.discoverPeers(function(err, peers) {
  // we get an array of peer instances
  console.log(peers);
  // the peer manager caches the tried seeds and any results
  console.log(peerman.seeds);
  // we can use this array of peers to add to the manager
  peers.forEach(function(p) {
    peerman.addPeer(p);
  });
  // then we can start the manager
  peerman.start();
});
