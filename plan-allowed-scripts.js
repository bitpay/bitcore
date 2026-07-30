#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadAllPackageConfigurations } = require('@lavamoat/allow-scripts');

const IMPLICIT_TOP_LEVEL_EVENTS = [
  'install',
  'postinstall',
  'prepublish',
  'prepare'
];

async function main() {
  const packageDirArgument = process.argv[2];
  if (!packageDirArgument) {
    throw new Error('A package directory is required.');
  }

  const packageDir = fs.realpathSync(packageDirArgument);
  const packageJsonPath = path.join(packageDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const packageName = packageJson.name || packageDir;
  const scripts = packageJson.scripts || {};
  const implicitTopLevelEvents = IMPLICIT_TOP_LEVEL_EVENTS.filter(
    event => typeof scripts[event] === 'string' && scripts[event].trim() !== ''
  );

  if (implicitTopLevelEvents.length > 0) {
    throw new Error(
      `${packageName} defines top-level lifecycle hooks that ` +
      'allow-scripts run would execute outside lavamoat.allowScripts: ' +
      implicitTopLevelEvents.join(', ')
    );
  }

  if (fs.existsSync(path.join(packageDir, 'binding.gyp'))) {
    throw new Error(
      `${packageName} contains binding.gyp, which would cause ` +
      'allow-scripts run to synthesize an unconfigured install hook.'
    );
  }

  const {
    configs: { lifecycle },
    somePoliciesAreMissing
  } = await loadAllPackageConfigurations({ rootDir: packageDir });

  if (
    somePoliciesAreMissing ||
    lifecycle.missingPolicies.length > 0 ||
    lifecycle.excessPolicies.length > 0
  ) {
    throw new Error(
      `${packageName}'s lifecycle policy changed after validation.`
    );
  }

  for (const [pattern, decision] of Object.entries(lifecycle.allowConfig)) {
    if (typeof decision !== 'boolean') {
      throw new Error(
        `${packageName}'s policy decision for ${pattern} must be boolean.`
      );
    }
  }

  const approvedPaths = new Set();
  for (const pattern of lifecycle.allowedPatterns) {
    const matchingPackages = lifecycle.packagesWithScripts.get(pattern);
    if (!matchingPackages || matchingPackages.length === 0) {
      throw new Error(
        `${packageName} allows ${pattern}, but no installed package matches it.`
      );
    }

    for (const packageWithScripts of matchingPackages) {
      const approvedPath = fs.realpathSync(packageWithScripts.path);
      if (approvedPath.includes('\n')) {
        throw new Error(
          `${packageName} has an approved dependency path containing a newline.`
        );
      }
      if (approvedPaths.has(approvedPath)) {
        throw new Error(
          `${packageName} resolves multiple approvals to ${approvedPath}.`
        );
      }
      approvedPaths.add(approvedPath);
    }
  }

  for (const approvedPath of approvedPaths) {
    process.stdout.write(`${approvedPath}\n`);
  }
}

main().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
