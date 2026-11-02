'use strict';

const fs = require('fs');
const path = require('path');
const {
  EXPECTED_WORKSPACES,
  EXPECTED_ROOT_IDENTITY,
  EXPECTED_ROOT_SCRIPTS,
  COMPILE_ORDER,
  FORBIDDEN_LOCAL_PROTOCOLS,
  scopedName,
} = require('./constants.cjs');
const { readJson, loadWorkspaceManifests, internalDependencyEdges, formatFailure } = require('./util.cjs');

function checkWorkspaceMembership(root) {
  const failures = [];
  const declared = Array.isArray(root.workspaces) ? root.workspaces : null;
  if (!declared) {
    failures.push(
      formatFailure({
        mode: 'manifests',
        detail: 'Root package.json declares no `workspaces` array.',
        expected: EXPECTED_WORKSPACES,
        observed: root.workspaces,
      })
    );
    return failures;
  }
  const sameLength = declared.length === EXPECTED_WORKSPACES.length;
  const sameOrder = sameLength && declared.every((w, i) => w === EXPECTED_WORKSPACES[i]);
  if (!sameOrder) {
    failures.push(
      formatFailure({
        mode: 'manifests',
        detail: 'Root `workspaces` membership/order does not match the target contract.',
        expected: EXPECTED_WORKSPACES,
        observed: declared,
      })
    );
  }
  return failures;
}

function checkRootIdentity(root) {
  const failures = [];
  if (root.name !== EXPECTED_ROOT_IDENTITY.name) {
    failures.push(
      formatFailure({
        mode: 'manifests',
        detail: 'Root package name mismatch.',
        expected: EXPECTED_ROOT_IDENTITY.name,
        observed: root.name,
      })
    );
  }
  if (root.private !== EXPECTED_ROOT_IDENTITY.private) {
    failures.push(
      formatFailure({
        mode: 'manifests',
        detail: 'Root package.json must be private.',
        expected: EXPECTED_ROOT_IDENTITY.private,
        observed: root.private,
      })
    );
  }
  const observedNodeEngine = root.engines && root.engines.node;
  if (observedNodeEngine !== EXPECTED_ROOT_IDENTITY.engines.node) {
    failures.push(
      formatFailure({
        mode: 'manifests',
        detail: 'Root engines.node policy mismatch.',
        expected: EXPECTED_ROOT_IDENTITY.engines.node,
        observed: observedNodeEngine,
      })
    );
  }
  if (root.packageManager !== EXPECTED_ROOT_IDENTITY.packageManager) {
    failures.push(
      formatFailure({
        mode: 'manifests',
        detail: 'Root packageManager mismatch.',
        expected: EXPECTED_ROOT_IDENTITY.packageManager,
        observed: root.packageManager,
      })
    );
  }
  return failures;
}

function checkRootScripts(root) {
  const failures = [];
  const scripts = root.scripts || {};
  for (const [key, expected] of Object.entries(EXPECTED_ROOT_SCRIPTS)) {
    const observed = scripts[key];
    if (observed !== expected) {
      failures.push(
        formatFailure({
          mode: 'manifests',
          detail: `Root script "${key}" does not match the target contract.`,
          expected,
          observed,
        })
      );
    }
  }
  return failures;
}

// Verifies that exactly the packages the plan designates as compile-bearing
// declare a `compile` script, and no other backend workspace has silently
// grown or lost one. COMPILE_ORDER is authoritative; discovery must reject a
// new compile-bearing workspace until that order is updated deliberately.
function checkCompileMembership(workspaceManifests) {
  const failures = [];
  const expected = new Set(COMPILE_ORDER);
  const observed = new Set();
  for (const { manifest, workspacePath } of workspaceManifests.values()) {
    if (manifest.scripts && typeof manifest.scripts.compile === 'string') {
      observed.add(manifest.name);
      if (!expected.has(manifest.name)) {
        failures.push(
          formatFailure({
            mode: 'manifests',
            detail: 'Workspace declares a `compile` script but is not part of the configured compile order.',
            workspace: workspacePath,
            expected: [...expected],
            observed: manifest.name,
          })
        );
      }
    }
  }
  for (const name of expected) {
    if (!observed.has(name)) {
      failures.push(
        formatFailure({
          mode: 'manifests',
          detail: 'A required compile-bearing workspace no longer declares a `compile` script.',
          workspace: name,
          expected: 'compile script present',
          observed: 'missing',
        })
      );
    }
  }
  return failures;
}

