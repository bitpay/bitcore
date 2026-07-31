'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const temporaryDirectories = new Set();

afterEach(() => {
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
  const packageListPath = path.join(rootDir, 'package-list.txt');
  const logPath = path.join(rootDir, 'allow-scripts.log');
  const readyPath = path.join(rootDir, 'lerna-ready');

  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(packagesDir, { recursive: true });
  fs.copyFileSync(
    path.join(REPOSITORY_ROOT, 'validate-and-run-allowed-scripts.sh'),
    runnerPath
  );
  fs.chmodSync(runnerPath, 0o755);

  const packageDirectories = [];
  for (const packageDefinition of packageDefinitions) {
    const packageDir = path.join(packagesDir, packageDefinition.directory);
    packageDirectories.push(packageDir);
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      `${JSON.stringify(packageDefinition.packageJson, null, 2)}\n`
    );
  }
  fs.writeFileSync(packageListPath, `${packageDirectories.join('\n')}\n`);

  writeExecutable(
    path.join(binDir, 'lerna'),
    `#!/bin/sh
if [ -n "\${BITCORE_TEST_READY_FILE:-}" ]; then
  : > "$BITCORE_TEST_READY_FILE"
fi
if [ -n "\${BITCORE_TEST_LERNA_DELAY:-}" ]; then
  sleep "$BITCORE_TEST_LERNA_DELAY"
fi
cat "$BITCORE_TEST_PACKAGE_LIST"
`
  );

  writeExecutable(
    path.join(binDir, 'allow-scripts'),
    `#!/bin/sh
command_name=$1
package_name=$(basename "$PWD")
printf '%s\\t%s\\n' "$command_name" "$package_name" >> "$BITCORE_TEST_LOG"

if [ "$command_name" = "check" ] && [ "\${BITCORE_TEST_FAIL_CHECK:-}" = "$package_name" ]; then
  exit 1
fi

if [ "$command_name" = "run" ] && [ "\${BITCORE_TEST_FAIL_RUN:-}" = "$package_name" ]; then
  exit 23
fi

if [ "$command_name" = "list" ]; then
  echo "mock lifecycle inventory for $package_name"
fi
`
  );

  fs.writeFileSync(
    plannerPath,
    `'use strict';

const fs = require('node:fs');

const packageDir = process.argv[2];
const packageJson = JSON.parse(
  fs.readFileSync(\`\${packageDir}/package.json\`, 'utf8')
);
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

for (const approvedPath of packageJson.testApprovedPaths || []) {
  process.stdout.write(\`\${fs.realpathSync(approvedPath)}\\n\`);
}
`
  );

  return {
    env: {
      ...process.env,
      BITCORE_TEST_LOG: logPath,
      BITCORE_TEST_PACKAGE_LIST: packageListPath
    },
    logPath,
    readyPath,
    rootDir,
    runnerPath
  };
}

function runFixture(fixture, additionalEnv = {}) {
  return spawnSync('/bin/sh', [fixture.runnerPath], {
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
  assert.deepEqual(readLog(fixture.logPath), ['check\tpackage-a']);
  assert.match(
    result.stdout,
    /inactive denied lifecycle policies.*not installed on this platform/
  );
});

test('does not mask a failed check when the planner rejects the package', () => {
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

  const result = runFixture(fixture, {
    BITCORE_TEST_FAIL_CHECK: 'package-a'
  });

  assert.equal(result.status, 1);
  assert.deepEqual(readLog(fixture.logPath), [
    'check\tpackage-a',
    'list\tpackage-a'
  ]);
  assert.match(result.stderr, /implicit top-level lifecycle hooks: prepare/);
  assert.match(result.stdout, /policy validation failed for 1 package/);
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
    'check\tpackage-a',
    'check\tpackage-b',
    'run\tpackage-a'
  ]);
  assert.match(
    result.stdout,
    /SKIP: package-b's approved dependency scripts are already planned\./
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
  assert.deepEqual(readLog(fixture.logPath), [
    'check\tpackage-a',
    'check\tpackage-b'
  ]);
  assert.match(result.stdout, /package-b has a partial overlap/);
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
  assert.deepEqual(readLog(fixture.logPath), ['check\tpackage-a']);
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
  assert.deepEqual(readLog(fixture.logPath), [
    'check\tpackage-a',
    'run\tpackage-a',
    'list\tpackage-a'
  ]);
  assert.match(result.stdout, /Exit status: 23/);
});

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
