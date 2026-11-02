'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { evaluateRuntime, enforceRuntime } = require('../../scripts/workspaces/check-runtime.cjs');

test('accepts the exact supported Node 24 / npm 10.9.2 pair', () => {
  const result = evaluateRuntime({ nodeVersion: 'v24.22.1', npmVersion: '10.9.2' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
});

test('rejects Node 20', () => {
  const result = evaluateRuntime({ nodeVersion: 'v20.11.0', npmVersion: '10.9.2' });
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /Expected Node 24\.x, observed v20\.11\.0/);
});

test('rejects Node 25', () => {
  const result = evaluateRuntime({ nodeVersion: 'v25.0.0', npmVersion: '10.9.2' });
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /Expected Node 24\.x, observed v25\.0\.0/);
});

test('rejects Node 22', () => {
  const result = evaluateRuntime({ nodeVersion: 'v22.16.0', npmVersion: '10.9.2' });
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /Expected Node 24\.x, observed v22\.16\.0/);
});

test('rejects Node 24 releases below the upstream minimum', () => {
  for (const nodeVersion of ['v24.0.0', 'v24.21.9', 'v24.22.0']) {
    const result = evaluateRuntime({ nodeVersion, npmVersion: '10.9.2' });
    assert.equal(result.ok, false, nodeVersion);
    assert.match(result.problems.join('\n'), /Expected Node >=24\.22\.1/);
  }
});

test('accepts later stable Node 24 releases', () => {
  for (const nodeVersion of ['v24.22.2', 'v24.23.0']) {
    const result = evaluateRuntime({ nodeVersion, npmVersion: '10.9.2' });
    assert.equal(result.ok, true, nodeVersion);
  }
});

test('rejects a mismatched npm version on Node 24', () => {
  const result = evaluateRuntime({ nodeVersion: 'v24.22.1', npmVersion: '10.8.0' });
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /Expected npm 10\.9\.2 exactly, observed 10\.8\.0/);
});

test('rejects a missing/unidentified npm version', () => {
  const result = evaluateRuntime({ nodeVersion: 'v24.22.1', npmVersion: null });
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /Unable to determine an installed npm version/);
});

test('rejects an unparseable Node version string', () => {
  const result = evaluateRuntime({ nodeVersion: 'not-a-version', npmVersion: '10.9.2' });
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /Unable to parse Node version/);
});

test('enforceRuntime resolves npm from the user agent, reports problems, and does not set an exit code', () => {
  const errors = [];
  const result = enforceRuntime({
    env: { npm_config_user_agent: 'npm/0.0.0 node/v24.22.1 darwin arm64' },
    nodeVersion: 'v24.22.1',
    spawn: () => assert.fail('must not shell out when a user agent is present'),
    logError: (line) => errors.push(line),
  });
  assert.equal(result.ok, false);
  assert.match(errors.join('\n'), /Unsupported toolchain/);
  assert.match(errors.join('\n'), /observed 0\.0\.0/);
});

test('enforceRuntime falls back to `npm --version` and is silent when supported', () => {
  const errors = [];
  const result = enforceRuntime({
    env: {},
    nodeVersion: 'v24.22.1',
    spawn: () => ({ status: 0, stdout: '10.9.2\n' }),
    logError: (line) => errors.push(line),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(errors, []);
});