// Confirms every workspace path the root declares actually has a manifest on
// disk, reporting each absence as a failure instead of quietly excluding it
// from every later check -- a missing manifest is a broken workspace, not an
// empty one.
function checkWorkspaceManifestsPresent(rootDir, workspaces) {
  const failures = [];
  const present = [];
  for (const workspacePath of workspaces) {
    const manifestPath = path.join(rootDir, workspacePath, 'package.json');
    if (!fs.existsSync(manifestPath)) {
      failures.push(
        formatFailure({
          mode: 'manifests',
          detail: 'Expected workspace has no package.json on disk.',
          workspace: workspacePath,
          expected: manifestPath,
          observed: 'missing',
        })
      );
      continue;
    }
    present.push(workspacePath);
  }
  return { failures, present };
}

// Confirms each present manifest actually declares the package identity its
// directory implies (the `@bitpay-labs/<directory>` convention every real
// backend package follows), so a manifest that exists but was renamed,
// corrupted, or copy-pasted from another package is caught here rather than
// passing every later check under a name nothing else expects.
function checkWorkspaceIdentities(workspaceManifests) {
  const failures = [];
  for (const { manifest, workspacePath } of workspaceManifests.values()) {
    const expectedName = scopedName(path.basename(workspacePath));
    if (manifest.name !== expectedName) {
      failures.push(
        formatFailure({
          mode: 'manifests',
          detail: 'Workspace manifest name does not match the package identity its directory implies.',
          workspace: workspacePath,
          expected: expectedName,
          observed: manifest.name,
        })
      );
    }
  }
  return failures;
}

function checkForbiddenProtocols(workspaceManifests) {
  const failures = [];
  for (const { manifest, workspacePath } of workspaceManifests.values()) {
    for (const edge of internalDependencyEdges(manifest)) {
      if (FORBIDDEN_LOCAL_PROTOCOLS.some((pattern) => pattern.test(edge.range))) {
        failures.push(
          formatFailure({
            mode: 'manifests',
            detail: `Internal dependency "${edge.name}" (${edge.field}) uses a forbidden local specifier protocol.`,
            workspace: workspacePath,
            expected: 'an ordinary semver range',
            observed: edge.range,
          })
        );
      }
    }
  }
  return failures;
}

// Requires `semver` to be resolvable, so this only runs in full (non
// --structure-only) mode. `semver` must be declared as a direct dependency.
function checkInternalRanges(workspaceManifests) {
  const semver = require('semver');
  const failures = [];
  const versionByName = new Map();
  for (const { manifest } of workspaceManifests.values()) {
    versionByName.set(manifest.name, manifest.version);
  }
  for (const { manifest, workspacePath } of workspaceManifests.values()) {
    for (const edge of internalDependencyEdges(manifest)) {
      const targetVersion = versionByName.get(edge.name);
      if (!targetVersion) {
        // Dependency on an internal-looking package outside the managed
        // workspace set (e.g. a future addition) -- not this check's concern.
        continue;
      }
      if (!semver.satisfies(targetVersion, edge.range)) {
        failures.push(
          formatFailure({
            mode: 'manifests',
            detail: `Internal dependency "${edge.name}" (${edge.field}) range is incompatible with the local workspace version.`,
            workspace: workspacePath,
            expected: `range satisfied by ${targetVersion}`,
            observed: edge.range,
          })
        );
      }
    }
  }
  return failures;
}

function run({ rootDir, structureOnly }) {
  const root = readJson(path.join(rootDir, 'package.json'));
  let failures = [
    ...checkWorkspaceMembership(root),
    ...checkRootIdentity(root),
    ...checkRootScripts(root),
  ];

  // Membership must be correct before scanning per-workspace manifests --
  // otherwise a missing/garbled `workspaces` array would report confusing
  // secondary failures for packages that were never the actual problem.
  const declaredWorkspaces = Array.isArray(root.workspaces) ? root.workspaces : EXPECTED_WORKSPACES;
  const { failures: presenceFailures, present } = checkWorkspaceManifestsPresent(rootDir, declaredWorkspaces);
  const workspaceManifests = loadWorkspaceManifests(rootDir, present);

  failures = [
    ...failures,
    ...presenceFailures,
    ...checkWorkspaceIdentities(workspaceManifests),
    ...checkCompileMembership(workspaceManifests),
    ...checkForbiddenProtocols(workspaceManifests),
  ];

  if (!structureOnly) {
    failures = [...failures, ...checkInternalRanges(workspaceManifests)];
  }

  return { ok: failures.length === 0, failures };
}

module.exports = {
  checkWorkspaceMembership,
  checkRootIdentity,
  checkRootScripts,
  checkWorkspaceManifestsPresent,
  checkWorkspaceIdentities,
  checkCompileMembership,
  checkForbiddenProtocols,
  checkInternalRanges,
  run,
};
