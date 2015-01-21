Bitcore
=======

[![NPM Package](https://img.shields.io/npm/v/bitcore.svg?style=flat-square)](https://www.npmjs.org/package/bitcore)
[![Build Status](https://img.shields.io/travis/bitpay/bitcore.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore)
[![Coverage Status](https://img.shields.io/coveralls/bitpay/bitcore.svg?style=flat-square)](https://coveralls.io/r/bitpay/bitcore)

[![Sauce Test Status](https://saucelabs.com/browser-matrix/maraoz.svg)](https://saucelabs.com/u/maraoz)

A pure and powerful JavaScript Bitcoin library.

## Principles

Bitcoin is a powerful new peer-to-peer platform for the next generation of financial technology. The decentralized nature of the Bitcoin network allows for highly resilient bitcoin infrastructure, and the developer community needs reliable, open-source tools to implement bitcoin apps and services.

## Get Started

```
npm install bitcore
```

Using it in Node.js:

```javascript
var bitcore = require('bitcore');

assert(bitcore.Address.isValid('126vMmY1fyznpZiFTTnty3cm1Rw8wuheev'));
var simpleTx = new bitcore.Transaction();
var simpleTx.from(unspent).to(address, amount);
simpleTx.sign(privateKey);
```

## Documentation

The complete docs are hosted here: [bitcore documentation](http://bitcore.io/guide/). There's also a [bitcore API reference](http://bitcore.io/api/) available generated from the JSDocs of the project, where you'll find low-level details on each bitcore utility.

[Read the Developer Guide](http://bitcore.io/guide/)

[Read the API Reference](http://bitcore.io/api/)

To get community assistance and ask for help with implementation questions, please use our [community forums](http://bitpaylabs.com/c/bitcore).

## Modules
This module provides bitcoin's core features. Other features and protocol extensions are built into separate modules. Here is a list of official bitcore modules:

Module | Version | Building | Coverage
-------|---------|----------|---------
[bitcore-payment-protocol](http://github.com/bitpay/bitcore-payment-protocol) | [![NPM Package](https://img.shields.io/npm/v/bitcore-payment-protocol.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-payment-protocol) | [![Build Status](https://img.shields.io/travis/bitpay/bitcore-payment-protocol.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-payment-protocol) | [![Coverage Status](https://img.shields.io/coveralls/bitpay/bitcore-payment-protocol.svg?style=flat-square)](https://coveralls.io/r/bitpay/bitcore-payment-protocol)
[bitcore-p2p](http://github.com/bitpay/bitcore-p2p) | [![NPM Package](https://img.shields.io/npm/v/bitcore-p2p.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-p2p) | [![Build Status](https://img.shields.io/travis/bitpay/bitcore-p2p.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-p2p) | [![Coverage Status](https://img.shields.io/coveralls/bitpay/bitcore-p2p.svg?style=flat-square)](https://coveralls.io/r/bitpay/bitcore-p2p?branch=master)
[bitcore-mnemonic](http://github.com/bitpay/bitcore-mnemonic) | [![NPM Package](https://img.shields.io/npm/v/bitcore-mnemonic.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-mnemonic) |  [![Build Status](https://img.shields.io/travis/bitpay/bitcore-mnemonic.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-mnemonic) | [![Coverage Status](https://img.shields.io/coveralls/bitpay/bitcore-mnemonic.svg?style=flat-square)](https://coveralls.io/r/bitpay/bitcore-mnemonic)
[bitcore-ecies](http://github.com/bitpay/bitcore-ecies) | [![NPM Package](https://img.shields.io/npm/v/bitcore-ecies.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-ecies) | [![Build Status](https://img.shields.io/travis/bitpay/bitcore-ecies.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-ecies) | [![Coverage Status](https://img.shields.io/coveralls/bitpay/bitcore-ecies.svg?style=flat-square)](https://coveralls.io/r/bitpay/bitcore-ecies)
[bitcore-channel](http://github.com/bitpay/bitcore-channel) | [![NPM Package](https://img.shields.io/npm/v/bitcore-channel.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-channel) | [![Build Status](https://img.shields.io/travis/bitpay/bitcore-channel.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-channel) | [![Coverage Status](https://img.shields.io/coveralls/bitpay/bitcore-channel.svg?style=flat-square)](https://coveralls.io/r/bitpay/bitcore-channel)
[bitcore-explorers](http://github.com/bitpay/bitcore-explorers) | [![NPM Package](https://img.shields.io/npm/v/bitcore-explorers.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-explorers) | [![Build Status](https://img.shields.io/travis/bitpay/bitcore-explorers.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-explorers) | [![Coverage Status](https://img.shields.io/coveralls/bitpay/bitcore-explorers.svg?style=flat-square)](https://coveralls.io/r/bitpay/bitcore-explorers)

## Security

We're using Bitcore in production, as are [many others](http://bitcore.io#projects), but please use common sense when doing anything related to finances! We take no responsibility for your implementation decisions.

If you find a security issue, please email security@bitpay.com.

## Contributing

Please send pull requests for bug fixes, code optimization, and ideas for improvement. For more information on how to contribute, please refer to our [CONTRIBUTING](https://github.com/bitpay/bitcore/blob/master/CONTRIBUTING.md) file. 

## Building the Browser Bundle

To build bitcore full bundle for the browser:

```sh
gulp browser
```

This will generate files named `browser/bitcore.js` and `browser/bitcore.min.js`.

## Tests

Run all the tests:

```sh
gulp test
```

Run the NodeJS tests with mocha:

```sh
gulp test:node
```

Run the browser tests with karma:

```sh
gulp test:browser
```

Create a test coverage report (you can open `coverage/lcov-report/index.html` to visualize it):

```sh
gulp coverage
```

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2015 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.
