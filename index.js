'use strict';

var gulp = require('gulp');

/**
 * @file gulpfile.js
 *
 * Defines tasks that can be run on gulp.
 *
 * Summary: <ul>
 * <li> `test` - runs all the tests on node and the browser (mocha and karma)
 * <ul>
 * <li> `test:node`
 * <li> `test:node:nofail` - internally used for watching (due to bug on gulp-mocha)
 * <li> `test:browser`
 * </ul>`
 * <li> `watch:test` - watch for file changes and run tests
 * <ul>
 * <li> `watch:test:node`
 * <li> `watch:test:browser`
 * </ul>`
 * <li> `browser` - generate files needed for browser (browserify)
 * <ul>
 * <li> `browser:uncompressed` - build `bitcore-*.js`
 * <li> `browser:compressed` - build `bitcore-*.min.js`
 * <li> `browser:maketests` - build `tests.js`, needed for testing without karma
 * </ul>`
 * <li> `errors` - autogenerate the `./lib/errors/index.js` file with error definitions
 * <li> `lint` - run `jshint`
 * <li> `coverage` - run `istanbul` with mocha to generate a report of test coverage
 * <li> `coveralls` - updates coveralls info
 * <li> `release` - automates release process (only for bitcore maintainers)
 * </ul>
 */
function startGulp(name) {

  var coveralls = require('gulp-coveralls');
  var gutil = require('gulp-util');
  var jshint = require('gulp-jshint');
  var mocha = require('gulp-mocha');
  var rename = require('gulp-rename');
  var runsequence = require('run-sequence');
  var shell = require('gulp-shell');
  var uglify = require('gulp-uglify');

  var files = ['lib/**/*.js'];
  var tests = ['test/**/*.js'];
  var alljs = files.concat(tests);

  function ignoreerror() {
    /* jshint ignore:start */ // using `this` in this context is weird 
    this.emit('end');
    /* jshint ignore:end */
  }

  var testmocha = function() {
    return gulp.src(tests).pipe(new mocha({
      reporter: 'spec'
    }));
  };

  var testkarma = shell.task([
    './node_modules/karma/bin/karma start'
  ]);

  /**
  * testing
  */

  gulp.task('test:node', ['errors'], testmocha);

  gulp.task('test:node:nofail', ['errors'], function() {
    return testmocha().on('error', ignoreerror);
  });

  gulp.task('test:browser', ['browser:uncompressed', 'browser:maketests'], testkarma);

  gulp.task('test', function(callback) {
    runsequence(['test:node'], ['test:browser'], callback);
  });

  /**
  * file generation
  */

  gulp.task('browser:uncompressed', ['errors'], shell.task([
    './node_modules/.bin/browserify index.js --insert-global-vars=true --standalone=bitcore-' +
    name + ' -o bitcore-' + name + '.js'
  ]));

  gulp.task('browser:compressed', ['browser:uncompressed'], function() {
    return gulp.src('bitcore-' + name + '.js')
      .pipe(uglify({
        mangle: true,
        compress: true
      }))
      .pipe(rename('bitcore-' + name + '.min.js'))
      .pipe(gulp.dest('.'))
      .on('error', gutil.log);
  });

  gulp.task('browser:maketests', shell.task([
    'find test/ -type f -name "*.js" | xargs ./node_modules/.bin/browserify -t brfs -o tests.js'
  ]));

  gulp.task('browser', function(callback) {
    runsequence(['browser:compressed'], ['browser:maketests'], callback);
  });

  gulp.task('errors', shell.task([
    'node ./lib/errors/build.js'
  ]));


  /**
  * code quality and documentation
  */

  gulp.task('lint', function() {
    return gulp.src(alljs)
      .pipe(jshint())
      .pipe(jshint.reporter('default'));
  });

  gulp.task('plato', shell.task(['plato -d report -r -l .jshintrc -t bitcore-' + name + ' lib']));

  gulp.task('coverage', shell.task(['node_modules/.bin/./istanbul cover node_modules/.bin/_mocha -- --recursive']));

  gulp.task('coveralls', ['coverage'], function() {
    gulp.src('coverage/lcov.info').pipe(coveralls());
  });

  /**
  * watch tasks
  */

  gulp.task('watch:test', function() {
    // todo: only run tests that are linked to file changes by doing
    // something smart like reading through the require statements
    return gulp.watch(alljs, ['test']);
  });

  gulp.task('watch:test:node', function() {
    // todo: only run tests that are linked to file changes by doing
    // something smart like reading through the require statements
    return gulp.watch(alljs, ['test:node']);
  });

  gulp.task('watch:test:browser', function() {
    // todo: only run tests that are linked to file changes by doing
    // something smart like reading through the require statements
    return gulp.watch(alljs, ['test:browser']);
  });

  gulp.task('watch:jsdoc', function() {
    // todo: only run tests that are linked to file changes by doing
    // something smart like reading through the require statements
    return gulp.watch(alljs, ['jsdoc']);
  });

  gulp.task('watch:coverage', function() {
    // todo: only run tests that are linked to file changes by doing
    // something smart like reading through the require statements
    return gulp.watch(alljs, ['coverage']);
  });

  gulp.task('watch:lint', function() {
    // todo: only lint files that are linked to file changes by doing
    // something smart like reading through the require statements
    return gulp.watch(alljs, ['lint']);
  });

  gulp.task('watch:browser', function() {
    return gulp.watch(alljs, ['browser']);
  });
}

module.exports = startGulp;
