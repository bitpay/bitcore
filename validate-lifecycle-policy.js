#!/usr/bin/env node

'use strict';

/**
 * Validates a package's lifecycle policy compliance:
 * - Rejects forbidden workspace lifecycle hooks (preinstall, install, postinstall, prepublish, prepare)
 * - Rejects packages with binding.gyp (implies an install hook)
 * - Ensures LavaMoat allowScripts approvals are boolean-valued, and that `true` approvals are versioned
 * - Validates that the LavaMoat lifecycle policy has no missing or inactive entries
 */

/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const path = require('node:path');
const { loadAllPackageConfigurations } = require('@lavamoat/allow-scripts');

const FORBIDDEN_WORKSPACE_HOOKS = [
  'preinstall',
  'install',
  'postinstall',
  'prepublish',
  'prepare'
];

async function validateLifecyclePolicy(
  packageDirArgument,
  configurationLoader = loadAllPackageConfigurations
) {
  const packageDir = fs.realpathSync(packageDirArgument);
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
  );
  const packageName = packageJson.name;

  if (!packageName || typeof packageName !== 'string') {
    throw new Error(`${packageDir} has no package name.`);
  }
  if (process.env.LERNA_PACKAGE_NAME &&
    process.env.LERNA_PACKAGE_NAME !== packageName) {
    throw new Error(`Lerna package identity mismatch for ${packageName}.`);
  }

  const scripts = packageJson.scripts || {};
  const forbiddenHooks = FORBIDDEN_WORKSPACE_HOOKS.filter(
    hook => typeof scripts[hook] === 'string' && scripts[hook].trim()
  );
  if (forbiddenHooks.length) {
    throw new Error(
      `${packageName} defines forbidden workspace lifecycle hooks: ` +
      forbiddenHooks.join(', ')
    );
  }
  if (fs.existsSync(path.join(packageDir, 'binding.gyp'))) {
    throw new Error(
      `${packageName} contains binding.gyp, which implies an install hook.`
    );
  }

  const policy = packageJson.lavamoat?.allowScripts || {};
  // Ensure lavamoat.allowScripts values are all boolean, and that all allowedScripts (true) specify a version
  for (const [pattern, decision] of Object.entries(policy)) {
    if (typeof decision !== 'boolean') {
      throw new Error(`${packageName}'s decision for ${pattern} is not boolean.`);
    }
    // allowScripts with value `true` must be versioned
    if (decision && !/#.+$/.test(pattern)) {
      throw new Error(`${packageName}'s approval for ${pattern} is not versioned.`);
    }
  }

  const result = await configurationLoader({ rootDir: packageDir });
  const lifecycle = result?.configs?.lifecycle;
  if (!lifecycle || !Array.isArray(lifecycle.missingPolicies) ||
    !Array.isArray(lifecycle.excessPolicies) ||
    !lifecycle.allowConfig || typeof result.somePoliciesAreMissing !== 'boolean') {
    throw new Error(`${packageName} received an unsupported LavaMoat result.`);
  }

  if (result.somePoliciesAreMissing || lifecycle.missingPolicies.length) {
    throw new Error(`${packageName}'s lifecycle policy is missing entries.`);
  }

  const inactiveApprovals = lifecycle.excessPolicies.filter(
    pattern => lifecycle.allowConfig[pattern] === true
  );
  if (inactiveApprovals.length) {
    throw new Error(
      `${packageName} has inactive approvals: ${inactiveApprovals.join(', ')}`
    );
  }

  return packageName;
}

async function main() {
  const packageName = await validateLifecyclePolicy(process.cwd());
  console.log(`PASS: ${packageName}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  FORBIDDEN_WORKSPACE_HOOKS,
  validateLifecyclePolicy
};
