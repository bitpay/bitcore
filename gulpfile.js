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
 * <li> `browser:uncompressed` - build `browser/bitcore.js`
 * <li> `browser:compressed` - build `browser/bitcore.min.js`
 * <li> `browser:maketests` - build `browser/tests.js`, needed for testing without karma
 * </ul>`
 * <li> `errors` - autogenerate the `./lib/errors/index.js` file with error definitions 
 * <li> `lint` - run `jshint`
 * <li> `coverage` - run `istanbul` with mocha to generate a report of test coverage
 * <li> `jsdoc` - run `jsdoc` to generate the API reference
 * </ul>
 */
'use strict';

var gulp = require('gulp');
var closureCompiler = require('gulp-closure-compiler');
var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');
var runSequence = require('run-sequence');
var shell = require('gulp-shell');


var files = ['lib/**/*.js'];
var tests = ['test/**/*.js'];
var alljs = files.concat(tests);


function ignoreError() {
  /* jshint ignore:start */ // using `this` in this context is weird 
  this.emit('end');
  /* jshint ignore:end */
}

var testMocha = function() {
  return gulp.src(tests).pipe(new mocha({
    reporter: 'spec'
  }));
};

var testKarma = shell.task([
  './node_modules/karma/bin/karma start --single-run --browsers Firefox'
]);

/**
 * Testing
 */

gulp.task('test:node', ['errors'], testMocha);

gulp.task('test:node:nofail', ['errors'], function() {
  return testMocha().on('error', ignoreError);
});

gulp.task('test:browser', ['browser:uncompressed', 'browser:maketests'], testKarma);

gulp.task('test', function(callback) {
  runSequence(['test:node'], ['test:browser'], callback);
});

/**
 * File generation
 */

gulp.task('browser:makefolder', shell.task([
  'if [ ! -d "browser" ]; then mkdir browser; fi'
]));

gulp.task('browser:uncompressed', ['browser:makefolder', 'errors'], shell.task([
  './node_modules/.bin/browserify index.js --insert-global-vars=true --standalone=bitcore -o browser/bitcore.js'
]));

gulp.task('browser:compressed', ['browser:makefolder', 'errors'], function() {
  return gulp.src('dist/bitcore.js')
    .pipe(closureCompiler({
      fileName: 'bitcore.min.js',
      compilerPath: 'node_modules/closure-compiler-jar/compiler.jar',
      compilerFlags: {
        language_in: 'ECMASCRIPT5',
        jscomp_off: 'suspiciousCode'
      }
    }))
    .pipe(gulp.dest('dist'));
});

gulp.task('browser:maketests', ['browser:makefolder'], shell.task([
  'find test/ -type f -name "*.js" | xargs ./node_modules/.bin/browserify -t brfs -o browser/tests.js'
]));

gulp.task('browser', ['errors'], function(callback) {
  runSequence(['browser:uncompressed'], ['browser:compressed'], ['browser:maketests'], callback);
});

gulp.task('errors', shell.task([
  'node ./lib/errors/build.js'
]));


/**
 * Code quality and documentation
 */

gulp.task('lint', function() {
  return gulp.src(alljs)
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('plato', shell.task(['plato -d report -r -l .jshintrc -t bitcore lib']));

gulp.task('jsdoc', shell.task(['jsdoc -c .jsdoc.conf lib']));

gulp.task('coverage', shell.task(['istanbul cover _mocha -- --recursive']));

/**
 * Watch tasks
 */

gulp.task('watch:test', function() {
  // TODO: Only run tests that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['test']);
});

gulp.task('watch:test:node', function() {
  // TODO: Only run tests that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['test:node']);
});

gulp.task('watch:test:browser', function() {
  // TODO: Only run tests that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['test:browser']);
});

gulp.task('watch:jsdoc', function() {
  // TODO: Only run tests that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['jsdoc']);
});

gulp.task('watch:coverage', function() {
  // TODO: Only run tests that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['coverage']);
});

gulp.task('watch:lint', function() {
  // TODO: Only lint files that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['lint']);
});

gulp.task('watch:browser', function() {
  return gulp.watch(alljs, ['browser']);
});

/**
 * Default task
 */
gulp.task('default', function(callback) {
  return runSequence(['lint', 'jsdoc'],
                     ['browser:uncompressed', 'test'],
                     ['coverage', 'browser:compressed'],
                     callback);
});
