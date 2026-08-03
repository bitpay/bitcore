#!/usr/bin/env node

'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */

// Establish the closed Lerna package inventory and validate the complete set
// of per-package lifecycle-plan artifacts. This script never runs lifecycle
// scripts or invokes commands in package directories.

const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ARTIFACT_SCHEMA_VERSION = 1;
const INVENTORY_SCHEMA_VERSION = 1;

function isContainedBy(rootDir, candidate) {
  const relative = path.relative(rootDir, candidate);
  return relative !== '' && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function artifactNameForPackage(packageName) {
  return `${crypto.createHash('sha256').update(packageName).digest('hex')}.json`;
}

function parseDiscoveryOutput(rootDirArgument, output) {
  const rootDir = fs.realpathSync(rootDirArgument);
  let discovered;
  try {
    discovered = JSON.parse(output);
  } catch (error) {
    throw new Error(`Lerna discovery output is not valid JSON: ${error.message}`);
  }

  if (!Array.isArray(discovered) || discovered.length === 0) {
    throw new Error('Lerna discovery output must be a non-empty JSON array.');
  }

  const names = new Set();
  const locations = new Set();
  const packages = discovered.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
      typeof entry.name !== 'string' || entry.name.length === 0 ||
      typeof entry.location !== 'string' || entry.location.length === 0) {
      throw new Error(
        `Lerna discovery entry ${index} must contain non-empty name and location fields.`
      );
    }
    if (entry.name.includes('\n') || entry.location.includes('\n')) {
      throw new Error(`Lerna discovery entry ${index} contains a newline.`);
    }

    let location;
    try {
      location = fs.realpathSync(path.resolve(rootDir, entry.location));
    } catch (error) {
      throw new Error(
        `Lerna package ${entry.name} has an invalid location: ${error.message}`
      );
    }
    if (!isContainedBy(rootDir, location)) {
      throw new Error(
        `Lerna package ${entry.name} is outside the repository: ${location}`
      );
    }
    if (names.has(entry.name)) {
      throw new Error(`Lerna discovery contains duplicate package name ${entry.name}.`);
    }
    if (locations.has(location)) {
      throw new Error(
        `Lerna discovery contains duplicate package location ${location}.`
      );
    }
    names.add(entry.name);
    locations.add(location);
    return { name: entry.name, location };
  });

  const insightLocation = path.join(rootDir, 'packages', 'insight');
  if (packages.some(packageEntry => packageEntry.location === insightLocation)) {
    throw new Error('Lerna discovery unexpectedly included excluded packages/insight.');
  }

  return { schemaVersion: INVENTORY_SCHEMA_VERSION, packages };
}

