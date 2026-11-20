# Development setup

The packages directly under `packages/` (everything except
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

For Insight installation and build commands, see the
[Insight section in the README](README.md#insight).

## Installation and compilation

Use the Node version recorded in [`.nvmrc`](.nvmrc) and
[`.node-version`](.node-version), and the npm version declared by
`packageManager` in the root [`package.json`](package.json). Its `devEngines`
requirements are checked by npm before `install`, `ci`, and `run` commands.

With [nvm](https://github.com/nvm-sh/nvm#nvmrc) installed and configured,
clone the repository, then install from its root:

```sh
git clone https://github.com/bitpay/bitcore.git
cd bitcore
nvm install
npm install --global "$(node -p "require('./package.json').packageManager")"
npm ci
```

`nvm install` reads `.nvmrc`, installs the selected Node version if needed,
and activates it. In later shell sessions, run `nvm use` from the repository
to activate that version again. Node's bundled npm may differ from the
required version, so the command above installs npm using `packageManager`
from `package.json`.

If you use another configured Node version manager, replace `nvm install`
with one of these commands, then run the same npm commands:

- [fnm](https://github.com/Schniz/fnm): `fnm use --install-if-missing` reads
  `.node-version` or `.nvmrc` and installs the selected version if needed.
- [n](https://github.com/tj/n#specifying-nodejs-versions): `n auto` reads
  `.node-version` to install and activate the selected version.

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

## Running and testing

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

## Docker test workflows

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

## Editing a workspace's dependencies

Add or update a package's own dependency with `--workspace`, from the root:

```sh
npm install <dependency> --workspace=@bitpay-labs/<package-directory-name>
```

Internal cross-package dependencies (e.g. `bitcore-node` depending on
`@bitpay-labs/crypto-wallet-core`) are declared as ordinary semver ranges in
each package's `package.json`, the same as any published dependency — not
`workspace:*` or `file:` references — and are linked locally by npm because
the range matches the local version.

## Dependency install scripts

Root `package.json` uses npm's `allowScripts` policy to deny the notice-only
install scripts in `es5-ext`, `highlight.js`, `protobufjs`, and `sinon`. These
scripts print messages; they do not build package output. Other dependency
install scripts still run under the npm version pinned in root
`package.json`, which warns about unreviewed scripts. Review the pending
list from the root with:

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

## Lockfile maintenance

Keep optional dependencies enabled in CI and Docker builds with
`npm ci --include=optional`. Packages such as SWC, esbuild, and cbor-extract
use optional dependencies for their platform-specific native binaries.
The root lockfile must retain their entries for every supported platform,
including Linux x64 and ARM64; `npm ci` does not repair missing lock entries.
When repairing the lockfile, use the pinned Node/npm versions in a clean
checkout without root or workspace `node_modules`, and review the diff for
unintended dependency upgrades. Validate the result inside the target Linux
image, since a successful macOS install does not verify Linux binaries.
