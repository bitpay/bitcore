'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');
const {
  loadAllPackageConfigurations
} = require('@lavamoat/allow-scripts');
const {
  artifactNameForPackage,
  buildExecutionArgs,
  buildGlobalPlan,
  exactScopePattern,
  parseDiscoveryOutput,
  validateArtifactSet,
  validateGlobalPlan
} = require('../lifecycle-plan-coordinator');
const {
  buildArtifact,
  validateConfigurationResult,
  writeArtifact
} = require('../plan-allowed-scripts');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const LERNA_CLI = path.join(REPOSITORY_ROOT, 'node_modules', 'lerna', 'cli.js');
const temporaryDirectories = new Set();
const fixtureProcesses = new Set();

afterEach(() => {
  for (const pid of fixtureProcesses) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error;
      }
    }
  }
  fixtureProcesses.clear();
  for (const temporaryDirectory of temporaryDirectories) {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  }
  temporaryDirectories.clear();
});

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, { mode: 0o755 });
  fs.chmodSync(filePath, 0o755);
}

function createFixture(packageDefinitions) {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-allowed-scripts-test-')
  );
  temporaryDirectories.add(rootDir);

  const binDir = path.join(rootDir, 'node_modules', '.bin');
  const packagesDir = path.join(rootDir, 'packages');
  const runnerPath = path.join(rootDir, 'validate-and-run-allowed-scripts.sh');
  const plannerPath = path.join(rootDir, 'plan-allowed-scripts.js');
  const coordinatorPath = path.join(rootDir, 'lifecycle-plan-coordinator.js');
  const executionWrapperPath = path.join(rootDir, 'run-allowed-scripts.js');
  const logPath = path.join(rootDir, 'allow-scripts.log');
  const lernaLogPath = path.join(rootDir, 'lerna.log');
  const readyPath = path.join(rootDir, 'lerna-ready');
  const lifecycleReadyPath = path.join(rootDir, 'lifecycle-ready.json');
  const descendantReadyPath = path.join(rootDir, 'descendant-ready');
  const signalLogPath = path.join(rootDir, 'signals.log');

  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(packagesDir, { recursive: true });
  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    `${JSON.stringify({ name: 'allowed-scripts-fixture', private: true })}\n`
  );
  fs.writeFileSync(
    path.join(rootDir, 'lerna.json'),
    `${JSON.stringify({
      version: '1.0.0',
      packages: ['packages/[^insight]*']
    }, null, 2)}\n`
  );
  fs.copyFileSync(
    path.join(REPOSITORY_ROOT, 'validate-and-run-allowed-scripts.sh'),
    runnerPath
  );
  fs.chmodSync(runnerPath, 0o755);
  fs.copyFileSync(
    path.join(REPOSITORY_ROOT, 'lifecycle-plan-coordinator.js'),
    coordinatorPath
  );
  fs.copyFileSync(
    path.join(REPOSITORY_ROOT, 'run-allowed-scripts.js'),
    executionWrapperPath
  );

  for (const packageDefinition of packageDefinitions) {
    const packageDir = path.join(packagesDir, packageDefinition.directory);
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      `${JSON.stringify({
        version: '1.0.0',
        ...packageDefinition.packageJson
      }, null, 2)}\n`
    );
  }

  writeExecutable(
    path.join(binDir, 'lerna'),
    `#!/bin/sh
if [ -n "\${BITCORE_TEST_LERNA_LOG:-}" ]; then
  printf '%s\n' "$*" >> "$BITCORE_TEST_LERNA_LOG"
fi
if [ -n "\${BITCORE_TEST_READY_FILE:-}" ]; then
  : > "$BITCORE_TEST_READY_FILE"
fi
if [ -n "\${BITCORE_TEST_LERNA_DELAY:-}" ]; then
  sleep "$BITCORE_TEST_LERNA_DELAY"
fi
exec node "$BITCORE_TEST_REAL_LERNA" "$@"
`
  );

  writeExecutable(
    path.join(binDir, 'allow-scripts'),
    `#!/bin/sh
command_name=$1
package_name=$(basename "$PWD")
printf '%s\\t%s\\n' "$command_name" "$package_name" >> "$BITCORE_TEST_LOG"
if [ "$#" -gt 1 ]; then
  printf '%s\\t%s\\targs:%s\\n' "$command_name" "$package_name" "$*" >> "$BITCORE_TEST_LOG"
fi

if [ "$command_name" = "check" ] && [ "\${BITCORE_TEST_FAIL_CHECK:-}" = "$package_name" ]; then
  exit 1
fi

if [ "$command_name" = "run" ] && [ "\${BITCORE_TEST_FAIL_RUN:-}" = "$package_name" ]; then
  exit 23
fi

if [ "$command_name" = "run" ] && [ "\${BITCORE_TEST_SIGNAL_RUN:-}" = "$package_name" ]; then
  exec node "$BITCORE_TEST_SIGNAL_PROBE"
fi

if [ "$command_name" = "list" ]; then
  echo "mock lifecycle inventory for $package_name"
fi
`
  );

  fs.writeFileSync(
    path.join(rootDir, 'signal-probe.js'),
    `'use strict';
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const descendant = spawn(
  process.execPath,
  [process.env.BITCORE_TEST_DESCENDANT_PROBE],
  { env: process.env, stdio: 'ignore' }
);
for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    fs.appendFileSync(process.env.BITCORE_TEST_SIGNAL_LOG, 'parent:' + signal + '\\n');
    process.exit(0);
  });
}
fs.writeFileSync(
  process.env.BITCORE_TEST_LIFECYCLE_READY,
  JSON.stringify({ parentPid: process.pid, descendantPid: descendant.pid })
);
setInterval(() => {}, 1000);
`
  );
  fs.writeFileSync(
    path.join(rootDir, 'descendant-probe.js'),
    `'use strict';
const fs = require('node:fs');
for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    fs.appendFileSync(
      process.env.BITCORE_TEST_SIGNAL_LOG,
      'descendant:' + signal + '\\n'
    );
    process.exit(0);
  });
}
fs.writeFileSync(process.env.BITCORE_TEST_DESCENDANT_READY, 'ready\\n');
setInterval(() => {}, 1000);
`
  );

  fs.writeFileSync(
    plannerPath,
    `'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const packageDir = fs.realpathSync(process.argv[2]);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
);
const packageName = packageJson.name;
const implicitEvents = ['install', 'postinstall', 'prepublish', 'prepare']
  .filter(event => {
    const script = packageJson.scripts?.[event];
    return typeof script === 'string' && script.trim() !== '';
  });

if (implicitEvents.length > 0) {
  console.error(
    \`ERROR: implicit top-level lifecycle hooks: \${implicitEvents.join(', ')}\`
  );
  process.exit(1);
}

if (process.env.BITCORE_TEST_FAIL_PLAN === path.basename(packageDir)) {
  console.error('ERROR: simulated policy validation failure');
  process.exit(1);
}

const artifact = {
  schemaVersion: 1,
  status: 'validated',
  packageName,
  packageDir,
  approvedPaths: (packageJson.testApprovedPaths || []).map(
    approvedPath => fs.realpathSync(approvedPath)
  )
};
const artifactName = crypto.createHash('sha256')
  .update(packageName)
  .digest('hex') + '.json';
if (process.env.BITCORE_TEST_SKIP_ARTIFACT !== path.basename(packageDir)) {
  fs.writeFileSync(
    path.join(process.env.BITCORE_LIFECYCLE_PLAN_DIR, artifactName),
    JSON.stringify(
      process.env.BITCORE_TEST_MALFORMED_ARTIFACT === path.basename(packageDir)
        ? {}
        : artifact
    ) + '\\n',
    { flag: 'wx' }
  );
}
console.log('PASS: ' + packageName);
`
  );

  return {
    env: {
      ...process.env,
      BITCORE_TEST_LOG: logPath,
      BITCORE_TEST_LERNA_LOG: lernaLogPath,
      BITCORE_TEST_SIGNAL_PROBE: path.join(rootDir, 'signal-probe.js'),
      BITCORE_TEST_DESCENDANT_PROBE: path.join(rootDir, 'descendant-probe.js'),
      BITCORE_TEST_LIFECYCLE_READY: lifecycleReadyPath,
      BITCORE_TEST_DESCENDANT_READY: descendantReadyPath,
      BITCORE_TEST_SIGNAL_LOG: signalLogPath,
      BITCORE_TEST_REAL_LERNA: LERNA_CLI
    },
    logPath,
    lernaLogPath,
    lifecycleReadyPath,
    descendantReadyPath,
    signalLogPath,
    readyPath,
    rootDir,
    runnerPath
  };
}

