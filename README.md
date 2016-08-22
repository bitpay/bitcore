Bitcore-Dash
=======

[![NPM Package](https://img.shields.io/npm/v/bitcore.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-dash)
[![Build Status](https://img.shields.io/travis/bitpay/bitcore.svg?branch=master&style=flat-square)](https://travis-ci.org/dashpay/bitcore-dash)

Infrastructure to build Dash and blockchain-based applications for the next generation of financial technology.

**Note:** If you're looking for the Bitcore Library please see: https://github.com/dashpay/bitcore-lib-dash

## Getting Started

Before you begin you'll need to have Node.js v4 or v0.12 installed. There are several options for installation. One method is to use [nvm](https://github.com/creationix/nvm) to easily switch between different versions, or download directly from [Node.js](https://nodejs.org/).

```bash
npm install -g bitcore-dash
```

Spin up a full node and join the network:

```bash
npm install -g bitcore-dash
bitcored
```

You can then view the Insight block explorer at the default location: `http://localhost:3001/insight`, and your configuration file will be found in your home directory at `~/.bitcore`.

Create a transaction:
```js
var bitcore = require('bitcore-dash');
var transaction = new bitcore.Transaction();
var transaction.from(unspent).to(address, amount);
transaction.sign(privateKey);
```

## Applications

- [Node-Dash](https://github.com/dashpay/bitcore-node-dash) - A full node with extended capabilities using Bitcoin Core
- [Insight API-Dash](https://github.com/dashpay/insight-api-dash) - A blockchain explorer HTTP API
- [Insight UI-Dash](https://github.com/dashpay/insight-ui-dash) - A blockchain explorer web user interface
- Wallet Service - A multisig HD service for wallets
- Wallet Client - A client for the wallet service
- CLI Wallet - A command-line based wallet client
- Angular Wallet Client - An Angular based wallet client
- Copay - An easy-to-use, multiplatform, multisignature, secure bitcoin wallet

## Libraries

- [Lib-Dash](https://github.com/dashpay/bitcore-lib-dash) - All of the core Bitcoin primatives including transactions, private key management and others
- Payment Protocol - A protocol for communication between a merchant and customer
- [P2P-Dash](https://github.com/dashpay/bitcore-p2p-dash) - The peer-to-peer networking protocol
- [Mnemonic-Dash](https://github.com/dashpay/bitcore-mnemonic-dash) - Implements mnemonic code for generating deterministic keys
- Channel - Micropayment channels for rapidly adjusting bitcoin transactions
- [Message-Dash](https://github.com/dashpay/bitcore-message-dash) - Bitcoin message verification and signing
- [ECIES-Dash](https://github.com/dashpay/bitcore-ecies-dash) - Uses ECIES symmetric key negotiation from public keys to encrypt arbitrarily long data streams.

## Documentation

The complete docs are hosted here: [bitcore documentation](http://bitcore.io/guide/). There's also a [bitcore API reference](http://bitcore.io/api/) available generated from the JSDocs of the project, where you'll find low-level details on each bitcore utility.

- [Read the Developer Guide](http://bitcore.io/guide/)
- [Read the API Reference](http://bitcore.io/api/)

To get community assistance and ask for help with implementation questions, please use our [community forums](http://bitpaylabs.com/c/bitcore).

## Security

We're using Bitcore in production, as are [many others](http://bitcore.io#projects), but please use common sense when doing anything related to finances! We take no responsibility for your implementation decisions.

If you find a security issue, please email security@bitpay.com.

## Contributing

Please send pull requests for bug fixes, code optimization, and ideas for improvement. For more information on how to contribute, please refer to our [CONTRIBUTING](https://github.com/bitpay/bitcore/blob/master/CONTRIBUTING.md) file.

This will generate files named `bitcore.js` and `bitcore.min.js`.

You can also use our pre-generated files, provided for each release along with a PGP signature by one of the project's maintainers. To get them, checkout a release commit (for example, https://github.com/bitpay/bitcore/commit/e33b6e3ba6a1e5830a079e02d949fce69ea33546 for v0.12.6).

To verify signatures, use the following PGP keys:
- @braydonf: https://pgp.mit.edu/pks/lookup?op=get&search=0x9BBF07CAC07A276D
- @kleetus: https://pgp.mit.edu/pks/lookup?op=get&search=0x33195D27EF6BDB7F
- @pnagurny: https://pgp.mit.edu/pks/lookup?op=get&search=0x0909B33F0AA53013

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2015 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.
