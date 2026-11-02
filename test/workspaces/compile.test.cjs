'use strict';

// Focused tests for the sequential compile runner (scripts/workspaces/compile.cjs).
// Per bitcore-migration-plan.md ("Phase 1's workspace-runner tests use
// independent minimal fixtures, so they do not depend on repository
// cutover"), the ordering/failure/signal fixtures below are synthetic,
// disposable npm-workspaces projects -- real `npm run <script> --workspace=<name>`
// invocations against them, not this repository, and not a stubbed
// child_process. npm resolves `--workspace` purely from a root `workspaces`
// field plus on-disk package.json files; no `npm install`/`npm ci` is needed
// for these fixtures, since none of their scripts have external dependencies.

const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  checkDiscovery,
  runWorkspaceCompile,
  runSequentialCompile,
} = require('../../scripts/workspaces/compile.cjs');
const { COMPILE_ORDER } = require('../../scripts/workspaces/lib/constants.cjs');
const { makeTempDir, writeJson, writePackage } = require('./helpers.cjs');

function writeWorkspaceRoot(rootDir) {
  writeJson(path.join(rootDir, 'package.json'), {
    name: 'compile-runner-fixture',
    private: true,
    workspaces: ['packages/*'],
  });
}

// Each fixture package's `compile` script appends its own name to a shared
// log the instant it starts, before exiting with `exitCode` -- direct,
// ordering-sensitive proof of which packages actually ran, not an inference
// from the runner's final summary alone.
function writeRecorderScript(rootDir) {
  const recorderPath = path.join(rootDir, 'record.cjs');
  fs.writeFileSync(
    recorderPath,
    'const fs = require(\'fs\');\n' +
      'const path = require(\'path\');\n' +
      'const [,, name, exitCodeStr] = process.argv;\n' +
      `fs.appendFileSync(path.join(${JSON.stringify(rootDir)}, 'invocation-order.log'), name + '\\n');\n` +
      'process.exit(Number(exitCodeStr));\n'
  );
  return recorderPath;
}

function buildOrderFixture(exitCodes) {
  const rootDir = makeTempDir('compile-runner-order');
  writeWorkspaceRoot(rootDir);
  const recorderPath = writeRecorderScript(rootDir);
  const names = Object.keys(exitCodes);
  for (const name of names) {
    writePackage(rootDir, `packages/${name}`, {
      name,
      version: '0.0.0',
      scripts: { compile: `node ${JSON.stringify(recorderPath)} ${name} ${exitCodes[name]}` },
    });
  }
  return { rootDir, invocationLog: path.join(rootDir, 'invocation-order.log') };
}

test('runSequentialCompile runs every package in order when all succeed', async () => {
  const { rootDir, invocationLog } = buildOrderFixture({ 'pkg-a': 0, 'pkg-b': 0, 'pkg-c': 0 });
  const summary = await runSequentialCompile(['pkg-a', 'pkg-b', 'pkg-c'], { root: rootDir });
  assert.equal(summary.ok, true);
  assert.deepEqual(summary.started, ['pkg-a', 'pkg-b', 'pkg-c']);
  assert.equal(fs.readFileSync(invocationLog, 'utf8'), 'pkg-a\npkg-b\npkg-c\n');
});

test('runSequentialCompile stops before dependents when a prerequisite fails, and returns nonzero', async () => {
  const { rootDir, invocationLog } = buildOrderFixture({ 'pkg-a': 0, 'pkg-b': 1, 'pkg-c': 0 });
  const summary = await runSequentialCompile(['pkg-a', 'pkg-b', 'pkg-c'], { root: rootDir });
  assert.equal(summary.ok, false);
  assert.equal(summary.failedName, 'pkg-b');
  assert.equal(summary.code, 1);
  // pkg-c must never have started.
  assert.deepEqual(summary.started, ['pkg-a', 'pkg-b']);
  assert.equal(fs.readFileSync(invocationLog, 'utf8'), 'pkg-a\npkg-b\n');
});

