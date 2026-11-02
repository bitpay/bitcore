'use strict';

// Shared fixture helpers for the workspace-verifier tests. Fixtures are
// synthetic, minimal directory trees independent of the real repository (see
// docs/workspaces/README.md), so these tests exercise verifier *logic*, not the
// migrated repository itself.

const fs = require('fs');
const os = require('os');
const path = require('path');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `bitcore-workspaces-${prefix}-`));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function writePackage(rootDir, workspacePath, manifest) {
  writeJson(path.join(rootDir, workspacePath, 'package.json'), manifest);
}

function symlink(target, linkPath) {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(target, linkPath, 'dir');
}

module.exports = { makeTempDir, writeJson, writePackage, symlink };
