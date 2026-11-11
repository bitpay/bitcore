'use strict';

// Shared fixture builders for the tool-resolution tests. Fixtures are
// disposable temp directories independent of the real repository's install
// state, so these tests exercise the helper's tool-resolution *logic*
// against synthetic layouts, not the migrated repository itself.
//
// The helper under test is always a byte-for-byte copy of the real
// index.js/karma.conf.js/wdio.conf.js placed inside the fixture -- never a
// symlink to the real packages/bitcore-build directory -- so the fixture
// exercises today's real source. Its actual tool dependencies (browserify,
// karma, @wdio/cli) and the gulp plumbing that runs it are reused via
// symlink from bitcore-build's own real, already-installed copies: Node
// resolves a symlinked package to its real path for both module identity and
// its own further `require()` calls, so a real, unmodified browserify
// genuinely bundles fixture source and produces a real bundle, without this
// fixture needing to reimplement any tool's own dependency tree.

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BITCORE_BUILD_DIR = path.join(REPO_ROOT, 'packages', 'bitcore-build');
const REAL_HELPER_SOURCE = path.join(BITCORE_BUILD_DIR, 'index.js');
const REAL_KARMA_CONF_SOURCE = path.join(BITCORE_BUILD_DIR, 'karma.conf.js');
const REAL_WDIO_CONF_SOURCE = path.join(BITCORE_BUILD_DIR, 'wdio.conf.js');
// Reuse the real helper's own dependency-location logic (rather than
// hardcoding "packages/bitcore-build/node_modules/<name>") so these fixtures
// keep working once dependencies are hoisted to a shared root instead of
// nested under bitcore-build itself -- exactly the layout change this task
// is about.
const { resolvePackageDir } = require(REAL_HELPER_SOURCE);

// The plumbing gulp-shell needs to actually run the helper and produce a
// browser bundle; not the tool-resolution behavior under test.
const ENGINE_DEPENDENCIES = ['gulp', 'gulp-rename', 'gulp-shell', 'gulp-terser'];
// The tools index.js itself resolves by package identity, from bitcore-build's
// own location. MCR/Mocha are resolved eagerly by every startGulp() call
// (not just when test:node actually runs). Both coverage execution and
// browser bundling use these fixtures.
const HELPER_OWNED_TOOL_DEPENDENCIES = ['browserify', 'karma', '@wdio/cli', 'monocart-coverage-reports', 'mocha'];
// brfs is the transform browser:maketests passes to browserify (-t brfs).
// Unlike the tools above, index.js never resolves this by package ownership
// -- browserify itself resolves transform modules starting from its own
// spawn cwd (the consuming package's directory), by design (see the plan's
// "Keep ... transforms ... relative to the consuming package cwd"). Every
// real consumer that uses this browser-test pipeline (bitcore-lib, mnemonic,
// the P2P packages) accordingly declares brfs as its own direct dependency
// rather than relying on bitcore-build to provide it -- so fixtures must
// make it reachable from the *consumer*, not from the helper.
const CONSUMER_TRANSFORM_DEPENDENCIES = ['brfs'];

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `bitcore-build-${prefix}-`));
}

function symlinkDependency(name, intoNodeModulesDir) {
  fs.mkdirSync(intoNodeModulesDir, { recursive: true });
  const linkPath = path.join(intoNodeModulesDir, name);
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  // resolvePackageDir walks up from BITCORE_BUILD_DIR the same way index.js
  // itself resolves tools, so this finds the real installed copy whether
  // it's nested under bitcore-build (today) or hoisted to the repo root
  // (after the workspace cutover), rather than assuming today's nesting depth.
  fs.symlinkSync(resolvePackageDir(name, BITCORE_BUILD_DIR), linkPath, 'dir');
}

function writeHelperCopy(helperDir) {
  fs.mkdirSync(helperDir, { recursive: true });
  fs.writeFileSync(
    path.join(helperDir, 'package.json'),
    JSON.stringify({ name: '@bitpay-labs/bitcore-build', version: '0.0.0-fixture', main: 'index.js' }, null, 2)
  );
  fs.copyFileSync(REAL_HELPER_SOURCE, path.join(helperDir, 'index.js'));
  fs.copyFileSync(REAL_KARMA_CONF_SOURCE, path.join(helperDir, 'karma.conf.js'));
  fs.copyFileSync(REAL_WDIO_CONF_SOURCE, path.join(helperDir, 'wdio.conf.js'));
}

