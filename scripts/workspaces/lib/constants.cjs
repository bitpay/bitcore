'use strict';

// Single source of truth for the target npm-workspaces contract described in
// docs/workspaces/acceptance-spec.md. Every verifier mode reads
// membership/version/script expectations from here instead of re-deriving
// them, so the contract's target values only need to change in one place.

// Stable discovery order from acceptance-spec §1. The compile runner owns its
// own build order independently (see COMPILE_ORDER below).
const EXPECTED_WORKSPACES = [
  'packages/bitcore-build',
  'packages/bitcore-cli',
  'packages/bitcore-client',
  'packages/bitcore-lib',
  'packages/bitcore-lib-cash',
  'packages/bitcore-lib-doge',
  'packages/bitcore-lib-ltc',
  'packages/bitcore-logging',
  'packages/bitcore-mnemonic',
  'packages/bitcore-node',
  'packages/bitcore-p2p',
  'packages/bitcore-p2p-cash',
  'packages/bitcore-p2p-doge',
  'packages/bitcore-tss',
  'packages/bitcore-wallet-client',
  'packages/bitcore-wallet-service',
  'packages/crypto-rpc',
  'packages/crypto-wallet-core',
];

// Paths that must keep their own independent lockfile and must never be
// pulled into the root workspace graph.
const EXCLUDED_PROJECT_LOCKS = [
  'packages/insight/package-lock.json',
  'packages/bitcore-lib/benchmark/package-lock.json',
];

const EXCLUDED_WORKSPACE_PATHS = ['packages/insight'];

// Sequential compile order from acceptance-spec §2. Scoped package names, not
// directory names, because the compile runner invokes
// `npm run compile --workspace=<name>`.
const COMPILE_ORDER = [
  '@bitpay-labs/bitcore-logging',
  '@bitpay-labs/crypto-wallet-core',
  '@bitpay-labs/bitcore-wallet-service',
  '@bitpay-labs/bitcore-wallet-client',
  '@bitpay-labs/bitcore-client',
  '@bitpay-labs/bitcore-cli',
  '@bitpay-labs/bitcore-node',
];

const EXPECTED_ROOT_IDENTITY = {
  name: 'bitcore-monorepo',
  private: true,
  engines: { node: '>=24.22.1 <25' },
  packageManager: 'npm@11.19.1',
};

// Directory names (relative to packages/) whose root `test:<dir>` alias
// follows the generic scoped-workspace pattern. bitcore-client is handled
// separately because it also runs the root compile first.
const GENERIC_TEST_ALIAS_DIRS = [
  'bitcore-cli',
  'bitcore-lib',
  'bitcore-lib-cash',
  'bitcore-lib-doge',
  'bitcore-lib-ltc',
  'bitcore-logging',
  'bitcore-mnemonic',
  'bitcore-node',
  'bitcore-p2p',
  'bitcore-p2p-cash',
  'bitcore-p2p-doge',
  'bitcore-tss',
  'bitcore-wallet-service',
  'bitcore-wallet-client',
  'crypto-rpc',
  'crypto-wallet-core',
];

function scopedName(dir) {
  return `@bitpay-labs/${dir}`;
}

function genericTestAliasScript(dir) {
  return `npm run test --workspace=${scopedName(dir)} --`;
}

// Required root script values from acceptance-spec §1. `build` is preserved
// verbatim from the pre-migration root manifest -- it builds the root
// Dockerfile and must keep that distinct meaning from `build:docker`.
const EXPECTED_ROOT_SCRIPTS = {
  preinstall: 'node scripts/workspaces/check-runtime.cjs',
  postinstall: 'node scripts/workspaces/verify.cjs engines && npm run compile',
  compile: 'node scripts/workspaces/compile.cjs',
  node: 'npm start --workspace=@bitpay-labs/bitcore-node --',
  bws: 'npm start --workspace=@bitpay-labs/bitcore-wallet-service --',
  watch: 'npm run watch --workspace=@bitpay-labs/bitcore-client --',
  build: 'docker build -t bitcore-node . ',
  'build:docker':
    'npm run build:docker --workspace=@bitpay-labs/bitcore-node && npm run build:docker --workspace=@bitpay-labs/bitcore-wallet-service',
  'insight:install': 'npm --prefix packages/insight ci --workspaces=false',
  'insight:build':
    'npm run insight:install && npm --prefix packages/insight run build --workspaces=false',
  // Unlike the generic aliases below, client's tests import bitcore-node's
  // build output directly (see Task 1.3), and client's own `compile` no
  // longer builds node (it only builds client). A root compile first is
  // what actually prepares that node output; running client's test script
  // on its own would silently use whatever node build happens to already
  // be on disk, stale or absent.
  'test:bitcore-client':
    'npm run compile && npm run test --workspace=@bitpay-labs/bitcore-client --',
  ...Object.fromEntries(
    GENERIC_TEST_ALIAS_DIRS.map((dir) => [`test:${dir}`, genericTestAliasScript(dir)])
  ),
};

// Forbidden dependency specifier protocols for internal (@bitpay-labs/*)
// dependency ranges in published manifests. Ordinary semver ranges are the
// only supported form; see acceptance-spec §1 and the workspace development guide.
const FORBIDDEN_LOCAL_PROTOCOLS = [/^workspace:/, /^file:/, /^\*$/];

// The single permitted Node-engine exception (acceptance-spec §3). Any other
// mismatch between an installed dependency's declared `engines.node` and the
// supported Node 24 runtime is a failure.
const ENGINE_EXCEPTION = {
  name: 'socks5-client',
  version: '0.3.6',
  range: '0.x',
};

const SUPPORTED_NODE_VERSION = '24.22.1';

module.exports = {
  EXPECTED_WORKSPACES,
  EXCLUDED_PROJECT_LOCKS,
  EXCLUDED_WORKSPACE_PATHS,
  COMPILE_ORDER,
  EXPECTED_ROOT_IDENTITY,
  EXPECTED_ROOT_SCRIPTS,
  FORBIDDEN_LOCAL_PROTOCOLS,
  ENGINE_EXCEPTION,
  SUPPORTED_NODE_VERSION,
  scopedName,
};
