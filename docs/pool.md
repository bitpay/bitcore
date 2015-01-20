title: Pool
description: A simple interface to create and maintain a set of connections to bitcoin nodes.
---
# Pool

A pool maintains a connection of [Peers](peer.md). A pool will discover peers via DNS seeds, as well as when peer addresses are announced through the network.

The quickest way to get connected is to run the following:

```javascript

var Pool = require('bitcore-p2p').Pool;
var Networks = require('bitcore').Networks;

var pool = new Pool(Networks.livenet);

// connect to the network
pool.connect();

// attach peer events
pool.on('peerinv', function(peer, message) {
  // a new peer message has arrived
});

// will disconnect all peers
pool.disconnect()

```

For more information about Peer events please read the [Peer](peer.md) documentation. Peer events are relayed to the pool, a peer event `inv` in the pool would be `peerinv`. When a peer is disconnected the pool will try to connect to the list of known addresses to maintain connection.