function writeConsumer(consumerDir, marker) {
  fs.mkdirSync(path.join(consumerDir, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(consumerDir, 'test'), { recursive: true });
  fs.writeFileSync(path.join(consumerDir, 'index.js'), 'module.exports = { marker: ' + JSON.stringify(marker) + ' };\n');
  fs.writeFileSync(path.join(consumerDir, 'lib', 'index.js'), 'module.exports = {};\n');
  // Real, non-trivial content (not an empty file) so the real bundle
  // browser:maketests produces can be asserted to actually contain it,
  // rather than merely existing.
  fs.writeFileSync(path.join(consumerDir, 'test', 'index.js'), 'describe(' + JSON.stringify(marker) + ', function() {});\n');
}

// Simulates the npm-workspaces root-hoisted layout: the helper and its real
// tool dependencies are installed once, at the fixture root -- exactly where
// npm places a workspace and its hoisted dependencies -- and the consuming
// package directory has no node_modules of its own at all, matching an
// ordinary workspace member with nothing requiring a nested install.
function buildHoistedFixture(prefix, marker) {
  const fixtureRoot = makeTempDir(prefix || 'hoisted');
  const nodeModules = path.join(fixtureRoot, 'node_modules');

  for (const dependency of ENGINE_DEPENDENCIES.concat(HELPER_OWNED_TOOL_DEPENDENCIES, CONSUMER_TRANSFORM_DEPENDENCIES)) {
    symlinkDependency(dependency, nodeModules);
  }

  const helperDir = path.join(nodeModules, '@bitpay-labs', 'bitcore-build');
  writeHelperCopy(helperDir);

  const consumerDir = path.join(fixtureRoot, 'packages', 'consumer');
  writeConsumer(consumerDir, marker || 'BITCORE_BUILD_FIXTURE_MARKER');

  return { fixtureRoot, consumerDir, helperDir, helperIndexPath: path.join(helperDir, 'index.js') };
}

// Simulates a plain, non-workspaces npm install of bitcore-build by an
// external consumer: its tool dependencies nest directly under its own
// node_modules, exactly as npm installs a package's dependencies when they
// are not hoisted (a version conflict, or simply no sibling workspace to
// hoist into). Protects external users of bitcore-build who never adopt npm
// workspaces at all.
function buildStandaloneFixture(prefix, marker) {
  const fixtureRoot = makeTempDir(prefix || 'standalone');

  for (const dependency of ENGINE_DEPENDENCIES) {
    symlinkDependency(dependency, path.join(fixtureRoot, 'node_modules'));
  }

  const consumerDir = path.join(fixtureRoot, 'packages', 'consumer');
  const helperDir = path.join(consumerDir, 'node_modules', '@bitpay-labs', 'bitcore-build');
  writeHelperCopy(helperDir);

  for (const dependency of HELPER_OWNED_TOOL_DEPENDENCIES) {
    symlinkDependency(dependency, path.join(helperDir, 'node_modules'));
  }
  // brfs belongs to the consumer, not to bitcore-build's own nested
  // dependencies -- see CONSUMER_TRANSFORM_DEPENDENCIES above.
  for (const dependency of CONSUMER_TRANSFORM_DEPENDENCIES) {
    symlinkDependency(dependency, path.join(consumerDir, 'node_modules'));
  }

  writeConsumer(consumerDir, marker || 'BITCORE_BUILD_FIXTURE_MARKER');

  return { fixtureRoot, consumerDir, helperDir, helperIndexPath: path.join(helperDir, 'index.js') };
}

// Resolves an installed dependency's real root directory for the closure
// walker below. Prefers requiring the "/package.json" subpath directly:
// unlike a bare require.resolve(name), this is unambiguous even for a
// package whose name collides with a Node core module (e.g. browserify
// itself genuinely depends on the real userland "assert" package -- as a
// browser-target bundling shim for consumer code, not Node's core module --
// and reaches it internally via the equivalent of this same subpath trick,
// specifically to bypass core-module resolution priority). Falls back to
// resolvePackageDir()'s walk-up-from-the-resolved-entry-point approach only
// when a package's own "exports" map rejects that subpath (as production
// resolveBin() already has to handle for @wdio/cli).
function resolveInstalledDependencyDir(name, fromDir) {
  try {
    return path.dirname(require.resolve(name + '/package.json', { paths: [fromDir] }));
  } catch (error) {
    if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
    return resolvePackageDir(name, fromDir);
  }
}

// Recursively symlinks a real, installed package's entire dependency
// closure into targetNodeModules, one flat symlink per unique package name.
// Each dependency is resolved from the real location of the package that
// declares it (not assumed to live alongside it), matching how Node's own
// resolution -- and resolvePackageDir()/resolveBin() in production -- walks
// up from wherever a file actually is, so this stays correct however deep
// or shallow the real install happens to nest any given package. `visited`
// prevents symlinking (or recursing into) the same package name twice.
function linkDependencyClosure(startDir, targetNodeModules, visited) {
  const manifest = JSON.parse(fs.readFileSync(path.join(startDir, 'package.json'), 'utf8'));
  for (const dependency of Object.keys(manifest.dependencies || {})) {
    if (visited.has(dependency)) continue;
    visited.add(dependency);
    const linkPath = path.join(targetNodeModules, dependency);
    if (fs.existsSync(linkPath)) continue;
    const dependencyDir = resolveInstalledDependencyDir(dependency, startDir);
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(dependencyDir, linkPath, 'dir');
    linkDependencyClosure(dependencyDir, targetNodeModules, visited);
  }
}

// Simulates a hoisted layout at a fixture root whose own path contains a
// space, using a REAL, recursively *copied* (not symlinked) browserify so
// this fixture genuinely exercises real bundling with a space-containing
// resolved bin path -- a symlink's target realpaths to its actual,
// space-free location in the repository checkout, which would defeat the
// purpose here. browserify's real current location is discovered via
// resolvePackageDir() (not assumed to be bitcore-build's own node_modules),
// so this keeps working once dependencies are hoisted to a shared root
// instead of nested under bitcore-build itself -- an earlier revision
// hardcoded path.join(BITCORE_BUILD_DIR, 'node_modules') here, which was
// exactly the fixed-layout assumption this task's production fix removes
// from index.js, reintroduced by mistake in this fixture. browserify's own
// declared dependencies (needed for it to actually run) are resolved from
// its own real location the same layout-agnostic way, rather than assumed
// to live alongside it; everything else this fixture needs is reused by
// symlink for efficiency, since only browserify's own resolved location
// needs to contain the space.
function buildSpacedRealFixture(marker) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bitcore-build space-'));
  const nodeModules = path.join(fixtureRoot, 'node_modules');
  fs.mkdirSync(nodeModules, { recursive: true });

  const realBrowserifyDir = resolvePackageDir('browserify', BITCORE_BUILD_DIR);
  fs.cpSync(realBrowserifyDir, path.join(nodeModules, 'browserify'), { recursive: true });
  // browserify's own *direct* dependencies aren't enough -- their own
  // transitive dependencies (e.g. readable-stream, one level in, itself
  // needs process-nextick-args) must resolve too, for the real copied
  // browserify to actually run. Walk the whole real, already-resolved
  // dependency graph and symlink each package once, from wherever it
  // genuinely already resolves for its own real requiring package -- not
  // assumed to sit alongside whatever depends on it.
  linkDependencyClosure(realBrowserifyDir, nodeModules, new Set());

  for (const dependency of ENGINE_DEPENDENCIES
    .concat(HELPER_OWNED_TOOL_DEPENDENCIES.filter((name) => name !== 'browserify'))
    .concat(CONSUMER_TRANSFORM_DEPENDENCIES)) {
    symlinkDependency(dependency, nodeModules);
  }

  const helperDir = path.join(nodeModules, '@bitpay-labs', 'bitcore-build');
  writeHelperCopy(helperDir);

  const consumerDir = path.join(fixtureRoot, 'packages', 'consumer');
  writeConsumer(consumerDir, marker || 'BITCORE_BUILD_SPACE_MARKER');

  return { fixtureRoot, consumerDir, helperDir, helperIndexPath: path.join(helperDir, 'index.js') };
}

