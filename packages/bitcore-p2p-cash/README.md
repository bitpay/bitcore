# Bitcore P2P Cash

[![NPM Package](https://img.shields.io/npm/v/bitcore-p2p-cash.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-p2p-cash)

**The peer-to-peer networking protocol for BCH.**

`bitcore-p2p-cash` adds Bitcoin Cash protocol support for Bitcore.

See [the main bitcore repo](https://github.com/bitpay/bitcore) for more information.

## Getting Started

```sh
npm install bitcore-p2p-cash
```

In order to connect to the Bitcoin Cash network, you'll need to know the IP address of at least one node of the network, or use [Pool](./docs/pool.md) to discover peers using a DNS seed.

```javascript
var Peer = require('bitcore-p2p-cash').Peer;

var peer = new Peer({host: '127.0.0.1'});

peer.on('ready', function() {
  // peer info
  console.log(peer.version, peer.subversion, peer.bestHeight);
});
peer.on('disconnect', function() {
  console.log('connection closed');
});
peer.connect();
```

Then, you can get information from other peers by using:

```javascript
// handle events
peer.on('inv', function(message) {
  // message.inventory[]
});
peer.on('tx', function(message) {
  // message.transaction
});
```

Take a look at this [guide](./docs/peer.md) on the usage of the `Peer` class.

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/CONTRIBUTING.md) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2019 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.
