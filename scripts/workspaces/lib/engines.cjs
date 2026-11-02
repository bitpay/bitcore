'use strict';

const fs = require('fs');
const path = require('path');
const { ENGINE_EXCEPTION, SUPPORTED_NODE_VERSION } = require('./constants.cjs');
const { readJsonIfExists, formatFailure } = require('./util.cjs');

const EXCLUDED_PATH_SEGMENTS = ['packages/insight', 'packages/bitcore-lib/benchmark'];

function isExcludedKey(key) {
  return EXCLUDED_PATH_SEGMENTS.some((segment) => key.includes(segment));
}

function deriveNameFromKey(key) {
  const segments = key.split('node_modules/');
  return segments[segments.length - 1];
}

// Pure evaluation of one declared engines.node range against the supported
// Node runtime, requiring `semver` (declared as a direct dependency).
// Returns a status rather than throwing so callers can
// aggregate many results before deciding overall pass/fail.
function evaluateEngineEntry(name, version, range) {
  if (range === undefined || range === null) {
    return { status: 'unspecified', name, version };
  }
  const semver = require('semver');
  if (semver.validRange(range) === null) {
    return { status: 'unparseable', name, version, range };
  }
  const isDocumentedException =
    name === ENGINE_EXCEPTION.name && version === ENGINE_EXCEPTION.version && range === ENGINE_EXCEPTION.range;
  if (isDocumentedException) {
    return { status: 'exception', name, version, range };
  }
  const compatible = semver.satisfies(SUPPORTED_NODE_VERSION, range, { includePrerelease: true });
  return { status: compatible ? 'ok' : 'incompatible', name, version, range };
}

// Uses the root lock purely as the installation *inventory* (which packages
// are supposed to be installed and where), but reads each package's engine
// declaration from its actual installed manifest on disk. A lock's mirrored
// `engines` field is a snapshot from whenever the lock was last regenerated;
// it can go stale relative to what is really sitting in node_modules (a
// manually patched dependency, a partially-applied override, a corrupted
// install), so trusting it as the declaration of record would let exactly
// that drift pass silently. Deduplicates by real path so the same physical
// install is not evaluated twice. A required (non-optional) package absent
// from disk, or whose installed directory exists but has no readable
// package.json (a broken/incomplete install), is reported as an installation
// failure rather than silently evaluated against stale lock metadata.
//
// Workspace link entries are resolved to the real workspace package they
// point at, and that package's own installed manifest is evaluated the same
// as any other dependency -- a workspace's own `engines.node` is not otherwise
// checked anywhere else, so skipping links here would let every backend
// workspace declare an arbitrary, unenforced engine range.
function pushDeclarationFor(rootDir, key, record, realPath, seenRealPaths, declarations, installFailures) {
  if (seenRealPaths.has(realPath)) return;
  seenRealPaths.add(realPath);

  const installedManifest = readJsonIfExists(path.join(realPath, 'package.json'));
  if (!installedManifest) {
    installFailures.push({
      key,
      name: record.name || deriveNameFromKey(key),
      version: record.version,
      reason: 'installed directory has no readable package.json',
    });
    return;
  }
  const name = installedManifest.name || record.name || deriveNameFromKey(key);
  const version = installedManifest.version || record.version;
  const range = installedManifest.engines && installedManifest.engines.node;
  declarations.push({ key, realPath, name, version, range });
}

function collectInstalledEngineDeclarations(rootDir, lock) {
  const packages = lock.packages || {};
  const seenRealPaths = new Set();
  const declarations = [];
  const installFailures = [];
  for (const [key, record] of Object.entries(packages)) {
    if (key === '') continue; // the root package's own entry
    if (isExcludedKey(key)) continue;

    if (record.link) {
      // A workspace alias -- resolve it to the real workspace directory
      // (`record.resolved`, a repo-relative path like "packages/bitcore-lib")
      // rather than skipping it outright.
      if (!record.resolved) continue;
      const workspaceDir = path.join(rootDir, record.resolved);
      if (!fs.existsSync(workspaceDir)) continue; // reported by `manifests`/`lock`, not this check
      pushDeclarationFor(rootDir, key, record, fs.realpathSync(workspaceDir), seenRealPaths, declarations, installFailures);
      continue;
    }

    if (!key.includes('node_modules/')) continue; // a workspace's own source record, not an installed dependency

    const absPath = path.join(rootDir, key);
    const installed = fs.existsSync(absPath);
    if (!installed) {
      if (record.optional) continue; // not installed for this platform
      installFailures.push({ key, name: record.name || deriveNameFromKey(key), version: record.version, reason: 'not installed' });
      continue;
    }
    pushDeclarationFor(rootDir, key, record, fs.realpathSync(absPath), seenRealPaths, declarations, installFailures);
  }
  return { declarations, installFailures };
}

function run({ rootDir }) {
  const lockPath = path.join(rootDir, 'package-lock.json');
  const lock = readJsonIfExists(lockPath);
  if (!lock) {
    return {
      ok: false,
      failures: [
        formatFailure({
          mode: 'engines',
          detail: 'Root package-lock.json does not exist; cannot inventory installed dependency engines.',
          expected: lockPath,
          observed: 'missing',
        }),
      ],
    };
  }

  const { declarations, installFailures } = collectInstalledEngineDeclarations(rootDir, lock);
  const failures = [];
  const exceptions = [];
  const unspecified = [];

  for (const f of installFailures) {
    failures.push(
      formatFailure({
        mode: 'engines',
        detail: `Dependency "${f.name}@${f.version}" is recorded in the root lock as required, but its installation is incomplete: ${f.reason}.`,
        workspace: f.key,
        expected: 'an installed package directory with a readable package.json',
        observed: f.reason,
      })
    );
  }

  for (const decl of declarations) {
    const result = evaluateEngineEntry(decl.name, decl.version, decl.range);
    if (result.status === 'ok') continue;
    if (result.status === 'unspecified') {
      unspecified.push(decl);
      continue;
    }
    if (result.status === 'exception') {
      exceptions.push(decl);
      continue;
    }
    if (result.status === 'unparseable') {
      failures.push(
        formatFailure({
          mode: 'engines',
          detail: `Dependency "${decl.name}@${decl.version}" declares an unparseable engines.node range.`,
          workspace: decl.realPath,
          expected: 'a valid semver range',
          observed: decl.range,
        })
      );
      continue;
    }
    // incompatible
    failures.push(
      formatFailure({
        mode: 'engines',
        detail: `Dependency "${decl.name}@${decl.version}" declares an engines.node range incompatible with Node ${SUPPORTED_NODE_VERSION}.`,
        workspace: decl.realPath,
        expected: `a range satisfied by ${SUPPORTED_NODE_VERSION}, or the documented socks5-client exception`,
        observed: decl.range,
      })
    );
  }

  return { ok: failures.length === 0, failures, exceptions, unspecified };
}

module.exports = {
  evaluateEngineEntry,
  collectInstalledEngineDeclarations,
  run,
};