test('runSequentialCompile stops at the first of two failing prerequisites', async () => {
  const { rootDir, invocationLog } = buildOrderFixture({ 'pkg-a': 1, 'pkg-b': 1, 'pkg-c': 0 });
  const summary = await runSequentialCompile(['pkg-a', 'pkg-b', 'pkg-c'], { root: rootDir });
  assert.equal(summary.ok, false);
  assert.equal(summary.failedName, 'pkg-a');
  assert.deepEqual(summary.started, ['pkg-a']);
  assert.equal(fs.readFileSync(invocationLog, 'utf8'), 'pkg-a\n');
});

test('runWorkspaceCompile forwards a received SIGTERM to the real npm child and waits for it to exit', async () => {
  const rootDir = makeTempDir('compile-runner-signal');
  writeWorkspaceRoot(rootDir);
  const markerPath = path.join(rootDir, 'marker.txt');
  const scriptPath = path.join(rootDir, 'packages', 'pkg-slow', 'compile.js');
  writePackage(rootDir, 'packages/pkg-slow', {
    name: 'pkg-slow',
    version: '0.0.0',
    scripts: { compile: 'node compile.js' },
  });
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(
    scriptPath,
    'const fs = require(\'fs\');\n' +
      'process.on(\'SIGTERM\', () => {\n' +
      `  fs.writeFileSync(${JSON.stringify(markerPath)}, 'received');\n` +
      '  process.exit(0);\n' +
      '});\n' +
      'setInterval(() => {}, 1000);\n' // stays alive until the forwarded signal arrives
  );

  assert.equal(fs.existsSync(markerPath), false);
  const compilePromise = runWorkspaceCompile('pkg-slow', { root: rootDir });
  // Give npm time to actually spawn the real child before interrupting.
  await new Promise((resolve) => setTimeout(resolve, 500));
  process.emit('SIGTERM');

  const result = await compilePromise;
  // The real leaf script handled SIGTERM itself and exited 0 -- proven
  // directly by the marker assertion below, which is what this test is
  // actually for. What npm itself reports for *its own* exit is a separate,
  // platform-dependent fact this project's tooling cannot control from
  // outside: confirmed empirically (see artifacts/workspaces/task2.2/
  // evidence.md), npm always runs a package's own script through
  // `/bin/sh -c '<script>'`, and macOS's `/bin/sh` execve-replaces itself
  // for a simple trailing command like `node compile.js` -- so there is no
  // distinct shell process, npm's own child IS the leaf, and npm reports
  // its clean exit 0 directly -- but Debian/Ubuntu's `/bin/sh` (dash, the
  // base of every `node:*-bookworm` image this repo uses) forks a real,
  // distinct child instead, which dies immediately once npm's own signal
  // relay reaches it (dash has no trap of its own to observe and reflect
  // its own child's real exit first), so npm reports that shell's own
  // signal death instead. Both are legitimate; the leaf either way is
  // confirmed by the marker file below, not by which of these two shapes
  // npm happened to report.
  assert.ok(
    result.code === 0 || (result.code === null && result.signal === 'SIGTERM'),
    `unexpected npm-reported exit for the runWorkspaceCompile promise: code=${result.code} signal=${result.signal}`
  );
  assert.equal(fs.existsSync(markerPath), true, 'the forwarded SIGTERM must have reached the real npm child');
  assert.equal(fs.readFileSync(markerPath, 'utf8'), 'received');
});