function runFixture(fixture, additionalEnv = {}, args = []) {
  return spawnSync('/bin/sh', [fixture.runnerPath, ...args], {
    cwd: fixture.rootDir,
    encoding: 'utf8',
    env: { ...fixture.env, ...additionalEnv }
  });
}

function readLog(logPath) {
  if (!fs.existsSync(logPath)) {
    return [];
  }
  return fs.readFileSync(logPath, 'utf8').trim().split('\n');
}

async function waitForFile(filePath) {
  const deadline = Date.now() + 5000;
  while (!fs.existsSync(filePath)) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${filePath}`);
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

async function waitForProcessExit(pid) {
  const deadline = Date.now() + 5000;
  while (true) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === 'ESRCH') {
        return;
      }
      throw error;
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for process ${pid} to exit`);
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

function createArtifactCollectionFixture() {
  const rootDir = fs.realpathSync(fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-artifact-collection-')
  ));
  temporaryDirectories.add(rootDir);
  const packageDir = path.join(rootDir, 'packages', 'package-a');
  const planDir = path.join(rootDir, 'plans');
  fs.mkdirSync(packageDir, { recursive: true });
  fs.mkdirSync(planDir);
  const packageEntry = { name: '@scope/package-a', location: packageDir };
  const inventory = { schemaVersion: 1, packages: [packageEntry] };
  const artifact = {
    schemaVersion: 1,
    status: 'validated',
    packageName: packageEntry.name,
    packageDir,
    approvedPaths: []
  };
  const artifactPath = path.join(
    planDir,
    artifactNameForPackage(packageEntry.name)
  );
  return { artifact, artifactPath, inventory, packageDir, planDir, rootDir };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value)}\n`);
}

test('structured discovery normalizes a closed managed-package inventory', () => {
  const fixture = createArtifactCollectionFixture();
  const secondPackageDir = path.join(fixture.rootDir, 'packages', 'package-b');
  fs.mkdirSync(secondPackageDir);

  const inventory = parseDiscoveryOutput(fixture.rootDir, JSON.stringify([
    { name: '@scope/package-a', location: fixture.packageDir },
    { name: '@scope/package-b', location: secondPackageDir }
  ]));

  assert.deepEqual(inventory, {
    schemaVersion: 1,
    packages: [
      { name: '@scope/package-a', location: fixture.packageDir },
      { name: '@scope/package-b', location: secondPackageDir }
    ]
  });
});

test('structured discovery fails closed on malformed or incomplete output', () => {
  const fixture = createArtifactCollectionFixture();
  assert.throws(
    () => parseDiscoveryOutput(fixture.rootDir, 'not json'),
    /not valid JSON/
  );
  assert.throws(
    () => parseDiscoveryOutput(fixture.rootDir, '[]'),
    /non-empty JSON array/
  );
  assert.throws(
    () => parseDiscoveryOutput(
      fixture.rootDir,
      JSON.stringify([{ name: '@scope/package-a' }])
    ),
    /non-empty name and location fields/
  );
});

test('structured discovery rejects duplicate names and locations', () => {
  const fixture = createArtifactCollectionFixture();
  const secondPackageDir = path.join(fixture.rootDir, 'packages', 'package-b');
  fs.mkdirSync(secondPackageDir);
  assert.throws(
    () => parseDiscoveryOutput(fixture.rootDir, JSON.stringify([
      { name: '@scope/package-a', location: fixture.packageDir },
      { name: '@scope/package-a', location: secondPackageDir }
    ])),
    /duplicate package name/
  );
  assert.throws(
    () => parseDiscoveryOutput(fixture.rootDir, JSON.stringify([
      { name: '@scope/package-a', location: fixture.packageDir },
      { name: '@scope/package-b', location: fixture.packageDir }
    ])),
    /duplicate package location/
  );
});

test('structured discovery rejects packages outside the repository and insight', () => {
  const fixture = createArtifactCollectionFixture();
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitcore-outside-'));
  temporaryDirectories.add(outsideDir);
  assert.throws(
    () => parseDiscoveryOutput(fixture.rootDir, JSON.stringify([
      { name: '@scope/outside', location: outsideDir }
    ])),
    /outside the repository/
  );

  const insightDir = path.join(fixture.rootDir, 'packages', 'insight');
  fs.mkdirSync(insightDir);
  assert.throws(
    () => parseDiscoveryOutput(fixture.rootDir, JSON.stringify([
      { name: '@scope/insight', location: insightDir }
    ])),
    /excluded packages\/insight/
  );
});

test('artifact collection accepts exactly one matching artifact per package', () => {
  const fixture = createArtifactCollectionFixture();
  writeJson(fixture.artifactPath, fixture.artifact);
  assert.deepEqual(
    validateArtifactSet(fixture.inventory, fixture.planDir),
    [fixture.artifact]
  );
});

test('artifact collection rejects missing, unexpected, and duplicate artifacts', () => {
  const fixture = createArtifactCollectionFixture();
  assert.throws(
    () => validateArtifactSet(fixture.inventory, fixture.planDir),
    /Missing lifecycle plan artifact/
  );

  writeJson(path.join(fixture.planDir, 'unexpected.json'), {
    ...fixture.artifact,
    packageName: '@scope/unexpected'
  });
  assert.throws(
    () => validateArtifactSet(fixture.inventory, fixture.planDir),
    /Unexpected lifecycle plan artifact/
  );

  fs.rmSync(path.join(fixture.planDir, 'unexpected.json'));
  writeJson(fixture.artifactPath, fixture.artifact);
  writeJson(path.join(fixture.planDir, 'duplicate.json'), fixture.artifact);
  assert.throws(
    () => validateArtifactSet(fixture.inventory, fixture.planDir),
    /Duplicate lifecycle plan artifacts/
  );
});

test('artifact collection rejects schema, status, and identity mismatches', () => {
  for (const [change, pattern] of [
    [{ schemaVersion: 2 }, /malformed/],
    [{ status: 'failed' }, /malformed/],
    [{ packageName: '@scope/wrong' }, /package-name mismatch/],
    [{ packageDir: '/wrong/location' }, /package-location mismatch/]
  ]) {
    const fixture = createArtifactCollectionFixture();
    writeJson(fixture.artifactPath, { ...fixture.artifact, ...change });
    assert.throws(
      () => validateArtifactSet(fixture.inventory, fixture.planDir),
      pattern
    );
  }
});

test('artifact collection rejects malformed JSON and duplicate approved paths', () => {
  const malformedFixture = createArtifactCollectionFixture();
  fs.writeFileSync(malformedFixture.artifactPath, '{');
  assert.throws(
    () => validateArtifactSet(malformedFixture.inventory, malformedFixture.planDir),
    /is malformed/
  );

  const duplicateFixture = createArtifactCollectionFixture();
  writeJson(duplicateFixture.artifactPath, {
    ...duplicateFixture.artifact,
    approvedPaths: [duplicateFixture.packageDir, duplicateFixture.packageDir]
  });
  assert.throws(
    () => validateArtifactSet(duplicateFixture.inventory, duplicateFixture.planDir),
    /duplicate approved path/
  );

  const nonCanonicalFixture = createArtifactCollectionFixture();
  writeJson(nonCanonicalFixture.artifactPath, {
    ...nonCanonicalFixture.artifact,
    approvedPaths: [
      `${nonCanonicalFixture.packageDir}/../` +
      path.basename(nonCanonicalFixture.packageDir)
    ]
  });
  assert.throws(
    () => validateArtifactSet(
      nonCanonicalFixture.inventory,
      nonCanonicalFixture.planDir
    ),
    /non-canonical path/
  );
});

test('global planning groups identical sets and keeps disjoint sets separate', () => {
  const fixture = createArtifactCollectionFixture();
  const sharedPath = path.join(fixture.rootDir, 'shared-dependency');
  const secondSharedPath = path.join(fixture.rootDir, 'second-shared-dependency');
  const disjointPath = path.join(fixture.rootDir, 'disjoint-dependency');
  const packages = ['package-a', 'package-b', 'package-c', 'package-empty']
    .map(name => ({
      name,
      location: path.join(fixture.rootDir, 'packages', name)
    }));
  const inventory = { schemaVersion: 1, packages };
  const artifacts = [
    {
      packageName: 'package-a',
      packageDir: packages[0].location,
      approvedPaths: [sharedPath, secondSharedPath]
    },
    {
      packageName: 'package-b',
      packageDir: packages[1].location,
      approvedPaths: [secondSharedPath, sharedPath]
    },
    {
      packageName: 'package-c',
      packageDir: packages[2].location,
      approvedPaths: [disjointPath]
    },
    {
      packageName: 'package-empty',
      packageDir: packages[3].location,
      approvedPaths: []
    }
  ];

  const globalPlan = buildGlobalPlan(inventory, artifacts);
  assert.deepEqual(
    globalPlan.selectedPackages.map(packageEntry => packageEntry.name),
    ['package-a', 'package-c']
  );
  assert.equal(globalPlan.groups.length, 2);
  assert.deepEqual(globalPlan.groups[0].packageNames, [
    'package-a',
    'package-b'
  ]);
  assert.equal(globalPlan.groups[0].representative.name, 'package-a');
  assert.equal(
    globalPlan.packages.find(packagePlan => packagePlan.name === 'package-empty')
      .selected,
    false
  );
});

test('global planning rejects partial overlaps before selection can execute', () => {
  const fixture = createArtifactCollectionFixture();
  const packages = ['package-a', 'package-b'].map(name => ({
    name,
    location: path.join(fixture.rootDir, 'packages', name)
  }));
  const inventory = { schemaVersion: 1, packages };
  assert.throws(
    () => buildGlobalPlan(inventory, [
      {
        packageName: 'package-a',
        packageDir: packages[0].location,
        approvedPaths: ['/dependency/one', '/dependency/shared']
      },
      {
        packageName: 'package-b',
        packageDir: packages[1].location,
        approvedPaths: ['/dependency/shared', '/dependency/two']
      }
    ]),
    /package-b has a partial overlap with package-a/
  );
});

test('global-plan acceptance rejects invalid selected-package state', () => {
  assert.throws(
    () => validateGlobalPlan(
      [{
        name: 'package-empty',
        location: '/packages/package-empty',
        approvedPaths: [],
        selected: true
      }],
      [],
      [{ name: 'package-empty', location: '/packages/package-empty' }]
    ),
    /selected packages do not match|invalid selection/
  );
});

test('execution scopes are separate exact argv values with empty-set safety', () => {
  const packageNames = ['@scope/package-a', '@scope/package-[literal]'];
  const args = buildExecutionArgs(
    packageNames.map(name => ({ name, location: `/packages/${name}` }))
  );
  assert.deepEqual(args, [
    'exec',
    '--concurrency',
    '1',
    '--stream',
    '--scope',
    exactScopePattern(packageNames[0]),
    '--scope',
    exactScopePattern(packageNames[1]),
    '--',
    'node',
    '"$BITCORE_LIFECYCLE_RUN_WRAPPER"'
  ]);
  assert.equal(buildExecutionArgs([]), null);
});

test('planner validates the installed allow-scripts configuration shape', async () => {
  const fixture = createArtifactCollectionFixture();
  writeJson(path.join(fixture.packageDir, 'package.json'), {
    name: '@scope/package-a'
  });
  const result = await loadAllPackageConfigurations({
    rootDir: fixture.packageDir
  });

  const validated = validateConfigurationResult('@scope/package-a', result);
  assert.equal(typeof validated.somePoliciesAreMissing, 'boolean');
  assert.ok(validated.canonicalNamesByPath instanceof Map);
  assert.ok(validated.lifecycle.packagesWithScripts instanceof Map);
  for (const field of [
    'allowedPatterns',
    'excessPolicies',
    'missingPolicies'
  ]) {
    assert.ok(Array.isArray(validated.lifecycle[field]));
  }
});

test('planner fails clearly when the allow-scripts result shape changes', () => {
  for (const result of [
    null,
    {},
    { configs: { lifecycle: {} }, somePoliciesAreMissing: false },
    {
      canonicalNamesByPath: new Map(),
      configs: {
        lifecycle: {
          allowConfig: {},
          allowedPatterns: [],
          excessPolicies: [],
          missingPolicies: [],
          packagesWithScripts: []
        }
      },
      somePoliciesAreMissing: false
    }
  ]) {
    assert.throws(
      () => validateConfigurationResult('@scope/package-a', result),
      /unsupported loadAllPackageConfigurations result shape/
    );
  }
});

test('planner adds package identity to configuration loading failures', async () => {
  const fixture = createArtifactCollectionFixture();
  writeJson(path.join(fixture.packageDir, 'package.json'), {
    name: '@scope/package-a'
  });
  await assert.rejects(
    () => buildArtifact(fixture.packageDir, async () => {
      throw new Error('simulated loader failure');
    }),
    /@scope\/package-a could not load.*simulated loader failure/
  );
});

test('planner rejects approved paths outside the expected dependency tree', async () => {
  const fixture = createArtifactCollectionFixture();
  const outsideDir = fs.realpathSync(fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-approved-outside-')
  ));
  temporaryDirectories.add(outsideDir);
  writeJson(path.join(fixture.packageDir, 'package.json'), {
    name: '@scope/package-a',
    lavamoat: { allowScripts: { 'unsafe#1.0.0': true } }
  });

  await assert.rejects(
    () => buildArtifact(fixture.packageDir, async () => ({
      canonicalNamesByPath: new Map(),
      configs: {
        lifecycle: {
          allowConfig: { 'unsafe#1.0.0': true },
          allowedPatterns: ['unsafe#1.0.0'],
          excessPolicies: [],
          missingPolicies: [],
          packagesWithScripts: new Map([
            ['unsafe#1.0.0', [{ path: outsideDir }]]
          ])
        }
      },
      somePoliciesAreMissing: false
    })),
    /outside its expected dependency tree/
  );
});

test('planner rejects duplicate physical paths within one package plan', async () => {
  const fixture = createArtifactCollectionFixture();
  const dependencyDir = path.join(fixture.packageDir, 'node_modules', 'unsafe');
  fs.mkdirSync(dependencyDir, { recursive: true });
  writeJson(path.join(fixture.packageDir, 'package.json'), {
    name: '@scope/package-a',
    lavamoat: {
      allowScripts: {
        'first#1.0.0': true,
        'second#1.0.0': true
      }
    }
  });
  const packageEntry = { path: dependencyDir };

  await assert.rejects(
    () => buildArtifact(fixture.packageDir, async () => ({
      canonicalNamesByPath: new Map([[dependencyDir, 'unsafe']]),
      configs: {
        lifecycle: {
          allowConfig: {
            'first#1.0.0': true,
            'second#1.0.0': true
          },
          allowedPatterns: ['first#1.0.0', 'second#1.0.0'],
          excessPolicies: [],
          missingPolicies: [],
          packagesWithScripts: new Map([
            ['first#1.0.0', [packageEntry]],
            ['second#1.0.0', [packageEntry]]
          ])
        }
      },
      somePoliciesAreMissing: false
    })),
    /resolves multiple approvals/
  );
});

test('planner publishes artifacts atomically and exclusively', () => {
  const fixture = createArtifactCollectionFixture();
  writeArtifact(fixture.planDir, fixture.artifact);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(fixture.artifactPath, 'utf8')),
    fixture.artifact
  );
  assert.deepEqual(fs.readdirSync(fixture.planDir), [
    path.basename(fixture.artifactPath)
  ]);
  assert.throws(
    () => writeArtifact(fixture.planDir, fixture.artifact),
    error => error.code === 'EEXIST'
  );
  assert.deepEqual(fs.readdirSync(fixture.planDir), [
    path.basename(fixture.artifactPath)
  ]);
});

test('production planner rejects implicit workspace lifecycle hooks', () => {
  const packageDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-planner-package-')
  );
  temporaryDirectories.add(packageDir);
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify({
      name: 'package-with-prepare',
      scripts: {
        prepare: 'echo unexpected'
      }
    }, null, 2)}\n`
  );

  const result = spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, 'plan-allowed-scripts.js'), packageDir],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /top-level lifecycle hooks.*outside lavamoat\.allowScripts: prepare/
  );
});

