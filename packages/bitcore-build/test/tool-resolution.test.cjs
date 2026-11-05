'use strict';

// Focused helper tests for shared tool resolution.
//
// The old index.js located Browserify/Karma/WebdriverIO and
// its own shared karma.conf.js by concatenating fixed-depth, cwd-relative
// strings ('./node_modules/@bitpay-labs/bitcore-build/node_modules/.bin/<tool>',
// falling back to './node_modules/.bin/<tool>'), which assumed bitcore-build's
// own dependencies are nested inside a per-consumer copy of bitcore-build --
// true only under Lerna's per-package bootstrap, not under npm workspaces'
// root-hoisted install.
//
// These tests exercise the fixed helper (resolveBin() in index.js, resolving
// each tool from bitcore-build's own location via that tool's real package
// manifest/bin metadata) against synthetic fixtures covering both layouts,
// plus a checkout path containing a space -- including actually generating
// the browser *test* bundle (tests.js, via browser:maketests) and confirming
// Karma's and WDIO's own consumer-relative discovery logic finds that real,
// on-disk file, not just that a config value looks right. As in the
// historical RED fixture, the helper under test is always a byte-for-byte
// copy of today's real index.js/karma.conf.js/wdio.conf.js placed inside a
// disposable temp directory, never a symlink to the real repository.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  buildHoistedFixture,
  buildStandaloneFixture,
  buildSpacedRealFixture,
  loadHelperCapturingCommands,
  runTask,
  resolveKarmaFiles,
  resolveWdioSpecs
} = require('./fixture-helpers.cjs');

function captureCommandFor(capturedCommands, needle) {
  const matches = capturedCommands.flat().filter((command) => command.includes(needle));
  assert.equal(matches.length, 1, `expected exactly one captured command containing "${needle}"`);
  return matches[0];
}

function assertBundle(bundlePath, marker, label) {
  assert.equal(fs.existsSync(bundlePath), true, `${label} should write its bundle to the consumer directory (${bundlePath})`);
  const contents = fs.readFileSync(bundlePath, 'utf8');
  assert.ok(contents.includes(marker), `the ${label} bundle should contain content bundled from the consumer's own source`);
}

// Runs both browser-bundling tasks for real: browser:uncompressed (the
// library bundle, bitcore-lib.js) and browser:maketests (the *test* bundle,
// tests.js -- the artifact Karma/WDIO actually consume). Returns the
// commands captured for each so callers can inspect the resolved tool path.
async function exerciseBrowserBundling(fixture, marker) {
  const originalCwd = process.cwd();
  process.chdir(fixture.consumerDir);
  try {
    const { tasks, capturedCommands } = loadHelperCapturingCommands(fixture.helperIndexPath, 'lib', {});
    const browserifyCommand = captureCommandFor(capturedCommands, ' -o bitcore-lib.js');
    const maketestsCommand = captureCommandFor(capturedCommands, ' -o tests.js');

    const uncompressedError = await runTask(tasks['browser:uncompressed']);
    assert.equal(uncompressedError, null, 'browser:uncompressed should succeed once tools resolve correctly: ' + uncompressedError);
    assertBundle(path.join(fixture.consumerDir, 'bitcore-lib.js'), marker, 'browser:uncompressed');

    const maketestsError = await runTask(tasks['browser:maketests']);
    assert.equal(maketestsError, null, 'browser:maketests should succeed once tools resolve correctly: ' + maketestsError);
    assertBundle(path.join(fixture.consumerDir, 'tests.js'), marker, 'browser:maketests');

    // Run real coverage with neither CLI available through consumer .bin.
    // This protects the coverage migration as well as browser tool lookup.
    const coverageCommand = captureCommandFor(capturedCommands, ' --exit --recursive');
    const { resolvePackageDir } = require(fixture.helperIndexPath);
    for (const [name, bin] of [['monocart-coverage-reports', 'mcr'], ['mocha', 'mocha']]) {
      const toolDir = resolvePackageDir(name, fixture.helperDir);
      const manifest = JSON.parse(fs.readFileSync(path.join(toolDir, 'package.json'), 'utf8'));
      assert.ok(coverageCommand.includes('"' + path.join(toolDir, manifest.bin[bin]) + '"'));
    }
    fs.writeFileSync(path.join(fixture.consumerDir, 'mcr.config.cjs'), `module.exports = {
      reports: ['v8-json'], outputDir: 'coverage',
      entryFilter: entry => entry.url.endsWith('/lib/index.js')
    };\n`);
    const testPath = path.join(fixture.consumerDir, 'test', 'index.js');
    fs.writeFileSync(testPath, "const assert = require('node:assert/strict');\ndescribe('coverage', () => { it('loads consumer source', () => assert.deepEqual(require('../lib'), {})); });\n");
    assert.equal(await runTask(tasks['test:node']), null, 'test:node should run MCR and Mocha from helper dependencies');
    const reportPath = path.join(fixture.consumerDir, 'coverage', 'coverage-report.json');
    assert.ok(fs.existsSync(reportPath), 'MCR should write its V8 JSON report');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.ok(report.files.some(file => file.sourcePath.endsWith('lib/index.js')), 'coverage must include executed consumer source');
    fs.writeFileSync(testPath, "describe('failure', () => { it('propagates', () => { throw new Error('expected fixture failure'); }); });\n");
    assert.ok(await runTask(tasks['test:node']), 'test:node must propagate failing Mocha exit status through MCR');

    return { browserifyCommand, maketestsCommand };
  } finally {
    process.chdir(originalCwd);
  }
}