// Sequence-level regression for the bug an external review reproduced: a
// child that handles a forwarded signal gracefully and exits 0 must still
// count as an interruption of the *sequence*, not a success that lets the
// next package start. This spawns the runner itself as a real, separate OS
// process (not merely `process.emit` inside the test process) and sends it
// a genuine OS signal via `process.kill(pid, signal)`, so the whole path --
// real signal delivery, real forwarding, real delayed child cleanup, real
// process exit -- is exercised end to end, for both SIGINT and SIGTERM.
function buildInterruptionFixture() {
  const rootDir = makeTempDir('compile-runner-interrupt');
  writeWorkspaceRoot(rootDir);
  const readyPath = path.join(rootDir, 'ready.txt');
  const cleanupDonePath = path.join(rootDir, 'cleanup-done.txt');
  const dependentRanPath = path.join(rootDir, 'dependent-ran.txt');

  writePackage(rootDir, 'packages/pkg-a', {
    name: 'pkg-a',
    version: '0.0.0',
    scripts: { compile: 'node compile.js' },
  });
  fs.writeFileSync(
    path.join(rootDir, 'packages', 'pkg-a', 'compile.js'),
    "const fs = require('fs');\n" +
      `fs.writeFileSync(${JSON.stringify(readyPath)}, 'ready');\n` +
      'function delayedCleanup(signal) {\n' +
      '  setTimeout(() => {\n' + // deliberately non-trivial: a runner that
      // does not really wait for the child's own `exit` event would let the
      // process finish near-instantly instead of after this delay.
      `    fs.writeFileSync(${JSON.stringify(cleanupDonePath)}, String(Date.now()));\n` +
      '    process.exit(0);\n' +
      '  }, 400);\n' +
      '}\n' +
      "process.on('SIGINT', () => delayedCleanup('SIGINT'));\n" +
      "process.on('SIGTERM', () => delayedCleanup('SIGTERM'));\n" +
      'setInterval(() => {}, 1000);\n'
  );

  writePackage(rootDir, 'packages/pkg-b', {
    name: 'pkg-b',
    version: '0.0.0',
    scripts: { compile: 'node compile.js' },
  });
  fs.writeFileSync(
    path.join(rootDir, 'packages', 'pkg-b', 'compile.js'),
    `require('fs').writeFileSync(${JSON.stringify(dependentRanPath)}, 'ran');\n`
  );

  return { rootDir, readyPath, cleanupDonePath, dependentRanPath };
}

