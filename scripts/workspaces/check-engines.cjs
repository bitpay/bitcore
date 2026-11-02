#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const semver = require('semver');

// npm's engine-strict cannot exempt the legacy socks5-client declaration.
// Keep that exception narrow and check the actual installed manifests in CI.
function check(root, nodeVersion = process.versions.node) {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const checked = new Set();
  for (const [key, record] of Object.entries(lock.packages)) {
    if (!key) continue;
    const directory = path.join(root, key);
    if (!fs.existsSync(directory) && record.optional) continue;
    const realDirectory = fs.realpathSync(directory);
    if (checked.has(realDirectory)) continue;
    checked.add(realDirectory);
    const manifest = JSON.parse(fs.readFileSync(path.join(realDirectory, 'package.json'), 'utf8'));
    const range = manifest.engines?.node;
    if (!range) continue;
    if (manifest.name === 'socks5-client' && manifest.version === '0.3.6' && range === '0.x') {
      console.log('[check-engines] documented exception: socks5-client@0.3.6 (Node 0.x)');
      continue;
    }
    assert(semver.satisfies(nodeVersion, range),
      `${manifest.name}@${manifest.version}: Node ${nodeVersion} does not satisfy ${range}`);
  }
  return checked.size;
}

module.exports = { check };
if (require.main === module) {
  try {
    console.log(`[check-engines] ${check(path.resolve(__dirname, '../..'))} installed packages checked`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