test('production planner rejects an implicit node-gyp install hook', () => {
  const packageDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-planner-package-')
  );
  temporaryDirectories.add(packageDir);
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify({ name: 'package-with-binding-gyp' }, null, 2)}\n`
  );
  fs.writeFileSync(path.join(packageDir, 'binding.gyp'), '{}\n');

  const result = spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, 'plan-allowed-scripts.js'), packageDir],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /binding\.gyp.*unconfigured install hook/);
});

test('production planner accepts an inactive denied policy', () => {
  const packageDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-planner-package-')
  );
  temporaryDirectories.add(packageDir);
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify({
      name: 'package-with-inactive-denial',
      lavamoat: {
        allowScripts: {
          fsevents: false
        }
      }
    }, null, 2)}\n`
  );

  const result = spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, 'plan-allowed-scripts.js'), packageDir],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(
    result.stderr,
    /inactive denied lifecycle policies.*not installed on this platform/
  );
});

test('production planner accepts an active versionless denial', () => {
  const packageDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-planner-package-')
  );
  temporaryDirectories.add(packageDir);
  const dependencyDir = path.join(packageDir, 'node_modules', 'unsafe');
  fs.mkdirSync(dependencyDir, { recursive: true });
  writeJson(path.join(packageDir, 'package.json'), {
    name: 'package-with-active-denial',
    dependencies: { unsafe: '1.0.0' },
    lavamoat: { allowScripts: { unsafe: false } }
  });
  writeJson(path.join(dependencyDir, 'package.json'), {
    name: 'unsafe',
    version: '1.0.0',
    scripts: { postinstall: 'echo denied' }
  });

  const result = spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, 'plan-allowed-scripts.js'), packageDir],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});

