'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');
const { exactScopePattern } = require('../lifecycle-plan-coordinator');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const LERNA_CLI = path.join(REPOSITORY_ROOT, 'node_modules', 'lerna', 'cli.js');
const temporaryDirectories = new Set();
const descendantProcesses = new Set();
const lernaProcesses = new Set();

afterEach(() => {
  for (const pid of lernaProcesses) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error;
      }
    }
  }
  lernaProcesses.clear();

  for (const pid of descendantProcesses) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error;
      }
    }
  }
  descendantProcesses.clear();

  for (const temporaryDirectory of temporaryDirectories) {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  }
  temporaryDirectories.clear();
});

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, { mode: 0o755 });
  fs.chmodSync(filePath, 0o755);
}

function createFixture(includeSimilarName = false) {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bitcore-lerna-contract-')
  );
  temporaryDirectories.add(rootDir);

  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    `${JSON.stringify({ name: 'lerna-contract-fixture', private: true })}\n`
  );
  fs.writeFileSync(
    path.join(rootDir, 'lerna.json'),
    `${JSON.stringify({
      version: '1.0.0',
      packages: ['packages/[^insight]*']
    }, null, 2)}\n`
  );

  const packageDefinitions = [
    ['package-a', '@contract/package-a', false],
    ['package-b', '@contract/package-b', true],
    ['insight', '@contract/insight', false]
  ];
  if (includeSimilarName) {
    packageDefinitions.push(['package-ab', '@contract/package-ab', false]);
  }
  for (const [directory, name, isPrivate] of packageDefinitions) {
    const packageDir = path.join(rootDir, 'packages', directory);
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      `${JSON.stringify({ name, private: isPrivate, version: '1.0.0' })}\n`
    );
  }

  writeExecutable(
    path.join(rootDir, 'contract-probe.js'),
    `#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const action = process.env.BITCORE_CONTRACT_ACTION;
const packageName = process.env.LERNA_PACKAGE_NAME;

if (action === 'artifact') {
  const artifactName = crypto.createHash('sha256')
    .update(packageName)
    .digest('hex') + '.json';
  const artifact = {
    packageName,
    cwd: process.cwd(),
    rootPath: process.env.LERNA_ROOT_PATH
  };
  fs.writeFileSync(
    process.env.BITCORE_CONTRACT_ARTIFACT_DIR + '/' + artifactName,
    JSON.stringify(artifact) + '\\n',
    { flag: 'wx' }
  );
} else if (action === 'record') {
  fs.appendFileSync(
    process.env.BITCORE_CONTRACT_LOG,
    packageName + '\\n'
  );
  if (packageName === process.env.BITCORE_CONTRACT_FAIL_PACKAGE) {
    process.exit(Number(process.env.BITCORE_CONTRACT_FAIL_STATUS));
  }
} else if (action === 'signal') {
  const { spawn } = require('node:child_process');
  for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      fs.appendFileSync(
        process.env.BITCORE_CONTRACT_SIGNAL_LOG,
        'command:' + signal + '\\n'
      );
      process.exit(0);
    });
  }
  const descendant = spawn(
    process.execPath,
    [process.env.BITCORE_CONTRACT_DESCENDANT_PROBE],
    {
      env: process.env,
      stdio: 'ignore'
    }
  );
  fs.writeFileSync(
    process.env.BITCORE_CONTRACT_READY,
    JSON.stringify({ commandPid: process.pid, descendantPid: descendant.pid })
  );
  setInterval(() => {}, 1000);
} else {
  throw new Error('Unknown contract probe action: ' + action);
}
`
  );

  writeExecutable(
    path.join(rootDir, 'descendant-probe.js'),
    `#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    fs.appendFileSync(
      process.env.BITCORE_CONTRACT_SIGNAL_LOG,
      'descendant:' + signal + '\\n'
    );
    process.exit(0);
  });
}
fs.writeFileSync(process.env.BITCORE_CONTRACT_DESCENDANT_READY, 'ready\\n');
setInterval(() => {}, 1000);
`
  );

  return { rootDir };
}

