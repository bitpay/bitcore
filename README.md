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

The 18 backend packages directly under `packages/` (everything except
`insight`) are npm workspaces of this root, installed and linked from one root
install and one root lockfile. The three nested `benchmark/` fixtures and
`packages/crypto-rpc/blockchain/EVM/package.json` are also outside the workspace
graph; the latter defines a Node package boundary for Hardhat. Run installs
from the root and use `--workspace` to edit a package's dependencies. npm may place
conflicting dependency versions in nested `node_modules` directories; these
are still managed by the root lockfile.
Workspaces govern development inside this checkout. Published packages
remain independently installable with `npm install @bitpay-labs/bitcore-node`
(or any other published package); release commands still build and package
each module's distributable files.

### Setup

Use Node `24.22.1` and npm exactly `11.19.1`. Root `package.json` declares
`devEngines`, which npm checks before `install`, `ci`, and `run` commands.
Clone the repository, then install from its root:

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

Keep optional dependencies enabled in CI and Docker builds with
`npm ci --include=optional`. Packages such as SWC, esbuild, and cbor-extract
use optional dependencies for their platform-specific native binaries.
The root lockfile must retain their entries for every supported platform,
including Linux x64 and ARM64; `npm ci` does not repair missing lock entries.
When repairing the lockfile, use the pinned Node/npm versions in a clean
checkout without root or workspace `node_modules`, and review the diff for
unintended dependency upgrades. Validate the result inside the target Linux
image, since a successful macOS install does not verify Linux binaries.

To recompile later without reinstalling — after pulling changes or editing a
package directly — run:

```sh
npm run compile
```

### Dependency install scripts

Root `package.json` uses npm's `allowScripts` policy to deny the notice-only
install scripts in `es5-ext`, `highlight.js`, `protobufjs`, and `sinon`. These
scripts print messages; they do not build package output. Other dependency
install scripts still run under pinned npm `11.19.1`, which warns about
unreviewed scripts. Review the pending list from the root with:

```sh
npm approve-scripts --allow-scripts-pending
```

Before adding approvals for script lockdown, restore registry `resolved`
URLs in the lockfile: the current lockfile omits them, so npm cannot validate
version-pinned approvals and `npm approve-scripts <package>` falls back to
allowing every version of that package. Review each script and pin approvals
once that metadata is available. Strict enforcement (`strict-allow-scripts`)
is not enabled yet; validate the policy on supported development and CI
platforms before enabling it. This policy controls dependency install scripts;
it does not restrict the root compile hook or application runtime access.

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
  changed. See [Docker test workflows](#docker-test-workflows) for suites that
  need chain services and [the CircleCI configuration](.circleci/config.yml)
  for the CI matrix.
- `npm run watch` runs bitcore-client's TypeScript watcher.
- `npm run node` / `npm run bws` start bitcore-node / bitcore-wallet-service
  directly from source.
- `npm run build` builds the root Docker image; `npm run build:docker` builds
  the bitcore-node and bitcore-wallet-service images.

Run test suites sequentially in a single checkout. Several TypeScript suites
clean and rebuild their package's `build` or `ts_build` directory, and root
`test:bitcore-client` first runs the entire root compile. Concurrent test or
compile commands can delete output another suite is using and cause misleading
`MODULE_NOT_FOUND` errors.

Some suites need services or browser support beyond `npm ci`:

- `bitcore-client`, `bitcore-cli`, `bitcore-wallet-client`, and
  `bitcore-wallet-service` tests, plus `bitcore-node` integration tests, need
  MongoDB. Tests default to a local instance on port `27017`; set `DB_HOST`
  and `DB_PORT` to use a different host or port.
- For local `bitcore-node` unit tests, run
  `npm run test:unit --workspace=@bitpay-labs/bitcore-node`. Its full suite
  also needs the Docker chain services described below. `crypto-rpc` tests
  use their own Docker Compose stack.
- The `bitcore-lib`, `bitcore-lib-cash`, `bitcore-lib-doge`, `bitcore-lib-ltc`,
  and `bitcore-mnemonic` suites include Chrome browser tests. WebdriverIO can
  use an installed Chrome or download Chrome and its driver; downloads need
  network access, and the browser needs its system dependencies installed.

### Insight

Insight (`packages/insight`) is deliberately kept out of the workspace graph
and keeps its own independent lockfile and toolchain. Install and build it
separately from the root:

```sh
npm run insight:install
npm run insight:build
```

### Docker test workflows

`ci.sh` provides commands to build and run the local Docker Compose test stack
(application images plus MongoDB and chain services). Run a specific suite
with an explicit command, for example:

```sh
./ci.sh build
./ci.sh run 'npm run test:bitcore-node'
```

The script does not run the CI matrix automatically. `npm run test:crypto-rpc`
builds and runs that package's separate Compose stack. Run `./ci.sh --help`
for usage, or see [`ci.sh`](ci.sh) directly.

## Versioning

This repo follows the even-odd versioning convention. Major versions that are even (e.g. v8.x.x) are `stable` releases, odd are `beta` releases (e.g. v9.x.x). Beta versions may contain breaking changes or major feature additions that are still in testing.

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/CONTRIBUTING.md) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2025 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.

[^1]: The Bitcore P2P Doge library is no longer maintained as all the core functionality is contained in Bitcore P2P