test('production planner rejects an inactive approved policy', () => {
  const packageDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-planner-package-')
  );
  temporaryDirectories.add(packageDir);
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify({
      name: 'package-with-inactive-approval',
      lavamoat: {
        allowScripts: {
          'fsevents#1.2.11': true
        }
      }
    }, null, 2)}\n`
  );

  const result = spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, 'plan-allowed-scripts.js'), packageDir],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /lifecycle policy changed after validation/);
});

test('production planner rejects non-boolean policy decisions', () => {
  const packageDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-planner-package-')
  );
  temporaryDirectories.add(packageDir);
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify({
      name: 'package-with-non-boolean-policy',
      lavamoat: {
        allowScripts: {
          fsevents: 'false'
        }
      }
    }, null, 2)}\n`
  );

  const result = spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, 'plan-allowed-scripts.js'), packageDir],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /decision for fsevents must be boolean/);
});

test('production planner rejects versionless approvals', () => {
  const packageDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-planner-package-')
  );
  temporaryDirectories.add(packageDir);
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify({
      name: 'package-with-versionless-approval',
      lavamoat: {
        allowScripts: {
          unsafe: true
        }
      }
    }, null, 2)}\n`
  );

  const result = spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, 'plan-allowed-scripts.js'), packageDir],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /approval for unsafe must include a version/);
});

test('production planner rejects a mismatched version approval', () => {
  const packageDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-planner-package-')
  );
  temporaryDirectories.add(packageDir);
  const dependencyDir = path.join(packageDir, 'node_modules', 'unsafe');
  fs.mkdirSync(dependencyDir, { recursive: true });
  writeJson(path.join(packageDir, 'package.json'), {
    name: 'package-with-mismatched-approval',
    dependencies: { unsafe: '1.0.0' },
    lavamoat: { allowScripts: { 'unsafe#2.0.0': true } }
  });
  writeJson(path.join(dependencyDir, 'package.json'), {
    name: 'unsafe',
    version: '1.0.0',
    scripts: { postinstall: 'echo unsafe' }
  });

  const result = spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, 'plan-allowed-scripts.js'), packageDir],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /lifecycle policy changed after validation/);
});

test('production planner rejects a mismatched Lerna package identity', () => {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-planner-root-')
  );
  temporaryDirectories.add(rootDir);
  const packageDir = path.join(rootDir, 'packages', 'package-a');
  const planDir = path.join(rootDir, 'plans');
  fs.mkdirSync(packageDir, { recursive: true });
  fs.mkdirSync(planDir);
  writeJson(path.join(packageDir, 'package.json'), {
    name: '@scope/package-a'
  });

  const result = spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, 'plan-allowed-scripts.js'), '.'],
    {
      cwd: packageDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        BITCORE_LIFECYCLE_PLAN_DIR: planDir,
        LERNA_PACKAGE_NAME: '@scope/wrong-package',
        LERNA_ROOT_PATH: rootDir
      }
    }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Lerna package identity mismatch/);
  assert.deepEqual(fs.readdirSync(planDir), []);
});

test('production planner rejects missing policy decisions', () => {
  const packageDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-planner-package-')
  );
  temporaryDirectories.add(packageDir);
  const dependencyDir = path.join(packageDir, 'node_modules', 'unsafe');
  fs.mkdirSync(dependencyDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify({
      name: 'package-with-missing-policy',
      dependencies: {
        unsafe: '1.0.0'
      }
    }, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(dependencyDir, 'package.json'),
    `${JSON.stringify({
      name: 'unsafe',
      version: '1.0.0',
      scripts: {
        postinstall: 'echo unsafe'
      }
    }, null, 2)}\n`
  );

  const result = spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, 'plan-allowed-scripts.js'), packageDir],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /lifecycle policy changed after validation/);
});

test('production planner writes one safe structured artifact for an empty plan', () => {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-planner-root-')
  );
  temporaryDirectories.add(rootDir);
  const packageDir = path.join(rootDir, 'packages', 'package-a');
  const planDir = path.join(rootDir, 'plans');
  fs.mkdirSync(packageDir, { recursive: true });
  fs.mkdirSync(planDir);
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify({
      name: '@scope/package-a',
      lavamoat: {
        allowScripts: {
          fsevents: false
        }
      }
    }, null, 2)}\n`
  );

  const result = spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, 'plan-allowed-scripts.js'), '.'],
    {
      cwd: packageDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        BITCORE_LIFECYCLE_PLAN_DIR: planDir,
        LERNA_PACKAGE_NAME: '@scope/package-a',
        LERNA_ROOT_PATH: rootDir
      }
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const artifactName = `${crypto.createHash('sha256')
    .update('@scope/package-a')
    .digest('hex')}.json`;
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(planDir, artifactName), 'utf8')),
    {
      schemaVersion: 1,
      status: 'validated',
      packageName: '@scope/package-a',
      packageDir: fs.realpathSync(packageDir),
      approvedPaths: []
    }
  );
});

