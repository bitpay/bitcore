'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const rootManifest = require('../../../package.json');
const { audit } = require('../audit-packed.cjs');
const { check: checkEngines } = require('../check-engines.cjs');
const { check } = require('../check.cjs');
const { checkContents, checkManifest } = require('../pack.cjs');
const { verifyInstalledArtifacts } = require('../verify-consumer.cjs');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bitcore workspace-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function write(directory, file, contents) {
  const target = path.join(directory, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof contents === 'string' ? contents : JSON.stringify(contents));
}

function runCompile(directory) {
  return spawnSync('npm', ['run', 'compile'], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env, npm_config_cache: path.join(directory, 'cache') },
  });
}

function compileFixture(t, { fail, devEngines } = {}) {
  const directory = fixture(t);
  write(directory, 'package.json', {
    private: true, workspaces: rootManifest.workspaces,
    scripts: { compile: rootManifest.scripts.compile },
    devEngines: devEngines || rootManifest.devEngines,
  });
  for (const workspace of rootManifest.workspaces) {
    const manifest = require(path.resolve(__dirname, '../../..', workspace, 'package.json'));
    write(directory, `${workspace}/package.json`, {
      name: manifest.name, version: manifest.version,
      scripts: manifest.scripts.compile ? { compile: 'node compile.cjs' } : {},
    });
    write(directory, `${workspace}/compile.cjs`, `
      const fs = require('node:fs');
      fs.appendFileSync('../../built.jsonl', JSON.stringify(${JSON.stringify(manifest.name)}) + '\\n');
      if (${JSON.stringify(manifest.name)} === ${JSON.stringify(fail || '')}) process.exit(7);
    `);
  }
  return directory;
}

