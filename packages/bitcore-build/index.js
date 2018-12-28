'use strict';

var gulp = require('gulp');

var coveralls = require('@kollavarsham/gulp-coveralls');
//var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');
var rename = require('gulp-rename');
var shell = require('gulp-shell');
var uglify = require('gulp-uglify');
//var bump = require('gulp-bump');
//var git = require('gulp-git');
var fs = require('fs');

function ignoreerror() {
  /* jshint ignore:start */ // using `this` in this context is weird 
  this.emit('end');
  /* jshint ignore:end */
}

function startGulp(name, opts) {
  var task = {};
  opts = opts || {};
  var browser = !opts.skipBrowser;
  var fullname = name ? 'bitcore-' + name : 'bitcore';
  var files = ['lib/**/*.js'];
  var tests = ['test/**/*.js'];
  var alljs = files.concat(tests);

  var buildPath = './node_modules/bitcore-build/';
  var buildModulesPath = buildPath + 'node_modules/';
  var buildBinPath = buildPath + 'node_modules/.bin/';

  var browserifyPath = buildBinPath + 'browserify';
  var karmaPath = buildBinPath + 'karma';
  var platoPath = buildBinPath + 'plato';
  var istanbulPath = buildBinPath + 'istanbul';
  var mochaPath = buildBinPath + '_mocha';

  // newer version of node? binaries are in lower level of node_module path
  if (!fs.existsSync(browserifyPath)) {
    browserifyPath = './node_modules/.bin/browserify';
  } 

  if (!fs.existsSync(karmaPath)) {
    karmaPath = './node_modules/.bin/karma';
  }

  if (!fs.existsSync(istanbulPath)) {
    istanbulPath = './node_modules/.bin/istanbul';
  }

  if (!fs.existsSync(platoPath)) {
    platoPath = './node_modules/.bin/plato';
  }

  if (!fs.existsSync(mochaPath)) {
    mochaPath = './node_modules/.bin/_mocha';
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
    karmaPath + '  start ' + buildPath + 'karma.conf.js --single-run '
  ]);

  task['test:node'] =  testmocha;
  task['test:node:nofail'] =  function() {
    return testmocha().on('error', ignoreerror);
  };


  task['noop']= function() {};

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

    task['browser:uglify'] =function() {
      return gulp.src(fullname + '.js')
        .pipe(uglify({
          mangle: true,
          compress: true
        }))
        .pipe(rename(fullname + '.min.js'))
        .pipe(gulp.dest('.'))
        .on('error', console.error);
    };

    task['browser:compressed'] =
      gulp.series(task['browser:uncompressed'], task['browser:uglify']);

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

  task['coverage']= shell.task([istanbulPath + ' cover ' + mochaPath + ' -- --recursive']);

  task['coveralls'] = gulp.series(task['coverage'], function() {
    gulp.src('coverage/lcov.info').pipe(coveralls());
  });

  /**
   * watch tasks
   */

  task['watch:test'] = function() {
    //// todo: only run tests that are linked to file changes by doing
    //// something smart like reading through the require statements
    return gulp.watch(alljs, gulp.series('test'));
  };

  task['watch:test:node']= function() {
    //// todo: only run tests that are linked to file changes by doing
    //// something smart like reading through the require statements
    return gulp.watch(alljs, gulp.series('test:node'));
  };

  if (browser) {
    task['watch:test:browser'], function() {
      // todo: only run tests that are linked to file changes by doing
      // something smart like reading through the require statements
      return gulp.watch(alljs, task['test:browser']);
   };
  }

  task['watch:coverage']= function() {
    // todo: only run tests that are linked to file changes by doing
    // something smart like reading through the require statements
    return gulp.watch(alljs, task[coverage]);
  };

  task['watch:lint']= function() {
    //// todo: only lint files that are linked to file changes by doing
    //// something smart like reading through the require statements
    return gulp.watch(alljs, task[lint]);
  };

  if (browser) {
    task['watch:browser']= function() {
      return gulp.watch(alljs, task[browser]);
    };
  }

  /**
   * Release automation
   */

  task['release:install']= shell.task([ 'npm install']);

  var releaseFiles = ['./package.json'];

  //var bump_version = function(importance) {
    //return gulp.src(releaseFiles)
      //.pipe(bump({
        //type: importance
      //}))
      //.pipe(gulp.dest('./'));
  //};

  //var tempBranch = 'releases/' + new Date().getTime() + '-build';
  //gulp.task('release:checkout-releases', function(cb) {
    //git.branch(tempBranch, {
      //args: ''
    //}, function() {
      //git.checkout(tempBranch, {
        //args: ''
      //}, cb);
    //});
  //});

  //gulp.task('release:cleanup', function(cb) {
    //git.branch(tempBranch, {
      //args: '-D'
    //}, cb);
  //});

  //gulp.task('release:checkout-master', function(cb) {
    //git.checkout('master', {
      //args: ''
    //}, cb);
  //});

  //gulp.task('release:sign-built-files', shell.task([
    //'gpg --yes --out ' + fullname + '.js.sig --detach-sig ' + fullname + '.js',
    //'gpg --yes --out ' + fullname + '.min.js.sig --detach-sig ' + fullname + '.min.js'
  //]));

  //var buildFiles = ['./package.json'];
  //var signatureFiles = [];
  //if (browser) {
    //buildFiles.push(fullname + '.js');
    //buildFiles.push(fullname + '.js.sig');
    //buildFiles.push(fullname + '.min.js');
    //buildFiles.push(fullname + '.min.js.sig');

    //buildFiles.push('./bower.json');

    //signatureFiles.push(fullname + '.js.sig');
    //signatureFiles.push(fullname + '.min.js.sig');
  //}
  //var addFiles = function() {
    //var pjson = require('../../package.json');
    //return gulp.src(buildFiles)
      //.pipe(git.add({
        //args: '-f'
      //}));
  //};

  //var buildCommit = function() {
    //var pjson = require('../../package.json');
    //return gulp.src(buildFiles)
      //.pipe(git.commit('Build: ' + pjson.version, {
        //args: ''
      //}));
  //};

  //gulp.task('release:add-signed-files', ['release:sign-built-files'], addFiles);
  //gulp.task('release:add-built-files', addFiles);

  //if (browser) {
    //gulp.task('release:build-commit', [
      //'release:add-signed-files'
    //], buildCommit);
  //} else {
    //gulp.task('release:build-commit', [
      //'release:add-built-files'
    //], buildCommit);
  //}

  //gulp.task('release:version-commit', function() {
    //var pjson = require('../../package.json');
    //return gulp.src(releaseFiles)
      //.pipe(git.commit('Bump package version to ' + pjson.version, {
        //args: ''
      //}));
  //});

  //gulp.task('release:push', function(cb) {
    //git.push('bitpay', 'master', {
      //args: ''
    //}, cb);
  //});

  //gulp.task('release:push-tag', function(cb) {
    //var pjson = require('../../package.json');
    //var name = 'v' + pjson.version;
    //git.tag(name, 'Release ' + name, function() {
      //git.push('bitpay', name, cb);
    //});
  //});

  //gulp.task('release:publish', shell.task([
    //'npm publish'
  //]));


  //// requires https://hub.github.com/
  //var release = function(importance, cb) {
    //var bumper = 'release:bump:' + importance;
    //return runsequence(
      //// Checkout the release temporal branch
      //'release:checkout-releases',
      //// Run npm install
      //'release:install',
      //// Run tests with gulp test
      //'test',
      //// Update package.json and bower.json
      //bumper,
      //// build browser files
      //browser ? 'browser' : 'noop',
      //// Commit 
      //'release:build-commit',
      //// Run git push bitpay $VERSION
      //'release:push-tag',
      //// Run npm publish
      //'release:publish',
      //// Checkout the `master` branch
      //'release:checkout-master',
      //// Bump package.json and bower.json, again
      //bumper,
      //// Version commit with no binary files to master
      //'release:version-commit',
      //// Push to master
      //'release:push',
      //// remove release branch
      //'release:cleanup',
      //cb);
  //};

  //['patch', 'minor', 'major'].forEach(function(importance) {
    //gulp.task('release:' + importance, function(cb) {
      //release(importance, cb);
    //});
    //gulp.task('release:bump:' + importance, function() {
      //bump_version(importance);
    //});
  //});
  //gulp.task('release', ['release:patch']);


  task['test:browser'] = 
    gulp.series(task['browser:uncompressed'], task['browser:maketests'], task['test:karma']);


  if (browser) {
    task['test']= gulp.series(task['test:node'], task['test:browser']);
  } else {
    task['test']= task['test:node'];
  }
  task['default']= task['test'];
  return  task;
}

module.exports = startGulp;