test('production planner writes real approved dependency paths', () => {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-planner-root-')
  );
  temporaryDirectories.add(rootDir);
  const packageDir = path.join(rootDir, 'packages', 'package-a');
  const dependencyDir = path.join(packageDir, 'node_modules', 'unsafe');
  const planDir = path.join(rootDir, 'plans');
  fs.mkdirSync(dependencyDir, { recursive: true });
  fs.mkdirSync(planDir);
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify({
      name: '@scope/package-a',
      dependencies: {
        unsafe: '1.0.0'
      },
      lavamoat: {
        allowScripts: {
          'unsafe#1.0.0': true
        }
      }
    }, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(dependencyDir, 'package.json'),
    `${JSON.stringify({
      name: 'unsafe',
      version: '1.0.0',
      scripts: {
        postinstall: 'echo approved'
      }
    }, null, 2)}\n`
  );

  const result = spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, 'plan-allowed-scripts.js'), '.'],
    {
      cwd: packageDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        BITCORE_LIFECYCLE_PLAN_DIR: planDir,
        LERNA_PACKAGE_NAME: '@scope/package-a',
        LERNA_ROOT_PATH: rootDir
      }
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const [artifactFile] = fs.readdirSync(planDir);
  const artifact = JSON.parse(
    fs.readFileSync(path.join(planDir, artifactFile), 'utf8')
  );
  assert.deepEqual(artifact.approvedPaths, [fs.realpathSync(dependencyDir)]);
});