function discoverPackages(rootDir, lernaExecutable) {
  const result = spawnSync(
    lernaExecutable,
    ['list', '--all', '--json', '--loglevel', 'silent'],
    { cwd: rootDir, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  if (result.error) {
    throw new Error(`Unable to run Lerna discovery: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `Lerna discovery failed with status ${result.status}: ${result.stderr.trim()}`
    );
  }
  return parseDiscoveryOutput(rootDir, result.stdout);
}

function readInventory(inventoryPath) {
  let inventory;
  try {
    inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  } catch (error) {
    throw new Error(`Managed-package inventory is invalid: ${error.message}`);
  }
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory) ||
    inventory.schemaVersion !== INVENTORY_SCHEMA_VERSION ||
    !Array.isArray(inventory.packages) || inventory.packages.length === 0) {
    throw new Error('Managed-package inventory has an unsupported shape.');
  }
  return inventory;
}

function validateArtifact(artifact, expectedPackage) {
  const expectedKeys = [
    'approvedPaths',
    'packageDir',
    'packageName',
    'schemaVersion',
    'status'
  ];
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact) ||
    Object.keys(artifact).sort().join('\0') !== expectedKeys.join('\0') ||
    artifact.schemaVersion !== ARTIFACT_SCHEMA_VERSION ||
    artifact.status !== 'validated' || !Array.isArray(artifact.approvedPaths)) {
    throw new Error(`Lifecycle plan for ${expectedPackage.name} is malformed.`);
  }
  if (artifact.packageName !== expectedPackage.name) {
    throw new Error(
      `Lifecycle plan package-name mismatch: expected ${expectedPackage.name}, ` +
      `received ${String(artifact.packageName)}.`
    );
  }
  if (artifact.packageDir !== expectedPackage.location) {
    throw new Error(
      `Lifecycle plan package-location mismatch for ${expectedPackage.name}: ` +
      `expected ${expectedPackage.location}, received ${String(artifact.packageDir)}.`
    );
  }

  const seenPaths = new Set();
  for (const approvedPath of artifact.approvedPaths) {
    let canonicalPath;
    try {
      canonicalPath = typeof approvedPath === 'string' && approvedPath.length > 0 &&
        path.isAbsolute(approvedPath) && !approvedPath.includes('\n')
        ? fs.realpathSync(approvedPath)
        : null;
    } catch {
      canonicalPath = null;
    }
    if (canonicalPath !== approvedPath) {
      throw new Error(
        `Lifecycle plan for ${expectedPackage.name} contains a non-canonical path.`
      );
    }
    if (seenPaths.has(approvedPath)) {
      throw new Error(
        `Lifecycle plan for ${expectedPackage.name} contains a duplicate approved path.`
      );
    }
    seenPaths.add(approvedPath);
  }
}

function validateArtifactSet(inventory, planDirectoryArgument) {
  const planDirectory = fs.realpathSync(planDirectoryArgument);
  const expectedByFilename = new Map();
  for (const packageEntry of inventory.packages) {
    expectedByFilename.set(artifactNameForPackage(packageEntry.name), packageEntry);
  }

  const files = fs.readdirSync(planDirectory);
  const seenPackageNames = new Set();
  const artifacts = new Map();
  for (const filename of files) {
    const artifactPath = path.join(planDirectory, filename);
    const stat = fs.lstatSync(artifactPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Unexpected lifecycle plan artifact ${filename}.`);
    }

    let artifact;
    try {
      artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    } catch (error) {
      throw new Error(`Lifecycle plan artifact ${filename} is malformed: ${error.message}`);
    }
    if (artifact && typeof artifact.packageName === 'string') {
      if (seenPackageNames.has(artifact.packageName)) {
        throw new Error(`Duplicate lifecycle plan artifacts for ${artifact.packageName}.`);
      }
      seenPackageNames.add(artifact.packageName);
    }

    const expectedPackage = expectedByFilename.get(filename);
    if (!expectedPackage) {
      throw new Error(`Unexpected lifecycle plan artifact ${filename}.`);
    }
    validateArtifact(artifact, expectedPackage);
    artifacts.set(expectedPackage.name, artifact);
  }

  for (const expectedPackage of inventory.packages) {
    if (!artifacts.has(expectedPackage.name)) {
      throw new Error(`Missing lifecycle plan artifact for ${expectedPackage.name}.`);
    }
  }
  return inventory.packages.map(packageEntry => artifacts.get(packageEntry.name));
}

function setsOverlap(left, right) {
  const rightPaths = new Set(right);
  return left.some(approvedPath => rightPaths.has(approvedPath));
}

function buildGlobalPlan(inventory, artifacts) {
  if (artifacts.length !== inventory.packages.length ||
    artifacts.some((artifact, index) =>
      artifact.packageName !== inventory.packages[index].name ||
      artifact.packageDir !== inventory.packages[index].location
    )) {
    throw new Error('Artifact collection does not match the package inventory.');
  }
  const groupsByKey = new Map();
  const packagePlans = artifacts.map(artifact => ({
    name: artifact.packageName,
    location: artifact.packageDir,
    approvedPaths: [...artifact.approvedPaths].sort(),
    selected: false
  }));

  for (const packagePlan of packagePlans) {
    if (packagePlan.approvedPaths.length === 0) {
      continue;
    }
    const key = JSON.stringify(packagePlan.approvedPaths);
    let group = groupsByKey.get(key);
    if (!group) {
      group = {
        approvedPaths: packagePlan.approvedPaths,
        packageNames: [],
        representative: {
          name: packagePlan.name,
          location: packagePlan.location
        }
      };
      groupsByKey.set(key, group);
      packagePlan.selected = true;
    }
    group.packageNames.push(packagePlan.name);
  }

  const groups = Array.from(groupsByKey.values());
  for (let leftIndex = 0; leftIndex < groups.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < groups.length;
      rightIndex += 1) {
      const left = groups[leftIndex];
      const right = groups[rightIndex];
      if (setsOverlap(left.approvedPaths, right.approvedPaths)) {
        throw new Error(
          `${right.representative.name} has a partial overlap with ` +
          `${left.representative.name}'s approved paths.`
        );
      }
    }
  }

  const selectedPackages = packagePlans
    .filter(packagePlan => packagePlan.selected)
    .map(packagePlan => ({
      name: packagePlan.name,
      location: packagePlan.location
    }));
  validateGlobalPlan(packagePlans, groups, selectedPackages);
  return {
    schemaVersion: 1,
    packages: packagePlans,
    groups,
    selectedPackages
  };
}