function runIsolatedRunnerAndSignal(signalName) {
  const { rootDir, readyPath, cleanupDonePath, dependentRanPath } = buildInterruptionFixture();
  const compileCjsPath = require.resolve('../../scripts/workspaces/compile.cjs');
  const runnerScriptPath = path.join(rootDir, 'runner.js');
  fs.writeFileSync(
    runnerScriptPath,
    `const { runSequentialCompile } = require(${JSON.stringify(compileCjsPath)});\n` +
      `runSequentialCompile(['pkg-a', 'pkg-b'], { root: ${JSON.stringify(rootDir)} }).then((summary) => {\n` +
      "  process.stdout.write('SUMMARY:' + JSON.stringify(summary) + '\\n');\n" +
      '  process.exitCode = summary.ok ? 0 : 1;\n' +
      '});\n'
  );

  return new Promise((resolve, reject) => {
    const runner = spawn('node', [runnerScriptPath], { cwd: rootDir });
    let stdout = '';
    runner.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    runner.on('error', reject);

    (async () => {
      const deadline = Date.now() + 5000;
      while (!fs.existsSync(readyPath)) {
        if (Date.now() > deadline) {
          reject(new Error('pkg-a never signaled readiness'));
          return;
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      const signalSentAt = Date.now();
      // A real OS signal to a genuinely separate process -- not
      // `process.emit` inside this test's own process.
      process.kill(runner.pid, signalName);

      runner.on('exit', (code) => {
        resolve({
          exitCode: code,
          elapsedMs: Date.now() - signalSentAt,
          cleanupDone: fs.existsSync(cleanupDonePath),
          dependentRan: fs.existsSync(dependentRanPath),
          stdout,
        });
      });
    })();
  });
}

for (const signalName of ['SIGINT', 'SIGTERM']) {
  test(`isolated runner process interrupted by a real OS ${signalName}: waits for delayed child cleanup, never starts the dependent, exits nonzero`, async () => {
    const result = await runIsolatedRunnerAndSignal(signalName);
    assert.ok(
      result.elapsedMs >= 350,
      `runner exited only ${result.elapsedMs}ms after the signal; it must wait for the child's real exit (~400ms delayed cleanup), not return early`
    );
    assert.equal(result.cleanupDone, true, "the child's delayed cleanup must have completed");
    assert.equal(result.dependentRan, false, 'pkg-b must never start once the runner is interrupted mid pkg-a');
    assert.notEqual(result.exitCode, 0, 'the runner process must exit nonzero when interrupted, even though pkg-a itself exited 0');
    assert.match(result.stdout, /"interruptedBy":"..+"/);
  });
}

test('runSequentialCompile executes all seven configured package scripts, using the real scoped names and order', async () => {
  const rootDir = makeTempDir('compile-runner-seven');
  writeWorkspaceRoot(rootDir);
  const recorderPath = writeRecorderScript(rootDir);
  for (const name of COMPILE_ORDER) {
    writePackage(rootDir, `packages/${name.replace('@bitpay-labs/', '')}`, {
      name,
      version: '0.0.0',
      scripts: { compile: `node ${JSON.stringify(recorderPath)} ${name} 0` },
    });
  }
  const summary = await runSequentialCompile(COMPILE_ORDER, { root: rootDir });
  assert.equal(summary.ok, true);
  assert.deepEqual(summary.started, COMPILE_ORDER);
  assert.equal(
    fs.readFileSync(path.join(rootDir, 'invocation-order.log'), 'utf8'),
    COMPILE_ORDER.map((name) => `${name}\n`).join('')
  );
});

test('checkDiscovery finds no mismatch against the real repository as it stands today', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const failures = checkDiscovery(repoRoot);
  assert.deepEqual(failures, []);
});

// Runtime-enforcement regression, through the real entry point. These run the
// actual scripts/workspaces/compile.cjs as a separate `node` process against
// this repository's real root and real COMPILE_ORDER, so the whole of `main()`
// (preflight -> discovery -> dispatch) is exercised. Real builds cannot start:
// the `npm` the runner finds on PATH is a recording shim that never compiles
// anything -- it only logs each invocation, answers `--version`, and exits.
// `npm_config_user_agent` is always set explicitly (or removed) because these
// tests may themselves be running under `npm test`, which would otherwise leak
// the real npm's user agent into the runner and mask the PATH fallback.
const COMPILE_CJS = path.resolve(__dirname, '..', '..', 'scripts', 'workspaces', 'compile.cjs');
const REAL_NODE_USER_AGENT = `node/${process.version}`;

function makeNpmShim({ versionOutput = '11.19.1\n', versionExit = 0, runExit = 0 } = {}) {
  const shimDir = makeTempDir('compile-runner-npm-shim');
  const logPath = path.join(shimDir, 'invocations.log');
  const shimPath = path.join(shimDir, 'npm');
  fs.writeFileSync(
    shimPath,
    `#!${process.execPath}\n` +
      "const fs = require('fs');\n" +
      `fs.appendFileSync(${JSON.stringify(logPath)}, process.argv.slice(2).join(' ') + '\\n');\n` +
      "if (process.argv[2] === '--version') {\n" +
      `  process.stdout.write(${JSON.stringify(versionOutput)});\n` +
      `  process.exit(${versionExit});\n` +
      '}\n' +
      `process.exit(${runExit});\n`,
    { mode: 0o755 }
  );
  const invocations = () =>
    fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean) : [];
  return { shimDir, invocations };
}

function runCompileEntryPoint({ shimDir, userAgent, nodeOptions }) {
  const env = { ...process.env, PATH: `${shimDir}${path.delimiter}${process.env.PATH}` };
  delete env.npm_config_user_agent;
  if (userAgent) env.npm_config_user_agent = userAgent;
  if (nodeOptions) env.NODE_OPTIONS = nodeOptions;
  return spawnSync(process.execPath, [COMPILE_CJS], { env, encoding: 'utf8', timeout: 30000 });
}