test('accepts inactive denied policies on the current platform', () => {
  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        testApprovedPaths: []
      }
    }
  ]);

  const result = runFixture(fixture, {
    BITCORE_TEST_FAIL_CHECK: 'package-a'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readLog(fixture.logPath), []);
  assert.equal(
    readLog(fixture.lernaLogPath).filter(line =>
      line.includes('run-allowed-scripts.js')
    ).length,
    0
  );
  assert.match(result.stdout, /No approved dependency lifecycle scripts were required/);
});

test('does not execute when the authoritative planner rejects a package', () => {
  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        scripts: {
          prepare: 'echo unsafe implicit execution'
        },
        testApprovedPaths: []
      }
    }
  ]);

  const result = runFixture(fixture);

  assert.equal(result.status, 1);
  assert.deepEqual(readLog(fixture.logPath), []);
  assert.match(result.stderr, /implicit top-level lifecycle hooks: prepare/);
  assert.match(result.stdout, /policy validation or lifecycle planning failed/);
  assert.match(result.stdout, /Approved lifecycle scripts were not executed/);
});

test('planner failures do not prevent later packages from being validated', () => {
  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        scripts: {
          prepare: 'echo unsafe implicit execution'
        },
        testApprovedPaths: []
      }
    },
    {
      directory: 'package-b',
      packageJson: {
        name: 'package-b',
        testApprovedPaths: []
      }
    }
  ]);

  const result = runFixture(fixture);

  assert.equal(result.status, 1);
  assert.deepEqual(readLog(fixture.logPath), []);
  assert.match(result.stderr, /implicit top-level lifecycle hooks: prepare/);
  assert.match(result.stdout, /package-b: PASS: package-b/);
  assert.match(result.stdout, /Approved lifecycle scripts were not executed/);
});

