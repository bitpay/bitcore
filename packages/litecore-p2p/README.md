<img src="http://bitcore.io/css/images/bitcore-p2p.svg" alt="litecore payment protocol" height="35" width="102">

Litecore P2P
=======

[![NPM Package](https://img.shields.io/npm/v/litecore-p2p.svg?style=flat-square)](https://www.npmjs.org/package/litecore-p2p)
[![Build Status](https://img.shields.io/travis/litecoin-project/litecore-p2p.svg?branch=master&style=flat-square)](https://travis-ci.org/litecoin-project/litecore-p2p)
[![Coverage Status](https://img.shields.io/coveralls/litecoin-project/litecore-p2p.svg?style=flat-square)](https://coveralls.io/r/litecoin-project/litecore-p2p?branch=master)

`litecore-p2p` adds [Litecoin protocol](https://en.bitcoin.it/wiki/Protocol_documentation) support for Litecore.

See [the main litecore repo](https://github.com/litecoin-project/litecore) for more information.

## Getting Started

```sh
npm install litecore-p2p
```
In order to connect to the Litecoin network, you'll need to know the IP address of at least one node of the network, or use [Pool](/docs/pool.md) to discover peers using a DNS seed.

```javascript
var Peer = require('litecore-p2p').Peer;

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

Take a look at the [litecore guide](http://litecore.io/guide/peer.html) on the usage of the `Peer` class.

## Contributing

See [CONTRIBUTING.md](https://github.com/litecoin-project/litecore/blob/master/CONTRIBUTING.md) on the main litecore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/litecoin-project/litecore/blob/master/LICENSE).

Copyright 2013-2015 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.
Copyright 2016 The Litecore Core Developers
