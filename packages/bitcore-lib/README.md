# Bitcore JavaScript Library for Bitcoin

[![NPM Package](https://img.shields.io/npm/v/bitcore-lib.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-lib)
[![Build Status](https://img.shields.io/travis/bitpay/bitcore-lib.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-lib)
[![Coverage Status](https://img.shields.io/coveralls/bitpay/bitcore-lib.svg?style=flat-square)](https://coveralls.io/r/bitpay/bitcore-lib)

**A pure and powerful JavaScript library for Bitcoin.**

## Principles

Bitcoin is a powerful new peer-to-peer platform for the next generation of financial technology. The decentralized nature of the Bitcoin network allows for highly resilient bitcoin infrastructure, and the developer community needs reliable, open-source tools to implement bitcoin apps and services. Bitcore JavaScript Library provides a reliable API for JavaScript apps that need to interface with Bitcoin.

## Get Started

Clone the Bitcore monorepo and `npm install`:
```sh
git clone https://github.com/bitpay/bitcore.git
npm install
```
`cd` into bitcore-lib repository:
```sh
cd packages/bitcore-lib
```

## Building the Browser Bundle

To build a bitcore-lib full bundle for the browser:

```sh
gulp browser
```

This will generate files named `bitcore-lib.js` and `bitcore-lib.min.js`.

## Running Tests

```sh
npm test
```

You can also run just the Node.js tests with `gulp test:node`, just the browser tests with `gulp test:browser` or create a test coverage report (you can open `coverage/lcov-report/index.html` to visualize it) with `gulp coverage`.

## Documentation 

### Addresses and Key Management

- [Addresses](docs/address.md)
- [Using Different Networks](docs/networks.md)
- [Private Keys](docs/privatekey.md) and [Public Keys](docs/publickey.md)
- [Hierarchically-derived Private and Public Keys](docs/hierarchical.md)

### Payment Handling

- [Using Different Units](docs/unit.md)
- [Acknowledging and Requesting Payments: Bitcoin URIs](docs/uri.md)
- [The Transaction Class](docs/transaction.md)
- [Unspent Transaction Output Class](docs/unspentoutput.md)

### Bitcoin Internals

- [Scripts](docs/script.md)
- [Block](docs/block.md)

### Extra

- [Crypto](docs/crypto.md)
- [Encoding](docs/encoding.md)

### Module Development

- [Browser Builds](docs/browser.md)

### Modules

Some functionality is implemented as a module that can be installed separately:

- [Peer to Peer Networking](https://github.com/bitpay/bitcore/tree/master/packages/bitcore-p2p)
- [Bitcoin Core JSON-RPC](https://github.com/bitpay/bitcoind-rpc)
- [Payment Channels](https://github.com/bitpay/bitcore-channel)
- [Mnemonics](https://github.com/bitpay/bitcore/tree/master/packages/bitcore-mnemonic)
- [Elliptical Curve Integrated Encryption Scheme](https://github.com/bitpay/bitcore-ecies)
- [Blockchain Explorers](https://github.com/bitpay/bitcore-explorers)
- [Signed Messages](https://github.com/bitpay/bitcore-message)

## Examples

- [Generate a random address](docs/examples.md#generate-a-random-address)
- [Generate a address from a SHA256 hash](docs/examples.md#generate-a-address-from-a-sha256-hash)
- [Import an address via WIF](docs/examples.md#import-an-address-via-wif)
- [Create a Transaction](docs/examples.md#create-a-transaction)
- [Sign a Bitcoin message](docs/examples.md#sign-a-bitcoin-message)
- [Verify a Bitcoin message](docs/examples.md#verify-a-bitcoin-message)
- [Create an OP RETURN transaction](docs/examples.md#create-an-op-return-transaction)
- [Create a 2-of-3 multisig P2SH address](docs/examples.md#create-a-2-of-3-multisig-p2sh-address)
- [Spend from a 2-of-2 multisig P2SH address](docs/examples.md#spend-from-a-2-of-2-multisig-p2sh-address)

## Security

We're using the Bitcore JavaScript Library in production, as are many others, but please use common sense when doing anything related to finances! We take no responsibility for your implementation decisions.

If you find a security issue, please email security@bitpay.com.

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/Contributing.md) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2022 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.
