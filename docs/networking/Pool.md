# > `bitcore.transport.Pool`

## Pool

A pool maintains a connection of [Peers](Peer.md). A pool will discover peers via DNS seeds, as well as when peer addresses are announced through the network.

The quickest way to get connected is to run the following:

```javascript

var bitcore = require('bitcore');
var Pool = bitcore.transport.Pool;
var Networks = bitcore.Networks;

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

For more information about Peer events, please read the [Peer](Peer.md) documentation. Peer events are relayed to the pool, a peer event `inv` in the pool would be `peerinv`. When a peer is disconnected the pool will try to connect to the list of known addresses to maintain connection.