function validateGlobalPlan(packagePlans, groups, selectedPackages) {
  const selectedNames = new Set(
    selectedPackages.map(packageEntry => packageEntry.name)
  );
  if (selectedNames.size !== selectedPackages.length) {
    throw new Error('The global lifecycle plan selects a package more than once.');
  }

  const pathOwners = new Map();
  const representativeNames = new Set();
  for (const group of groups) {
    if (group.approvedPaths.length === 0 || group.packageNames.length === 0 ||
      !group.packageNames.includes(group.representative.name) ||
      !selectedNames.has(group.representative.name)) {
      throw new Error('The global lifecycle plan contains an invalid group.');
    }
    if (representativeNames.has(group.representative.name)) {
      throw new Error('A package represents multiple lifecycle groups.');
    }
    representativeNames.add(group.representative.name);
    for (const approvedPath of group.approvedPaths) {
      if (pathOwners.has(approvedPath)) {
        throw new Error(
          `Approved path ${approvedPath} belongs to multiple lifecycle groups.`
        );
      }
      pathOwners.set(approvedPath, group.representative.name);
    }
  }
  if (representativeNames.size !== selectedNames.size ||
    Array.from(selectedNames).some(name => !representativeNames.has(name))) {
    throw new Error(
      'The selected packages do not match the lifecycle group representatives.'
    );
  }
  for (const selectedPackage of selectedPackages) {
    const packagePlan = packagePlans.find(
      candidate => candidate.name === selectedPackage.name
    );
    const group = groups.find(
      candidate => candidate.representative.name === selectedPackage.name
    );
    if (!packagePlan || !group || !packagePlan.selected ||
      packagePlan.approvedPaths.length === 0 ||
      packagePlan.location !== selectedPackage.location ||
      group.representative.location !== selectedPackage.location) {
      throw new Error(
        `Selected package ${selectedPackage.name} has an invalid identity.`
      );
    }
  }

  for (const packagePlan of packagePlans) {
    if (packagePlan.selected !== selectedNames.has(packagePlan.name) ||
      (packagePlan.approvedPaths.length === 0 && packagePlan.selected)) {
      throw new Error(
        `The global lifecycle plan has an invalid selection for ${packagePlan.name}.`
      );
    }
    if (packagePlan.approvedPaths.some(
      approvedPath => !pathOwners.has(approvedPath)
    )) {
      throw new Error(
        `The global lifecycle plan omitted an approved path for ${packagePlan.name}.`
      );
    }
    if (packagePlan.approvedPaths.length > 0) {
      const matchingGroups = groups.filter(group =>
        group.approvedPaths.length === packagePlan.approvedPaths.length &&
        group.approvedPaths.every(
          (approvedPath, index) => approvedPath === packagePlan.approvedPaths[index]
        ) && group.packageNames.includes(packagePlan.name)
      );
      if (matchingGroups.length !== 1) {
        throw new Error(
          `${packagePlan.name} does not belong to exactly one lifecycle group.`
        );
      }
    }
  }
}

