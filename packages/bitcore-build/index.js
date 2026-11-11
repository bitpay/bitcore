'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const gulp = require('gulp');
const rename = require('gulp-rename');
const shell = require('gulp-shell');
const terser = require('gulp-terser');

// Locates an installed package's own root directory (the directory holding
// its package.json) starting from its resolved entry point. Some packages
// (e.g. @wdio/cli) declare a strict "exports" map that rejects a direct
// './package.json' subpath import, so resolution goes through the package's
// normal main/exports entry instead, then walks up from there to the
// nearest package.json whose own "name" matches -- terminating at that
// package's real root regardless of how many subdirectories its entry file
// sits under.
function resolvePackageDir(packageName, fromDir) {
  const entryPath = require.resolve(packageName, { paths: [fromDir] });
  let dir = path.dirname(entryPath);
  for (;;) {
    const manifestPath = path.join(dir, 'package.json');
    if (fs.existsSync(manifestPath) && JSON.parse(fs.readFileSync(manifestPath, 'utf8')).name === packageName) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('bitcore-build: could not locate the package root for "' + packageName + '"');
    }
    dir = parent;
  }
}

// Resolves an npm-installed CLI's real bin script from bitcore-build's own
// location (__dirname), using that dependency's own package manifest "bin"
// metadata -- the same mechanism npm itself uses to create node_modules/.bin
// entries. Resolution starts from __dirname and walks up its own ancestor
// node_modules, so this finds the tool whether it is nested under
// bitcore-build (Lerna's per-package bootstrap) or hoisted to a shared root
// (npm workspaces), instead of the previous fixed-depth
// './node_modules/@bitpay-labs/bitcore-build/node_modules/.bin/<tool>' /
// './node_modules/.bin/<tool>' guesses, which only matched the former layout
// and silently broke under the latter.
function resolveBin(packageName, binName) {
  const packageDir = resolvePackageDir(packageName, __dirname);
  const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  const key = binName || packageName.split('/').pop();
  const binRelative = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin && manifest.bin[key];
  if (!binRelative) {
    throw new Error('bitcore-build: "' + packageName + '" declares no "' + key + '" bin entry');
  }
  return path.join(packageDir, binRelative);
}

