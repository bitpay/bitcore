#!/usr/bin/env node
'use strict';

// This command deliberately never invokes pub, publish, version, or tag.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const semver = require('semver');
const { audit } = require('./audit-packed.cjs');

const root = path.resolve(__dirname, '../..');

function run(args, options = {}) {
  const result = spawnSync('npm', args, { cwd: root, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`npm ${args.join(' ')} failed (${result.signal || result.status})`);
    error.exitCode = result.status || 1;
    throw error;
  }
  return result.stdout;
}

function checkManifest(manifest, expected) {
  assert(!manifest.private, `${expected.name}: private package`);
  assert.equal(manifest.name, expected.name);
  assert.equal(manifest.version, expected.version);
  for (const field of ['publishConfig', 'main', 'types', 'bin', 'files', 'dependencies', 'optionalDependencies', 'peerDependencies']) {
    assert.deepEqual(manifest[field] ?? null, expected[field] ?? null, `${expected.name}: packed ${field} changed`);
  }
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, range] of Object.entries(manifest[field] || {})) {
      assert(!/^(?:file:|workspace:|link:|\/|[A-Za-z]:\\)/.test(range), `${manifest.name}: ${name} has nonportable range ${range}`);
      if (name.startsWith('@bitpay-labs/')) assert(semver.validRange(range), `${manifest.name}: ${name} must use semver`);
    }
  }
}

function checkContents(manifest, files, directory) {
  const required = [manifest.main, manifest.types,
    ...(manifest.files || []).filter(file => !/[?*]/.test(file) && /\.js$/.test(file)),
    ...Object.values(typeof manifest.bin === 'string' ? { bin: manifest.bin } : manifest.bin || {})].filter(Boolean);
  if (manifest.name === '@bitpay-labs/bitcore-build') required.push('karma.conf.js', 'wdio.conf.js');
  if (manifest.name === '@bitpay-labs/bitcore-wallet-service') {
    function walk(dir) {
      for (const entry of fs.readdirSync(path.join(directory, dir), { withFileTypes: true })) {
        const relative = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(relative);
        else {
          const built = `ts_build/${relative}`;
          required.push(built);
          assert(files.has(built), `${manifest.name}: tarball missing ${built}`);
          assert(fs.readFileSync(path.join(directory, relative)).equals(fs.readFileSync(path.join(directory, built))),
            `${manifest.name}: copied template differs: ${relative}`);
        }
      }
    }
    walk('templates');
  }
  for (const entry of required) assert(files.has(entry.replace(/^\.\//, '')), `${manifest.name}: tarball missing ${entry}`);
}

function main() {
  const args = process.argv.slice(2);
  assert(args.length === 0 || args.length === 1 && args[0].startsWith('--destination='), 'Usage: npm run artifacts:check -- [--destination=/absolute/path]');
  const destination = args.length ? path.resolve(args[0].slice('--destination='.length)) : fs.mkdtempSync(path.join(os.tmpdir(), 'bitcore-artifacts-'));
  fs.mkdirSync(destination, { recursive: true });
  const candidates = require('../../package.json').workspaces.map(directory => ({
    directory,
    manifest: JSON.parse(fs.readFileSync(path.join(root, directory, 'package.json'), 'utf8')),
  })).filter(({ manifest }) => !manifest.private);
  assert(candidates.length > 0, 'No public workspace packages found');
  for (const { manifest } of candidates) checkManifest(manifest, manifest);
  run(['run', 'compile']);
  const artifacts = [];
  for (const { manifest: candidate } of candidates) {
    // npm pack runs the owning package's prepack lifecycle. No release script
    // parsing, duplicate preparation table, or frozen version baseline.
    // npm pack defaults to foreground lifecycle scripts; their stdout would
    // otherwise be mixed into the JSON that this command needs to parse.
    const output = run(['pack', `--workspace=${candidate.name}`, `--pack-destination=${destination}`, '--foreground-scripts=false', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
    const [packed] = JSON.parse(output);
    const tarball = path.join(destination, packed.filename);
    const unpacked = fs.mkdtempSync(path.join(destination, 'unpacked-'));
    try {
      const extracted = spawnSync('tar', ['-xzf', tarball, '-C', unpacked], { encoding: 'utf8' });
      assert.equal(extracted.status, 0, `Cannot extract ${tarball}: ${extracted.stderr}`);
      const directory = path.join(unpacked, 'package');
      const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
      checkManifest(manifest, candidate);
      checkContents(manifest, new Set(packed.files.map(f => f.path)), directory);
      // Audit only what consumers receive; source-tree files omitted from the
      // tarball cannot cause false positives or hide missing shipped imports.
      const { failures, exceptions } = audit(directory);
      assert(failures.length === 0, failures.join('\n'));
      for (const exception of exceptions) console.log(`[artifacts:check] documented exception: ${exception}`);
    } finally {
      fs.rmSync(unpacked, { recursive: true, force: true });
    }
    artifacts.push({ name: candidate.name, version: candidate.version, tarball });
    console.log(`[artifacts:check] ${candidate.name}: ${tarball}`);
  }
  fs.writeFileSync(path.join(destination, 'artifacts.json'), JSON.stringify(artifacts, null, 2) + '\n');
  console.log(`[artifacts:check] PASS: ${artifacts.length} packages; ${destination}/artifacts.json`);
}

module.exports = { checkManifest, checkContents };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = error.exitCode || 1; }
}
