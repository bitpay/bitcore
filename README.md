![bitcore Logo](http://bitpay.github.io/bitcore/images/bitcore-logo-with-ball.svg)

[![NPM Package](https://img.shields.io/npm/v/bitcore.svg?style=flat-square)](https://www.npmjs.org/package/bitcore)
[![Build Status](https://img.shields.io/travis/bitpay/bitcore.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore)
[![Coverage Status](https://img.shields.io/coveralls/bitpay/bitcore.svg?style=flat-square)](https://coveralls.io/r/bitpay/bitcore)

[![Read the Developer Guide](http://bitpay.github.io/bitcore/images/read-the-developer-guide-btn.png)](https://bitpay.github.io/bitcore/docs/#!index.md)  [![Read the API Reference](http://bitpay.github.io/bitcore/images/read-the-api-reference-btn.png)](https://bitpay.github.io/bitcore/apiref)


A pure and simple javascript bitcoin API.

## Principles

Bitcoin is a powerful new peer-to-peer platform for the next generation of financial technology. The decentralized nature of the Bitcoin network allows for highly resilient bitcoin infrastructure, and the developer community needs reliable, open-source tools to implement bitcoin apps and services.

## Get Started

You can run bitcore on any javascript engine. It's distributed through npm, and you can also find compiled single files here: [bitcore.js](https://bitcore.io/bitcore/dist/bitcore.js) and [bitcore.min.js](https://bitcore.io/bitcore/dist/bitcore.min.js).

```
npm install bitcore
```

Using it on node.js:

```javascript
var bitcore = require('bitcore');

assert(bitcore.Address.isValid(address));
var simpleTx = new bitcore.Transaction();
var simpleTx.from(unspent).to(address, amount);
simpleTx.sign(privateKey);
```

## Documentation

The complete docs are hosted here: [bitcore documentation](https://bitcore.io/bitcore/docs). There's also a [bitcore API reference](https://bitcore.io/bitcore/apiref) available generated from the JSDocs of the project.

## Security

Please use at your own risk.

Bitcore is still under heavy development and not quite ready for "drop-in" production use. If you find a security issue, please email security@bitcore.io.

## Contributing

Please send pull requests for bug fixes, code optimization, and ideas for improvement.

## Building the browser bundle

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

Run the tests with mocha:

```sh
gulp test:node
```

Run the tests with karma (uses firefox and chrome):

```sh
gulp test:browser
```

Create a coverage report (you can open `coverage/lcov-report/index.html` to visualize it):

```sh
gulp coverage
```

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2014 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.
