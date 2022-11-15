# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [8.1.1](https://github.com/matiu/bitcore/compare/v8.1.0...v8.1.1) (2019-03-21)

### Bug Fixes

* **node:** detecting dupe transactions and coins with mismatched heights ([3891140](https://github.com/matiu/bitcore/commit/3891140))

## [8.1.0](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.44...v8.1.0) (2019-02-27)

### Bug Fixes

* do not remove scripts from outputs ([0d9dc85](https://github.com/nitsujlangston/bitcore/commit/0d9dc85))
* failed verification if customData is object ([1848cd5](https://github.com/nitsujlangston/bitcore/commit/1848cd5))
* Fix callback name ([44a45de](https://github.com/nitsujlangston/bitcore/commit/44a45de))
* fix variable typo for paypro. ([6db7923](https://github.com/nitsujlangston/bitcore/commit/6db7923))
* handle outgoing TXs foreign crafted ([869840e](https://github.com/nitsujlangston/bitcore/commit/869840e))
* show message unconfirmed transactions if there is not transaction confirmed yet ([aea2af5](https://github.com/nitsujlangston/bitcore/commit/aea2af5))
* **node:** fix test ([06dee24](https://github.com/nitsujlangston/bitcore/commit/06dee24))
* show tx without input addres. Show type of address for tx out ([fb00366](https://github.com/nitsujlangston/bitcore/commit/fb00366))
* **bitcore-node:** set all indexes to build in the background ([107fe0b](https://github.com/nitsujlangston/bitcore/commit/107fe0b))
* **lib-cash:** match bitcore-lib estimateFee fix ([8650345](https://github.com/nitsujlangston/bitcore/commit/8650345))
* **node:** config and rate limit ([d352b20](https://github.com/nitsujlangston/bitcore/commit/d352b20))
* **node:** config properties could be undefined ([6fd40d0](https://github.com/nitsujlangston/bitcore/commit/6fd40d0))
* **node:** config should use merge, findOneAndUpdate should return new ([8ecd8d6](https://github.com/nitsujlangston/bitcore/commit/8ecd8d6))
* **node:** fix some logging ([da5ede5](https://github.com/nitsujlangston/bitcore/commit/da5ede5))
* **node:** fixing the repair script so we can repair while a node is syncing ([b1b1e17](https://github.com/nitsujlangston/bitcore/commit/b1b1e17))
* **node:** race condition rejects ([d47ffb3](https://github.com/nitsujlangston/bitcore/commit/d47ffb3))
* **node:** remove wallet from websockets ([b1a2d63](https://github.com/nitsujlangston/bitcore/commit/b1a2d63))
* **node:** removing confirmations ([51ccf3f](https://github.com/nitsujlangston/bitcore/commit/51ccf3f))
* **node:** removing limits on wallet address endpoint ([8b1515b](https://github.com/nitsujlangston/bitcore/commit/8b1515b))
* typo - s/Payment/PaymentACK/ ([7b408c3](https://github.com/nitsujlangston/bitcore/commit/7b408c3))
* wrong output value calculation in _buildTx ([2e1cc88](https://github.com/nitsujlangston/bitcore/commit/2e1cc88))
* **node:** removing unneeded properties ([7f2ad9f](https://github.com/nitsujlangston/bitcore/commit/7f2ad9f))
* **node:** resync uses connect ([74df9b8](https://github.com/nitsujlangston/bitcore/commit/74df9b8))
* **node:** stream has a memory leak, use event emitter instead ([d256e5c](https://github.com/nitsujlangston/bitcore/commit/d256e5c))
* **server:** Fix unconfirmed utxo results ([72bf2bb](https://github.com/nitsujlangston/bitcore/commit/72bf2bb))
* **sync:** handle sync node going awol ([372b273](https://github.com/nitsujlangston/bitcore/commit/372b273))

### Features

* **api:** Adds check wallet endpoint ([a606095](https://github.com/nitsujlangston/bitcore/commit/a606095))
* **api:** break balance response into confirmed and unconfirmed components ([894cec5](https://github.com/nitsujlangston/bitcore/commit/894cec5))
* **api:** cache fee estimates that hit rpc ([d752027](https://github.com/nitsujlangston/bitcore/commit/d752027))
* **api:** Rate Limits ([cee765f](https://github.com/nitsujlangston/bitcore/commit/cee765f))
* **config:** expand '~' for BITCORE_CONFIG_PATH ([db5a17e](https://github.com/nitsujlangston/bitcore/commit/db5a17e))
* **gitignore:** untracked vim/mac files ([8f5fb27](https://github.com/nitsujlangston/bitcore/commit/8f5fb27))
* **insight:** begin building out blocks view, related components ([92f0259](https://github.com/nitsujlangston/bitcore/commit/92f0259))
* **insight:** block detail view ([3d50203](https://github.com/nitsujlangston/bitcore/commit/3d50203))
* **insight:** scaffold routing, continue building out blocks view ([afdc409](https://github.com/nitsujlangston/bitcore/commit/afdc409))
* **node:** dependency injection / config ([640310c](https://github.com/nitsujlangston/bitcore/commit/640310c))
* **node:** scaffold search ([0d19ada](https://github.com/nitsujlangston/bitcore/commit/0d19ada))
* **service:** support multiple sync nodes ([66385ce](https://github.com/nitsujlangston/bitcore/commit/66385ce))
* **sync:** prune mempool transactions and coins when conflicting ones come in ([18ffda1](https://github.com/nitsujlangston/bitcore/commit/18ffda1))
* **tests:** Add v8 history testing template ([904cbd4](https://github.com/nitsujlangston/bitcore/commit/904cbd4))

### Performance Improvements

* **api:** stream wallet address import process ([e0333f8](https://github.com/nitsujlangston/bitcore/commit/e0333f8))
* **api:** transaction list performance enhancements ([f2d6ec9](https://github.com/nitsujlangston/bitcore/commit/f2d6ec9))
* **db:** wallet partial indexes ([65e72d4](https://github.com/nitsujlangston/bitcore/commit/65e72d4))
* **sync:** add utxo cache behavior to coin spend ([3dd7521](https://github.com/nitsujlangston/bitcore/commit/3dd7521))
* **sync:** lra cache address encoding of output scripts ([6892f43](https://github.com/nitsujlangston/bitcore/commit/6892f43))
* **wallet api:** improve wallet transaction list performance ([7491e6f](https://github.com/nitsujlangston/bitcore/commit/7491e6f))

### BREAKING CHANGES

* **api:** balance response has changed from `{balance: number}` to `{confirmed: number,
unconfirmed: number}`
* **wallet api:** no longer page based on _id

## [8.0.0](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.44...v8.0.0) (2019-02-27)

### Bug Fixes

* **bitcore-node:** set all indexes to build in the background ([107fe0b](https://github.com/nitsujlangston/bitcore/commit/107fe0b))
* **lib-cash:** match bitcore-lib estimateFee fix ([8650345](https://github.com/nitsujlangston/bitcore/commit/8650345))
* **node:** config and rate limit ([d352b20](https://github.com/nitsujlangston/bitcore/commit/d352b20))
* **node:** config properties could be undefined ([6fd40d0](https://github.com/nitsujlangston/bitcore/commit/6fd40d0))
* **node:** config should use merge, findOneAndUpdate should return new ([8ecd8d6](https://github.com/nitsujlangston/bitcore/commit/8ecd8d6))
* **node:** fix some logging ([da5ede5](https://github.com/nitsujlangston/bitcore/commit/da5ede5))
* **node:** fix test ([06dee24](https://github.com/nitsujlangston/bitcore/commit/06dee24))
* **node:** fixing the repair script so we can repair while a node is syncing ([b1b1e17](https://github.com/nitsujlangston/bitcore/commit/b1b1e17))
* Fix callback name ([44a45de](https://github.com/nitsujlangston/bitcore/commit/44a45de))
* **node:** race condition rejects ([d47ffb3](https://github.com/nitsujlangston/bitcore/commit/d47ffb3))
* **node:** remove wallet from websockets ([b1a2d63](https://github.com/nitsujlangston/bitcore/commit/b1a2d63))
* **node:** removing confirmations ([51ccf3f](https://github.com/nitsujlangston/bitcore/commit/51ccf3f))
* **node:** removing limits on wallet address endpoint ([8b1515b](https://github.com/nitsujlangston/bitcore/commit/8b1515b))
* **node:** removing unneeded properties ([7f2ad9f](https://github.com/nitsujlangston/bitcore/commit/7f2ad9f))
* **node:** resync uses connect ([74df9b8](https://github.com/nitsujlangston/bitcore/commit/74df9b8))
* **node:** stream has a memory leak, use event emitter instead ([d256e5c](https://github.com/nitsujlangston/bitcore/commit/d256e5c))
* **server:** Fix unconfirmed utxo results ([72bf2bb](https://github.com/nitsujlangston/bitcore/commit/72bf2bb))
* **sync:** handle sync node going awol ([372b273](https://github.com/nitsujlangston/bitcore/commit/372b273))

### Features

* **api:** Adds check wallet endpoint ([a606095](https://github.com/nitsujlangston/bitcore/commit/a606095))
* **api:** break balance response into confirmed and unconfirmed components ([894cec5](https://github.com/nitsujlangston/bitcore/commit/894cec5))
* **api:** cache fee estimates that hit rpc ([d752027](https://github.com/nitsujlangston/bitcore/commit/d752027))
* **api:** Rate Limits ([cee765f](https://github.com/nitsujlangston/bitcore/commit/cee765f))
* **config:** expand '~' for BITCORE_CONFIG_PATH ([db5a17e](https://github.com/nitsujlangston/bitcore/commit/db5a17e))
* **gitignore:** untracked vim/mac files ([8f5fb27](https://github.com/nitsujlangston/bitcore/commit/8f5fb27))
* **insight:** begin building out blocks view, related components ([92f0259](https://github.com/nitsujlangston/bitcore/commit/92f0259))
* **insight:** block detail view ([3d50203](https://github.com/nitsujlangston/bitcore/commit/3d50203))
* **insight:** scaffold routing, continue building out blocks view ([afdc409](https://github.com/nitsujlangston/bitcore/commit/afdc409))
* **node:** dependency injection / config ([640310c](https://github.com/nitsujlangston/bitcore/commit/640310c))
* **node:** scaffold search ([0d19ada](https://github.com/nitsujlangston/bitcore/commit/0d19ada))
* **service:** support multiple sync nodes ([66385ce](https://github.com/nitsujlangston/bitcore/commit/66385ce))
* **sync:** prune mempool transactions and coins when conflicting ones come in ([18ffda1](https://github.com/nitsujlangston/bitcore/commit/18ffda1))
* **tests:** Add v8 history testing template ([904cbd4](https://github.com/nitsujlangston/bitcore/commit/904cbd4))

### Performance Improvements

* **api:** stream wallet address import process ([e0333f8](https://github.com/nitsujlangston/bitcore/commit/e0333f8))
* **api:** transaction list performance enhancements ([f2d6ec9](https://github.com/nitsujlangston/bitcore/commit/f2d6ec9))
* **db:** wallet partial indexes ([65e72d4](https://github.com/nitsujlangston/bitcore/commit/65e72d4))
* **sync:** add utxo cache behavior to coin spend ([3dd7521](https://github.com/nitsujlangston/bitcore/commit/3dd7521))
* **sync:** lra cache address encoding of output scripts ([6892f43](https://github.com/nitsujlangston/bitcore/commit/6892f43))
* **wallet api:** improve wallet transaction list performance ([7491e6f](https://github.com/nitsujlangston/bitcore/commit/7491e6f))

### BREAKING CHANGES

* **api:** balance response has changed from `{balance: number}` to `{confirmed: number,
unconfirmed: number}`
* **wallet api:** no longer page based on _id

## [5.0.0-beta.44](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.43...v5.0.0-beta.44) (2017-11-22)

### Bug Fixes

* handle outgoing TXs foreign crafted ([869840e](https://github.com/nitsujlangston/bitcore/commit/869840e))

## [5.0.0-beta.43](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.42...v5.0.0-beta.43) (2017-11-13)

## [5.0.0-beta.42](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.41...v5.0.0-beta.42) (2017-11-13)

## [5.0.0-beta.41](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.40...v5.0.0-beta.41) (2017-11-10)

## [5.0.0-beta.40](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.39...v5.0.0-beta.40) (2017-11-09)

## [5.0.0-beta.39](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.38...v5.0.0-beta.39) (2017-11-08)

## [5.0.0-beta.38](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.37...v5.0.0-beta.38) (2017-11-08)

## [5.0.0-beta.37](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.36...v5.0.0-beta.37) (2017-11-07)

## [5.0.0-beta.36](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.35...v5.0.0-beta.36) (2017-11-07)

## [5.0.0-beta.35](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.34...v5.0.0-beta.35) (2017-11-07)

## [5.0.0-beta.34](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.33...v5.0.0-beta.34) (2017-11-07)

## [5.0.0-beta.33](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.32...v5.0.0-beta.33) (2017-11-05)

## [5.0.0-beta.32](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.31...v5.0.0-beta.32) (2017-11-02)

## [5.0.0-beta.31](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.30...v5.0.0-beta.31) (2017-11-02)

## [5.0.0-beta.30](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.29...v5.0.0-beta.30) (2017-11-02)

## [5.0.0-beta.29](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.28...v5.0.0-beta.29) (2017-11-01)

## [5.0.0-beta.28](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.27...v5.0.0-beta.28) (2017-10-30)

## [5.0.0-beta.27](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.26...v5.0.0-beta.27) (2017-10-26)

## [5.0.0-beta.26](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.25...v5.0.0-beta.26) (2017-10-26)

## [5.0.0-beta.25](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.24...v5.0.0-beta.25) (2017-10-24)

## [5.0.0-beta.24](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.23...v5.0.0-beta.24) (2017-10-24)

## [5.0.0-beta.23](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.22...v5.0.0-beta.23) (2017-10-20)

## [5.0.0-beta.22](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.21...v5.0.0-beta.22) (2017-10-18)

## [5.0.0-beta.21](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.20...v5.0.0-beta.21) (2017-10-12)

## [5.0.0-beta.20](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.19...v5.0.0-beta.20) (2017-10-12)

## [5.0.0-beta.19](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.18...v5.0.0-beta.19) (2017-10-12)

## [5.0.0-beta.18](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.17...v5.0.0-beta.18) (2017-10-11)

## [5.0.0-beta.17](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.16...v5.0.0-beta.17) (2017-10-11)

## [5.0.0-beta.16](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.15...v5.0.0-beta.16) (2017-10-09)

## [5.0.0-beta.15](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.14...v5.0.0-beta.15) (2017-10-08)

## [5.0.0-beta.14](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.13...v5.0.0-beta.14) (2017-10-02)

## [5.0.0-beta.13](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.12...v5.0.0-beta.13) (2017-10-01)

## [5.0.0-beta.12](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.11...v5.0.0-beta.12) (2017-09-27)

## [5.0.0-beta.11](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.10...v5.0.0-beta.11) (2017-09-26)

## [5.0.0-beta.10](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.9...v5.0.0-beta.10) (2017-09-24)

## [5.0.0-beta.9](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.8...v5.0.0-beta.9) (2017-09-12)

## [5.0.0-beta.8](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.7...v5.0.0-beta.8) (2017-09-08)

## [5.0.0-beta.7](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.6...v5.0.0-beta.7) (2017-09-07)

## [5.0.0-beta.6](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.5...v5.0.0-beta.6) (2017-09-01)

## [5.0.0-beta.5](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.4...v5.0.0-beta.5) (2017-08-31)

## [5.0.0-beta.4](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.3...v5.0.0-beta.4) (2017-08-29)

## [5.0.0-beta.3](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.2...v5.0.0-beta.3) (2017-08-29)

## [5.0.0-beta.2](https://github.com/nitsujlangston/bitcore/compare/5.0.0-beta.1...v5.0.0-beta.2) (2017-08-29)

## [5.0.0-beta.1](https://github.com/nitsujlangston/bitcore/compare/v4.1.1...5.0.0-beta.1) (2017-08-18)

## [4.1.1](https://github.com/nitsujlangston/bitcore/compare/v4.1.0...v4.1.1) (2017-05-17)

### Bug Fixes

* do not remove scripts from outputs ([0d9dc85](https://github.com/nitsujlangston/bitcore/commit/0d9dc85))
* failed verification if customData is object ([1848cd5](https://github.com/nitsujlangston/bitcore/commit/1848cd5))
* wrong output value calculation in _buildTx ([2e1cc88](https://github.com/nitsujlangston/bitcore/commit/2e1cc88))

## [3.0.0](https://github.com/nitsujlangston/bitcore/compare/v2.0.0...v3.0.0) (2016-01-28)

## [2.0.0](https://github.com/nitsujlangston/bitcore/compare/v1.0.0...v2.0.0) (2015-11-04)

## [1.0.0](https://github.com/nitsujlangston/bitcore/compare/v0.9.4...v1.0.0) (2015-10-21)

### Bug Fixes

* **bower.json:** Add better ignores ([3a7905a](https://github.com/nitsujlangston/bitcore/commit/3a7905a))

## [0.8.2](https://github.com/nitsujlangston/bitcore/compare/v0.8.1...v0.8.2) (2014-12-19)

## [0.8.1](https://github.com/nitsujlangston/bitcore/compare/v0.8.0...v0.8.1) (2014-12-17)

## [0.1.36](https://github.com/nitsujlangston/bitcore/compare/v0.1.35...v0.1.36) (2014-09-08)

### Bug Fixes

* Pubkey(point) and Privkey(bn) ([073ee0a](https://github.com/nitsujlangston/bitcore/commit/073ee0a))

## [0.1.35](https://github.com/nitsujlangston/bitcore/compare/v0.1.34...v0.1.35) (2014-08-13)

## [0.1.34](https://github.com/nitsujlangston/bitcore/compare/v0.1.33...v0.1.34) (2014-07-25)

## [0.1.33](https://github.com/nitsujlangston/bitcore/compare/v0.1.32...v0.1.33) (2014-07-25)

### Bug Fixes

* fix RootCert generation. ([948d6cd](https://github.com/nitsujlangston/bitcore/commit/948d6cd))
* fix variable typo for paypro. ([6db7923](https://github.com/nitsujlangston/bitcore/commit/6db7923))
* fix variable typo for paypro. ([14bf79c](https://github.com/nitsujlangston/bitcore/commit/14bf79c))
* typo - s/Payment/PaymentACK/ ([7b408c3](https://github.com/nitsujlangston/bitcore/commit/7b408c3))
* typo - s/Payment/PaymentACK/ ([11c977b](https://github.com/nitsujlangston/bitcore/commit/11c977b))

## [0.1.32](https://github.com/nitsujlangston/bitcore/compare/v0.1.31...v0.1.32) (2014-07-18)

## [0.1.31](https://github.com/nitsujlangston/bitcore/compare/v0.1.30...v0.1.31) (2014-07-17)

## [0.1.30](https://github.com/nitsujlangston/bitcore/compare/v0.1.29...v0.1.30) (2014-07-17)

## [0.1.29](https://github.com/nitsujlangston/bitcore/compare/v0.1.28...v0.1.29) (2014-07-16)

## [0.1.28](https://github.com/nitsujlangston/bitcore/compare/v0.1.27...v0.1.28) (2014-07-16)

## [0.1.27](https://github.com/nitsujlangston/bitcore/compare/v0.1.26...v0.1.27) (2014-07-10)

## [0.1.26](https://github.com/nitsujlangston/bitcore/compare/v0.1.25...v0.1.26) (2014-07-08)

## [0.1.25](https://github.com/nitsujlangston/bitcore/compare/v0.1.24...v0.1.25) (2014-07-07)

## [0.1.24](https://github.com/nitsujlangston/bitcore/compare/v0.1.23...v0.1.24) (2014-06-12)

## [0.1.23](https://github.com/nitsujlangston/bitcore/compare/v0.1.22...v0.1.23) (2014-06-06)

## [0.1.22](https://github.com/nitsujlangston/bitcore/compare/v0.1.20...v0.1.22) (2014-06-06)

## [0.1.20](https://github.com/nitsujlangston/bitcore/compare/v0.1.19...v0.1.20) (2014-05-23)

## [0.1.18](https://github.com/nitsujlangston/bitcore/compare/v0.1.17...v0.1.18) (2014-05-02)

## [0.1.17](https://github.com/nitsujlangston/bitcore/compare/v0.1.16...v0.1.17) (2014-04-29)

## [0.1.16](https://github.com/nitsujlangston/bitcore/compare/v0.1.15...v0.1.16) (2014-04-25)

## [0.1.15](https://github.com/nitsujlangston/bitcore/compare/v0.1.14...v0.1.15) (2014-04-25)

## [0.1.14](https://github.com/nitsujlangston/bitcore/compare/v0.1.13...v0.1.14) (2014-04-24)

## [0.1.13](https://github.com/nitsujlangston/bitcore/compare/v0.1.12...v0.1.13) (2014-04-24)

## [0.1.12](https://github.com/nitsujlangston/bitcore/compare/v0.1.11...v0.1.12) (2014-04-20)

## [0.1.11](https://github.com/nitsujlangston/bitcore/compare/v0.1.10...v0.1.11) (2014-04-05)

## [0.1.10](https://github.com/nitsujlangston/bitcore/compare/v0.1.9...v0.1.10) (2014-04-05)


### Bug Fixes

* show message unconfirmed transactions if there is not transaction confirmed yet ([aea2af5](https://github.com/nitsujlangston/bitcore/commit/aea2af5))
* show tx without input addres. Show type of address for tx out ([fb00366](https://github.com/nitsujlangston/bitcore/commit/fb00366))

## [0.1.2](https://github.com/nitsujlangston/bitcore/compare/v0.1.1...v0.1.2) (2013-07-07)

## [0.1.1](https://github.com/nitsujlangston/bitcore/compare/v0.1.0...v0.1.1) (2013-07-07)

## 0.1.0 (2013-07-04)