// Confirms Karma's and WDIO's own consumer-relative discovery logic actually
// finds the real tests.js just generated by browser:maketests above -- not
// merely that a config field has the expected string value. Must run after
// exerciseBrowserBundling, with the consumer's tests.js already on disk.
function assertBundleDiscovery(fixture) {
  const originalCwd = process.cwd();
  process.chdir(fixture.consumerDir);
  try {
    // Compare against process.cwd() itself, not fixture.consumerDir: on
    // macOS os.tmpdir() returns a /var alias that process.cwd() reports via
    // its resolved /private/var real path, so the two differ as plain
    // strings even though they name the same directory.
    const expectedTestsJs = path.join(process.cwd(), 'tests.js');
    assert.equal(fs.existsSync(expectedTestsJs), true, 'test setup sanity check: tests.js must already exist for discovery to be meaningful');

    const karmaFiles = resolveKarmaFiles(fixture.helperDir);
    assert.deepEqual(
      karmaFiles,
      [expectedTestsJs],
      'karma should discover the real generated bundle from the consuming package\'s own directory'
    );

    const wdioSpecs = resolveWdioSpecs(fixture.helperDir);
    assert.deepEqual(
      wdioSpecs,
      [expectedTestsJs],
      'wdio should discover the same real generated bundle from the consuming package\'s own directory'
    );
  } finally {
    process.chdir(originalCwd);
  }
}

test('under a hoisted (npm workspaces) layout, the helper resolves tools from its own location, produces real bundles, and Karma/WDIO discover them', async () => {
  const marker = 'BITCORE_BUILD_HOISTED_MARKER';
  const fixture = buildHoistedFixture('hoisted', marker);

  // The consumer has no node_modules of its own at all -- neither of the
  // helper's old hardcoded, consumer-cwd-relative candidate paths exists.
  const nestedPath = path.join(fixture.consumerDir, 'node_modules', '@bitpay-labs', 'bitcore-build', 'node_modules', '.bin', 'browserify');
  const fallbackPath = path.join(fixture.consumerDir, 'node_modules', '.bin', 'browserify');
  assert.equal(fs.existsSync(nestedPath), false, 'nested per-consumer .bin path should not exist under a hoisted layout');
  assert.equal(fs.existsSync(fallbackPath), false, 'consumer-local .bin fallback should not exist under a hoisted layout');
  assert.equal(
    fs.existsSync(path.join(fixture.consumerDir, 'node_modules', '@bitpay-labs', 'bitcore-build', 'karma.conf.js')),
    false,
    'the old default karma.conf.js lookup path should not exist under a hoisted layout'
  );

  const realBrowserifyBin = fs.realpathSync(path.join(require.resolve('browserify/package.json', { paths: [fixture.helperDir] }), '..', 'bin', 'cmd.js'));
  const { browserifyCommand, maketestsCommand } = await exerciseBrowserBundling(fixture, marker);
  for (const [label, command] of [['browser:uncompressed', browserifyCommand], ['browser:maketests', maketestsCommand]]) {
    assert.ok(
      command.includes(realBrowserifyBin),
      `expected the ${label} command to embed browserify's real resolved bin path (${realBrowserifyBin}); got: ${command}`
    );
    assert.ok(
      !command.includes('./node_modules/.bin/browserify') && !command.includes('./node_modules/@bitpay-labs'),
      `${label} command should not fall back to the old fixed-depth guesses; got: ${command}`
    );
  }

  assertBundleDiscovery(fixture);
});

test('the helper also resolves tools, bundles, and bundle discovery when tools are nested per-consumer (a plain, non-workspaces npm install), protecting external users of bitcore-build', async () => {
  const marker = 'BITCORE_BUILD_STANDALONE_MARKER';
  const fixture = buildStandaloneFixture('standalone', marker);

  assert.equal(
    fs.existsSync(path.join(fixture.helperDir, 'node_modules', 'browserify', 'package.json')),
    true,
    'this fixture models a real nested install: the tool package genuinely lives under the helper\'s own node_modules'
  );

  await exerciseBrowserBundling(fixture, marker);
  assertBundleDiscovery(fixture);
});

test('tool invocation, bundling, and bundle discovery survive a checkout path containing a space', async () => {
  const marker = 'BITCORE_BUILD_SPACE_MARKER';
  const fixture = buildSpacedRealFixture(marker);
  assert.ok(fixture.consumerDir.includes(' '), 'fixture setup sanity check: the checkout path must contain a space');

  const { browserifyCommand, maketestsCommand } = await exerciseBrowserBundling(fixture, marker);
  for (const [label, command] of [['browser:uncompressed', browserifyCommand], ['browser:maketests', maketestsCommand]]) {
    assert.ok(
      /"[^"]* [^"]*browserify[^"]*"/.test(command),
      `expected the ${label} command's space-containing resolved bin path to be double-quoted; got: ${command}`
    );
  }

  assertBundleDiscovery(fixture);
});