function dispatchedCompiles(invocations) {
  return invocations.filter((line) => line.startsWith('run compile'));
}

test('compile entry point rejects unsupported npm (npm/0.0.0 user agent) with nonzero exit before dispatching any workspace', () => {
  const { shimDir, invocations } = makeNpmShim();
  const result = runCompileEntryPoint({ shimDir, userAgent: `npm/0.0.0 ${REAL_NODE_USER_AGENT}` });
  assert.notEqual(result.status, 0, `expected nonzero exit; stdout=${result.stdout} stderr=${result.stderr}`);
  assert.match(result.stderr, /Expected npm 11\.19\.1 exactly, observed 0\.0\.0/);
  assert.deepEqual(dispatchedCompiles(invocations()), [], 'no workspace compile may start under an unsupported npm');
  assert.doesNotMatch(result.stdout, /\[compile\]/, 'the runner must not report starting any package');
});

test('compile entry point rejects unsupported npm resolved via the PATH fallback before dispatching any workspace', () => {
  const { shimDir, invocations } = makeNpmShim({ versionOutput: '0.0.0\n' });
  const result = runCompileEntryPoint({ shimDir });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Expected npm 11\.19\.1 exactly, observed 0\.0\.0/);
  // The preflight itself asked the PATH npm for its version, and nothing more.
  assert.deepEqual(invocations(), ['--version']);
});

test('compile entry point rejects an npm whose version cannot be determined before dispatching any workspace', () => {
  const { shimDir, invocations } = makeNpmShim({ versionOutput: '', versionExit: 1 });
  const result = runCompileEntryPoint({ shimDir });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unable to determine an installed npm version/);
  assert.deepEqual(dispatchedCompiles(invocations()), []);
});

test('compile entry point rejects an unsupported Node major before dispatching any workspace', () => {
  const { shimDir, invocations } = makeNpmShim();
  const preloadPath = path.join(shimDir, 'fake-node-version.cjs');
  // Reports Node 20 to the runner without needing a second Node install.
  fs.writeFileSync(
    preloadPath,
    "Object.defineProperty(process, 'version', { value: 'v20.11.0', configurable: true });\n"
  );
  const result = runCompileEntryPoint({
    shimDir,
    userAgent: `npm/11.19.1 ${REAL_NODE_USER_AGENT}`,
    nodeOptions: `--require ${preloadPath}`,
  });
  assert.notEqual(result.status, 0, `expected nonzero exit; stdout=${result.stdout} stderr=${result.stderr}`);
  assert.match(result.stderr, /Expected Node 24\.x, observed v20\.11\.0/);
  assert.deepEqual(dispatchedCompiles(invocations()), []);
});

test('compile entry point under the supported toolchain still dispatches all seven workspaces sequentially, in order', () => {
  for (const userAgent of [`npm/11.19.1 ${REAL_NODE_USER_AGENT}`, null]) {
    const { shimDir, invocations } = makeNpmShim();
    const result = runCompileEntryPoint({ shimDir, userAgent });
    assert.equal(result.status, 0, `userAgent=${userAgent} stdout=${result.stdout} stderr=${result.stderr}`);
    assert.deepEqual(
      dispatchedCompiles(invocations()),
      COMPILE_ORDER.map((name) => `run compile --workspace=${name}`)
    );
  }
});

test('compile entry point under the supported toolchain still propagates a workspace failure and stops before dependents', () => {
  const { shimDir, invocations } = makeNpmShim({ runExit: 3 });
  const result = runCompileEntryPoint({ shimDir, userAgent: `npm/11.19.1 ${REAL_NODE_USER_AGENT}` });
  assert.equal(result.status, 3);
  assert.deepEqual(dispatchedCompiles(invocations()), [`run compile --workspace=${COMPILE_ORDER[0]}`]);
});