test('compile covers every compiling workspace with dependencies before consumers', t => {
  const directory = compileFixture(t);
  const result = runCompile(directory);
  assert.equal(result.status, 0, result.stderr);
  const built = fs.readFileSync(path.join(directory, 'built.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const manifests = rootManifest.workspaces.map(workspace => require(path.resolve(__dirname, '../../..', workspace, 'package.json')));
  assert.deepEqual([...built].sort(), manifests.filter(p => p.scripts.compile).map(p => p.name).sort());
  for (const manifest of manifests.filter(p => p.scripts.compile)) {
    for (const dependency of Object.keys(manifest.dependencies || {})) {
      if (built.includes(dependency)) assert(built.indexOf(dependency) < built.indexOf(manifest.name), `${dependency} must build before ${manifest.name}`);
    }
  }
});

test('a failed compile prevents dependent packages from starting', t => {
  const directory = compileFixture(t, { fail: '@bitpay-labs/crypto-wallet-core' });
  const result = runCompile(directory);
  assert.notEqual(result.status, 0, result.stdout);
  assert.deepEqual(fs.readFileSync(path.join(directory, 'built.jsonl'), 'utf8').trim().split('\n').map(JSON.parse),
    ['@bitpay-labs/bitcore-logging', '@bitpay-labs/crypto-wallet-core']);
});

for (const [kind, name] of [['runtime', 'node'], ['packageManager', 'npm']]) {
  test(`npm rejects an unsupported ${kind} before running a compile`, t => {
    const directory = compileFixture(t, { devEngines: { [kind]: { name, version: '0.0.0', onFail: 'error' } } });
    const result = runCompile(directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EBADDEVENGINES/);
    assert(!fs.existsSync(path.join(directory, 'built.jsonl')));
  });
}

function linkedFixture(t) {
  const directory = fixture(t);
  write(directory, 'package.json', { workspaces: ['packages/lib', 'packages/app'] });
  for (const name of ['lib', 'app']) {
    write(directory, `packages/${name}/package.json`, {
      name: `@fixture/${name}`, version: '12.3.4', main: 'index.js',
      ...(name === 'app' ? { dependencies: { '@fixture/lib': '^12.3.0' } } : {}),
    });
    write(directory, `packages/${name}/index.js`, 'module.exports = {};');
    fs.mkdirSync(path.join(directory, 'node_modules/@fixture'), { recursive: true });
    fs.symlinkSync(path.join(directory, 'packages', name), path.join(directory, 'node_modules/@fixture', name), 'dir');
  }
  return directory;
}

test('workspace checks accept current versions and detect incompatible local ranges', t => {
  const directory = linkedFixture(t);
  assert.equal(check(directory), 2);
  write(directory, 'packages/app/package.json', { name: '@fixture/app', version: '12.3.4', dependencies: { '@fixture/lib': '^13.0.0' } });
  assert.throws(() => check(directory), /must match local version/);
});

test('a nested registry copy cannot mask a broken workspace link', t => {
  const directory = linkedFixture(t);
  write(directory, 'packages/app/node_modules/@fixture/lib/package.json', { name: '@fixture/lib', version: '12.3.4' });
  assert.throws(() => check(directory), /registry copy/);
});

test('missing build outputs fail workspace checks', t => {
  const directory = linkedFixture(t);
  write(directory, 'packages/app/package.json', { name: '@fixture/app', version: '12.3.4', types: 'missing.d.ts' });
  assert.throws(() => check(directory), /missing\.d\.ts/);
});

test('engine checks inspect installed manifests and allow only the exact legacy exception', t => {
  const directory = fixture(t);
  write(directory, 'package-lock.json', { packages: {
    '': {}, 'node_modules/socks5-client': { engines: { node: '*' } },
    'node_modules/platform-only': { optional: true },
  } });
  write(directory, 'node_modules/socks5-client/package.json', { name: 'socks5-client', version: '0.3.6', engines: { node: '0.x' } });
  assert.equal(checkEngines(directory, '24.22.1'), 1);
  write(directory, 'node_modules/socks5-client/package.json', { name: 'socks5-client', version: '0.3.7', engines: { node: '0.x' } });
  assert.throws(() => checkEngines(directory, '24.22.1'), /does not satisfy/);
});

test('package checks use current versions and reject local dependency references', () => {
  const manifest = { name: '@bitpay-labs/example', version: '99.2.3', private: false, dependencies: { '@bitpay-labs/other': '^99.0.0' } };
  checkManifest(manifest, manifest);
  assert.throws(() => checkManifest({ ...manifest, version: '99.2.2' }, manifest));
  for (const range of ['file:../other', 'workspace:*', 'link:../other', '/tmp/other']) {
    const candidate = { ...manifest, dependencies: { other: range } };
    assert.throws(() => checkManifest(candidate, candidate), /nonportable range/);
  }
});

test('packed entry points and nested wallet-service templates must be present and correct', t => {
  const directory = fixture(t);
  const manifest = { name: '@bitpay-labs/bitcore-wallet-service', main: './index.js' };
  const files = new Set(['index.js', 'templates/en/mail.html', 'ts_build/templates/en/mail.html']);
  write(directory, 'templates/en/mail.html', 'message');
  write(directory, 'ts_build/templates/en/mail.html', 'message');
  checkContents(manifest, files, directory);
  write(directory, 'ts_build/templates/en/mail.html', 'stale message');
  assert.throws(() => checkContents(manifest, files, directory), /template differs/);
  assert.throws(() => checkContents({ name: '@fixture/lib', main: './missing.js' }, files, directory), /tarball missing/);
});

test('packed dependency auditing detects shipped imports even when monorepo hoisting would resolve them', t => {
  const directory = fixture(t);
  write(directory, 'package.json', { name: '@fixture/lib', main: 'index.js', dependencies: { declared: '*' } });
  write(directory, 'index.js', "require('declared'); require('node:fs'); require('undeclared/subpath');");
  write(directory, 'coverage-builder.js', "require('developer-only-tool');");
  write(directory, 'lib/index.d.ts', "export type Value = import('missing-types').Value;");
  const result = audit(directory);
  assert.equal(result.failures.length, 2);
  assert(result.failures.some(failure => failure.includes('undeclared')));
  assert(result.failures.some(failure => failure.includes('missing-types')));
});

test('consumer verification rejects registry substitution even at the same package version', t => {
  const directory = fixture(t);
  const artifact = { name: '@fixture/lib', version: '12.3.4', tarball: path.join(directory, 'lib.tgz') };
  write(directory, 'node_modules/@fixture/lib/package.json', { name: artifact.name, version: artifact.version });
  write(directory, 'package-lock.json', { packages: { 'node_modules/@fixture/lib': { resolved: 'file:lib.tgz' } } });
  assert.deepEqual(verifyInstalledArtifacts(directory, [artifact]), []);
  write(directory, 'package-lock.json', { packages: { 'node_modules/@fixture/lib': { resolved: 'https://registry.npmjs.org/lib.tgz' } } });
  assert.match(verifyInstalledArtifacts(directory, [artifact]).join('\n'), /did not use candidate tarball/);
});
