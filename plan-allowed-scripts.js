#!/usr/bin/env node

'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */

// Build a fail-closed lifecycle-script plan for one workspace package. In a
// Lerna child, this writes one structured artifact for the root coordinator.
//
// THIS SCRIPT NEVER RUNS LIFECYCLE SCRIPTS ITSELF.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadAllPackageConfigurations } = require('@lavamoat/allow-scripts');

const ARTIFACT_SCHEMA_VERSION = 1;
const PLAN_DIRECTORY_ENV = 'BITCORE_LIFECYCLE_PLAN_DIR';

const IMPLICIT_TOP_LEVEL_EVENTS = [
  'install',
  'postinstall',
  'prepublish',
  'prepare'
];

function readPackageJson(packageDir) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function artifactNameForPackage(packageName) {
  return `${crypto.createHash('sha256').update(packageName).digest('hex')}.json`;
}

function validatePackageIdentity(packageName, packageDir) {
  if (typeof packageName !== 'string' || packageName.length === 0) {
    throw new Error(`${packageDir} does not define a non-empty package name.`);
  }

  const lernaPackageName = process.env.LERNA_PACKAGE_NAME;
  if (process.env[PLAN_DIRECTORY_ENV] && !lernaPackageName) {
    throw new Error(
      'LERNA_PACKAGE_NAME is required when writing a plan artifact.'
    );
  }
  if (lernaPackageName && lernaPackageName !== packageName) {
    throw new Error(
      `Lerna package identity mismatch: expected ${packageName}, received ` +
      `${lernaPackageName}.`
    );
  }

  const lernaRootPath = process.env.LERNA_ROOT_PATH;
  if (process.env[PLAN_DIRECTORY_ENV] && !lernaRootPath) {
    throw new Error('LERNA_ROOT_PATH is required when writing a plan artifact.');
  }
  if (lernaRootPath) {
    const rootDir = fs.realpathSync(lernaRootPath);
    const relativePackageDir = path.relative(rootDir, packageDir);
    if (
      relativePackageDir === '' ||
      relativePackageDir === '..' ||
      relativePackageDir.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePackageDir)
    ) {
      throw new Error(`${packageName} is not contained by LERNA_ROOT_PATH.`);
    }
  }
}

function validatePolicyDecisions(packageName, packageJson) {
  const allowConfig = packageJson.lavamoat?.allowScripts || {};
  for (const [pattern, decision] of Object.entries(allowConfig)) {
    if (typeof decision !== 'boolean') {
      throw new Error(
        `${packageName}'s policy decision for ${pattern} must be boolean.`
      );
    }
    if (decision && !pattern.includes('#')) {
      throw new Error(
        `${packageName}'s approval for ${pattern} must include a version.`
      );
    }
  }
}

function hasInvalidPackageEntries(packagesWithScripts) {
  for (const [pattern, packages] of packagesWithScripts) {
    if (typeof pattern !== 'string' || !Array.isArray(packages) ||
      packages.some(packageEntry =>
        !packageEntry || typeof packageEntry !== 'object' ||
        typeof packageEntry.path !== 'string'
      )) {
      return true;
    }
  }
  return false;
}

function validateConfigurationResult(packageName, result) {
  const lifecycle = result?.configs?.lifecycle;
  const stringArrayFields = [
    'allowedPatterns',
    'excessPolicies',
    'missingPolicies'
  ];
  if (!result || typeof result !== 'object' ||
    typeof result.somePoliciesAreMissing !== 'boolean' ||
    !(result.canonicalNamesByPath instanceof Map) ||
    !lifecycle || typeof lifecycle !== 'object' ||
    !lifecycle.allowConfig || typeof lifecycle.allowConfig !== 'object' ||
    Array.isArray(lifecycle.allowConfig) ||
    !(lifecycle.packagesWithScripts instanceof Map) ||
    hasInvalidPackageEntries(lifecycle.packagesWithScripts) ||
    stringArrayFields.some(field =>
      !Array.isArray(lifecycle[field]) ||
      lifecycle[field].some(value => typeof value !== 'string')
    ) ||
    Array.from(result.canonicalNamesByPath.keys()).some(
      dependencyPath => typeof dependencyPath !== 'string'
    )) {
    throw new Error(
      `${packageName} received an unsupported ` +
      'loadAllPackageConfigurations result shape.'
    );
  }
  return {
    canonicalNamesByPath: result.canonicalNamesByPath,
    lifecycle,
    somePoliciesAreMissing: result.somePoliciesAreMissing
  };
}

