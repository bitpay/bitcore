'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { evaluateEngineEntry, collectInstalledEngineDeclarations, run } = require('../../scripts/workspaces/lib/engines.cjs');
const { makeTempDir, writeJson } = require('./helpers.cjs');

test('evaluateEngineEntry accepts a range Node 24 satisfies', () => {
  const result = evaluateEngineEntry('some-pkg', '1.0.0', '>=10');
  assert.equal(result.status, 'ok');
});

test('evaluateEngineEntry reports unspecified when no range is declared', () => {
  const result = evaluateEngineEntry('some-pkg', '1.0.0', undefined);
  assert.equal(result.status, 'unspecified');
});

test('evaluateEngineEntry allows exactly the documented socks5-client exception', () => {
  const result = evaluateEngineEntry('socks5-client', '0.3.6', '0.x');
  assert.equal(result.status, 'exception');
});

test('evaluateEngineEntry rejects the same range/version on a different package name', () => {
  const result = evaluateEngineEntry('some-other-pkg', '0.3.6', '0.x');
  assert.equal(result.status, 'incompatible');
});

test('evaluateEngineEntry rejects socks5-client at a different version', () => {
  const result = evaluateEngineEntry('socks5-client', '0.4.0', '0.x');
  assert.equal(result.status, 'incompatible');
});

test('evaluateEngineEntry rejects an unparseable range diagnostically', () => {
  const result = evaluateEngineEntry('some-pkg', '1.0.0', 'not-a-range');
  assert.equal(result.status, 'unparseable');
});

test('collectInstalledEngineDeclarations skips excluded trees but resolves workspace link entries', () => {
  const rootDir = makeTempDir('engines-collect');
  writeJson(path.join(rootDir, 'node_modules/real-dep/package.json'), { name: 'real-dep', version: '2.0.0', engines: { node: '>=10' } });
  writeJson(path.join(rootDir, 'packages/a/package.json'), { name: '@x/a', version: '1.0.0', engines: { node: '>=10' } });
  writeJson(path.join(rootDir, 'packages/insight/node_modules/insight-dep/package.json'), {
    name: 'insight-dep',
    version: '1.0.0',
    engines: { node: '0.x' },
  });
  const lock = {
    packages: {
      '': {},
      'packages/a': { name: '@x/a', version: '1.0.0' },
      'node_modules/@x/a': { resolved: 'packages/a', link: true },
      'node_modules/real-dep': { name: 'real-dep', version: '2.0.0', engines: { node: '>=10' } },
      'packages/insight/node_modules/insight-dep': { name: 'insight-dep', version: '1.0.0', engines: { node: '0.x' } },
    },
  };
  const { declarations, installFailures } = collectInstalledEngineDeclarations(rootDir, lock);
  const names = declarations.map((d) => d.name);
  assert.ok(names.includes('real-dep'));
  assert.ok(!names.includes('insight-dep'));
  // The workspace link is resolved to its real package, not skipped.
  assert.ok(names.includes('@x/a'));
  assert.deepEqual(installFailures, []);
});

test('collectInstalledEngineDeclarations skips an optional dependency not installed for this platform', () => {
  const rootDir = makeTempDir('engines-optional');
  const lock = {
    packages: {
      '': {},
      'node_modules/optional-native': { name: 'optional-native', version: '1.0.0', optional: true, engines: { node: '0.x' } },
    },
  };
  const { declarations, installFailures } = collectInstalledEngineDeclarations(rootDir, lock);
  assert.deepEqual(declarations, []);
  assert.deepEqual(installFailures, []);
});

test('collectInstalledEngineDeclarations reports a required (non-optional) dependency missing from disk', () => {
  const rootDir = makeTempDir('engines-missing-required');
  const lock = {
    packages: {
      '': {},
      'node_modules/required-dep': { name: 'required-dep', version: '3.0.0', engines: { node: '>=10' } },
    },
  };
  const { declarations, installFailures } = collectInstalledEngineDeclarations(rootDir, lock);
  assert.deepEqual(declarations, []);
  assert.equal(installFailures.length, 1);
  assert.equal(installFailures[0].name, 'required-dep');
  assert.equal(installFailures[0].reason, 'not installed');
});

test('collectInstalledEngineDeclarations reports an installed directory with no readable package.json as an installation failure, not a pass', () => {
  const rootDir = makeTempDir('engines-broken-install');
  // The directory exists (so a naive existsSync check would call it
  // "installed") but nothing was actually placed inside it.
  fs.mkdirSync(path.join(rootDir, 'node_modules/broken-dep'), { recursive: true });
  const lock = {
    packages: {
      '': {},
      'node_modules/broken-dep': { name: 'broken-dep', version: '1.0.0', engines: { node: '>=10' } },
    },
  };
  const { declarations, installFailures } = collectInstalledEngineDeclarations(rootDir, lock);
  assert.deepEqual(declarations, []);
  assert.equal(installFailures.length, 1);
  assert.equal(installFailures[0].reason, 'installed directory has no readable package.json');
});

test('collectInstalledEngineDeclarations reads the engine range from the actual installed manifest, not the lock', () => {
  const rootDir = makeTempDir('engines-real-manifest');
  writeJson(path.join(rootDir, 'node_modules/real-dep/package.json'), {
    name: 'real-dep',
    version: '2.0.0',
    engines: { node: '0.x' },
  });
  const lock = {
    packages: {
      '': {},
      // Lock metadata is stale: it still claims a wide-open range even
      // though the package actually installed on disk now requires 0.x.
      'node_modules/real-dep': { name: 'real-dep', version: '2.0.0', engines: { node: '>=10' } },
    },
  };
  const { declarations } = collectInstalledEngineDeclarations(rootDir, lock);
  assert.equal(declarations.length, 1);
  assert.equal(declarations[0].range, '0.x');
});

