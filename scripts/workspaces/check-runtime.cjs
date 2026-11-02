#!/usr/bin/env node
'use strict';

// Dependency-free runtime preflight (acceptance-spec §3). Uses only Node
// built-ins so it can run before `npm install` ever executes -- it is wired
// as root `preinstall` and is also called explicitly by CI/Docker before
// `npm ci`, and by the compile runner as a second check.

const { spawnSync } = require('child_process');
const { SUPPORTED_NODE_VERSION } = require('./lib/constants.cjs');

const EXPECTED_NODE_MAJOR = 24;
const EXPECTED_NPM_VERSION = '10.9.2';

function getNodeMajor(nodeVersion) {
  const match = /^v?(\d+)\./.exec(nodeVersion);
  return match ? Number(match[1]) : null;
}

// npm sets `npm_config_user_agent` (e.g. "npm/10.9.2 node/v24.22.1 darwin
// x64 workspaces/false") in every lifecycle script's environment. Outside a
// lifecycle script (a developer or CI running this directly) we fall back to
// asking the `npm` on PATH.
function resolveNpmVersion(env, spawn = spawnSync) {
  const userAgent = env.npm_config_user_agent;
  if (userAgent) {
    const match = /npm\/(\S+)/.exec(userAgent);
    if (match) return match[1];
  }
  const result = spawn('npm', ['--version'], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout) {
    return result.stdout.trim();
  }
  return null;
}

function evaluateRuntime({
  nodeVersion,
  npmVersion,
  expectedNodeMajor = EXPECTED_NODE_MAJOR,
  expectedNpmVersion = EXPECTED_NPM_VERSION,
  minimumNodeVersion = SUPPORTED_NODE_VERSION,
}) {
  const problems = [];
  const nodeMajor = getNodeMajor(nodeVersion);
  if (nodeMajor === null) {
    problems.push(`Unable to parse Node version "${nodeVersion}".`);
  } else if (nodeMajor !== expectedNodeMajor) {
    problems.push(`Expected Node ${expectedNodeMajor}.x, observed ${nodeVersion} (major ${nodeMajor}).`);
  }
  if (nodeMajor === expectedNodeMajor) {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(nodeVersion);
    const minimum = minimumNodeVersion.split('.').map(Number);
    const parts = match && match.slice(1).map(Number);
    const firstDifference = parts && parts.findIndex((part, index) => part !== minimum[index]);
    if (!parts || (firstDifference !== -1 && parts[firstDifference] < minimum[firstDifference])) {
      problems.push(`Expected Node >=${minimumNodeVersion}, observed ${nodeVersion}.`);
    }
  }
  if (!npmVersion) {
    problems.push('Unable to determine an installed npm version (npm is absent or unidentified).');
  } else if (npmVersion !== expectedNpmVersion) {
    problems.push(`Expected npm ${expectedNpmVersion} exactly, observed ${npmVersion}.`);
  }
  return { ok: problems.length === 0, problems, nodeMajor, npmVersion };
}

// Resolves the live toolchain, evaluates it against the supported policy, and
// reports any problems to stderr. Returns the evaluation result without
// setting an exit code, so each entry point (this script's own `main`, the
// compile runner) decides how to stop. Shared so every enforcing caller uses
// the same version resolution and the same policy constants.
function enforceRuntime({
  env = process.env,
  nodeVersion = process.version,
  spawn = spawnSync,
  logError = console.error,
} = {}) {
  const npmVersion = resolveNpmVersion(env, spawn);
  const result = evaluateRuntime({ nodeVersion, npmVersion });
  if (!result.ok) {
    logError('[check-runtime] Unsupported toolchain:');
    for (const problem of result.problems) logError(`  - ${problem}`);
    logError(`  Required: Node >=${SUPPORTED_NODE_VERSION} <${EXPECTED_NODE_MAJOR + 1} and npm ${EXPECTED_NPM_VERSION} exactly.`);
  }
  return result;
}

function main() {
  const result = enforceRuntime();
  if (!result.ok) {
    process.exitCode = 1;
    return;
  }
  console.log(`[check-runtime] OK: Node ${process.version}, npm ${result.npmVersion}.`);
}

module.exports = {
  EXPECTED_NODE_MAJOR,
  EXPECTED_NPM_VERSION,
  getNodeMajor,
  resolveNpmVersion,
  evaluateRuntime,
  enforceRuntime,
};

if (require.main === module) {
  main();
}