test('multiple validation failures prevent execution and all are reported', () => {
  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        scripts: {
          prepare: 'echo unsafe implicit execution'
        },
        testApprovedPaths: []
      }
    },
    {
      directory: 'package-b',
      packageJson: {
        name: 'package-b',
        scripts: {
          postinstall: 'echo also unsafe'
        },
        testApprovedPaths: []
      }
    },
    {
      directory: 'package-c',
      packageJson: {
        name: 'package-c',
        testApprovedPaths: []
      }
    }
  ]);

  const result = runFixture(fixture);

  assert.equal(result.status, 1);
  assert.deepEqual(readLog(fixture.logPath), []);
  assert.match(result.stderr, /implicit top-level lifecycle hooks: prepare/);
  assert.match(result.stderr, /implicit top-level lifecycle hooks: postinstall/);
  assert.match(result.stdout, /package-c: PASS: package-c/);
  assert.match(result.stdout, /policy validation or lifecycle planning failed/);
  assert.match(result.stdout, /Approved lifecycle scripts were not executed/);
});

test('check-only mode validates the complete plan without execution', () => {
  const approvedDependency = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-approved-dependency-')
  );
  temporaryDirectories.add(approvedDependency);

  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        testApprovedPaths: [approvedDependency]
      }
    }
  ]);

  const result = runFixture(fixture, {}, ['--check-only']);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readLog(fixture.logPath), []);
  assert.match(result.stdout, /execution plan passed validation/);
  assert.match(result.stdout, /lifecycle scripts were not executed/);
});

test('does not execute when a package artifact is missing', () => {
  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        testApprovedPaths: []
      }
    }
  ]);

  const result = runFixture(fixture, {
    BITCORE_TEST_SKIP_ARTIFACT: 'package-a'
  });

  assert.equal(result.status, 1);
  assert.deepEqual(readLog(fixture.logPath), []);
  assert.match(result.stderr, /Missing lifecycle plan artifact/);
  assert.match(result.stdout, /global lifecycle execution plan is incomplete/);
  assert.match(result.stdout, /Approved lifecycle scripts were not executed/);
});

test('does not execute when a package artifact is malformed', () => {
  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        testApprovedPaths: []
      }
    }
  ]);

  const result = runFixture(fixture, {
    BITCORE_TEST_MALFORMED_ARTIFACT: 'package-a'
  });

  assert.equal(result.status, 1);
  assert.deepEqual(readLog(fixture.logPath), []);
  assert.match(result.stderr, /Lifecycle plan.*malformed/);
  assert.match(result.stdout, /global lifecycle execution plan is incomplete/);
  assert.match(result.stdout, /Approved lifecycle scripts were not executed/);
});

test('executes a shared physical approved path only once', () => {
  const sharedDependency = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-shared-dependency-')
  );
  temporaryDirectories.add(sharedDependency);

  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        testApprovedPaths: [sharedDependency]
      }
    },
    {
      directory: 'package-b',
      packageJson: {
        name: 'package-b',
        testApprovedPaths: [sharedDependency]
      }
    }
  ]);

  const result = runFixture(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readLog(fixture.logPath), [
    'run\tpackage-a'
  ]);
  assert.match(
    result.stdout,
    /SKIP: package-b's approved dependency scripts are already planned\./
  );
  // 11.3 #18: verify allow-scripts run was invoked without --skip-versions
  const logLines = readLog(fixture.logPath);
  for (const line of logLines) {
    assert.ok(
      !line.includes('--skip-versions'),
      'allow-scripts run must not receive --skip-versions'
    );
  }
});

test('allow-scripts run is invoked without --skip-versions or npx', () => {
  const approvedDependency = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-approved-dependency-')
  );
  temporaryDirectories.add(approvedDependency);

  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        testApprovedPaths: [approvedDependency]
      }
    }
  ]);

  const result = runFixture(fixture);

  assert.equal(result.status, 0, result.stderr);
  const logLines = readLog(fixture.logPath);
  assert.equal(logLines.length, 1);
  assert.equal(logLines[0], 'run\tpackage-a',
    'allow-scripts run must have no extra arguments (no --skip-versions)');
  // 11.3 #17: the runner uses the root-pinned allow-scripts binary, not npx
  assert.ok(
    !result.stdout.includes('npx') && !result.stderr.includes('npx'),
    'production must not use npx'
  );
});