function readGlobalPlan(globalPlanPath) {
  const globalPlan = JSON.parse(fs.readFileSync(globalPlanPath, 'utf8'));
  if (!globalPlan || typeof globalPlan !== 'object' ||
    globalPlan.schemaVersion !== 1 || !Array.isArray(globalPlan.packages) ||
    !Array.isArray(globalPlan.groups) ||
    !Array.isArray(globalPlan.selectedPackages)) {
    throw new Error('The global lifecycle plan artifact is malformed.');
  }
  return globalPlan;
}

function exactScopePattern(packageName) {
  return packageName.replace(/([*?[\]{}()!+@\\])/g, '\\$1');
}

function buildExecutionArgs(selectedPackages) {
  if (selectedPackages.length === 0) {
    return null;
  }
  const args = ['exec', '--concurrency', '1', '--stream'];
  for (const packageEntry of selectedPackages) {
    args.push('--scope', exactScopePattern(packageEntry.name));
  }
  args.push('--', 'node', '"$BITCORE_LIFECYCLE_RUN_WRAPPER"');
  return args;
}

async function executeGlobalPlan(
  globalPlan,
  rootDir,
  lernaExecutable,
  executionWrapper
) {
  const args = buildExecutionArgs(globalPlan.selectedPackages);
  if (!args) {
    console.log('No approved dependency lifecycle scripts were required.');
    return 0;
  }

  const child = spawn(lernaExecutable, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      BITCORE_LIFECYCLE_RUN_WRAPPER: executionWrapper
    },
    stdio: 'inherit'
  });
  let requestedSignal;
  const signalHandlers = new Map();
  for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
    const handler = () => {
      if (!requestedSignal) {
        requestedSignal = signal;
        child.kill(signal);
      }
    };
    signalHandlers.set(signal, handler);
    process.on(signal, handler);
  }

  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  for (const [signal, handler] of signalHandlers) {
    process.off(signal, handler);
  }
  if (requestedSignal) {
    return { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 }[requestedSignal];
  }
  if (result.signal) {
    return { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 }[result.signal] || 1;
  }
  return result.code ?? 1;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'discover' && args.length === 2) {
    process.stdout.write(`${JSON.stringify(discoverPackages(args[0], args[1]))}\n`);
    return;
  }
  if (command === 'count' && args.length === 1) {
    process.stdout.write(`${readInventory(args[0]).packages.length}\n`);
    return;
  }
  if (command === 'global-plan' && args.length === 2) {
    const inventory = readInventory(args[0]);
    const artifacts = validateArtifactSet(inventory, args[1]);
    process.stdout.write(`${JSON.stringify(buildGlobalPlan(inventory, artifacts))}\n`);
    return;
  }
  if (command === 'report' && args.length === 1) {
    const globalPlan = readGlobalPlan(args[0]);
    for (const packagePlan of globalPlan.packages) {
      if (packagePlan.approvedPaths.length === 0) {
        console.log(
          `SKIP: ${packagePlan.name} has no approved dependency lifecycle scripts.\n`
        );
      } else if (packagePlan.selected) {
        console.log(
          `PLAN: Run approved dependency lifecycle scripts for ${packagePlan.name}.\n`
        );
      } else {
        console.log(
          `SKIP: ${packagePlan.name}'s approved dependency scripts are already planned.\n`
        );
      }
    }
    return;
  }
  if (command === 'execute' && args.length === 4) {
    const globalPlan = readGlobalPlan(args[0]);
    const status = await executeGlobalPlan(
      globalPlan,
      args[1],
      args[2],
      args[3]
    );
    process.exitCode = status;
    return;
  }
  throw new Error(
    'Usage: lifecycle-plan-coordinator.js ' +
    'discover ROOT LERNA | count INVENTORY | ' +
    'global-plan INVENTORY PLAN_DIR | report GLOBAL_PLAN | ' +
    'execute GLOBAL_PLAN ROOT LERNA WRAPPER'
  );
}

if (require.main === module) {
  main().catch(error => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  artifactNameForPackage,
  buildExecutionArgs,
  buildGlobalPlan,
  exactScopePattern,
  executeGlobalPlan,
  parseDiscoveryOutput,
  validateArtifactSet,
  validateGlobalPlan
};
