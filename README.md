# Bitcore Monorepo

  <p align="center">
  <a href="https://www.npmjs.com/package/bitcore-lib"> 
  <img alt="npm" src="https://img.shields.io/npm/v/bitcore-lib">
  <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/bitpay/bitcore">
  <a href="https://opensource.org/licenses/MIT/" target="_blank"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-blue.svg" style="display: inherit;"/></a>
  <a href="https://github.com/bitpay/bitcore/graphs/contributors"> 
    <img alt="GitHub contributors" src="https://img.shields.io/github/contributors/bitpay/bitcore">
  </a>
  <br>
 <img src="https://circleci.com/gh/bitpay/bitcore.svg?style=shield" alt="master build">
</p>
  
**Infrastructure to build Bitcoin and blockchain-based applications for the next generation of financial technology.**

## Applications

- [Bitcore Node](packages/bitcore-node) - A standardized API to interact with multiple blockchain networks
- [Bitcore Wallet Client](packages/bitcore-wallet-client) - A client for the wallet service
- [Bitcore Wallet Service](packages/bitcore-wallet-service) - A multisig HD service for wallets
- [Bitcore CLI](packages/bitcore-cli) - A command line interface for using BWS and BWC
- [Insight](packages/insight) - A blockchain explorer web user interface

## Libraries

- [Bitcore Lib](packages/bitcore-lib) - A powerful JavaScript library for Bitcoin
- [Bitcore Lib Cash](packages/bitcore-lib-cash) - A powerful JavaScript library for Bitcoin Cash
- [Bitcore Lib Doge](packages/bitcore-lib-doge) - A powerful JavaScript library for Dogecoin
- [Bitcore Lib Litecoin](packages/bitcore-lib-ltc) - A powerful JavaScript library for Litecoin
- [Bitcore Mnemonic](packages/bitcore-mnemonic) - Implements mnemonic code for generating deterministic keys
- [Bitcore P2P](packages/bitcore-p2p) - The peer-to-peer networking protocol for Bitcoin
- [Bitcore P2P Cash](packages/bitcore-p2p-cash) - The peer-to-peer networking protocol for Bitcoin Cash
- [Bitcore P2P Doge](packages/bitcore-p2p-doge) **DEPRECATED**[^1] - The peer-to-peer networking protocol for Dogecoin
- [Crypto Wallet Core](packages/crypto-wallet-core) - A coin-agnostic wallet library for creating transactions, signing, and address derivation

## Extras

- [Bitcore Build](packages/bitcore-build) - A helper to add tasks to gulp
- [Bitcore Client](packages/bitcore-client) - A helper to create a wallet using the bitcore-node infrastructure
- [Bitpay/Bitpay App](https://github.com/bitpay/bitpay-app) - An easy-to-use, multiplatform, multisignature, secure wallet for bitcoin, ethereum, and more


## Versioning

This repo follows the even-odd versioning convention. Major versions that are even (e.g. v8.x.x) are `stable` releases, odd are `beta` releases (e.g. v9.x.x). Beta versions may contain breaking changes or major feature additions that are still in testing.

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/CONTRIBUTING.md) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2025 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.

[^1]: The Bitcore P2P Doge library is no longer maintained as all the core functionality is contained in Bitcore P2P