test('collectInstalledEngineDeclarations resolves a workspace link to its real package and evaluates its own engines.node', () => {
  const rootDir = makeTempDir('engines-workspace-link');
  writeJson(path.join(rootDir, 'packages/bitcore-lib/package.json'), {
    name: '@bitpay-labs/bitcore-lib',
    version: '1.0.0',
    engines: { node: '<20' },
  });
  const lock = {
    packages: {
      '': {},
      'packages/bitcore-lib': { name: '@bitpay-labs/bitcore-lib', version: '1.0.0', engines: { node: '<20' } },
      'node_modules/@bitpay-labs/bitcore-lib': { resolved: 'packages/bitcore-lib', link: true },
    },
  };
  const { declarations } = collectInstalledEngineDeclarations(rootDir, lock);
  assert.equal(declarations.length, 1);
  assert.equal(declarations[0].name, '@bitpay-labs/bitcore-lib');
  assert.equal(declarations[0].range, '<20');
});

test('run() fails on an unexpected engine mismatch reachable from the root lock', () => {
  const rootDir = makeTempDir('engines-run-fail');
  writeJson(path.join(rootDir, 'node_modules/legacy-dep/package.json'), { name: 'legacy-dep', version: '1.0.0', engines: { node: '0.x' } });
  writeJson(path.join(rootDir, 'package-lock.json'), {
    lockfileVersion: 3,
    packages: {
      '': {},
      'node_modules/legacy-dep': { name: 'legacy-dep', version: '1.0.0', engines: { node: '0.x' } },
    },
  });
  const result = run({ rootDir });
  assert.equal(result.ok, false);
  assert.match(result.failures[0], /incompatible with Node/);
});

test('run() fails when a required dependency recorded in the lock is not installed on disk', () => {
  const rootDir = makeTempDir('engines-run-missing');
  writeJson(path.join(rootDir, 'package-lock.json'), {
    lockfileVersion: 3,
    packages: {
      '': {},
      'node_modules/absent-dep': { name: 'absent-dep', version: '1.0.0', engines: { node: '>=10' } },
    },
  });
  const result = run({ rootDir });
  assert.equal(result.ok, false);
  assert.match(result.failures[0], /installation is incomplete: not installed/);
});

test('run() fails when a required dependency directory exists but has no readable package.json', () => {
  const rootDir = makeTempDir('engines-run-broken-install');
  fs.mkdirSync(path.join(rootDir, 'node_modules/broken-dep'), { recursive: true });
  writeJson(path.join(rootDir, 'package-lock.json'), {
    lockfileVersion: 3,
    packages: {
      '': {},
      'node_modules/broken-dep': { name: 'broken-dep', version: '1.0.0', engines: { node: '>=10' } },
    },
  });
  const result = run({ rootDir });
  assert.equal(result.ok, false);
  assert.match(result.failures[0], /installation is incomplete: installed directory has no readable package\.json/);
});

test('run() evaluates the installed manifest engine range, not a stale lock-cached one', () => {
  const rootDir = makeTempDir('engines-run-real-manifest');
  writeJson(path.join(rootDir, 'node_modules/real-dep/package.json'), {
    name: 'real-dep',
    version: '2.0.0',
    engines: { node: '0.x' },
  });
  writeJson(path.join(rootDir, 'package-lock.json'), {
    lockfileVersion: 3,
    packages: {
      '': {},
      // Stale lock metadata claims a wide-open range; the real installed
      // package.json is what should actually be evaluated and fail.
      'node_modules/real-dep': { name: 'real-dep', version: '2.0.0', engines: { node: '>=10' } },
    },
  });
  const result = run({ rootDir });
  assert.equal(result.ok, false);
  assert.match(result.failures[0], /incompatible with Node/);
});

test('run() fails when a workspace declares an engines.node range incompatible with the supported Node version', () => {
  const rootDir = makeTempDir('engines-run-workspace-incompatible');
  writeJson(path.join(rootDir, 'packages/bitcore-lib/package.json'), {
    name: '@bitpay-labs/bitcore-lib',
    version: '1.0.0',
    engines: { node: '<20' },
  });
  writeJson(path.join(rootDir, 'package-lock.json'), {
    lockfileVersion: 3,
    packages: {
      '': {},
      'packages/bitcore-lib': { name: '@bitpay-labs/bitcore-lib', version: '1.0.0', engines: { node: '<20' } },
      'node_modules/@bitpay-labs/bitcore-lib': { resolved: 'packages/bitcore-lib', link: true },
    },
  });
  const result = run({ rootDir });
  assert.equal(result.ok, false);
  assert.match(result.failures[0], /incompatible with Node/);
});

test('run() passes and records the documented socks5-client exception', () => {
  const rootDir = makeTempDir('engines-run-exception');
  writeJson(path.join(rootDir, 'node_modules/socks5-client/package.json'), {
    name: 'socks5-client',
    version: '0.3.6',
    engines: { node: '0.x' },
  });
  writeJson(path.join(rootDir, 'package-lock.json'), {
    lockfileVersion: 3,
    packages: {
      '': {},
      'node_modules/socks5-client': { name: 'socks5-client', version: '0.3.6', engines: { node: '0.x' } },
    },
  });
  const result = run({ rootDir });
  assert.equal(result.ok, true);
  assert.equal(result.exceptions.length, 1);
});
