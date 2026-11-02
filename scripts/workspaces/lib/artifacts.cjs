'use strict';

const { spawnSync } = require('child_process');
const nodeCrypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EXPECTED_WORKSPACES } = require('./constants.cjs');
const { loadWorkspaceManifests, formatFailure } = require('./util.cjs');

// Required build outputs relative to each package directory. Only the packages with a `compile`/`build` step need explicit
// entries; every other backend workspace is checked generically below via
// its manifest `main` field ("existing declared entry files resolve
// locally; no compile output is invented for them").
const TS_INDEX_REQUIREMENTS = {
  '@bitpay-labs/bitcore-logging': ['ts_build/src/index.js', 'ts_build/src/index.d.ts'],
  '@bitpay-labs/crypto-wallet-core': ['ts_build/src/index.js', 'ts_build/src/index.d.ts'],
  '@bitpay-labs/bitcore-wallet-service': ['ts_build/src/index.js', 'ts_build/src/index.d.ts'],
  '@bitpay-labs/bitcore-wallet-client': ['ts_build/src/index.js', 'ts_build/src/index.d.ts'],
  '@bitpay-labs/bitcore-client': ['ts_build/src/index.js', 'ts_build/src/index.d.ts'],
};

const WALLET_SERVICE_EXTRA_FILES = [
  'ts_build/src/bws.js',
  'ts_build/src/messagebroker/messagebroker.js',
  'ts_build/src/bcmonitor/bcmonitor.js',
  'ts_build/src/emailservice/emailservice.js',
  'ts_build/src/pushnotificationsservice/pushnotificationsservice.js',
  'ts_build/src/fiatrateservice/fiatrateservice.js',
];
const WALLET_SERVICE_TEMPLATES_SOURCE = 'templates';
const WALLET_SERVICE_TEMPLATES_BUILT = 'ts_build/templates';

const CLI_NAME = '@bitpay-labs/bitcore-cli';
const CLI_BUILD_ENTRY = 'build/src/cli.js';
const CLI_TRACKED_LAUNCHER = 'bin/bitcore-cli';

const NODE_NAME = '@bitpay-labs/bitcore-node';
const NODE_REQUIRED_FILES = [
  'build/src/server.js',
  'build/src/services/api.js',
  'build/src/services/storage.js',
  'build/src/modules/index.js',
];

function fileFailure(mode, workspace, relPath, absPath) {
  return formatFailure({
    mode,
    detail: 'Required build artifact is missing.',
    workspace,
    expected: relPath,
    observed: fs.existsSync(absPath) ? 'present but unexpected type' : 'missing',
  });
}

function checkFilesExist(mode, workspace, dir, relPaths) {
  const failures = [];
  for (const relPath of relPaths) {
    const absPath = path.join(dir, relPath);
    if (!fs.existsSync(absPath)) {
      failures.push(fileFailure(mode, workspace, relPath, absPath));
    }
  }
  return failures;
}

// Lists every file under `dir` recursively, as paths relative to `dir` (e.g.
// "en/master-template.html"). A shallow `readdirSync` would only see the
// top-level locale directory names and never notice a missing/altered file
// nested inside one of them.
function listFilesRecursively(dir, prefix = '') {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(path.join(dir, entry.name), relPath));
    } else {
      files.push(relPath);
    }
  }
  return files;
}

function checkTemplatesCopied(workspace, dir) {
  const failures = [];
  const sourceDir = path.join(dir, WALLET_SERVICE_TEMPLATES_SOURCE);
  const builtDir = path.join(dir, WALLET_SERVICE_TEMPLATES_BUILT);
  if (!fs.existsSync(builtDir)) {
    failures.push(
      formatFailure({
        mode: 'artifacts',
        detail: 'wallet-service template output directory was not produced.',
        workspace,
        expected: WALLET_SERVICE_TEMPLATES_BUILT,
        observed: 'missing',
      })
    );
    return failures;
  }
  const sourceFiles = fs.existsSync(sourceDir) ? listFilesRecursively(sourceDir).sort() : [];
  const builtFiles = new Set(listFilesRecursively(builtDir));
  const missing = sourceFiles.filter((relPath) => !builtFiles.has(relPath));
  if (missing.length > 0) {
    failures.push(
      formatFailure({
        mode: 'artifacts',
        detail: 'wallet-service template output is missing files present (possibly nested) in the source templates.',
        workspace,
        expected: sourceFiles,
        observed: [...builtFiles].sort(),
      })
    );
    return failures;
  }
  for (const relPath of sourceFiles) {
    const sourceFile = path.join(sourceDir, relPath);
    const builtFile = path.join(builtDir, relPath);
    if (hashFile(sourceFile) !== hashFile(builtFile)) {
      failures.push(
        formatFailure({
          mode: 'artifacts',
          detail: 'Copied wallet-service template content diverges from its source.',
          workspace,
          expected: `${sourceFile} contents`,
          observed: `${builtFile} contents differ`,
        })
      );
    }
  }
  return failures;
}

