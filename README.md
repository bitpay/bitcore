P2P Networking capabilities for bitcore
=======

[![NPM Package](https://img.shields.io/npm/v/bitcore-p2p.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-p2p)
[![Build Status](https://img.shields.io/travis/bitpay/bitcore-p2p.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-p2p)
[![Coverage Status](https://img.shields.io/coveralls/bitpay/bitcore-p2p.svg?style=flat-square)](https://coveralls.io/r/bitpay/bitcore-p2p?branch=master)

bitcore-p2p adds support for connecting to the bitcoin p2p network on node.

See [the main bitcore repo](https://github.com/bitpay/bitcore) for more information.

## Getting Started

```sh
npm install bitcore-p2p
```
```sh
bower install bitcore-p2p
```
In order to connect to the bitcore network, you'll need to know the IP address of at least one node of the network. You can do that by using the known DNS servers. Then, you can connect to it:

```javascript
var Peer = require('bitcore-p2p').Peer;

var peer = new Peer('0.0.0.0');

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

Take a look at the [bitcore guide](http://bitcore.io/guide/peer.html) on the usage of the `Peer` class.

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2015 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.