// Shell-quotes a path so tool invocations survive checkout locations
// containing spaces.
function quote(p) {
  return '"' + p.replace(/"/g, '\\"') + '"';
}

function startGulp(name, opts) {
  const task = {};
  opts = opts || {};
  opts.externals = opts.externals || [];
  opts.transforms = opts.transforms || [];
  assert(!opts.browserRunner || ['karma', 'webdriverio'].includes(opts.browserRunner), 'Invalid option - browserRunner: "' + opts.browserRunner + '"');

  const browser = !opts.skipBrowser;
  const browserRunner = opts.browserRunner || 'karma';
  const fullname = name ? 'bitcore-' + name : 'bitcore';
  const files = ['lib/**/*.js'];
  const tests = ['test/**/*.js'];
  const alljs = files.concat(tests);

  const browserifyPath = quote(resolveBin('browserify'));
  const karmaPath = quote(resolveBin('karma'));
  const webdriverioPath = quote(resolveBin('@wdio/cli', 'wdio'));

  // The shared browser configs are owned by, and always shipped next to,
  // this file -- resolve them from here rather than from a consumer-cwd
  // guess about where bitcore-build physically lives.
  const defaultKarmaConf = quote(path.join(__dirname, 'karma.conf.js'));
  const defaultWdioConf = quote(path.join(__dirname, 'wdio.conf.js'));

  task['test:karma'] = shell.task([
    karmaPath + ' start ' + (opts.karmaConf || defaultKarmaConf) + ' --single-run'
  ]);

  task['test:webdriverio'] = shell.task([
    webdriverioPath + ' run ' + (opts.wdioConf || defaultWdioConf)
  ]);

  task['noop']= function() {};

  /**
   * file generation
   */
  if (browser) {

    let browserifyCommand;

    if (name === 'tss') {
      browserifyCommand = browserifyPath + ' --require ./index.js:' + fullname + opts.externals.map(e => ' --external ' + e).join('') + opts.transforms.map(t => ' -t ' + t).join('') + ' -o ' + fullname + '.js';
    } else if (name !== 'lib') {
      browserifyCommand = browserifyPath + ' --require ./index.js:' + fullname + ' --external @bitpay-labs/bitcore-lib -o ' + fullname + '.js';
    } else {
      browserifyCommand = browserifyPath + ' --require ./index.js:bitcore-lib -o bitcore-lib.js';
    }

    task['browser:uncompressed'] = shell.task([
      browserifyCommand
    ]);

    task['browser:terser'] = function() {
      return gulp.src(fullname + '.js')
        .pipe(terser({
          mangle: true,
          compress: true
        }))
        .pipe(rename(fullname + '.min.js'))
        .pipe(gulp.dest('.'))
        .on('error', console.error);
    };

    task['browser:compressed'] =
      gulp.series(task['browser:uncompressed'], task['browser:terser']);

    task['browser:maketests'] = shell.task([
      'find test/ -type f -name "*.js" | xargs ' + browserifyPath + opts.externals.map(e => ' --external ' + e).join('') + opts.transforms.map(t => ' -t ' + t).join('') + ' -t brfs -o tests.js'
    ]);

    task['browser'] = task['browser:compressed'];
  }

  /**
   * code quality and documentation
   */

  //  task['lint']= function() {
  //    return gulp.src(alljs)
  //      .pipe(jshint())
  //      .pipe(jshint.reporter('default'));
  //  };

  //  task['plato']= shell.task([platoPath + ' -d report -r -l .jshintrc -t ' + fullname + ' lib']);

  // Resolve both CLIs from the helper's own dependencies, independently of
  // the consuming package's PATH or workspace installation layout.
  const coveragePath = quote(resolveBin('monocart-coverage-reports', 'mcr'));
  const mochaPath = quote(resolveBin('mocha'));
  task['test:node'] = shell.task([coveragePath + ' ' + mochaPath + ' --exit --recursive']);

  /**
   * watch tasks
   */

  task['watch:test'] = function() {
    // todo: only run tests that are linked to file changes by doing
    // something smart like reading through the require statements
    return gulp.watch(alljs, gulp.series('test'));
  };

  task['watch:test:node'] = function() {
    // todo: only run tests that are linked to file changes by doing
    // something smart like reading through the require statements
    return gulp.watch(alljs, gulp.series('test:node'));
  };

  if (browser) {
    task['watch:test:browser'] = function() {
      // todo: only run tests that are linked to file changes by doing
      // something smart like reading through the require statements
      return gulp.watch(alljs, task['test:browser']);
    };
  }

  task['watch:lint'] = function() {
    // todo: only lint files that are linked to file changes by doing
  // something smart like reading through the require statements
    return gulp.watch(alljs, task['lint']);
  };

  if (browser) {
    task['watch:browser'] = function() {
      return gulp.watch(alljs, task[browser]);
    };
  }

  if (browser) {
    task['test:browser'] = gulp.series(task['browser:uncompressed'], task['browser:maketests'], task[`test:${browserRunner}`]);
    task['test'] = gulp.series(task['test:node'], task['test:browser']);
  } else {
    task['test'] = task['test:node'];
  }
  task['default'] = task['test'];

  /**
   * Release automation
   */

  task['release:install'] = shell.task([ 'npm install']);
  return task;
}

module.exports = startGulp;
// Exposed so focused tests can locate a real dependency's installed
// location the same way this file does, instead of hardcoding an
// assumption about nested vs. hoisted layout themselves.
module.exports.resolvePackageDir = resolvePackageDir;
