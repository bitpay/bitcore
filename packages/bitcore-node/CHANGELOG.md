# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [8.1.1](https://github.com/matiu/bitcore/compare/v8.1.0...v8.1.1) (2019-03-21)

### Bug Fixes

* **node:** detecting dupe transactions and coins with mismatched heights ([3891140](https://github.com/matiu/bitcore/commit/3891140))

## [8.1.0](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.44...v8.1.0) (2019-02-27)

### Bug Fixes

* **bitcore-node:** set all indexes to build in the background ([107fe0b](https://github.com/nitsujlangston/bitcore/commit/107fe0b))
* **node:** config and rate limit ([d352b20](https://github.com/nitsujlangston/bitcore/commit/d352b20))
* **node:** config properties could be undefined ([6fd40d0](https://github.com/nitsujlangston/bitcore/commit/6fd40d0))
* **node:** config should use merge, findOneAndUpdate should return new ([8ecd8d6](https://github.com/nitsujlangston/bitcore/commit/8ecd8d6))
* **node:** fix some logging ([da5ede5](https://github.com/nitsujlangston/bitcore/commit/da5ede5))
* **node:** fix test ([06dee24](https://github.com/nitsujlangston/bitcore/commit/06dee24))
* **node:** fixing the repair script so we can repair while a node is syncing ([b1b1e17](https://github.com/nitsujlangston/bitcore/commit/b1b1e17))
* **node:** race condition rejects ([d47ffb3](https://github.com/nitsujlangston/bitcore/commit/d47ffb3))
* **node:** remove wallet from websockets ([b1a2d63](https://github.com/nitsujlangston/bitcore/commit/b1a2d63))
* **node:** removing confirmations ([51ccf3f](https://github.com/nitsujlangston/bitcore/commit/51ccf3f))
* **node:** removing limits on wallet address endpoint ([8b1515b](https://github.com/nitsujlangston/bitcore/commit/8b1515b))
* **node:** removing unneeded properties ([7f2ad9f](https://github.com/nitsujlangston/bitcore/commit/7f2ad9f))
* **node:** resync uses connect ([74df9b8](https://github.com/nitsujlangston/bitcore/commit/74df9b8))
* **node:** stream has a memory leak, use event emitter instead ([d256e5c](https://github.com/nitsujlangston/bitcore/commit/d256e5c))
* **sync:** handle sync node going awol ([372b273](https://github.com/nitsujlangston/bitcore/commit/372b273))

### Features

* **api:** Adds check wallet endpoint ([a606095](https://github.com/nitsujlangston/bitcore/commit/a606095))
* **api:** break balance response into confirmed and unconfirmed components ([894cec5](https://github.com/nitsujlangston/bitcore/commit/894cec5))
* **api:** cache fee estimates that hit rpc ([d752027](https://github.com/nitsujlangston/bitcore/commit/d752027))
* **api:** Rate Limits ([cee765f](https://github.com/nitsujlangston/bitcore/commit/cee765f))
* **config:** expand '~' for BITCORE_CONFIG_PATH ([db5a17e](https://github.com/nitsujlangston/bitcore/commit/db5a17e))
* **insight:** begin building out blocks view, related components ([92f0259](https://github.com/nitsujlangston/bitcore/commit/92f0259))
* **insight:** block detail view ([3d50203](https://github.com/nitsujlangston/bitcore/commit/3d50203))
* **insight:** scaffold routing, continue building out blocks view ([afdc409](https://github.com/nitsujlangston/bitcore/commit/afdc409))
* **node:** dependency injection / config ([640310c](https://github.com/nitsujlangston/bitcore/commit/640310c))
* **service:** support multiple sync nodes ([66385ce](https://github.com/nitsujlangston/bitcore/commit/66385ce))
* **sync:** prune mempool transactions and coins when conflicting ones come in ([18ffda1](https://github.com/nitsujlangston/bitcore/commit/18ffda1))

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

## [8.0.1](https://github.com/nitsujlangston/bitcore/compare/v5.0.0-beta.44...v8.0.1) (2019-02-27)

### Bug Fixes

* **bitcore-node:** set all indexes to build in the background ([107fe0b](https://github.com/nitsujlangston/bitcore/commit/107fe0b))
* **node:** config and rate limit ([d352b20](https://github.com/nitsujlangston/bitcore/commit/d352b20))
* **node:** config properties could be undefined ([6fd40d0](https://github.com/nitsujlangston/bitcore/commit/6fd40d0))
* **node:** config should use merge, findOneAndUpdate should return new ([8ecd8d6](https://github.com/nitsujlangston/bitcore/commit/8ecd8d6))
* **node:** fix some logging ([da5ede5](https://github.com/nitsujlangston/bitcore/commit/da5ede5))
* **node:** fix test ([06dee24](https://github.com/nitsujlangston/bitcore/commit/06dee24))
* **node:** fixing the repair script so we can repair while a node is syncing ([b1b1e17](https://github.com/nitsujlangston/bitcore/commit/b1b1e17))
* **node:** race condition rejects ([d47ffb3](https://github.com/nitsujlangston/bitcore/commit/d47ffb3))
* **node:** remove wallet from websockets ([b1a2d63](https://github.com/nitsujlangston/bitcore/commit/b1a2d63))
* **node:** removing confirmations ([51ccf3f](https://github.com/nitsujlangston/bitcore/commit/51ccf3f))
* **node:** removing limits on wallet address endpoint ([8b1515b](https://github.com/nitsujlangston/bitcore/commit/8b1515b))
* **node:** removing unneeded properties ([7f2ad9f](https://github.com/nitsujlangston/bitcore/commit/7f2ad9f))
* **node:** resync uses connect ([74df9b8](https://github.com/nitsujlangston/bitcore/commit/74df9b8))
* **node:** stream has a memory leak, use event emitter instead ([d256e5c](https://github.com/nitsujlangston/bitcore/commit/d256e5c))
* **sync:** handle sync node going awol ([372b273](https://github.com/nitsujlangston/bitcore/commit/372b273))

### Features

* **api:** Adds check wallet endpoint ([a606095](https://github.com/nitsujlangston/bitcore/commit/a606095))
* **api:** break balance response into confirmed and unconfirmed components ([894cec5](https://github.com/nitsujlangston/bitcore/commit/894cec5))
* **api:** cache fee estimates that hit rpc ([d752027](https://github.com/nitsujlangston/bitcore/commit/d752027))
* **api:** Rate Limits ([cee765f](https://github.com/nitsujlangston/bitcore/commit/cee765f))
* **config:** expand '~' for BITCORE_CONFIG_PATH ([db5a17e](https://github.com/nitsujlangston/bitcore/commit/db5a17e))
* **insight:** begin building out blocks view, related components ([92f0259](https://github.com/nitsujlangston/bitcore/commit/92f0259))
* **insight:** block detail view ([3d50203](https://github.com/nitsujlangston/bitcore/commit/3d50203))
* **insight:** scaffold routing, continue building out blocks view ([afdc409](https://github.com/nitsujlangston/bitcore/commit/afdc409))
* **node:** dependency injection / config ([640310c](https://github.com/nitsujlangston/bitcore/commit/640310c))
* **service:** support multiple sync nodes ([66385ce](https://github.com/nitsujlangston/bitcore/commit/66385ce))
* **sync:** prune mempool transactions and coins when conflicting ones come in ([18ffda1](https://github.com/nitsujlangston/bitcore/commit/18ffda1))

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
