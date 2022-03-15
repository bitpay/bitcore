# Bitcore Monorepo

  <p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/bitcore-lib">
  <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/bitpay/bitcore">
  <a href="https://opensource.org/licenses/MIT/" target="_blank"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-blue.svg" style="display: inherit;"/></a>
  <img alt="GitHub contributors" src="https://img.shields.io/github/contributors/bitpay/bitcore">
  <br>
 <img src="https://circleci.com/gh/bitpay/bitcore.svg?style=shield" alt="master build">
</p>
  
**Infrastructure to build Bitcoin and blockchain-based applications for the next generation of financial technology.**

## Applications

- [Bitcore Node](packages/bitcore-node) - A full node with extended capabilities using Bitcoin Core
- [Bitcore Wallet](packages/bitcore-wallet) - A command-line based wallet client
- [Bitcore Wallet Client](packages/bitcore-wallet-client) - A client for the wallet service
- [Bitcore Wallet Service](packages/bitcore-wallet-service) - A multisig HD service for wallets
- [Bitpay Wallet](https://github.com/bitpay/copay) - An easy-to-use, multiplatform, multisignature, secure bitcoin wallet
- [Insight](packages/insight) - A blockchain explorer web user interface

## Libraries

- [Bitcore Channel](https://github.com/bitpay/bitcore-channel) - Micropayment channels for rapidly adjusting bitcoin transactions
- [Bitcore ECIES](https://github.com/bitpay/bitcore-ecies) - Uses ECIES symmetric key negotiation from public keys to encrypt arbitrarily long data streams
- [Bitcore Lib](packages/bitcore-lib) - A powerful JavaScript library for Bitcoin
- [Bitcore Lib Cash](packages/bitcore-lib-cash) - A powerful JavaScript library for Bitcoin Cash
- [Bitcore Lib Doge](packages/bitcore-lib-doge) - A powerful JavaScript library for Dogecoin
- [Bitcore Lib Litecoin](packages/bitcore-lib-ltc) - A powerful JavaScript library for Litecoin
- [Bitcore Message](https://github.com/bitpay/bitcore-message) - Bitcoin message verification and signing
- [Bitcore Mnemonic](packages/bitcore-mnemonic) - Implements mnemonic code for generating deterministic keys
- [Bitcore P2P](packages/bitcore-p2p) - The peer-to-peer networking protocol for Bitcoin
- [Bitcore P2P Cash](packages/bitcore-p2p-cash) - The peer-to-peer networking protocol for Bitcoin Cash
- [Bitcore P2P Doge](packages/bitcore-p2p-doge) **DEPRECATED**[^1] - The peer-to-peer networking protocol for Dogecoin
- [Crypto Wallet Core](packages/crypto-wallet-core) - A coin-agnostic wallet library for creating transactions, signing, and address derivation

## Extras

- [Bitcore Build](packages/bitcore-build) - A helper to add tasks to gulp
- [Bitcore Client](packages/bitcore-client) - A helper to create a wallet using the bitcore-v8 infrastructure

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/Contributing.md) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2022 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.

[^1]: The Bitcore P2P Doge library is no longer maintained as all the core functionality is contained in Bitcore P2P