// Loads the (copied) helper fresh, with gulp-shell's cached `task` function
// wrapped so the exact command strings startGulp constructs can be captured
// without altering its logic -- gulp-shell resolves to the same real, cached
// module both here and from inside the copied helper, since Node resolves
// the symlinked dependency to its real path for cache identity.
function loadHelperCapturingCommands(helperIndexPath, name, opts) {
  const shell = require('gulp-shell');
  const originalTask = shell.task;
  const capturedCommands = [];
  shell.task = (commands, options) => {
    capturedCommands.push(commands);
    return originalTask(commands, options);
  };

  let tasks;
  try {
    delete require.cache[helperIndexPath];
    const startGulp = require(helperIndexPath);
    tasks = startGulp(name, opts);
  } finally {
    shell.task = originalTask;
  }

  return { tasks, capturedCommands };
}

function runTask(task) {
  return new Promise((resolve) => {
    task((err) => resolve(err || null));
  });
}

// Reads the shared karma.conf.js/wdio.conf.js copied into a fixture's
// helperDir and returns the bundle path(s) each one resolves for the
// consuming package, given the consumer's own cwd -- exercising the same
// consumer-relative bundle *discovery* the real Karma/WDIO runners rely on,
// not just the tool-invocation paths.
function resolveKarmaFiles(helperDir) {
  const karmaConfPath = path.join(helperDir, 'karma.conf.js');
  delete require.cache[karmaConfPath];
  const configureKarma = require(karmaConfPath);
  let recordedConfig;
  configureKarma({ set: (config) => { recordedConfig = config; }, LOG_INFO: 'INFO' });
  return recordedConfig.files;
}

function resolveWdioSpecs(helperDir) {
  const wdioConfPath = path.join(helperDir, 'wdio.conf.js');
  delete require.cache[wdioConfPath];
  return require(wdioConfPath).config.specs;
}

module.exports = {
  REPO_ROOT,
  BITCORE_BUILD_DIR,
  makeTempDir,
  buildHoistedFixture,
  buildStandaloneFixture,
  buildSpacedRealFixture,
  loadHelperCapturingCommands,
  runTask,
  resolveKarmaFiles,
  resolveWdioSpecs
};
