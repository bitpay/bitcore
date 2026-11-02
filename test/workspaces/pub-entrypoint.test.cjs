'use strict';

// Verifies the *existing*, unmodified `packages/pub` release-loop entry
// point still routes into each selected package's own `npm run pub` script,
// in the recorded order and cwd, using a stub `npm` on PATH -- never the
// real npm (see docs/workspaces/acceptance-spec.md §7: existing pub scripts
// invoke real publication and are not acceptance commands).

const { execFileSync } = require('child_process');
const fs = require('fs');
const assert = require('node:assert/strict');
const test = require('node:test');
const os = require('os');
const path = require('path');
const baseline = require('../../scripts/workspaces/release-baseline.json');

const root = path.resolve(__dirname, '../..');

function makeStubNpm(logFile) {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitcore-pub-stub-npm-'));
  const stub = path.join(binDir, 'npm');
  fs.writeFileSync(
    stub,
    [
      '#!/usr/bin/env node',
      'const fs = require(\'fs\');',
      `fs.appendFileSync(${JSON.stringify(logFile)}, JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }) + '\\n');`,
      'process.exit(0);',
      '',
    ].join('\n')
  );
  fs.chmodSync(stub, 0o755);
  return binDir;
}

test('packages/pub routes into `npm run pub` for each selected package, in the recorded baseline order, cd-ing into each in turn', () => {
  const logFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bitcore-pub-log-')), 'calls.ndjson');
  const stubBinDir = makeStubNpm(logFile);

  execFileSync('sh', ['pub'], {
    cwd: path.join(root, 'packages'),
    env: { ...process.env, PATH: `${stubBinDir}:${process.env.PATH}` },
  });

  const calls = fs
    .readFileSync(logFile, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

  assert.equal(calls.length, baseline.releaseOrder.length);
  for (const call of calls) assert.deepEqual(call.args, ['run', 'pub']);

  const directories = calls.map((call) => path.basename(call.cwd));
  assert.deepEqual(directories, baseline.releaseOrder);

  // The release loop's own pre-existing duplicate P2P Doge entry
  // (scripts/workspaces/release-baseline.json) -- recorded as baseline metadata, not
  // repaired here, so this stays a fixed regression test for that exact,
  // already-known shape rather than silently normalizing it away.
  assert.equal(directories.at(-1), 'bitcore-p2p-doge');
  assert.equal(directories.at(-2), 'bitcore-p2p-doge');
});

test('a documented pre-existing defect: a failed `npm run pub` does not stop the release loop or its exit code', () => {
  // packages/pub joins each iteration's `npm run pub` to its `cd ..` with
  // `;`, not `&&`, and sets no `set -e` -- so a failure partway through the
  // real release loop is silently swallowed: every remaining package still
  // gets its own `npm run pub` call, and the overall script still exits 0.
  // Recorded here the same way Task 5.1 records the pre-existing duplicate
  // P2P Doge entry: as known baseline metadata, with repair kept as a
  // separate follow-up, not fixed as part of this migration.
  const logFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bitcore-pub-log-fail-')), 'calls.ndjson');
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitcore-pub-stub-npm-fail-'));
  const stub = path.join(binDir, 'npm');
  // Fails on the very first invocation (bitcore-build) so the loop's actual
  // failure-propagation shape is observed on the first call, not buried
  // after several successful ones.
  fs.writeFileSync(
    stub,
    [
      '#!/usr/bin/env node',
      'const fs = require(\'fs\');',
      `fs.appendFileSync(${JSON.stringify(logFile)}, JSON.stringify({ cwd: process.cwd() }) + '\\n');`,
      'process.exit(1);',
      '',
    ].join('\n')
  );
  fs.chmodSync(stub, 0o755);

  // Does not throw: the overall script still exits 0 despite every
  // invocation failing.
  execFileSync('sh', ['pub'], {
    cwd: path.join(root, 'packages'),
    env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
    stdio: 'pipe',
  });

  const calls = fs
    .readFileSync(logFile, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(calls.length, baseline.releaseOrder.length);
});
