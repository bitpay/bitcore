#!/usr/bin/env node
'use strict';

// Sequential compile runner (acceptance-spec §2). Invokes each compile-
// bearing workspace's own `compile` script, in the configured order, through
// `npm run compile --workspace=<name>` -- never `tsc` directly -- so each
// package keeps selecting its own compiler and lifecycle (CLI's postbuild
// launcher generation, wallet-service's template copying, ...). Stops
// before the next package after the first nonzero exit or signal; this is
// how docs/workspaces/acceptance-spec.md §2 keeps the seven-package build
// order explicit instead of relying on a workspace tool's own topological
// sort.
//
// This module is intentionally usable against any npm-workspaces root, not
// only this repository: `runSequentialCompile`/`runWorkspaceCompile` take an
// explicit `order` and `root`, so fixtures can exercise the real
// ordering/failure/signal-handling behavior against a disposable synthetic
// workspace tree without depending on this repository's installation.
// Only `main()` below binds the real COMPILE_ORDER and this repository's root.

const { spawn, execFileSync } = require('child_process');
const path = require('path');
const { enforceRuntime } = require('./check-runtime.cjs');
const { EXPECTED_WORKSPACES, COMPILE_ORDER } = require('./lib/constants.cjs');
const { checkCompileMembership } = require('./lib/manifests.cjs');
const { loadWorkspaceManifests } = require('./lib/util.cjs');

// Lists the live direct child pids of `pid` via `pgrep -P`, available on both
// this project's supported platforms (macOS and Debian/Ubuntu Linux). Exit
// code 1 from pgrep means no matches, not an error.
function listChildPids(pid) {
  try {
    const out = execFileSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' });
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map(Number);
  } catch (err) {
    if (err.status === 1) return [];
    throw err;
  }
}

// Signals only the *leaf* live descendants of `pid` (processes with no
// children of their own at the moment of the walk) -- deliberately not every
// descendant. Needed alongside signaling npm itself directly: confirmed
// in the signal fixtures under test/workspaces/compile.test.cjs that npm's own
// lifecycle code already relays a signal it receives to its immediate child
// correctly on both platforms, but that immediate child is
// `/bin/sh -c '<script>'` (npm always runs a package's own script through a
// shell, since a script string can contain arbitrary shell syntax it can't
// safely skip that layer for), and this project's two supported platforms
// disagree about what that shell layer even is: macOS's `/bin/sh` execve-
// replaces itself for a simple trailing command like `node compile.js`, so
// there is no distinct shell process left to relay through -- but
// Debian/Ubuntu's `/bin/sh` (dash, the base of every `node:*-bookworm` image
// this repo uses) forks a real child instead, and dash does not relay a
// signal it receives on to that child; it just dies immediately on its own,
// orphaning the still-running compile step and hanging anything waiting on
// it. Signaling the leaf directly reaches that orphan-prone grandchild
// regardless of which of those the shell layer turned out to be -- but only
// the leaf: signaling dash *itself* directly (in addition to its child)
// reintroduces the identical problem one level up, since a directly-
// signaled dash also just dies immediately, before it can observe its own
// child's real exit and propagate it -- which is exactly the npm-visible
// signal/exit-code that the runner and its tests read. Leaving every
// intermediate shell unsignaled lets each one exit normally once its own
// child does, so npm's own reported exit reflects the real leaf's outcome
// instead of a shell that was killed out from under it.
//
// Returns the pids it actually signaled, so the caller can wait for their
// real exit directly: npm's own reported exit (see runWorkspaceCompile) only
// reflects its immediate child (the intermediate shell, left deliberately
// unsignaled above), not these leaves, so on a platform where that shell is
// a distinct, real process, npm can finish observing *its* child well
// before a leaf signaled here has actually finished exiting.
function killDescendants(pid, signal) {
  const signaled = [];
  for (const childPid of listChildPids(pid)) {
    const grandchildPids = listChildPids(childPid);
    if (grandchildPids.length === 0) {
      try {
        process.kill(childPid, signal);
        signaled.push(childPid);
      } catch (err) {
        if (err.code !== 'ESRCH') throw err;
      }
    } else {
      signaled.push(...killDescendants(childPid, signal));
    }
  }
  return signaled;
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false; // ESRCH: no process with that pid remains.
  }
}

// Polls until `pid` is gone. Used only for the leaf pids killDescendants
// itself signaled, whose real exit npm's own `exit` event does not reflect
// (see killDescendants above) -- there is no `exit` event to await for a
// process this runner did not spawn directly, so polling is the option
// left, bounded generously since these are our own signaled leaves, not
// arbitrary external processes.
function waitForExit(pid, { pollMs = 20, timeoutMs = 10000 } = {}) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      if (!isAlive(pid) || Date.now() > deadline) return resolve();
      setTimeout(check, pollMs);
    };
    check();
  });
}

// Confirms exactly COMPILE_ORDER's packages declare a `compile` script,
// scanning EXPECTED_WORKSPACES's package.json files directly on disk. This
// works whether or not root workspace cutover (Task 2.1) has happened yet --
// it does not rely on `npm`'s own workspace discovery. Reuses
// checkCompileMembership (already exercised by test/workspaces/manifests.test.cjs)
// instead of re-implementing the same rule: "discovery must reject a new
// compile-bearing workspace until the explicit order is updated."
function checkDiscovery(rootDir) {
  const workspaceManifests = loadWorkspaceManifests(rootDir, EXPECTED_WORKSPACES);
  return checkCompileMembership(workspaceManifests);
}

