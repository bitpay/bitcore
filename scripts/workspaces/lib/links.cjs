'use strict';

const fs = require('fs');
const path = require('path');
const { EXPECTED_WORKSPACES } = require('./constants.cjs');
const { loadWorkspaceManifests, internalDependencyEdges, formatFailure } = require('./util.cjs');

// Re-implements Node's own node_modules directory search (without following
// the final symlink) so the *lexical* alias path a consumer's resolution
// would land on is visible separately from where that alias physically
// points. Node's own `require.resolve` canonicalizes symlinks internally by
// default, which would silently collapse exactly the aliasing distinction
// this check exists to catch.
function findLexicalResolution(consumerDir, depName) {
  let dir = consumerDir;
  while (true) {
    const candidate = path.join(dir, 'node_modules', depName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function buildTargetIndex(rootDir, workspaces) {
  const manifests = loadWorkspaceManifests(rootDir, workspaces);
  const byName = new Map();
  for (const { manifest, dir, workspacePath } of manifests.values()) {
    byName.set(manifest.name, {
      workspacePath,
      dir,
      manifest,
      realPath: fs.realpathSync(dir),
    });
  }
  return { manifests, byName };
}

// Supplements the manual lexical/canonical directory check above with actual
// Node module resolution of the target's declared entry point, originating
// from the consumer's own directory (via createRequire or the appropriate ESM mechanism).
// `require.resolve(name, { paths })` performs exactly that
// consumer-relative resolution without importing (and so without executing)
// the target module. This only runs once the directory-level check above has
// already confirmed the dependency resolves to the correct real package, and
// only for targets that actually declare an entry point -- an internal
// package with no `main`/`exports` is checked at the directory level only,
// consistent with how `artifacts` treats plain JavaScript workspaces.
function checkEntryPointResolution(consumerDir, consumerPath, target) {
  const failures = [];
  if (!target.manifest.main && !target.manifest.exports) return failures;

  let resolvedPath;
  try {
    resolvedPath = require.resolve(target.manifest.name, { paths: [consumerDir] });
  } catch (err) {
    failures.push(
      formatFailure({
        mode: 'links',
        detail: `Internal dependency "${target.manifest.name}" declares an entry point that Node cannot resolve from its consumer.`,
        workspace: target.manifest.name,
        consumer: consumerPath,
        expected: 'a resolvable declared entry point (main/exports)',
        observed: err.code || err.message,
      })
    );
    return failures;
  }

  const realResolvedPath = fs.realpathSync(resolvedPath);
  const withinTarget =
    realResolvedPath === target.realPath || realResolvedPath.startsWith(target.realPath + path.sep);
  if (!withinTarget) {
    failures.push(
      formatFailure({
        mode: 'links',
        detail: `Internal dependency "${target.manifest.name}" entry point resolves outside its intended workspace directory.`,
        workspace: target.manifest.name,
        consumer: consumerPath,
        expected: target.realPath,
        observed: realResolvedPath,
      })
    );
  }
  return failures;
}

function run({ rootDir, workspaces = EXPECTED_WORKSPACES }) {
  const { manifests, byName } = buildTargetIndex(rootDir, workspaces);
  const failures = [];
  // Every internal edge examined, pass or fail. Both the lexical resolved
  // path and the canonical real path are recorded for every internal edge, not
  // only failing ones.
  const report = [];
  // name -> lexicalPath -> [{ consumer, realPath }]
  const aliasesByTarget = new Map();

  for (const { manifest, dir, workspacePath: consumerPath } of manifests.values()) {
    for (const edge of internalDependencyEdges(manifest)) {
      const target = byName.get(edge.name);
      if (!target) continue; // dependency outside the managed workspace set

      const lexicalPath = findLexicalResolution(dir, edge.name);
      if (!lexicalPath) {
        report.push({ workspace: edge.name, consumer: consumerPath, lexicalPath: null, realPath: null, ok: false });
        failures.push(
          formatFailure({
            mode: 'links',
            detail: `Internal dependency "${edge.name}" does not resolve from its consumer.`,
            workspace: edge.name,
            consumer: consumerPath,
            expected: target.realPath,
            observed: 'unresolved',
          })
        );
        continue;
      }

      const realPath = fs.realpathSync(lexicalPath);
      if (realPath !== target.realPath) {
        report.push({ workspace: edge.name, consumer: consumerPath, lexicalPath, realPath, ok: false });
        failures.push(
          formatFailure({
            mode: 'links',
            detail: `Internal dependency "${edge.name}" resolves to an unexpected package instance (registry copy or wrong nested version).`,
            workspace: edge.name,
            consumer: consumerPath,
            expected: target.realPath,
            observed: realPath,
          })
        );
        continue;
      }

      report.push({ workspace: edge.name, consumer: consumerPath, lexicalPath, realPath, ok: true });
      failures.push(...checkEntryPointResolution(dir, consumerPath, target));

      if (!aliasesByTarget.has(edge.name)) aliasesByTarget.set(edge.name, new Map());
      const aliasMap = aliasesByTarget.get(edge.name);
      if (!aliasMap.has(lexicalPath)) aliasMap.set(lexicalPath, []);
      aliasMap.get(lexicalPath).push({ consumer: consumerPath, realPath });
    }
  }

  for (const [name, aliasMap] of aliasesByTarget.entries()) {
    if (aliasMap.size <= 1) continue;
    const target = byName.get(name);
    const aliasEntries = [...aliasMap.entries()];
    // Report every alias beyond the first as a conflict against it, so each
    // failure names the two disagreeing consumers plus the shared expected
    // canonical workspace location.
    const [firstAlias, firstConsumers] = aliasEntries[0];
    for (const [otherAlias, otherConsumers] of aliasEntries.slice(1)) {
      failures.push(
        formatFailure({
          mode: 'links',
          detail: `Internal workspace "${name}" is reachable through multiple distinct lexical symlink aliases from different consumers.`,
          workspace: name,
          consumer: firstConsumers[0].consumer,
          expected: target.realPath,
          observed: {
            [firstConsumers[0].consumer]: firstAlias,
            [otherConsumers[0].consumer]: otherAlias,
          },
        })
      );
    }
  }

  return { ok: failures.length === 0, failures, report };
}

module.exports = {
  findLexicalResolution,
  buildTargetIndex,
  checkEntryPointResolution,
  run,
};
