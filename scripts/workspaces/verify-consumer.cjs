#!/usr/bin/env node
'use strict';

// Installs the candidate tarballs produced by pack.cjs into a disposable
// npm project *outside* this monorepo, together, so npm resolves every
// @bitpay-labs/* dependency edge among them from the local tarball and can
// never silently substitute a registry-published version for one of the
// packages under test (docs/workspaces/acceptance-spec.md §7 requires
// installing the complete candidate set together). Never invokes
// pub/publish/version/tag; this only installs already-built tarballs and
// exercises them.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${command} ${args.join(' ')} failed (${result.signal || result.status})`);
    error.exitCode = result.status || 1;
    throw error;
  }
  return result;
}

// A TypeScript consumer, using the repository's own local tsc so this needs
// no network access beyond the tarball installs themselves: type-checks
// against wallet-client's corrected `types` entry (Task 1.4) using its real
// shipped declarations, not the monorepo's source tree.
const WALLET_CLIENT_CHECK_TS = `
import { API, Key } from '@bitpay-labs/bitcore-wallet-client';
const isApiCtor: typeof API = API;
const key = new Key();
if (typeof isApiCtor !== 'function') throw new Error('API is not a constructor');
if (!key.id) throw new Error('Key did not generate an id');
console.log('[verify-consumer] wallet-client types resolve and construct: id=' + key.id);
`;

// Exercises a representative public API (Key: local key/mnemonic generation,
// no network) and an ESM import of crypto-rpc's named export, at runtime,
// on Node 24 -- as opposed to the TypeScript check above, which only proves
// the *types* resolve.
const CHECK_MJS = `
import assert from 'node:assert/strict';
import walletClient from '@bitpay-labs/bitcore-wallet-client';
import { CryptoRpc } from '@bitpay-labs/crypto-rpc';

const { API, Key } = walletClient;
assert.equal(typeof API, 'function');
const key = new Key();
assert.ok(key.id, 'Key did not generate an id');
assert.equal(typeof CryptoRpc, 'function');
console.log('[verify-consumer] representative public API + ESM RPC import OK: key id=' + key.id);
`;

function writeConsumerProject(consumerDir, artifacts) {
  fs.mkdirSync(consumerDir, { recursive: true });
  const dependencies = {};
  for (const artifact of artifacts) dependencies[artifact.name] = `file:${artifact.tarball}`;
  fs.writeFileSync(
    path.join(consumerDir, 'package.json'),
    JSON.stringify({ name: 'bitcore-artifacts-consumer', version: '0.0.0', private: true, dependencies }, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(consumerDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          // ES2022, not an older target: a transitive dependency's own
          // shipped .d.ts (@solana/errors, pulled in by crypto-wallet-core)
          // uses the ES2022-only `ErrorOptions` type, and an artificially
          // older target here would fail on that real third-party
          // declaration rather than on anything one of our own packages
          // did -- Node 24 supports ES2022 natively, matching "a
          // representative external TypeScript consumer on Node 24".
          target: 'ES2022',
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          strict: false,
          skipLibCheck: false,
          noEmit: true,
        },
        files: ['check.ts'],
      },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(path.join(consumerDir, 'check.ts'), WALLET_CLIENT_CHECK_TS);
  fs.writeFileSync(path.join(consumerDir, 'check.mjs'), CHECK_MJS);
}

// Confirms npm actually installed the real candidate tarball for every
// artifact, not a registry-resolved substitute and not a symlink back into
// this checkout -- a consumer containing every tarball together (see file
// header) is what makes this a meaningful check instead of one that could
// pass by accident via a stale hoisted copy.
function verifyInstalledArtifacts(consumerDir, artifacts) {
  const failures = [];
  for (const artifact of artifacts) {
    const installedDir = path.join(consumerDir, 'node_modules', ...artifact.name.split('/'));
    if (fs.lstatSync(installedDir, { throwIfNoEntry: false })?.isSymbolicLink()) {
      failures.push(`${artifact.name}: installed as a symlink, not an extracted tarball`);
      continue;
    }
    const realpath = fs.existsSync(installedDir) ? fs.realpathSync(installedDir) : null;
    if (!realpath) {
      failures.push(`${artifact.name}: not installed at ${installedDir}`);
      continue;
    }
    if (realpath.startsWith(root)) {
      failures.push(`${artifact.name}: resolves back into the monorepo checkout (${realpath})`);
      continue;
    }
    const installedManifest = JSON.parse(fs.readFileSync(path.join(installedDir, 'package.json'), 'utf8'));
    if (installedManifest.version !== artifact.version) {
      failures.push(`${artifact.name}: installed version ${installedManifest.version}, expected candidate ${artifact.version}`);
    }
  }
  return failures;
}

function main() {
  const args = process.argv.slice(2);
  const artifactsArg = args.find((a) => a.startsWith('--artifacts='));
  assert(artifactsArg, 'Usage: node scripts/workspaces/verify-consumer.cjs --artifacts=/absolute/path/artifacts.json [--destination=/absolute/path]');
  const artifactsPath = path.resolve(artifactsArg.slice('--artifacts='.length));
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, 'utf8'));
  assert(Array.isArray(artifacts) && artifacts.length > 0, `${artifactsPath} contains no artifacts`);

  const destinationArg = args.find((a) => a.startsWith('--destination='));
  const destination = destinationArg
    ? path.resolve(destinationArg.slice('--destination='.length))
    : fs.mkdtempSync(path.join(os.tmpdir(), 'bitcore-consumer-'));
  const consumerDir = path.join(destination, 'consumer');
  writeConsumerProject(consumerDir, artifacts);

  console.log(`[verify-consumer] installing ${artifacts.length} candidate tarballs into ${consumerDir}`);
  run('npm', ['install', '--no-audit', '--no-fund'], { cwd: consumerDir });

  const installFailures = verifyInstalledArtifacts(consumerDir, artifacts);
  assert(installFailures.length === 0, installFailures.join('\n'));
  console.log('[verify-consumer] every candidate tarball installed at its real, non-substituted version');

  run(path.join(root, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], { cwd: consumerDir });
  run(process.execPath, ['check.mjs'], { cwd: consumerDir });

  console.log(`[verify-consumer] PASS: ${artifacts.length} tarballs installed and exercised in ${consumerDir}`);
}

module.exports = { writeConsumerProject, verifyInstalledArtifacts };
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.exitCode || 1;
  }
}