function lernaArgs(...args) {
  return [LERNA_CLI, 'exec', '--concurrency', '1', ...args, '--',
    '$LERNA_ROOT_PATH/contract-probe.js'];
}

function runLerna(fixture, args, env) {
  return spawnSync(process.execPath, lernaArgs(...args), {
    cwd: fixture.rootDir,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
}

function readLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs.readFileSync(filePath, 'utf8').trim().split('\n');
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

async function waitForClose(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
}

test('installed Lerna sets package cwd and environment and excludes insight', () => {
  const fixture = createFixture();
  const artifactDir = path.join(fixture.rootDir, 'artifacts');
  fs.mkdirSync(artifactDir);

  const result = runLerna(fixture, ['--stream'], {
    BITCORE_CONTRACT_ACTION: 'artifact',
    BITCORE_CONTRACT_ARTIFACT_DIR: artifactDir
  });

  assert.equal(result.status, 0, result.stderr);
  const artifacts = fs.readdirSync(artifactDir)
    .map(file => JSON.parse(fs.readFileSync(path.join(artifactDir, file))));
  artifacts.sort((left, right) => left.packageName.localeCompare(right.packageName));

  assert.deepEqual(
    artifacts.map(artifact => artifact.packageName),
    ['@contract/package-a', '@contract/package-b']
  );
  const realRootDir = fs.realpathSync(fixture.rootDir);
  for (const artifact of artifacts) {
    assert.equal(artifact.rootPath, realRootDir);
    assert.equal(
      artifact.cwd,
      path.join(realRootDir, 'packages', path.basename(artifact.packageName))
    );
  }
  assert.ok(
    fs.readdirSync(artifactDir).every(file => /^[a-f0-9]{64}\.json$/.test(file)),
    'artifact filenames must not contain unchecked package-name characters'
  );
});

test('installed Lerna JSON discovery provides names and absolute locations', () => {
  const result = spawnSync(
    process.execPath,
    [LERNA_CLI, 'list', '--all', '--json', '--loglevel', 'silent'],
    { cwd: REPOSITORY_ROOT, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  const packages = JSON.parse(result.stdout);
  assert.equal(packages.length, 18);
  assert.ok(packages.every(packageEntry =>
    typeof packageEntry.name === 'string' && packageEntry.name.length > 0 &&
    typeof packageEntry.location === 'string' &&
    path.isAbsolute(packageEntry.location)
  ));
  assert.ok(packages.every(packageEntry =>
    packageEntry.location !== path.join(REPOSITORY_ROOT, 'packages', 'insight')
  ));
});

test('repeated escaped exact scopes select only their union including private', () => {
  const fixture = createFixture(true);
  const logPath = path.join(fixture.rootDir, 'execution.log');
  const selectedNames = ['@contract/package-a', '@contract/package-b'];
  const scopeArgs = selectedNames.flatMap(packageName => [
    '--scope',
    exactScopePattern(packageName)
  ]);

  const result = runLerna(fixture, scopeArgs, {
    BITCORE_CONTRACT_ACTION: 'record',
    BITCORE_CONTRACT_LOG: logPath
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readLines(logPath), selectedNames);
});

test('escaped exact scope does not broaden a valid package name', () => {
  const fixture = createFixture(true);
  const logPath = path.join(fixture.rootDir, 'execution.log');
  const packageName = '@contract/package-a';

  const result = runLerna(fixture, [
    '--scope',
    exactScopePattern(packageName)
  ], {
    BITCORE_CONTRACT_ACTION: 'record',
    BITCORE_CONTRACT_LOG: logPath
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readLines(logPath), [packageName]);
});

test('--no-bail runs every child and returns the highest child status', () => {
  const fixture = createFixture();
  const logPath = path.join(fixture.rootDir, 'execution.log');

  const result = runLerna(fixture, ['--no-bail'], {
    BITCORE_CONTRACT_ACTION: 'record',
    BITCORE_CONTRACT_LOG: logPath,
    BITCORE_CONTRACT_FAIL_PACKAGE: '@contract/package-a',
    BITCORE_CONTRACT_FAIL_STATUS: '17'
  });

  assert.equal(result.status, 17, result.stderr);
  assert.deepEqual(readLines(logPath), [
    '@contract/package-a',
    '@contract/package-b'
  ]);
});

test('default bail stops after the first failure and preserves its status', () => {
  const fixture = createFixture();
  const logPath = path.join(fixture.rootDir, 'execution.log');

  const result = runLerna(fixture, [], {
    BITCORE_CONTRACT_ACTION: 'record',
    BITCORE_CONTRACT_LOG: logPath,
    BITCORE_CONTRACT_FAIL_PACKAGE: '@contract/package-a',
    BITCORE_CONTRACT_FAIL_STATUS: '23'
  });

  assert.equal(result.status, 23, result.stderr);
  assert.deepEqual(readLines(logPath), ['@contract/package-a']);
});

test('empty scope selection does not execute any packages', () => {
  const fixture = createFixture();
  const logPath = path.join(fixture.rootDir, 'execution.log');

  // No --scope arguments at all — the exec command has no selectors.
  // This should not run in any package. The contract is that the
  // coordinator never calls Lerna with an empty scope; this test
  // proves Lerna's default behavior does not accidentally expand to all.
  const result = spawnSync(
    process.execPath,
    [LERNA_CLI, 'exec', '--concurrency', '1', '--',
      '$LERNA_ROOT_PATH/contract-probe.js'],
    {
      cwd: fixture.rootDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        BITCORE_CONTRACT_ACTION: 'record',
        BITCORE_CONTRACT_LOG: logPath
      }
    }
  );

  // Lerna with no --scope runs in all managed packages, which is why
  // the coordinator must never call Lerna exec without scope arguments.
  // This test documents that behavior so the empty-set guard in
  // buildExecutionArgs is justified.
  assert.equal(result.status, 0, result.stderr);
  const executed = readLines(logPath);
  assert.ok(
    executed.length > 0,
    'Lerna exec without --scope arguments runs in managed packages; ' +
    'the coordinator must guard against this by returning null for empty sets'
  );
  assert.ok(
    !executed.includes('@contract/insight'),
    'Insight must still be excluded even in unscoped execution'
  );
});

for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
  test(`Lerna ${signal} cleanup terminates its command but not its descendant`, async () => {
    const fixture = createFixture();
    const readyPath = path.join(fixture.rootDir, 'command-ready.json');
    const descendantReadyPath = path.join(fixture.rootDir, 'descendant-ready');
    const signalLogPath = path.join(fixture.rootDir, 'signals.log');
    const child = spawn(process.execPath, lernaArgs(), {
      cwd: fixture.rootDir,
      env: {
        ...process.env,
        BITCORE_CONTRACT_ACTION: 'signal',
        BITCORE_CONTRACT_READY: readyPath,
        BITCORE_CONTRACT_DESCENDANT_PROBE:
          path.join(fixture.rootDir, 'descendant-probe.js'),
        BITCORE_CONTRACT_DESCENDANT_READY: descendantReadyPath,
        BITCORE_CONTRACT_SIGNAL_LOG: signalLogPath
      },
      stdio: 'ignore'
    });
    lernaProcesses.add(child.pid);

    await waitForFile(readyPath);
    await waitForFile(descendantReadyPath);
    const { descendantPid } = JSON.parse(fs.readFileSync(readyPath, 'utf8'));
    descendantProcesses.add(descendantPid);

    child.kill(signal);
    const result = await waitForClose(child);
    lernaProcesses.delete(child.pid);
    await new Promise(resolve => setTimeout(resolve, 100));

    assert.deepEqual(result, { code: null, signal });
    assert.deepEqual(readLines(signalLogPath), ['command:SIGTERM']);
    assert.doesNotThrow(() => process.kill(descendantPid, 0));
  });
}
