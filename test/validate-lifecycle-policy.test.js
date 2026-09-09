'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  FORBIDDEN_WORKSPACE_HOOKS,
  validateLifecyclePolicy
} = require('../validate-lifecycle-policy');

function makePackage(t, packageJson, files = []) {
  const packageDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-lifecycle-policy-')
  );
  t.after(() => fs.rmSync(packageDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify(packageJson)}\n`
  );
  for (const file of files) {
    fs.writeFileSync(path.join(packageDir, file), '');
  }
  return packageDir;
}

function configuration({
  allowConfig = {},
  excessPolicies = [],
  missingPolicies = [],
  somePoliciesAreMissing = false
} = {}) {
  return async () => ({
    configs: {
      lifecycle: { allowConfig, excessPolicies, missingPolicies }
    },
    somePoliciesAreMissing
  });
}

test('accepts a complete policy and inactive denials', async t => {
  const packageDir = makePackage(t, {
    name: 'fixture',
    lavamoat: {
      allowScripts: {
        denied: false,
        'approved#1.0.0': true
      }
    }
  });

  const result = await validateLifecyclePolicy(
    packageDir,
    configuration({
      allowConfig: { denied: false, 'approved#1.0.0': true },
      excessPolicies: ['denied']
    })
  );

  assert.equal(result, 'fixture');
});

test('rejects every workspace hook that allow-scripts may run implicitly', async t => {
  for (const hook of FORBIDDEN_WORKSPACE_HOOKS) {
    await t.test(hook, async childTest => {
      const packageDir = makePackage(childTest, {
        name: `fixture-${hook}`,
        scripts: { [hook]: 'exit 1' }
      });
      await assert.rejects(
        validateLifecyclePolicy(packageDir, configuration()),
        new RegExp(`forbidden workspace lifecycle hooks: ${hook}`)
      );
    });
  }
});

test('rejects an implicit node-gyp install hook', async t => {
  const packageDir = makePackage(t, { name: 'fixture' }, ['binding.gyp']);
  await assert.rejects(
    validateLifecyclePolicy(packageDir, configuration()),
    /binding\.gyp, which implies an install hook/
  );
});

test('rejects missing policy entries', async t => {
  const packageDir = makePackage(t, { name: 'fixture' });
  await assert.rejects(
    validateLifecyclePolicy(
      packageDir,
      configuration({
        missingPolicies: ['dependency#1.0.0'],
        somePoliciesAreMissing: true
      })
    ),
    /lifecycle policy is missing entries/
  );
});

test('rejects inactive, unversioned, and non-boolean approvals', async t => {
  const inactiveDir = makePackage(t, {
    name: 'inactive',
    lavamoat: { allowScripts: { 'dependency#1.0.0': true } }
  });
  await assert.rejects(
    validateLifecyclePolicy(
      inactiveDir,
      configuration({
        allowConfig: { 'dependency#1.0.0': true },
        excessPolicies: ['dependency#1.0.0']
      })
    ),
    /inactive approvals/
  );

  const unversionedDir = makePackage(t, {
    name: 'unversioned',
    lavamoat: { allowScripts: { dependency: true } }
  });
  await assert.rejects(
    validateLifecyclePolicy(unversionedDir, configuration()),
    /approval for dependency is not versioned/
  );

  const invalidDir = makePackage(t, {
    name: 'invalid',
    lavamoat: { allowScripts: { dependency: 'yes' } }
  });
  await assert.rejects(
    validateLifecyclePolicy(invalidDir, configuration()),
    /decision for dependency is not boolean/
  );
});