// Returns true/false when `rootDir` is a git checkout, or null when it is
// not (e.g. a synthetic test fixture) -- in which case tracked-ness cannot be
// asked of git and the caller should not fail the check on that basis alone.
function isGitTracked(rootDir, absPath) {
  if (!fs.existsSync(path.join(rootDir, '.git'))) return null;
  const relPath = path.relative(rootDir, absPath);
  const result = spawnSync('git', ['ls-files', '--error-unmatch', '--', relPath], {
    cwd: rootDir,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function checkCliLauncher(rootDir, dir) {
  const failures = [];
  const trackedLauncher = path.join(dir, CLI_TRACKED_LAUNCHER);
  const launcherExists = fs.existsSync(trackedLauncher);
  if (!launcherExists) {
    failures.push(
      formatFailure({
        mode: 'artifacts',
        detail: 'CLI tracked bin launcher is missing.',
        workspace: CLI_NAME,
        expected: CLI_TRACKED_LAUNCHER,
        observed: 'missing',
      })
    );
  } else {
    const tracked = isGitTracked(rootDir, trackedLauncher);
    if (tracked === false) {
      failures.push(
        formatFailure({
          mode: 'artifacts',
          detail:
            'CLI bin launcher exists on disk but is not tracked by git; a build step (e.g. postbuild) may have generated it in place of the committed launcher.',
          workspace: CLI_NAME,
          expected: `${CLI_TRACKED_LAUNCHER} tracked in git`,
          observed: 'untracked',
        })
      );
    }
  }

  const rootBin = path.join(rootDir, 'node_modules', '.bin', 'bitcore-cli');
  if (!fs.existsSync(rootBin)) {
    failures.push(
      formatFailure({
        mode: 'artifacts',
        detail: 'Root .bin CLI executable was not linked by installation.',
        workspace: CLI_NAME,
        expected: 'node_modules/.bin/bitcore-cli',
        observed: 'missing',
      })
    );
    return failures;
  }

  const realRootBin = fs.realpathSync(rootBin);
  if (launcherExists) {
    const realLauncher = fs.realpathSync(trackedLauncher);
    if (realRootBin !== realLauncher) {
      failures.push(
        formatFailure({
          mode: 'artifacts',
          detail: 'Root .bin CLI executable does not target the tracked launcher.',
          workspace: CLI_NAME,
          expected: realLauncher,
          observed: realRootBin,
        })
      );
      return failures;
    }
  }

  try {
    fs.accessSync(realRootBin, fs.constants.X_OK);
  } catch {
    failures.push(
      formatFailure({
        mode: 'artifacts',
        detail: 'Root .bin CLI executable exists but is not executable.',
        workspace: CLI_NAME,
        expected: 'executable file',
        observed: 'not executable',
      })
    );
    return failures;
  }

  const help = spawnSync(rootBin, ['--help'], { cwd: rootDir, encoding: 'utf8', timeout: 30000 });
  if (help.error || help.status !== 0) {
    failures.push(
      formatFailure({
        mode: 'artifacts',
        detail: 'Root .bin CLI executable did not exit zero when run with `--help`.',
        workspace: CLI_NAME,
        expected: 'exit code 0',
        observed: help.error ? help.error.message : `exit code ${help.status}${help.stderr ? `: ${help.stderr.trim()}` : ''}`,
      })
    );
  }

  return failures;
}

// Validates the package's own declared `main`/`types` paths, independent of
// the per-package hardcoded required-file tables below. Those tables assert
// that the expected compiled output exists on disk; this asserts that what
// the manifest itself *claims* resolves, so a manifest typo (for example
// declaring `types` with the wrong extension) is caught even when the
// hardcoded compiled-output paths it should have pointed at are correct.
function checkDeclaredEntryPoints(workspace, dir, manifest) {
  const failures = [];
  for (const field of ['main', 'types']) {
    const declared = manifest[field];
    if (!declared) continue;
    const absPath = path.join(dir, declared);
    if (!fs.existsSync(absPath)) {
      failures.push(
        formatFailure({
          mode: 'artifacts',
          detail: `Declared package \`${field}\` does not resolve.`,
          workspace,
          expected: declared,
          observed: 'missing',
        })
      );
    }
  }
  return failures;
}

function runBuildStage({ rootDir, workspaces = EXPECTED_WORKSPACES }) {
  const manifests = loadWorkspaceManifests(rootDir, workspaces);
  let failures = [];

  for (const { manifest, dir, workspacePath } of manifests.values()) {
    // Runs for every workspace regardless of branch below: the hardcoded
    // per-package tables assert that specific compiled paths exist, but only
    // this validates that what the manifest itself declares (`main`,
    // `types`) is what actually resolves.
    failures = failures.concat(checkDeclaredEntryPoints(workspacePath, dir, manifest));

    if (TS_INDEX_REQUIREMENTS[manifest.name]) {
      failures = failures.concat(
        checkFilesExist('artifacts', workspacePath, dir, TS_INDEX_REQUIREMENTS[manifest.name])
      );
    } else if (manifest.name === NODE_NAME) {
      failures = failures.concat(checkFilesExist('artifacts', workspacePath, dir, NODE_REQUIRED_FILES));
    } else if (manifest.name === CLI_NAME) {
      failures = failures.concat(checkFilesExist('artifacts', workspacePath, dir, [CLI_BUILD_ENTRY]));
      failures = failures.concat(checkCliLauncher(rootDir, dir));
    }

    if (manifest.name === '@bitpay-labs/bitcore-wallet-service') {
      failures = failures.concat(checkFilesExist('artifacts', workspacePath, dir, WALLET_SERVICE_EXTRA_FILES));
      failures = failures.concat(checkTemplatesCopied(workspacePath, dir));
    }
  }

  return { ok: failures.length === 0, failures };
}

function hashFile(filePath) {
  return nodeCrypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function compareDirectoryHashes(mode, workspace, sourceDir, builtDir, glob) {
  const failures = [];
  if (!fs.existsSync(sourceDir)) return failures;
  if (!fs.existsSync(builtDir)) {
    failures.push(
      formatFailure({
        mode,
        detail: 'Test fixture data was not copied by the owning test-preparation command.',
        workspace,
        expected: builtDir,
        observed: 'missing',
      })
    );
    return failures;
  }
  const files = fs.readdirSync(sourceDir).filter((f) => glob.test(f));
  for (const file of files) {
    const sourceFile = path.join(sourceDir, file);
    const builtFile = path.join(builtDir, file);
    if (!fs.existsSync(builtFile)) {
      failures.push(
        formatFailure({
          mode,
          detail: 'Test fixture file was not copied to the build output.',
          workspace,
          expected: builtFile,
          observed: 'missing',
        })
      );
      continue;
    }
    if (hashFile(sourceFile) !== hashFile(builtFile)) {
      failures.push(
        formatFailure({
          mode,
          detail: 'Copied test fixture file content diverges from its source.',
          workspace,
          expected: `${sourceFile} contents`,
          observed: `${builtFile} contents differ`,
        })
      );
    }
  }
  return failures;
}

const TEST_FIXTURE_STAGES = {
  '@bitpay-labs/bitcore-wallet-client': (dir) =>
    compareDirectoryHashes(
      'artifacts',
      '@bitpay-labs/bitcore-wallet-client',
      path.join(dir, 'test/data'),
      path.join(dir, 'ts_build/test/data'),
      /\.json$/
    ),
  '@bitpay-labs/bitcore-cli': (dir) =>
    compareDirectoryHashes(
      'artifacts',
      '@bitpay-labs/bitcore-cli',
      path.join(dir, 'test/wallets'),
      path.join(dir, 'build/test/wallets'),
      /.*/
    ),
};

function runTestFixturesStage({ rootDir, workspace, workspaces = EXPECTED_WORKSPACES }) {
  if (!workspace || !TEST_FIXTURE_STAGES[workspace]) {
    return {
      ok: false,
      failures: [
        formatFailure({
          mode: 'artifacts',
          detail: 'test-fixtures stage requires a supported --workspace value.',
          expected: Object.keys(TEST_FIXTURE_STAGES),
          observed: workspace || null,
        }),
      ],
    };
  }
  const manifests = loadWorkspaceManifests(rootDir, workspaces);
  const entry = [...manifests.values()].find(({ manifest }) => manifest.name === workspace);
  if (!entry) {
    return {
      ok: false,
      failures: [
        formatFailure({
          mode: 'artifacts',
          detail: 'Requested workspace is not part of the managed workspace set.',
          expected: workspaces,
          observed: workspace,
        }),
      ],
    };
  }
  const failures = TEST_FIXTURE_STAGES[workspace](entry.dir);
  return { ok: failures.length === 0, failures };
}

function run({ rootDir, stage, workspace, workspaces }) {
  if (stage === 'build') return runBuildStage({ rootDir, workspaces });
  if (stage === 'test-fixtures') return runTestFixturesStage({ rootDir, workspace, workspaces });
  return {
    ok: false,
    failures: [
      formatFailure({
        mode: 'artifacts',
        detail: 'Unknown or missing --stage.',
        expected: ['build', 'test-fixtures'],
        observed: stage || null,
      }),
    ],
  };
}

module.exports = {
  runBuildStage,
  runTestFixturesStage,
  run,
};
