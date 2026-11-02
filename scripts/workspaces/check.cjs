#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const semver = require('semver');

// Check installed behavior against the current manifests, without a second
// workspace inventory or snapshots of package versions and script strings.
function check(root) {
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const workspaces = read(path.join(root, 'package.json')).workspaces.map(directory => ({
    directory: path.join(root, directory),
    manifest: read(path.join(root, directory, 'package.json')),
  }));
  const byName = new Map(workspaces.map(workspace => [workspace.manifest.name, workspace]));
  assert.equal(byName.size, workspaces.length, 'Workspace names must be unique');

  for (const { directory, manifest } of workspaces) {
    const installed = require.resolve(`${manifest.name}/package.json`, { paths: [root] });
    assert.equal(fs.realpathSync(installed), fs.realpathSync(path.join(directory, 'package.json')),
      `${manifest.name}: root installation must link to the workspace`);

    const bins = typeof manifest.bin === 'string' ? [manifest.bin] : Object.values(manifest.bin || {});
    for (const entry of [manifest.main, manifest.types, ...bins].filter(Boolean)) {
      assert(fs.statSync(path.join(directory, entry)).isFile(), `${manifest.name}: missing entry ${entry}`);
    }
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, range] of Object.entries(manifest[field] || {})) {
        const target = byName.get(name);
        if (!target) continue;
        assert(semver.validRange(range) && semver.satisfies(target.manifest.version, range),
          `${manifest.name}: ${name}@${range} must match local version ${target.manifest.version}`);
        const resolved = require.resolve(`${name}/package.json`, { paths: [directory] });
        assert.equal(fs.realpathSync(resolved), fs.realpathSync(path.join(target.directory, 'package.json')),
          `${manifest.name}: ${name} resolves to a registry copy instead of the workspace`);
      }
    }
  }
  return workspaces.length;
}

module.exports = { check };
if (require.main === module) {
  try {
    console.log(`[workspaces:check] ${check(path.resolve(__dirname, '../..'))} workspaces linked and built`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
