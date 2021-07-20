# Pool

A pool maintains a connection of [Peers](peer.md). A pool will discover peers via DNS seeds, as well as when peer addresses are announced through the network.

The quickest way to get connected is to run the following:

```javascript

var Pool = require('bitcore-p2p-cash').Pool;
var Networks = require('bitcore-lib-cash').Networks;

var pool = new Pool({network: Networks.livenet});

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

## Trusted Peers

By default, peers will be added via DNS discovery and as peers are announced in the network. Configuration options can be included to connect only to specific trusted peers:

```javascript
var pool = new Pool({
  network: Networks.livenet, // the network object
  dnsSeed: false, // prevent seeding with DNS discovered known peers upon connecting
  listenAddr: false, // prevent new peers being added from addr messages
  addrs: [ // initial peers to connect to
    {
      ip: {
        v4: '127.0.0.1'
      }
    }
  ]
});

pool.connect();
```

## Listening for Peers

It's also possible to listen to incoming socket connections to add peers to the pool. To enable this capability, you can do the following:

```javascript
var pool = new Pool({network: Networks.livenet});
pool.listen();
```

When there are incoming connections the peer will be added to the pool.