// Runs one workspace's compile script to completion. Forwards SIGINT/SIGTERM
// received by this process to the child and waits for its real `exit` event
// before resolving, so an interrupted runner never leaves an orphaned
// compile running in the background and never reports done before the
// child has actually terminated.
function runWorkspaceCompile(name, { root, npmCommand = 'npm', spawnImpl = spawn } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(npmCommand, ['run', 'compile', `--workspace=${name}`], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });

    // Tracks whether *this runner process* was asked to stop, independent of
    // how the child eventually exits. A child that handles the forwarded
    // signal gracefully mid cleanup and exits 0 (which is legitimate,
    // well-behaved child behavior, not a bug in the child) must still count
    // as an interruption here -- otherwise the sequence would read that as
    // an ordinary success and silently continue into dependents the caller
    // asked to stop before. `interruptedBy` is set the instant the signal is
    // received, before the child has had any chance to exit, so its value
    // reflects why the runner is stopping, not what the child's exit looked
    // like.
    let interruptedBy = null;
    let signaledLeafPids = [];
    const forward = (signal) => {
      interruptedBy = interruptedBy || signal;
      if (child.killed || !child.pid) return;
      // Signal npm's actual OS descendants directly, in addition to npm
      // itself below: see killDescendants above for why the direct signal
      // to npm alone is not sufficient on this project's Debian/Ubuntu-based
      // Linux targets.
      signaledLeafPids = signaledLeafPids.concat(killDescendants(child.pid, signal));
      child.kill(signal);
    };
    process.on('SIGINT', forward);
    process.on('SIGTERM', forward);
    const stopForwarding = () => {
      process.removeListener('SIGINT', forward);
      process.removeListener('SIGTERM', forward);
    };

    child.on('error', (err) => {
      stopForwarding();
      reject(err);
    });
    child.on('exit', (code, signal) => {
      stopForwarding();
      // npm's own `exit` reflects only its immediate child (see
      // killDescendants), so on a platform where that child is a real,
      // distinct shell (Debian/Ubuntu's dash), npm can report done before a
      // leaf this runner itself signaled has actually finished exiting.
      // Waiting here restores this function's own documented promise --
      // never report done before the child has actually terminated -- for
      // that leaf too, not only for npm.
      Promise.all(signaledLeafPids.map((pid) => waitForExit(pid))).then(() => {
        resolve({ name, code, signal, interruptedBy });
      });
    });
  });
}

// Runs every workspace in `order` in sequence, stopping before the next one
// after any nonzero exit code or termination-by-signal. `started` lists
// every workspace actually begun, in the order it was begun, so callers
// (including fixtures) can assert exactly which packages ran without
// relying on timing or log-scraping.
async function runSequentialCompile(order, opts) {
  const started = [];
  for (const name of order) {
    started.push(name);
    console.log(`[compile] ${name}`);
    const result = await runWorkspaceCompile(name, opts);
    // Checked first and independent of code/signal: the runner itself was
    // asked to stop, so this package's own exit outcome (even a clean 0)
    // must not be read as permission to continue into dependents.
    if (result.interruptedBy) {
      return {
        ok: false,
        started,
        failedName: name,
        code: result.code,
        signal: result.signal,
        interruptedBy: result.interruptedBy,
      };
    }
    if (result.signal) {
      return { ok: false, started, failedName: name, code: null, signal: result.signal, interruptedBy: null };
    }
    if (result.code !== 0) {
      return { ok: false, started, failedName: name, code: result.code, signal: null, interruptedBy: null };
    }
  }
  return { ok: true, started, failedName: null, code: 0, signal: null, interruptedBy: null };
}

async function main() {
  // The runner can be invoked directly (`node scripts/workspaces/compile.cjs`,
  // or `npm run compile` outside an install), where neither root `preinstall`
  // nor CI/Docker's explicit preflight has run. Enforce the supported
  // toolchain here, before discovery and before any workspace is dispatched.
  if (!enforceRuntime().ok) {
    process.exitCode = 1;
    return;
  }

  const rootDir = path.resolve(__dirname, '..', '..');

  const discoveryFailures = checkDiscovery(rootDir);
  if (discoveryFailures.length > 0) {
    console.error('[compile] Compile-bearing workspace set does not match the configured order:');
    for (const failure of discoveryFailures) console.error(failure);
    process.exitCode = 1;
    return;
  }

  const summary = await runSequentialCompile(COMPILE_ORDER, { root: rootDir });
  if (summary.ok) {
    console.log('[compile] All seven packages compiled successfully, in order.');
    return;
  }

  if (summary.interruptedBy) {
    console.error(`[compile] Received ${summary.interruptedBy}; stopped after ${summary.failedName}, before dependents.`);
    process.exitCode = 1;
    return;
  }
  if (summary.signal) {
    console.error(`[compile] ${summary.failedName} was terminated by ${summary.signal}; stopping before dependents.`);
    process.exitCode = 1;
    return;
  }
  console.error(`[compile] ${summary.failedName} exited with code ${summary.code}; stopping before dependents.`);
  process.exitCode = summary.code || 1;
}

module.exports = {
  checkDiscovery,
  runWorkspaceCompile,
  runSequentialCompile,
};

if (require.main === module) {
  main();
}
