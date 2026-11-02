# Bitcore Monorepo

  <p align="center">
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
- [Bitcore Wallet Client](packages/bitcore-wallet-client) - A client for Bitcore Wallet Service
- [Bitcore Wallet Service](packages/bitcore-wallet-service) - A coordination service for multisig wallets
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
- [Crypto RPC](packages/crypto-rpc) - A library for connecting to blockchains' RPC interfaces

## Extras

- [Bitcore Build](packages/bitcore-build) - A helper to add tasks to gulp
- [Bitcore Client](packages/bitcore-client) - A helper to create a wallet using the bitcore-node infrastructure
- [Bitpay/Bitpay App](https://github.com/bitpay/bitpay-app) - An easy-to-use, multiplatform, multisignature, secure wallet for bitcoin, ethereum, and more


## Development

The 18 backend packages under `packages/` (everything except `insight` and the
three nested `benchmark/` fixtures) are npm workspaces of this root, installed
and linked from one root install and one root lockfile. Run installs from the
root and use `--workspace` to edit a package's dependencies. npm may place
conflicting dependency versions in nested `node_modules` directories; these
are still managed by the root lockfile.
This is a monorepo-development-only change: it does not affect ordinary
consumers, who continue to `npm install @bitpay-labs/bitcore-node` (or any
other published package) from the registry exactly as before.

### Setup

Use Node `24.22.1` and npm exactly `11.19.1`. Root `package.json` declares
`devEngines`, which npm checks before `install`, `ci`, and `run` commands.
Then, from the repo root:

```sh
git clone https://github.com/bitpay/bitcore.git
cd bitcore
npm ci
```

`npm ci` installs and links all workspaces and then automatically compiles
the packages that need a build step (`bitcore-logging`, `crypto-wallet-core`,
`bitcore-wallet-service`, `bitcore-wallet-client`, `bitcore-client`,
`bitcore-cli`, `bitcore-node`, in that order) via a root `postinstall` hook.
The root `compile` script chains workspace commands with `&&` to stop on the
first failure. Keep dependencies before their consumers when adding a compile
step: npm does not calculate build order, and running across all workspaces
continues after individual failures.
To recompile later without reinstalling — after pulling changes or editing a
package directly — run:

```sh
npm run compile
```

### Editing a workspace's dependencies

Add or update a package's own dependency with `--workspace`, from the root:

```sh
npm install <dependency> --workspace=@bitpay-labs/<package-directory-name>
```

Internal cross-package dependencies (e.g. `bitcore-node` depending on
`@bitpay-labs/crypto-wallet-core`) are declared as ordinary semver ranges in
each package's `package.json`, the same as any published dependency — not
`workspace:*` or `file:` references — and are linked locally by npm because
the range matches the local version.

### Running and testing

- `npm run test:<package-directory-name>` runs one package's own tests (e.g.
  `npm run test:bitcore-lib`, `npm run test:bitcore-wallet-service`). There is
  no single aggregate root `test` script; run the specific package(s) you
  changed, or see [`ci.sh`](ci.sh) below for the full matrix used in CI.
- `npm run watch` runs bitcore-client's TypeScript watcher.
- `npm run node` / `npm run bws` start bitcore-node / bitcore-wallet-service
  directly from source.
- `npm run build` builds the root Docker image; `npm run build:docker` builds
  the bitcore-node and bitcore-wallet-service images.

### Workspace and package checks

```sh
npm run workspaces:check
npm run test:workspaces
npm test --workspace=@bitpay-labs/bitcore-build
npm run artifacts:check -- --destination=/tmp/bitcore-artifacts
npm run artifacts:consumer -- --artifacts=/tmp/bitcore-artifacts/artifacts.json
```

CI runs these checks in addition to the package test matrix. They verify local
workspace resolution, installed dependency engines, packed entry points and
templates, declared runtime imports, and an external TypeScript/JavaScript
consumer. The engine check permits only the legacy `socks5-client@0.3.6`
declaration (`node: 0.x`); other incompatible engines fail CI.

Package checks discover public packages and versions from current workspace
manifests. Browser library packages generate their bundles using `prepack` and
include them explicitly in `files`, so both `npm pack` and `npm publish` ship
the generated bundles along with the Node entry point and `lib` tree. `artifacts:check` builds
and packs packages without publishing or changing versions. The consumer
check installs those tarballs outside the checkout and needs registry access
for third-party dependencies. Choose an empty output directory for each run.

### Insight

Insight (`packages/insight`) is deliberately kept out of the workspace graph
and keeps its own independent lockfile and toolchain. Install and build it
separately from the root:

```sh
npm run insight:install
npm run insight:build
```

### Docker test workflows

`./ci.sh` builds and runs the local Docker Compose test stack (application
images plus the per-chain services tests need — MongoDB, Bitcoin, Geth, etc.).
Run `./ci.sh --help` for usage, or see [`ci.sh`](ci.sh) directly.

## Versioning

This repo follows the even-odd versioning convention. Major versions that are even (e.g. v8.x.x) are `stable` releases, odd are `beta` releases (e.g. v9.x.x). Beta versions may contain breaking changes or major feature additions that are still in testing.

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/CONTRIBUTING.md) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2025 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.

[^1]: The Bitcore P2P Doge library is no longer maintained as all the core functionality is contained in Bitcore P2P
