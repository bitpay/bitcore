'use strict';

var gulp = require('gulp');

var coveralls = require('@kollavarsham/gulp-coveralls');
//var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');
var rename = require('gulp-rename');
var shell = require('gulp-shell');
var terser = require('gulp-terser');
//var bump = require('gulp-bump');
//var git = require('gulp-git');
var fs = require('fs');
var path = require('path'); // Add path module for better path handling

function ignoreerror() {
  /* jshint ignore:start */ // using `this` in this context is weird
  this.emit('end');
  /* jshint ignore:end */
}


function startGulp(name, opts) {

  function findMonorepoRoot(startDir) {
    let currentDir = startDir;
    while (currentDir !== path.parse(currentDir).root) {
      if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    return startDir; // fallback to starting directory if no workspace root found
  }

  function findBinary(binaryName) {
    const monorepoRoot = findMonorepoRoot(process.cwd());

    const possiblePaths = [
      path.join(monorepoRoot, 'node_modules/.bin/', binaryName),  // Monorepo root binaries
      path.join('./node_modules/.bin/', binaryName),              // Local project binaries
      path.join(process.cwd(), 'node_modules/.bin/', binaryName), // Absolute path to project binaries
      path.join(buildBinPath, binaryName)                         // Original build path
    ];

    for (const binPath of possiblePaths) {
      if (fs.existsSync(binPath)) {
        return binPath;
      }
    }

    // Fallback to monorepo root node_modules/.bin
    return path.join(monorepoRoot, 'node_modules/.bin/', binaryName);
  }

  const monorepoRoot = findMonorepoRoot(process.cwd());

  var task = {};
  opts = opts || {};
  var browser = !opts.skipBrowser;
  var fullname = name ? 'bitcore-' + name : 'bitcore';
  var files = ['lib/**/*.js'];
  var tests = ['test/**/*.js'];
  var alljs = files.concat(tests);

  const buildPath = path.join(monorepoRoot, 'node_modules', '@bcpros', 'bitcore-build') + '/';
  const buildModulesPath = path.join(monorepoRoot, 'node_modules') + '/';
  const buildBinPath = path.join(monorepoRoot, 'node_modules', '.bin') + '/';

  var browserifyPath = buildBinPath + 'browserify';
  var karmaPath = buildBinPath + 'karma';
  var platoPath = buildBinPath + 'plato';
  var istanbulPath = buildBinPath + 'istanbul';
  var mochaPath = buildBinPath + '_mocha';

  // newer version of node? binaries are in lower level of node_module path
  if (!fs.existsSync(browserifyPath)) {
    browserifyPath = findBinary('browserify');
  }

  if (!fs.existsSync(karmaPath)) {
    karmaPath = findBinary('karma');
  }

  if (!fs.existsSync(istanbulPath)) {
    istanbulPath = findBinary('istanbul');
  }

  if (!fs.existsSync(platoPath)) {
    platoPath = findBinary('plato');
  }

  if (!fs.existsSync(mochaPath)) {
    mochaPath = findBinary('_mocha');
  }

  /**
   * testing
   */
  var testmocha = function () {
    return gulp.src(tests).pipe(mocha({
      reporter: 'spec'
    }));
  };

  task['test:karma'] = shell.task([
    `${karmaPath} start ${path.join(monorepoRoot, 'node_modules', '@bcpros', 'bitcore-build', 'karma.conf.js')} --single-run`
  ]);

  task['test:node'] = testmocha;
  task['test:node:nofail'] = function () {
    return testmocha().on('error', ignoreerror);
  };


  task['noop'] = function () { };

  /**
   * file generation
   */
  if (browser) {

    var browserifyCommand;

    if (name !== 'lib') {
      browserifyCommand = browserifyPath + ' --require ./index.js:' + fullname + ' --external bitcore-lib -o ' + fullname + '.js';
    } else {
      browserifyCommand = browserifyPath + ' --require ./index.js:bitcore-lib -o bitcore-lib.js';
    }

    task['browser:uncompressed'] = shell.task([
      browserifyCommand
    ]);

    task['browser:terser'] = function () {
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
      'find test/ -type f -name "*.js" | xargs ' + browserifyPath + ' -t brfs -o tests.js'
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

  task['coverage'] = shell.task([istanbulPath + ' cover ' + mochaPath + ' -- --recursive']);

  task['coveralls'] = gulp.series(task['coverage'], function () {
    gulp.src('coverage/lcov.info').pipe(coveralls());
  });

  /**
   * watch tasks
   */

  task['watch:test'] = function () {
    //// todo: only run tests that are linked to file changes by doing
    //// something smart like reading through the require statements
    return gulp.watch(alljs, gulp.series('test'));
  };

  task['watch:test:node'] = function () {
    //// todo: only run tests that are linked to file changes by doing
    //// something smart like reading through the require statements
    return gulp.watch(alljs, gulp.series('test:node'));
  };

  if (browser) {
    task['watch:test:browser'], function () {
      // todo: only run tests that are linked to file changes by doing
      // something smart like reading through the require statements
      return gulp.watch(alljs, task['test:browser']);
    };
  }

  task['watch:coverage'] = function () {
    // todo: only run tests that are linked to file changes by doing
    // something smart like reading through the require statements
    return gulp.watch(alljs, task[coverage]);
  };

  task['watch:lint'] = function () {
    //// todo: only lint files that are linked to file changes by doing
    //// something smart like reading through the require statements
    return gulp.watch(alljs, task[lint]);
  };

  if (browser) {
    task['watch:browser'] = function () {
      return gulp.watch(alljs, task[browser]);
    };
  }

  if (browser) {
    // task['test:browser'] = gulp.series(task['browser:uncompressed'], task['browser:maketests'], task['test:karma']);
    task['test:browser'] = gulp.series(task['browser:uncompressed'], task['browser:maketests']);
    task['test'] = gulp.series(task['test:node'], task['test:browser']);
  } else {
    task['test'] = task['test:node'];
  }
  task['default'] = task['test'];

  /**
   * Release automation
   */

  task['release:install'] = shell.task(['npm install']);
  var releaseFiles = ['./package.json'];
  return task;
}

module.exports = startGulp;