test('rejects partial approved-path overlaps before execution', () => {
  const sharedDependency = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-shared-dependency-')
  );
  const uniqueDependency = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-unique-dependency-')
  );
  temporaryDirectories.add(sharedDependency);
  temporaryDirectories.add(uniqueDependency);

  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        testApprovedPaths: [sharedDependency]
      }
    },
    {
      directory: 'package-b',
      packageJson: {
        name: 'package-b',
        testApprovedPaths: [sharedDependency, uniqueDependency]
      }
    }
  ]);

  const result = runFixture(fixture);

  assert.equal(result.status, 1);
  assert.deepEqual(readLog(fixture.logPath), []);
  assert.match(result.stderr, /package-b has a partial overlap/);
  assert.match(result.stdout, /Approved lifecycle scripts were not executed/);
});

test('rejects implicit workspace lifecycle hooks before execution', () => {
  const approvedDependency = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-approved-dependency-')
  );
  temporaryDirectories.add(approvedDependency);

  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        scripts: {
          prepare: 'echo unsafe implicit execution'
        },
        testApprovedPaths: [approvedDependency]
      }
    }
  ]);

  const result = runFixture(fixture);

  assert.equal(result.status, 1);
  assert.deepEqual(readLog(fixture.logPath), []);
  assert.match(result.stderr, /implicit top-level lifecycle hooks: prepare/);
  assert.match(result.stdout, /Approved lifecycle scripts were not executed/);
});

test('preserves an approved lifecycle execution failure status', () => {
  const approvedDependency = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-approved-dependency-')
  );
  temporaryDirectories.add(approvedDependency);

  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        testApprovedPaths: [approvedDependency]
      }
    }
  ]);

  const result = runFixture(fixture, {
    BITCORE_TEST_FAIL_RUN: 'package-a'
  });

  assert.equal(result.status, 23);
  assert.deepEqual(readLog(fixture.logPath), ['run\tpackage-a']);
  assert.match(result.stdout, /Exit status: 23/);
});

test('selected-package execution is serial and fail-fast', () => {
  const firstDependency = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-first-dependency-')
  );
  const secondDependency = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-second-dependency-')
  );
  temporaryDirectories.add(firstDependency);
  temporaryDirectories.add(secondDependency);
  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        testApprovedPaths: [firstDependency]
      }
    },
    {
      directory: 'package-b',
      packageJson: {
        name: 'package-b',
        testApprovedPaths: [secondDependency]
      }
    }
  ]);

  const result = runFixture(fixture, {
    BITCORE_TEST_FAIL_RUN: 'package-a'
  });

  assert.equal(result.status, 23);
  assert.deepEqual(readLog(fixture.logPath), ['run\tpackage-a']);
});

for (const [signal, expectedStatus] of [
  ['SIGHUP', 129],
  ['SIGINT', 130],
  ['SIGTERM', 143]
]) {
  test(`${signal} terminates the active lifecycle process tree`, async () => {
    const firstDependency = fs.mkdtempSync(
      path.join(os.tmpdir(), 'bitcore-first-dependency-')
    );
    const secondDependency = fs.mkdtempSync(
      path.join(os.tmpdir(), 'bitcore-second-dependency-')
    );
    temporaryDirectories.add(firstDependency);
    temporaryDirectories.add(secondDependency);
    const fixture = createFixture([
      {
        directory: 'package-a',
        packageJson: {
          name: 'package-a',
          testApprovedPaths: [firstDependency]
        }
      },
      {
        directory: 'package-b',
        packageJson: {
          name: 'package-b',
          testApprovedPaths: [secondDependency]
        }
      }
    ]);
    const child = spawn('/bin/sh', [fixture.runnerPath], {
      cwd: fixture.rootDir,
      env: {
        ...fixture.env,
        BITCORE_TEST_SIGNAL_RUN: 'package-a'
      },
      stdio: 'ignore'
    });
    fixtureProcesses.add(child.pid);

    await waitForFile(fixture.lifecycleReadyPath);
    await waitForFile(fixture.descendantReadyPath);
    const { parentPid, descendantPid } = JSON.parse(
      fs.readFileSync(fixture.lifecycleReadyPath, 'utf8')
    );
    fixtureProcesses.add(parentPid);
    fixtureProcesses.add(descendantPid);

    child.kill(signal);
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, closeSignal) =>
        resolve({ code, signal: closeSignal })
      );
    });
    fixtureProcesses.delete(child.pid);
    await waitForProcessExit(parentPid);
    await waitForProcessExit(descendantPid);
    fixtureProcesses.delete(parentPid);
    fixtureProcesses.delete(descendantPid);

    assert.deepEqual(result, { code: expectedStatus, signal: null });
    // 11.3 #7: shared dependency executes once
    // 11.3 #15: no later package begins after interruption
    assert.deepEqual(readLog(fixture.logPath), ['run\tpackage-a']);
    assert.deepEqual(readLog(fixture.signalLogPath).sort(), [
      'descendant:SIGTERM',
      'parent:SIGTERM'
    ]);
  });
}

test('terminates with the signal status instead of continuing', async () => {
  const fixture = createFixture([
    {
      directory: 'package-a',
      packageJson: {
        name: 'package-a',
        testApprovedPaths: []
      }
    }
  ]);
  const child = spawn('/bin/sh', [fixture.runnerPath], {
    cwd: fixture.rootDir,
    env: {
      ...fixture.env,
      BITCORE_TEST_LERNA_DELAY: '1',
      BITCORE_TEST_READY_FILE: fixture.readyPath
    }
  });
  let stdout = '';
  child.stdout.on('data', chunk => {
    stdout += chunk;
  });

  await waitForFile(fixture.readyPath);
  child.kill('SIGTERM');

  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });

  assert.deepEqual(result, { code: 143, signal: null });
  assert.doesNotMatch(
    stdout,
    /Approved dependency lifecycle scripts completed successfully/
  );
});