function writeArtifact(planDirectory, artifact) {
  const realPlanDirectory = fs.realpathSync(planDirectory);
  const artifactPath = path.join(
    realPlanDirectory,
    artifactNameForPackage(artifact.packageName)
  );
  const temporaryPath = path.join(
    realPlanDirectory,
    `.${artifactNameForPackage(artifact.packageName)}.` +
    `${process.pid}.${crypto.randomBytes(16).toString('hex')}.tmp`
  );
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(artifact)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600
    });
    fs.linkSync(temporaryPath, artifactPath);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    if (error.code === 'EEXIST') {
      const duplicateError = new Error(
        `${artifact.packageName} already has a lifecycle plan artifact.`
      );
      duplicateError.code = error.code;
      throw duplicateError;
    }
    throw error;
  }
  fs.unlinkSync(temporaryPath);
}

async function buildArtifact(
  packageDirArgument,
  configurationLoader = loadAllPackageConfigurations
) {
  const packageDir = fs.realpathSync(packageDirArgument);
  const packageJson = readPackageJson(packageDir);
  const packageName = packageJson.name;
  validatePackageIdentity(packageName, packageDir);
  validatePolicyDecisions(packageName, packageJson);

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

  let configurationResult;
  try {
    configurationResult = await configurationLoader({ rootDir: packageDir });
  } catch (error) {
    throw new Error(
      `${packageName} could not load its lifecycle configuration: ` +
      error.message
    );
  }
  const {
    canonicalNamesByPath,
    lifecycle,
    somePoliciesAreMissing
  } = validateConfigurationResult(packageName, configurationResult);

  const inactiveApprovedPatterns = lifecycle.excessPolicies.filter(
    pattern => lifecycle.allowConfig[pattern] === true
  );
  const inactiveDeniedPatterns = lifecycle.excessPolicies.filter(
    pattern => lifecycle.allowConfig[pattern] === false
  );
  if (
    somePoliciesAreMissing ||
    lifecycle.missingPolicies.length > 0 ||
    inactiveApprovedPatterns.length > 0
  ) {
    throw new Error(
      `${packageName}'s lifecycle policy changed after validation.`
    );
  }

  if (inactiveDeniedPatterns.length > 0) {
    console.warn(
      `WARN: ${packageName} has inactive denied lifecycle policies that ` +
      'are not installed on this platform.'
    );
  }

  const approvedPaths = new Set();
  const dependencyTreePaths = new Set(
    Array.from(canonicalNamesByPath.keys(), dependencyPath =>
      fs.realpathSync(dependencyPath)
    )
  );
  for (const pattern of lifecycle.allowedPatterns) {
    const matchingPackages = lifecycle.packagesWithScripts.get(pattern);
    if (!matchingPackages || matchingPackages.length === 0) {
      throw new Error(
        `${packageName} allows ${pattern}, but no installed package matches it.`
      );
    }

    for (const packageWithScripts of matchingPackages) {
      if (!packageWithScripts || typeof packageWithScripts.path !== 'string') {
        throw new Error(
          `${packageName} received an unsupported ` +
          'loadAllPackageConfigurations package entry.'
        );
      }
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
      if (!dependencyTreePaths.has(approvedPath)) {
        throw new Error(
          `${packageName} resolved an approved dependency outside its ` +
          `expected dependency tree: ${approvedPath}.`
        );
      }
      approvedPaths.add(approvedPath);
    }
  }

  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    status: 'validated',
    packageName,
    packageDir,
    approvedPaths: Array.from(approvedPaths)
  };
}

async function main() {
  const packageDirArgument = process.argv[2];
  if (!packageDirArgument) {
    throw new Error('A package directory is required.');
  }

  const artifact = await buildArtifact(packageDirArgument);
  const planDirectory = process.env[PLAN_DIRECTORY_ENV];
  if (planDirectory) {
    writeArtifact(planDirectory, artifact);
    console.log(`PASS: ${artifact.packageName}`);
    return;
  }

}

if (require.main === module) {
  main().catch(error => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildArtifact,
  validateConfigurationResult,
  writeArtifact
};
